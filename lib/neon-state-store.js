const { Pool } = require('pg');

const DEFAULT_TABLE_NAME = 'app_state_snapshots';

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

class NeonStateStore {
  constructor({ connectionString, tableName = DEFAULT_TABLE_NAME } = {}) {
    this.connectionString = String(connectionString || '').trim();
    this.tableName = tableName;
    this.pool = this.connectionString
      ? new Pool({
        connectionString: this.connectionString,
        max: 3,
        connectionTimeoutMillis: 5000,
        query_timeout: 5000,
        statement_timeout: 5000,
      })
      : null;
    this.initPromise = null;
  }

  isEnabled() {
    return this.pool !== null;
  }

  async initialize() {
    if (!this.pool) return false;
    if (!this.initPromise) {
      const table = quoteIdentifier(this.tableName);
      this.initPromise = this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${table} (
          state_key text PRIMARY KEY,
          payload jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
    }
    try {
      await this.initPromise;
    } catch (err) {
      this.disable(err);
      return false;
    }
    return true;
  }

  async load(stateKey) {
    if (!this.pool) return null;
    const ready = await this.initialize();
    if (!ready || !this.pool) return null;
    const table = quoteIdentifier(this.tableName);
    try {
      const result = await this.pool.query(
        `SELECT payload FROM ${table} WHERE state_key = $1 LIMIT 1`,
        [stateKey]
      );
      return result.rows[0] ? result.rows[0].payload : null;
    } catch (err) {
      this.disable(err);
      return null;
    }
  }

  async save(stateKey, payload) {
    if (!this.pool) return false;
    const ready = await this.initialize();
    if (!ready || !this.pool) return false;
    const table = quoteIdentifier(this.tableName);
    try {
      await this.pool.query(
        `
          INSERT INTO ${table} (state_key, payload, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (state_key)
          DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
        `,
        [stateKey, JSON.stringify(payload)]
      );
      return true;
    } catch (err) {
      this.disable(err);
      return false;
    }
  }

  disable(err) {
    const pool = this.pool;
    this.pool = null;
    this.initPromise = null;
    if (err && err.message) {
      console.warn('[NeonStateStore] Disabling snapshot persistence:', err.message);
    }
    if (pool) {
      pool.end().catch(() => {});
    }
  }

  async close() {
    if (!this.pool) return;
    await this.pool.end();
  }
}

module.exports = {
  NeonStateStore,
};
