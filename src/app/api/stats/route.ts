export const revalidate = 3600

import { NextResponse } from 'next/server'
import { fetchSiteStats } from '@/lib/stats'

export async function GET() {
  try {
    const stats = await fetchSiteStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[api/stats] error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 })
  }
}
