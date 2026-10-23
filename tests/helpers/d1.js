/**
 * A small in-memory stand-in for a Cloudflare D1 binding, built on sql.js
 * (SQLite compiled to WebAssembly, so there is no native module to build).
 *
 * It implements the parts of the D1 API the Functions use: prepare/bind,
 * first, run, all, batch and exec. The real migrations from `migrations/`
 * are applied, so the tests exercise the same schema, upserts and RETURNING
 * clauses that production runs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(here, "../../migrations");

let SQL;

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }

  #rows() {
    const stmt = this.db.prepare(this.sql);
    try {
      stmt.bind(this.params.map((value) => (value === undefined ? null : value)));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  async first(column) {
    const rows = this.#rows();
    if (rows.length === 0) return null;
    return column ? rows[0][column] : rows[0];
  }

  async all() {
    const results = this.#rows();
    return { success: true, results, meta: { changes: this.db.getRowsModified() } };
  }

  async run() {
    const results = this.#rows();
    return { success: true, results, meta: { changes: this.db.getRowsModified() } };
  }
}

export async function createD1({ migrate = true } = {}) {
  SQL ??= await initSqlJs();
  const db = new SQL.Database();

  if (migrate) {
    for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
      db.exec(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
    }
  }

  return {
    prepare: (sql) => new Statement(db, sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const statement of statements) out.push(await statement.run());
        db.exec("COMMIT");
        return out;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 1 };
    },
    /** Test helper: every row of a table. */
    rows(table) {
      const result = db.exec(`SELECT * FROM ${table}`);
      if (result.length === 0) return [];
      const [{ columns, values }] = result;
      return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    },
    /** Test helper: the names of every table. */
    tables() {
      const result = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
      return result.length ? result[0].values.map(([name]) => name) : [];
    },
  };
}
