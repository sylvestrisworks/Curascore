import { db } from '../src/lib/db'
import { games, gameScores } from '../src/lib/db/schema'
import { eq, isNull, count } from 'drizzle-orm'

async function main() {
  const [total] = await db.select({ n: count() }).from(games)

  const unscored = await db
    .select({ title: games.title })
    .from(games)
    .leftJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNull(gameScores.id))

  const nullCura = await db
    .select({ title: games.title })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNull(gameScores.curascore))

  console.log('Total in DB:          ', total.n)
  console.log('No score row at all:  ', unscored.length)
  console.log('Null curascore:       ', nullCura.length)
  console.log('Visible on browse:    ', Number(total.n) - unscored.length)
  console.log('Visible on discover:  ', Number(total.n) - unscored.length - nullCura.length)

  if (unscored.length) {
    console.log('\nNo score row (hidden everywhere):')
    unscored.forEach(g => console.log('  -', g.title))
  }
  if (nullCura.length) {
    console.log('\nNull curascore (hidden on discover):')
    nullCura.slice(0, 30).forEach(g => console.log('  -', g.title))
    if (nullCura.length > 30) console.log(`  ...and ${nullCura.length - 30} more`)
  }
}

main().catch(console.error)
