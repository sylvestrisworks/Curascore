import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { childProfiles, userGames, games, gameScores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'
import TailoredFeed from '@/components/TailoredFeed'
import ProfileManager from '@/components/ProfileManager'
import { getLocale } from 'next-intl/server'

export const metadata = { title: 'Family Dashboard — PlaySmart' }
export const dynamic = 'force-dynamic'

export default async function FamilyDashboard() {
  const session = await auth()
  if (!session?.user) redirect('/')

  const userId = (session.user as { id?: string }).id ?? session.user.email!
  const locale = await getLocale()

  const [profiles, libraryRows] = await Promise.all([
    db.select().from(childProfiles).where(eq(childProfiles.userId, userId)),
    db.select({
        listType:       userGames.listType,
        slug:           games.slug,
        title:          games.title,
        backgroundImage: games.backgroundImage,
        curascore:      gameScores.curascore,
      })
      .from(userGames)
      .innerJoin(games, eq(games.id, userGames.gameId))
      .leftJoin(gameScores, eq(gameScores.gameId, userGames.gameId))
      .where(eq(userGames.userId, userId)),
  ])

  const owned    = libraryRows.filter(r => r.listType === 'owned')
  const wishlist = libraryRows.filter(r => r.listType === 'wishlist')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Family Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Personalised game picks for each child in your family
            </p>
          </div>
          <span className="text-xs text-slate-400 hidden sm:block">
            Signed in as {session.user.email}
          </span>
        </div>

        {/* Library & Wishlist summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Library */}
          <a href={`/${locale}/library`} className="group bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Library</span>
              <span className="text-xs text-indigo-600 font-medium group-hover:underline">{owned.length} games →</span>
            </div>
            {owned.length > 0 ? (
              <div className="flex gap-1.5 flex-wrap">
                {owned.slice(0, 6).map(g => (
                  <div key={g.slug} className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    {g.backgroundImage
                      ? <img src={g.backgroundImage} alt={g.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-[10px] font-bold text-indigo-300">{g.title.slice(0,2).toUpperCase()}</div>
                    }
                    {g.curascore != null && (
                      <span className="absolute bottom-0 right-0 text-[9px] font-black bg-black/60 text-white px-1 rounded-tl">{g.curascore}</span>
                    )}
                  </div>
                ))}
                {owned.length > 6 && <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-400">+{owned.length - 6}</div>}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No games yet — add them from any game page.</p>
            )}
          </a>

          {/* Wishlist */}
          <a href={`/${locale}/library`} className="group bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Wishlist</span>
              <span className="text-xs text-amber-600 font-medium group-hover:underline">{wishlist.length} games →</span>
            </div>
            {wishlist.length > 0 ? (
              <div className="flex gap-1.5 flex-wrap">
                {wishlist.slice(0, 6).map(g => (
                  <div key={g.slug} className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    {g.backgroundImage
                      ? <img src={g.backgroundImage} alt={g.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-[10px] font-bold text-amber-300">{g.title.slice(0,2).toUpperCase()}</div>
                    }
                    {g.curascore != null && (
                      <span className="absolute bottom-0 right-0 text-[9px] font-black bg-black/60 text-white px-1 rounded-tl">{g.curascore}</span>
                    )}
                  </div>
                ))}
                {wishlist.length > 6 && <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-400">+{wishlist.length - 6}</div>}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Star any game to save it here.</p>
            )}
          </a>
        </div>

        {/* Profile manager (client component handles add/edit/delete) */}
        <ProfileManager
          initialProfiles={profiles.map(p => ({
            id:          p.id,
            name:        p.name,
            birthYear:   p.birthYear,
            platforms:   (p.platforms as string[]) ?? [],
            focusSkills: (p.focusSkills as string[]) ?? [],
          }))}
        />

        {/* Tailored feeds — one per child */}
        {profiles.map(profile => (
          <section key={profile.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                {profile.name[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800">{profile.name}</h2>
                <p className="text-xs text-slate-400">
                  Age {new Date().getFullYear() - profile.birthYear}
                  {(profile.platforms as string[]).length > 0 && ` · ${(profile.platforms as string[]).join(', ')}`}
                </p>
              </div>
            </div>
            <Suspense fallback={
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-52 rounded-xl bg-slate-200 animate-pulse" />
                ))}
              </div>
            }>
              <TailoredFeed
                profileId={profile.id}
                name={profile.name}
                birthYear={profile.birthYear}
                platforms={(profile.platforms as string[]) ?? []}
                focusSkills={(profile.focusSkills as string[]) ?? []}
              />
            </Suspense>
          </section>
        ))}

        {profiles.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">👨‍👩‍👧</p>
            <p className="font-medium text-slate-600">Add a child profile to get started</p>
            <p className="text-sm mt-1">We&apos;ll show personalised game picks based on age, platform, and skills.</p>
          </div>
        )}

      </div>
    </div>
  )
}
