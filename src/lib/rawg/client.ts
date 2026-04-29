// Raw RAWG API HTTP client. No DB, no caching — just fetch wrappers.

import type { RawgGameDetail, RawgListResponse } from './types'

const RAWG_BASE = 'https://api.rawg.io/api'

export class RawgError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'RawgError'
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>

// Retry on transient server errors (502/503/504) with exponential backoff.
// 429 rate-limit is also retried — RAWG doesn't send Retry-After headers.
const RETRYABLE = new Set([429, 502, 503, 504])
const RETRY_DELAYS = [1_000, 3_000, 8_000] // 3 attempts after the first

async function rawgFetch<T>(path: string, params: QueryParams = {}): Promise<T> {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) throw new RawgError('RAWG_API_KEY is not set in environment')

  const url = new URL(`${RAWG_BASE}${path}`)
  url.searchParams.set('key', apiKey)

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  let lastErr: RawgError | undefined

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      // Bypass any Next.js data cache — we manage caching in the DB ourselves
      cache: 'no-store',
    })

    if (res.ok) return res.json() as Promise<T>

    lastErr = new RawgError(`RAWG ${res.status}: ${res.statusText} — ${path}`, res.status)

    if (!RETRYABLE.has(res.status)) break
  }

  throw lastErr
}

// ─── Exported fetch functions ─────────────────────────────────────────────────

export async function rawgSearch(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<RawgListResponse> {
  return rawgFetch<RawgListResponse>('/games', {
    search: query,
    page,
    page_size: pageSize,
    ordering: '-rating',
    search_precise: true,
  })
}

export async function rawgGetByGenre(
  genreSlug: string,
  page = 1,
  pageSize = 40,
  ordering = '-metacritic',
): Promise<RawgListResponse> {
  return rawgFetch<RawgListResponse>('/games', {
    genres: genreSlug,
    page,
    page_size: pageSize,
    ordering,
  })
}

export async function rawgGetByTag(
  tagSlug: string,
  page = 1,
  pageSize = 40,
): Promise<RawgListResponse> {
  return rawgFetch<RawgListResponse>('/games', {
    tags: tagSlug,
    page,
    page_size: pageSize,
    ordering: '-metacritic',
  })
}

export async function rawgGetDetail(id: number | string): Promise<RawgGameDetail> {
  return rawgFetch<RawgGameDetail>(`/games/${id}`)
}
