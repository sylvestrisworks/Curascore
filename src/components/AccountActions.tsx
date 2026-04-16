'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'

export default function AccountActions() {
  const t = useTranslations('account')
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await signOut({ callbackUrl: '/' })
    } catch {
      setError(t('deleteError'))
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sign out */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4">
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <LogOut size={15} strokeWidth={2.5} />
          {t('signOut')}
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-red-500 uppercase tracking-widest">{t('dangerZone')}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('deleteWarning')}</p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            {t('deleteAccount')}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t('deleteConfirmPrompt')}</p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {deleting ? t('deleting') : t('confirmDelete')}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
