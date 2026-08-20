import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const SETUP_API_PATHS = new Set([
  '/api/auth/totp/setup',
  '/api/auth/totp/enable',
]);

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const pathname = request.nextUrl.pathname;
  const isLabour = token?.roleName === 'Labour';

  if (isLabour) {
    const labourAllowed =
      pathname === '/labour' ||
      pathname.startsWith('/api/labour/') ||
      pathname === '/api/profile' ||
      pathname.startsWith('/api/profile/') ||
      pathname === '/api/work-sessions' ||
      pathname.startsWith('/api/auth/') ||
      pathname.startsWith('/auth/') ||
      pathname === '/manifest-labour.json' ||
      pathname === '/labour-sw.js' ||
      /\.[a-z0-9]+$/i.test(pathname);
    if (!labourAllowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Labour accounts can only access attendance and meal services' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/labour', request.url));
    }
  }

  const verificationRequired = Boolean(
    token?.requires2FA
    && token.totpConfigured
    && token.totpVerified !== true
  );
  if (!verificationRequired) return NextResponse.next();
  if (pathname === '/settings/2fa' || SETUP_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Google Authenticator setup is required before accessing this API' },
      { status: 403 }
    );
  }

  return NextResponse.redirect(new URL('/settings/2fa', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest-labour.json|labour-sw.js|logo-|dashboard-floral-bg|auth/).*)'],
};
