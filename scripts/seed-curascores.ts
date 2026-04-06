/**
 * Backfill curascore for all reviewed games using the scoring engine.
 * Run with: node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/seed-curascores.ts
 */
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'
import { calculateGameScores } from '../src/lib/scoring/engine'
import { eq } from 'drizzle-orm'

async function main() {
  const scores = await db
    .select({ id: gameScores.id, reviewId: gameScores.reviewId, gameId: gameScores.gameId })
    .from(gameScores)

  for (const score of scores) {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, score.reviewId)).limit(1)
    if (!review) continue

    const result = calculateGameScores(review as Parameters<typeof calculateGameScores>[0])

    await db.update(gameScores)
      .set({ curascore: result.curascore })
      .where(eq(gameScores.id, score.id))

    const [game] = await db.select({ title: games.title }).from(games).where(eq(games.id, score.gameId)).limit(1)
    console.log(`✓ ${game?.title ?? score.gameId}: ${result.curascore}/100  (BDS=${result.bds.toFixed(2)}, RIS=${result.ris.toFixed(2)})`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
