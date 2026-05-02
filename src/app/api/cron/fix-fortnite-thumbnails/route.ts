/**
 * GET /api/cron/fix-fortnite-thumbnails
 *
 * Fetches fresh thumbnails for Fortnite Creative maps whose thumbnail_url
 * is NULL or pointing to a dead CDN, uploads them to Vercel Blob, and
 * updates the DB.
 *
 * Must run server-side (Vercel) — fortnite.com blocks residential IPs via
 * Cloudflare but allows Vercel datacenter IPs through for OG scraping.
 *
 * Trigger manually via:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://lumikin.org/api/cron/fix-fortnite-thumbnails
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq, isNull, or, like, and } from 'drizzle-orm'
import { uploadFromUrl, experienceThumbPath } from '@/lib/gcs'

export const maxDuration = 300

// Fetch island thumbnail from fortnite.com OG image tag
async function fetchIslandThumb(islandCode: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.fortnite.com/creative/island/${encodeURIComponent(islandCode)}`, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null

    const html = await res.text()
    const og = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1]
           ?? html.match(/content="([^"]+)"\s+property="og:image"/)?.[1]
    return og ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [fortnitePlatform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!fortnitePlatform) {
    return NextResponse.json({ error: 'fortnite-creative platform row not found' }, { status: 500 })
  }

  const withoutThumb = await db
    .select({ id: platformExperiences.id, placeId: platformExperiences.placeId, title: platformExperiences.title })
    .from(platformExperiences)
    .where(
      and(
        eq(platformExperiences.platformId, fortnitePlatform.id),
        or(
          isNull(platformExperiences.thumbnailUrl),
          like(platformExperiences.thumbnailUrl, '%fortnitemaps.com%'),
        ),
      )
    )

  console.log(`[fix-fortnite-thumbnails] ${withoutThumb.length} experiences need thumbnails`)

  let ok = 0, fail = 0

  for (const row of withoutThumb) {
    if (!row.placeId) { fail++; continue }
    const thumbUrl = await fetchIslandThumb(row.placeId)
    if (!thumbUrl) {
      console.warn(`  SKIP ${row.title} (${row.placeId}) — no image from fortnite.com`)
      fail++
      continue
    }

    const blobUrl = await uploadFromUrl(thumbUrl, experienceThumbPath('fortnite-creative', row.placeId))
    if (!blobUrl) {
      console.warn(`  SKIP ${row.title} — blob upload failed`)
      fail++
      continue
    }

    await db
      .update(platformExperiences)
      .set({ thumbnailUrl: blobUrl, updatedAt: new Date() })
      .where(eq(platformExperiences.id, row.id))

    ok++
    console.log(`  ✓ ${row.title}`)
  }

  return NextResponse.json({
    fixed: ok,
    failed: fail,
    total: withoutThumb.length,
  })
}
