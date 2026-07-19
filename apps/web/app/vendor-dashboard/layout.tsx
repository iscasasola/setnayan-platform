import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { runLoginGhostingCheck } from '@/lib/ghosting';
import { maybeSweepGhostedLeadHolds } from '@/lib/lead-token-holds';
import { maybeSweepExpiredCreatorOffers } from '@/lib/creator-offers';
import { countUnread } from '@/lib/notifications';
import { countUnreadMessages } from '@/lib/chat';
import { logQueryError } from '@/lib/supabase/error-detect';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { DoorwaySidebarHeader } from '@/app/_components/nav/doorway-sidebar-header';
import { VendorSidebar, VendorSidebarFooter } from './_components/vendor-sidebar';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { VendorAvatar, deriveVendorInitials as deriveInitials } from '@/app/_components/vendor-avatar';
import { isMusicVendor } from '@/lib/songs';
import { VendorBottomNav } from './_components/vendor-bottom-nav';
import { VendorNavFab } from './_components/vendor-nav-fab';
import { resolveVendorRole } from '@/lib/vendor-role';
import { getNavSlotMap } from '@/lib/nav-registry';
import { PushNotificationRegistrar } from './_components/push-notification-registrar';
import {
  AccountSwitcher,
  SwitcherPlaqueTrigger,
} from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { ServerTimer } from '@/lib/server-timing';

/**
 * Vendor dashboard layout — v2.1 Navigation Phase 2 (vendor doorway).
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). The sidebarHeader carries the brand
 * wordmark HOME-LINK + Vendor eyebrow + the business identity plaque
 * (SwitcherPlaqueTrigger — the account-menu popup; Plaque-as-Menu council
 * verdict 2026-07-16, matching the customer and admin doorway patterns).
 * The topBar is right-aligned: unread bell · display name · sign-out ·
 * AccountSwitcher (mobile-only pill; desktop uses the sidebar plaque).
 *
 * EventSwitcher was retired from this doorway on 2026-06-18 — the unified
 * account panel owns identity + cross-console hopping on all three doorways,
 * consistent with the customer doorway; going HOME is the wordmark's job.
 */
