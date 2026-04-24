'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type FeedbackT = ReturnType<typeof useTranslations<'feedback'>>

const FEEDBACK_TYPE_KEYS: Array<{ value: string; labelKey: Parameters<FeedbackT>[0] }> = [
  { value: 'too_high',     labelKey: 'typeTooHigh'  },
  { value: 'too_low',      labelKey: 'typeTooLow'   },
  { value: 'outdated',     labelKey: 'typeOutdated' },
  { value: 'missing_info', labelKey: 'typeMissing'  },
  { value: 'other',        labelKey: 'typeOther'    },
]

type FeedbackType = typeof FEEDBACK_TYPE_KEYS[number]['value']

export default function FeedbackForm({ gameSlug }: { gameSlug: string }) {
  const t = useTranslations('feedback')
  const [open, setOpen]       = useState(false)
  const [type, setType]       = useState<FeedbackType | ''>('')
  const [comment, setComment] = useState('')
  const [state, setState]     = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!type) return
    setState('submitting')
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gameSlug, type, comment: comment.trim() || undefined }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-400 hover:text-indigo-600 transition-colors underline underline-offset-2"
      >
        {t('triggerLabel')}
      </button>
    )
  }

  if (state === 'done') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-sm text-emerald-800">
        {t('thanks')}
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{t('title')}</h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Type selector */}
        <div className="flex flex-col gap-2">
          {FEEDBACK_TYPE_KEYS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="feedback-type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
                className="text-indigo-600 focus:ring-indigo-400"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">{t(opt.labelKey)}</span>
            </label>
          ))}
        </div>

        {/* Optional comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={1000}
          rows={3}
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none
            focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
        />

        {state === 'error' && (
          <p className="text-xs text-red-600">{t('errorRetry')}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!type || state === 'submitting'}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state === 'submitting' ? t('submitting') : t('submit')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {t('cancel')}
          </button>
          <span className="ml-auto text-xs text-slate-400">{t('anonymous')}</span>
        </div>
      </form>
    </div>
  )
}
