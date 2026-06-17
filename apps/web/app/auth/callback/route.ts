import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { stampLastLogin } from '@/lib/login-activity';
import { accountHomePath } from '@/lib/account-security';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // safeNext() rejects protocol-relative URLs (`//evil.com`) and any
  // value that doesn't start with `/`. Without it this route is an
  // open redirect — anything in `?next=` lands the browser off-domain
  // after a successful exchange.
  const rawNext = safeNext(url.searchParams.get('next'));
  // When no explicit destination, fall through to /dashboard after code exchange.
  const fallbackNext = rawNext === '/' ? '/dashboard' : rawNext;

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    // Magic-link / OAuth login completed — stamp last_login_at.
    await stampLastLogin(supabase);

    // Route directly to the account's home when no explicit destination given.
    const userId = data.user?.id;
    if (rawNext === '/' && userId) {
      const { data: profile } = await supabase
        .from('users')
        .select('account_type')
        .eq('user_id', userId)
        .maybeSingle();
      return NextResponse.redirect(
        new URL(accountHomePath(profile?.account_type), url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(fallbackNext, url.origin));
}
