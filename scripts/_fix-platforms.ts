import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  // Check ID range of double-encoded rows
  const [range] = await sql`
    SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as count
    FROM games WHERE jsonb_typeof(platforms) = 'string'
  `
  console.log(`Double-encoded: ${range.count} rows, IDs ${range.min_id}–${range.max_id}`)

  // Verify the fix on one row first
  const [sample] = await sql`
    SELECT id, slug, platforms, (platforms #>> '{}')::jsonb as fixed
    FROM games WHERE jsonb_typeof(platforms) = 'string' LIMIT 1
  `
  console.log('\nDry-run fix on one row:')
  console.log('  before:', JSON.stringify(sample.platforms))
  console.log('  after: ', JSON.stringify(sample.fixed))

  // Apply fix
  const result = await sql`
    UPDATE games
    SET platforms = (platforms #>> '{}')::jsonb,
        updated_at = NOW()
    WHERE jsonb_typeof(platforms) = 'string'
  `
  console.log(`\nFixed ${result.count} rows`)

  // Verify
  const [remaining] = await sql`
    SELECT COUNT(*) FROM games WHERE jsonb_typeof(platforms) = 'string'
  `
  const [arrays] = await sql`
    SELECT COUNT(*) FROM games WHERE jsonb_typeof(platforms) = 'array'
  `
  console.log(`Remaining double-encoded: ${remaining.count}`)
  console.log(`Proper arrays: ${arrays.count}`)

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
