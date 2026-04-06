import Link from 'next/link'
import type { GameSummary } from '@/types/game'

type Props = {
  game: GameSummary
}

const ESRB_COLORS: Record<string, string> = {
  E:    'bg-green-100 text-green-800',
  'E10+': 'bg-lime-100 text-lime-800',
  T:    'bg-blue-100 text-blue-800',
  M:    'bg-red-100 text-red-700',
}

function ScorePip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span title={`${label}: ${Math.round(value * 100)}/100`}
      className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>
      {Math.round(value * 100)}
    </span>
  )
}

export default function GameCompactCard({ game }: Props) {
  const timeColor =
    game.timeRecommendationColor === 'green' ? 'bg-emerald-600' :
    game.timeRecommendationColor === 'amber' ? 'bg-amber-500' :
    game.timeRecommendationColor === 'red'   ? 'bg-red-600' : null

  return (
    <Link
      href={`/game/${game.slug}`}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all"
    >
      {/* Thumbnail */}
      <div className="relative h-28 bg-indigo-50 overflow-hidden shrink-0">
        {game.backgroundImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.backgroundImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
            <span className="text-2xl font-black text-indigo-300 select-none">
              {game.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Time chip — top right */}
        {timeColor && game.timeRecommendationMinutes && (
          <div className={`absolute top-1.5 right-1.5 ${timeColor} text-white text-xs font-bold px-1.5 py-0.5 rounded-full`}>
            {game.timeRecommendationMinutes}m
          </div>
        )}

        {/* ESRB — bottom left */}
        {game.esrbRating && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded">
            {game.esrbRating}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-indigo-700 transition-colors">
          {game.title}
        </p>

        <div className="flex items-center gap-1 flex-wrap">
          {game.genres[0] && (
            <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
              {game.genres[0]}
            </span>
          )}
          {game.esrbRating && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${ESRB_COLORS[game.esrbRating] ?? 'bg-slate-100 text-slate-600'}`}>
              {game.esrbRating}
            </span>
          )}
        </div>

        {/* Scores row */}
        {(game.bds != null || game.ris != null) && (
          <div className="flex items-center gap-1 mt-auto pt-1">
            {game.bds != null && (
              <ScorePip label="Benefit Score" value={game.bds} color="bg-emerald-100 text-emerald-800" />
            )}
            {game.ris != null && (
              <ScorePip label="Risk Score" value={game.ris} color={
                game.ris < 0.3 ? 'bg-emerald-100 text-emerald-800' :
                game.ris < 0.6 ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-700'
              } />
            )}
            {/* Monetization flags */}
            {(game.hasLootBoxes || game.hasMicrotransactions) && (
              <span className="ml-auto text-xs text-amber-600" title="Has monetization">💰</span>
            )}
          </div>
        )}

        {/* Metacritic fallback when no scores */}
        {game.bds == null && game.metacriticScore != null && (
          <div className="mt-auto pt-1 flex items-center justify-between">
            <span className="text-xs text-slate-400">Metacritic</span>
            <span className="text-xs font-bold text-slate-600">{game.metacriticScore}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
