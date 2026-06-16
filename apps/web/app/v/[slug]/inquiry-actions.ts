'use server';

/**
 * startServiceInquiry — couple opens an inquiry from a vendor's public profile
 * (/v/[slug]) with structured per-service interest context (owner-locked
 * 2026-06-12 "Link-gated build cascade + multi-service inquiry mapping").
 *
 * Converges on the ONE chat_threads UNIQUE(event_id, vendor_profile_id) thread:
 *   1. Pick the couple's primary event (single active event; multi-event hosts
 *      use the dashboard flow).
 *   2. follow the vendor (satisfies the iteration 0019 follow-gate RLS).
 *   3. Upsert the thread by (event_id, vendor_profile_id) — an EXISTING thread
 *      resolves to UPDATE, so re-inquiring just appends interests instead of
 *      failing the UNIQUE constraint or spawning a second thread.
 *   4. Post the first couple message (only when the thread is brand-new / has no
 *      messages yet — never double-posts the inquiry note on a resumed thread).
 *   5. Record thread_service_interests: the clicked service (source='initial'),
 *      its price-included vendor_service_links (source='linked'), and any extra
 *      standalone services the couple opted into (source='couple_added').
 *
 * Does NOT touch the token/accept flow — interests are metadata on the single
 * thread + the single burn-on-answer unlock (a re-accept is free + un-gated, so
 * cross-sell can never double-charge the vendor).
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserEvents } from '@/lib/events';
import { followVendor } from '@/lib/follow-actions';
import { sendChatMessage } from '@/lib/chat-actions';
import { recordThreadInterests, type InterestSeed } from '@/lib/thread-interests';
import { resolveLivePax } from '@/lib/pax';

const INQUIRY_BODY =
  "Hi! We're planning our wedding and would love to hear about your " +
  'availability and packages for our date. Could you share your rates and ' +
  "what's included?";

export type StartServiceInquiryResult =
  | { status: 'ok'; threadId: string; eventId: string; isExisting: boolean }
  | { status: 'not_signed_in' }
  | { status: 'no_event' }
  | { status: 'error'; message: string };

export async function startServiceInquiry(input: {
  vendorProfileId: string;
  /** vendor_service the couple clicked Inquire on → source='initial'. */
  initialServiceId: string;
  /** Canonical category for the initial service (display/scoping). */
  initialCategoryKey: string | null;
  /** Extra standalone services the couple opted into → source='couple_added'. */
  alsoServiceIds: string[];
}): Promise<StartServiceInquiryResult> {
  const vendorProfileId = String(input.vendorProfileId ?? '').trim();
  const initialServiceId = String(input.initialServiceId ?? '').trim();
  if (!vendorProfileId || !initialServiceId) {
    return { status: 'error', message: 'Missing vendor or service' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  // Primary event — the public-profile composer targets the couple's single
  // active event. Multi-event hosts pick the event explicitly on the dashboard.
  const events = await fetchUserEvents(supabase, user.id, 'couple');
  const eventId = events[0]?.event_id ?? null;
  if (!eventId) return { status: 'no_event' };

  const admin = createAdminClient();

  // Check for an existing non-declined thread BEFORE touching follow/upsert.
  // The composer uses this to surface "You already have an inquiry" + "View thread".
  const { data: existingThread } = await supabase
    .from('chat_threads')
    .select('thread_id, inquiry_status')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const isExisting =
    existingThread?.thread_id != null &&
    (existingThread as { inquiry_status?: string | null }).inquiry_status !== 'declined';

  // Validate the submitted service ids belong to THIS vendor + are active —
  // host-supplied form data, so a stale/forged id should be dropped, not
  // recorded. adminClient bypasses vendor_services RLS (same pattern as the
  // dashboard add actions).
  const requestedIds = Array.from(
    new Set([initialServiceId, ...input.alsoServiceIds.map((s) => String(s).trim())].filter(Boolean)),
  );
  const { data: ownedServices } = await admin
    .from('vendor_services')
    .select('vendor_service_id, category')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true)
    .in('vendor_service_id', requestedIds);
  const ownedById = new Map(
    (ownedServices ?? []).map((s) => [
      s.vendor_service_id as string,
      (s.category as string | null) ?? null,
    ]),
  );
  if (!ownedById.has(initialServiceId)) {
    return { status: 'error', message: 'That service is no longer available.' };
  }

  // Check for an existing open thread before creating a new one. If a thread
  // already exists for this (event, vendor) pair with a non-declined status, we
  // surface a "View thread" redirect so the couple doesn't open a second thread.
  // We detect via chat_threads UNIQUE(event_id, vendor_profile_id): the upsert
  // below would converge anyway, but we want to tell the UI whether this is a
  // brand-new inquiry (isExisting=false → redirect to thread) vs. a resumption
  // of an existing one (isExisting=true → also redirect to thread, no modal).
  const { data: existingThread } = await supabase
    .from('chat_threads')
    .select('thread_id, inquiry_status')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const isExisting =
    existingThread?.thread_id != null &&
    existingThread.inquiry_status !== 'declined';

  // follow → upsert thread → first message (best-effort message). Mirrors the
  // canonical inquiry pattern in unlock-category.ts.
  try {
    await followVendor(vendorProfileId);
  } catch {
    /* follow is the gate; the upsert below also passes for an existing thread */
  }

  // Live pax to snapshot onto this inquiry (Adaptive Pax Pricing Phase 3).
  const livePax = await resolveLivePax(supabase, eventId);

  const { data: thread, error: threadErr } = await supabase
    .from('chat_threads')
    .upsert(
      {
        event_id: eventId,
        vendor_profile_id: vendorProfileId,
        created_by_user_id: user.id,
        ...(livePax != null ? { pax_current: livePax } : {}),
      },
      { onConflict: 'event_id,vendor_profile_id' },
    )
    .select('thread_id, pax_at_inquiry')
    .single();
  if (threadErr || !thread?.thread_id) {
    return {
      status: 'error',
      message: threadErr?.message ?? 'Could not open the conversation.',
    };
  }
  const threadId = thread.thread_id as string;
  // Snapshot the count the vendor first quoted against, exactly once.
  if (livePax != null && thread.pax_at_inquiry == null) {
    await supabase
      .from('chat_threads')
      .update({ pax_at_inquiry: livePax })
      .eq('thread_id', threadId);
  }

  // Only post the inquiry note when the thread has no messages yet — a resumed
  // thread (couple re-inquiring about more services) just gets the new
  // interests, not a duplicate inquiry message.
  const { count: msgCount } = await admin
    .from('chat_messages')
    .select('message_id', { count: 'exact', head: true })
    .eq('thread_id', threadId);
  if ((msgCount ?? 0) === 0) {
    try {
      const msg = new FormData();
      msg.set('thread_id', threadId);
      msg.set('body', INQUIRY_BODY);
      await sendChatMessage(msg);
    } catch {
      /* best-effort — the thread + interests stand even if the note fails */
    }
  }

  // Build the interest seeds: initial → its linked services → couple_added.
  // Also track confirmedServiceIds for persisting to event_vendors.
  const confirmedServiceIds: string[] = [initialServiceId];
  const seeds: InterestSeed[] = [
    {
      vendorServiceId: initialServiceId,
      categoryKey: input.initialCategoryKey ?? ownedById.get(initialServiceId) ?? null,
      source: 'initial',
    },
  ];

  const { data: links } = await admin
    .from('vendor_service_links')
    .select('linked_canonical_service')
    .eq('vendor_service_id', initialServiceId);
  for (const link of links ?? []) {
    const key = (link as { linked_canonical_service?: string | null }).linked_canonical_service;
    if (key) seeds.push({ vendorServiceId: null, categoryKey: key, source: 'linked' });
  }

  // Build the full set of validated service IDs for requested_service_ids
  const confirmedServiceIds: string[] = [initialServiceId];
  for (const rawId of input.alsoServiceIds) {
    const id = String(rawId).trim();
    if (!id || id === initialServiceId || !ownedById.has(id)) continue;
    seeds.push({
      vendorServiceId: id,
      categoryKey: ownedById.get(id) ?? null,
      source: 'couple_added',
    });
    confirmedServiceIds.push(id);
  }

  await recordThreadInterests(supabase, {
    threadId,
    addedByRole: 'couple',
    seeds,
  });

  // Persist requested_service_ids onto the event_vendors row that links this
  // couple's event to this marketplace vendor. The upsert on chat_threads above
  // guarantees the thread exists; the event_vendors row may have been created
  // by a prior save-to-picks or auto-add. We use array_cat to merge (not
  // overwrite) so a resumed inquiry adds new services to the existing set.
  // Best-effort: a missing row or missing column (migration not yet applied)
  // must never block the inquiry.
  try {
    // Look up the event_vendors row for this (event, marketplace_vendor) pair.
    const { data: evRow } = await supabase
      .from('event_vendors')
      .select('vendor_id, requested_service_ids')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', vendorProfileId)
      .maybeSingle();

    if (evRow?.vendor_id) {
      // Merge: union the new service IDs with any already stored. Cast through
      // unknown to satisfy TypeScript's strict mode — the column is a new
      // nullable/jsonb-like UUID[] field that the generated types may not know yet.
      const existing: string[] = Array.isArray(
        (evRow as unknown as { requested_service_ids?: string[] }).requested_service_ids,
      )
        ? ((evRow as unknown as { requested_service_ids: string[] }).requested_service_ids)
        : [];
      const merged = Array.from(new Set([...existing, ...confirmedServiceIds]));
      await supabase
        .from('event_vendors')
        .update({ requested_service_ids: merged } as Record<string, unknown>)
        .eq('vendor_id', evRow.vendor_id as string);
    } else if (confirmedServiceIds.length > 0) {
      // No event_vendors row yet — create a minimal one so the service list is
      // persisted. This mirrors the auto-add path in unlock-category.ts.
      // Resolve the initial service's category for the required 'category' column.
      const categoryForRow = ownedById.get(initialServiceId) ?? null;
      if (categoryForRow) {
        // Fetch vendor name for the vendor_name column (required, non-null in schema).
        const { data: profRow } = await admin
          .from('vendor_profiles')
          .select('business_name')
          .eq('vendor_profile_id', vendorProfileId)
          .maybeSingle();
        const vendorNameForRow =
          (profRow as { business_name?: string | null } | null)?.business_name?.trim() || 'Vendor';
        await supabase.from('event_vendors').insert({
          event_id: eventId,
          category: categoryForRow,
          vendor_name: vendorNameForRow,
          status: 'considering',
          marketplace_vendor_id: vendorProfileId,
          service_id: initialServiceId,
          requested_service_ids: confirmedServiceIds,
        } as Record<string, unknown>);
      }
    }
  } catch {
    /* best-effort — thread + interests already landed; service-id list can
       be reconstructed from thread_service_interests if the column is missing */
  }

  revalidatePath(`/dashboard/${eventId}/messages/${threadId}`);
  return { status: 'ok', threadId, eventId, isExisting };
}
