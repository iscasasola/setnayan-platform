import { redirect } from 'next/navigation';
import { isStoreShellRequest } from '@/lib/request-platform';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tierCaps, asVendorTier, canBuyExtraSeats, entryTierAllowance } from '@/lib/vendor-tier-caps';
import { vendorAllowance } from '@/lib/vendor-feature-gate';
import {
  effectiveSeatCap,
  fetchExtraAgentSeats,
  fetchSeatFeePhp,
} from '@/lib/vendor-seats';
import { seatLine, teamSeats } from '@/lib/vendor-free-helper';
import {
  enrichTeamWithUsers,
  fetchAdminVendorContext,
  fetchAgentServiceAssignments,
  fetchAssignableServices,
  fetchOpenAdminMotions,
  fetchVendorTeam,
  fetchWholeBranchKeys,
} from '@/lib/vendor-team';
import { fetchVendorBranches } from '@/lib/vendor-branches';
import { shopLocations, type BranchScope } from '@/lib/branch-copy';
import {
  buyExtraSeat,
  cancelAdminMotion,
  inviteVendorTeamMember,
  proposeAdminMotion,
  removeVendorTeamMember,
  setVendorAgentServices,
  stepDownSelf,
  updateVendorTeamMember,
  voteAdminMotion,
} from '../actions';
import { HelpersView } from './helpers-view';

/**
 * /vendor-dashboard/team — HELPERS (simpler supplier dashboard step 6). The reads — the same ones the Team page made —
 * and the shipped actions, handed to `HelpersView` (the screen). ADMIN-gated as before.
 */

export type TeamSearch = {
    saved?: string;
    invited?: string;
    error?: string;
    motion?: string;
    voted?: string;
};

/**
 * 🏪 THE TEAM SCREEN, ONE DRAWING FOR TWO SEATS (2026-10-31, DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"): the
 * Helpers page (`/vendor-dashboard/team`) and the Shop ⚙'s "Team" fold both mount THIS — never a second team editor.
 */
export async function TeamScreen({ search, embedded = false }: { search: TeamSearch; embedded?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ADMIN-gated: any admin of the store may manage the team (multi-admin org
  // model, 2026-07-01). Non-admin members are bounced. The admin-client email
  // enrichment below bypasses RLS, so confirming admin first is load-bearing.
  const ctx = await fetchAdminVendorContext(supabase, user.id);
  if (!ctx) redirect('/vendor-dashboard');
  const vendorProfileId = ctx.vendorProfileId;

  const rows = await fetchVendorTeam(supabase, vendorProfileId);
  const admin = createAdminClient();
  const enriched = await enrichTeamWithUsers(admin, rows);
  const [services, assignments, motionData, branchScope] = await Promise.all([
    fetchAssignableServices(supabase, vendorProfileId),
    fetchAgentServiceAssignments(supabase, vendorProfileId),
    fetchOpenAdminMotions(supabase, vendorProfileId),
    readBranchScope(supabase, admin, vendorProfileId),
  ]);


  // Team-seat math (owner 2026-07-02 ladder). Seats = members beyond the
  // always-free founding admin. Effective cap = the tier's base agentAccounts +
  // any paid extra seats (Ultra ₱250/28d add-on). Only Enterprise +
  // Custom can buy extra seats, so the "Add a seat" card is gated on that.
  const canBuySeats = canBuyExtraSeats(ctx.tierState);
  // A plan with 0 seats is a paywall → asked through the one flag-aware
  // allowance (lib/vendor-feature-gate.ts), the same number the invite action
  // enforces. Off: the entry plan's seats. On: the plan's own 0.
  const baseSeatCap = vendorAllowance(
    tierCaps(asVendorTier(ctx.tierState ?? 'free')).agentAccounts,
    entryTierAllowance('agentAccounts'),
  );
  const [extraSeats, seatFeePhp] = await Promise.all([
    fetchExtraAgentSeats(supabase, vendorProfileId),
    canBuySeats ? fetchSeatFeePhp(supabase) : Promise.resolve(0),
  ]);
  const effectiveCap = effectiveSeatCap(baseSeatCap, extraSeats);
  // 🧑‍🤝‍🧑 One Helper rides free on every plan (lib/vendor-free-helper.ts) — the SAME
  // rule the invite and role-change actions apply, read off the rows already here.
  const seats = teamSeats(enriched, ctx.founderUserId);
  const seatsLine = seatLine(seats, effectiveCap);

  const storeShell = await isStoreShellRequest();
  return (
    <HelpersView
      userId={user.id}
      branchScope={branchScope}
      founderUserId={ctx.founderUserId}
      enriched={enriched}
      motionData={motionData}
      services={services}
      assignments={assignments}
      seatsLine={seatsLine}
      canBuySeats={canBuySeats}
      storeShell={storeShell}
      extraSeats={extraSeats}
      seatFeePhp={seatFeePhp}
      search={search}
      embedded={embedded}
      actions={{
        update: updateVendorTeamMember,
        remove: removeVendorTeamMember,
        buySeat: buyExtraSeat,
        vote: voteAdminMotion,
        cancelMotion: cancelAdminMotion,
        propose: proposeAdminMotion,
        stepDown: stepDownSelf,
        invite: inviteVendorTeamMember,
        setServices: setVendorAgentServices,
      }}
    />
  );
}

/**
 * 🏢 WHOLE BRANCH (owner 2026-11-14, SIMPLER SUPPLIER PLANS item 9): the shop's locations (Main + every usable branch,
 * `shopLocations`) and who holds which in full. A refused read answers `undefined` — the screen then draws today's flat
 * list (named by card title), never a "Whole branch" box it cannot fill truthfully.
 */
async function readBranchScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<BranchScope | undefined> {
  try {
    const [branches, wholeKeys, shop] = await Promise.all([
      fetchVendorBranches(supabase, vendorProfileId, admin),
      fetchWholeBranchKeys(supabase, vendorProfileId),
      supabase.from('vendor_profiles').select('location_city').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
    ]);
    const city = (shop.data as { location_city: string | null } | null)?.location_city ?? null;
    const locations = shopLocations(
      branches.map((b) => ({ id: b.branch_id, label: b.branch_label, status: b.status })),
      city,
    );
    return { locations, wholeKeys };
  } catch {
    return undefined;
  }
}
