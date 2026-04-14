/**
 * PoC seed: fetch metadata for 10 well-known Roblox experiences and upsert into DB.
 * Requires the 'roblox' row to exist in games with is_platform = true.
 * Run: npx tsx --env-file=.env scripts/seed-roblox-experiences.ts
 */
import postgres from 'postgres'
import { fetchRobloxExperience } from '../src/lib/roblox/api'

// 10 high-traffic Roblox experiences covering a range of genres + risk profiles
const TEST_PLACE_IDS = [
  { placeId: '3260590327', label: 'Adopt Me'                  },
  { placeId: '4924922222', label: 'Brookhaven RP'             },
  { placeId: '1962086868', label: 'Tower of Hell'             },
  { placeId: '2753915549', label: 'Blox Fruits'               },
  { placeId: '142823291',  label: 'Murder Mystery 2'          },
  { placeId: '735030788',  label: 'Royale High'               },
  { placeId: '606849621',  label: 'Jailbreak'                 },
  { placeId: '286090429',  label: 'Arsenal'                   },
  { placeId: '189707',     label: 'Natural Disaster Survival' },
  { placeId: '192800',     label: 'Work at a Pizza Place'     },
]

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 255)
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  // Ensure Roblox platform row exists
  const [roblox] = await sql`
    SELECT id FROM games WHERE slug = 'roblox' LIMIT 1
  `
  if (!roblox) {
    console.error('ERROR: No "roblox" row found in games table.')
    console.error('Make sure Roblox exists in the games table with slug = "roblox".')
    await sql.end()
    process.exit(1)
  }

  // Mark it as a platform
  await sql`UPDATE games SET is_platform = true WHERE slug = 'roblox'`
  console.log(`Using Roblox platform row (id=${roblox.id})`)

  let ok = 0, fail = 0

  for (const { placeId, label } of TEST_PLACE_IDS) {
    try {
      console.log(`\nFetching: ${label} (place ${placeId})...`)
      const meta = await fetchRobloxExperience(placeId)

      let slug = slugify(meta.title)

      // Check slug collision
      const [collision] = await sql`
        SELECT id FROM platform_experiences WHERE slug = ${slug} AND place_id != ${placeId} LIMIT 1
      `
      if (collision) slug = `${slug}-${placeId}`

      await sql`
        INSERT INTO platform_experiences
          (slug, platform_id, place_id, universe_id, title, description,
           creator_name, creator_id, thumbnail_url, genre, is_public,
           visit_count, active_players, max_players, last_fetched_at, updated_at)
        VALUES
          (${slug}, ${roblox.id}, ${meta.placeId}, ${meta.universeId}, ${meta.title},
           ${meta.description}, ${meta.creatorName}, ${meta.creatorId}, ${meta.thumbnailUrl},
           ${meta.genre}, ${meta.isPublic}, ${meta.visitCount}, ${meta.activePlayers},
           ${meta.maxPlayers}, NOW(), NOW())
        ON CONFLICT (place_id) DO UPDATE SET
          universe_id    = EXCLUDED.universe_id,
          title          = EXCLUDED.title,
          description    = EXCLUDED.description,
          creator_name   = EXCLUDED.creator_name,
          thumbnail_url  = EXCLUDED.thumbnail_url,
          genre          = EXCLUDED.genre,
          visit_count    = EXCLUDED.visit_count,
          active_players = EXCLUDED.active_players,
          max_players    = EXCLUDED.max_players,
          last_fetched_at = NOW(),
          updated_at     = NOW()
      `

      console.log(`  OK: "${meta.title}" — ${meta.visitCount.toLocaleString()} visits, ${meta.activePlayers} active`)
      ok++
    } catch (err) {
      console.error(`  FAIL: ${label} — ${err}`)
      fail++
    }
  }

  console.log(`\nDone — ${ok} inserted/updated, ${fail} failed`)
  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
