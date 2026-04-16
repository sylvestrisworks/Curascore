/**
 * GET /api/nintendo/playtime
 *
 * Returns the last 7 days of Nintendo Switch play time for the logged-in user,
 * aggregated by app, with the total minutes per app and matched LumiKin game slug.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { nintendoPlaytime, nintendoConnections, games, gameScores } from '@/lib/db/schema'
import { eq, gte, sql } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Check if connected
  const [conn] = await db
    .select({ lastSyncedAt: nintendoConnections.lastSyncedAt })
    .from(nintendoConnections)
    .where(eq(nintendoConnections.userId, userId))
    .limit(1)

  if (!conn) return NextResponse.json({ connected: false, rows: [] })

  // Last 7 days
  const since = new Date()
  since.setDate(since.getDate() - 6)
  const sinceStr = since.toISOString().slice(0, 10)

  // Aggregate play time per appId/appTitle over the window
  const rows = await db
    .select({
      appId:           nintendoPlaytime.appId,
      appTitle:        nintendoPlaytime.appTitle,
      appImageUrl:     nintendoPlaytime.appImageUrl,
      totalMinutes:    sql<number>`sum(${nintendoPlaytime.playTimeMinutes})`.as('total_minutes'),
    })
    .from(nintendoPlaytime)
    .where(eq(nintendoPlaytime.userId, userId))
    .groupBy(
      nintendoPlaytime.appId,
      nintendoPlaytime.appTitle,
      nintendoPlaytime.appImageUrl,
    )
    .orderBy(sql`sum(${nintendoPlaytime.playTimeMinutes}) desc`)
    .limit(20)

  if (rows.length === 0) {
    return NextResponse.json({ connected: true, lastSyncedAt: conn.lastSyncedAt, rows: [] })
  }

  // Try to match each Nintendo title against LumiKin games (fuzzy name match)
  const enriched = await Promise.all(
    rows.map(async row => {
      const titleWords = row.appTitle.replace(/[^a-z0-9 ]/gi, '').trim()
      if (!titleWords) return { ...row, slug: null, curascore: null, timeRecommendationMinutes: null }

      const [match] = await db
        .select({
          slug:                    games.slug,
          curascore:               gameScores.curascore,
          timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
        })
        .from(games)
        .leftJoin(gameScores, eq(gameScores.gameId, games.id))
        .where(sql`lower(${games.title}) = lower(${row.appTitle})`)
        .limit(1)

      // Fall back to ILIKE contains if exact match misses
      if (!match) {
        const [fuzzy] = await db
          .select({
            slug:                    games.slug,
            curascore:               gameScores.curascore,
            timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
          })
          .from(games)
          .leftJoin(gameScores, eq(gameScores.gameId, games.id))
          .where(sql`lower(${games.title}) like lower(${'%' + titleWords.split(' ')[0] + '%'})`)
          .limit(1)

        return {
          ...row,
          slug:                    fuzzy?.slug ?? null,
          curascore:               fuzzy?.curascore ?? null,
          timeRecommendationMinutes: fuzzy?.timeRecommendationMinutes ?? null,
        }
      }

      return {
        ...row,
        slug:                    match.slug,
        curascore:               match.curascore ?? null,
        timeRecommendationMinutes: match.timeRecommendationMinutes ?? null,
      }
    })
  )

  return NextResponse.json({
    connected:    true,
    lastSyncedAt: conn.lastSyncedAt,
    sinceDate:    sinceStr,
    rows:         enriched,
  })
}
