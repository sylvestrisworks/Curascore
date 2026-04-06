import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { ilike } from 'drizzle-orm'

async function main() {
  const keywords = [
    'minecraft', 'fortnite', 'roblox', 'zelda', 'genshin', 'grand theft', 'among us',
    'candy crush', 'mario kart', 'animal crossing', 'pokemon scarlet', 'call of duty',
    'ea sports fc', 'stardew', 'portal 2', 'rocket league', 'clash royale',
    'subway surfers', 'split fiction', 'pokemon violet',
  ]

  for (const kw of keywords) {
    const rows = await db
      .select({ id: games.id, slug: games.slug, title: games.title, esrb: games.esrbRating })
      .from(games)
      .where(ilike(games.title, `%${kw}%`))
      .limit(3)
    console.log(`\n=== ${kw} ===`)
    rows.forEach(r => console.log(`  [${r.id}] ${r.slug}  |  ${r.title}  (${r.esrb})`))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
