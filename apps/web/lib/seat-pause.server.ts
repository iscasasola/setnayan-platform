import 'server-only';

/**
 * A SMALLER PLAN PAUSES THE EXTRA SEATS; A PLAN WITH ROOM BRINGS THEM BACK (supplier roles d–h (g)).
 *
 * Cron-free and idempotent, in the same shape as the plan-lapse sweep beside it in the supplier layout: every visit to
 * the supplier dashboard reconciles the visiting shop's seats against its LIVE plan (`liveTierState` — a term that ended
 * reads as the lower plan even before the sweep writes it). Who pauses is `lib/seat-pause.ts`.
 *
 * A paused seat's clients move FOR NOW to the nearest person who stays (drawing (g) ①②③ — the decided away rule:
 * the card's next Account Manager by the split, then the branch's Branch Manager, then the Shop Manager), and the
 * client is told in the same chat. When the seat comes back its clients go back to it — unless a manager moved one
 * meanwhile (a move clears the cover, so it is simply not here). Crew day-of QR codes are not team seats and are
 * untouched. Never throws.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { liveTierState } from '@/lib/vendor-tier-lapse';
import { asVendorTier, entryTierAllowance, holdsBoughtExtras } from '@/lib/vendor-tier-caps';
import { applyPlanContents, type PlanContentRow } from '@/lib/vendor-plan-contents';
import { vendorAllowance } from '@/lib/vendor-feature-gate';
import { effectiveSeatCap, extraPeopleHeld } from '@/lib/vendor-seats';
import { seatsToPauseAndResume, type PauseMember } from '@/lib/seat-pause';
import { pickForCard } from '@/lib/inquiry-routing';
import { memberChatName, readRoutingInput } from '@/lib/inquiry-routing.server';
import { postThreadSystemLine } from '@/lib/chat-system-line.server';
import { handledByLine } from '@/lib/handled-by-lines';
import { createAdminClient } from '@/lib/supabase/admin';

type ThreadRow = { thread_id: string; event_id: string; created_by_user_id: string | null; handled_by_member_id: string; covering_member_id: string | null };

async function serviceOf(admin: SupabaseClient, eventId: string, shopId: string): Promise<string | null> {
  const { data } = await admin
    .from('event_vendors')
    .select('service_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', shopId)
    .not('service_id', 'is', null)
    .limit(1)
    .maybeSingle();
  return (data as { service_id: string | null } | null)?.service_id ?? null;
}

const firstName = async (admin: SupabaseClient, shopId: string, memberId: string) =>
  ((await memberChatName(admin, shopId, memberId)) ?? '').split(',')[0]?.trim().split(/\s+/)[0] ?? '';

export async function reconcileSeatPauses(admin: SupabaseClient, shopId: string): Promise<{ paused: number; resumed: number } | null> {
  try {
    const [{ data: shop, error: shopErr }, { data: rows, error: teamErr }] = await Promise.all([
      admin.from('vendor_profiles').select('user_id, tier_state, tier_expires_at, verification_state, extra_agent_seats').eq('vendor_profile_id', shopId).maybeSingle(),
      admin
        .from('vendor_team_members')
        .select('vendor_team_member_id, user_id, role, duty, created_at, deactivated_at, paused_by_plan_at')
        .eq('vendor_profile_id', shopId),
    ]);
    if (shopErr || teamErr || !shop) {
      if (shopErr || teamErr) logQueryError('seat-pause: read', (shopErr ?? teamErr)!, { shop: shopId }, 'graceful_degrade');
      return null;
    }
    const s = shop as { user_id: string; tier_state: string | null; tier_expires_at: string | null; verification_state: string | null; extra_agent_seats: number | null };
    const tier = asVendorTier(liveTierState(s, Date.now()) ?? 'free');
    // 🛑 A REFUSED READ NEVER PAUSES ANYONE (ship review 22 Nov, HIGH). Pausing is a destructive write that locks people
    // out, so the cap it uses must be MEASURED: the plan's contents and the paid extra seats both come from reads that
    // succeeded. Any failure aborts the reconcile — nobody is paused or resumed on a guess (fetchLiveTierCaps falls back
    // to the code values and the soft add-on reads answer 0 on a failure, so neither is used here).
    const { data: planRows, error: planErr } = await admin.from('vendor_plan_contents').select('plan, key, value').eq('plan', tier);
    if (planErr) {
      logQueryError('seat-pause: plan read', planErr, { shop: shopId }, 'graceful_degrade');
      return null;
    }
    const planCaps = applyPlanContents(tier, (planRows ?? []) as PlanContentRow[]);
    const base = vendorAllowance(planCaps.agentAccounts, entryTierAllowance('agentAccounts'));
    // 🧮 WHAT THE SHOP HOLDS ON TOP OF ITS PLAN, not what it may BUY (fix pass on PR #8019, 22 Nov, HIGH). This read
    // `canBuyExtraSeats(tier)`, which is false on every plan since 2026-11-19 (no single seat is sold), and never
    // counted Ultra Add-on people — so an Ultra shop's paid single seats and the +3 people of each live add-on would
    // have been PAUSED: people locked out of seats the shop pays for. The allowance is the plan's people + the single
    // seats the shop still holds + 3 per live Ultra Add-on — `extraPeopleHeld` (lib/vendor-seats.ts), the one rule the
    // Team page's cap and the invite gate read too.
    let liveAddOns = 0;
    if (holdsBoughtExtras(tier)) {
      // MEASURED, like everything above: an unread add-on count aborts — it is never a 0 that pauses three people.
      const { data: live, error: liveErr } = await admin.rpc('vendor_live_ultra_addons_for', { p_vendor_profile_id: shopId });
      const n = typeof live === 'number' ? live : typeof live === 'string' ? Number(live) : NaN;
      if (liveErr || !Number.isFinite(n) || n < 0) {
        logQueryError('seat-pause: live Ultra Add-ons read', liveErr ?? new Error(`malformed count: ${String(live)}`), { shop: shopId }, 'graceful_degrade');
        return null;
      }
      liveAddOns = Math.floor(n);
    }
    const cap = effectiveSeatCap(base, extraPeopleHeld(tier, s.extra_agent_seats, liveAddOns));
    const members: PauseMember[] = ((rows ?? []) as Array<{ vendor_team_member_id: string; user_id: string; role: string; duty: string | null; created_at: string; deactivated_at: string | null; paused_by_plan_at: string | null }>).map((r) => ({
      memberId: r.vendor_team_member_id,
      userId: r.user_id,
      role: r.role,
      duty: r.duty,
      createdAt: r.created_at,
      deactivatedAt: r.deactivated_at,
      pausedByPlanAt: r.paused_by_plan_at,
    }));
    const { pause, resume } = seatsToPauseAndResume(members, s.user_id, cap);
    if (pause.length === 0 && resume.length === 0) return { paused: 0, resumed: 0 };
    const now = new Date().toISOString();

    if (pause.length > 0) {
      const { error } = await admin
        .from('vendor_team_members')
        .update({ deactivated_at: now, paused_by_plan_at: now })
        .in('vendor_team_member_id', pause)
        .is('deactivated_at', null);
      if (error) {
        logQueryError('seat-pause: pause', error, { shop: shopId }, 'graceful_degrade');
        return null;
      }
      const { data: threads } = await admin
        .from('chat_threads')
        .select('thread_id, event_id, created_by_user_id, handled_by_member_id, covering_member_id')
        .eq('vendor_profile_id', shopId)
        .in('handled_by_member_id', pause)
        .is('covering_member_id', null);
      for (const t of (threads ?? []) as ThreadRow[]) {
        const read = await readRoutingInput(admin, {
          eventId: t.event_id,
          vendorProfileId: shopId,
          serviceId: await serviceOf(admin, t.event_id, shopId),
          senderUserId: t.created_by_user_id ?? '',
        });
        const cover = read ? pickForCard(read.input) : null;
        if (!cover) continue;
        const { data: covered, error: covErr } = await admin
          .from('chat_threads')
          .update({ covering_member_id: cover.memberId })
          .eq('thread_id', t.thread_id)
          .is('covering_member_id', null)
          .select('thread_id');
        if (covErr) {
          logQueryError('seat-pause: cover', covErr, { thread: t.thread_id }, 'graceful_degrade');
          continue;
        }
        // Someone else covered it first: the couple is not told a name that is not true.
        if (!covered || covered.length === 0) continue;
        const [away, who] = await Promise.all([firstName(admin, shopId, t.handled_by_member_id), memberChatName(admin, shopId, cover.memberId)]);
        if (away && who) await postThreadSystemLine(admin, { eventId: t.event_id, vendorProfileId: shopId, body: handledByLine({ kind: 'paused', awayFirstName: away, who }) });
      }
    }

    if (resume.length > 0) {
      const { error } = await admin
        .from('vendor_team_members')
        .update({ deactivated_at: null, paused_by_plan_at: null })
        .in('vendor_team_member_id', resume)
        .not('paused_by_plan_at', 'is', null);
      if (error) {
        logQueryError('seat-pause: resume', error, { shop: shopId }, 'graceful_degrade');
        return null;
      }
      const { data: threads } = await admin
        .from('chat_threads')
        .select('thread_id, event_id, created_by_user_id, handled_by_member_id, covering_member_id')
        .eq('vendor_profile_id', shopId)
        .in('handled_by_member_id', resume)
        .not('covering_member_id', 'is', null);
      for (const t of (threads ?? []) as ThreadRow[]) {
        const { error: backErr } = await admin.from('chat_threads').update({ covering_member_id: null }).eq('thread_id', t.thread_id);
        if (backErr) {
          logQueryError('seat-pause: back', backErr, { thread: t.thread_id }, 'graceful_degrade');
          continue;
        }
        const who = await memberChatName(admin, shopId, t.handled_by_member_id);
        if (who) await postThreadSystemLine(admin, { eventId: t.event_id, vendorProfileId: shopId, body: handledByLine({ kind: 'back', who }) });
      }
    }
    return { paused: pause.length, resumed: resume.length };
  } catch (e) {
    logQueryError('seat-pause (threw)', e, { shop: shopId }, 'graceful_degrade');
    return null;
  }
}

/** The supplier layout's post-response mount — the service role is made here, never in the layout. */
export async function maybeReconcileSeatPauses(shopId: string): Promise<void> {
  await reconcileSeatPauses(createAdminClient(), shopId);
}
