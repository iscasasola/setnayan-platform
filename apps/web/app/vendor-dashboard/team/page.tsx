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
} from '@/lib/vendor-team';
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
} from './actions';
import { HelpersView } from './_components/helpers-view';

/**
 * /vendor-dashboard/team — HELPERS (simpler supplier dashboard step 6). The reads — the same ones the Team page made —
 * and the shipped actions, handed to `HelpersView` (the screen). ADMIN-gated as before.
 */
export const metadata = { title: 'Helpers · Supplier' };

type Props = {
  searchParams: Promise<{
    saved?: string;
    invited?: string;
    error?: string;
    motion?: string;
    voted?: string;
  }>;
};

export default async function VendorTeamPage({ searchParams }: Props) {
  const search = await searchParams;
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
  const [services, assignments, motionData] = await Promise.all([
    fetchAssignableServices(supabase, vendorProfileId),
    fetchAgentServiceAssignments(supabase, vendorProfileId),
    fetchOpenAdminMotions(supabase, vendorProfileId),
  ]);


  // Team-seat math (owner 2026-07-02 ladder). Seats = members beyond the
  // always-free founding admin. Effective cap = the tier's base agentAccounts +
  // any paid extra seats (Enterprise/Custom ₱250/28d add-on). Only Enterprise +
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
