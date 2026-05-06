/**
 * Tests different ways of passing a string[] to a jsonb column via postgres.js,
 * to find which approach stores correctly.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

const PLATFORMS = ['PlayStation 5', 'Xbox Series S/X', 'PC']

async function check(label: string, sql: postgres.Sql) {
  const slug = `__test_${label}__`
  await sql`DELETE FROM games WHERE slug = ${slug}`

  // Insert via raw sql tagged template
  await sql`
    INSERT INTO games (slug, title, platforms, genres, updated_at)
    VALUES (${slug}, '__test__', ${sql.json(PLATFORMS)}, ${sql.json([])}, NOW())
  `

  const [row] = await sql`
    SELECT platforms, jsonb_typeof(platforms) as jtype FROM games WHERE slug = ${slug}
  `
  console.log(`  [${label}] stored: ${JSON.stringify(row.platforms).slice(0, 60)}  typeof=${row.jtype}`)
  await sql`DELETE FROM games WHERE slug = ${slug}`
}

async function checkUnsafe(label: string, sql: postgres.Sql) {
  const slug = `__test_${label}__`
  await sql`DELETE FROM games WHERE slug = ${slug}`

  // Insert via unsafe (what Drizzle uses internally)
  await sql.unsafe(
    `INSERT INTO games (slug, title, platforms, genres, updated_at) VALUES ($1, $2, $3, $4, NOW())`,
    [slug, '__test__', PLATFORMS, []]
  )

  const [row] = await sql`
    SELECT platforms, jsonb_typeof(platforms) as jtype FROM games WHERE slug = ${slug}
  `
  console.log(`  [${label}] stored: ${JSON.stringify(row.platforms).slice(0, 60)}  typeof=${row.jtype}`)
  await sql`DELETE FROM games WHERE slug = ${slug}`
}

async function checkUnsafeJson(label: string, sql: postgres.Sql) {
  const slug = `__test_${label}__`
  await sql`DELETE FROM games WHERE slug = ${slug}`

  await sql.unsafe(
    `INSERT INTO games (slug, title, platforms, genres, updated_at) VALUES ($1, $2, $3, $4, NOW())`,
    [slug, '__test__', JSON.stringify(PLATFORMS), JSON.stringify([])]
  )

  const [row] = await sql`
    SELECT platforms, jsonb_typeof(platforms) as jtype FROM games WHERE slug = ${slug}
  `
  console.log(`  [${label}] stored: ${JSON.stringify(row.platforms).slice(0, 60)}  typeof=${row.jtype}`)
  await sql`DELETE FROM games WHERE slug = ${slug}`
}

async function main() {
  const withPrepare = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: true })
  const noPrepare   = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false })

  console.log('sql.json() tagged template:')
  await check('tagged+prepare', withPrepare)
  await check('tagged+noprepare', noPrepare)

  console.log('\nunsafe() with raw string[] array:')
  await checkUnsafe('unsafe+prepare', withPrepare)
  await checkUnsafe('unsafe+noprepare', noPrepare)

  console.log('\nunsafe() with JSON.stringify string:')
  await checkUnsafeJson('unsafe-str+prepare', withPrepare)
  await checkUnsafeJson('unsafe-str+noprepare', noPrepare)

  await withPrepare.end()
  await noPrepare.end()
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
