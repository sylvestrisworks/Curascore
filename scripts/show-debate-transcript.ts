import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const slug = process.argv[2] ?? 'red-dead-redemption-2'
  const [row] = await db.select({ title: games.title, curascore: gameScores.curascore, bds: gameScores.bds, ris: gameScores.ris, transcript: gameScores.debateTranscript })
    .from(games).innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(eq(games.slug, slug))

  if (!row) { console.log('Not found'); process.exit(1) }
  console.log(`${row.title} — curascore: ${row.curascore}  BDS: ${row.bds?.toFixed(3)}  RIS: ${row.ris?.toFixed(3)}\n`)
  console.log(row.transcript ?? 'No transcript')
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
