export const revalidate = 3600

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { eq, and, desc, asc, isNotNull, lte, gte, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { games, gameScores, platformExperiences, experienceScores } from '@/lib/db/schema'
import PlatformExperienceCard, { type PlatformExperienceSummary } from '@/components/PlatformExperienceCard'
import PlatformScoreHistogram, { type HistogramBucket } from '@/components/PlatformScoreHistogram'
import CarouselRow from '@/components/CarouselRow'
import type { GameSummary } from '@/types/game'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumikin.org'

// ─── UGC platform aliases ─────────────────────────────────────────────────────
const SLUG_ALIASES: Record<string, string> = {
  fortnite: 'fortnite-creative',
}
const DB_TO_URL: Record<string, string> = {
  'fortnite-creative': 'fortnite',
}

// ─── UGC platform styling ─────────────────────────────────────────────────────
const UGC_ACCENT: Record<string, string> = {
  roblox:              'from-red-950/95 via-red-900/70 to-slate-900/20',
  'fortnite-creative': 'from-indigo-950/95 via-indigo-900/70 to-slate-900/20',
}
const UGC_ICON_BG: Record<string, string> = {
  roblox:              'bg-red-600 ring-red-400/40',
  'fortnite-creative': 'bg-blue-600 ring-blue-400/40',
}

// ─── Traditional platform config ──────────────────────────────────────────────
type PlatformConfig = {
  name: string
  keyword: string       // matched against games.platforms JSON via ILIKE
  browseKey: string     // matches PLATFORM_KEYWORDS key in browse/page.tsx
  accent: string        // Tailwind gradient for hero
  iconBg: string        // Tailwind bg+ring for icon
  description: string   // short description for meta fallback
  editorial: string     // longer crawlable paragraph shown on the page
}

const TRADITIONAL_PLATFORMS: Record<string, PlatformConfig> = {
  playstation: {
    name: 'PlayStation',
    keyword: 'PlayStation',
    browseKey: 'PlayStation',
    accent: 'from-blue-950/95 via-blue-900/70 to-slate-900/20',
    iconBg: 'bg-blue-700 ring-blue-400/40',
    description: 'LumiKin safety scores for PlayStation 4 and PlayStation 5 games.',
    editorial: 'PlayStation 4 and PS5 span everything from calm puzzle games to intense online multiplayer. Many great titles are available through PS Plus, but the subscription pressure and online exposure varies widely across the catalogue. LumiKin scores make it easy to find which PlayStation games are genuinely worth your child\'s time — and which ones come with hidden costs or engagement traps.',
  },
  xbox: {
    name: 'Xbox',
    keyword: 'Xbox',
    browseKey: 'Xbox',
    accent: 'from-green-950/95 via-green-900/70 to-slate-900/20',
    iconBg: 'bg-green-700 ring-green-400/40',
    description: 'LumiKin safety scores for Xbox One, Xbox Series S and Series X games.',
    editorial: 'Xbox One and Xbox Series S|X are home to hundreds of titles available through Xbox Game Pass, making it one of the most accessible platforms for families. LumiKin scores help you navigate the catalog quickly — sorting by safest picks or family co-op highlights lets you build a trusted game list without playing every title yourself.',
  },
  'nintendo-switch': {
    name: 'Nintendo Switch',
    keyword: 'Nintendo Switch',
    browseKey: 'Switch',
    accent: 'from-red-950/95 via-red-900/70 to-slate-900/20',
    iconBg: 'bg-red-600 ring-red-400/40',
    description: 'LumiKin safety scores for Nintendo Switch games.',
    editorial: 'Nintendo Switch has one of the most family-friendly first-party libraries of any console, with beloved franchises like Mario, Zelda, and Pokémon consistently earning high benefit scores. The platform is also easy to manage with built-in parental controls and screen time limits. LumiKin scores help you find the standout third-party games worth adding to your collection.',
  },
  ios: {
    name: 'iOS',
    keyword: 'iOS',
    browseKey: 'iOS',
    accent: 'from-sky-950/95 via-sky-900/70 to-slate-900/20',
    iconBg: 'bg-sky-600 ring-sky-400/40',
    description: 'LumiKin safety scores for iPhone and iPad games.',
    editorial: 'The App Store labels many games "free", but the real cost is often attention, in-app purchases, or intrusive ads. iOS games range from genuinely educational apps to highly optimized engagement loops. LumiKin scores flag monetization pressure and dopamine-trap mechanics so you can tell the difference before downloading.',
  },
  android: {
    name: 'Android',
    keyword: 'Android',
    browseKey: 'Android',
    accent: 'from-emerald-950/95 via-emerald-900/70 to-slate-900/20',
    iconBg: 'bg-emerald-600 ring-emerald-400/40',
    description: 'LumiKin safety scores for Android games.',
    editorial: 'Android gaming spans high-quality ports, indie gems, and heavily monetized free-to-play titles — often hard to tell apart from the Play Store listing alone. Google\'s content ratings cover subject matter, not design patterns. LumiKin scores go deeper, surfacing which games are built for benefit and which are built for maximum session length.',
  },
  pc: {
    name: 'PC',
    keyword: 'PC',
    browseKey: 'PC',
    accent: 'from-violet-950/95 via-violet-900/70 to-slate-900/20',
    iconBg: 'bg-violet-700 ring-violet-400/40',
    description: 'LumiKin safety scores for PC games on Steam, Epic Games, and more.',
    editorial: 'PC gaming offers the widest catalogue of any platform, from calm educational puzzlers to massive online worlds. Steam family controls and library sharing features help, but the sheer volume makes curation difficult. LumiKin scores sort the catalogue by benefit-to-risk ratio so you can build a quality family library without trial and error.',
  },
}

// ─── Game select + mapper ─────────────────────────────────────────────────────
const GAME_SELECT = {
  slug:                      games.slug,
  title:                     games.title,
  developer:                 games.developer,
  genres:                    games.genres,
  esrbRating:                games.esrbRating,
  backgroundImage:           games.backgroundImage,
  curascore:                 gameScores.curascore,
  calculatedAt:              gameScores.calculatedAt,
  timeRecommendationMinutes: gameScores.timeRecommendationMinutes,
  timeRecommendationColor:   gameScores.timeRecommendationColor,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGameSummary(r: any): GameSummary {
  return {
    slug:                      r.slug,
    title:                     r.title,
    developer:                 r.developer ?? null,
    genres:                    Array.isArray(r.genres) ? (r.genres as string[]) : [],
    esrbRating:                r.esrbRating ?? null,
    backgroundImage:           r.backgroundImage ?? null,
    curascore:                 r.curascore ?? null,
    calculatedAt:              r.calculatedAt ? new Date(r.calculatedAt).toISOString() : null,
    timeRecommendationMinutes: r.timeRecommendationMinutes ?? null,
    timeRecommendationColor:   (r.timeRecommendationColor ?? null) as 'green' | 'amber' | 'red' | null,
  }
}

// ─── Stats helper (shared by metadata + page) ────────────────────────────────
async function fetchPlatformStats(keyword: string) {
  const platformFilter = sql`${games.platforms}::text ILIKE ${'%' + keyword + '%'}`
  const [row] = await db
    .select({
      count:    sql<number>`count(${gameScores.id})::int`,
      avgScore: sql<number>`round(avg(${gameScores.curascore}))::int`,
    })
    .from(games)
    .innerJoin(gameScores, eq(gameScores.gameId, games.id))
    .where(and(isNotNull(gameScores.curascore), platformFilter))
  return { count: Number(row?.count ?? 0), avgScore: row?.avgScore ?? null }
}

type Props = { params: Promise<{ locale: string; slug: string }> }

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params

  const traditional = TRADITIONAL_PLATFORMS[slug]
  if (traditional) {
    const { count, avgScore } = await fetchPlatformStats(traditional.keyword)
    const description = count > 0 && avgScore != null
      ? `Browse ${count} rated ${traditional.name} games for kids. Average LumiScore ${avgScore}/100. Find safe ${traditional.name} picks for your family on LumiKin.`
      : traditional.description
    const ogImage = `/api/og/platform/${slug}`
    return {
      title: `${traditional.name} Games for Kids — LumiKin`,
      description,
      alternates: { canonical: `/${locale}/platform/${slug}` },
      openGraph: {
        title: `${traditional.name} Games — LumiKin`,
        description,
        type: 'website',
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${traditional.name} Games — LumiKin`,
        description,
        images: [ogImage],
      },
    }
  }

  const dbSlug = SLUG_ALIASES[slug] ?? slug
  const [platform] = await db
    .select({ title: games.title })
    .from(games)
    .where(eq(games.slug, dbSlug))
    .limit(1)

  if (!platform) return {}
  return {
    title: `${platform.title} Hub — LumiKin`,
    description: `LumiKin safety scores for ${platform.title} experiences. Browse ratings by score, find the safest picks, and see what to watch out for.`,
    alternates: { canonical: `/${locale}/platform/${slug}` },
  }
}

// ─── Static params ────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const ugcPlatforms = await db
    .select({ slug: games.slug })
    .from(games)
    .where(eq(games.contentType, 'platform'))

  const locales = ['en', 'es', 'fr', 'sv', 'de']
  const ugcSlugs = ugcPlatforms.map(p => DB_TO_URL[p.slug] ?? p.slug)
  const traditionalSlugs = Object.keys(TRADITIONAL_PLATFORMS)
  const allSlugs = [...ugcSlugs, ...traditionalSlugs]

  return locales.flatMap(locale =>
    allSlugs.map(slug => ({ locale, slug }))
  )
}

// ─── UGC platform helpers ─────────────────────────────────────────────────────
function toExperienceSummary(
  exp: typeof platformExperiences.$inferSelect,
  score: typeof experienceScores.$inferSelect | null,
): PlatformExperienceSummary {
  return {
    slug:                      exp.slug,
    title:                     exp.title,
    thumbnailUrl:              exp.thumbnailUrl,
    creatorName:               exp.creatorName,
    activePlayers:             exp.activePlayers,
    curascore:                 score?.curascore ?? null,
    timeRecommendationMinutes: score?.timeRecommendationMinutes ?? null,
    recommendedMinAge:         score?.recommendedMinAge ?? null,
    strangerRisk:              score?.strangerRisk ?? null,
    monetizationScore:         score?.monetizationScore ?? null,
  }
}

function ExperienceGrid({
  experiences,
  locale,
  platformSlug,
}: {
  experiences: PlatformExperienceSummary[]
  locale: string
  platformSlug: string
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
      {experiences.map(exp => (
        <div key={exp.slug} className="snap-start shrink-0 w-44 sm:w-auto">
          <PlatformExperienceCard exp={exp} locale={locale} platformSlug={platformSlug} />
        </div>
      ))}
    </div>
  )
}

// ─── Traditional platform page ────────────────────────────────────────────────
async function TraditionalPlatformPage({
  slug,
  locale,
  config,
}: {
  slug: string
  locale: string
  config: PlatformConfig
}) {
  const platformFilter = sql`${games.platforms}::text ILIKE ${'%' + config.keyword + '%'}`
  const base = and(isNotNull(gameScores.curascore), platformFilter)

  const [
    [statsRow],
    bucketRows,
    topRated,
    safest,
    forKids,
    coop,
    recent,
  ] = await Promise.all([
    db.select({
      count:    sql<number>`count(${gameScores.id})::int`,
      avgScore: sql<number>`round(avg(${gameScores.curascore}))::int`,
    })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base),

    db.select({
      bucket: sql<number>`floor(${gameScores.curascore} / 10) * 10`,
      count:  sql<number>`count(*)::int`,
    })
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base)
      .groupBy(sql`floor(${gameScores.curascore} / 10) * 10`)
      .orderBy(sql`floor(${gameScores.curascore} / 10) * 10`),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base)
      .orderBy(desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(base, lte(gameScores.ris, 0.25)))
      .orderBy(asc(gameScores.ris), desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(base, inArray(games.esrbRating, ['E', 'E10+'])))
      .orderBy(desc(gameScores.bds), desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(and(base, gte(gameScores.socialEmotionalScore, 0.5)))
      .orderBy(desc(gameScores.socialEmotionalScore), desc(gameScores.curascore))
      .limit(12),

    db.select(GAME_SELECT)
      .from(games)
      .innerJoin(gameScores, eq(gameScores.gameId, games.id))
      .where(base)
      .orderBy(desc(gameScores.calculatedAt))
      .limit(12),
  ])

  const scoredCount = Number(statsRow?.count ?? 0)
  const avgScore    = statsRow?.avgScore ?? null
  const buckets     = bucketRows as HistogramBucket[]
  const b           = `/${locale}/browse?platforms=${config.browseKey}`

  const carouselRows = [
    { id: 'top',    title: 'Top Rated',          iconName: 'topscore', browseHref: `${b}&sort=curascore`,    games: topRated.map(toGameSummary) },
    { id: 'safest', title: 'Safest Picks',        iconName: 'family',   browseHref: `${b}&sort=safest`,       games: safest.map(toGameSummary)   },
    { id: 'kids',   title: 'Best for Young Kids', iconName: 'beginner', browseHref: `${b}&age=E10`,           games: forKids.map(toGameSummary)  },
    { id: 'coop',   title: 'Great Co-op',         iconName: 'family',   browseHref: `${b}&benefits=teamwork`, games: coop.map(toGameSummary)     },
    { id: 'recent', title: 'Recently Scored',     iconName: 'new',      browseHref: `${b}&sort=newest`,       games: recent.map(toGameSummary)   },
  ].filter(r => r.games.length >= 3)

  // JSON-LD: CollectionPage + ItemList of top games
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${config.name} Games for Kids — LumiKin`,
    description: config.description,
    url: `${SITE_URL}/${locale}/platform/${slug}`,
    mainEntity: {
      '@type': 'ItemList',
      name: `Top Rated ${config.name} Games`,
      numberOfItems: Math.min(topRated.length, 10),
      itemListElement: topRated.slice(0, 10).map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: r.title,
        url: `${SITE_URL}/${locale}/game/${r.slug}`,
      })),
    },
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-900">
          <div className={`absolute inset-0 bg-gradient-to-r ${config.accent}`} />
          <div className="relative px-6 py-8 flex items-center gap-5">
            <div className={`w-[72px] h-[72px] rounded-2xl ${config.iconBg} ring-2 flex items-center justify-center shrink-0 shadow-lg`}>
              <span className="text-3xl font-black text-white select-none">
                {config.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] font-semibold bg-white/10 text-white/70 border border-white/20 px-2 py-0.5 rounded-full tracking-wide uppercase">
                  Platform
                </span>
                {avgScore != null && (
                  <span className="text-[11px] font-bold bg-white/10 border border-white/20 text-white/80 px-2 py-0.5 rounded-full">
                    Avg LumiScore {avgScore}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">{config.name}</h1>
              <p className="text-sm text-white/70 mt-1">{config.description}</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                  <span className="text-base font-bold text-white">{scoredCount}</span>
                  <span className="text-xs text-white/50 ml-1">rated</span>
                </div>
                <Link
                  href={`/${locale}/browse?platforms=${config.browseKey}`}
                  className="text-xs font-semibold text-white/80 hover:text-white border border-white/20 hover:border-white/40 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl transition-colors"
                >
                  Browse all →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Score distribution */}
        {scoredCount > 0 && <PlatformScoreHistogram buckets={buckets} />}

        {scoredCount === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            No scored games yet for this platform. Check back soon.
          </div>
        )}

        {/* Editorial intro — crawlable context for search engines */}
        {scoredCount > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {config.editorial}
          </p>
        )}

        {/* Carousels */}
        {carouselRows.length > 0 && (
          <div className="pb-4">
            {carouselRows.map((row, i) => (
              <CarouselRow
                key={row.id}
                index={i}
                iconName={row.iconName}
                title={row.title}
                browseHref={row.browseHref}
                games={row.games}
              />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}

// ─── UGC platform page (unchanged logic) ─────────────────────────────────────
export default async function PlatformHubPage({ params }: Props) {
  const { locale, slug } = await params

  // Traditional gaming platform
  const traditional = TRADITIONAL_PLATFORMS[slug]
  if (traditional) {
    return <TraditionalPlatformPage slug={slug} locale={locale} config={traditional} />
  }

  // UGC platform (Roblox, Fortnite Creative, etc.)
  const dbSlug = SLUG_ALIASES[slug] ?? slug

  const [
    platformRows,
    [statsRow],
    bucketRows,
    topRows,
    bottomRows,
    recentRows,
  ] = await Promise.all([
    db
      .select({
        id:              games.id,
        slug:            games.slug,
        title:           games.title,
        description:     games.description,
        backgroundImage: games.backgroundImage,
        esrbRating:      games.esrbRating,
        pegiRating:      games.pegiRating,
        contentType:     games.contentType,
      })
      .from(games)
      .where(eq(games.slug, dbSlug))
      .limit(1),

    db
      .select({
        count:    sql<number>`count(${experienceScores.id})::int`,
        avgScore: sql<number>`round(avg(${experienceScores.curascore}))::int`,
        minScore: sql<number>`min(${experienceScores.curascore})`,
        maxScore: sql<number>`max(${experienceScores.curascore})`,
      })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore))),

    db
      .select({
        bucket: sql<number>`floor(${experienceScores.curascore} / 10) * 10`,
        count:  sql<number>`count(*)::int`,
      })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .groupBy(sql`floor(${experienceScores.curascore} / 10) * 10`)
      .orderBy(sql`floor(${experienceScores.curascore} / 10) * 10`),

    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(desc(experienceScores.curascore))
      .limit(10),

    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(asc(experienceScores.curascore))
      .limit(10),

    db
      .select({ exp: platformExperiences, score: experienceScores })
      .from(experienceScores)
      .innerJoin(platformExperiences, eq(platformExperiences.id, experienceScores.experienceId))
      .innerJoin(games, eq(games.id, platformExperiences.platformId))
      .where(and(eq(games.slug, dbSlug), isNotNull(experienceScores.curascore)))
      .orderBy(desc(experienceScores.calculatedAt))
      .limit(10),
  ])

  const platform = platformRows[0]
  if (!platform || platform.contentType !== 'platform') notFound()

  const buckets = bucketRows as HistogramBucket[]
  const topExperiences    = topRows.map(r    => toExperienceSummary(r.exp, r.score))
  const bottomExperiences = bottomRows.map(r => toExperienceSummary(r.exp, r.score))
  const recentExperiences = recentRows.map(r => toExperienceSummary(r.exp, r.score))

  const scoredCount = Number(statsRow?.count ?? 0)
  const avgScore    = statsRow?.avgScore ?? null
  const accent      = UGC_ACCENT[dbSlug] ?? 'from-slate-950/95 via-slate-900/70 to-slate-900/20'
  const iconBg      = UGC_ICON_BG[dbSlug] ?? 'bg-indigo-600 ring-indigo-400/40'
  const initials    = platform.title.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Platform hero */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-900">
          {platform.backgroundImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={platform.backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className={`absolute inset-0 bg-gradient-to-r ${accent}`} />
          <div className="relative px-6 py-8 flex items-center gap-5">
            <div className={`w-[72px] h-[72px] rounded-2xl ${iconBg} ring-2 flex items-center justify-center shrink-0 shadow-lg`}>
              <span className="text-3xl font-black text-white select-none">{initials}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] font-semibold bg-white/10 text-white/70 border border-white/20 px-2 py-0.5 rounded-full tracking-wide uppercase">
                  Platform
                </span>
                {avgScore != null && (
                  <span className="text-[11px] font-bold bg-white/10 border border-white/20 text-white/80 px-2 py-0.5 rounded-full">
                    Avg LumiScore {avgScore}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">{platform.title}</h1>
              {platform.description && (
                <p className="text-sm text-white/70 mt-1 line-clamp-2">{platform.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                  <span className="text-base font-bold text-white">{scoredCount}</span>
                  <span className="text-xs text-white/50 ml-1">rated</span>
                </div>
                {platform.esrbRating && (
                  <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-white/60">ESRB {platform.esrbRating}</span>
                  </div>
                )}
                {platform.pegiRating && (
                  <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-white/60">PEGI {platform.pegiRating}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score distribution histogram */}
        {scoredCount > 0 && (
          <PlatformScoreHistogram buckets={buckets} />
        )}

        {scoredCount === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            No scored experiences yet. Check back soon.
          </div>
        )}

        {/* Top rated */}
        {topExperiences.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Top Rated
            </h2>
            <ExperienceGrid
              experiences={topExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

        {/* Lowest rated */}
        {bottomExperiences.length > 0 && scoredCount >= 4 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Lowest Rated
            </h2>
            <ExperienceGrid
              experiences={bottomExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

        {/* Recently scored */}
        {recentExperiences.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Recently Scored
            </h2>
            <ExperienceGrid
              experiences={recentExperiences}
              locale={locale}
              platformSlug={dbSlug}
            />
          </section>
        )}

      </main>
    </div>
  )
}
