import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 });

  // Explicitly clear every sb-* cookie on the redirect response.
  // createClient() uses cookies() from next/headers; in Route Handlers those
  // mutations don't automatically carry onto an explicit NextResponse object,
  // so the session cookies can survive into the next request and the middleware's
  // updateSession() still sees a valid user — which bounces the user back to
  // /dashboard instead of the homepage. Clearing them here on the response
  // guarantees the browser sends no auth cookies on the GET /.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }
  }

  return response;
}
