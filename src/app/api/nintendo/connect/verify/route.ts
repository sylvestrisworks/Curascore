import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { nintendoConnections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  parseRedirectUrl, exchangeCode, getAccessToken,
  getNaId, getDevices,
} from '@/lib/nintendo/api'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pastedUrl, verifier } = await req.json() as { pastedUrl: string; verifier: string }

  if (!pastedUrl || !verifier)
    return NextResponse.json({ error: 'Missing pastedUrl or verifier' }, { status: 400 })

  try {
    const sessionTokenCode = parseRedirectUrl(pastedUrl)
    const sessionToken     = await exchangeCode(sessionTokenCode, verifier)
    const { accessToken }  = await getAccessToken(sessionToken)
    const naId             = getNaId(accessToken)

    // Get nickname from the first device label or NA user info
    let nickname: string | null = null
    let imageUrl: string | null = null
    try {
      const devices = await getDevices(naId, accessToken)
      nickname = devices[0]?.label ?? null
    } catch { /* nickname is optional */ }

    // Upsert connection — replace if same user reconnects
    await db.insert(nintendoConnections).values({
      userId: session.user.id, naId, nickname, imageUrl, sessionToken,
    }).onConflictDoUpdate({
      target: nintendoConnections.userId,
      set:    { naId, nickname, imageUrl, sessionToken, lastSyncedAt: null },
    })

    console.log(`[nintendo/connect] User ${session.user.id} connected naId ${naId}`)
    return NextResponse.json({ ok: true, naId, nickname })
  } catch (err) {
    console.error('[nintendo/connect] verify failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
