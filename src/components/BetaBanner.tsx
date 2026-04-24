'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'lumikin_beta_dismissed'

export default function BetaBanner() {
  const t = useTranslations('banner')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-xl px-5 py-4 flex items-center gap-4 pointer-events-auto border border-slate-700">
        <span className="text-lg">🚧</span>
        <p className="flex-1 text-sm text-slate-200">
          <span className="font-semibold text-white">{t('betaTitle')}</span> &mdash; {t('betaBody')}{' '}
          <a
            href="/review/feedback"
            className="underline text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {t('shareFeedback')}
          </a>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
