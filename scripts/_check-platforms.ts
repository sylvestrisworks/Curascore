import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  // What does pg_typeof say about the column?
  const [colType] = await sql`
    SELECT pg_typeof(platforms) FROM games LIMIT 1
  `
  console.log('Column pg_typeof:', colType.pg_typeof)

  // Sample — what do the raw values look like?
  const samples = await sql`
    SELECT id, slug, platforms
    FROM games
    ORDER BY id
    LIMIT 5
  `
  console.log('\nFirst 5 rows (raw):')
  for (const r of samples) {
    console.log(` id=${r.id}  platforms=${JSON.stringify(r.platforms)}  (typeof: ${typeof r.platforms})`)
  }

  // How many are double-encoded (stored as a JSON string, not an array)?
  const [doubleEncoded] = await sql`
    SELECT COUNT(*) FROM games
    WHERE jsonb_typeof(platforms) = 'string'
  `
  const [total] = await sql`SELECT COUNT(*) FROM games`
  const [arrayType] = await sql`
    SELECT COUNT(*) FROM games
    WHERE jsonb_typeof(platforms) = 'array'
  `
  const [nullType] = await sql`
    SELECT COUNT(*) FROM games
    WHERE platforms IS NULL OR jsonb_typeof(platforms) = 'null'
  `

  console.log(`\nTotal rows: ${total.count}`)
  console.log(`  jsonb array:  ${arrayType.count}`)
  console.log(`  jsonb string: ${doubleEncoded.count}  ← double-encoded`)
  console.log(`  null/empty:   ${nullType.count}`)

  // Show a double-encoded example
  const [example] = await sql`
    SELECT slug, platforms FROM games
    WHERE jsonb_typeof(platforms) = 'string'
    LIMIT 1
  `
  if (example) {
    console.log(`\nDouble-encoded example (${example.slug}):`)
    console.log('  raw platforms value:', JSON.stringify(example.platforms))
  }

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
