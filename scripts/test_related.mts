import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql, eq, and, gte, lte, isNotNull, desc, notInArray } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

const { games, gameScores } = schema
const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' })
const db = drizzle(client)

// Run the exact runQuery from related-games.ts
async function runQuery(
  excludeSlugs: string[],
  minScore: number,
  maxScore: number,
  platforms: string[] | null,
  bucket: string | null,
  limit: number,
) {
  const rows = await db
    .select({
      slug:       games.slug,
      title:      games.title,
      platforms:  games.platforms,
      esrbRating: games.esrbRating,
      curascore:  gameScores.curascore,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(
      eq(games.contentType, 'standalone_game'),
      isNotNull(gameScores.curascore),
      gte(gameScores.curascore, minScore),
      lte(gameScores.curascore, maxScore),
      excludeSlugs.length > 0 ? notInArray(games.slug, excludeSlugs) : undefined,
      platforms && platforms.length > 0
        ? sql`(${sql.join(platforms.map(p => sql`${games.platforms} @> ${JSON.stringify([p])}::jsonb`), sql` OR `)})`
        : undefined,
      bucket
        ? sql`CASE
            WHEN ${games.esrbRating} IN ('E', 'E10+') THEN 'everyone'
            WHEN ${games.esrbRating} = 'T' THEN 'teen'
            WHEN ${games.esrbRating} IN ('M', 'AO') THEN 'mature'
            WHEN ${games.pegiRating} <= 12 THEN 'everyone'
            WHEN ${games.pegiRating} <= 16 THEN 'teen'
            WHEN ${games.pegiRating} = 18 THEN 'mature'
            ELSE NULL
          END = ${bucket}`
        : undefined,
    ))
    .orderBy(desc(gameScores.curascore))
    .limit(limit)
  return rows
}

// Test with Minecraft's actual data
const [mc] = await db
  .select({ slug: games.slug, platforms: games.platforms, esrb: games.esrbRating, pegi: games.pegiRating, curascore: gameScores.curascore })
  .from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id))
  .where(eq(games.slug, 'minecraft'))
console.log('Minecraft:', { esrb: mc.esrb, pegi: mc.pegi, curascore: mc.curascore, platformCount: (mc.platforms as string[])?.length })

const bucket = mc.esrb === 'E' || mc.esrb === 'E10+' ? 'everyone' : mc.esrb === 'T' ? 'teen' : mc.esrb === 'M' || mc.esrb === 'AO' ? 'mature' : null
const score = mc.curascore!
const platforms = Array.isArray(mc.platforms) ? mc.platforms as string[] : []

console.log(`bucket=${bucket}, score=${score}`)

const p1 = await runQuery(['minecraft'], score - 10, score + 10, platforms, bucket, 5)
console.log(`Pass 1 (same platform, ±10, bucket): ${p1.length}`, p1.map(r => r.title))

const p2 = await runQuery(['minecraft', ...p1.map(r => r.slug)], score - 10, score + 10, null, bucket, 5 - p1.length)
console.log(`Pass 2 (any platform, ±10, bucket): ${p2.length}`, p2.map(r => r.title))

const p3 = await runQuery(['minecraft', ...p1.map(r=>r.slug), ...p2.map(r=>r.slug)], score - 20, score + 20, null, bucket, 5 - p1.length - p2.length)
console.log(`Pass 3 (any platform, ±20, bucket): ${p3.length}`, p3.map(r => r.title))

console.log(`\nTotal: ${p1.length + p2.length + p3.length}`)

await client.end()
