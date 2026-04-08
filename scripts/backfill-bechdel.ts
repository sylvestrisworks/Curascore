/**
 * backfill-bechdel.ts
 *
 * Assesses the Bechdel test for all scored games using Gemini Flash.
 * Only touches bechdel_result + bechdel_notes — no scores are changed.
 *
 * Criteria (strict):
 *   pass — ≥2 named female characters who directly interact with each other
 *           about something other than a male character
 *   fail — has female characters but doesn't meet the full criteria
 *   na   — no named characters (puzzle, sports, abstract) — not a failure
 *
 * Usage:
 *   npx tsx scripts/backfill-bechdel.ts              # all games missing bechdel_result
 *   npx tsx scripts/backfill-bechdel.ts --force       # overwrite existing results too
 *   npx tsx scripts/backfill-bechdel.ts --limit 20    # cap for testing
 *   npx tsx scripts/backfill-bechdel.ts --dry-run     # print results, no DB writes
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

import { eq, isNull, isNotNull } from 'drizzle-orm'
import { GoogleGenAI } from '@google/genai'
import { db } from '../src/lib/db'
import { games, reviews, gameScores } from '../src/lib/db/schema'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const force   = args.includes('--force')
const dryRun  = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit'))
const limit   = limitArg
  ? parseInt(limitArg.includes('=') ? limitArg.split('=')[1] : args[args.indexOf(limitArg) + 1])
  : Infinity

// ─── Gemini ───────────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({
  vertexai: true,
  project:  process.env.GOOGLE_PROJECT_ID!,
  location: process.env.GOOGLE_LOCATION ?? 'us-central1',
})

type BechdelResult = { result: 'pass' | 'fail' | 'na'; notes: string }

async function assess(title: string, description: string | null, genres: string[]): Promise<BechdelResult> {
  const prompt = `You are assessing whether the video game "${title}" passes the Bechdel test for games.

Game info:
- Genres: ${genres.join(', ') || 'unknown'}
- Description: ${description?.slice(0, 600) || 'not available'}

The Bechdel test criteria (ALL three must be met for a pass):
1. The game has at least two named female characters (protagonists, major NPCs, or party members — not just background extras)
2. Those two female characters directly interact with each other (dialogue, cooperative relationship, shared scene)
3. Their interaction is primarily about something other than a male character

Result options:
- "pass" — all three criteria clearly met
- "fail" — has female characters but doesn't fully meet the criteria
- "na"   — the game has no named characters at all (pure puzzle, sports sim, abstract gameplay, etc.) — this is NOT a failure

Be strict. When in doubt between pass and fail, choose fail.
Be generous with "na" — if a game simply has no narrative characters, that's na, not fail.

Respond with JSON only:
{
  "result": "pass" | "fail" | "na",
  "notes": "one sentence explanation — name the characters if pass, explain gap if fail, confirm no characters if na"
}`

  let attempt = 0
  while (true) {
    try {
      const res = await ai.models.generateContent({
        model:    'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const parsed = JSON.parse(cleaned) as BechdelResult
      if (!['pass', 'fail', 'na'].includes(parsed.result)) throw new Error(`Invalid result: ${parsed.result}`)
      return parsed
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 && attempt < 5) {
        const delay = Math.pow(2, attempt) * 8_000
        process.stdout.write(` [429 — ${delay / 1000}s wait]`)
        await new Promise(r => setTimeout(r, delay))
        attempt++
      } else {
        throw err
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Fetch all games that have been scored
  const allScored = await db
    .select({
      gameId:        games.id,
      title:         games.title,
      description:   games.description,
      genres:        games.genres,
      reviewId:      reviews.id,
      scoreId:       gameScores.id,
      bechdelResult: reviews.bechdelResult,
    })
    .from(games)
    .innerJoin(reviews,    eq(reviews.gameId,    games.id))
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))

  const toProcess = force
    ? allScored
    : allScored.filter(g => g.bechdelResult == null)

  const capped = toProcess.slice(0, Math.min(toProcess.length, limit))

  console.log(`\nBechdel backfill`)
  console.log(`  Total scored games : ${allScored.length}`)
  console.log(`  Missing result     : ${allScored.filter(g => g.bechdelResult == null).length}`)
  console.log(`  Will process       : ${capped.length}${dryRun ? ' (DRY RUN)' : ''}`)
  if (force) console.log(`  Force mode: overwriting existing results`)
  console.log()

  const counts = { pass: 0, fail: 0, na: 0, error: 0 }

  for (let i = 0; i < capped.length; i++) {
    const g = capped[i]
    process.stdout.write(`[${i + 1}/${capped.length}] ${g.title}… `)

    try {
      const { result, notes } = await assess(
        g.title,
        g.description,
        (g.genres as string[]) ?? [],
      )

      console.log(`${result.toUpperCase()} — ${notes}`)
      counts[result]++

      if (!dryRun) {
        await db.update(reviews)
          .set({ bechdelResult: result, bechdelNotes: notes })
          .where(eq(reviews.id, g.reviewId))

        await db.update(gameScores)
          .set({ bechdelResult: result })
          .where(eq(gameScores.id, g.scoreId))
      }
    } catch (err) {
      console.log(`ERROR — ${err}`)
      counts.error++
    }

    // Small courtesy delay between calls
    if (i < capped.length - 1) await new Promise(r => setTimeout(r, 400))
  }

  console.log(`\nResults: ${counts.pass} pass · ${counts.fail} fail · ${counts.na} na · ${counts.error} errors`)
  if (dryRun) console.log('(Dry run — no DB writes made)')
}

main().catch(err => { console.error(err); process.exit(1) })
