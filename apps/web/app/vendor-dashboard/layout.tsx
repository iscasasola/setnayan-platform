import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { runLoginGhostingCheck } from '@/lib/ghosting';
import { maybeSweepExpiredCreatorOffers } from '@/lib/creator-offers';
import { maybeSweepVendorBookingFeeNotifications } from '@/lib/vendor-booking-fees.server';
import { countUnread } from '@/lib/notifications';
import { countUnreadMessages } from '@/lib/chat';
import { logQueryError } from '@/lib/supabase/error-detect';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';
import { VendorRailContext } from './_components/vendor-rail-context';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { VendorBottomNav } from './_components/vendor-bottom-nav';
import { VendorNavFab } from './_components/vendor-nav-fab';
import { resolveVendorRole } from '@/lib/vendor-role';
import { getNavSlotMap } from '@/lib/nav-registry';
import { PushNotificationRegistrar } from './_components/push-notification-registrar';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { ServerTimer } from '@/lib/server-timing';
import { PromoFreeWindowBannerVendor } from '@/app/_components/promo-free-window-banner-vendor';

/**
 * Vendor dashboard layout — the shop, under the ONE shell.
 *
 * STRUCTURE: `<AppRailShell>` owns the desktop split — the SAME rail this
 * person had on their own account pages, with the shop's own five menus
 * PUSHED IN below their rows through `railContext`. It also owns the sticky
 * top bar, into which this layout hands its own cluster through `topBarSlot`.
 * Below 1024 the shell paints nothing at all and `<VendorBottomNav>` is the
 * whole navigation, exactly as before.
 *
 * ── WHAT WENT, AND WHERE ITS JOB WENT ─────────────────────────────────────
 * `<SidebarShell>` is no longer mounted here, and from 2026-08-15 it does not
 * exist at all. It shed its jobs over three slices and each was re-homed:
 *
 *   · THE DESKTOP `<aside>` + the business identity plaque → the shared rail
 *     (slice 2, 2026-08-14); the shop's name leads the rail's context group.
 *   · THE STICKY HIDE-ON-SCROLL BAR → the shared bar (slice 4, 2026-08-14).
 *   · THE ACCOUNT MENU ON DESKTOP → the top bar's `<AccountSwitcher>`, now at
 *     EVERY width. 🔒 It carries the ONLY Sign out on every vendor screen
 *     (owner 2026-08-13, "sign out lives under the avatar and nowhere else"),
 *     so the `lg:hidden` it used to carry would have stranded every desktop
 *     supplier with no way out and no error to notice.
 *     `vendor-rail-context.test.ts` fails if that class returns.
 *   · `.sn-ambient`, `.sn-vt-page` AND THE `<main>` LANDMARK → the content
 *     wrapper below. See the long note at the JSX — all three fail silently,
 *     and one of them only on a phone.
 *
 * EventSwitcher was retired from this doorway on 2026-06-18 — the unified
 * account panel owns identity + cross-console hopping on all three doorways;
 * going HOME is the rail's job.
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
    context: { hasVendor: true, vendorName: null, isAdmin: false, canOpenShop: false },
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
  //   • tier      — soft-probed tier_state (not in the shared profile select),
  //                 normalized in VendorSidebarFooter. Fail-soft to null so the
  //                 sidebar never blocks on a probe error.
  //   • vendorId  — carried out so the tier-lapse sweep below can gate on it.
  //
  // ⚠ THE WALLET READ THAT SHARED THIS PROBE IS GONE (2026-08-08). It selected
  // vendor_wallets.purchased_tokens/earned_tokens on EVERY layout render — and
  // this layout re-renders server-side on every sidebar navigation, since it
  // reads cookies via getCurrentUser(). Its last consumer, the sidebar token
  // pill, was deleted 2026-08-07 with the token economy (see the
  // VendorSidebarFooter docblock); the query outlived it by a day, paying a
  // round trip per navigation for a value nothing rendered. Tokens are RETIRED
  // (owner lock 2026-07-21: "token can retire, there should be nothing that
  // needs token anymore"; PRs #4220/#4222/#4223 removed the last writers).
  //
  // PERF FIX (2026-07-01, "sidebar nav feels slow"): this used to `await` the
  // whole chrome Promise.all (below) — which includes getSwitcherData()'s own
  // 3-stage sequential chain (membership batch → events → gallery counts) —
  // before even ISSUING the tier query, then awaited it as a 4th sequential
  // round trip. That serialized an independent read behind the single slowest,
  // unrelated fetch in the layout, on every sidebar click. Chaining off
  // vendorProfilePromise directly lets the probe fire as soon as the vendor
  // profile resolves, overlapping with switcherData's remaining stages instead
  // of queuing behind them — cuts one full round trip off the critical path of
  // every sidebar navigation. That still holds with one query instead of two.
  const tierProbePromise = vendorProfilePromise.then(async (vp) => {
    if (!vp?.vendor_profile_id) {
      return { tier: null as string | null, vendorId: null as string | null };
    }
    const vendorId = vp.vendor_profile_id;
    const tierRes = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    return {
      tier: (tierRes.data as { tier_state?: string | null } | null)?.tier_state ?? null,
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
    tierProbe,
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
      tierProbePromise,
      // Threads badge — unread chat threads for this user (existing graceful RPC,
      // already used on the couple chrome). Independent of the vendor profile.
      countUnreadMessages(supabase, user.id),
      // Bookings badge — pending-inquiry count (chained on the vendor profile).
      bookingsPendingPromise,
    ]));
  const profile = profileRes.data;
  /*
    ⚠ `showRepertoire` (isMusicVendor) WAS COMPUTED HERE AND IS GONE
    (One Shell slice 2, 2026-08-14). It gated a NESTED 'repertoire' child row,
    and nested children stopped existing when the owner locked the five-page
    IA on 2026-07-12 — so it has been reaching a filter with nothing to filter
    for a month. The music-only rule itself is untouched and still enforced
    where it matters, on the Repertoire surface and in the hub that offers it.
  */

  // The name the rail's context group announces the shop by. Never blank and
  // never an id — a rail heading reading `s89v-…` is worse than a plain word.
  const vendorSidebarName =
    vendorProfile?.business_name ?? profile?.display_name ?? profile?.email ?? 'Vendor';
  const vendorTier = tierProbe.tier;

  /*
    ⚠ THE IDENTITY PLAQUE'S AVATAR, ITS "Verified vendor" LINE AND THE LOGO
    PRESIGN THAT FED THEM WERE REMOVED HERE (One Shell slice 2, 2026-08-14),
    with the `<SidebarShell>` rail that hosted them. The plaque's real JOB was
    to open the account panel, and that panel is not lost: the top bar's
    `<AccountSwitcher>` below is no longer `lg:hidden`, so the same panel — and
    the only Sign out on this surface — is one press away at every width, which
    is exactly the reachability contract the launcher's rail is held to.
    The shop's name still leads the rail, from the context group's own header.
  */

  // ⚠ THE evaluate_earned_token_expiry SWEEP THAT SAT HERE IS GONE (2026-08-08),
  // together with the wallet read that gated it (see the probe above). It was
  // already a guaranteed no-op twice over: tokens are RETIRED (owner lock
  // 2026-07-21), and `20270406637718_tokens_never_expire.sql` had already
  // extended every live voucher to a 2999 sentinel, so there is no expiry left
  // to evaluate. All it could still do was fire a background write RPC after
  // the response on any vendor holding a stale non-zero earned balance.
  //
  // The post-response `after()` pattern it demonstrated is NOT gone — the tier
  // lapse sweep below is the live user of it, and the ghosting / creator-offer /
  // booking-fee sweeps further down use the same cron-free shape.

  // Login-driven vendor TIER lapse (no cron) — post-response, downgrade-only,
  // idempotent. sweep_vendor_tier_expiry reverts a tier past its tier_expires_at
  // (pro/enterprise → verified-or-free; custom → verified-or-free + demotes the
  // active custom plan). Deferring to after() keeps it off the render path of a
  // layout that re-renders on every navigation; `supabase` is captured in the
  // closure (holds the access token in memory), so the post-response call still
  // authenticates. Only fired for a sweepable PAID tier — for free/verified it
  // is a guaranteed no-op, so skip the pointless background write. The
  // api_access gate already denies expired access inline; this reconciles
  // tier_state + the caps overlay so a lapsed vendor stops reading Custom/Pro
  // ceilings.
  if (
    tierProbe.vendorId &&
    vendorTier != null &&
    (['pro', 'enterprise', 'custom'] as readonly string[]).includes(vendorTier)
  ) {
    const vendorId = tierProbe.vendorId;
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
  // Expired creator-offer sweep (Creator Economy P1) — CRON-FREE, same pattern:
  // an unanswered discount offer past its window RELEASES the vendor's held reach
  // token (refund). Global + idempotent; any vendor's visit sweeps the fleet.
  after(() => maybeSweepExpiredCreatorOffers().catch(() => {}));
  // Booking-fee notification sweep (CRON-FREE · surfacing layer). Because the
  // fee-charge create path is a parallel lane we must NOT hook, the vendor's
  // "your booking fee is due" notification is DERIVED post-response from the
  // existence of an unpaid vendor_booking_fee order — idempotent + flag-gated
  // inside the helper, so it never double-notifies and no-ops when the fee
  // system is dark.
  after(() => maybeSweepVendorBookingFeeNotifications(user.id).catch(() => {}));

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
  /*
    ─── THE SHOP'S OWN TOP-BAR CLUSTER (One top bar, 2026-08-14) ────────────
    Handed to the SHARED bar through `topBarSlot`, which supplies the wordmark,
    the search and "+ Create" this doorway never had. Every control below is
    unchanged, including the AccountSwitcher that carries the ONLY Sign out on
    every vendor screen.

    🔑 IT LEFT `SidebarShell`'s `topBar` SLOT — and that slot no longer exists.
    After slice 2 stood its rail down, that shell kept two jobs: the sticky
    hide-on-scroll bar and the `<main>` carrying `.sn-vt-page`. The shared bar
    took the first (same hide-on-scroll rule, owner 2026-06-15); the content
    wrapper further down took the second, and the shell was deleted on
    2026-08-15.
  */
  const topBar = (
    <div className="flex items-center gap-2">
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
      {/*
        SIGN OUT USED TO SIT HERE, LOOSE IN THE TOP BAR — retired 2026-08-13
        (Redesign Session 6, "the seam"), the same removal as the admin
        doorway's. Owner: *"sign out lives under the avatar and nowhere else."*
        Still one press away on every vendor screen: the rail's business plaque
        and the mobile AccountSwitcher pill directly below both open the
        account panel, which carries it.
        `app/_components/auth/seam-invariants.test.ts` fails if it returns.
      */}
      {/*
        🔑 NO LONGER `lg:hidden` (One Shell slice 2, 2026-08-14). It was
        mobile-only because desktop opened the same panel from the sidebar's
        business plaque — and that plaque left with the sidebar. This panel
        carries the ONLY Sign out on every vendor screen (owner 2026-08-13:
        "sign out lives under the avatar and nowhere else"), so leaving the
        breakpoint gate here would have stranded every desktop vendor with no
        way to sign out and no error to notice. Matches what the account
        spokes already render at all widths.
      */}
      <AccountSwitcher data={switcherData} />
    </div>
  );

  timer.flush();

  return (
    <div className="app-surface">
      {/*
        ── ONE SHELL, SLICE 2 (2026-08-14) ──────────────────────────────────
        The shared front-door rail wraps the vendor tree, carrying this
        person's own rows (their events, their Alaala, their story, their
        shop, HQ) with the shop's own five PUSHED IN underneath. A supplier
        moving between their shop and their own account no longer watches the
        furniture change. Owner 2026-08-13; `ONE_SHELL_PLAN_2026-08-13.md`.

        ⚠ AT WIDTHS BELOW 1024 THIS WRAPPER PAINTS NOTHING AT ALL — the app
        variant is inert there by design, and the phone keeps its locked
        bottom-bar grammar. Nothing about this change reaches a phone.
      */}
      <AppRailShell
        railContext={
          /*
            🔴 RAW VALUES ONLY — THIS LAYOUT IS A SERVER COMPONENT.
            It used to build the finished row list here, which meant calling
            `navIconComponent` (a client module) on the server. That throws,
            and from 2026-08-14 to 2026-08-15 it answered every one of a
            supplier's 63 screens with the full-page error card. The rail is a
            client component and resolves its own rows now; these four props
            are the SAME four the phone's bottom bar below already receives.
            Never pass a built `destinations` list back in.
          */
          <VendorRailContext
            shopName={vendorSidebarName}
            role={vendorRole}
            navSlots={navSlots}
            bookingsBadge={bookingsPending}
            threadsBadge={threadsUnread}
            planHref="/vendor-dashboard/subscription"
            tier={vendorTier}
          />
        }
        topBarSlot={topBar}
      >
      {/*
        ─── `<SidebarShell>` IS RETIRED (2026-08-15) — ITS LAST THREE JOBS ARE
            HERE ───────────────────────────────────────────────────────────
        Slice 2 stood its rail down and slice 4 handed the sticky bar to the
        shared one, leaving the shell rendering no `<aside>` at any width and
        existing only for what this wrapper now carries. Each of the three
        would have vanished WITHOUT AN ERROR:

         1. `.sn-ambient` — the warm Atelier ground. It sat on the shell's own
            root INSIDE the content column, so it paints over the rail's cream.
            This tree's outer `<div>` sets no background at all, so dropping it
            would have put every one of a supplier's 63 screens on plain white.
            🔑 The admin tree's copy sits on its OUTERMOST div, where the rail's
            own background covers it — the same class, a different job. Not
            interchangeable, so not copied.
         2. `.sn-vt-page` — the ONE element in the app with
            `view-transition-name: sn-page`, which the phone's bottom-nav
            carousel freezes the document around. It wraps at ALL widths, not
            just desktop; losing it leaves the tap animating NOTHING.
         3. THE `<main>` LANDMARK. The shared shell renders a `<div>` in its app
            variant because the host owns the landmark, so this must be a
            `<main>` — a `<div>` here would leave the tree with NONE.

        ⚠ THEY STAY TWO ELEMENTS, NOT ONE TIDY WRAPPER. Merging the ground into
        the named element puts the painted slab inside the view-transition
        snapshot, so the background would SLIDE with the page instead of
        standing still behind it.
      */}
      <div className="sn-ambient min-h-screen">
        <main className="sn-vt-page">
          {/* Pad the bottom on mobile so BottomNav doesn't cover the last
              row of content. The desktop offset is the rail's grid now, so
              there is no padding math left here. */}
          <div className="pb-[calc(env(safe-area-inset-bottom)+92px)] lg:pb-0">
            {/* Live vendor "free tier" promo announcement (self-gates to null when
                PROMO_FREE_WINDOWS_ENABLED is off or nothing is live). */}
            <PromoFreeWindowBannerVendor />
            {children}
          </div>
        </main>
      </div>
      </AppRailShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside the rail's content column so it
          doesn't inherit it. */}
      <VendorBottomNav
        role={vendorRole}
        navSlots={navSlots}
        bookingsBadge={bookingsPending}
        threadsBadge={threadsUnread}
      />
      {/* NAV-2 broken-out action — Check inquiries (a sibling of the pill,
          never a tab). Hides itself when a docked SubNav is up. */}
      <VendorNavFab />
      {/* Push notification opt-in banner. Client-only; renders null once the
          vendor has granted push permission or dismissed the prompt. */}
      <PushNotificationRegistrar />
    </div>
  );
}
