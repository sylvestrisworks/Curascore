/**
 * Fetches fresh thumbnails for Fortnite Creative maps whose thumbnail_url
 * is broken (img2.fortnitemaps.com is dead) or NULL, then uploads to Vercel
 * Blob and updates the DB.
 *
 * Uses Epic Games client_credentials OAuth to hit the Fortnite island API.
 *
 *   npx tsx scripts/fix-fortnite-thumbnails.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { uploadFromUrl, experienceThumbPath } from '@/lib/gcs'

const TOKEN_URL   = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token'
const LINKS_BASE  = 'https://links.community-svc.ol.epicgames.com/links/api/fn/mnemonic'
const FORTNITE_UA = 'Fortnite/++Fortnite+Release-33.00-CL-38383825 Windows/10.0.22631.1.0.0.256.64bit'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

// ─── Epic auth ────────────────────────────────────────────────────────────────

async function getClientToken(): Promise<string> {
  const id     = process.env.EPIC_CLIENT_ID?.trim()
  const secret = process.env.EPIC_CLIENT_SECRET?.trim()
  if (!id || !secret) throw new Error('EPIC_CLIENT_ID / EPIC_CLIENT_SECRET not set')
  const creds  = Buffer.from(`${id}:${secret}`).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Epic token failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

// ─── Extract image URL from any known Epic API response shape ─────────────────

function extractImageUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const linkData = o.linkData as Record<string, unknown> | undefined
  const meta     = (o.metadata ?? linkData?.metadata) as Record<string, unknown> | undefined
  const img      = meta?.image_url ?? meta?.imageUrl ?? o.image_url ?? o.imageUrl
                   ?? linkData?.image_url ?? linkData?.imageUrl
  if (typeof img === 'string' && img.startsWith('http')) return img

  // Array containers
  const arr = Array.isArray(o.elements) ? o.elements
            : Array.isArray(o.results)  ? o.results
            : Array.isArray(raw)        ? (raw as unknown[])
            : null
  if (arr) {
    for (const item of arr) {
      const found = extractImageUrl(item)
      if (found) return found
    }
  }
  return null
}

// ─── Island thumbnail lookup ──────────────────────────────────────────────────

async function fetchIslandThumb(islandCode: string, token: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': FORTNITE_UA }

  // Try 1: direct mnemonic path
  try {
    const res = await fetch(`${LINKS_BASE}/${encodeURIComponent(islandCode)}`, {
      headers, signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const img = extractImageUrl(await res.json())
      if (img) return img
    }
  } catch { /* DNS or network — expected on non-Linux hosts */ }

  // Try 2: category query (same endpoint, different call style)
  try {
    const res = await fetch(`${LINKS_BASE}?category=${encodeURIComponent(islandCode)}&start=0&count=1`, {
      headers, signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const img = extractImageUrl(await res.json())
      if (img) return img
    }
  } catch { /* fall through */ }

  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const rows = await sql<{
    id: number; place_id: string; title: string; thumbnail_url: string | null
  }[]>`
    SELECT pe.id, pe.place_id, pe.title, pe.thumbnail_url
    FROM platform_experiences pe
    JOIN games g ON g.id = pe.platform_id
    WHERE g.slug = 'fortnite-creative'
      AND (
        pe.thumbnail_url IS NULL
        OR pe.thumbnail_url LIKE '%fortnitemaps.com%'
      )
    ORDER BY pe.id
  `

  console.log(`${rows.length} Fortnite experiences need thumbnails`)
  if (rows.length === 0) { await sql.end(); return }

  console.log('Getting Epic client token...')
  const token = await getClientToken()
  console.log('Token OK\n')

  let ok = 0, fail = 0

  for (const row of rows) {
    const islandCode = row.place_id
    if (!islandCode) { fail++; continue }

    const thumbUrl = await fetchIslandThumb(islandCode, token)
    if (!thumbUrl) {
      console.warn(`  SKIP ${row.title} (${islandCode}) — no image from Epic API`)
      fail++
      continue
    }

    const blobUrl = await uploadFromUrl(thumbUrl, experienceThumbPath('fortnite-creative', islandCode))
    if (!blobUrl) {
      console.warn(`  SKIP ${row.title} — blob upload failed`)
      fail++
      continue
    }

    await sql`
      UPDATE platform_experiences
      SET thumbnail_url = ${blobUrl}, updated_at = NOW()
      WHERE id = ${row.id}
    `
    ok++
    console.log(`  ✓ ${row.title}`)
  }

  console.log(`\nDone: ${ok} fixed, ${fail} failed`)
  await sql.end()
}

main().catch(e => { console.error(e.message ?? e); process.exit(1) })
