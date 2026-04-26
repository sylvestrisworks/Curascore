import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'

const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' })
const db = drizzle(client)

const result = await db.execute(sql`
  SELECT
    COUNT(CASE WHEN platforms IS NULL OR platforms = '[]'::jsonb THEN 1 END) as no_platforms,
    COUNT(CASE WHEN platforms IS NOT NULL AND platforms != '[]'::jsonb THEN 1 END) as has_platforms,
    COUNT(*) as total
  FROM games WHERE content_type = 'standalone_game'
`)
console.log('Platform coverage:', result[0])

// What are the most common platforms?
const common = await db.execute(sql`
  SELECT p.value, COUNT(*) as cnt
  FROM games, jsonb_array_elements_text(platforms) p(value)
  WHERE content_type = 'standalone_game'
  GROUP BY p.value ORDER BY cnt DESC LIMIT 10
`)
console.log('Top platforms:', common.map((r: any) => `${r.value}: ${r.cnt}`))

await client.end()
