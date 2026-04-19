/**
 * Resets the debate for one or more games so they get re-evaluated.
 * Usage: node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/reset-debate.ts <slug> [slug2 ...]
 */
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

async function main() {
  const slugs = process.argv.slice(2)
  if (!slugs.length) { console.error('Usage: reset-debate.ts <slug> [slug2 ...]'); process.exit(1) }

  const rows = await db.select({ id: games.id, slug: games.slug, title: games.title })
    .from(games).where(inArray(games.slug, slugs))

  for (const game of rows) {
    await db.update(gameScores)
      .set({ debateRounds: null, debateTranscript: null })
      .where(eq(gameScores.gameId, game.id))
    console.log(`✓ Reset debate for: ${game.title}`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
