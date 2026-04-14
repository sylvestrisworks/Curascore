import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { notifications, games } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ notifications: [] })

  const rows = await db
    .select({
      id:        notifications.id,
      gameId:    notifications.gameId,
      type:      notifications.type,
      title:     notifications.title,
      body:      notifications.body,
      read:      notifications.read,
      createdAt: notifications.createdAt,
      gameSlug:  games.slug,
      gameTitle: games.title,
      gameImage: games.backgroundImage,
    })
    .from(notifications)
    .leftJoin(games, eq(games.id, notifications.gameId))
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  return NextResponse.json({
    notifications: rows.map(r => ({
      id:        r.id,
      gameId:    r.gameId,
      type:      r.type,
      title:     r.title,
      body:      r.body,
      read:      r.read,
      createdAt: r.createdAt,
      game: r.gameSlug ? { slug: r.gameSlug, title: r.gameTitle, backgroundImage: r.gameImage } : null,
    })),
  })
}
