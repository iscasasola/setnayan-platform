import { NextResponse, type NextRequest } from 'next/server';
import { clearGuestSession } from '@/lib/guest-session';

export async function POST(request: NextRequest) {
  await clearGuestSession();
  const url = new URL(request.url);
  // Drop /sign-out segment to land back on the slug root.
  url.pathname = url.pathname.replace(/\/sign-out$/, '');
  return NextResponse.redirect(url, { status: 303 });
}
