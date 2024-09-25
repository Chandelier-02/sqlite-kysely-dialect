import { Database } from '@sqlite.org/sqlite-wasm';
import { DatabaseConnection } from 'kysely';

export interface SqliteDialectConfig {
  database: Database | (() => Promise<Database>);

  onCreateConnection?: (connection: DatabaseConnection) => Promise<void>;
}

export interface SqliteStatement {
  readonly reader: boolean;
  all(parameters: ReadonlyArray<unknown>): unknown[];
  run(parameters: ReadonlyArray<unknown>): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
  iterate(parameters: ReadonlyArray<unknown>): IterableIterator<unknown>;
}
