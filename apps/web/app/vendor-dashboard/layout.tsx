import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { Menu } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { runLoginGhostingCheck } from '@/lib/ghosting';
import { countUnread } from '@/lib/notifications';
import { logQueryError } from '@/lib/supabase/error-detect';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { DoorwaySidebarHeader } from '@/app/_components/nav/doorway-sidebar-header';
import { VendorSidebar, VendorSidebarFooter } from './_components/vendor-sidebar';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isMusicVendor } from '@/lib/songs';
import { VendorBottomNav } from './_components/vendor-bottom-nav';
import { VendorNavFab } from './_components/vendor-nav-fab';
import { resolveVendorRole } from '@/lib/vendor-role';
import { getNavSlotMap } from '@/lib/nav-registry';
import { PushNotificationRegistrar } from './_components/push-notification-registrar';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

/**
 * Vendor dashboard layout — v2.1 Navigation Phase 2 (vendor doorway).
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). The sidebarHeader carries the brand
 * wordmark + Vendor eyebrow + AccountSwitcherStandalone (matching the
 * customer and admin doorway patterns — owner directive 2026-06-18). The
 * topBar is right-aligned: unread bell · display name · sign-out ·
 * AccountSwitcher (mobile-only pill; desktop uses the sidebar standalone).
 *
 * EventSwitcher was retired from this doorway on 2026-06-18 — the unified
 * AccountSwitcher owns identity + event switching + cross-console hopping
 * on all three doorways, consistent with the customer doorway.
 */
/**
 * Up to two uppercase initials from a business/display name for the identity
 * card avatar (e.g. "Silverlens Studio" → "SS", "Aperture" → "AP"). Falls back
 * to the first two letters of a single-word name, or "SN" when empty.
 */
function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SN';
  if (words.length === 1) {
    return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  }
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

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

  // Single parallel batch for all chrome data with no inter-dependency. The
  // nav-registry overrides (getNavSlotMap) used to run sequentially near the
  // bottom of the layout — it has no dependency on anything, so it joins the
  // batch here (2026-07-01 perf) and stops sitting on the critical path.
  const [profileRes, unreadCount, switcherData, vendorRole, vendorProfile, navSlots, tierWallet] =
    await Promise.all([
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
    ]);
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

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Login-driven ghosting check (no cron) — after the response, once per login
  // (gated inside the helper). Vendor side: nudge if inquiries they received
  // sit unanswered past the threshold.
  after(() => runLoginGhostingCheck(user.id, 'vendor'));

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
  // mobile-only (lg:hidden); desktop users open the switcher from the
  // AccountSwitcherStandalone row in the sidebar header.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      {/* Mobile-only "More" overflow — the 6-tab bottom bar covers the primary
          menus; every deeper surface (profile · verify · earnings · …) stays
          one tap away via the /more landing. Hidden on desktop, where the
          sidebar already lists every destination. */}
      <Link
        href="/vendor-dashboard/more"
        aria-label="More vendor surfaces"
        className="button-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs lg:hidden"
      >
        <Menu aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        More
      </Link>
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

  return (
    <div className="app-surface">
      <SidebarShell
        sidebarHeader={<DoorwaySidebarHeader label="Vendor" switcherData={switcherData} />}
        sidebar={
          <VendorSidebar
            role={vendorRole}
            showRepertoire={showRepertoire}
            navSlots={navSlots}
            displayName={vendorSidebarName}
            initials={vendorInitials}
            isVerified={vendorIsVerified}
          />
        }
        sidebarFooter={<VendorSidebarFooter tier={vendorTier} tokenBalance={vendorTokenBalance} />}
        topBar={topBar}
      >
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">{children}</div>
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
