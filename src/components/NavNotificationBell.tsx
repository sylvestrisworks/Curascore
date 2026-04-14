'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useLocale } from 'next-intl'

export default function NavNotificationBell() {
  const [count, setCount] = useState(0)
  const locale = useLocale()

  useEffect(() => {
    fetch('/api/user/notifications/unread')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  if (count === 0) return null

  return (
    <a
      href={`/${locale}/notifications`}
      className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      aria-label={`${count} unread notification${count !== 1 ? 's' : ''}`}
    >
      <Bell size={18} />
      <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
        {count > 9 ? '9+' : count}
      </span>
    </a>
  )
}
