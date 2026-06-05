import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth-core';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes except login
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const hasCookie = !!sessionCookie?.value;

    console.log(`[Middleware] Protecting ${pathname} | cookie present: ${hasCookie}`);

    let valid = false;
    if (hasCookie) {
      try {
        const result = await verifySessionToken(sessionCookie.value);
        valid = !!result;
        console.log(`[Middleware] verifySessionToken result for ${pathname}: ${valid ? 'VALID' : 'INVALID'} (user: ${result?.username || 'n/a'})`);
      } catch (e) {
        console.error('[Middleware] verifySessionToken threw:', e);
        valid = false;
      }
    }

    if (!valid) {
      console.log(`[Middleware] Redirecting unauthenticated request for ${pathname} -> /admin/login`);
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    } else {
      console.log(`[Middleware] Access granted to ${pathname}`);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
