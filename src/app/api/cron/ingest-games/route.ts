/**
 * POST /api/cron/ingest-games
 *
 * Background game crawler — called by Vercel Cron every hour.
 * Cycles through RAWG genres page by page, upserts new games into the DB,
 * uploads cover images to Vercel Blob, and advances a cursor stored in Postgres.
 *
 * Protection: Authorization: Bearer <CRON_SECRET>
 * Max duration: 300s (Vercel Pro)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, ingestCursor } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rawgGetByGenre, rawgGetDetail, RawgError } from '@/lib/rawg/client'
import { mapDetailToInsert } from '@/lib/rawg/mapper'
import { uploadImageFromUrl } from '@/lib/blob'

export const maxDuration = 300

// ─── Genre sweep list ─────────────────────────────────────────────────────────
// Two sweeps: first by metacritic (most notable), then by release date (newer).
const GENRES = [
  'action',
  'adventure',
  'puzzle',
  'role-playing-games-rpg',
  'platformer',
  'strategy',
  'sports',
  'simulation',
  'shooter',
  'racing',
  'family',
  'casual',
  'indie',
  'fighting',
  'educational',
  'arcade',
  'card',
]

const SWEEP_ORDERINGS: Record<number, string> = {
  1: '-metacritic',   // most notable first
  2: '-added',        // most recently added to RAWG
  3: '-released',     // by release date
}

const MAX_PAGES_PER_GENRE = 25   // 25 × 40 = 1,000 per genre per sweep
const PAGE_SIZE           = 40
const DELAY_MS            = 200  // ~5 req/s — safe for RAWG free tier

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth check — Vercel sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── 1. Read cursor ────────────────────────────────────────────────────────
    let [cursor] = await db.select().from(ingestCursor).where(eq(ingestCursor.id, 1))

    if (!cursor) {
      // First ever run — seed the row
      await db.insert(ingestCursor).values({
        id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0,
      })
      cursor = { id: 1, genreIndex: 0, page: 1, sweep: 1, totalImported: 0, lastRunAt: null, updatedAt: new Date() }
    }

    const { genreIndex, page, sweep } = cursor
    const genre    = GENRES[genreIndex]
    const ordering = SWEEP_ORDERINGS[sweep] ?? '-metacritic'

    // ── 2. Fetch one page from RAWG ───────────────────────────────────────────
    let listResponse
    try {
      listResponse = await rawgGetByGenre(genre, page, PAGE_SIZE, ordering)
    } catch (err) {
      const msg = err instanceof RawgError ? err.message : String(err)
      return NextResponse.json({ error: `RAWG list failed: ${msg}` }, { status: 502 })
    }

    const candidates = listResponse.results

    // ── 3. Filter out games we already have ───────────────────────────────────
    const existingRawgIds = new Set(
      (await db.select({ rawgId: games.rawgId }).from(games)).map(r => r.rawgId).filter(Boolean)
    )
    const newCandidates = candidates.filter(c => !existingRawgIds.has(c.id))

    // ── 4. Fetch detail + upsert for each new game ────────────────────────────
    let imported  = 0
    let skipped   = 0
    let errors    = 0

    for (const candidate of newCandidates) {
      // Skip AO-rated
      if (candidate.esrb_rating?.slug === 'adults-only') { skipped++; continue }

      try {
        await sleep(DELAY_MS)
        const detail = await rawgGetDetail(candidate.id)
        const data   = mapDetailToInsert(detail)

        // Upload cover to Vercel Blob
        if (data.backgroundImage) {
          const blobUrl = await uploadImageFromUrl(data.backgroundImage, `games/${data.slug}`)
          if (blobUrl) data.backgroundImage = blobUrl
        }

        await db.insert(games)
          .values(data)
          .onConflictDoUpdate({
            target: games.slug,
            set: {
              rawgId:             data.rawgId,
              title:              data.title,
              description:        data.description,
              developer:          data.developer,
              publisher:          data.publisher,
              backgroundImage:    data.backgroundImage,
              updatedAt:          new Date(),
              metadataLastSynced: new Date(),
            },
          })
        imported++
      } catch (err) {
        errors++
        console.error(`[ingest] Failed ${candidate.name}:`, err)
      }
    }

    skipped += candidates.length - newCandidates.length // already-in-DB skips

    // ── 5. Advance cursor ─────────────────────────────────────────────────────
    let nextGenreIndex = genreIndex
    let nextPage       = page + 1
    let nextSweep      = sweep

    const hasMorePages = !!listResponse.next && page < MAX_PAGES_PER_GENRE
    if (!hasMorePages) {
      // Move to next genre
      nextPage = 1
      nextGenreIndex = genreIndex + 1

      if (nextGenreIndex >= GENRES.length) {
        // Finished this sweep — start next sweep
        nextGenreIndex = 0
        nextSweep = sweep + 1

        if (nextSweep > Object.keys(SWEEP_ORDERINGS).length) {
          // All sweeps done — loop back to sweep 1
          nextSweep = 1
        }
        console.log(`[ingest] Starting sweep ${nextSweep} (${SWEEP_ORDERINGS[nextSweep]})`)
      }
    }

    await db.update(ingestCursor)
      .set({
        genreIndex:    nextGenreIndex,
        page:          nextPage,
        sweep:         nextSweep,
        totalImported: (cursor.totalImported ?? 0) + imported,
        lastRunAt:     new Date(),
        updatedAt:     new Date(),
      })
      .where(eq(ingestCursor.id, 1))

    const result = {
      genre,
      page,
      sweep,
      ordering,
      candidates: candidates.length,
      imported,
      skipped,
      errors,
      cursor: { nextGenreIndex, nextPage, nextSweep },
      totalImported: (cursor.totalImported ?? 0) + imported,
    }

    console.log(`[ingest] ${genre} p${page}: +${imported} imported, ${skipped} skipped, ${errors} errors`)
    return NextResponse.json(result)

  } catch (err) {
    console.error('[ingest] Fatal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
