import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { callGeminiText } from '@/lib/vertex-ai'

const LANGUAGE_NAMES: Record<string, string> = {
  sv: 'Swedish', de: 'German', fr: 'French', es: 'Spanish (Latin American)',
}

async function translateToLocales(content: Record<string, string>, locales: string[]) {
  const localeList = locales.map(l => LANGUAGE_NAMES[l]).join(', ')
  const localeKeys = locales.map(l => `"${l}"`).join(', ')

  const prompt = `Translate the following game review content from English into ${localeList}.

Rules:
- Return ONLY a valid JSON object with locale codes as top-level keys: ${localeKeys}
- Each value is an object with the same keys as the input
- Keep the parent-friendly, informative tone
- Do NOT translate game titles, character names, brand names, or developer/publisher names — keep those exactly as-is
- Do not add explanations or markdown — just the JSON object

Input:
${JSON.stringify(content, null, 2)}`

  const text = await callGeminiText(prompt)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`)
  return JSON.parse(jsonMatch[0])
}

async function main() {
  const sample = {
    executiveSummary:  'Minecraft is a sandbox game where players build and explore procedurally generated worlds.',
    benefitsNarrative: 'Minecraft is exceptional for creativity and spatial reasoning. Players design complex structures, solve engineering problems, and express themselves through building.',
    risksNarrative:    'The online multiplayer environment can expose younger players to strangers. Some servers have aggressive monetization for cosmetics.',
    parentTip:         'Play together on a private server to see what your child is building — it gives you a natural window into their creative thinking.',
  }

  const locales = ['sv', 'de', 'fr', 'es']
  console.log('Sending one multi-locale prompt for all 4 locales...')
  const t0 = Date.now()
  const result = await translateToLocales(sample, locales)
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`Done in ${elapsed}s`)
  console.log('\nLocales returned:', Object.keys(result))
  for (const locale of locales) {
    const r = result[locale]
    if (!r) { console.log(`  ${locale}: MISSING`); continue }
    console.log(`  ${locale}: executiveSummary = "${String(r.executiveSummary ?? '').slice(0, 80)}..."`)
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
