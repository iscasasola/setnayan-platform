import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { runLoginGhostingCheck } from '@/lib/ghosting';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SecureAccountBanner } from './_components/secure-account-banner';
import { PendingVendorInquiryDispatcher } from './_components/pending-vendor-inquiry-dispatcher';
import { AnonGateProvider } from '@/app/_components/anon-gate/anon-gate-context';
import { dispatchPendingInquiries } from '@/lib/pending-inquiries';
import { fetchUserRoleSummary } from '@/lib/roles';

/**
 * Root dashboard layout — shared by BOTH the account route group `(account)`
 * (picker · profile · notifications · create-event · api-keys) AND the event
 * subtree `[eventId]/*`.
 *
 * 2026-06-14 chrome retirement: this layout now owns NO visible chrome. The
 * account chrome (`OuterDashboardHeader`) moved to `(account)/layout.tsx`; the
 * event chrome (paper `SidebarShell`) lives in `[eventId]/layout.tsx`. Neither
 * the legacy cream header nor a `lg:pl-60` gutter renders here anymore — which
 * removes the dual-render flash where the cream chrome painted first on event
 * routes and was suppressed only by a client `usePathname()` guard + a
 * `lg:-ml-60` cancel. It keeps only the `app-surface` font lock + a `--m-paper`
 * base background so every dashboard route renders on the new palette from the
 * first paint.
 *
 * What MUST stay here (runs for every authenticated /dashboard route):
 *   - auth gate (redirect to /login)
 *   - the defensive users-profile probe (account_type · deleted_at ·
 *     tour_seen_keys) with the column-drift `SELECT *` fallback
 *   - deleted-account sign-out + vendor → /vendor-dashboard redirect
 *   - the login-driven ghosting check (cron-free · runs after the response)
 *   - the couple welcome GuidedTour
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(loginRedirectPath('/dashboard'));
  }
  const supabase = await createClient();

  // Defensive users SELECT (5th-hotfix pattern, preserved): explicit error
  // capture + a column-drift `SELECT *` fallback so a future ADD COLUMN that
  // lands on code before its migration doesn't crash this load-bearing chrome,
  // and a try/catch so a synchronous supabase-js / transport throw degrades to
  // profile=null instead of bubbling to global-error on the post-login render.
  type ProfileShape = {
    account_type?: string | null;
    deleted_at?: string | null;
    tour_seen_keys?: string[] | null;
  };
  let profile: ProfileShape | null = null;
  try {
    const fullRes = await supabase
      .from('users')
      .select('account_type, deleted_at, tour_seen_keys')
      .eq('user_id', user.id)
      .maybeSingle();
    if (
      fullRes.error &&
      /column .* does not exist|undefined_column|42703/i.test(
        (fullRes.error as { message?: string; code?: string }).message ??
          (fullRes.error as { code?: string }).code ??
          '',
      )
    ) {
      // Column missing on prod → migration drift. Fall back to SELECT *.
      const fallbackRes = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      profile = (fallbackRes.data as unknown as ProfileShape) ?? null;
      if (fallbackRes.error) {
        logQueryError(
          'DashboardLayout (users.profile fallback)',
          fallbackRes.error,
          { user_id: user.id },
          'graceful_degrade',
        );
      }
    } else if (fullRes.error) {
      logQueryError(
        'DashboardLayout (users.profile)',
        fullRes.error,
        { user_id: user.id },
        'graceful_degrade',
      );
      profile = null;
    } else {
      profile = (fullRes.data as unknown as ProfileShape) ?? null;
    }
  } catch (caught) {
    logQueryError(
      'DashboardLayout (users.profile threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { user_id: user.id },
      'graceful_degrade',
    );
    profile = null;
  }

  // Reject deleted accounts — sign them out cleanly.
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // ── VENDORS BELONG ON THE VENDOR-SIDE TREE — BUT ONLY REAL ONES ───────────
  //
  // 🔴 THIS SENT A SIGNED-IN ACCOUNT INTO AN INFINITE REDIRECT, AND IT TOOK THE
  // SITE DOWN FOR THAT USER. Safari eventually gave up with "Load cannot follow
  // more than 20 redirections"; before that it surfaced as a
  // `history.replaceState` storm, because the client router counts every hop.
  //
  // The cause was TWO DIFFERENT DEFINITIONS OF "IS A VENDOR":
  //   • here      — the `users.account_type` LABEL
  //   • there     — whether a shop or a team seat actually EXISTS
  //     (vendor-dashboard/layout.tsx: `if (!switcherData.context.hasVendor)
  //      redirect('/dashboard')`)
  //
  // An account can satisfy one and not the other: delete someone's shop and the
  // label stays 'vendor' while the access is gone. This side then said "you are
  // a vendor, go there", that side said "you have no shop, come back", and
  // neither was wrong on its own. Reproduced in production 2026-08-10 on a test
  // account whose shop had been deleted without resetting its label.
  //
  // 🔑 THE FIX IS ONE RULE, NOT A BIGGER CONDITION ON EACH SIDE. This now asks
  // the same question the vendor tree asks — `hasVendorAccess`, which is true
  // only when a `vendor_profiles` row or a `vendor_team_members` row exists —
  // so the two can no longer disagree about the same person.
  //
  // The cheap label is still checked FIRST, so a customer pays nothing: the
  // authoritative lookup only runs for accounts already claiming to be vendors.
  // An account whose label says vendor but which owns nothing now simply stays
  // here, on the couple dashboard, which is a real place with a real way out —
  // instead of bouncing between two doors that each point at the other.
  /*
    🔴 THE BOUNCE IS GONE — IT TOOK AWAY EVERYTHING PERSONAL, PERMANENTLY.
    Owner 2026-08-15, asked directly: *"supplier/vendors also has their own user
    account. but they cannot make from their vendor account."* Asked what should
    happen to the personal side, he chose: **keep both, block only creating.**

    What this guard actually did was far wider than that ruling. Opening a shop
    flips an existing customer's `account_type` to 'vendor'
    (`open-shop/actions.ts`), and NOTHING anywhere flips it back — the only
    writes of 'customer' are signup, anon-convert and the event-account link.
    This guard then bounced that account off the WHOLE couple tree: the events
    they had already planned, each event's own pages, their profile,
    notifications, Alaala, People, Year. **They lost the wedding they made, with
    no way back**, and the account-deletion request lives on the profile screen,
    so they could not close their account either — a right under RA 10173.

    ⚠ AND THE LIKELY VICTIM WAS NOT A SUPPLIER ONBOARDING. "Create your shop"
    sits in the account menu on every signed-in surface and on the couple's own
    events board (both added 2026-08-10 to put the wizard in front of couples),
    so the person most likely to lose their wedding was a couple mid-planning who
    accepted an invitation the product showed them.

    🔑 THE RULING IS ABOUT CREATING, SO THE BLOCK BELONGS ON CREATING. It now
    lives at the four server entry points that actually make an event
    (`lib/vendor-event-creation.ts`), which is the door rather than the button —
    a layout redirect could never have covered the onboarding wizards anyway,
    because they commit from `/onboarding/*`, outside this tree.

    ✅ NO REDIRECT LOOP RETURNS — the 2026-08-10 "more than 20 redirections" bug
    needed BOTH sides pointing at each other. `vendor-dashboard/layout.tsx` still
    sends an account with no shop here; this side now sends nobody there, so the
    cycle cannot form. Sign-in is unaffected: it stopped forcing vendors to
    /vendor-dashboard on 2026-08-13 and honours `next` for every origin.
  */

  // Login-driven ghosting check (no cron) — runs after the response, gated
  // once per login inside the helper. Couple side: nudge if their inquiries
  // sit unanswered.
  after(() => runLoginGhostingCheck(user.id, 'couple'));

  // Anon-draft: the moment a converted couple lands here authenticated +
  // NON-anonymous, replay the vendor inquiries they held during anonymous
  // onboarding (no-op when there's no held intent). Skipped while still
  // anonymous — the SecureAccountBanner nudges them to convert first. Runs
  // post-response (after()) so it never blocks the dashboard render; idempotent.
  if (!user.is_anonymous) {
    after(() => dispatchPendingInquiries(user.id));
  }

  return (
    <div
      className="app-surface min-h-dvh"
      style={{ background: 'var(--m-paper)' }}
    >
      {/* Anon-draft safety net: only renders for a Supabase anonymous principal
          (their plan isn't yet tied to an email). Vanishes on convert. */}
      {user.is_anonymous ? <SecureAccountBanner /> : null}
      {/* Compose-first Inquire replay (owner 2026-07-02): if this couple composed
          an inquiry on a vendor profile before signing up, fire it now that
          they're a secured couple with an event. No-op when nothing is stashed
          or the viewer is still anonymous. */}
      <PendingVendorInquiryDispatcher enabled={!user.is_anonymous} />
      {/* Seed the anon-state once so deep gated actions (unlock a category,
          checkout) can show the pre-emptive "save your plan" prompt without
          re-fetching the user. Reads `false` for every secured user. */}
      <AnonGateProvider isAnonymous={!!user.is_anonymous}>{children}</AnonGateProvider>
      {!(profile?.tour_seen_keys ?? []).includes('couple_welcome_v1') ? (
        <GuidedTour tourKey="couple_welcome_v1" completeAction={completeTour} />
      ) : null}
    </div>
  );
}
