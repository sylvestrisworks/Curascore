/**
 * Tests whether a jsonb string[] column round-trips correctly through Drizzle + postgres.js
 * in this execution context (cron script, not Next.js).
 * Inserts a test row, reads it back, checks encoding, then deletes it.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'

const TEST_SLUG = '__jsonb_test_platforms__'
const TEST_PLATFORMS = ['PlayStation 5', 'Xbox Series S/X', 'PC', 'Nintendo Switch']

async function main() {
  // Clean up any leftover test row
  await db.delete(games).where(eq(games.slug, TEST_SLUG))

  // Insert via Drizzle (same path as fetch-games-cron.ts)
  await db.insert(games).values({
    slug:      TEST_SLUG,
    title:     '__test__',
    platforms: TEST_PLATFORMS,
    genres:    [],
    updatedAt: new Date(),
  })

  // Read back via raw postgres.js to see what's actually stored
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })
  const [raw] = await sql`
    SELECT platforms, jsonb_typeof(platforms) as jtype
    FROM games WHERE slug = ${TEST_SLUG}
  `
  await sql.end()

  console.log('Inserted platforms (JS):', JSON.stringify(TEST_PLATFORMS))
  console.log('Stored raw value:       ', JSON.stringify(raw.platforms))
  console.log('jsonb_typeof:           ', raw.jtype)

  if (raw.jtype === 'string') {
    console.log('\n⚠️  BUG CONFIRMED — platforms is double-encoded as a jsonb string')
  } else if (raw.jtype === 'array') {
    console.log('\n✓  OK — platforms stored as proper jsonb array')
  }

  // Clean up
  await db.delete(games).where(eq(games.slug, TEST_SLUG))
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
