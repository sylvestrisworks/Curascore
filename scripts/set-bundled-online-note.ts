/**
 * Seeds bundledOnlineNote for games with a good single-player campaign
 * but a toxic/risky bundled online mode.
 *
 * Run with:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.cjs scripts/set-bundled-online-note.ts
 */
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const NOTES: Record<string, string> = {
  'red-dead-redemption-2':
    'Red Dead Online is bundled in the same launcher and is accessible to any player. It adds real-money Gold Bars, aggressive spending prompts, competitive PvP with voice chat from strangers, and social pressure mechanics not present in the story campaign. Keep Red Dead Online inaccessible by not purchasing a PlayStation Plus / Xbox Game Pass subscription, or disable it in-game via Story Mode.',

  'grand-theft-auto-v':
    'GTA Online ships in the same launcher and is the primary mode many children end up playing. It features Shark Card real-money currency, aggressive spending design, adult content, voice chat with strangers, and extreme competitive toxicity — far beyond the already mature single-player story. Parental controls and disabling online access are strongly recommended.',

  'minecraft':
    'Minecraft\'s base game is offline and excellent. However Minecraft Realms, public servers (e.g. Hypixel), and the Marketplace add stranger interaction, in-game purchases, and community content that varies wildly in age-appropriateness. Keep multiplayer off or use a private family server to preserve the single-player experience.',
}

async function main() {
  for (const [slug, note] of Object.entries(NOTES)) {
    const result = await db.update(games)
      .set({ bundledOnlineNote: note })
      .where(eq(games.slug, slug))
    console.log(`✓ ${slug}`)
  }
  console.log('\nDone.')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
