import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // safeNext() rejects protocol-relative URLs (`//evil.com`) and any
  // value that doesn't start with `/`. Without it this route is an
  // open redirect — anything in `?next=` lands the browser off-domain
  // after a successful exchange.
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
