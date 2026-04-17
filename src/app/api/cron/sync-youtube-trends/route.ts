/**
 * GET /api/cron/sync-youtube-trends
 *
 * Fetches the top 50 trending YouTube Gaming videos (category 20),
 * extracts game titles by matching video titles against our games table,
 * and updates trendingScore on matched games.
 *
 * Score = number of trending videos that mention the game title.
 * Scores decay: games not seen in this run are decremented by 1
 * (so a game falls off the trending carousel after ~7 days of absence).
 *
 * Runs daily via GitHub Actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { isNotNull, gt, sql } from 'drizzle-orm'

export const maxDuration = 60

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3/videos'
const REGIONS     = ['US', 'GB', 'CA', 'AU']  // pool from multiple regions for broader signal

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })

  try {
    // ── 1. Fetch trending gaming videos from YouTube ──────────────────────────
    const videoTitles: string[] = []

    for (const region of REGIONS) {
      try {
        const url = new URL(YOUTUBE_API)
        url.searchParams.set('part', 'snippet')
        url.searchParams.set('chart', 'mostPopular')
        url.searchParams.set('videoCategoryId', '20')  // Gaming
        url.searchParams.set('regionCode', region)
        url.searchParams.set('maxResults', '50')
        url.searchParams.set('key', apiKey)

        const res = await fetch(url.toString())
        if (!res.ok) {
          console.error(`[youtube-trends] ${region} failed: ${res.status}`)
          continue
        }
        const data = await res.json() as {
          items?: Array<{ snippet: { title: string; description: string } }>
        }
        for (const item of data.items ?? []) {
          videoTitles.push(item.snippet.title)
          // Include first 200 chars of description for better matching
          if (item.snippet.description)
            videoTitles.push(item.snippet.description.slice(0, 200))
        }
      } catch (err) {
        console.error(`[youtube-trends] Error fetching ${region}:`, err)
      }
    }

    if (videoTitles.length === 0)
      return NextResponse.json({ ok: false, error: 'No YouTube data fetched' })

    const combinedText = videoTitles.join(' ').toLowerCase()
    console.log(`[youtube-trends] Got ${videoTitles.length} title/desc strings across ${REGIONS.length} regions`)

    // ── 2. Load all game titles from DB ───────────────────────────────────────
    const allGames = await db
      .select({ id: games.id, title: games.title, slug: games.slug })
      .from(games)

    // ── 3. Score each game by mention count ───────────────────────────────────
    const scored: Array<{ id: number; score: number }> = []

    for (const game of allGames) {
      const needle = game.title.toLowerCase()
      // Skip very short titles that would cause false positives (e.g. "it", "go")
      if (needle.length < 4) continue

      // Count non-overlapping occurrences
      let count = 0
      let pos   = 0
      while ((pos = combinedText.indexOf(needle, pos)) !== -1) {
        count++
        pos += needle.length
      }

      if (count > 0) scored.push({ id: game.id, score: count })
    }

    console.log(`[youtube-trends] Matched ${scored.length} games`)

    // ── 4. Decay existing scores (games not seen this run drop by 1) ─────────
    await db.execute(sql`
      UPDATE games
      SET trending_score = GREATEST(trending_score - 1, 0),
          trending_updated_at = NOW()
      WHERE trending_score > 0
    `)

    // ── 5. Update matched games ───────────────────────────────────────────────
    let updated = 0
    for (const { id, score } of scored) {
      await db.execute(sql`
        UPDATE games
        SET trending_score    = GREATEST(COALESCE(trending_score, 0) + ${score}, ${score}),
            trending_updated_at = NOW()
        WHERE id = ${id}
      `)
      updated++
    }

    return NextResponse.json({
      ok:           true,
      videosFetched: videoTitles.length,
      gamesMatched: scored.length,
      gamesUpdated: updated,
      topMatches:   scored.sort((a, b) => b.score - a.score).slice(0, 10).map(s => ({
        id:    s.id,
        score: s.score,
        title: allGames.find(g => g.id === s.id)?.title,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[youtube-trends] Unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
