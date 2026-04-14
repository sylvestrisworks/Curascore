import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await db.delete(users).where(eq(users.id, session.user.id))
    console.log(`[user/delete] Deleted user ${session.user.id}`)
  } catch (err) {
    console.error(`[user/delete] Failed for user ${session.user.id}:`, err)
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 })
  }

  // Cascade in schema handles: accounts, sessions, childProfiles,
  // userGames, gameTips, gameTipVotes
  return NextResponse.json({ deleted: true })
}
