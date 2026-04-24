/**
 * jobs/translate-messages.ts
 *
 * Cloud Run Job — translates messages/en.json into es/fr/sv/de using
 * Vertex AI Gemini 2.0 Flash, then pushes updated locale files back to
 * GitHub via the Contents API.
 *
 * Auth: Application Default Credentials (metadata server in Cloud Run,
 *       gcloud auth print-access-token locally).
 *
 * Env vars:
 *   GITHUB_TOKEN    — GitHub PAT or fine-grained token with contents:write
 *   GITHUB_REPO     — default: sylvestrisworks/LumiKin
 *   GITHUB_BRANCH   — default: master
 *   TARGET_LANGS    — comma-separated subset, default: es,fr,sv,de
 *   FORCE           — set to "true" to overwrite files that already exist
 *   GCP_PROJECT     — default: curametrics-492614
 *   GCP_LOCATION    — default: us-central1
 *
 * Usage (local):
 *   FORCE=true npx tsx jobs/translate-messages.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

// ─── Config ───────────────────────────────────────────────────────────────────

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN ?? ''
const GITHUB_REPO   = process.env.GITHUB_REPO   ?? 'sylvestrisworks/LumiKin'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'master'
const GCP_PROJECT   = process.env.GCP_PROJECT   ?? 'curametrics-492614'
const GCP_LOCATION  = process.env.GCP_LOCATION  ?? 'us-central1'
const FORCE         = process.env.FORCE === 'true' || process.env.FORCE === '1'

const SUPPORTED_LOCALES = ['es', 'fr', 'sv', 'de']
const targetLocales = process.env.TARGET_LANGS
  ? process.env.TARGET_LANGS.split(',').map(l => l.trim()).filter(l => SUPPORTED_LOCALES.includes(l))
  : SUPPORTED_LOCALES

const VERTEX_MODEL = 'gemini-2.5-flash'
const VERTEX_URL   = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/${GCP_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`

const BATCH_SIZE = 25

const LOCALE_NAMES: Record<string, string> = {
  es: 'Spanish (Latin American)',
  fr: 'French',
  sv: 'Swedish',
  de: 'German',
}

const LOCALE_VOICE: Record<string, string> = {
  es: `Voice: warm, direct, empowering. Latin American Spanish. Use "tú" not "usted". Avoid overly formal or Castilian phrasing. Parents are savvy — don't talk down to them.`,
  fr: `Voice: clear, confident, slightly warm. Metropolitan French. Avoid overly literal English constructions. French parents appreciate precision — keep it crisp, not bureaucratic.`,
  sv: `Voice: calm, direct, trustworthy — classic Swedish "lagom" tone. Never stiff or overly formal. Avoid literal English word-for-word translations that sound unnatural in Swedish. Use everyday Swedish vocabulary a parent would use, not academic or corporate language. Contractions and conversational phrasing are fine. Examples of what to avoid: "Säker swap" → prefer "Bättre alternativ"; "Bläddra bland alla spel" is fine but "Utforska alla spel" may feel more natural. Think BabyBjörn brand copy, not IKEA instruction manual.`,
  de: `Voice: straightforward, trustworthy, approachable — not stiff Hochdeutsch. German parents value clarity and directness. Avoid overly long compound words where a simpler phrase works. Du-form (informal) is appropriate throughout. Think Hornbach ad copy, not legal document.`,
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── GCP Auth — cached for the lifetime of the process ───────────────────────

let cachedToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(2000) }
    )
    if (res.ok) {
      const { access_token, expires_in } = await res.json()
      cachedToken = access_token
      tokenExpiry = Date.now() + (expires_in - 60) * 1000
      return cachedToken!
    }
  } catch { /* not in Cloud Run — fall through to gcloud */ }

  const { execSync } = await import('child_process')
  const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  cachedToken = token
  tokenExpiry = Date.now() + 50 * 60 * 1000
  return token
}

// ─── GitHub Contents API ──────────────────────────────────────────────────────

const GH_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

async function getGitHubFile(path: string): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: GH_HEADERS }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  }
}

async function putGitHubFile(path: string, content: string, sha: string | null, message: string): Promise<void> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH,
    committer: { name: 'LumiKin Bot', email: 'bot@lumikin.org' },
  }
  if (sha) body.sha = sha

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error(`GitHub PUT ${path} → ${res.status}: ${await res.text()}`)
}

// ─── Flatten / unflatten ──────────────────────────────────────────────────────

type JsonObj = Record<string, unknown>

function flatten(obj: JsonObj, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flatten(v as JsonObj, key))
    } else if (typeof v === 'string') {
      result[key] = v
    }
  }
  return result
}

function unflatten(flat: Record<string, string>): JsonObj {
  const result: JsonObj = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = result
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {}
      cur = cur[parts[i]]
    }
    cur[parts[parts.length - 1]] = value
  }
  return result
}

// ─── Translation via Vertex AI ────────────────────────────────────────────────

