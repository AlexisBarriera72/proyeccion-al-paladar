// A D1-shaped adapter over Node's built-in SQLite, so unit tests run the Worker's real SQL
// (the same statements D1 runs) instead of a second implementation. `batch` is one
// transaction, as in D1: if any statement fails, none is kept.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import type {Db, DbResult, DbStatement} from '../../worker/db.ts';
import type {SqlValue} from '../../worker/sql.ts';

const returnsRows = (query: string) => /^\s*(SELECT|WITH|PRAGMA)\b/i.test(query) || /\bRETURNING\b/i.test(query);

class Statement implements DbStatement {
  readonly sqlite: DatabaseSync;
  readonly query: string;
  readonly values: SqlValue[];

  constructor(sqlite: DatabaseSync, query: string, values: SqlValue[] = []) {
    this.sqlite = sqlite;
    this.query = query;
    this.values = values;
  }

  bind(...values: SqlValue[]): DbStatement {
    return new Statement(this.sqlite, this.query, values);
  }

  execute(): DbResult {
    const prepared = this.sqlite.prepare(this.query);
    if (returnsRows(this.query)) {
      return {results: prepared.all(...this.values) as Record<string, unknown>[], meta: {changes: 0}};
    }
    const result = prepared.run(...this.values);
    return {results: [], meta: {changes: Number(result.changes)}};
  }

  async first<T>(): Promise<T | null> {
    return (this.sqlite.prepare(this.query).get(...this.values) as T | undefined) ?? null;
  }

  async all<T>(): Promise<DbResult<T>> {
    return {results: this.sqlite.prepare(this.query).all(...this.values) as T[], meta: {changes: 0}};
  }

  async run(): Promise<DbResult> {
    return this.execute();
  }
}

export class TestD1 implements Db {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys = ON');
  }

  prepare(query: string): DbStatement {
    return new Statement(this.sqlite, query);
  }

  async batch(statements: DbStatement[]): Promise<DbResult[]> {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(stmt => (stmt as Statement).execute());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  /** Runs every migration in migrations/, in order. */
  migrate(): this {
    const dir = new URL('../../migrations/', import.meta.url);
    for (const file of fs
      .readdirSync(dir)
      .filter(name => name.endsWith('.sql'))
      .sort()) {
      this.sqlite.exec(fs.readFileSync(new URL(file, dir), 'utf8'));
    }
    return this;
  }

  /** Direct SQL for test setup and assertions (bypasses the ledger on purpose). */
  run(query: string, ...values: SqlValue[]) {
    return this.sqlite.prepare(query).run(...values);
  }

  get<T = Record<string, unknown>>(query: string, ...values: SqlValue[]): T | undefined {
    return this.sqlite.prepare(query).get(...values) as T | undefined;
  }

  rows<T = Record<string, unknown>>(query: string, ...values: SqlValue[]): T[] {
    return this.sqlite.prepare(query).all(...values) as T[];
  }
}
