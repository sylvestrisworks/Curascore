import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const client = postgres(process.env.DATABASE_URL!)

await client`ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS scoring_method varchar(20)`
console.log('game_scores.scoring_method added')

await client`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS dopamine_risk real`
await client`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS monetization_risk real`
await client`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS social_risk real`
await client`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS content_risk real`
await client`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS time_rec_reasoning text`
await client`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS curascore_ai_suggested integer`
await client`ALTER TABLE experience_scores ADD COLUMN IF NOT EXISTS scoring_method varchar(20)`
console.log('experience_scores columns added')

await client.end()
console.log('Done.')
