import { InitOptions, SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import { SqliteStatement } from 'kysely';

export type SqliteSahPoolOpts = {
  clearOnInit?: boolean;
  initialCapacity?: number;
  directory?: string;
  name?: string;
};

export type PoolUtilAPI = Omit<SAHPoolUtil, 'OpfsSAHPoolDb'> & {
  createSahPoolDb: (name: string) => boolean;
};

export interface DatabaseAPI {
  open(
    sqliteConfig: InitOptions,
    sahPoolConfig: SqliteSahPoolOpts,
  ): Promise<void>;

  close(): Promise<void>;

  prepare(sql: string): SqliteStatement;
}

export type StatementAPI = SqliteStatement;

export interface SahPoolWorkerAPI {
  pool: PoolUtilAPI;
  database: DatabaseAPI;
  statement: StatementAPI;
}

export type MakeAsync<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};
