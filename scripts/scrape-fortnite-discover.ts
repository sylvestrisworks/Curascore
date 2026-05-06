/**
 * Bulk-scrape Fortnite Creative islands from fortnite.com/discover by attaching
 * to YOUR running Chrome via CDP. Avoids Cloudflare detection because the
 * browser is real Chrome with your real session — Playwright never launches
 * its own browser, it just drives the one you already opened.
 *
 *  ⚠️  RUN THIS LOCALLY  ⚠️
 *
 * SETUP:
 *  1. Quit Chrome fully (kill all chrome.exe in Task Manager).
 *  2. Start Chrome with the debugging port and a dedicated profile dir:
 *
 *     Windows (PowerShell):
 *       & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
 *         --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-cdp"
 *
 *     macOS / Linux:
 *       /usr/bin/google-chrome --remote-debugging-port=9222 \
 *         --user-data-dir=/tmp/chrome-cdp
 *
 *  3. In that Chrome window, browse to https://www.fortnite.com/discover
 *     once and clear any Cloudflare challenge by hand. Stay on the page.
 *  4. Run this script:
 *       node node_modules/tsx/dist/cli.cjs scripts/scrape-fortnite-discover.ts
 *
 * WHAT IT DOES:
 *  - Reuses your already-open tab (or opens a new one in your session).
 *  - Auto-scrolls /discover and a handful of category pages to flush all
 *    lazy-loaded carousels.
 *  - Pulls every (code, creator, title, thumbnailUrl) from rendered anchors
 *    matching /@creator/CODE.
 *  - Upserts platform_experiences:
 *      • existing rows: fills thumbnail_url if NULL, refreshes creator/title
 *      • new rows:      inserted with needsRescore=true so the AI scoring
 *                       cron picks them up automatically
 *
 * Requires: DATABASE_URL
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'
import { chromium, type Page } from 'playwright'

const CDP_URL = process.env.CDP_URL ?? 'http://localhost:9222'
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' })

// Discovery surfaces to sweep. fortnite.com lazy-loads carousels per section,
// so visiting several maximises coverage. Add more if you find them.
const SURFACES = [
  'https://www.fortnite.com/discover',
  'https://www.fortnite.com/discover/popular',
  'https://www.fortnite.com/discover/new',
  'https://www.fortnite.com/discover/recommended',
]

type Island = {
  code:         string
  creator:      string | null
  title:        string | null
  thumbnailUrl: string | null
  source:       string
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255) || 'untitled'
}

// Scrolls to bottom of the page in chunks, pausing for lazy carousels to
// fetch and render. Returns when scrolling no longer changes the height.
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      let lastHeight = 0
      let stable = 0
      const tick = () => {
        const h = document.documentElement.scrollHeight
        if (h === lastHeight) {
          stable++
          if (stable > 4) return resolve()
        } else {
          stable = 0
          lastHeight = h
        }
        window.scrollBy(0, window.innerHeight)
        setTimeout(tick, 600)
      }
      tick()
    })
  })
}

// Pulls everything resembling an island anchor from the rendered DOM.
async function extractIslands(page: Page, source: string): Promise<Island[]> {
  const raw = await page.evaluate(() => {
    const ISLAND_RE = /\/@([^/?#]+)\/(\d{4}-\d{4}-\d{4})/
    const out: { code: string; creator: string; href: string; thumbnailUrl: string | null; title: string | null }[] = []
    const seen = new Set<string>()

    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const m = a.href.match(ISLAND_RE)
      if (!m) continue
      const [, creator, code] = m
      if (seen.has(code)) continue
      seen.add(code)

      // Walk up to find the card root, then grab thumbnail + title from it.
      let scope: Element = a
      for (let i = 0; i < 4 && scope.parentElement; i++) {
        if (scope.querySelector('img')) break
        scope = scope.parentElement
      }

      const img = scope.querySelector<HTMLImageElement>('img')
      let thumb: string | null = null
      if (img) {
        thumb = img.currentSrc || img.src || img.getAttribute('data-src') || null
        // Prefer srcset highest-resolution if available
        const srcset = img.getAttribute('srcset')
        if (srcset) {
          const parts = srcset.split(',').map(s => s.trim().split(/\s+/))
          parts.sort((a, b) => parseInt(b[1] ?? '0', 10) - parseInt(a[1] ?? '0', 10))
          if (parts[0]?.[0]?.startsWith('http')) thumb = parts[0][0]
        }
      }

      const titleEl = scope.querySelector('h1,h2,h3,h4,[class*="title" i],[class*="name" i]')
      const title = titleEl?.textContent?.trim() || a.getAttribute('aria-label')?.trim() || null

      out.push({ code, creator, href: a.href, thumbnailUrl: thumb, title })
    }
    return out
  })

  return raw.map(r => ({
    code:         r.code,
    creator:      r.creator,
    title:        r.title,
    thumbnailUrl: r.thumbnailUrl && r.thumbnailUrl.startsWith('http') ? r.thumbnailUrl : null,
    source,
  }))
}

async function main() {
  console.log(`Connecting to Chrome at ${CDP_URL}…`)
  const browser = await chromium.connectOverCDP(CDP_URL)
  const ctx = browser.contexts()[0]
  if (!ctx) throw new Error('No browser context found. Is Chrome open with the debugging port?')

  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(45_000)

  const found = new Map<string, Island>()

  for (const url of SURFACES) {
    console.log(`\n→ ${url}`)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
    } catch (e) {
      console.warn(`  navigation failed: ${(e as Error).message}`)
      continue
    }

    // Give JS a moment to mount the first carousel
    await page.waitForTimeout(1500)
    await autoScroll(page)

    const islands = await extractIslands(page, url)
    let added = 0
    for (const i of islands) {
      if (!found.has(i.code)) { found.set(i.code, i); added++ }
    }
    console.log(`  scraped ${islands.length} (+${added} new)`)
  }

  await page.close()
  await browser.close()

  console.log(`\nUnique islands captured: ${found.size}`)
  if (found.size === 0) {
    console.error('Nothing scraped. Check that Chrome is on a Discover page and the markup matches.')
    await sql.end()
    process.exit(1)
  }

  // Resolve fortnite-creative platform row
  const [platform] = await sql<{ id: number }[]>`
    SELECT id FROM games WHERE slug = 'fortnite-creative' LIMIT 1
  `
  if (!platform) {
    console.error('fortnite-creative platform row missing')
    await sql.end()
    process.exit(1)
  }

  // Existing rows keyed by place_id
  const existing = await sql<{ id: number; place_id: string; thumbnail_url: string | null; creator_name: string | null }[]>`
    SELECT id, place_id, thumbnail_url, creator_name
    FROM platform_experiences
    WHERE platform_id = ${platform.id} AND place_id IS NOT NULL
  `
  const byCode = new Map(existing.map(r => [r.place_id, r]))

  let inserted = 0, updatedThumb = 0, updatedCreator = 0, skipped = 0

  for (const i of found.values()) {
    const row = byCode.get(i.code)
    if (row) {
      const updates: { thumbnailUrl?: string; creatorName?: string; title?: string } = {}
      if (i.thumbnailUrl && (!row.thumbnail_url || row.thumbnail_url.includes('fortnitemaps.com'))) {
        await sql`UPDATE platform_experiences SET thumbnail_url = ${i.thumbnailUrl}, updated_at = NOW() WHERE id = ${row.id}`
        updatedThumb++
      }
      if (i.creator && !row.creator_name) {
        await sql`UPDATE platform_experiences SET creator_name = ${i.creator}, updated_at = NOW() WHERE id = ${row.id}`
        updatedCreator++
      }
      if (!Object.keys(updates).length) skipped++
    } else {
      // Insert with a slug derived from title (fall back to creator-code)
      let slug = slugify(i.title ?? `${i.creator ?? 'fortnite'}-${i.code}`)
      const collision = await sql`SELECT 1 FROM platform_experiences WHERE slug = ${slug} LIMIT 1`
      if (collision.length) slug = `${slug}-${i.code.replace(/-/g, '').slice(0, 8)}`

      await sql`
        INSERT INTO platform_experiences (
          slug, platform_id, place_id, universe_id,
          title, description, creator_name, thumbnail_url, genre,
          is_public, last_fetched_at, needs_rescore, created_at, updated_at
        ) VALUES (
          ${slug}, ${platform.id}, ${i.code}, NULL,
          ${i.title ?? `Fortnite Creative ${i.code}`}, NULL, ${i.creator}, ${i.thumbnailUrl}, NULL,
          TRUE, NOW(), TRUE, NOW(), NOW()
        )
        ON CONFLICT (place_id) DO NOTHING
      `
      inserted++
    }
  }

  console.log(`\n── DB writes ───────────────────────────────`)
  console.log(`  new islands inserted: ${inserted}`)
  console.log(`  thumbnails updated:   ${updatedThumb}`)
  console.log(`  creators backfilled:  ${updatedCreator}`)
  console.log(`  unchanged:            ${skipped}`)

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
