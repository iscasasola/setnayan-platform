'use server';

import { revalidatePath } from 'next/cache';
import { gearReturn } from '@/lib/gear-return.server';
import { redirect } from 'next/navigation';
import { payPath } from '@/lib/pay-path';
import { railForNewOrder } from '@/lib/rail-for-new-order';
import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatPhp } from '@/lib/php';
import { revokeAllSessions } from '@/lib/force-logout';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import {
  VENDOR_TEAM_ROLES,
  isVendorAdminRole,
  fetchAdminVendorContext,
  fetchTeamManagerContext,
  type VendorTeamRole,
} from '@/lib/vendor-team';
import {
  BRANCH_MANAGER_MAY_GIVE,
  VENDOR_DUTIES,
  VENDOR_DUTY_NAME,
  VENDOR_DUTY_RANK,
  cleanRoleName,
  dutyOfRank,
  dutyWorksAtABranch,
  isVendorDuty,
  type VendorDuty,
} from '@/lib/vendor-duties';
import { asVendorTier, canBuyExtraSeats, entryTierAllowance } from '@/lib/vendor-tier-caps';
import { fetchLiveTierCaps } from '@/lib/vendor-plan-contents';
import { vendorAllowance } from '@/lib/vendor-feature-gate';
import { FREE_HELPER_ROLE, FREE_HELPER_SEATS, canSeat, type SeatMember } from '@/lib/vendor-free-helper';
import {
  effectiveSeatCap,
  fetchExtraAgentSeats,
  fetchSeatFeePhp,
  seatServiceKey,
  SEAT_PERIOD_DAYS,
} from '@/lib/vendor-seats';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { MAIN_BRANCH_KEY, keyOfBranchId } from '@/lib/branch-copy';

const ROLE_SET: ReadonlySet<string> = new Set(VENDOR_TEAM_ROLES);

const TEAM = '/vendor-dashboard/team';
// 🏪 Sent from the Shop ⚙'s Team fold, a save comes back to that sheet (`gearReturn`); from the Helpers page, here.
const back = async (status: string): Promise<never> => redirect(await gearReturn(TEAM, status, 'team'));
const err = (msg: string): Promise<never> => back(`error=${encodeURIComponent(msg)}`);

function parseRole(raw: FormDataEntryValue | null): VendorTeamRole {
  if (typeof raw !== 'string' || !ROLE_SET.has(raw)) {
    throw new Error('Unknown role.');
  }
  return raw as VendorTeamRole;
}

function nullIfBlank(raw: FormDataEntryValue | null, max = 64): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * 🧑‍🤝‍🧑 THE ROLE A FORM GIVES (six roles, owner 19 Nov 2026). A form names the role as `duty`; an older form that names
 * only the rank (`role`) gives that rank's nearest role. Neither → refused.
 */
function parseDuty(formData: FormData): VendorDuty {
  const raw = formData.get('duty');
  if (isVendorDuty(raw)) return raw;
  if (typeof raw === 'string' && raw.length > 0) throw new Error('Unknown role.');
  return dutyOfRank(parseRole(formData.get('role')));
}

/** Where the role works: a branch id of THIS shop (the database re-checks it), or null = main. Whole-shop roles: null. */
function parseBranch(formData: FormData, duty: VendorDuty): string | null {
  if (!dutyWorksAtABranch(duty)) return null;
  const raw = formData.get('branch_id');
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length === 0 || t === MAIN_BRANCH_KEY ? null : t;
}

/**
 * A Branch Manager gives only the roles at or below theirs, and only at their own branch (the database holds the same
 * line: `vendor_team_members_branch_manager_manage`). A Shop Manager may give any role anywhere. Null = allowed.
 */
function branchManagerRefusal(
  ctx: { duty: 'shop_manager' | 'branch_manager'; branchId: string | null },
  duty: VendorDuty,
  branchId: string | null,
): string | null {
  if (ctx.duty === 'shop_manager') return null;
  if (!BRANCH_MANAGER_MAY_GIVE.includes(duty)) {
    return `A Branch Manager can give Account Manager, Event Crew or Helper. Ask a Shop Manager to make someone a ${VENDOR_DUTY_NAME[duty]}.`;
  }
  if ((branchId ?? null) !== (ctx.branchId ?? null)) {
    return 'A Branch Manager adds people to their own branch only. Ask a Shop Manager for another branch.';
  }
  return null;
}

