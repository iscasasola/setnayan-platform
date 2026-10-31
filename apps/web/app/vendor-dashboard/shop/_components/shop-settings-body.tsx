import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { isStoreShellRequest } from '@/lib/request-platform';
import { fetchShopWallet } from '@/lib/shop-wallet.server';
import { walletRowSubline, walletRowTitle } from '@/lib/shop-wallet';
import { formatPhp } from '@/lib/php';
import { planWord } from '@/lib/vendor-plan-change-words';
import { PlanScreen, type PlanSearch } from '../../subscription/_components/plan-screen';
import { TeamScreen, type TeamSearch } from '../../team/_components/team-screen';
import { loadDetailsData } from '../../profile/details-data';
import { VerifySection } from './verify-section';
import { ShopSettingsRows } from './shop-settings-rows';

/**
 * 🏪 THE SHOP ⚙'S ROWS (owner 2026-10-31, verbatim *"Yes follow your recommendation"* — DECISION_LOG "SHOP ⚙ — WHAT A
 * SUPPLIER SETS ONCE"), drawn by the server only while the sheet is open (`?gear=1`, `shop-settings.tsx`). Each fold is
 * the SHIPPED editor, never a second drawing of it:
 *   · Plan and billing — `PlanScreen` (the Plan page's own screen: your plan, what it gives you, receipts, add-ons) and the
 *     shop wallet's balance (the Papic credits, `lib/shop-wallet.ts` words). The store shell refuses the Plan page
 *     (`lib/store-shell.ts`), so there the fold says the plan and nothing to buy;
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
  const [profile, role, storeShell] = await Promise.all([
    fetchOwnVendorProfile(supabase, user.id),
    resolveVendorRole(supabase, user.id),
    isStoreShellRequest(),
  ]);
  if (!profile) return null;
  const manager = !role || canManageVendor(role);
  const one = (k: string) => {
    const v = search[k];
    return typeof v === 'string' ? v : undefined;
  };

  const [d, wallet, tierRow] = await Promise.all([
    loadDetailsData(supabase, profile),
    fetchShopWallet(supabase, profile.vendor_profile_id),
    supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle(),
  ]);
  const tier = (tierRow.data as { tier_state?: string | null } | null)?.tier_state ?? null;
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
      planLine={`${planWord(tier)} · Papic credits · receipts`}
      wallet={{ title: walletRowTitle(wallet.balance), line: walletRowSubline(wallet, formatPhp) }}
      plan={
        !manager ? (
          <p className="text-[13.5px] text-ink/60">A shop admin changes the plan.</p>
        ) : storeShell ? (
          <p className="text-[13.5px] text-ink/60" data-shop-gear-plan-shell="">
            You&rsquo;re on {planWord(tier)}.
          </p>
        ) : (
          <PlanScreen search={planSearch} embedded />
        )
      }
      team={manager ? <TeamScreen search={teamSearch} embedded /> : <p className="text-[13.5px] text-ink/60">A shop admin manages the team.</p>}
      docs={{
        isVerified: d.isVerified,
        docsIn: d.docsIn,
        docsTotal: d.docsTotal,
        measured: d.verifyMeasured,
        section: (
          <VerifySection
            businessName={d.businessName}
            vendorProfileId={d.vendorId}
            isVerified={d.isVerified}
            profileComplete={d.profileComplete}
            profileFieldsLeft={d.fieldsLeft}
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
