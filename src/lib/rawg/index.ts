// Public RAWG API — search, detail, and genre browsing with DB-level caching.
//
// Cache strategy: each game in the `games` table carries a `metadataLastSynced`
// timestamp. We skip the RAWG network call for any game where that timestamp is
// less than 24 hours old.
//
// NOTE: upsertGame uses a select-then-write pattern. This is intentional and
// safe for the expected single-writer usage (import scripts, on-demand fetches).
// A multi-writer scenario would need advisory locks or a proper ON CONFLICT clause.

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { rawgSearch, rawgGetByGenre, rawgGetDetail, RawgError } from './client'
import { mapDetailToInsert, mapSummaryToInsert } from './mapper'
import type { RawgGameSummary } from './types'

type GameRecord = typeof games.$inferSelect
type GameInsert = typeof games.$inferInsert

export { RawgError }

// ─── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function isCacheFresh(lastSynced: Date | null): boolean {
  if (!lastSynced) return false
  return Date.now() - lastSynced.getTime() < CACHE_TTL_MS
}

// ─── DB upsert ────────────────────────────────────────────────────────────────

// Fields we update on every sync (excludes id, slug, rawgId, createdAt)
function buildUpdateSet(data: GameInsert): Partial<GameInsert> {
  return {
    title:              data.title,
    description:        data.description,
    developer:          data.developer,
    publisher:          data.publisher,
    releaseDate:        data.releaseDate,
    genres:             data.genres,
    platforms:          data.platforms,
    esrbRating:         data.esrbRating,
    metacriticScore:    data.metacriticScore,
    avgPlaytimeHours:   data.avgPlaytimeHours,
    backgroundImage:    data.backgroundImage,
    hasMicrotransactions: data.hasMicrotransactions,
    hasLootBoxes:       data.hasLootBoxes,
    hasSubscription:    data.hasSubscription,
    hasBattlePass:      data.hasBattlePass,
    updatedAt:          new Date(),
    metadataLastSynced: new Date(),
  }
}

async function upsertGame(data: GameInsert): Promise<GameRecord> {
  // Look up by rawgId first (most common case for RAWG-sourced data)
  if (data.rawgId != null) {
    const [existing] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.rawgId, data.rawgId))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(games)
        .set(buildUpdateSet(data))
        .where(eq(games.id, existing.id))
        .returning()
      return updated
    }
  }

  // No existing record — insert, using slug as the conflict fallback
  // (e.g. a game already imported from IGDB without a rawgId)
  const [record] = await db
    .insert(games)
    .values(data)
    .onConflictDoUpdate({
      target: games.slug,
      set: buildUpdateSet(data),
    })
    .returning()

  return record
}

// Upsert a batch of RAWG list-results using summary data only
async function upsertSummaries(summaries: RawgGameSummary[]): Promise<GameRecord[]> {
  const results: GameRecord[] = []
  for (const summary of summaries) {
    results.push(await upsertGame(mapSummaryToInsert(summary)))
  }
  return results
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search games by name. Hits RAWG, upserts results into the DB (summary data),
 * and returns the persisted records.
 */
export async function searchGames(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<GameRecord[]> {
  const response = await rawgSearch(query, page, pageSize)
  return upsertSummaries(response.results)
}

/**
 * Fetch full game details by RAWG ID.
 *
 * Returns the cached DB record if it was synced within the last 24 hours.
 * Otherwise fetches fresh data from RAWG, upserts it, and returns the record.
 * Returns null if the game doesn't exist on RAWG (404).
 */
export async function getGameDetails(rawgId: number): Promise<GameRecord | null> {
  // Check DB cache
  const [cached] = await db
    .select()
    .from(games)
    .where(eq(games.rawgId, rawgId))
    .limit(1)

  if (cached && isCacheFresh(cached.metadataLastSynced)) {
    return cached
  }

  // Cache miss or stale — fetch from RAWG
  try {
    const detail = await rawgGetDetail(rawgId)
    return upsertGame(mapDetailToInsert(detail))
  } catch (err) {
    if (err instanceof RawgError && err.status === 404) return null
    throw err
  }
}

/**
 * Browse games by genre slug (e.g. "action", "puzzle", "role-playing-games-rpg").
 * Hits RAWG, upserts results, returns persisted records.
 */
export async function getGamesByGenre(
  genreSlug: string,
  page = 1,
): Promise<GameRecord[]> {
  const response = await rawgGetByGenre(genreSlug, page)
  return upsertSummaries(response.results)
}