/**
 * 🧑‍🤝‍🧑 Team management for a Shop Manager (the whole shop) or a Branch Manager (their branch) — owner 19 Nov 2026.
 * Everyone else is bounced, as before. The admin-only motions (votes, seats, step down) keep `ensureAdmin`.
 */
async function ensureManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const ctx = await fetchTeamManagerContext(supabase, user.id);
  if (!ctx) redirect('/vendor-dashboard');
  return { supabase, ctx, currentUserId: user.id };
}

/**
 * Team management is ADMIN-gated (multi-admin org model, 2026-07-01). ANY admin
 * of the store can manage the team — resolve the store the caller administers.
 * Non-admin members (agent/viewer) and non-vendors are bounced to the dashboard.
 */
async function ensureAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const ctx = await fetchAdminVendorContext(supabase, user.id);
  if (!ctx) redirect('/vendor-dashboard');
  return { supabase, ctx, currentUserId: user.id };
}

/** The plan's effective seat cap — base allowance (flag-aware) + paid extra seats. */
async function seatCapFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: { tierState: string | null; vendorProfileId: string },
): Promise<number> {
  // 🧮 The plan's seats as the admin last set them (vendor_plan_contents, owner 2026-11-13), the code value when unread.
  const planCaps = await fetchLiveTierCaps(supabase, asVendorTier(ctx.tierState ?? 'free'));
  const baseCap = vendorAllowance(
    planCaps.agentAccounts,
    entryTierAllowance('agentAccounts'),
  );
  const extraSeats = await fetchExtraAgentSeats(supabase, ctx.vendorProfileId);
  return effectiveSeatCap(baseCap, extraSeats);
}

/** Every member with their role — what `canSeat` counts. `null` = the read failed (refuse, never guess a seat free). */
async function readSeatMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vendorProfileId: string,
): Promise<SeatMember[] | null> {
  const { data, error } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id,user_id,role,duty')
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    logQueryError('team/actions: seat members', error, { vendor_profile_id: vendorProfileId });
    return null;
  }
  return (data ?? []) as SeatMember[];
}

/**
 * V1 invite: only existing users by email. Looks up the user via the admin
 * client (RLS on public.users is per-user), then inserts a vendor_team_members
 * row. Any admin may add a member at admin / agent / viewer.
 */
