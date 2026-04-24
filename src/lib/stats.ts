import { unstable_cache } from 'next/cache'
import { sql, eq, gte, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, gameTranslations } from '@/lib/db/schema'

export type PlatformStat = {
  platform_name: string
  count: number
}

export type LanguageStat = {
  locale: string
  count: number
}

export type RecentScore = {
  game_id: number
  name: string
  slug: string
  score: number | null
  scored_at: string | null
  platform: string | null
}

export type SiteStats = {
  total_games_scored: number
  scored_last_7_days: number
  scored_last_30_days: number
  platforms: PlatformStat[]
  languages: LanguageStat[]
  recent_scores: RecentScore[]
}

async function computeSiteStats(): Promise<SiteStats> {
  const now = new Date()
  const ago7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalResult,
    last7Result,
    last30Result,
    platformRows,
    translationRows,
    recentRows,
  ] = await Promise.all([
    // total scored
    db.select({ count: sql<number>`count(*)` }).from(gameScores),

    // scored in last 7 days
    db.select({ count: sql<number>`count(*)` })
      .from(gameScores)
      .where(gte(gameScores.calculatedAt, ago7)),

    // scored in last 30 days
    db.select({ count: sql<number>`count(*)` })
      .from(gameScores)
      .where(gte(gameScores.calculatedAt, ago30)),

    // platform breakdown — unnest JSONB array, join to scored games only
    db.execute(sql`
      SELECT p.platform_name, count(*)::int AS count
      FROM game_scores gs
      JOIN games g ON g.id = gs.game_id
      CROSS JOIN jsonb_array_elements_text(g.platforms) AS p(platform_name)
      WHERE g.platforms IS NOT NULL AND jsonb_typeof(g.platforms) = 'array' AND g.platforms != '[]'::jsonb
      GROUP BY p.platform_name
      ORDER BY count DESC
    `),

    // non-English translation counts
    db.select({
      locale: gameTranslations.locale,
      count:  sql<number>`count(*)`,
    })
      .from(gameTranslations)
      .groupBy(gameTranslations.locale),

    // 10 most recently scored
    db.select({
      game_id:   games.id,
      name:      games.title,
      slug:      games.slug,
      score:     gameScores.curascore,
      scored_at: gameScores.calculatedAt,
      platform:  sql<string | null>`CASE WHEN jsonb_typeof(g.platforms) = 'array' THEN g.platforms->>0 ELSE NULL END`,
    })
      .from(gameScores)
      .innerJoin(games, eq(games.id, gameScores.gameId))
      .where(isNotNull(gameScores.curascore))
      .orderBy(sql`${gameScores.calculatedAt} DESC`)
      .limit(10),
  ])

  const totalScored = Number(totalResult[0]?.count ?? 0)

  // Build languages array: English = all scored games; others from translations table
  const langMap = new Map<string, number>([['en', totalScored]])
  for (const row of translationRows) {
    langMap.set(row.locale, Number(row.count))
  }
  const languages: LanguageStat[] = Array.from(langMap.entries()).map(([locale, count]) => ({ locale, count }))

  return {
    total_games_scored: totalScored,
    scored_last_7_days:  Number(last7Result[0]?.count  ?? 0),
    scored_last_30_days: Number(last30Result[0]?.count ?? 0),
    platforms: (platformRows as unknown as { platform_name: string; count: number }[]).map(r => ({
      platform_name: r.platform_name,
      count: Number(r.count),
    })),
    languages,
    recent_scores: recentRows.map(r => ({
      game_id:   r.game_id,
      name:      r.name,
      slug:      r.slug,
      score:     r.score ?? null,
      scored_at: r.scored_at ? new Date(r.scored_at).toISOString() : null,
      platform:  r.platform ?? null,
    })),
  }
}

export const fetchSiteStats = unstable_cache(
  computeSiteStats,
  ['site-stats'],
  { revalidate: 3600 },
)
