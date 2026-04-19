/**
 * Parses fortnite-discovery-raw.json (captured via browser DevTools console)
 * and upserts island data into platform_experiences.
 *
 * Run with:
 *   npx tsx scripts/import-fortnite-discovery.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const USER_ISLAND_CODE = /^\d{4}-\d{4}-\d{4}$/

type Island = {
  title:       string
  islandCode:  string
  imgSrc:      string | null
  ccu:         number | null
  label:       string | null
  ageRatingTextAbbr: string | null
}

// Remix TurboStream decoder — resolves {"_N":V} reference objects into plain objects
function parseTurboStream(text: string): Island[] {
  const flat: unknown[] = JSON.parse(text)
  const islands: Island[] = []
  const seen = new Set<string>()

  // The islands index array is the first Array<number> in the flat list
  const islandIndices = flat.find(
    (v): v is number[] => Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number')
  )
  if (!islandIndices) return islands

  const resolve = (v: unknown): unknown => {
    if (typeof v === 'number' && v >= 0 && v < flat.length) return flat[v]
    if (v === -7) return null
    return v
  }

  for (const idx of islandIndices) {
    const obj = flat[idx]
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue

    const record: Record<string, unknown> = {}
    for (const [rawKey, rawVal] of Object.entries(obj as Record<string, unknown>)) {
      const keyIdx = parseInt(rawKey.slice(1), 10)
      const key = flat[keyIdx]
      if (typeof key !== 'string') continue
      record[key] = resolve(rawVal)
    }

    const code = record['islandCode']
    if (typeof code !== 'string' || !USER_ISLAND_CODE.test(code)) continue
    if (seen.has(code)) continue
    seen.add(code)

    islands.push({
      title:             typeof record['title'] === 'string' ? record['title'] : '',
      islandCode:        code,
      imgSrc:            typeof record['imgSrc'] === 'string' ? record['imgSrc'] : null,
      ccu:               typeof record['ccu'] === 'number' ? record['ccu'] : null,
      label:             typeof record['label'] === 'string' ? record['label'] : null,
      ageRatingTextAbbr: typeof record['ageRatingTextAbbr'] === 'string' ? record['ageRatingTextAbbr'] : null,
    })
  }

  return islands
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

async function main() {
  const rawPath = join(process.cwd(), 'fortnite-discovery-raw.json')
  const panels: { panel: string; text: string }[] = JSON.parse(readFileSync(rawPath, 'utf-8'))

  // Parse all panels, deduplicate across panels
  const allIslands = new Map<string, Island>()
  for (const { panel, text } of panels) {
    const islands = parseTurboStream(text)
    console.log(`${panel}: ${islands.length} user islands`)
    for (const island of islands) {
      if (!allIslands.has(island.islandCode)) allIslands.set(island.islandCode, island)
    }
  }
  console.log(`\nTotal unique user islands: ${allIslands.size}`)

  const [platform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!platform) { console.error('fortnite-creative platform not found'); process.exit(1) }

  const existing = await db
    .select({ id: platformExperiences.id, placeId: platformExperiences.placeId, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, platform.id))

  const existingByCode = new Map(existing.map(e => [e.placeId, e]))

  let thumbsUpdated = 0, ccuUpdated = 0, inserted = 0

  for (const island of allIslands.values()) {
    const row = existingByCode.get(island.islandCode)

    if (row) {
      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (island.imgSrc) { updates.thumbnailUrl = island.imgSrc; thumbsUpdated++ }
      if (island.ccu !== null) { updates.activePlayers = island.ccu; ccuUpdated++ }
      await db.update(platformExperiences).set(updates).where(eq(platformExperiences.id, row.id))
      console.log(`↻  ${island.title} (${island.islandCode}) — updated`)
    } else {
      let slug = slugify(island.title)
      const [collision] = await db.select({ id: platformExperiences.id }).from(platformExperiences).where(eq(platformExperiences.slug, slug)).limit(1)
      if (collision) slug = `${slug}-${island.islandCode.replace(/-/g, '').slice(0, 8)}`

      await db.insert(platformExperiences).values({
        slug,
        platformId:    platform.id,
        placeId:       island.islandCode,
        universeId:    null,
        title:         island.title,
        description:   null,
        creatorName:   null,
        thumbnailUrl:  island.imgSrc,
        genre:         null,
        isPublic:      true,
        lastFetchedAt: new Date(),
      }).onConflictDoNothing()

      console.log(`+  ${island.title} (${island.islandCode}) — inserted`)
      inserted++
    }
  }

  console.log(`\nDone — thumbnails updated: ${thumbsUpdated}, CCU updated: ${ccuUpdated}, new islands: ${inserted}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
