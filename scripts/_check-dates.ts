import { db } from '../src/lib/db'
import { games } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const [g] = await db
    .select()
    .from(games)
    .where(eq(games.slug, 'the-legend-of-zelda-ocarina-of-time'))
    .limit(1)

  if (!g) { console.log('Game not found'); return }

  console.log('releaseDate:', g.releaseDate, '  type:', typeof g.releaseDate, '  isDate:', g.releaseDate instanceof Date)
  console.log('createdAt:  ', g.createdAt,   '  type:', typeof g.createdAt,   '  isDate:', g.createdAt instanceof Date)
  console.log('updatedAt:  ', g.updatedAt,   '  type:', typeof g.updatedAt,   '  isDate:', g.updatedAt instanceof Date)

  // Try calling toISOString on each
  try { console.log('releaseDate.toISOString():', g.releaseDate?.toISOString()) }
  catch(e) { console.error('releaseDate.toISOString() FAILED:', e) }

  try { console.log('updatedAt.toISOString():', g.updatedAt?.toISOString()) }
  catch(e) { console.error('updatedAt.toISOString() FAILED:', e) }
}

main().catch(err => { console.error(err); process.exit(1) })
