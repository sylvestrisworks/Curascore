/**
 * Thumbnail storage helper — backed by Vercel Blob.
 *
 * Auth: BLOB_READ_WRITE_TOKEN env var (already configured).
 * Public URLs are served via Vercel's CDN — no GCS bucket or IAM needed.
 *
 * API is intentionally GCS-shaped so callers don't need to change.
 */

import { put } from '@vercel/blob'

/**
 * Download a remote URL and upload it to Vercel Blob. Returns the public CDN
 * URL, or null on any error (callers fall back to the original URL).
 */
export async function uploadFromUrl(
  sourceUrl: string,
  objectPath: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'LumiKin/1.0 thumbnail-archiver' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) return null

    const { url } = await put(objectPath, buf, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    })
    return url
  } catch {
    return null
  }
}

export function gameThumbPath(slug: string, sourceUrl: string): string {
  const ext = sourceUrl.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)?.[1] ?? 'jpg'
  return `games/${slug}/thumb.${ext.toLowerCase()}`
}

export function experienceThumbPath(
  platform: string,
  experienceId: string | number,
): string {
  return `experiences/${platform}/${experienceId}/thumb.jpg`
}
