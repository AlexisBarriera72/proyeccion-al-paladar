// The slice of the D1 API this app uses. Cloudflare's D1Database satisfies it, and so does
// the node:sqlite adapter in tests/unit/d1.ts, so the same statements run in both.
import type {Sql, SqlValue} from './sql.ts';

export interface DbResult<T = Record<string, unknown>> {
  results?: T[];
  meta: {changes?: number};
}

export interface DbStatement {
  bind(...values: SqlValue[]): DbStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DbResult<T>>;
  run(): Promise<DbResult>;
}

export interface Db {
  prepare(query: string): DbStatement;
  /** Runs every statement in one transaction: if any fails, none is kept. */
  batch(statements: DbStatement[]): Promise<DbResult[]>;
}

export const statement = (db: Db, query: Sql) => db.prepare(query.text).bind(...query.params);

export async function first<T>(db: Db, query: Sql): Promise<T | null> {
  return statement(db, query).first<T>();
}

export async function all<T>(db: Db, query: Sql): Promise<T[]> {
  return (await statement(db, query).all<T>()).results ?? [];
}
