import { db } from '../src/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent`)
  console.log('unaccent enabled')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
