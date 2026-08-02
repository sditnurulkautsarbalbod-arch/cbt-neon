import 'dotenv/config'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlRaw = readFileSync(join(__dirname, 'migrate-add-tables.sql'), 'utf-8')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(sqlRaw)
    console.log('✅ Migration complete!')
  } catch (err) {
    console.error('❌ Migration error:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
