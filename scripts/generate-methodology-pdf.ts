/**
 * Generate a PDF of the methodology page using Playwright.
 *
 * Usage:
 *   npm run pdf:methodology
 *   npm run pdf:methodology -- --url https://lumikin.org/methodology
 *   npm run pdf:methodology -- --version 1.1
 *
 * Requires Chromium: npx playwright install chromium
 *
 * The script saves the PDF to public/lumikin-methodology-v<VERSION>.pdf.
 * Commit the generated file or upload it to your CDN.
 * Re-run whenever methodology content changes or a new version is published.
 */

import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import { METHODOLOGY_REGISTRY, CURRENT_METHODOLOGY_VERSION } from '../src/lib/methodology'

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : undefined
}

async function checkReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5_000) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

async function main() {
  const version = arg('--version') ?? CURRENT_METHODOLOGY_VERSION
  const entry   = METHODOLOGY_REGISTRY.find(m => m.version === version)

  if (!entry) {
    console.error(`Unknown methodology version: ${version}`)
    console.error(`Known versions: ${METHODOLOGY_REGISTRY.map(m => m.version).join(', ')}`)
    process.exit(1)
  }

  const baseUrl = arg('--url') ?? 'http://localhost:3000/methodology'
  const url     = entry.isCurrent ? baseUrl : `${baseUrl}?version=${version}`
  const outFile = path.join(process.cwd(), 'public', `lumikin-methodology-v${version}.pdf`)

  // Pre-flight: fail fast with a helpful message before launching Chromium
  const reachable = await checkReachable(url)
  if (!reachable) {
    console.error(`\nCannot reach: ${url}`)
    if (url.includes('localhost')) {
      console.error('Start the dev server first:  npm run dev')
      console.error('Or generate against production:  npm run pdf:methodology -- --url https://lumikin.org/methodology')
    }
    process.exit(1)
  }

  // Ensure public/ exists
  fs.mkdirSync(path.dirname(outFile), { recursive: true })

  console.log(`Generating methodology v${version} PDF…`)
  console.log(`  Source:  ${url}`)
  console.log(`  Output:  ${outFile}`)

  const browser = await chromium.launch()
  const page    = await browser.newPage()

  await page.emulateMedia({ media: 'print' })

  // 'load' is reliable; 'networkidle' can hang on pages with persistent connections
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 })

  // Let fonts settle — next/font serves them over HTTP so they need a moment
  await page.waitForFunction(() => document.fonts.ready.then(() => true), { timeout: 10_000 })

  const footerTemplate = `
    <div style="
      width: 100%;
      padding: 0 1.8cm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #71717a;
      font-family: system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
    ">
      <span>LumiKin Methodology v${version} · lumikin.org/methodology</span>
      <span>
        <span class="pageNumber"></span>
        <span style="color: #d4d4d8"> / </span>
        <span class="totalPages"></span>
      </span>
    </div>
  `

  await page.pdf({
    path:                 outFile,
    format:               'A4',
    printBackground:      true,
    displayHeaderFooter:  true,
    headerTemplate:       '<span></span>',
    footerTemplate,
    margin: {
      top:    '1.5cm',
      bottom: '2cm',
      left:   '2cm',
      right:  '2cm',
    },
  })

  await browser.close()

  const sizeKb = Math.round(fs.statSync(outFile).size / 1024)
  console.log(`✓ Done — ${sizeKb} KB`)
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`\nPDF generation failed: ${msg}`)
  process.exit(1)
})
