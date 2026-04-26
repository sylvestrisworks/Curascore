import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'

const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' })
const db = drizzle(client)

// How many standalone games have a curascore?
const scored = await db.execute(sql`
  SELECT COUNT(*) as total,
    COUNT(CASE WHEN gs.curascore IS NOT NULL THEN 1 END) as with_score,
    MIN(gs.curascore) as min_score,
    MAX(gs.curascore) as max_score,
    ROUND(AVG(gs.curascore)) as avg_score
  FROM games g
  LEFT JOIN game_scores gs ON gs.game_id = g.id
  WHERE g.content_type = 'standalone_game'
`)
console.log('Scored games:', scored[0])

// How many have ESRB or PEGI?
const rated = await db.execute(sql`
  SELECT
    COUNT(CASE WHEN esrb_rating IS NOT NULL THEN 1 END) as has_esrb,
    COUNT(CASE WHEN pegi_rating IS NOT NULL THEN 1 END) as has_pegi,
    COUNT(CASE WHEN esrb_rating IS NULL AND pegi_rating IS NULL THEN 1 END) as unrated,
    COUNT(*) as total
  FROM games
  WHERE content_type = 'standalone_game'
`)
console.log('Ratings:', rated[0])

// Sample: what scores do we have?
const dist = await db.execute(sql`
  SELECT 
    width_bucket(gs.curascore, 0, 100, 10) as bucket,
    COUNT(*) as count
  FROM game_scores gs
  JOIN games g ON g.id = gs.game_id
  WHERE gs.curascore IS NOT NULL AND g.content_type = 'standalone_game'
  GROUP BY bucket ORDER BY bucket
`)
console.log('Score distribution:', dist.map((r: any) => `${(r.bucket-1)*10}-${r.bucket*10}: ${r.count}`))

await client.end()