export async function inviteVendorTeamMember(formData: FormData) {
  const { supabase, ctx } = await ensureManager();

  // When invoked from the My Shop inline Team panel, stay on My Shop instead of
  // bouncing to the Team page (owner rule 2026-07 — no navigation off My Shop
  // except Profile). A local `err` shadows the module helper so every early
  // return here honours the same destination.
  const shopBack = formData.get('returnTo') === 'shop' ? '/vendor-dashboard/shop' : null;
  const err = (msg: string): Promise<never> =>
    shopBack ? Promise.resolve(redirect(`${shopBack}?error=${encodeURIComponent(msg)}`)) : back(`error=${encodeURIComponent(msg)}`);

  const emailRaw = formData.get('email');
  const labelRaw = formData.get('team_label');
  let duty: VendorDuty;
  try {
    duty = parseDuty(formData);
  } catch (e) {
    return err((e as Error).message);
  }
  const role: VendorTeamRole = VENDOR_DUTY_RANK[duty];
  const branch_id = parseBranch(formData, duty);
  const refusal = branchManagerRefusal(ctx, duty, branch_id);
  if (refusal) return err(refusal);
  if (typeof emailRaw !== 'string' || emailRaw.trim().length === 0) {
    return err('Email is required');
  }
  const email = emailRaw.trim().toLowerCase();
  const team_label = nullIfBlank(labelRaw);


  // Tier seat cap (Vendor_Tier_Capability_Matrix): count every member beyond
  // the founding admin (vendor_profiles.user_id) against the plan's seat
  // allowance — additional admins consume a seat just like agents do. Effective
  // cap = the tier's base agentAccounts + any paid extra seats (Ultra
  // ₱250/28d add-on, owner 2026-07-02; 0 for every other tier).
  // A plan with 0 seats is a PAYWALL, so it goes through the one flag-aware
  // allowance — while VENDOR_TIER_FEATURE_GATE is off, the entry plan's seats.
  //
  // 🧑‍🤝‍🧑 ONE FREE HELPER (owner 2026-10-14): up to FREE_HELPER_SEATS members in
  // the Helper role ride free on every plan — `canSeat` (lib/vendor-free-helper.ts)
  // is the one rule; the read below names the role so it can be applied (the
  // same one request the head-count used to be).
  const seatCap = await seatCapFor(supabase, ctx);
  if (seatCap !== Infinity) {
    const members = await readSeatMembers(supabase, ctx.vendorProfileId);
    if (members === null) return err('We couldn’t check your team’s seats just now. Please try again.');
    if (!canSeat({ members, founderUserId: ctx.founderUserId, cap: seatCap, change: { kind: 'invite', role, duty } })) {
      // The fee is the live catalogue price (`vendor_extra_seat`), read the same
      // way the buy-a-seat action and the Team page read it — never typed here.
      const seatFee = canBuyExtraSeats(ctx.tierState) ? await fetchSeatFeePhp(supabase) : null;
      const moreHint = canBuyExtraSeats(ctx.tierState)
        ? seatFee !== null
          ? `Add a seat (${formatPhp(seatFee)}/${SEAT_PERIOD_DAYS}d) for more.`
          : 'Add a seat for more.'
        : 'Upgrade for more.';
      const helperHint =
        duty !== 'helper' && FREE_HELPER_SEATS > 0
          ? ' A Helper (sees the schedule) is free on every plan.'
          : '';
      return err(
        seatCap === 0
          ? `Team seats are part of the paid plans. Pick one on the Plans page to add team members.${helperHint}`
          : `You've reached your plan's limit of ${seatCap} team seat${seatCap === 1 ? '' : 's'}. ${moreHint}${helperHint}`,
      );
    }
  }

  // Look up the target user by email via the admin client.
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from('users')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) {
    return err(lookupError.message);
  }
  if (!existing) {
    return err('No Setnayan account with that email. Ask them to sign up first.');
  }

  const { error } = await supabase.from('vendor_team_members').insert({
    vendor_profile_id: ctx.vendorProfileId,
    user_id: existing.user_id,
    role,
    duty,
    branch_id,
    team_label,
  });
  if (error) {
    return err(
      error.code === '23505'
        ? 'That user is already on your team.'
        : (error.message ?? '').includes('VENDOR_TEAM_BRANCH_NOT_THIS_SHOP')
          ? 'That branch isn’t one of your shop’s. Pick a branch from the list.'
          : error.message,
    );
  }

  revalidateShopPage(ctx.vendorProfileId);
  revalidatePath(shopBack ?? TEAM);
  if (shopBack) redirect(`${shopBack}?invited=1`);
  return back('invited=1');
}

/**
 * Change a NON-admin member's role/label. Promotion to Admin is unilateral.
 * Changing an *admin's* role is NOT done here — it needs a team vote (see
 * proposeAdminMotion). Enforced both in the UI and defensively here.
 */
/** The words when the database refused a team change (RLS matched no row, or another branch). */
const CANT_CHANGE_THIS_PERSON = 'You can’t change this person';

