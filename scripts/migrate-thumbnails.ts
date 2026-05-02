/**
 * One-shot backfill: uploads existing game backgroundImages and experience
 * thumbnailUrls to Vercel Blob, then updates the DB rows.
 *
 * Run with:
 *   npx tsx scripts/migrate-thumbnails.ts
 *
 * Safe to re-run — already-migrated rows (URL contains vercel-storage.com or
 * public.blob.vercel-storage.com) are skipped.
 * Progress is printed every 50 rows; resume by re-running after partial failures.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { uploadFromUrl, gameThumbPath, experienceThumbPath } from '@/lib/gcs'

const CONCURRENCY   = 8    // parallel uploads
const DELAY_BETWEEN = 50   // ms between upload batches

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

async function uploadBatch<T>(
  items: T[],
  upload: (item: T) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY)
    await Promise.all(chunk.map(upload))
    if (i + CONCURRENCY < items.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN))
    }
  }
}

async function migrateGames() {
  console.log('\n── Games ──────────────────────────────────────────────')

  const rows = await sql<{ id: number; slug: string; background_image: string }[]>`
    SELECT id, slug, background_image
    FROM games
    WHERE background_image IS NOT NULL
      AND background_image NOT LIKE '%vercel-storage.com%'
    ORDER BY id
  `
  console.log(`  ${rows.length} games to migrate`)

  let ok = 0, fail = 0

  await uploadBatch(rows, async (row) => {
    const path = gameThumbPath(row.slug, row.background_image)
    const blobUrl = await uploadFromUrl(row.background_image, path)
    if (blobUrl) {
      await sql`
        UPDATE games
        SET background_image = ${blobUrl}, updated_at = NOW()
        WHERE id = ${row.id}
      `
      ok++
      if (ok % 50 === 0) console.log(`  [games] ${ok} done`)
    } else {
      fail++
      if (fail <= 10) console.warn(`  [games] SKIP ${row.slug} — download failed`)
    }
  })

  console.log(`  Done: ${ok} migrated, ${fail} failed / skipped`)
}

async function migrateExperiences() {
  console.log('\n── Platform experiences ───────────────────────────────')

  const rows = await sql<{
    id: number; universe_id: string | null; platform: string; thumbnail_url: string
  }[]>`
    SELECT pe.id, pe.universe_id, g.slug as platform, pe.thumbnail_url
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id
    WHERE pe.thumbnail_url IS NOT NULL
      AND pe.thumbnail_url NOT LIKE '%vercel-storage.com%'
    ORDER BY pe.id
  `
  console.log(`  ${rows.length} experiences to migrate`)

  let ok = 0, fail = 0

  await uploadBatch(rows, async (row) => {
    const expId  = row.universe_id ?? row.id.toString()
    const path   = experienceThumbPath(row.platform, expId)
    const blobUrl = await uploadFromUrl(row.thumbnail_url, path)
    if (blobUrl) {
      await sql`
        UPDATE platform_experiences
        SET thumbnail_url = ${blobUrl}, updated_at = NOW()
        WHERE id = ${row.id}
      `
      ok++
      if (ok % 25 === 0) console.log(`  [experiences] ${ok} done`)
    } else {
      fail++
      if (fail <= 10) console.warn(`  [experiences] SKIP id=${row.id} — download failed`)
    }
  })

  console.log(`  Done: ${ok} migrated, ${fail} failed / skipped`)
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set')
    process.exit(1)
  }

  console.log('Thumbnail migration → Vercel Blob')
  const start = Date.now()

  await migrateGames()
  await migrateExperiences()

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\nFinished in ${elapsed}s`)
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
