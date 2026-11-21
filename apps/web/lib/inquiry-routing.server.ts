import 'server-only';

/**
 * WHO HANDLES A CLIENT — reads, decides (lib/inquiry-routing.ts), writes, and tells the client (#8013 (e)(f)(h)).
 *
 * Called with the SERVICE-ROLE client after an inquiry opens or resumes a conversation. Never throws and never blocks
 * the inquiry: a failed read leaves the client with no Account Manager (Clients then shows the card's people, as it
 * did before), and the reason is logged — an unknown is never turned into a pick.
 *
 * The counts: the shop's OWN past clients on this card + event type once it has `inquiry_split_own_enough` of them
 * (an owner number, Admin › Settings); while that is not set, or the shop has fewer, the counts across all Setnayan
 * inquiries of that event type (controller 21 Nov, row 4).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { postThreadSystemLine } from '@/lib/chat-system-line.server';
import { fetchVendorRoleNames } from '@/lib/vendor-team';
import { isVendorDuty, roleNameOf } from '@/lib/vendor-duties';
import { decideHandler, type AdjustedCut, type RoutingMember } from '@/lib/inquiry-routing';
import { handledByLine } from '@/lib/handled-by-lines';

type Args = { eventId: string; vendorProfileId: string; serviceId: string | null; senderUserId: string };

async function prefixCounts(admin: SupabaseClient, serviceId: string | null, eventType: string | null): Promise<Map<string, number> | null> {
  const { data, error } = await admin.rpc('inquiry_last_name_prefix_counts', {
    p_vendor_service_id: serviceId,
    p_event_type: eventType,
  });
  if (error) {
    logQueryError('inquiry-routing: prefix counts', error, { service: serviceId }, 'graceful_degrade');
    return null;
  }
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ prefix: string; n: number }>) counts.set(r.prefix, Number(r.n) || 0);
  return counts;
}

const total = (c: ReadonlyMap<string, number>) => [...c.values()].reduce((a, b) => a + b, 0);

/** The words a member goes by in the chat: "Joy Tan, Lead Stylist". */
export async function memberChatName(admin: SupabaseClient, vendorProfileId: string, memberId: string): Promise<string | null> {
  const { data, error } = await admin.from('vendor_team_members').select('duty, user_id').eq('vendor_team_member_id', memberId).maybeSingle();
  if (error || !data) {
    if (error) logQueryError('inquiry-routing: member', error, { member: memberId }, 'graceful_degrade');
    return null;
  }
  const row = data as { duty: string; user_id: string };
  const { data: user, error: userErr } = await admin.from('users').select('display_name').eq('user_id', row.user_id).maybeSingle();
  if (userErr) logQueryError('inquiry-routing: member name', userErr, { member: memberId }, 'graceful_degrade');
  const person = ((user as { display_name: string | null } | null)?.display_name ?? '').trim();
  if (!person || !isVendorDuty(row.duty)) return null;
  const names = await fetchVendorRoleNames(admin, vendorProfileId).catch(() => ({}));
  return `${person}, ${roleNameOf(names, row.duty)}`;
}

/**
 * Give the client their ONE Account Manager (or mark "Hand over"). Returns what happened, for tests and logs.
 */