export async function updateVendorTeamMember(formData: FormData) {
  const { supabase, ctx, currentUserId } = await ensureManager();

  const idRaw = formData.get('vendor_team_member_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return err('Missing member id');
  }

  const team_label = nullIfBlank(formData.get('team_label'));

  const { data: target, error: readErr } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id,user_id,role,duty,branch_id')
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .maybeSingle();
  if (readErr) return err(readErr.message);
  if (!target) return err('Member not found');
  if (target.user_id === currentUserId) {
    return err('Use “Step down” to change your own role.');
  }
  // 🧑‍🤝‍🧑 A form that names no role (the "What they do" label form) keeps the person's role and branch as they are.
  const named = formData.has('duty') || formData.has('role');
  let duty: VendorDuty;
  try {
    duty = named ? parseDuty(formData) : isVendorDuty(target.duty) ? target.duty : dutyOfRank(target.role as string);
  } catch (e) {
    return err((e as Error).message);
  }
  // A form that sends no branch keeps where they work (dropped only when the new role covers the whole shop).
  const branch_id = formData.has('branch_id')
    ? parseBranch(formData, duty)
    : dutyWorksAtABranch(duty)
      ? ((target.branch_id as string | null) ?? null)
      : null;
  const role: VendorTeamRole = VENDOR_DUTY_RANK[duty];
  const refusal = branchManagerRefusal(ctx, duty, branch_id);
  if (refusal) return err(refusal);
  if (isVendorAdminRole(target.role as VendorTeamRole) && duty !== 'shop_manager') {
    return err('Changing a Shop Manager’s role needs a team vote — start one below.');
  }

  // 🧑‍🤝‍🧑 The free Helper is free ONLY as a Helper. Moving them to a role that
  // counts asks the plan for a seat, exactly as inviting one would. Only this
  // move can grow the count, so only it pays the two extra reads.
  const wasHelper = isVendorDuty(target.duty) ? target.duty === 'helper' : target.role === FREE_HELPER_ROLE;
  if (wasHelper && duty !== 'helper') {
    const seatCap = await seatCapFor(supabase, ctx);
    if (seatCap !== Infinity) {
      const members = await readSeatMembers(supabase, ctx.vendorProfileId);
      if (members === null) return err('We couldn’t check your team’s seats just now. Please try again.');
      if (
        !canSeat({
          members,
          founderUserId: ctx.founderUserId,
          cap: seatCap,
          change: { kind: 'role', memberId: idRaw, role, duty },
        })
      ) {
        return err(
          `Your plan has no seat for another ${VENDOR_DUTY_NAME[duty]} — this person is your free Helper. Add a seat or pick a plan with more.`,
        );
      }
    }
  }

  // 🔇 RLS that matches no row is not an error — it returns nothing. Ask for the row back and count it, so a change
  // the database refused never reads "saved".
  const { data: updated, error } = await supabase
    .from('vendor_team_members')
    .update({ role, duty, branch_id, team_label, updated_at: new Date().toISOString() })
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .select('vendor_team_member_id');
  if (error) {
    const m = error.message ?? '';
    return err(
      m.includes('VENDOR_TEAM_BRANCH_NOT_THIS_SHOP')
        ? 'That branch isn’t one of your shop’s. Pick a branch from the list.'
        : m.includes('VENDOR_TEAM_OTHER_BRANCH')
          ? CANT_CHANGE_THIS_PERSON
          : m,
    );
  }
  if (!updated || updated.length === 0) return err(CANT_CHANGE_THIS_PERSON);

  revalidateShopPage(ctx.vendorProfileId);
  revalidatePath(TEAM);
  return back('saved=1');
}

/**
 * Remove a NON-admin member (unilateral). Removing an admin needs a team vote
 * (proposeAdminMotion with kind='remove').
 */
export async function removeVendorTeamMember(formData: FormData) {
  const { supabase, ctx, currentUserId } = await ensureManager();

  const idRaw = formData.get('vendor_team_member_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return err('Missing member id');
  }

  const { data: target } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id,user_id,role')
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .maybeSingle();
  if (!target) return err('Member not found');
  if (target.user_id === currentUserId) {
    return err('You cannot remove yourself. Step down first, then have another admin remove you.');
  }
  if (isVendorAdminRole(target.role as VendorTeamRole)) {
    return err('Removing an admin needs a team vote — start one below.');
  }

  const { data: removed, error } = await supabase
    .from('vendor_team_members')
    .delete()
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .select('vendor_team_member_id');
  if (error) return err(error.message);
  // Nothing was deleted (RLS matched no row): say so, and leave their sessions alone.
  if (!removed || removed.length === 0) return err(CANT_CHANGE_THIS_PERSON);

  const removedUserId = target.user_id as string;
  after(() => revokeAllSessions(removedUserId).catch(() => {}));

  revalidateShopPage(ctx.vendorProfileId);
  revalidatePath(TEAM);
  return back('saved=1');
}

// ── Peer-admin demotion/removal votes (multi-admin org model) ──────────────

const RPC_FRIENDLY: Array<[string, string]> = [
  ['MOTION_ALREADY_OPEN', 'There’s already an open vote for that admin.'],
  ['TARGET_NOT_ADMIN', 'That person isn’t an admin.'],
  ['CANNOT_TARGET_SELF', 'Use “Step down” to leave the admin role yourself.'],
  ['NOT_VENDOR_ADMIN', 'Only an admin can do that.'],
  ['TARGET_CANNOT_VOTE', 'You can’t vote on a motion about yourself.'],
  ['MOTION_CLOSED', 'That vote has already been resolved.'],
  ['MOTION_NOT_FOUND', 'That vote no longer exists.'],
  ['VENDOR_LAST_ADMIN', 'A store must keep at least one admin.'],
];
function friendlyRpcError(message: string | undefined): string {
  const up = (message ?? '').toUpperCase();
  for (const [code, friendly] of RPC_FRIENDLY) {
    if (up.includes(code)) return friendly;
  }
  return 'That action couldn’t be completed. Please try again.';
}

