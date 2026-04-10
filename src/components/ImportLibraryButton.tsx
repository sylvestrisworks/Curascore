'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const ImportModal = dynamic(() => import('./ImportModal'), { ssr: false })

export default function ImportLibraryButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-indigo-300 hover:text-indigo-700 transition-colors"
      >
        ↓ Import library
      </button>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  )
}
