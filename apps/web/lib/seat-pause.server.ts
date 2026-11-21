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
import { asVendorTier, canBuyExtraSeats, entryTierAllowance } from '@/lib/vendor-tier-caps';
import { fetchLiveTierCaps } from '@/lib/vendor-plan-contents';
import { vendorAllowance } from '@/lib/vendor-feature-gate';
import { effectiveSeatCap, fetchExtraAgentSeats } from '@/lib/vendor-seats';
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
      admin.from('vendor_profiles').select('user_id, tier_state, tier_expires_at, verification_state').eq('vendor_profile_id', shopId).maybeSingle(),
      admin
        .from('vendor_team_members')
        .select('vendor_team_member_id, user_id, role, duty, created_at, deactivated_at, paused_by_plan_at')
        .eq('vendor_profile_id', shopId),
    ]);
    if (shopErr || teamErr || !shop) {
      if (shopErr || teamErr) logQueryError('seat-pause: read', (shopErr ?? teamErr)!, { shop: shopId }, 'graceful_degrade');
      return null;
    }
    const s = shop as { user_id: string; tier_state: string | null; tier_expires_at: string | null; verification_state: string | null };
    const tier = asVendorTier(liveTierState(s, Date.now()) ?? 'free');
    const planCaps = await fetchLiveTierCaps(admin, tier);
    const base = vendorAllowance(planCaps.agentAccounts, entryTierAllowance('agentAccounts'));
    const extra = canBuyExtraSeats(tier) ? await fetchExtraAgentSeats(admin, shopId) : 0;
    const cap = effectiveSeatCap(base, extra);
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
        const { error: covErr } = await admin.from('chat_threads').update({ covering_member_id: cover.memberId }).eq('thread_id', t.thread_id).is('covering_member_id', null);
        if (covErr) {
          logQueryError('seat-pause: cover', covErr, { thread: t.thread_id }, 'graceful_degrade');
          continue;
        }
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
