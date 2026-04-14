import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ count: 0 })

  const [row] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)))

  return NextResponse.json({ count: row?.count ?? 0 })
}
