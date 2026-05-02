/**
 * Quick Vercel Blob connectivity test — upload a small image, verify the URL, delete it.
 *
 *   npx tsx scripts/_test-gcs.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { put, del } from '@vercel/blob'
import { uploadFromUrl } from '@/lib/gcs'

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set')
    process.exit(1)
  }

  // 1. Upload a tiny text file
  const { url } = await put('_test/probe.txt', 'lumikin blob test', {
    access: 'public',
    addRandomSuffix: false,
  })
  console.log(`Uploaded: ${url}`)

  // 2. Fetch it back
  const res = await fetch(url)
  console.log(`Status: ${res.status}, Content: ${await res.text()}`)

  // 3. Delete it
  await del(url)
  console.log('Deleted test file')

  // 4. Test uploadFromUrl with a real RAWG image
  const TEST_IMAGE = 'https://media.rawg.io/media/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg'
  console.log('\nTesting uploadFromUrl...')
  const blobUrl = await uploadFromUrl(TEST_IMAGE, '_test/sample-thumb.jpg')
  if (blobUrl) {
    console.log(`✓ Upload OK: ${blobUrl}`)
    await del(blobUrl)
    console.log('  Deleted test image')
  } else {
    console.error('✗ uploadFromUrl returned null')
  }

  console.log('\n✓ Vercel Blob integration ready')
}

main().catch(e => { console.error(e.message ?? e); process.exit(1) })
