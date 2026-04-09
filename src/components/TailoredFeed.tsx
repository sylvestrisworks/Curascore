import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import { eq, and, lte, isNotNull, isNull, or, desc, sql } from 'drizzle-orm'
import GameCompactCard from './GameCompactCard'
import type { GameSummary } from '@/types/game'

// Map focusSkills labels → gameScores columns for ordering
const SKILL_COLUMN: Record<string, string> = {
  cognitive:       'cognitive_score',
  social:          'social_emotional_score',
  motor:           'motor_score',
  problem_solving: 'cognitive_score',
  creativity:      'cognitive_score',
  teamwork:        'social_emotional_score',
}

function esrbMinAge(rating: string | null): number {
  switch (rating) {
    case 'E':   return 0
    case 'E10': return 10
    case 'T':   return 13
    case 'M':   return 17
    case 'AO':  return 18
    default:    return 0
  }
}

type Props = {
  profileId: number
  name: string
  birthYear: number
  platforms: string[]
  focusSkills: string[]
  limit?: number
  layout?: 'grid' | 'row'
}

export default async function TailoredFeed({ name, birthYear, platforms, focusSkills, limit = 20, layout = 'grid' }: Props) {
  const age = new Date().getFullYear() - birthYear

  // Determine order column from first focusSkill, default to curascore
  const primarySkill = focusSkills[0] ? SKILL_COLUMN[focusSkills[0]] : null
  const orderExpr = primarySkill
    ? sql.raw(`game_scores.${primarySkill} DESC NULLS LAST`)
    : sql`${gameScores.curascore} DESC NULLS LAST`

  const rows = await db
    .select({
      id:                       games.id,
      slug:                     games.slug,
      title:                    games.title,
      backgroundImage:          games.backgroundImage,
      esrbRating:               games.esrbRating,
      genres:                   games.genres,
      platforms:                games.platforms,
      hasMicrotransactions:     games.hasMicrotransactions,
      hasLootBoxes:             games.hasLootBoxes,
      curascore:                gameScores.curascore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:  gameScores.timeRecommendationColor,
      bds:                      gameScores.bds,
      ris:                      gameScores.ris,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(
      and(
        isNotNull(gameScores.curascore),
        or(
          isNull(gameScores.recommendedMinAge),
          lte(gameScores.recommendedMinAge, age),
        ),
      )
    )
    .orderBy(orderExpr)
    .limit(limit * 3) // over-fetch so we can filter by platform client-side

  // Filter by platform if specified
  const filtered = platforms.length > 0
    ? rows.filter(r => {
        const gamePlatforms = (r.platforms as string[]) ?? []
        return platforms.some(p =>
          gamePlatforms.some(gp => gp.toLowerCase().includes(p.toLowerCase()))
        )
      })
    : rows

  const games_: GameSummary[] = filtered.slice(0, limit).map(r => ({
    id:                       r.id,
    slug:                     r.slug,
    title:                    r.title,
    backgroundImage:          r.backgroundImage ?? null,
    esrbRating:               r.esrbRating ?? null,
    genres:                   (r.genres as string[]) ?? [],
    platforms:                (r.platforms as string[]) ?? [],
    hasMicrotransactions:     r.hasMicrotransactions ?? false,
    hasLootBoxes:             r.hasLootBoxes ?? false,
    curascore:                r.curascore ?? null,
    timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
    timeRecommendationColor:  (r.timeRecommendationColor as 'green' | 'amber' | 'red' | null) ?? null,
    bds:                      r.bds ?? null,
    ris:                      r.ris ?? null,
  }))

  if (games_.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-4">
        No matching games found yet — try adjusting {name}&apos;s platforms or age.
      </div>
    )
  }

  if (layout === 'row') {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {games_.map(game => (
          <div key={game.id} className="shrink-0 w-36">
            <GameCompactCard game={game} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {games_.map(game => (
        <GameCompactCard key={game.id} game={game} />
      ))}
    </div>
  )
}