export async function routeInquiry(admin: SupabaseClient, args: Args): Promise<'assigned' | 'kept' | 'hand-over' | 'nobody' | 'failed'> {
  try {
    const [threadRead, cardRead, teamRead, eventRead, senderRead, settingRead] = await Promise.all([
      admin.from('chat_threads').select('thread_id, handled_by_member_id').eq('event_id', args.eventId).eq('vendor_profile_id', args.vendorProfileId).maybeSingle(),
      args.serviceId
        ? admin.from('vendor_services').select('branch_id').eq('vendor_service_id', args.serviceId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from('vendor_team_members').select('vendor_team_member_id, duty, branch_id, deactivated_at, created_at').eq('vendor_profile_id', args.vendorProfileId),
      admin.from('events').select('event_type').eq('event_id', args.eventId).maybeSingle(),
      admin.from('users').select('last_name').eq('user_id', args.senderUserId).maybeSingle(),
      admin.from('platform_settings').select('inquiry_split_own_enough').eq('id', 1).maybeSingle(),
    ]);
    for (const [name, r] of [['thread', threadRead], ['card', cardRead], ['team', teamRead], ['event', eventRead]] as const) {
      if (r.error) {
        logQueryError(`inquiry-routing: ${name}`, r.error, { event_id: args.eventId }, 'graceful_degrade');
        return 'failed';
      }
    }
    const thread = threadRead.data as { thread_id: string; handled_by_member_id: string | null } | null;
    if (!thread) return 'failed';
    const cardBranchId = (cardRead.data as { branch_id: string | null } | null)?.branch_id ?? null;
    const eventType = ((eventRead.data as { event_type: string | null } | null)?.event_type ?? null) || null;
    const team: RoutingMember[] = ((teamRead.data ?? []) as Array<{ vendor_team_member_id: string; duty: string; branch_id: string | null; deactivated_at: string | null; created_at: string }>).map((r) => ({
      memberId: r.vendor_team_member_id,
      duty: r.duty,
      branchId: r.branch_id,
      paused: !!r.deactivated_at,
      createdAt: r.created_at,
    }));

    let cardCoverIds: string[] = [];
    let adjusted: AdjustedCut[] = [];
    let counts = new Map<string, number>();
    if (args.serviceId) {
      const [coverRead, cutsRead] = await Promise.all([
        admin.from('vendor_service_agents').select('vendor_team_member_id').eq('vendor_service_id', args.serviceId),
        admin
          .from('vendor_inquiry_split_cuts')
          .select('vendor_team_member_id, from_prefix, to_prefix, event_type, branch_id')
          .eq('vendor_service_id', args.serviceId),
      ]);
      if (coverRead.error) {
        logQueryError('inquiry-routing: card cover', coverRead.error, { service: args.serviceId }, 'graceful_degrade');
        return 'failed';
      }
      cardCoverIds = ((coverRead.data ?? []) as Array<{ vendor_team_member_id: string }>).map((r) => r.vendor_team_member_id);
      const cuts = cutsRead.error ? [] : ((cutsRead.data ?? []) as Array<{ vendor_team_member_id: string; from_prefix: string; to_prefix: string | null; event_type: string | null; branch_id: string | null }>);
      if (cutsRead.error) logQueryError('inquiry-routing: adjusted cuts', cutsRead.error, { service: args.serviceId }, 'graceful_degrade');
      const onBranch = cuts.filter((c) => (c.branch_id ?? null) === cardBranchId);
      const forType = onBranch.filter((c) => c.event_type === eventType);
      adjusted = (forType.length > 0 ? forType : onBranch.filter((c) => c.event_type === null)).map((c) => ({
        memberId: c.vendor_team_member_id,
        from: c.from_prefix,
        to: c.to_prefix,
      }));

      const enough = Number((settingRead.data as { inquiry_split_own_enough: number | null } | null)?.inquiry_split_own_enough) || null;
      const own = enough ? await prefixCounts(admin, args.serviceId, eventType) : null;
      counts = own && total(own) >= (enough ?? Infinity) ? own : ((await prefixCounts(admin, null, eventType)) ?? new Map());
    }

    const decision = decideHandler({
      cardBranchId,
      cardCoverIds,
      team,
      adjusted,
      counts,
      lastName: (senderRead.data as { last_name: string | null } | null)?.last_name ?? null,
      currentHandlerId: thread.handled_by_member_id,
    });

    if (decision.kind === 'keep') return 'kept';
    if (decision.kind === 'nobody') return 'nobody';
    if (decision.kind === 'hand-over') {
      const { error } = await admin.from('chat_threads').update({ hand_over_member_id: decision.offerId }).eq('thread_id', thread.thread_id);
      if (error) {
        logQueryError('inquiry-routing: mark hand over', error, { thread: thread.thread_id }, 'graceful_degrade');
        return 'failed';
      }
      return 'hand-over';
    }
    const { error } = await admin
      .from('chat_threads')
      .update({ handled_by_member_id: decision.memberId, handled_by_set_at: new Date().toISOString() })
      .eq('thread_id', thread.thread_id)
      .is('handled_by_member_id', null);
    if (error) {
      logQueryError('inquiry-routing: assign', error, { thread: thread.thread_id }, 'graceful_degrade');
      return 'failed';
    }
    const who = await memberChatName(admin, args.vendorProfileId, decision.memberId);
    if (who) await postThreadSystemLine(admin, { eventId: args.eventId, vendorProfileId: args.vendorProfileId, body: handledByLine({ kind: 'first', who }) });
    return 'assigned';
  } catch (e) {
    logQueryError('inquiry-routing (threw)', e, { event_id: args.eventId }, 'graceful_degrade');
    return 'failed';
  }
}
