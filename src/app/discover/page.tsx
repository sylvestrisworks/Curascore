export const dynamic = 'force-dynamic'

import { desc, eq, isNotNull } from 'drizzle-orm'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import GameDiscoveryDashboard from '@/components/GameDiscoveryDashboard'
import type { GameSummary } from '@/types/game'

export const metadata: Metadata = {
  title: 'Discover — PlaySmart',
  description: 'Find the right game for your child, grounded in child development.',
}

async function getTopGames(): Promise<GameSummary[]> {
  const rows = await db
    .select({
      slug:                      games.slug,
      title:                     games.title,
      developer:                 games.developer,
      genres:                    games.genres,
      esrbRating:                games.esrbRating,
      backgroundImage:           games.backgroundImage,
      metacriticScore:           games.metacriticScore,
      curascore:                 gameScores.curascore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(gameScores.curascore))
    .orderBy(desc(gameScores.curascore))
    .limit(24)

  return rows.map((r) => ({
    slug:                      r.slug,
    title:                     r.title,
    developer:                 r.developer,
    genres:                    (r.genres as string[]) ?? [],
    esrbRating:                r.esrbRating,
    backgroundImage:           r.backgroundImage,
    metacriticScore:           r.metacriticScore,
    curascore:                 r.curascore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor:   r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
  }))
}

export default async function DiscoverPage() {
  const topGames = await getTopGames()
  return <GameDiscoveryDashboard topGames={topGames} />
}
