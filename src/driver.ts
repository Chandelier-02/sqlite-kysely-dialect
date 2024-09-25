import { freeze, isFunction } from './util.js';
import { SqliteDialectConfig } from './dialect-config.js';
import { SelectQueryNode } from 'kysely';
import { Driver } from 'kysely';
import { DatabaseConnection, QueryResult } from 'kysely';
import { CompiledQuery } from 'kysely';
import { SqliteStatementWrapper } from './statement.js';
import { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { LRUCache } from 'lru-cache';
import xxHash, { XXHashAPI } from 'xxhash-wasm';

export class SqliteDriver implements Driver {
  readonly #config: SqliteDialectConfig;
  readonly #connectionMutex = new ConnectionMutex();
  readonly #sqlite: Sqlite3Static;

  #db?: Database;
  #connection?: DatabaseConnection;

  constructor(config: SqliteDialectConfig, sqlite: Sqlite3Static) {
    this.#config = freeze({ ...config });
    this.#sqlite = sqlite;
  }

  async init(): Promise<void> {
    this.#db = isFunction(this.#config.database)
      ? await this.#config.database()
      : this.#config.database;

    const hasher = await xxHash();
    this.#connection = new SqliteConnection(this.#db, this.#sqlite, hasher);

    if (this.#config.onCreateConnection) {
      await this.#config.onCreateConnection(this.#connection);
    }
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    // SQLite only has one single connection. We use a mutex here to wait
    // until the single connection has been released.
    await this.#connectionMutex.lock();
    return this.#connection as DatabaseConnection;
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin'));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'));
  }

  async releaseConnection(): Promise<void> {
    this.#connectionMutex.unlock();
    return Promise.resolve();
  }

  async destroy(): Promise<void> {
    this.#db?.close();
    return Promise.resolve();
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly #db: Database;
  readonly #sqlite: Sqlite3Static;
  readonly #hasher: XXHashAPI;
  readonly #statementCache: LRUCache<number, SqliteStatementWrapper>;

  constructor(db: Database, sqlite: Sqlite3Static, hasher: XXHashAPI) {
    this.#db = db;
    this.#sqlite = sqlite;
    this.#hasher = hasher;
    this.#statementCache = new LRUCache({
      maxSize: 128,
      dispose: (stmt) => stmt[Symbol.dispose](),
    });
  }

  executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters } = compiledQuery;

    const stmt = this.#getOrCreateWrapper(sql);

    if (stmt.isReadOnly()) {
      return Promise.resolve({
        rows: stmt.all(parameters) as O[],
      });
    } else {
      const { changes, lastInsertRowid } = stmt.run(parameters);

      const numAffectedRows = BigInt(changes);

      return Promise.resolve({
        // TODO: remove.
        numUpdatedOrDeletedRows: numAffectedRows,
        numAffectedRows,
        insertId: BigInt(lastInsertRowid),
        rows: [],
      });
    }
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
  ): AsyncIterableIterator<QueryResult<R>> {
    const { sql, parameters, query } = compiledQuery;

    const stmt = this.#getOrCreateWrapper(sql);

    if (SelectQueryNode.is(query)) {
      for (const row of stmt.iterate(parameters)) {
        yield await Promise.resolve({
          rows: [row],
        } as QueryResult<R>);
      }
    } else {
      throw new Error(
        'Sqlite driver only supports streaming of select queries',
      );
    }
  }

  #getOrCreateWrapper(sql: string): SqliteStatementWrapper {
    const hash = this.#hasher.h32(sql);

    let stmt: SqliteStatementWrapper;
    if (!this.#statementCache.has(hash)) {
      stmt = new SqliteStatementWrapper(
        this.#db.prepare(sql),
        this.#sqlite,
        this.#db,
      );
      this.#statementCache.set(hash, stmt);
    } else {
      stmt = this.#statementCache.get(hash) as SqliteStatementWrapper;
    }
    return stmt;
  }
}

class ConnectionMutex {
  #promise?: Promise<void>;
  #resolve?: () => void;

  async lock(): Promise<void> {
    while (this.#promise) {
      await this.#promise;
    }

    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  unlock(): void {
    const resolve = this.#resolve;

    this.#promise = undefined;
    this.#resolve = undefined;

    resolve?.();
  }
}
