import type { ReactNode } from 'react'
import { Lora } from 'next/font/google'

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export default function MethodologyLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${lora.variable} bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col`}>

      {/* ── Lean header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 print:hidden">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" aria-label="LumiKin home">
            <img src="/lumikin-logo.svg" alt="LumiKin" height={28} width={115} className="dark:hidden" style={{ height: 28, width: 'auto' }} />
            <img src="/lumikin-logo-dark.svg" alt="LumiKin" height={28} width={115} className="hidden dark:block" style={{ height: 28, width: 'auto' }} />
          </a>
          <nav className="flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
            <a href="/en/browse" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Game database
            </a>
            <a href="/en/partners" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              For partners
            </a>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      {/* ── Lean footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400 dark:text-zinc-500">
          <a href="/methodology" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Methodology</a>
          {/* TODO (Step 14): /press-kit */}
          <a href="/en/press-kit" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Press kit</a>
          <a href="/en/browse" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Game database</a>
          <a href="/en/partners" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">For partners</a>
        </div>
      </footer>

      {/* ── Print styles ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { margin: 2cm; }
          body { font-size: 11pt; }
          h2 { page-break-after: avoid; }
          table { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