/** Start a vote to demote (→ agent/viewer) or remove a peer admin. */
export async function proposeAdminMotion(formData: FormData) {
  const { supabase, ctx } = await ensureAdmin();
  const targetUserId = formData.get('target_user_id');
  const kindRaw = formData.get('kind');
  const newRoleRaw = formData.get('new_role');
  if (typeof targetUserId !== 'string' || targetUserId.length === 0) {
    return err('Missing target member');
  }
  const kind = kindRaw === 'remove' ? 'remove' : 'demote';
  const newRole = newRoleRaw === 'viewer' ? 'viewer' : 'agent';

  const { data, error } = await supabase.rpc('vendor_propose_admin_motion', {
    p_vendor_profile_id: ctx.vendorProfileId,
    p_target_user_id: targetUserId,
    p_kind: kind,
    p_new_role: newRole,
  });
  if (error) return err(friendlyRpcError(error.message));

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.status === 'executed' && row?.kind === 'remove' && row?.target_user_id) {
    const removed = row.target_user_id as string;
    after(() => revokeAllSessions(removed).catch(() => {}));
  }

  revalidatePath(TEAM);
  return back(row?.status === 'executed' ? 'saved=1' : 'motion=started');
}

/** Cast / change a vote on an open admin motion. */
export async function voteAdminMotion(formData: FormData) {
  const { supabase } = await ensureAdmin();
  const motionId = formData.get('motion_id');
  const approve = formData.get('approve') === 'true';
  if (typeof motionId !== 'string' || motionId.length === 0) {
    return err('Missing motion id');
  }
  const { data, error } = await supabase.rpc('vendor_vote_admin_motion', {
    p_motion_id: motionId,
    p_approve: approve,
  });
  if (error) return err(friendlyRpcError(error.message));

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.status === 'executed' && row?.kind === 'remove' && row?.target_user_id) {
    const removed = row.target_user_id as string;
    after(() => revokeAllSessions(removed).catch(() => {}));
  }

  revalidatePath(TEAM);
  return back(row?.status === 'open' ? 'voted=1' : 'saved=1');
}

/** Cancel an open admin motion (any admin of the store). */
export async function cancelAdminMotion(formData: FormData) {
  const { supabase } = await ensureAdmin();
  const motionId = formData.get('motion_id');
  if (typeof motionId !== 'string' || motionId.length === 0) {
    return err('Missing motion id');
  }
  const { error } = await supabase.rpc('vendor_cancel_admin_motion', {
    p_motion_id: motionId,
  });
  if (error) return err(friendlyRpcError(error.message));

  revalidatePath(TEAM);
  return back('saved=1');
}

// ── Extra team seats (Ultra ₱250/28d add-on · owner 2026-07-02) ──

/** 'SN' + 8 uppercase hex — matches the couple checkout + branch reference format. */
function generateSeatReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Buy one extra team seat beyond the tier's base cap. Ultra-only
 * (the base ladder tops out at 10; extra seats are the paid escape valve).
 * Apply-then-pay: an `orders` row keyed `vendor_extra_seat__{vendor_profile_id}`
 * + a pending `payments` row so it lands in /admin/payments. On admin approval
 * the sku-activation hook recomputes vendor_profiles.extra_agent_seats and the
 * seat becomes usable. The ongoing ₱250 folds into the Enterprise renewal in PR-B.
 */
