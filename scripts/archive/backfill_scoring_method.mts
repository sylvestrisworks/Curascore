import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

const [gsResult] = await db.execute(sql`
  UPDATE game_scores
  SET scoring_method = 'full_rubric'
  WHERE scoring_method IS NULL
`)
console.log('game_scores updated:', gsResult)

const [esResult] = await db.execute(sql`
  UPDATE experience_scores
  SET scoring_method = 'ugc_adapted'
  WHERE scoring_method IS NULL
`)
console.log('experience_scores updated:', esResult)

await client.end()
