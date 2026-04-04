const WORKSPACE = process.env.DATABRICKS_WORKSPACE || 'https://dbc-52c82696-1a63.cloud.databricks.com'
const TOKEN = process.env.DATABRICKS_TOKEN
const WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID || 'a70e21061683061c'
const CATALOG = 'fishappmap'
const SCHEMA = 'app'

function tableName(name) {
  return `${CATALOG}.${SCHEMA}.${name}`
}

async function query(sql, params = []) {
  let finalSql = sql
  if (params.length > 0) {
    let idx = 0
    finalSql = sql.replace(/\?/g, () => {
      const val = params[idx++]
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'number' || typeof val === 'boolean') return String(val)
      return `'${String(val).replace(/'/g, "''")}'`
    })
  }

  const res = await fetch(`${WORKSPACE}/api/2.0/sql/statements`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      warehouse_id: WAREHOUSE_ID,
      statement: finalSql,
      wait_timeout: '30s',
    }),
  })

  const data = await res.json()

  if (data.status?.state === 'FAILED') {
    throw new Error(data.status?.error?.message || 'Databricks query failed')
  }

  if (data.status?.state === 'PENDING' || data.status?.state === 'RUNNING') {
    return pollStatement(data.statement_id)
  }

  const columns = data.manifest?.schema?.columns?.map(c => c.name) || []
  const rows = data.result?.data_array || []
  return { columns, rows }
}

async function pollStatement(statementId) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const res = await fetch(`${WORKSPACE}/api/2.0/sql/statements/${statementId}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    })
    const data = await res.json()
    if (data.status?.state === 'SUCCEEDED') {
      const columns = data.manifest?.schema?.columns?.map(c => c.name) || []
      const rows = data.result?.data_array || []
      return { columns, rows }
    }
    if (data.status?.state === 'FAILED') {
      throw new Error(data.status?.error?.message || 'Query failed')
    }
  }
  throw new Error('Query timed out')
}

async function execute(sql, params = []) {
  await query(sql, params)
}

module.exports = { query, execute, tableName }
