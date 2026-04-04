/**
 * PostgreSQL database module (replaces databricks.js).
 *
 * Uses the `pg` Pool for connection pooling. Connections are reused
 * across Lambda invocations within the same warm container.
 *
 * Environment variables:
 *   DATABASE_URL  — full connection string (preferred)
 *     or individual:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

const { Pool } = require('pg')

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'reelmaps',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 5,                // Lambda concurrency-friendly pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
)

/**
 * Run a parameterized query. Uses $1, $2, ... placeholders (pg native).
 * Returns { rows } where each row is an object keyed by column name.
 */
async function query(sql, params = []) {
  const result = await pool.query(sql, params)
  return result
}

/**
 * Run an INSERT / UPDATE / DELETE. Returns the full pg result.
 */
async function execute(sql, params = []) {
  return pool.query(sql, params)
}

module.exports = { query, execute, pool }
