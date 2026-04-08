import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SiteNav from '@/components/SiteNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Curascore by Good Game Parent — See exactly how a game impacts your child',
  description:
    'Every Curascore reveals the real impact of a game. We analyze skills built, habits formed, and recommend a daily screen time limit that actually makes sense.',
  openGraph: { siteName: 'Curascore by Good Game Parent', type: 'website' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased flex flex-col min-h-screen`}>
        <SiteNav />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-black text-indigo-700 tracking-tight">Curascore <span className="font-normal text-slate-400">by Good Game Parent</span></p>
                <p className="text-xs text-slate-400 mt-0.5">Game ratings grounded in child development</p>
              </div>
              <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                <a href="/discover" className="hover:text-indigo-700 hover:underline transition-colors">Discover</a>
                <a href="/browse"   className="hover:text-indigo-700 hover:underline transition-colors">Browse</a>
                <a href="/compare"  className="hover:text-indigo-700 hover:underline transition-colors">Compare</a>
              </nav>
            </div>
            <p className="text-xs text-slate-300 mt-6">
              © {new Date().getFullYear()} Good Game Parent. Curascore scores reflect our independent assessment methodology.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
