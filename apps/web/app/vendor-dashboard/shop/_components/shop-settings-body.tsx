import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isPubliclyVisible } from '@/lib/vendor-visibility';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { fetchAdminVendorContext } from '@/lib/vendor-team';
import { isStoreShellRequest } from '@/lib/request-platform';
import { fetchShopWallet } from '@/lib/shop-wallet.server';
import { walletRowSubline, walletRowTitle } from '@/lib/shop-wallet';
import { formatPhp } from '@/lib/php';
import { planWord } from '@/lib/vendor-plan-change-words';
import { PlanScreen, fmtDate, type PlanSearch } from '../../subscription/_components/plan-screen';
import { ApplePlanDoor, type ApplePlanDoorState } from '../../subscription/_components/apple-plan-door';
import { getIapGate } from '@/lib/request-platform';
import { createAdminClient } from '@/lib/supabase/admin';
import { readAppleShopPlan, type AppleShopPlanRead } from '@/lib/iap/supplier-subscription.server';
import { papersProgress } from '@/lib/locks';
import { TeamScreen, type TeamSearch } from '../../team/_components/team-screen';
import { loadDetailsData } from '../../profile/details-data';
import { VerifySection } from './verify-section';
import { ShopSettingsRows } from './shop-settings-rows';
import { shopPermitLine } from '@/lib/shop-permit-line';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 🏪 THE SHOP ⚙'S ROWS (owner 2026-10-31, verbatim *"Yes follow your recommendation"* — DECISION_LOG "SHOP ⚙ — WHAT A
 * SUPPLIER SETS ONCE"), drawn by the server only while the sheet is open (`?gear=1`, `shop-settings.tsx`). Each fold is
 * the SHIPPED editor, never a second drawing of it:
 *   · Plan and billing — `PlanScreen` (the Plan page's own screen: your plan, what it gives you, receipts, add-ons) and the
 *     shop wallet's balance (the Papic credits, `lib/shop-wallet.ts` words). The store shell refuses the Plan page
 *     (`lib/store-shell.ts`), so there the fold says the plan — and, where Apple can sell (`getIapGate().iap`), offers
 *     Plus · Pro · Ultra through Apple (`ApplePlanDoor`, owner-locked 22 Nov), never a web price;
 *   · Team — `TeamScreen` (the Helpers page's own screen). A save inside comes back here (`lib/gear-return.server.ts`);
 *   · Verification and documents — `VerifySection`, MOVED here from Shop › Details' "Your documents" fold;
 *   · Notifications — the shipped push switch (`PushToggle`) and what email carries, MOVED here from the account menu's
 *     Settings page.
 * Title + one short line on each fold; the rest is inside it. Plan and Team are a shop ADMIN's (the pages bounce anyone
 * else) — a helper reads one line instead of a screen that would send them away.
 */
export async function ShopSettingsBody({ search }: { search: Record<string, string | string[] | undefined> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, role, storeShell, adminCtx] = await Promise.all([
    fetchOwnVendorProfile(supabase, user.id),
    resolveVendorRole(supabase, user.id),
    isStoreShellRequest(),
    // 🛡 `TeamScreen` BOUNCES (redirect) anyone this does not find — a founding owner with no team row reads as a
    // manager above but not here. Asked first, so the rows never hand the screen a user it would bounce: the Shop tab
    // draws these rows on every visit (`shopGearBodyAlways`), where a bounce would throw the whole Shop page to Today.
    fetchAdminVendorContext(supabase, user.id).catch(() => null),
  ]);
  if (!profile) return null;
  const manager = !role || canManageVendor(role);
  const one = (k: string) => {
    const v = search[k];
    return typeof v === 'string' ? v : undefined;
  };

  const [d, wallet, tierRow, permitRow, appleDoor] = await Promise.all([
    loadDetailsData(supabase, profile),
    fetchShopWallet(supabase, profile.vendor_profile_id),
    supabase.from('vendor_profiles').select('tier_state, tier_expires_at').eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle(),
    // 🗓 The permit's renewal date (THE ONE BUILD: the "Business permit" line). ⚠ `next_renewal_due_at` is OFF
    // `authenticated`'s column allowlist (migration 20271222518385) — the shop reads its own through the definer view
    // `vendor_profiles_self`, in its OWN select so a refusal can never take the plan read down with it.
    supabase.from('vendor_profiles_self').select('verification_state, next_renewal_due_at').eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle(),
    // 🍎 THE PLAN DOOR IN THE APP (owner-locked 22 Nov): only where Apple can sell, for a shop admin — who bills the plan
    // (one channel at a time) and the shop's Apple subscription, read for THIS shop's own id.
    storeShell && manager
      ? getIapGate().then(async (gate): Promise<AppleShopPlanRead | null> =>
          gate.iap ? readAppleShopPlan(createAdminClient(), profile.vendor_profile_id) : null,
        )
      : Promise.resolve(null),
  ]);
  const tier = (tierRow.data as { tier_state?: string | null } | null)?.tier_state ?? null;
  const tierExpiresAt = (tierRow.data as { tier_expires_at?: string | null } | null)?.tier_expires_at ?? null;
  if (permitRow.error) logQueryError('ShopSettingsBody.permit', permitRow.error, { vendorId: profile.vendor_profile_id }, 'graceful_degrade');
  const permitFacts = permitRow.error ? null : ((permitRow.data as { verification_state?: string | null; next_renewal_due_at?: string | null } | null) ?? null);
  const permit = shopPermitLine(permitFacts ? { verification_state: permitFacts.verification_state, next_renewal_due_at: permitFacts.next_renewal_due_at } : null);
  const planSearch: PlanSearch = { ordered: one('ordered'), error: one('gsec') === 'plan' ? one('error') : undefined, cycle: one('cycle'), applied: one('applied'), kept: one('kept') };
  const teamSearch: TeamSearch = {
    saved: one('gsec') === 'team' ? one('saved') : undefined,
    invited: one('gsec') === 'team' ? one('invited') : undefined,
    error: one('gsec') === 'team' ? one('error') : undefined,
    motion: one('gsec') === 'team' ? one('motion') : undefined,
    voted: one('gsec') === 'team' ? one('voted') : undefined,
  };

  return (
    <ShopSettingsRows
      pageLive={Boolean(profile.business_slug) && isPubliclyVisible(profile.public_visibility)}
      planLine={`${planWord(tier)} · Papic credits · receipts`}
      wallet={{ title: walletRowTitle(wallet.balance), line: walletRowSubline(wallet, formatPhp) }}
      plan={
        !manager ? (
          <p className="text-[13.5px] text-ink/60">A shop admin changes the plan.</p>
        ) : storeShell ? (
          <>
            <p className="text-[13.5px] text-ink/60" data-shop-gear-plan-shell="">
              You&rsquo;re on {planWord(tier)}.
            </p>
            {appleDoor ? (
              <ApplePlanDoor
                currentTier={tier}
                verified={permitFacts?.verification_state === 'verified'}
                papersProgress={papersProgress({ done: d.docsIn, of: d.docsTotal })}
                planEndsOn={tierExpiresAt ? fmtDate(tierExpiresAt) : null}
                state={appleDoorState(appleDoor)}
              />
            ) : null}
          </>
        ) : (
          <PlanScreen search={planSearch} embedded />
        )
      }
      team={manager && adminCtx ? <TeamScreen search={teamSearch} embedded /> : <p className="text-[13.5px] text-ink/60">A shop admin manages the team.</p>}
      docs={{
        isVerified: d.isVerified,
        docsIn: d.docsIn,
        docsTotal: d.docsTotal,
        measured: d.verifyMeasured,
        row: d.progress.rows.find((r) => r.key === 'docs')!,
        permit,
        section: (
          <VerifySection
            vendorProfileId={d.vendorId}
            isVerified={d.isVerified}
            verify={d.verify}
          />
        ),
      }}
    />
  );
}

/** What a Shop section page hands its row: the ⚙'s rows while the sheet is open (`?gear=1`), else nothing to read. */
export function shopGearBody(search: object) {
  const sp = search as Record<string, string | string[] | undefined>;
  return sp.gear === '1' ? <ShopSettingsBody search={sp} /> : null;
}

/**
 * The Shop TAB's ⚙ rows, drawn WITH the page whether or not the sheet is open (8 Nov release gate): the Shop tab opens
 * and closes its ⚙ with client state + `history.replaceState` (`ShopSettings local`), so a tap never re-runs the page.
 * The page streams it in its own <Suspense>. Other Shop section pages keep `shopGearBody` (drawn while `?gear=1`).
 */
export function shopGearBodyAlways(search: object) {
  return <ShopSettingsBody search={search as Record<string, string | string[] | undefined>} />;
}

/** The server's read, with its dates in the Plan page's one phrasing ("22 Dec 2026", the Manila day). */
function appleDoorState(read: AppleShopPlanRead): ApplePlanDoorState {
  if (read.status === 'unread') return { status: 'unread' };
  return {
    status: 'ok',
    channel: read.channel,
    apple: read.apple
      ? {
          productId: read.apple.productId,
          status: read.apple.status,
          endsOn: read.apple.expiresAt ? fmtDate(read.apple.expiresAt) : null,
          autoRenew: read.apple.autoRenew,
          autoRenewProductId: read.apple.autoRenewProductId,
        }
      : null,
  };
}
