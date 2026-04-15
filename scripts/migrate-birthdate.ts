/**
 * Adds birth_date DATE column to child_profiles and backfills from birth_year.
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  console.log('Adding birth_date column…')
  await db.execute(sql`
    ALTER TABLE child_profiles
    ADD COLUMN IF NOT EXISTS birth_date DATE
  `)

  console.log('Backfilling birth_date from birth_year…')
  await db.execute(sql`
    UPDATE child_profiles
    SET birth_date = make_date(birth_year, 1, 1)
    WHERE birth_date IS NULL
  `)

  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
