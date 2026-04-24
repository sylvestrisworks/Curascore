import Link from 'next/link'

function relativeDate(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1)  return 'today'
  if (diffDays < 7)  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  if (diffDays < 60) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  }
  return new Date(iso).toLocaleDateString('en', { month: 'short', year: 'numeric' })
}

type Props = {
  calculatedAt: string
  methodologyVersion: string | null
  updatedAt: string | null
  locale: string
}

export function ScoreMetaLine({ calculatedAt, methodologyVersion, updatedAt, locale }: Props) {
  const scoredLabel   = relativeDate(calculatedAt)
  const updatedLabel  = updatedAt ? relativeDate(updatedAt) : null

  return (
    <p className="text-[13px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
      Scored {scoredLabel}
      {methodologyVersion && (
        <>
          {' · '}
          <Link
            href={`/${locale}/methodology?version=${methodologyVersion}`}
            className="hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 decoration-slate-300 dark:decoration-slate-600 transition-colors"
          >
            Methodology v{methodologyVersion}
          </Link>
        </>
      )}
      {updatedLabel && (
        <>{' · '}Last updated {updatedLabel}</>
      )}
    </p>
  )
}
