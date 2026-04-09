import { auth } from '@/auth'
import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

const LOCALES_PATTERN = routing.locales.join('|')
const REVIEW_RE    = new RegExp(`^/(?:(?:${LOCALES_PATTERN})/)?review`)
const DASHBOARD_RE = /^\/dashboard/

// auth() wraps the middleware and injects req.auth (session) — replaces v4 getToken
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default auth((req: any) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  // Protect /review — redirect to locale-aware login page
  if (REVIEW_RE.test(pathname) && !isLoggedIn) {
    const locale = req.cookies.get('NEXT_LOCALE')?.value ?? routing.defaultLocale
    const loginUrl = new URL(`/${locale}/login`, req.url)
    loginUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Protect /dashboard — redirect unauthenticated users to home
  if (DASHBOARD_RE.test(pathname) && !isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // All other routes — run i18n middleware as normal
  return intlMiddleware(req)
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
