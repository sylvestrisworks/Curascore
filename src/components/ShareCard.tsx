'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Share2, X, Check, Users, Gamepad2 } from 'lucide-react'
import type { GameCardProps } from '@/types/game'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(minutes: number | null | undefined): string {
  if (!minutes) return '—'
  if (minutes >= 120) return '2+ Hrs / Day'
  if (minutes === 90) return '1.5 Hrs / Day'
  if (minutes === 60) return '1 Hr / Day'
  return `${minutes} Min / Day`
}

function risInfo(ris: number | null | undefined): { label: string; color: string; sub: string } {
  const v = ris ?? 0
  if (v < 0.3) return { label: 'Low',      color: 'text-green-500',  sub: 'Minimal Pressure' }
  if (v < 0.6) return { label: 'Moderate', color: 'text-yellow-500', sub: 'Some Pressure'    }
  return              { label: 'High',     color: 'text-red-500',    sub: 'High Pressure'    }
}

// 5-dot row indicator
function DotRow({ filled }: { filled: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`w-3.5 h-3.5 rounded-full ${i < filled ? 'bg-black' : 'border-2 border-black'}`} />
      ))}
    </div>
  )
}

// ─── For Parents: Nutrition Label ─────────────────────────────────────────────

function NutritionLabel({ data }: { data: GameCardProps }) {
  const { game, scores, review } = data
  const curascore   = scores?.curascore ?? null
  const topBenefits = scores?.topBenefits ?? []
  const risk        = risInfo(scores?.ris)

  const enrichmentLabel =
    curascore == null ? '' :
    curascore >= 70   ? 'High Cognitive Enrichment' :
    curascore >= 40   ? 'Moderate Enrichment' :
                        'Low Enrichment'

  const topSkills = topBenefits.slice(0, 5).map(b => ({
    label: b.skill,
    dots:  Math.min(Math.round((b.score / b.maxScore) * 5), 5),
  }))

  return (
    <div
      className="bg-white max-w-sm w-full p-4 md:p-5"
      style={{
        border: '2px solid black',
        boxShadow: '8px 8px 0px rgba(0,0,0,0.1)',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Header */}
      <header className="mb-3">
        <h1 className="text-3xl font-black uppercase leading-none tracking-tight mb-0.5">{game.title}</h1>
        {game.developer && (
          <h2 className="text-sm font-bold text-gray-600 mb-2">{game.developer.toUpperCase()}</h2>
        )}
        <div className="flex flex-wrap gap-1.5">
          {game.genres.slice(0, 3).map(g => (
            <span key={g} className="border-2 border-black rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">{g}</span>
          ))}
        </div>
      </header>

      {/* Serving */}
      <div className="border-t-[10px] border-black pt-2 pb-2 flex justify-between items-end">
        <h3 className="text-sm font-black uppercase">Recommended Serving</h3>
        <span className="text-sm font-black text-green-600 uppercase">{formatTime(scores?.timeRecommendationMinutes)}</span>
      </div>

      {/* Curascore + Risk */}
      <div className="border-t-4 border-black border-b-[6px] border-b-black py-3 grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center justify-center text-center border-r-2 border-black px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Growth Value</span>
          <div className="text-5xl font-black text-blue-600 tracking-tighter">
            {curascore ?? '—'}<span className="text-xl text-black">/100</span>
          </div>
          <span className="text-[10px] font-semibold uppercase mt-1 text-gray-700">{enrichmentLabel}</span>
        </div>
        <div className="flex flex-col items-center justify-center text-center px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Addictive Hooks</span>
          <div className={`text-4xl font-black uppercase tracking-tighter ${risk.color}`}>{risk.label}</div>
          <span className="text-[10px] font-semibold uppercase mt-1 text-gray-700">{risk.sub}</span>
        </div>
      </div>

      {/* % Daily Dev Value */}
      {topSkills.length > 0 && (
        <div className="py-2">
          <h3 className="text-[10px] font-black uppercase text-right mb-1.5 border-b-2 border-black pb-1">% Daily Dev Value *</h3>
          {topSkills.map(s => (
            <div key={s.label} className="flex justify-between items-center py-1 border-b border-gray-200 last:border-0">
              <span className="font-bold text-gray-800 text-sm">{s.label}</span>
              <DotRow filled={s.dots} />
            </div>
          ))}
        </div>
      )}

      {/* Active Ingredients */}
      {(review?.benefitsNarrative || topBenefits.length > 0) && (
        <div className="border-t-[6px] border-black pt-2 mt-1">
          <h3 className="text-[10px] font-black uppercase mb-1.5">Active Ingredients</h3>
          <p className="text-xs text-gray-800 leading-snug">
            {review?.benefitsNarrative ?? `Contains: ${topBenefits.slice(0, 3).map(b => b.skill).join(', ')}.`}
          </p>
        </div>
      )}

      {/* Parent Pro-Tip */}
      {review?.parentTip && (
        <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-md">
          <h4 className="font-bold text-yellow-800 text-[10px] uppercase tracking-wide mb-1">Parent Pro-Tip</h4>
          <p className="text-xs text-yellow-900 leading-snug">{review.parentTip}</p>
        </div>
      )}

      <p className="text-[9px] text-gray-400 text-center mt-3 uppercase tracking-widest">
        Curascore by Good Game Parent · curascore.com
      </p>
    </div>
  )
}

// ─── For Kids: Achievement Card ───────────────────────────────────────────────

const SKILL_EMOJI: Record<string, string> = {
  'Problem Solving':       '🧩',
  'Strategic Thinking':    '♟️',
  'Creativity':            '🎨',
  'Spatial Awareness':     '🗺️',
  'Teamwork':              '🤝',
  'Critical Thinking':     '💡',
  'Memory & Attention':    '🧠',
  'Communication':         '💬',
  'Empathy':               '❤️',
  'Hand-Eye Coordination': '🎯',
  'Reaction Time':         '⚡',
  'Reading / Language':    '📖',
  'Math & Systems':        '🔢',
}

function KidsCard({ data }: { data: GameCardProps }) {
  const { game, scores, review } = data
  const curascore   = scores?.curascore ?? null
  const timeMinutes = scores?.timeRecommendationMinutes
  const topBenefits = scores?.topBenefits ?? []

  const scoreGradient =
    curascore == null      ? 'from-slate-400 to-slate-500' :
    curascore >= 70        ? 'from-emerald-400 to-teal-500' :
    curascore >= 40        ? 'from-amber-400 to-orange-500' :
                             'from-red-400 to-rose-500'

  return (
    <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-5 max-w-sm w-full text-white relative overflow-hidden">
      {/* Background circles */}
      <div className="absolute top-0 right-0 w-52 h-52 bg-white/5 rounded-full -translate-y-20 translate-x-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-14 -translate-x-10 pointer-events-none" />

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-200 mb-0.5">I&apos;m playing</p>
        <h1 className="text-2xl font-black leading-tight mb-4">{game.title}</h1>

        {/* Score + Time */}
        <div className="flex items-end gap-4 mb-5">
          <div className={`bg-gradient-to-br ${scoreGradient} rounded-2xl p-3 shadow-lg min-w-[90px] text-center`}>
            <p className="text-[9px] font-bold uppercase text-white/80 mb-0.5">Curascore</p>
            <p className="text-5xl font-black leading-none">{curascore ?? '?'}</p>
            <p className="text-[9px] text-white/80">out of 100</p>
          </div>
          {timeMinutes && (
            <div className="text-center">
              <p className="text-5xl font-black leading-none">{timeMinutes >= 120 ? '120+' : timeMinutes}</p>
              <p className="text-xs font-semibold text-indigo-200 mt-0.5">min/day</p>
              <p className="text-[10px] text-indigo-300">screen time approved</p>
            </div>
          )}
        </div>

        {/* Skills */}
        {topBenefits.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-2">Skills I&apos;m building</p>
            <div className="flex flex-wrap gap-1.5">
              {topBenefits.slice(0, 4).map(b => (
                <span key={b.skill} className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                  {SKILL_EMOJI[b.skill] ?? '⭐'} {b.skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Benefit tip */}
        {review?.parentTipBenefits && (
          <div className="bg-white/15 rounded-2xl p-3 mb-4">
            <p className="text-xs leading-relaxed text-white/90 italic">{review.parentTipBenefits}</p>
          </div>
        )}

        {/* Stamp */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0">
            <Check size={12} className="text-indigo-600 stroke-[3]" />
          </div>
          <p className="text-[10px] text-indigo-200 font-semibold">Reviewed by Good Game Parent · curascore.com</p>
        </div>
      </div>
    </div>
  )
}

// ─── Share Button + Modal ─────────────────────────────────────────────────────

export default function ShareButton({ data }: { data: GameCardProps }) {
  const [open,     setOpen]     = useState(false)
  const [audience, setAudience] = useState<'parents' | 'kids'>('parents')
  const [copied,   setCopied]   = useState(false)
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  function handleShare() {
    const url = window.location.href
    if (typeof navigator.share !== 'undefined') {
      navigator.share({ title: `${data.game.title} — Good Game Parent`, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }).catch(() => {})
    }
  }

  if (!mounted) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors"
      >
        <Share2 size={16} />
        Share
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="font-bold text-slate-800">Share this review</h2>
                <p className="text-xs text-slate-500 mt-0.5">{data.game.title}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Audience toggle */}
            <div className="px-5 pt-4 pb-3 shrink-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Who are you sharing with?</p>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setAudience('parents')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    audience === 'parents'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users size={14} /> For Parents
                </button>
                <button
                  onClick={() => setAudience('kids')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    audience === 'kids'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Gamepad2 size={14} /> For Kids
                </button>
              </div>
            </div>

            {/* Card preview */}
            <div className="px-5 pb-5 flex justify-center">
              {audience === 'parents'
                ? <NutritionLabel data={data} />
                : <KidsCard data={data} />
              }
            </div>

            {/* Action bar */}
            <div className="border-t border-slate-100 px-5 py-4 shrink-0 mt-auto">
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition-all"
              >
                {copied
                  ? <><Check size={16} /> Link copied!</>
                  : <><Share2 size={16} /> Share this review</>
                }
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Shares a link to this game&apos;s full Curascore page
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
