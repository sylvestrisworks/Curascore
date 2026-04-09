import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { isNull, count } from 'drizzle-orm'

async function main() {
  const [total] = await db.select({ n: count() }).from(games)
  const missing = await db
    .select({ id: games.id, title: games.title, slug: games.slug })
    .from(games)
    .where(isNull(games.backgroundImage))

  console.log('Total games  :', total.n)
  console.log('Missing image:', missing.length)

  if (missing.length) {
    missing.slice(0, 50).forEach(g => console.log(' -', g.slug))
    if (missing.length > 50) console.log(`  ...and ${missing.length - 50} more`)
  }
}

main().catch(console.error)