export async function buyExtraSeat(formData: FormData) {
  const { supabase, ctx, currentUserId } = await ensureAdmin();

  if (!canBuyExtraSeats(ctx.tierState)) {
    return err('Extra team seats are a Supplier Ultra add-on. Upgrade to Supplier Ultra first.');
  }

  // The rail is CHOSEN ON THE PAYMENT PAGE now, where the QR that carries it is
  // — so the chooser that used to sit beside this button is gone. This
  // placeholder row keeps a value only because `channel` is NOT NULL; the real
  // one is written when they actually send the money. It still has to be an
  // OPEN rail, and with none open there is no order to mint at all.
  const channel = await railForNewOrder(supabase, formData.get('channel'));
  if (!channel) return err(PAYMENTS_PAUSED_MESSAGE);
  const feePhp = await fetchSeatFeePhp(supabase);
  // 💰 No readable catalogue price ⇒ no order: never mint a seat at a remembered figure.
  if (feePhp === null) return err('We couldn’t read the seat price just now. Please try again.');
  const referenceCode = generateSeatReferenceCode();

  // ── SEC-4b · service-role mint ─────────────────────────────────────────────
  // `orders` + `payments` INSERT are revoked from `authenticated` (migration
  // 20271008178212). service_role bypasses `orders_owner_write`'s
  // `WITH CHECK (user_id = auth.uid())` — the only thing RLS checked here; it
  // never verified the caller administers the store being billed.
  //
  // AUTHORIZATION IS UNCHANGED and already adequate: `ensureAdmin()` above
  // authenticates and resolves `ctx.vendorProfileId` from a `vendor_team_members`
  // row where user_id = the caller AND role IN ('admin','owner') — server
  // resolved, never client-supplied — and `canBuyExtraSeats(ctx.tierState)` is
  // the Ultra gate. Both ids handed to `orderRowFor` come from
  // there, so a form field can never reach an identity column.
  const moneyWriter = createMoneyWriterClient();

  const { data: orderRow, error: oErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(
        { userId: currentUserId, eventId: null, vendorProfileId: ctx.vendorProfileId },
        {
          service_key: seatServiceKey(ctx.vendorProfileId),
          description: 'Extra Team Seat (28-day)',
          requested_total_php: feePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the seat order. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await moneyWriter.from('payments').insert(
    paymentRowFor(
      { userId: currentUserId, verifiedOrderId: orderId },
      {
        amount_php: feePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    // Same client that minted it — a mixed-client compensation is how a
    // rollback silently stops rolling back.
    await moneyWriter.from('orders').delete().eq('order_id', orderId);
    return err('Could not start the seat order. Please try again.');
  }

  revalidatePath(TEAM);
  // The ONE payment page (owner 2026-08-21). It carries the amount inside the
  // QR, takes the screenshot and the last 6 digits of the bank reference, and
  // links back here — none of which the `?bought=` banner could do.
  redirect(payPath(referenceCode));
}

/** Step down from the admin role yourself (→ agent). Blocked if you're the last admin. */
export async function stepDownSelf() {
  const { supabase, ctx, currentUserId } = await ensureAdmin();
  const { error } = await supabase
    .from('vendor_team_members')
    .update({ role: 'agent', updated_at: new Date().toISOString() })
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .eq('user_id', currentUserId)
    .eq('role', 'admin');
  if (error) {
    return err(
      (error.message ?? '').toUpperCase().includes('VENDOR_LAST_ADMIN')
        ? 'You’re the only admin — promote someone to admin before stepping down.'
        : error.message,
    );
  }
  revalidateShopPage(ctx.vendorProfileId);
  revalidatePath(TEAM);
  return back('saved=1');
}

/**
 * Phase 2a — set which services an agent is assigned to. Admin-only (enforced
 * by RLS on vendor_service_agents via current_vendor_ids('admin')); the action
 * also clamps the selection to the vendor's own services defensively.
 */
export async function setVendorAgentServices(formData: FormData) {
  const { supabase, ctx } = await ensureManager();
  const branchOnly = ctx.duty === 'branch_manager' ? keyOfBranchId(ctx.branchId) : null;

  const memberIdRaw = formData.get('vendor_team_member_id');
  if (typeof memberIdRaw !== 'string' || memberIdRaw.length === 0) {
    return err('Missing member id');
  }

  const { data: member } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id')
    .eq('vendor_team_member_id', memberIdRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .maybeSingle();
  if (!member) return err('Member not found');

  const { data: services } = await supabase
    .from('vendor_services')
    .select('vendor_service_id,branch_id')
    .eq('vendor_profile_id', ctx.vendorProfileId);
  // 🧑‍🤝‍🧑 A Branch Manager ticks only their branch's cards (the database holds the same line).
  const rows = ((services ?? []) as { vendor_service_id: string; branch_id: string | null }[]).filter(
    (s) => branchOnly === null || keyOfBranchId(s.branch_id) === branchOnly,
  );
  const valid = new Set(rows.map((s) => s.vendor_service_id));

  // 🏢 WHOLE BRANCH (owner 2026-11-14, SIMPLER SUPPLIER PLANS item 9): a ticked branch gives the person every service
  // filed there now — added below — and every one filed later (the database trigger reads `whole_branch_keys`). A key is
  // 'main' or one of THIS shop's branch ids; anything else is dropped, never trusted.
  const { data: branchRows } = await supabase
    .from('vendor_branches')
    .select('branch_id')
    .eq('parent_vendor_profile_id', ctx.vendorProfileId);
  const validKeys = new Set<string>([MAIN_BRANCH_KEY, ...((branchRows ?? []) as { branch_id: string }[]).map((b) => b.branch_id)]);
  const wholeKeys = Array.from(
    new Set(formData.getAll('whole_branch').filter((v): v is string => typeof v === 'string' && validKeys.has(v))),
  );
  const wholeSet = new Set(wholeKeys);
  const selected = Array.from(
    new Set([
      ...formData.getAll('service_ids').filter((v): v is string => typeof v === 'string' && valid.has(v)),
      ...rows.filter((r) => wholeSet.has(keyOfBranchId(r.branch_id))).map((r) => r.vendor_service_id),
    ]),
  );

  // "Whole branch" stays a Shop Manager's shortcut — a Branch Manager sets cards one by one.
  if (branchOnly === null) {
    const { error: keysErr } = await supabase
      .from('vendor_team_members')
      .update({ whole_branch_keys: wholeKeys })
      .eq('vendor_team_member_id', memberIdRaw)
      .eq('vendor_profile_id', ctx.vendorProfileId);
    if (keysErr) return err(keysErr.message);
  }

  if (valid.size > 0) {
    const { error: delErr } = await supabase
      .from('vendor_service_agents')
      .delete()
      .eq('vendor_team_member_id', memberIdRaw)
      .in('vendor_service_id', [...valid]);
    if (delErr) return err(delErr.message);
  }
  if (selected.length > 0) {
    const { error: insErr } = await supabase.from('vendor_service_agents').insert(
      selected.map((vendor_service_id) => ({
        vendor_service_id,
        vendor_team_member_id: memberIdRaw,
      })),
    );
    if (insErr) return err(insErr.message);
  }

  // It now writes `vendor_team_members` (whole_branch_keys), which the shop page tree reads — clear its cached copy.
  revalidateShopPage(ctx.vendorProfileId);
  revalidatePath(TEAM);
  return back('saved=1');
}

// ── 🏷 Team › Roles — the shop's own name for each role (owner 19 Nov 2026) ─────────────────────────────────────────

const ROLES = '/vendor-dashboard/team/roles';

/**
 * Save the shop's names for the six roles. A blank box keeps the fixed name (its row is removed). Renaming changes
 * only the words — what a role can do is `vendor_team_members.duty`. Shop Manager only (`vendor_role_names` RLS:
 * `current_vendor_ids('admin')`). A refused write is said, never shown as saved.
 */
export async function setVendorRoleNames(formData: FormData) {
  const { supabase, ctx, currentUserId } = await ensureAdmin();
  const now = new Date().toISOString();
  const keep: { vendor_profile_id: string; duty: VendorDuty; display_name: string; updated_by: string; updated_at: string }[] = [];
  const clear: VendorDuty[] = [];
  for (const duty of VENDOR_DUTIES) {
    const name = cleanRoleName(formData.get(`name_${duty}`));
    if (name && name !== VENDOR_DUTY_NAME[duty]) {
      keep.push({ vendor_profile_id: ctx.vendorProfileId, duty, display_name: name, updated_by: currentUserId, updated_at: now });
    } else {
      clear.push(duty);
    }
  }
  const back = (status: string): never => redirect(`${ROLES}?${status}`);
  if (keep.length > 0) {
    const { error } = await supabase.from('vendor_role_names').upsert(keep, { onConflict: 'vendor_profile_id,duty' });
    if (error) {
      logQueryError('team/actions: role names upsert', error, { vendor_profile_id: ctx.vendorProfileId });
      return back(`error=${encodeURIComponent('Those names didn’t save. Nothing changed — please try again.')}`);
    }
  }
  if (clear.length > 0) {
    const { error } = await supabase
      .from('vendor_role_names')
      .delete()
      .eq('vendor_profile_id', ctx.vendorProfileId)
      .in('duty', clear);
    if (error) {
      logQueryError('team/actions: role names clear', error, { vendor_profile_id: ctx.vendorProfileId });
      return back(`error=${encodeURIComponent('Some names didn’t go back to the fixed name. Please try again.')}`);
    }
  }
  revalidateShopPage(ctx.vendorProfileId);
  revalidatePath(ROLES);
  revalidatePath(TEAM);
  return back('saved=1');
}
