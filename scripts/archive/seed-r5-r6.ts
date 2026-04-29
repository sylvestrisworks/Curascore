/**
 * Seed R5/R6 scores for reviewed games.
 * Source: RUBRIC_UPDATE_BRIEF.md Feature 3 seed values.
 *
 * Run with:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/seed-r5-r6.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'

type R5R6Seed = {
  slug: string
  r5: [number, number, number, number]  // cross, load, mobile, login
  r6: [number, number, number, number]  // infinite, stop, over, chapters
}

const SEEDS: R5R6Seed[] = [
  { slug: 'the-legend-of-zelda-tears-of-the-kingdom', r5: [0, 0, 0, 2], r6: [2, 1, 1, 2] },
  { slug: 'genshin-impact',                           r5: [3, 3, 3, 1], r6: [2, 2, 2, 2] },
  { slug: 'split-fiction',                            r5: [1, 0, 0, 1], r6: [0, 0, 0, 3] },
  { slug: 'minecraft',                                r5: [2, 1, 1, 0], r6: [3, 3, 3, 2] },
  { slug: 'grand-theft-auto-v',                       r5: [2, 2, 2, 2], r6: [3, 3, 2, 2] },
]

async function main() {
  for (const seed of SEEDS) {
    const [game] = await db.select({ id: games.id }).from(games).where(eq(games.slug, seed.slug)).limit(1)
    if (!game) { console.warn(`Not found: ${seed.slug}`); continue }

    const [score] = await db.select({ reviewId: gameScores.reviewId }).from(gameScores).where(eq(gameScores.gameId, game.id)).limit(1)
    if (!score) { console.warn(`No score for: ${seed.slug}`); continue }

    const r5Total = seed.r5.reduce((a, b) => a + b, 0)
    const r6Total = seed.r6.reduce((a, b) => a + b, 0)

    await db.update(reviews).set({
      r5CrossPlatform:    seed.r5[0],
      r5LoadTime:         seed.r5[1],
      r5MobileOptimized:  seed.r5[2],
      r5LoginBarrier:     seed.r5[3],
      r6InfiniteGameplay:   seed.r6[0],
      r6NoStoppingPoints:   seed.r6[1],
      r6NoGameOver:         seed.r6[2],
      r6NoChapterStructure: seed.r6[3],
    }).where(eq(reviews.id, score.reviewId))

    await db.update(gameScores).set({
      accessibilityRisk: r5Total / 12,
      endlessDesignRisk: r6Total / 12,
    }).where(eq(gameScores.gameId, game.id))

    console.log(`✓ ${seed.slug} — R5: ${r5Total}/12, R6: ${r6Total}/12`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
