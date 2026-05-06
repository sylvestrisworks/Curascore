/**
 * Backfill recommended_min_age + age_floor_reason for all game_scores rows
 * where the age floor is currently NULL but the review has R4 content scores.
 *
 * Only writes rows where the computed floor is > 0 (i.e., an actual age restriction
 * applies). Games with zero content stay NULL — NULL means "no floor".
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/backfill-age-floors.ts
 */

import { config } from 'dotenv'
import { join } from 'path'
config({ path: join(process.cwd(), '.env') })

import { eq, isNull, isNotNull } from 'drizzle-orm'
import { db } from '../src/lib/db'
import { gameScores, reviews, games } from '../src/lib/db/schema'
import { computeAgeFloor } from '../src/lib/scoring/age-floors'
import { CURRENT_METHODOLOGY_VERSION } from '../src/lib/methodology'

async function main() {
  // Fetch all game_scores that have a linked review with R4 data
  const rows = await db
    .select({
      scoreId:           gameScores.id,
      gameId:            gameScores.gameId,
      title:             games.title,
      currentMinAge:     gameScores.recommendedMinAge,
      violenceLevel:     reviews.violenceLevel,
      sexualContent:     reviews.sexualContent,
      fearHorror:        reviews.fearHorror,
      trivialized:       reviews.trivialized,
      defencelessTarget: reviews.defencelessTarget,
      mixedSexualViolent: reviews.mixedSexualViolent,
    })
    .from(gameScores)
    .innerJoin(reviews, eq(reviews.id, gameScores.reviewId))
    .innerJoin(games,   eq(games.id,   gameScores.gameId))

  const total = rows.length
  let updated = 0
  let skipped = 0

  console.log(`\nBackfilling age floors for ${total} game_scores rows...\n`)

  for (const row of rows) {
    const floor = computeAgeFloor(row.violenceLevel, row.sexualContent, row.fearHorror, {
      trivialized:        row.trivialized,
      defencelessTarget:  row.defencelessTarget,
      mixedSexualViolent: row.mixedSexualViolent,
    })

    if (floor.recommendedMinAge === 0) {
      skipped++
      continue  // no floor to write; leave as NULL
    }

    // Only write if value changed (avoids unnecessary writes for games already correct)
    if (row.currentMinAge === floor.recommendedMinAge) {
      skipped++
      continue
    }

    await db
      .update(gameScores)
      .set({
        recommendedMinAge:  floor.recommendedMinAge,
        ageFloorReason:     floor.ageFloorReason,
        methodologyVersion: CURRENT_METHODOLOGY_VERSION,
      })
      .where(eq(gameScores.id, row.scoreId))

    updated++
    console.log(`  ✓ ${row.title.slice(0, 45).padEnd(45)}  age ${floor.recommendedMinAge}+  (${floor.ageFloorReason})`)
  }

  console.log(`\nDone. Updated: ${updated}  Skipped (no floor or unchanged): ${skipped}\n`)
  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
