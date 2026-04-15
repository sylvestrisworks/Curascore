import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { nintendoConnections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.delete(nintendoConnections).where(eq(nintendoConnections.userId, session.user.id))
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ connected: false })

  const [conn] = await db
    .select({ naId: nintendoConnections.naId, nickname: nintendoConnections.nickname, lastSyncedAt: nintendoConnections.lastSyncedAt })
    .from(nintendoConnections)
    .where(eq(nintendoConnections.userId, session.user.id))
    .limit(1)

  return NextResponse.json(conn ? { connected: true, ...conn } : { connected: false })
}
