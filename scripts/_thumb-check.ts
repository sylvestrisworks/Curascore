import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  // Sample backgroundImage URLs
  const samples = await sql`
    SELECT background_image FROM games
    WHERE background_image IS NOT NULL LIMIT 5
  `
  console.log('Sample backgroundImage URLs:')
  for (const r of samples) console.log(' ', r.background_image?.slice(0, 90))

  // Distinct domains
  const domains = await sql`
    SELECT
      substring(background_image from 'https?://([^/]+)') as domain,
      COUNT(*) as count
    FROM games WHERE background_image IS NOT NULL
    GROUP BY domain ORDER BY count DESC
  `
  console.log('\nbackgroundImage domains:')
  for (const d of domains) console.log(`  ${d.count.toString().padStart(5)}  ${d.domain}`)

  // Coverage
  const [withImg]    = await sql`SELECT COUNT(*) FROM games WHERE background_image IS NOT NULL`
  const [withoutImg] = await sql`SELECT COUNT(*) FROM games WHERE background_image IS NULL`
  console.log(`\nGames with image: ${withImg.count} / without: ${withoutImg.count}`)

  // Already on GCS?
  const [onGcs] = await sql`
    SELECT COUNT(*) FROM games WHERE background_image LIKE '%storage.googleapis.com%'
      OR background_image LIKE '%storage.cloud.google.com%'
  `
  console.log(`Already on GCS:   ${onGcs.count}`)

  // Roblox thumbnails
  const thumbSample = await sql`
    SELECT thumbnail_url FROM platform_experiences WHERE thumbnail_url IS NOT NULL LIMIT 3
  `
  console.log('\nSample Roblox thumbnailUrl:')
  for (const r of thumbSample) console.log(' ', r.thumbnail_url?.slice(0, 90))

  const [hasThumb] = await sql`SELECT COUNT(*) FROM platform_experiences WHERE thumbnail_url IS NOT NULL`
  const [noThumb]  = await sql`SELECT COUNT(*) FROM platform_experiences WHERE thumbnail_url IS NULL`
  console.log(`\nExperiences with thumb: ${hasThumb.count} / without: ${noThumb.count}`)

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
