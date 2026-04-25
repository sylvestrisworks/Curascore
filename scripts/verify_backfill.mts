import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const client = postgres(process.env.DATABASE_URL!)

const [gs] = await client`SELECT COUNT(*) as total, COUNT(scoring_method) as with_method FROM game_scores`
const [es] = await client`SELECT COUNT(*) as total, COUNT(scoring_method) as with_method FROM experience_scores`

console.log('game_scores:       total=%d  with_method=%d', gs.total, gs.with_method)
console.log('experience_scores: total=%d  with_method=%d', es.total, es.with_method)

await client.end()
