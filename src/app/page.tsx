export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { eq, desc, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores } from '@/lib/db/schema'
import SearchBar from '@/components/SearchBar'
import type { GameSummary } from '@/types/game'

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getFeaturedGames(): Promise<GameSummary[]> {
  const rows = await db
    .select({
      slug:            games.slug,
      title:           games.title,
      developer:       games.developer,
      genres:          games.genres,
      esrbRating:      games.esrbRating,
      backgroundImage: games.backgroundImage,
      metacriticScore: games.metacriticScore,
      timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
      timeRecommendationColor:   gameScores.timeRecommendationColor,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(isNotNull(games.metacriticScore))
    .orderBy(desc(games.metacriticScore))
    .limit(12)

  return rows.map((r) => ({
    slug:            r.slug,
    title:           r.title,
    developer:       r.developer,
    genres:          (r.genres as string[]) ?? [],
    esrbRating:      r.esrbRating,
    backgroundImage: r.backgroundImage,
    metacriticScore: r.metacriticScore,
    timeRecommendationMinutes: r.timeRecommendationMinutes,
    timeRecommendationColor: r.timeRecommendationColor as 'green' | 'amber' | 'red' | null,
  }))
}

// ─── Helper components ────────────────────────────────────────────────────────

function GameTile({ game }: { game: GameSummary }) {
  const color = game.timeRecommendationColor
  const timeBg =
    color === 'green' ? 'bg-emerald-600' :
    color === 'amber' ? 'bg-amber-500' :
    color === 'red'   ? 'bg-red-600' : null

  return (
    <Link
      href={`/game/${game.slug}`}
      className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all"
    >
      <div className="relative h-32 bg-indigo-100 overflow-hidden">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
            <span className="text-3xl font-black text-indigo-300">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {timeBg && game.timeRecommendationMinutes && (
          <div className={`absolute top-2 right-2 ${timeBg} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
            {game.timeRecommendationMinutes}m
          </div>
        )}
        {game.esrbRating && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            {game.esrbRating}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
          {game.title}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs text-slate-500 truncate">
            {game.genres[0] ?? game.developer ?? ''}
          </span>
          {game.metacriticScore && (
            <span className="ml-auto text-xs font-medium text-slate-400 shrink-0">
              {game.metacriticScore}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

const CATEGORIES = [
  { label: 'Ages 5–8',      href: '/search?esrb=E',               emoji: '🌱' },
  { label: 'Ages 9–12',     href: '/search?esrb=E10',             emoji: '🎮' },
  { label: 'Teens',         href: '/search?esrb=T',               emoji: '🧩' },
  { label: 'Puzzle Games',  href: '/search?genre=puzzle',         emoji: '🔍' },
  { label: 'Teamwork',      href: '/search?benefit=teamwork',     emoji: '🤝' },
  { label: 'No Loot Boxes', href: '/search?filter=no-loot-boxes', emoji: '✅' },
  { label: 'Platformers',   href: '/search?genre=platformer',     emoji: '🏃' },
  { label: 'Strategy',      href: '/search?genre=strategy',       emoji: '♟️' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const featured = await getFeaturedGames()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-700 tracking-tight">PlaySmart</span>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <a href="#browse" className="hover:text-indigo-700 transition-colors">Browse</a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4">

        {/* Hero */}
        <section className="py-10 text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
            Game ratings that put{' '}
            <span className="text-indigo-600">benefits first</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Understand what your child develops, what mechanics to watch for, and how
            much daily playtime makes sense — for any game.
          </p>
          <div className="max-w-xl mx-auto pt-2">
            <SearchBar placeholder="Search 500+ games…" />
          </div>
        </section>

        {/* Category quick links */}
        <section id="browse" className="pb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Browse by category
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-colors shadow-sm"
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured games */}
        <section className="pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Top-rated games</h2>
            <span className="text-xs text-slate-400">{featured.length} shown</span>
          </div>
          {featured.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">🎮</p>
              <p>No games yet. Run the import script to populate the catalog.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {featured.map((game) => (
                <GameTile key={game.slug} game={game} />
              ))}
            </div>
          )}
        </section>

        {/* About */}
        <section className="border-t border-slate-200 py-8 pb-12">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '🌱', title: 'Benefits first',       body: 'We score cognitive, social-emotional, and motor development — not just content warnings.' },
              { icon: '⚠️', title: 'Honest about risks',   body: 'We flag dopamine loops, loot boxes, spending pressure, and social mechanics clearly.' },
              { icon: '⏱',  title: 'Time recommendations', body: 'Each game gets a recommended daily limit based on its risk and benefit profile.' },
            ].map((item) => (
              <div key={item.title} className="text-center px-2">
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        PlaySmart — game ratings for parents
      </footer>
    </div>
  )
}
