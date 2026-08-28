import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeNext } from '@/lib/auth';
import { signInDestination } from '@/lib/sign-in-landing';
import { stampLastLogin } from '@/lib/login-activity';
import { shouldPromoteToVendor } from '@/lib/oauth-signup';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // safeNext() rejects protocol-relative URLs (`//evil.com`) and any
  // value that doesn't start with `/`. Without it this route is an
  // open redirect — anything in `?next=` lands the browser off-domain
  // after a successful exchange.
  const rawNext = safeNext(url.searchParams.get('next'));
  // A real destination is honoured exactly as given; only the bare `/` becomes
  // the Events board (owner 2026-08-28). ONE rule, shared with
  // app/login/actions.ts — never a second copy of the line, which is how Google
  // sign-in and password sign-in came to be two answers to one question.
  const fallbackNext = signInDestination(rawNext);
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

    /*
      NO ACCOUNT-HOME HOP HERE EITHER — this must agree with
      app/login/actions.ts or the two sign-in doors disagree about where a
      person ends up, which is the "two answers to one question" failure this
      repo has already paid for (the wizard previewing a safe address while the
      mint handed out a colliding one, 2026-08-11).

      The block that stood here sent anyone arriving from `/` to
      accountHomePath(). Correct while `/` was the ELN cinematic homepage with
      nothing for a signed-in person; obsolete since `/` became the front door
      on 2026-08-13 and grew a signed-in state. `next` is now honoured for every
      origin, `/` included.

      The vendor-signup path is unaffected: those carry next=/open-shop and
      always took the fallbackNext line below.
    */
  }

  /*
    🚨 A REFUSED SIGN-IN MUST NOT LOOK LIKE A CANCELLED ONE.

    When a provider refuses, Supabase redirects here with `?error=` and
    `?error_description=` and **no `code`** — so the block above is skipped
    entirely and this line used to bounce the person back to where they
    started, signed out, with nothing said. Measured live 2026-08-20:
    `/auth/callback?error=validation_failed&error_description=provider+is+not+
    enabled` answered **307 → `/`**, silently. The person presses "Continue
    with Google", the screen flickers, and they are exactly where they were.
    Nothing errors, nothing logs, and the only symptom is an absence — the
    same family as the phantom column, the phantom enum value and the blocked
    iframe.

    🔑 THE DESKTOP TWIN ALREADY GOT THIS RIGHT. `lib/desktop-oauth.ts` reads
    `error_description ?? error` off its redirect and routes to
    `/login?error=`. One of two twins handled the failure and the other did
    not — so this is not a new mechanism, it is the sibling catching up.

    `error_description` is preferred because it is the sentence; `error` is
    the machine code behind it. Both are provider-controlled strings arriving
    on a URL, so neither is trusted for display — `humanAuthError` decides at
    the render what a person actually reads.
  */
  const oauthError =
    url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (oauthError) {
    const back = new URL('/login', url.origin);
    back.searchParams.set('error', oauthError);
    // Keep where they were headed, so signing in the other way still lands
    // them where they meant to go rather than on the account board.
    back.searchParams.set('next', fallbackNext);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(fallbackNext, url.origin));
}
