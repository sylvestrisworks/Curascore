/**
 * Roblox public API client.
 * No auth required for public experience data.
 */

export type RobloxExperienceMetadata = {
  universeId:    string
  placeId:       string
  title:         string
  description:   string | null
  creatorName:   string | null
  creatorId:     string | null
  thumbnailUrl:  string | null
  genre:         string | null
  isPublic:      boolean
  visitCount:    number
  activePlayers: number
  maxPlayers:    number
}

/** Resolve a Place ID to its parent Universe ID. */
async function getUniverseId(placeId: string): Promise<string> {
  const res = await fetch(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`Roblox universe lookup failed for place ${placeId}: ${res.status}`)
  const data = await res.json() as { universeId: number | null }
  if (!data.universeId) throw new Error(`No universe found for place ${placeId} — game may be private or place ID outdated`)
  return String(data.universeId)
}

/** Fetch game details and thumbnail for a Universe ID. */
async function getUniverseDetails(universeId: string) {
  const [gameRes, thumbRes] = await Promise.all([
    fetch(
      `https://games.roblox.com/v1/games?universeIds=${universeId}`,
      { next: { revalidate: 0 } }
    ),
    fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`,
      { next: { revalidate: 0 } }
    ),
  ])

  if (!gameRes.ok) throw new Error(`Roblox games API failed: ${gameRes.status}`)

  const gameData = await gameRes.json() as {
    data: Array<{
      id: number
      name: string
      description: string | null
      creator: { name: string; id: number; type: string }
      playing: number
      visits: number
      maxPlayers: number
      genre: string
      isPublic: boolean
    }>
  }

  const game = gameData.data?.[0]
  if (!game) throw new Error(`No game data returned for universe ${universeId}`)

  let thumbnailUrl: string | null = null
  if (thumbRes.ok) {
    const thumbData = await thumbRes.json() as {
      data: Array<{ targetId: number; state: string; imageUrl: string }>
    }
    const thumb = thumbData.data?.find(t => t.state === 'Completed')
    thumbnailUrl = thumb?.imageUrl ?? null
  }

  return { game, thumbnailUrl }
}

/**
 * Fetch all metadata for a Roblox experience by Place ID.
 * This is the single entry point — resolves universe, fetches details + thumbnail in parallel.
 */
export async function fetchRobloxExperience(placeId: string): Promise<RobloxExperienceMetadata> {
  const universeId = await getUniverseId(placeId)
  const { game, thumbnailUrl } = await getUniverseDetails(universeId)

  return {
    universeId,
    placeId,
    title:         game.name,
    description:   game.description || null,
    creatorName:   game.creator?.name ?? null,
    creatorId:     game.creator?.id != null ? String(game.creator.id) : null,
    thumbnailUrl,
    genre:         game.genre ?? null,
    isPublic:      game.isPublic ?? true,
    visitCount:    game.visits ?? 0,
    activePlayers: game.playing ?? 0,
    maxPlayers:    game.maxPlayers ?? 0,
  }
}
