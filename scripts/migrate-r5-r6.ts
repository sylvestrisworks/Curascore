/**
 * One-time migration: add R5/R6 columns to reviews and game_scores.
 * Run with: node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/migrate-r5-r6.ts
 */

import { sql } from 'drizzle-orm'
import { db } from '../src/lib/db'

async function main() {
  await db.execute(sql`
    ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS r5_cross_platform    integer,
      ADD COLUMN IF NOT EXISTS r5_load_time         integer,
      ADD COLUMN IF NOT EXISTS r5_mobile_optimized  integer,
      ADD COLUMN IF NOT EXISTS r5_login_barrier     integer,
      ADD COLUMN IF NOT EXISTS r6_infinite_gameplay  integer,
      ADD COLUMN IF NOT EXISTS r6_no_stopping_points integer,
      ADD COLUMN IF NOT EXISTS r6_no_game_over       integer,
      ADD COLUMN IF NOT EXISTS r6_no_chapters        integer;
  `)

  await db.execute(sql`
    ALTER TABLE game_scores
      ADD COLUMN IF NOT EXISTS accessibility_risk real,
      ADD COLUMN IF NOT EXISTS endless_design_risk real;
  `)

  console.log('Migration complete.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
