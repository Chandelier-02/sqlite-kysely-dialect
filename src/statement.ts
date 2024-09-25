import {
  BindableValue,
  PreparedStatement,
  Sqlite3Static,
  Database,
} from '@sqlite.org/sqlite-wasm';

export class SqliteStatementWrapper {
  readonly #stmt: PreparedStatement;
  readonly #sqlite: Sqlite3Static;
  readonly #db: Database;

  constructor(stmt: PreparedStatement, sqlite: Sqlite3Static, db: Database) {
    this.#stmt = stmt;
    this.#sqlite = sqlite;
    this.#db = db;
  }

  isReadOnly(): boolean {
    return this.#sqlite.capi.sqlite3_stmt_readonly(this.#stmt) !== 0;
  }

  run(parameters: Readonly<unknown[]>): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  } {
    this.#stmt.bind(parameters as BindableValue[]);

    const totalChangesBefore = this.#sqlite.capi.sqlite3_total_changes64(
      this.#db,
    );
    this.#stmt.step();
    this.#stmt.reset(true);

    const totalChangesAfter = this.#sqlite.capi.sqlite3_total_changes64(
      this.#db,
    );

    const changes = totalChangesAfter - totalChangesBefore;
    const lastInsertRowid = this.#sqlite.capi.sqlite3_last_insert_rowid(
      this.#db,
    );

    return {
      changes,
      lastInsertRowid,
    };
  }

  all(parameters: Readonly<unknown[]>): unknown[] {
    const results: unknown[] = [];
    let rowCount = 0;

    this.#stmt.bind(parameters as BindableValue[]);

    while (this.#stmt.step()) {
      if (rowCount > Number.MAX_SAFE_INTEGER) {
        throw new Error('Array overflow (too many rows returned)');
      }

      const result = this.#stmt.get({});
      results.push(result);
      rowCount++;
    }

    this.#stmt.reset(true);
    return results;
  }

  *iterate(parameters: Readonly<unknown[]>): Generator {
    this.#stmt.bind(parameters as BindableValue[]);

    while (this.#stmt.step()) {
      const result = this.#stmt.get({});
      yield result;
    }

    this.#stmt.reset(true);
  }

  [Symbol.dispose](): void {
    this.#stmt.finalize();
  }
}