export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/vendor-dashboard'));
  const supabase = await createClient();

  const minimalSwitcherFallback: SwitcherData = {
    userId: user.id,
    displayName: null,
    email: user.email ?? '',
    isAnonymous: !!user.is_anonymous,
    photoUrl: null,
    events: [],
    context: { hasVendor: true, vendorName: null, isAdmin: false },
  };

  // Server-render timing (2026-07-01) — one structured stdout line per layout
  // render → log drain. See lib/server-timing.ts.
  const timer = new ServerTimer('vendor-dashboard/layout');

  // Vendor profile (own or via team membership) — drives service-aware nav +
  // the tier/wallet read below. Kicked off on its own (not folded into the
  // big Promise.all) so the tier/wallet queries below can chain directly off
  // it instead of waiting on the whole batch — see the latency note below.
  const vendorProfilePromise = fetchOwnVendorProfile(supabase, user.id).catch(() => null);

  // Sidebar chrome data (proto-shell) — the identity card + footer chips.
  //   • tier          — soft-probed tier_state (not in the shared profile
  //                     select), normalized in VendorSidebarFooter.
  //   • tokenBalance  — the SAME wallet read the /tokens page uses: purchased +
  //                     earned. Fail-soft to 0 so the sidebar never blocks on a
  //                     wallet error. The expiry sweep that used to run inline
  //                     before this read is now deferred to after() (see below).
  //
  // PERF FIX (2026-07-01, "sidebar nav feels slow"): this used to `await` the
  // whole chrome Promise.all (below) — which includes getSwitcherData()'s own
  // 3-stage sequential chain (membership batch → events → gallery counts) —
  // before even ISSUING the tier/wallet queries, then awaited those as a
  // 4th sequential round trip. That serialized an independent 2-query read
  // behind the single slowest, unrelated fetch in the layout, on *every*
  // sidebar click (this layout re-renders server-side on every navigation
  // since it reads cookies via getCurrentUser()). Chaining off
  // vendorProfilePromise directly lets tier/wallet fire as soon as the
  // vendor profile resolves, overlapping with switcherData's remaining
  // stages instead of queuing behind them — cuts one full round trip off
  // the critical path of every sidebar navigation.
  const tierWalletPromise = vendorProfilePromise.then(async (vp) => {
    if (!vp?.vendor_profile_id) {
      return { tier: null as string | null, tokenBalance: 0, earnedTokens: 0, vendorId: null as string | null };
    }
    const vendorId = vp.vendor_profile_id;
    const [tierRes, walletRes] = await Promise.all([
      supabase
        .from('vendor_profiles')
        .select('tier_state')
        .eq('vendor_profile_id', vendorId)
        .maybeSingle(),
      supabase
        .from('vendor_wallets')
        .select('purchased_tokens, earned_tokens')
        .eq('vendor_id', vendorId)
        .maybeSingle(),
    ]);
    const earnedTokens = walletRes.data?.earned_tokens ?? 0;
    return {
      tier: (tierRes.data as { tier_state?: string | null } | null)?.tier_state ?? null,
      tokenBalance: (walletRes.data?.purchased_tokens ?? 0) + earnedTokens,
      earnedTokens,
      vendorId,
    };
  });

  // Sidebar Bookings badge — count of inquiry threads still awaiting the vendor's
  // Accept/Decline (inquiry_status='pending'). Real, RLS-scoped, indexed head
  // count chained off the vendor profile (fires as soon as the id resolves, in
  // parallel with the chrome batch); fail-soft to 0 so the badge simply omits on
  // any error — never fabricated. The Threads badge (unread chat threads) uses
  // the existing countUnreadMessages RPC in the batch below.
  const bookingsPendingPromise = vendorProfilePromise
    .then(async (vp) => {
      if (!vp?.vendor_profile_id) return 0;
      const { count, error } = await supabase
        .from('chat_threads')
        .select('thread_id', { count: 'exact', head: true })
        .eq('vendor_profile_id', vp.vendor_profile_id)
        .eq('inquiry_status', 'pending');
      return error ? 0 : count ?? 0;
    })
    .catch(() => 0);

  // Single parallel batch for all chrome data with no inter-dependency. The
  // nav-registry overrides (getNavSlotMap) used to run sequentially near the
  // bottom of the layout — it has no dependency on anything, so it joins the
  // batch here (2026-07-01 perf) and stops sitting on the critical path.
  const [
    profileRes,
    unreadCount,
    switcherData,
    vendorRole,
    vendorProfile,
    navSlots,
    tierWallet,
    threadsUnread,
    bookingsPending,
  ] =
    await timer.track('chrome', () => Promise.all([
      supabase
        .from('users')
        .select('account_type, email, display_name, deleted_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      countUnread(supabase, user.id),
      getSwitcherData(user.id).catch((err: unknown) => {
        logQueryError(
          'VendorDashboardLayout (getSwitcherData threw)',
          err instanceof Error ? err : new Error(String(err)),
          { user_id: user.id },
          'graceful_degrade',
        );
        return minimalSwitcherFallback;
      }),
      // Vendor team role for the role-aware nav shell (owner/admin = full nav,
      // agent/viewer = scoped). Resolved here so both the sidebar + bottom-nav
      // render from one source.
      resolveVendorRole(supabase, user.id),
      // Vendor profile (own or via team membership) — drives service-aware nav:
      // Repertoire only exists for music acts (owner directive 2026-06-13).
      // Defensive .catch(): nav gating must never crash the layout.
      vendorProfilePromise,
      // Nav registry: admin-managed name+icon overrides, resolved server-side
      // and handed to the (client) vendor nav. Cached via NAV_REGISTRY_TAG,
      // fails open. No dependency → batched here rather than run sequentially.
      getNavSlotMap(),
      tierWalletPromise,
      // Threads badge — unread chat threads for this user (existing graceful RPC,
      // already used on the couple chrome). Independent of the vendor profile.
      countUnreadMessages(supabase, user.id),
      // Bookings badge — pending-inquiry count (chained on the vendor profile).
      bookingsPendingPromise,
    ]));
  const profile = profileRes.data;
  // Service-aware nav: Repertoire is a music-act surface only.
  const showRepertoire = isMusicVendor(vendorProfile?.services);

  //   • verified      — public_visibility === 'verified' (matches the Overview
  //                     page's isVerified derivation).
  //   • initials      — up to 2 uppercase letters from the business name.
  const vendorSidebarName =
    vendorProfile?.business_name ?? profile?.display_name ?? profile?.email ?? 'Vendor';
  const vendorInitials = deriveInitials(vendorSidebarName);
  const vendorIsVerified = vendorProfile?.public_visibility === 'verified';
  // Identity-card avatar shows the uploaded logo when present (owner
  // 2026-07-02), initials otherwise. Presign is local crypto (no network);
  // best-effort — a hiccup just falls back to initials.
  const vendorLogoUrl = vendorProfile?.logo_url
    ? await displayUrlForStoredAsset(vendorProfile.logo_url).catch(() => null)
    : null;
  const vendorTier = tierWallet.tier;
  const vendorTokenBalance = tierWallet.tokenBalance;

  // Expiry sweep moved OFF the render path (2026-07-01 perf). It used to be an
  // awaited write RPC that blocked every layout render — including every
  // Server-Action-triggered re-render of this dynamic layout. Deferring it to
  // after() (post-response, same cron-free pattern as the ghosting check)
  // keeps expiry current without gating first paint. Trade-off: the sidebar
  // token pill can be one load stale after an expiry — accepted by owner
  // 2026-07-01. `supabase` is captured in the closure (holds the access token
  // in memory), so the post-response call still authenticates.
  //
  // GATED (2026-07-01 gap-fix): only *earned* tokens expire, so the sweep is
  // a guaranteed no-op when the wallet holds none. Skipping it there avoids a
  // pointless background write on every render for the majority of vendors
  // (those with a zero earned balance).
  if (tierWallet.vendorId && tierWallet.earnedTokens > 0) {
    const vendorId = tierWallet.vendorId;
    after(async () => {
      await supabase
        .rpc('evaluate_earned_token_expiry', { p_vendor_id: vendorId })
        .then(() => undefined, () => undefined);
    });
  }

  // Login-driven vendor TIER lapse (no cron) — same post-response, downgrade-only,
  // idempotent pattern as the token sweep above. sweep_vendor_tier_expiry reverts
  // a tier past its tier_expires_at (pro/enterprise → verified-or-free; custom →
  // verified-or-free + demotes the active custom plan). Only fired for a sweepable
  // PAID tier — for free/verified it is a guaranteed no-op, so skip the background
  // RPC (the same pointless-write avoidance the token sweep uses). The api_access
  // gate already denies expired access inline; this reconciles tier_state + the
  // caps overlay so a lapsed vendor stops reading Custom/Pro ceilings.
  if (
    tierWallet.vendorId &&
    vendorTier != null &&
    (['pro', 'enterprise', 'custom'] as readonly string[]).includes(vendorTier)
  ) {
    const vendorId = tierWallet.vendorId;
    after(async () => {
      await supabase
        .rpc('sweep_vendor_tier_expiry', { p_vendor_id: vendorId })
        .then(() => undefined, () => undefined);
    });
  }

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Login-driven ghosting check (no cron) — after the response, once per login
  // (gated inside the helper). Vendor side: nudge if inquiries they received
  // sit unanswered past the threshold.
  after(() => runLoginGhostingCheck(user.id, 'vendor'));
  // Ghosted lead-hold sweep (fake-inquiry protection) — CRON-FREE: rides vendor
  // traffic via after() + a durable daily DB claim (replaces the retired Vercel
  // cron). The RPC is global + idempotent, so any vendor's visit sweeps every
  // vendor's ghosts; a no-op when the hold feature is off. Never throws.
  after(() => maybeSweepGhostedLeadHolds().catch(() => {}));
  // Expired creator-offer sweep (Creator Economy P1) — CRON-FREE, same pattern:
  // an unanswered discount offer past its window RELEASES the vendor's held reach
  // token (refund). Global + idempotent; any vendor's visit sweeps the fleet.
  after(() => maybeSweepExpiredCreatorOffers().catch(() => {}));

  // Vendor-access gate — canonical rule: a user has access if they own a
  // vendor_profiles row OR sit on any vendor_team_members row. getSwitcherData
  // resolves this via fetchUserRoleSummary internally and surfaces it as
  // context.hasVendor. Matches what the unified AccountSwitcher uses for the
  // "Shop console" target.
  if (!switcherData.context.hasVendor) {
    redirect('/dashboard');
  }

  const displayName = profile?.display_name ?? profile?.email ?? 'Vendor';

  // Top bar — right-aligned utilities cluster. AccountSwitcher pill is
  // mobile-only (lg:hidden); desktop users open the same panel from the
  // SwitcherPlaqueTrigger business plaque in the sidebar header
  // (Plaque-as-Menu, council 2026-07-16).
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      {/* The mobile "More" overflow link was removed 2026-07-16 with the /more
          landing it opened — under the 5-page IA the bottom nav already covers
          every hub, and every deeper surface lives as a tab inside its hub. */}
      <UnreadBellBadge
        userId={user.id}
        initialUnread={unreadCount}
        href="/vendor-dashboard/notifications"
        ariaBaseLabel="Notifications"
        ariaUnreadSuffix="unread"
      />
      <span className="hidden text-sm text-ink/70 sm:inline">{displayName}</span>
      <form action="/auth/sign-out" method="post">
        <button className="button-secondary h-9 px-3 text-xs" type="submit">
          Sign out
        </button>
      </form>
      <div className="lg:hidden">
        <AccountSwitcher data={switcherData} />
      </div>
    </div>
  );

  timer.flush();

  return (
    <div className="app-surface">
      <SidebarShell
        sidebarHeader={
          <DoorwaySidebarHeader
            label="Vendor"
            accentColor="var(--m-sidebar-accent)"
            identity={
              <SwitcherPlaqueTrigger
                data={switcherData}
                chip={
                  <VendorAvatar
                    logoUrl={vendorLogoUrl}
                    initials={vendorInitials}
                    className="flex h-full w-full items-center justify-center rounded-lg text-[11px] font-semibold tracking-wide"
                  />
                }
                title={vendorSidebarName}
                metaLine={vendorIsVerified ? 'Verified vendor' : 'Unverified'}
                ariaLabel={`${vendorSidebarName} — account menu`}
              />
            }
          />
        }
        sidebar={
          <VendorSidebar
            role={vendorRole}
            showRepertoire={showRepertoire}
            navSlots={navSlots}
            bookingsBadge={bookingsPending}
            threadsBadge={threadsUnread}
          />
        }
        sidebarFooter={<VendorSidebarFooter tier={vendorTier} tokenBalance={vendorTokenBalance} />}
        topBar={topBar}
      >
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-[calc(env(safe-area-inset-bottom)+92px)] lg:pb-0">{children}</div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <VendorBottomNav role={vendorRole} navSlots={navSlots} />
      {/* NAV-2 broken-out action — Check inquiries (a sibling of the pill,
          never a tab). Hides itself when a docked SubNav is up. */}
      <VendorNavFab />
      {/* Push notification opt-in banner. Client-only; renders null once the
          vendor has granted push permission or dismissed the prompt. */}
      <PushNotificationRegistrar />
    </div>
  );
}
