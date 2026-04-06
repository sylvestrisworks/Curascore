'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Ban, Users, Timer, Brain, Star, Leaf, BookOpen } from 'lucide-react'
import GameCompactCard from './GameCompactCard'
import type { GameSummary } from '@/types/game'

// ─── Config ───────────────────────────────────────────────────────────────────

const AGE_SEGMENTS = [
  { label: '5–7',   value: 'E',   esrb: 'E'    },
  { label: '8–10',  value: 'E10', esrb: 'E10+' },
  { label: '11–13', value: 'T',   esrb: 'T'    },
  { label: '14+',   value: 'M',   esrb: 'M'    },
]

const CATEGORY_PILLS = [
  { icon: Brain,    emoji: '🧩', label: 'High Brain Power',        href: '/browse?benefits=problem-solving' },
  { icon: Ban,      emoji: '🛑', label: 'Zero Microtransactions',   href: '/browse?price=free'               },
  { icon: Users,    emoji: '🛋️', label: 'Couch Co-op',             href: '/browse?genres=Co-op'             },
  { icon: Timer,    emoji: '⏱️', label: 'Short Sessions',          href: '/browse?time=30'                  },
  { icon: Sparkles, emoji: '🎨', label: 'Creative Play',           href: '/browse?genres=Sandbox'           },
  { icon: Star,     emoji: '🏆', label: 'Top Rated',               href: '/browse?sort=curascore'           },
  { icon: Leaf,     emoji: '🌱', label: 'Great for Young Kids',    href: '/browse?age=E'                    },
  { icon: BookOpen, emoji: '🧠', label: 'Learning Focus',          href: '/browse?benefits=problem-solving' },
]

// ─── Safe Swap spotlight data (static/curated) ────────────────────────────────

