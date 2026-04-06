'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { SerializedScores, SerializedReview } from '@/types/game'

type Props = {
  scores: SerializedScores
  review: SerializedReview | null
}

const AXES = [
  { key: 'addictive',      label: 'Addictive Design'   },
  { key: 'monetization',   label: 'Monetization'        },
  { key: 'social',         label: 'Social / Emotional'  },
  { key: 'accessibility',  label: 'Accessibility Risk'  },
  { key: 'endless',        label: 'Endless Design'      },
]

function r5Normalized(review: SerializedReview | null): number {
  if (!review) return 0
  const total =
    (review.r5CrossPlatform   ?? 0) +
    (review.r5LoadTime        ?? 0) +
    (review.r5MobileOptimized ?? 0) +
    (review.r5LoginBarrier    ?? 0)
  return total / 12
}

function r6Normalized(review: SerializedReview | null): number {
  if (!review) return 0
  const total =
    (review.r6InfiniteGameplay    ?? 0) +
    (review.r6NoStoppingPoints    ?? 0) +
    (review.r6NoGameOver          ?? 0) +
    (review.r6NoChapterStructure  ?? 0)
  return total / 12
}

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; value: number } }> }) {
  if (!active || !payload?.length) return null
  const { label, value } = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-slate-500">{Math.round(value * 100)}/100</p>
    </div>
  )
}

export default function RiskRadarChart({ scores, review }: Props) {
  const data = [
    { key: 'addictive',     label: 'Addictive Design',  value: scores.dopamineRisk     ?? 0, baseline: 0.2 },
    { key: 'monetization',  label: 'Monetization',       value: scores.monetizationRisk ?? 0, baseline: 0.2 },
    { key: 'social',        label: 'Social / Emotional', value: scores.socialRisk       ?? 0, baseline: 0.2 },
    { key: 'accessibility', label: 'Accessibility Risk', value: scores.accessibilityRisk ?? r5Normalized(review), baseline: 0.2 },
    { key: 'endless',       label: 'Endless Design',     value: scores.endlessDesignRisk ?? r6Normalized(review), baseline: 0.2 },
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
        Risk Profile Shape
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Axes 1–3 feed into the time recommendation. Accessibility &amp; Endless Design are context only.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          {/* Safe baseline polygon */}
          <Radar
            name="baseline"
            dataKey="baseline"
            stroke="#cbd5e1"
            fill="#f1f5f9"
            fillOpacity={0.8}
            isAnimationActive={false}
          />
          {/* Actual risk polygon */}
          <Radar
            name="risk"
            dataKey="value"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.25}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
