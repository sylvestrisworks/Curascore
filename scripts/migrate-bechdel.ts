/**
 * migrate-bechdel.ts
 *
 * Adds bechdel_result + bechdel_notes columns to the reviews table,
 * and bechdel_result to game_scores.
 *
 * Usage:
 *   npx tsx scripts/migrate-bechdel.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  console.log('Adding bechdel columns…')

  await db.execute(sql`
    ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS bechdel_result VARCHAR(4),
      ADD COLUMN IF NOT EXISTS bechdel_notes  TEXT
  `)
  console.log('  ✓ reviews.bechdel_result, reviews.bechdel_notes')

  await db.execute(sql`
    ALTER TABLE game_scores
      ADD COLUMN IF NOT EXISTS bechdel_result VARCHAR(4)
  `)
  console.log('  ✓ game_scores.bechdel_result')

  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
