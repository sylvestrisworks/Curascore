import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PlaySmart — Game ratings that put benefits first',
  description:
    'Understand what your child develops, what mechanics to watch for, and how much daily playtime makes sense — for any game.',
  openGraph: { siteName: 'PlaySmart', type: 'website' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  )
}
