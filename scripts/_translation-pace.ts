import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)

  // Recent translate-content runs
  const runs = await sql`
    SELECT items_processed, started_at, duration_ms
    FROM cron_runs
    WHERE job_name = 'translate-content' AND status = 'success'
    ORDER BY started_at DESC
    LIMIT 20
  `

  console.log('Recent translate-content runs:')
  let total = 0
  for (const r of runs) {
    total += Number(r.items_processed)
    console.log(`  ${new Date(r.started_at).toISOString().slice(0, 16)}  +${r.items_processed}  (${(r.duration_ms/1000).toFixed(0)}s)`)
  }
  console.log(`  Average per run: ${(total / runs.length).toFixed(1)}`)

  // Coverage per locale
  const [scored] = await sql`SELECT COUNT(*) FROM game_scores WHERE curascore IS NOT NULL`
  const locales = await sql`SELECT locale, COUNT(*) FROM game_translations GROUP BY locale ORDER BY locale`
  const scoredN = Number(scored.count)

  console.log('\nCurrent coverage:')
  for (const l of locales) {
    const n = Number(l.count)
    const pct = ((n / scoredN) * 100).toFixed(1)
    const remaining = scoredN - n
    console.log(`  ${l.locale}:  ${n} / ${scoredN}  (${pct}%)  — ${remaining} remaining`)
  }

  // Estimate days to completion
  // translate-content runs every 2h = 12x/day
  // Each locale gets roughly items_processed/locales_per_run translations per run
  const avgPerRun = total / runs.length
  const runsPerDay = 12
  const perDay = avgPerRun * runsPerDay
  console.log(`\nEstimated throughput: ~${perDay.toFixed(0)} translations/day (${avgPerRun.toFixed(1)}/run × 12 runs/day)`)
  console.log('(translations are multi-locale per run — divide by locale count for per-locale rate)')

  await sql.end()
}

main().catch(e => { console.error(e); process.exit(1) })
