import postgres from 'postgres'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const client = postgres(process.env.DATABASE_URL!)
const [r] = await client`
  SELECT
    COUNT(*) FILTER (WHERE dopamine_risk IS NULL) AS needs_rescore,
    COUNT(*) FILTER (WHERE dopamine_risk IS NOT NULL) AS already_rescored,
    COUNT(*) AS total
  FROM experience_scores
`
console.log(r)
await client.end()
