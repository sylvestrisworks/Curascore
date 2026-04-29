import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

  await sql`
    CREATE TABLE IF NOT EXISTS ingest_cursor (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      genre_index    INTEGER NOT NULL DEFAULT 0,
      page           INTEGER NOT NULL DEFAULT 1,
      sweep          INTEGER NOT NULL DEFAULT 1,
      total_imported INTEGER NOT NULL DEFAULT 0,
      last_run_at    TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT NOW()
    )
  `
  console.log('✓ ingest_cursor table created (or already exists)')

  await sql.end()
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
