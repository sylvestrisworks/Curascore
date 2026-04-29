/**
 * Fetches Fortnite Creative discovery data directly from Epic's backend API —
 * no browser, no Cloudflare.
 *
 * Auth: machine-level client_credentials token using EPIC_CLIENT_ID /
 * EPIC_CLIENT_SECRET (same credentials used by sync-epic-library).
 *
 * Data source: links.community-svc.ol.epicgames.com — the same endpoint the
 * Fortnite game client calls to populate the Creative discovery surface panels.
 *
 * Run locally:
 *   node node_modules/tsx/dist/cli.cjs scripts/fetch-fortnite-discovery.ts
 *
 * Requires in env: DATABASE_URL, EPIC_CLIENT_ID, EPIC_CLIENT_SECRET
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { db } from '@/lib/db'
import { platformExperiences, games } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// ─── Epic API ─────────────────────────────────────────────────────────────────

const TOKEN_URL = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token'

// Discovery surface panel mnemonics — each is a section on the Creative tab
const PANELS = [
  'CREATIVE:featured:br',
  'CREATIVE:hot:br',
  'CREATIVE:new:br',
  'CREATIVE:recommended:br',
]

const FORTNITE_UA = 'Fortnite/++Fortnite+Release-33.00-CL-38383825 Windows/10.0.22631.1.0.0.256.64bit'

// User-created island codes follow this pattern (Epic-owned use playlist_ or similar)
const USER_ISLAND_CODE = /^\d{4}-\d{4}-\d{4}$/

// ─── Types ────────────────────────────────────────────────────────────────────

type IslandEntry = {
  code:         string
  title:        string
  thumbnailUrl: string | null
  ccu:          number | null
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getClientToken(): Promise<string> {
  const clientId     = process.env.EPIC_CLIENT_ID
  const clientSecret = process.env.EPIC_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('EPIC_CLIENT_ID / EPIC_CLIENT_SECRET not set')

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Epic OAuth failed (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = await res.json() as { access_token: string }
  console.log('[fortnite-discovery] OAuth token acquired')
  return data.access_token
}

// ─── Fetch one panel ──────────────────────────────────────────────────────────

async function fetchPanel(mnemonic: string, token: string): Promise<IslandEntry[]> {
  const url = `https://links.community-svc.ol.epicgames.com/links/api/fn/mnemonic?category=${encodeURIComponent(mnemonic)}&start=0&count=40`

  let raw: unknown
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': FORTNITE_UA },
      signal:  AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.warn(`[fortnite-discovery] ${mnemonic}: HTTP ${res.status}`)
      return []
    }
    raw = await res.json()
  } catch (err) {
    console.error(`[fortnite-discovery] ${mnemonic}: fetch error`, err)
    return []
  }

  // Log the raw shape once so we can see what Epic returns on first run
  console.log(`[fortnite-discovery] ${mnemonic}: raw shape keys = ${Object.keys(raw as object).join(', ')}`)

  const items = extractItems(raw)
  console.log(`[fortnite-discovery] ${mnemonic}: extracted ${items.length} islands`)
  return items
}

// ─── Parse response ───────────────────────────────────────────────────────────
// Epic's API shape has varied over time. We try several known structures and
// log what we see so any format change is immediately visible in CI logs.

function extractItems(raw: unknown): IslandEntry[] {
  if (!raw || typeof raw !== 'object') return []

  const candidates: unknown[] = []

  // Shape A: { elements: [...] }
  if (Array.isArray((raw as Record<string, unknown>).elements)) {
    candidates.push(...((raw as Record<string, unknown[]>).elements))
  }
  // Shape B: { results: [...] }
  if (Array.isArray((raw as Record<string, unknown>).results)) {
    candidates.push(...((raw as Record<string, unknown[]>).results))
  }
  // Shape C: { data: { elements: [...] } }
  const data = (raw as Record<string, unknown>).data
  if (data && typeof data === 'object') {
    if (Array.isArray((data as Record<string, unknown>).elements)) {
      candidates.push(...((data as Record<string, unknown[]>).elements))
    }
  }
  // Shape D: root is an array
  if (Array.isArray(raw)) candidates.push(...raw)

  if (candidates.length === 0) {
    // Log a snippet to help diagnose unexpected shapes
    console.warn('[fortnite-discovery] Unknown response shape:', JSON.stringify(raw).slice(0, 500))
    return []
  }

  const results: IslandEntry[] = []
  for (const item of candidates) {
    const entry = parseItem(item)
    if (entry) results.push(entry)
  }
  return results
}

function parseItem(item: unknown): IslandEntry | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>

  // mnemonic may be at root level or nested under linkData
  const linkData = o.linkData as Record<string, unknown> | undefined
  const meta     = (o.metadata ?? linkData?.metadata) as Record<string, unknown> | undefined

  const code = (o.mnemonic ?? o.islandCode ?? linkData?.mnemonic) as string | undefined
  if (!code || !USER_ISLAND_CODE.test(code)) return null

  const title       = (meta?.title ?? o.title ?? linkData?.['tagline']) as string | undefined
  const thumbnailUrl = (meta?.image_url ?? meta?.imageUrl ?? o.image_url ?? o.imageUrl) as string | null | undefined
  const ccu          = (meta?.ccu ?? o.ccu ?? o.activePlayers) as number | null | undefined

  if (!title) return null

  return {
    code,
    title:        String(title).trim(),
    thumbnailUrl: thumbnailUrl ?? null,
    ccu:          typeof ccu === 'number' ? ccu : null,
  }
}

// ─── Slug helper ──────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const token = await getClientToken()

  // Collect islands from all panels, deduping by island code
  const seen    = new Set<string>()
  const islands: IslandEntry[] = []

  for (const panel of PANELS) {
    const entries = await fetchPanel(panel, token)
    for (const entry of entries) {
      if (!seen.has(entry.code)) {
        seen.add(entry.code)
        islands.push(entry)
      }
    }
  }

  console.log(`\n[fortnite-discovery] Total unique islands: ${islands.length}`)
  if (islands.length === 0) {
    console.error('[fortnite-discovery] No islands found — check API response shape in logs above')
    process.exit(1)
  }

  // Load fortnite-creative platform row
  const [platform] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, 'fortnite-creative'))
    .limit(1)

  if (!platform) {
    console.error('[fortnite-discovery] fortnite-creative platform row not found')
    process.exit(1)
  }

  // Load existing entries keyed by island code (placeId)
  const existing = await db
    .select({ id: platformExperiences.id, placeId: platformExperiences.placeId, thumbnailUrl: platformExperiences.thumbnailUrl })
    .from(platformExperiences)
    .where(eq(platformExperiences.platformId, platform.id))

  const existingByCode = new Map(existing.map(e => [e.placeId, e]))

  let updatedThumbnails = 0
  let updatedCCU        = 0
  let inserted          = 0

  for (const island of islands) {
    const existing_ = existingByCode.get(island.code)

    if (existing_) {
      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (island.thumbnailUrl && island.thumbnailUrl !== existing_.thumbnailUrl) {
        updates.thumbnailUrl = island.thumbnailUrl
        updatedThumbnails++
      }
      if (island.ccu != null) {
        updates.activePlayers = island.ccu
        updatedCCU++
      }
      await db.update(platformExperiences).set(updates).where(eq(platformExperiences.id, existing_.id))
      console.log(`↻  ${island.title} (${island.code})`)
    } else {
      let slug = slugify(island.title)
      const [collision] = await db
        .select({ id: platformExperiences.id })
        .from(platformExperiences)
        .where(eq(platformExperiences.slug, slug))
        .limit(1)
        .catch(() => [])
      if (collision) slug = `${slug}-${island.code.replace(/-/g, '').slice(0, 8)}`

      await db.insert(platformExperiences).values({
        slug,
        platformId:    platform.id,
        placeId:       island.code,
        universeId:    null,
        title:         island.title,
        description:   null,
        creatorName:   null,
        thumbnailUrl:  island.thumbnailUrl,
        genre:         null,
        isPublic:      true,
        activePlayers: island.ccu,
        lastFetchedAt: new Date(),
      }).onConflictDoNothing()

      console.log(`+  ${island.title} (${island.code})`)
      inserted++
    }
  }

  console.log(`\nDone — thumbnails updated: ${updatedThumbnails}, CCU updated: ${updatedCCU}, new islands inserted: ${inserted}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
