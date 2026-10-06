import { NextRequest, NextResponse } from 'next/server'

// APP_MODE=sample and Playwright's E2E_TEST both serve fixture data only, so
// they skip the password gate. Anything else ("live" mode, which is also the
// default when APP_MODE is unset) requires SITE_PASSWORD via HTTP Basic Auth.
const BYPASS_AUTH = process.env.APP_MODE === 'sample' || process.env.E2E_TEST === '1'

function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  let mismatch = a.length === b.length ? 0 : 1
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return mismatch === 0
}

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Landis Tracker", charset="UTF-8"' },
  })
}

export function middleware(req: NextRequest) {
  if (BYPASS_AUTH) return NextResponse.next()

  const sitePassword = process.env.SITE_PASSWORD
  if (!sitePassword) {
    // Fail closed: real Canvas data with no password configured must never serve.
    return new NextResponse('Site is not configured: SITE_PASSWORD is required in live mode.', { status: 503 })
  }

  const header = req.headers.get('authorization')
  if (header?.startsWith('Basic ')) {
    const decoded = atob(header.slice('Basic '.length))
    const suppliedPassword = decoded.slice(decoded.indexOf(':') + 1)
    if (timingSafeEqual(suppliedPassword, sitePassword)) {
      return NextResponse.next()
    }
  }

  return unauthorized()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
