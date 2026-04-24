import { Link } from '@/navigation'
import { curascoreText, esrbToAge, ageBadgeColor } from '@/lib/ui'
import type { RelatedGame } from '@/lib/related-games'

type Props = { game: RelatedGame }

export function RelatedGameCard({ game }: Props) {
  return (
    <Link
      href={`/game/${game.slug}`}
      className="group flex items-center justify-between gap-4 py-3 rounded-lg -mx-2 px-2 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[15px] text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
          {game.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {game.platforms.slice(0, 2).map(p => (
            <span
              key={p}
              className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-medium"
            >
              {p}
            </span>
          ))}
          {game.esrbRating && (
            <span className={`text-[11px] text-white font-bold px-1.5 py-0.5 rounded ${ageBadgeColor(game.esrbRating)}`}>
              {esrbToAge(game.esrbRating)}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right leading-none">
        <span className={`text-[28px] font-black tabular-nums ${curascoreText(game.curascore)}`}>
          {game.curascore}
        </span>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">/100</p>
      </div>
    </Link>
  )
}
