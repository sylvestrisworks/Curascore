import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

async function main() {
  const slugs = ['limbo', 'the-last-of-us', 'red-dead-redemption-2', 'uncharted-4-a-thiefs-end']
  const rows = await db.select({ slug: games.slug, curascore: gameScores.curascore, debateRounds: gameScores.debateRounds })
    .from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(inArray(games.slug, slugs))

  for (const r of rows) console.log(r.slug.padEnd(35), 'curascore:', r.curascore, r.debateRounds ? '✓ debated' : '— pending')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
