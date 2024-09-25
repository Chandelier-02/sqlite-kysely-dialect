import {
  DatabaseIntrospector,
  Dialect,
  DialectAdapter,
  Driver,
  Kysely,
  QueryCompiler,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely';
import { freeze } from './util';
import { SqliteDriver } from './driver';
import { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { SqliteDialectConfig } from './dialect-config';

export class SqliteDialect implements Dialect {
  readonly #config: SqliteDialectConfig;
  readonly #sqlite: Sqlite3Static;

  constructor(config: SqliteDialectConfig, sqlite: Sqlite3Static) {
    this.#config = freeze({ ...config });
    this.#sqlite = sqlite;
  }

  createDriver(): Driver {
    return new SqliteDriver(this.#config, this.#sqlite);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
