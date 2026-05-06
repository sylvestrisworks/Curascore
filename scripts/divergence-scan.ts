/**
 * Divergence Scan — LumiKin age-rating cross-check
 *
 * Produces two structured reports in reports/:
 *   age-divergence-{version}-{YYYYMMDD}.json  + .csv
 *   unrated-safeguard-{version}-{YYYYMMDD}.json + .csv
 *
 * Read-only. No LLM calls. No DB writes.
 *
 * Usage:
 *   node --env-file=.env node_modules/tsx/dist/cli.cjs scripts/divergence-scan.ts
 */

import { config } from 'dotenv'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
config({ path: join(process.cwd(), '.env') })

import postgres from 'postgres'
import { CURRENT_METHODOLOGY_VERSION } from '../src/lib/methodology'
import { AGE_FLOOR_CONFIG } from '../src/lib/scoring/age-floors'

// ─── ESRB → numeric ──────────────────────────────────────────────────────────

const ESRB_NUMERIC: Record<string, number> = {
  E: 6, 'E10+': 10, E10: 10, T: 13, M: 17, AO: 18,
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RatingCoverage = 'dual_rated' | 'single_rated_esrb' | 'single_rated_pegi' | 'unrated'
type DivergenceClass = 'aligned' | 'lumikin_stricter' | 'lumikin_permissive' | 'mixed'

interface GameRow {
  game_id: number
  slug: string
  name: string
  esrb_rating: string | null
  pegi_rating: number | null
  recommended_min_age: number
  age_floor_reason: string | null
  methodology_version: string | null
  calculated_at: Date
  violence_level: number | null
  sexual_content: number | null
  trivialized: boolean | null
  defenceless_target: boolean | null
  mixed_sexual_violent: boolean | null
}

interface DivergenceRecord {
  gameId: number
  name: string
  slug: string
  lumikinAge: number
  esrbAge: number | null
  pegiAge: number | null
  deltaEsrb: number | null
  deltaPegi: number | null
  divergenceClass: DivergenceClass
  magnitude: number
  drivers: { r41Score: number; r42Score: number; modifiers: string[] }
  ratingCoverage: Exclude<RatingCoverage, 'unrated'>
  methodologyVersion: string
}

interface UnratedRecord {
  gameId: number
  name: string
  slug: string
  lumikinAge: number
  r41Score: number
  r42Score: number
  modifiers: string[]
  flags: string[]
  scoredAt: string
  methodologyVersion: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp3(n: number | null | undefined): 0 | 1 | 2 | 3 {
  return Math.min(3, Math.max(0, Math.round(n ?? 0))) as 0 | 1 | 2 | 3
}

function activeModifiers(row: GameRow): string[] {
  const mods: string[] = []
  if (row.trivialized)          mods.push('trivialized')
  if (row.defenceless_target)   mods.push('defenceless_target')
  if (row.mixed_sexual_violent) mods.push('mixed_sexual_violent')
  return mods
}

function classifyDivergence(
  deltaEsrb: number | null,
  deltaPegi: number | null,
): DivergenceClass {
  const deltas = [deltaEsrb, deltaPegi].filter((d): d is number => d !== null)
  const hasStricter   = deltas.some(d => d >= 2)
  const hasPermissive = deltas.some(d => d <= -2)
  if (hasStricter && hasPermissive) return 'mixed'
  if (hasStricter)                  return 'lumikin_stricter'
  if (hasPermissive)                return 'lumikin_permissive'
  return 'aligned'
}

function objectsToCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) return ''
  const keys = Object.keys(records[0])
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [keys.join(','), ...records.map(r => keys.map(k => escape(r[k])).join(','))].join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', prepare: false })

  console.log('Loading scored game catalog…')

  const rows = (await sql`
    SELECT
      g.id                  AS game_id,
      g.slug,
      g.title               AS name,
      g.esrb_rating,
      g.pegi_rating,
      gs.recommended_min_age,
      gs.age_floor_reason,
      gs.methodology_version,
      gs.calculated_at,
      r.violence_level,
      r.sexual_content,
      r.trivialized,
      r.defenceless_target,
      r.mixed_sexual_violent
    FROM game_scores gs
    JOIN games g ON g.id = gs.game_id
    JOIN reviews r ON r.id = gs.review_id
    WHERE gs.recommended_min_age IS NOT NULL
    ORDER BY g.id
  `) as GameRow[]

  console.log(`  ${rows.length} scored games with recommended_min_age set\n`)

  const methodologyVersion = CURRENT_METHODOLOGY_VERSION
  const generatedAt        = new Date().toISOString()
  const dateTag            = generatedAt.slice(0, 10).replace(/-/g, '')
  const thirtyDaysAgo      = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // ─── Bucket & classify ────────────────────────────────────────────────────

  const divergenceRecords: DivergenceRecord[] = []
  const unratedRecords: UnratedRecord[] = []
  let dualRated = 0, singleRated = 0, unrated = 0

  for (const row of rows) {
    const hasEsrb = row.esrb_rating != null && row.esrb_rating in ESRB_NUMERIC
    const hasPegi = row.pegi_rating != null

    let coverage: RatingCoverage
    if      (hasEsrb && hasPegi) { coverage = 'dual_rated';         dualRated++ }
    else if (hasEsrb)            { coverage = 'single_rated_esrb';  singleRated++ }
    else if (hasPegi)            { coverage = 'single_rated_pegi';  singleRated++ }
    else                         { coverage = 'unrated';             unrated++ }

    const v        = clamp3(row.violence_level)
    const s        = clamp3(row.sexual_content)
    const modifiers = activeModifiers(row)
    const recAge   = row.recommended_min_age
    const recMv    = row.methodology_version ?? methodologyVersion

    if (coverage === 'unrated') {
      const flags: string[] = []
      if (recAge >= 13)                       flags.push('high_age_no_external_check')
      if (recAge <= 9 && (v >= 2 || s >= 2)) flags.push('low_age_with_content_score')
      if (modifiers.length > 0)              flags.push('modifier_active_no_external_check')
      if (recAge === 0 || recAge === 17)      flags.push('at_methodology_extremes')
      if (row.calculated_at > thirtyDaysAgo) flags.push('recently_scored_unrated')

      unratedRecords.push({
        gameId:             row.game_id,
        name:               row.name,
        slug:               row.slug,
        lumikinAge:         recAge,
        r41Score:           v,
        r42Score:           s,
        modifiers,
        flags,
        scoredAt:           row.calculated_at.toISOString(),
        methodologyVersion: recMv,
      })
    } else {
      const esrbAge   = hasEsrb ? ESRB_NUMERIC[row.esrb_rating!] : null
      const pegiAge   = hasPegi ? row.pegi_rating! : null
      const deltaEsrb = esrbAge != null ? recAge - esrbAge : null
      const deltaPegi = pegiAge != null ? recAge - pegiAge : null
      const divergenceClass = classifyDivergence(deltaEsrb, deltaPegi)
      const magnitude = Math.max(Math.abs(deltaEsrb ?? 0), Math.abs(deltaPegi ?? 0))

      divergenceRecords.push({
        gameId:             row.game_id,
        name:               row.name,
        slug:               row.slug,
        lumikinAge:         recAge,
        esrbAge,
        pegiAge,
        deltaEsrb,
        deltaPegi,
        divergenceClass,
        magnitude,
        drivers:            { r41Score: v, r42Score: s, modifiers },
        ratingCoverage:     coverage,
        methodologyVersion: recMv,
      })
    }
  }

  // ─── Divergence report ────────────────────────────────────────────────────

  const aligned           = divergenceRecords.filter(r => r.divergenceClass === 'aligned').length
  const lumikinStricter   = divergenceRecords.filter(r => r.divergenceClass === 'lumikin_stricter').length
  const lumikinPermissive = divergenceRecords.filter(r => r.divergenceClass === 'lumikin_permissive').length
  const mixed             = divergenceRecords.filter(r => r.divergenceClass === 'mixed').length

  // Top 20 stricter-direction, then top 20 permissive-direction; deduplicate mixed
  const stricterCandidates  = divergenceRecords
    .filter(r => r.divergenceClass === 'lumikin_stricter' || r.divergenceClass === 'mixed')
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 20)

  const permissiveCandidates = divergenceRecords
    .filter(r => r.divergenceClass === 'lumikin_permissive' || r.divergenceClass === 'mixed')
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 20)

  const seenInStricter = new Set(stricterCandidates.map(r => r.gameId))
  const topDivergences = [
    ...stricterCandidates,
    ...permissiveCandidates.filter(r => !seenInStricter.has(r.gameId)),
  ]

  // byContentType: based on which R4 dimension drives the age floor
  const violenceDriven = divergenceRecords.filter(r => {
    const vFloor = AGE_FLOOR_CONFIG.violence[r.drivers.r41Score]
    const sFloor = AGE_FLOOR_CONFIG.sexual[r.drivers.r42Score]
    return vFloor > 0 && vFloor >= sFloor
  }).length

  const sexualDriven = divergenceRecords.filter(r => {
    const sFloor = AGE_FLOOR_CONFIG.sexual[r.drivers.r42Score]
    const vFloor = AGE_FLOOR_CONFIG.violence[r.drivers.r41Score]
    return sFloor > 0 && sFloor > vFloor
  }).length

  const modifierDriven = divergenceRecords.filter(r => r.drivers.modifiers.length > 0).length

  const divergenceReport = {
    methodologyVersion,
    generatedAt,
    summary: {
      totalGames: rows.length,
      dualRated,
      singleRated,
      unrated,
      aligned,
      lumikinStricter,
      lumikinPermissive,
      mixed,
    },
    topDivergences,
    byContentType: { violenceDriven, sexualDriven, modifierDriven },
  }

  // ─── Unrated safeguard report ─────────────────────────────────────────────

  // Sort: flag count desc, then age desc (highest-risk first)
  unratedRecords.sort((a, b) => {
    const diff = b.flags.length - a.flags.length
    return diff !== 0 ? diff : b.lumikinAge - a.lumikinAge
  })

  const byFlag = {
    high_age_no_external_check:        unratedRecords.filter(r => r.flags.includes('high_age_no_external_check')).length,
    low_age_with_content_score:        unratedRecords.filter(r => r.flags.includes('low_age_with_content_score')).length,
    modifier_active_no_external_check: unratedRecords.filter(r => r.flags.includes('modifier_active_no_external_check')).length,
    at_methodology_extremes:           unratedRecords.filter(r => r.flags.includes('at_methodology_extremes')).length,
    recently_scored_unrated:           unratedRecords.filter(r => r.flags.includes('recently_scored_unrated')).length,
  }
  const multiFlag = unratedRecords.filter(r => r.flags.length >= 2).length

  const multiFlagGames = unratedRecords.filter(r => r.flags.length >= 2)
  const multiFlagIds   = new Set(multiFlagGames.map(r => r.gameId))
  const topSingleFlag  = unratedRecords
    .filter(r => r.flags.length === 1)
    .sort((a, b) => b.lumikinAge - a.lumikinAge)
    .slice(0, 50)

  const priorityReview = [...multiFlagGames, ...topSingleFlag]

  const allUnrated = unratedRecords.map(r => ({
    gameId:     r.gameId,
    name:       r.name,
    slug:       r.slug,
    lumikinAge: r.lumikinAge,
    flags:      r.flags,
    scoredAt:   r.scoredAt,
  }))

  const safeguardReport = {
    methodologyVersion,
    generatedAt,
    summary: {
      totalUnrated: unratedRecords.length,
      byFlag,
      multiFlag,
    },
    priorityReview,
    allUnrated,
  }

  // ─── Write outputs ────────────────────────────────────────────────────────

  const reportsDir = join(process.cwd(), 'reports')
  mkdirSync(reportsDir, { recursive: true })

  const vTag = `${methodologyVersion}-${dateTag}`

  const paths = {
    divJson: join(reportsDir, `age-divergence-${vTag}.json`),
    divCsv:  join(reportsDir, `age-divergence-${vTag}.csv`),
    safJson: join(reportsDir, `unrated-safeguard-${vTag}.json`),
    safCsv:  join(reportsDir, `unrated-safeguard-${vTag}.csv`),
  }

  writeFileSync(paths.divJson, JSON.stringify(divergenceReport, null, 2))

  // Divergence CSV: all rated games, sorted by magnitude desc (full audit surface)
  const divCsvRows = divergenceRecords
    .sort((a, b) => b.magnitude - a.magnitude)
    .map(r => ({
      gameId:             r.gameId,
      name:               r.name,
      slug:               r.slug,
      lumikinAge:         r.lumikinAge,
      esrbAge:            r.esrbAge ?? '',
      pegiAge:            r.pegiAge ?? '',
      deltaEsrb:          r.deltaEsrb ?? '',
      deltaPegi:          r.deltaPegi ?? '',
      divergenceClass:    r.divergenceClass,
      magnitude:          r.magnitude,
      r41Score:           r.drivers.r41Score,
      r42Score:           r.drivers.r42Score,
      modifiers:          r.drivers.modifiers.join('|'),
      ratingCoverage:     r.ratingCoverage,
      methodologyVersion: r.methodologyVersion,
    }))
  writeFileSync(paths.divCsv, objectsToCsv(divCsvRows))

  writeFileSync(paths.safJson, JSON.stringify(safeguardReport, null, 2))

  // Safeguard CSV: all unrated games (full audit surface), sorted by flag count desc, age desc
  const safCsvRows = unratedRecords.map(r => ({
    gameId:             r.gameId,
    name:               r.name,
    slug:               r.slug,
    lumikinAge:         r.lumikinAge,
    r41Score:           r.r41Score,
    r42Score:           r.r42Score,
    modifiers:          r.modifiers.join('|'),
    flags:              r.flags.join('|'),
    flagCount:          r.flags.length,
    inPriorityReview:   priorityReview.some(p => p.gameId === r.gameId) ? 'yes' : 'no',
    scoredAt:           r.scoredAt,
    methodologyVersion: r.methodologyVersion,
  }))
  writeFileSync(paths.safCsv, objectsToCsv(safCsvRows))

  // ─── Console summary ──────────────────────────────────────────────────────

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║           Divergence Scan — Complete             ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Methodology: v${methodologyVersion}  |  Date: ${generatedAt.slice(0, 10)}`)
  console.log()
  console.log(`  Total scored games   : ${rows.length}`)
  console.log(`    Dual-rated         : ${dualRated}`)
  console.log(`    Single-rated       : ${singleRated}`)
  console.log(`    Unrated            : ${unrated}`)
  console.log(`  Check: ${dualRated} + ${singleRated} + ${unrated} = ${dualRated + singleRated + unrated} (expected ${rows.length})`)
  console.log()
  console.log(`  Divergence classes (rated games = ${dualRated + singleRated}):`)
  console.log(`    Aligned            : ${aligned}`)
  console.log(`    LumiKin stricter   : ${lumikinStricter}`)
  console.log(`    LumiKin permissive : ${lumikinPermissive}`)
  console.log(`    Mixed              : ${mixed}`)
  console.log(`  Check: ${aligned} + ${lumikinStricter} + ${lumikinPermissive} + ${mixed} = ${aligned + lumikinStricter + lumikinPermissive + mixed} (expected ${dualRated + singleRated})`)
  console.log()
  console.log(`  Unrated safeguard:`)
  console.log(`    Total unrated      : ${unratedRecords.length}`)
  console.log(`    Multi-flag (2+)    : ${multiFlag}`)
  console.log(`    Priority review    : ${priorityReview.length}`)
  console.log()
  console.log(`  Files written:`)
  for (const p of Object.values(paths)) console.log(`    ${p}`)

  await sql.end()
  process.exit(0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
