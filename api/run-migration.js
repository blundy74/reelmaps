/**
 * Migration runner — connects to RDS with master password and creates tables.
 * Usage: node run-migration.js
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const DB_HOST = 'database-2-instance-1.c9w2gq2yifa4.us-east-2.rds.amazonaws.com'
const DB_PORT = 5432
const DB_USER = 'postgres'
const DB_PASSWORD = '!amBLUNDY!'

function makeClient(database) {
  return new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })
}

async function run() {
  // Step 1: Connect to default 'postgres' database to create 'reelmaps'
  console.log('Connecting to RDS...')
  const adminClient = makeClient('postgres')
  await adminClient.connect()
  console.log('Connected.')

  const dbCheck = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = 'reelmaps'"
  )
  if (dbCheck.rows.length === 0) {
    console.log('Creating database "reelmaps"...')
    await adminClient.query('CREATE DATABASE reelmaps')
    console.log('Database created.')
  } else {
    console.log('Database "reelmaps" already exists.')
  }
  await adminClient.end()

  // Step 2: Connect to reelmaps and run migration
  console.log('Connecting to reelmaps database...')
  const appClient = makeClient('reelmaps')
  await appClient.connect()
  console.log('Connected.')

  const migrationSql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf-8')
  console.log('Running migration...')
  await appClient.query(migrationSql)
  console.log('Migration complete!')

  // Verify tables
  const tables = await appClient.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  )
  console.log('Tables:', tables.rows.map(r => r.tablename).join(', '))

  await appClient.end()
  console.log('Done.')
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
