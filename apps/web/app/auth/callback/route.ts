import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeNext } from '@/lib/auth';
import { stampLastLogin } from '@/lib/login-activity';
import { accountHomePath } from '@/lib/account-security';
import { shouldPromoteToVendor } from '@/lib/oauth-signup';

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
  // Vendor-signup intent, round-tripped by oauth-actions.ts (?as=vendor).
  const intent = url.searchParams.get('as');

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

    const userId = data.user?.id;
    let accountType: string | null = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('users')
        .select('account_type')
        .eq('user_id', userId)
        .maybeSingle();
      accountType = profile?.account_type ?? null;

      // OAuth vendor signup: signInWithOAuth can't seed the account_type metadata
      // the trigger reads, so a vendor signing up via Google/Apple lands as
      // 'customer'. Promote — but ONLY a brand-new customer with explicit vendor
      // intent (shouldPromoteToVendor guards created-at + customer-only), so an
      // established account can never be re-classified. account_type is an
      // identity column (RLS-guarded) → the elevated admin client does the write.
      if (
        shouldPromoteToVendor({
          intent,
          userCreatedAt: data.user?.created_at,
          currentAccountType: accountType,
          now: Date.now(),
        })
      ) {
        try {
          const { error: promoteErr } = await createAdminClient()
            .from('users')
            .update({ account_type: 'vendor' })
            .eq('user_id', userId);
          if (!promoteErr) accountType = 'vendor';
        } catch {
          // createAdminClient() THROWS on a missing/misconfigured service-role
          // key (it doesn't return {error}), and a network-level failure can
          // reject too. Treat any throw exactly like a returned error: fall
          // through as customer (fixable at /open-shop via becomeVendor) — a
          // failed promotion must NEVER 500 the login.
        }
      }
    }

    // Route directly to the (now-reconciled) account's home when no explicit
    // destination was given. Vendor signups carry next=/open-shop, so they take
    // the fallbackNext path below instead.
    if (rawNext === '/' && userId) {
      return NextResponse.redirect(new URL(accountHomePath(accountType), url.origin));
    }
  }

  return NextResponse.redirect(new URL(fallbackNext, url.origin));
}
