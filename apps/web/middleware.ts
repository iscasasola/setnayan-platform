import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Matches a v4-style UUID exactly. Slugs are capped at 32 chars
// (`[a-z0-9-]+`), so a UUID — 36 chars including hyphens — cannot
// collide with any user-chosen slug. Safe to treat as a dashboard
// shortcut.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function middleware(request: NextRequest) {
  // Convenience: `setnayan.com/<event-uuid>/...` redirects to
  // `setnayan.com/dashboard/<event-uuid>/...`. Lets couples bookmark
  // short URLs and skip the /dashboard/ prefix when typing by hand.
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith('/dashboard/')) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && UUID_RE.test(segments[0]!)) {
      const redirectUrl = new URL(
        `/dashboard${pathname}${search}`,
        request.url,
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  return await updateSession(request);
}

export const config = {
  // Skip middleware on static assets, PWA assets, and the health probe.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*\\.svg|health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
