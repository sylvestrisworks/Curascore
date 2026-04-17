/**
 * GET /api/admin/backfill-rawg-added
 *
 * One-shot backfill: pages through RAWG's games list ordered by -added,
 * matches against our DB by rawgId, and updates rawg_added for any game
 * that currently has null. Stops when it has covered PAGES pages or run
 * out of RAWG results.
 *
 * Safe to re-run — skips games that already have rawgAdded set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { isNull, inArray, eq } from 'drizzle-orm'

export const maxDuration = 300

const PAGES     = 50   // 50 × 40 = 2 000 RAWG games checked per run
const PAGE_SIZE = 40

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'RAWG_API_KEY not set' }, { status: 500 })

  // Build a map of rawgId → our game id for all games missing rawgAdded
  const missing = await db
    .select({ id: games.id, rawgId: games.rawgId })
    .from(games)
    .where(isNull(games.rawgAdded))

  if (missing.length === 0)
    return NextResponse.json({ ok: true, updated: 0, message: 'Nothing to backfill' })

  const missingByRawgId = new Map(
    missing.filter(g => g.rawgId != null).map(g => [g.rawgId!, g.id])
  )

  let updated = 0
  let page    = 1

  while (page <= PAGES && missingByRawgId.size > 0) {
    try {
      const url = `https://api.rawg.io/api/games?key=${apiKey}&ordering=-added&page=${page}&page_size=${PAGE_SIZE}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) { console.error(`[backfill] RAWG ${res.status} on page ${page}`); break }

      const data = await res.json() as {
        next: string | null
        results: Array<{ id: number; added: number }>
      }

      for (const rawgGame of data.results) {
        const gameId = missingByRawgId.get(rawgGame.id)
        if (!gameId) continue

        await db.update(games)
          .set({ rawgAdded: rawgGame.added, updatedAt: new Date() })
          .where(eq(games.id, gameId))

        missingByRawgId.delete(rawgGame.id)
        updated++
      }

      if (!data.next) break
      page++
    } catch (err) {
      console.error(`[backfill] Error on page ${page}:`, err)
      break
    }
  }

  return NextResponse.json({ ok: true, updated, pagesChecked: page, stillMissing: missingByRawgId.size })
}