async function translateBatch(
  strings: Record<string, string>,
  targetLang: string,
  attempt = 0,
): Promise<Record<string, string>> {
  const langName  = LOCALE_NAMES[targetLang] ?? targetLang
  const voiceNote = LOCALE_VOICE[targetLang] ?? 'Voice: natural, friendly, appropriate for parents.'

  const prompt = `You are a local copywriter for a children's game rating website called "LumiKin". You are NOT doing a literal translation — you are writing copy that feels native and natural in ${langName}, as if it were written by a local for a local audience.

${voiceNote}

The site is GAMING POSITIVE — it empowers parents rather than scaring them. Benefits always come before risks. The tone is informed and confident, never preachy or alarmist.

RULES (non-negotiable):
1. Return ONLY valid JSON — no markdown, no code fences, no commentary.
2. Keep ALL keys exactly as-is.
3. Preserve ICU placeholders exactly: {count}, {year}, {query}, {platforms}, {current}, {total}, {min}, {n} etc.
4. Preserve HTML-like rich text tags exactly: <yellow>…</yellow> — only translate the text inside them, never the tags themselves.
5. Keep plural ICU patterns intact: {count, plural, one {# game} other {# games}} — only translate the English words inside the curly braces.
6. Brand names are NEVER translated: "LumiKin", "ESRB", "Metacritic", "Gemini".
7. Keep scoring terms consistent: BDS = "Benefit Density Score", RIS = "Risk Intensity Score" (these stay in English as proper nouns).

Input JSON (English source):
${JSON.stringify(strings, null, 2)}

Output: localized JSON with the same keys, copy that sounds like it was written by a native speaker.`

  const token = await getAccessToken()

  let res: Response
  try {
    res = await fetch(VERTEX_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    })
  } catch (err) {
    const isTransient = String(err).includes('fetch failed') || String(err).includes('ECONNRESET')
    if (isTransient && attempt < 5) {
      const delay = Math.pow(2, attempt) * 5_000
      console.log(`  [network error — retrying in ${delay / 1000}s]`)
      await sleep(delay)
      return translateBatch(strings, targetLang, attempt + 1)
    }
    throw err
  }

  if (res.status === 429 || res.status === 503) {
    if (attempt < 5) {
      const delay = Math.pow(2, attempt) * 8_000
      console.log(`  [${res.status} — retrying in ${delay / 1000}s]`)
      await sleep(delay)
      return translateBatch(strings, targetLang, attempt + 1)
    }
    throw new Error(`Vertex AI ${res.status} after ${attempt} retries`)
  }

  if (!res.ok) {
    throw new Error(`Vertex AI ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // responseMimeType: application/json means the text is already valid JSON,
  // but strip accidental fences just in case
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    console.error(`  [parse error] raw response:\n${text.slice(0, 500)}`)
    throw new Error(`Failed to parse Vertex AI JSON response for ${targetLang}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[translate-messages] Starting')
  console.log(`[translate-messages] Target languages: ${targetLocales.join(', ')}`)
  console.log(`[translate-messages] Force: ${FORCE}`)
  console.log(`[translate-messages] Repo: ${GITHUB_REPO} @ ${GITHUB_BRANCH}`)

  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set')

  const enFile = await getGitHubFile('messages/en.json')
  if (!enFile) throw new Error('messages/en.json not found in repo')

  const enJson: JsonObj = JSON.parse(enFile.content)
  const flat = flatten(enJson)
  const totalKeys = Object.keys(flat).length
  console.log(`[translate-messages] ${totalKeys} strings to translate\n`)

  let translated = 0
  let skipped = 0
  let errors = 0

  const enEntries = Object.entries(flat)
  const enKeySet = new Set(Object.keys(flat))

  for (const locale of targetLocales) {
    const filePath = `messages/${locale}.json`
    const existing = await getGitHubFile(filePath)

    // Determine which keys need translating
    let toTranslate: [string, string][]
    let existingFlat: Record<string, string> = {}

    if (existing && !FORCE) {
      existingFlat = flatten(JSON.parse(existing.content) as JsonObj)
      const existingKeys = new Set(Object.keys(existingFlat))
      // Remove stale keys (deleted from en.json) and find missing ones
      for (const k of Object.keys(existingFlat)) {
        if (!enKeySet.has(k)) delete existingFlat[k]
      }
      toTranslate = enEntries.filter(([k]) => !existingKeys.has(k))
      if (toTranslate.length === 0) {
        console.log(`[translate-messages] ${locale}: up to date — nothing to do`)
        skipped++
        continue
      }
      console.log(`[translate-messages] ${locale}: ${toTranslate.length} missing keys (of ${totalKeys})…`)
    } else {
      toTranslate = enEntries
      console.log(`[translate-messages] ${locale}: translating all ${totalKeys} strings…`)
    }

    try {
      const batches = Math.ceil(toTranslate.length / BATCH_SIZE)
      const newTranslations: Record<string, string> = {}

      for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
        const batch = Object.fromEntries(toTranslate.slice(i, i + BATCH_SIZE))
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        process.stdout.write(`  Batch ${batchNum}/${batches}… `)
        const out = await translateBatch(batch, locale)
        Object.assign(newTranslations, out)
        console.log('✓')
      }

      // Merge: existing translations + newly translated keys, in en.json key order
      const merged: Record<string, string> = {}
      for (const k of Object.keys(flat)) {
        merged[k] = newTranslations[k] ?? existingFlat[k] ?? flat[k]
      }

      const nested = unflatten(merged)
      const fileContent = JSON.stringify(nested, null, 2) + '\n'
      const commitMsg = FORCE
        ? `chore(i18n): retranslate messages/${locale}.json\n\nFull retranslation by LumiKin Cloud Run Job (${VERTEX_MODEL})`
        : `chore(i18n): fill missing keys in messages/${locale}.json\n\n${toTranslate.length} new key(s) translated by LumiKin Cloud Run Job (${VERTEX_MODEL})`

      await putGitHubFile(filePath, fileContent, existing?.sha ?? null, commitMsg)
      console.log(`[translate-messages] ${locale}: pushed to GitHub ✓\n`)
      translated++
    } catch (err) {
      console.error(`[translate-messages] ${locale}: FAILED —`, err)
      errors++
    }
  }

  console.log(`[translate-messages] Done — translated: ${translated}, skipped: ${skipped}, errors: ${errors}`)
  process.exit(errors > 0 && translated === 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[translate-messages] Fatal:', err)
  process.exit(1)
})