const SWAP = {
  from: {
    title:     'Roblox',
    genre:     'Social / User-Generated',
    curascore: 28,
    reason:    'Heavy microtransactions & unmoderated social risk',
    href:      '/game/roblox',
  },
  to: {
    title:     'Dragon Quest Builders 2',
    genre:     'Sandbox / Creative',
    curascore: 84,
    reason:    'Same creative sandbox energy, no spending pressure',
    href:      '/game/dragon-quest-builders-2',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function curascoreGradient(score: number) {
  if (score >= 70) return 'from-emerald-400 to-teal-500'
  if (score >= 40) return 'from-amber-400 to-orange-500'
  return 'from-red-400 to-rose-500'
}

function curascoreBg(score: number) {
  if (score >= 70) return 'bg-emerald-50 border-emerald-200'
  if (score >= 40) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-black tracking-tight rounded-xl transition-all duration-200 ${
        active
          ? 'bg-white text-blue-600 shadow-sm shadow-blue-100'
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {label}
    </button>
  )
}

function CategoryPill({ emoji, label, href, active, onClick }: {
  emoji: string; label: string; href: string
  active: boolean; onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold
        border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm
        ${active
          ? 'bg-indigo-100 border-indigo-200 text-indigo-700 -translate-y-0.5 shadow-sm'
          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
        }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </Link>
  )
}

function PlaceholderCard({ rank }: { rank: number }) {
  const colors = [
    { bg: 'from-violet-400 to-indigo-500', score: 87, title: 'Portal 2',           genre: 'Puzzle',          time: '60 min/day' },
    { bg: 'from-teal-400 to-emerald-500',  score: 91, title: 'Minecraft',           genre: 'Sandbox',         time: '60 min/day' },
    { bg: 'from-amber-400 to-orange-500',  score: 73, title: 'Mario Kart 8 Deluxe', genre: 'Racing',          time: '90 min/day' },
  ][rank] ?? { bg: 'from-slate-400 to-slate-500', score: 0, title: '—', genre: '—', time: '—' }

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
      <div className={`h-32 bg-gradient-to-br ${colors.bg} relative`}>
        <span className={`absolute top-3 right-3 text-xs font-black px-2.5 py-1 rounded-full
          ${colors.score >= 70 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
          {colors.score}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <p className="font-black tracking-tight text-slate-900">{colors.title}</p>
        <p className="text-xs text-slate-400 font-medium">{colors.genre}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">{colors.time}</span>
          <span className="text-xs font-semibold text-indigo-600">View →</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Props = {
  topGames?: GameSummary[]
}

export default function GameDiscoveryDashboard({ topGames = [] }: Props) {
  const [activeAge, setActiveAge]          = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── 1. HEADER ────────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-1">
              Grounded in child development
            </p>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
              Discover Safe Games
            </h1>
          </div>

          {/* Age segmented control */}
          <div className="bg-gray-100 rounded-2xl p-1.5 flex gap-1">
            {AGE_SEGMENTS.map((seg) => (
              <AgePill
                key={seg.value}
                label={seg.label}
                active={activeAge === seg.value}
                onClick={() => setActiveAge(activeAge === seg.value ? null : seg.value)}
              />
            ))}
          </div>
        </div>

        {/* ── 2. CATEGORY PILLS ────────────────────────────────────────────────── */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {CATEGORY_PILLS.map((pill) => (
            <CategoryPill
              key={pill.label}
              emoji={pill.emoji}
              label={pill.label}
              href={pill.href}
              active={activeCategory === pill.label}
              onClick={() => setActiveCategory(activeCategory === pill.label ? null : pill.label)}
            />
          ))}
        </div>

        {/* ── 3. SAFE SWAP SPOTLIGHT ───────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 pt-5 pb-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
              Safe Swap
            </p>
            <p className="text-lg font-black tracking-tight text-slate-800">
              Is your child asking for{' '}
              <span className="text-red-500">{SWAP.from.title}</span>?
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
            {/* From */}
            <div className="bg-red-50/60 p-5 space-y-3">
              <div className={`inline-flex items-baseline gap-1 px-3 py-1 rounded-2xl border ${curascoreBg(SWAP.from.curascore)}`}>
                <span className={`text-3xl font-black tracking-tighter bg-gradient-to-br ${curascoreGradient(SWAP.from.curascore)} bg-clip-text text-transparent`}>
                  {SWAP.from.curascore}
                </span>
                <span className="text-sm text-slate-400 font-bold">/100</span>
              </div>
              <div>
                <p className="font-black tracking-tight text-slate-900">{SWAP.from.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{SWAP.from.genre}</p>
              </div>
              <p className="text-xs text-red-600 leading-snug">{SWAP.from.reason}</p>
            </div>

            {/* To */}
            <div className="bg-emerald-50/60 p-5 space-y-3">
              <div className={`inline-flex items-baseline gap-1 px-3 py-1 rounded-2xl border ${curascoreBg(SWAP.to.curascore)}`}>
                <span className={`text-3xl font-black tracking-tighter bg-gradient-to-br ${curascoreGradient(SWAP.to.curascore)} bg-clip-text text-transparent`}>
                  {SWAP.to.curascore}
                </span>
                <span className="text-sm text-slate-400 font-bold">/100</span>
              </div>
              <div>
                <p className="font-black tracking-tight text-slate-900">{SWAP.to.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{SWAP.to.genre}</p>
              </div>
              <p className="text-xs text-emerald-700 leading-snug">{SWAP.to.reason}</p>
            </div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between border-t border-gray-100">
            <p className="text-xs text-slate-400">Same creative appeal — much safer by the numbers</p>
            <Link
              href={SWAP.to.href}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
            >
              View Details <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* ── 4. DISCOVERY GRID ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black tracking-tight text-slate-900">
              {activeAge
                ? `Top games for ages ${AGE_SEGMENTS.find(s => s.value === activeAge)?.label}`
                : 'Top rated games'}
            </h2>
            <Link href="/browse" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
              See all <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>

          {topGames.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {topGames.slice(0, 6).map((game) => (
                <div
                  key={game.slug}
                  className="hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <GameCompactCard game={game} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <PlaceholderCard rank={i} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 5. FOOTER CTA ────────────────────────────────────────────────────── */}
        <div className="bg-indigo-600 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-black tracking-tight text-lg">500+ games rated</p>
            <p className="text-indigo-200 text-sm mt-0.5">Grounded in child development research</p>
          </div>
          <Link
            href="/browse"
            className="shrink-0 bg-white text-indigo-700 font-black text-sm px-6 py-3 rounded-2xl hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            Browse all games <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>

      </div>
    </div>
  )
}
