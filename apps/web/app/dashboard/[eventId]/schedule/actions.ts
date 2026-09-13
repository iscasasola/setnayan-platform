'use server';

import { revalidatePath } from 'next/cache';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  SCHEDULE_BLOCK_TYPES,
  buildScheduleSeed,
  fetchScheduleBlocks,
  type ScheduleBlockType,
  type SeedCeremonyType,
} from '@/lib/schedule';
import { fetchGuestsByEvent } from '@/lib/guests';
import { buildEmceeScript } from '@/lib/emcee-script';
import { buildRunOfShowSeed } from '@/lib/schedule-run-of-show';
import { computeRetimePatches } from '@/lib/schedule-ros';
import {
  getScheduleTemplate,
  buildTemplateInsertRows,
  templatesForEventType,
} from '@/lib/schedule-templates';
// Travel multi-day itineraries (ai-travel-scheduling): the two travel-only
// block types ('lodging' night-blocks + 'tour' time-blocks) are accepted
// ONLY on travel events, and a tour that overlaps another tour is rejected
// at save with the GRD-06 clash copy. Non-travel events never reach any of
// these branches, so their behavior is byte-identical.
import {
  findTourOverlap,
  isTravelEventType,
  isTravelOnlyBlockType,
  tourDoubleBookMessage,
} from '@/lib/schedule-travel';
import { isCoordinatorPrepReleaseEnabled } from '@/lib/coordinator-prep-release';

const VALID_TYPES = new Set<ScheduleBlockType>(SCHEDULE_BLOCK_TYPES);

/**
 * Coordinator P1: is this user the event's EXTERNAL coordinator
 * (event_moderators role_subtype='wedding_planner_external', accepted, not
 * removed)? Gates prep-then-release so the couple (backfilled as partner1/
 * partner2 moderators) and family delegates can't stage/hide schedule items
 * from the couple.
 */
async function isEventCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('role_subtype', 'wedding_planner_external')
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  return !!data;
}

/** events.event_type for an RLS-visible event; null when unreadable. */
async function fetchEventType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('events')
    .select('event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  return (data?.event_type as string | null | undefined) ?? null;
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function parseDatetimeLocal(raw: FormDataEntryValue | null): string | null {
  // The wall clock the couple typed, stored verbatim. Its twin — the prefill —
  // lives in the same module so the two can never disagree again; when they
  // did, saving without editing moved the block eight hours.
  return typeof raw === 'string' ? fromDatetimeLocalValue(raw) : null;
}

export async function createScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const label = formData.get('label');
  const blockTypeRaw = formData.get('block_type');
  const startRaw = formData.get('start_at');
  const endRaw = formData.get('end_at');

  if (typeof eventId !== 'string' || typeof label !== 'string') {
    throw new Error('Invalid input');
  }
  if (
    typeof blockTypeRaw !== 'string' ||
    (!VALID_TYPES.has(blockTypeRaw as ScheduleBlockType) &&
      !isTravelOnlyBlockType(blockTypeRaw))
  ) {
    throw new Error('Invalid block type');
  }
  const trimmedLabel = label.trim().slice(0, 120);
  if (trimmedLabel.length === 0) throw new Error('Label required');

  const startIso = parseDatetimeLocal(startRaw);
  const endIso = parseDatetimeLocal(endRaw);
  if (!startIso) throw new Error('Start time required');
  if (endIso && new Date(endIso) <= new Date(startIso)) {
    throw new Error('End time must be after start time');
  }

  // 2026-05-24 owner directive · Card 15 hierarchy. Optional parent_block_id
  // form field — when present, the inserted block is a child of an existing
  // block (e.g., a new "Sand ceremony" part inside the Ceremony parent).
  // When NULL or absent, the inserted block is top-level.
  const parentBlockIdRaw = formData.get('parent_block_id');
  const parentBlockId =
    typeof parentBlockIdRaw === 'string' && parentBlockIdRaw.length > 0
      ? parentBlockIdRaw
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Travel-only itinerary classes: 'lodging' / 'tour' are valid ONLY on a
  // travel event (defense against form tampering — the non-travel add-form
  // never offers them). And no two tours may overlap: a double-book is
  // rejected at save with the GRD-06 clash copy (ai-travel-scheduling).
  if (isTravelOnlyBlockType(blockTypeRaw)) {
    const eventType = await fetchEventType(supabase, eventId);
    if (!isTravelEventType(eventType)) {
      throw new Error('Hotel stays and tours are only available on travel events');
    }
    if (blockTypeRaw === 'tour') {
      const existing = await fetchScheduleBlocks(supabase, eventId);
      const conflict = findTourOverlap({ start_at: startIso, end_at: endIso }, existing);
      if (conflict) {
        throw new Error(
          tourDoubleBookMessage(
            { label: trimmedLabel, start_at: startIso, end_at: endIso },
            conflict,
          ),
        );
      }
    }
  }

  const insertRow: Record<string, unknown> = {
    event_id: eventId,
    label: trimmedLabel,
    block_type: blockTypeRaw,
    start_at: startIso,
    end_at: endIso,
    location: nullIfBlank(formData.get('location')),
    notes: nullIfBlank(formData.get('notes')),
    is_public: formData.get('is_public') === 'on',
    parent_block_id: parentBlockId,
  };
  // Coordinator P1 prep-then-release: an external coordinator may create a block
  // STAGED (coordinator_only, hidden from the couple until released). Gated by
  // the flag + coordinator role; flag-off / couple / family → couple_visible
  // (the DB default) and the column is never referenced.
  if ((await isCoordinatorPrepReleaseEnabled()) && formData.get('prep') === 'on') {
    if (await isEventCoordinator(supabase, user.id, eventId)) {
      insertRow.visibility = 'coordinator_only';
    }
  }
  const { error } = await supabase.from('event_schedule_blocks').insert(insertRow);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

export async function deleteScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  if (typeof eventId !== 'string' || typeof blockId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ON DELETE CASCADE on parent_block_id self-FK means deleting a parent
  // automatically removes all its child parts · no app-layer cleanup needed.
  const { error } = await supabase
    .from('event_schedule_blocks')
    .delete()
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

export async function toggleBlockVisibility(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  const desiredRaw = formData.get('desired');
  if (
    typeof eventId !== 'string' ||
    typeof blockId !== 'string' ||
    typeof desiredRaw !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  const desired = desiredRaw === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update({ is_public: desired, updated_at: new Date().toISOString() })
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Coordinator P1 prep-then-release: STAGE a block (coordinator_only — hidden
 * from the couple, guests, and booked vendors) or RELEASE it to the couple
 * (couple_visible — stamps released_at). Only the external coordinator may call
 * this (the couple can't see staged blocks to begin with). Flag-gated.
 */
export async function setBlockPrepVisibility(formData: FormData) {
  if (!(await isCoordinatorPrepReleaseEnabled())) {
    throw new Error('Prep-then-release is not enabled.');
  }
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  const desired = formData.get('visibility');
  if (
    typeof eventId !== 'string' ||
    typeof blockId !== 'string' ||
    (desired !== 'coordinator_only' && desired !== 'couple_visible')
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!(await isEventCoordinator(supabase, user.id, eventId))) {
    throw new Error('Only the event coordinator can stage or release schedule items.');
  }

  const patch: { visibility: string; updated_at: string; released_at?: string } = {
    visibility: desired,
    updated_at: new Date().toISOString(),
  };
  // Releasing to the couple stamps the moment; staging leaves released_at as-is.
  if (desired === 'couple_visible') patch.released_at = new Date().toISOString();

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update(patch)
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

// ────────────────────  Card 15 hierarchy actions  ────────────────────
//
// Server actions wired by Card 15 (Create Schedule wizard card) for
// inline edits to the schedule block tree. They share the same RLS-gated
// pattern as the existing create/delete/toggle actions above — the
// authenticated supabase client respects the event_schedule_blocks
// couple-write policy, so a host can only mutate blocks on their own
// event.
//
// All four revalidate BOTH the /schedule deep-edit page AND the event
// home (/dashboard/[eventId]) where the wizard card renders, so edits in
// either surface re-fetch the other.

/**
 * Update label · start · end · is_public on an existing block. Card 15
 * uses this for the inline time pickers + label input. Other surfaces
 * (/schedule deep-edit page) can call the same action with the full set
 * of fields they edit.
 */
export async function updateScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');

  if (typeof eventId !== 'string' || typeof blockId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  type Patch = {
    label?: string;
    start_at?: string;
    end_at?: string | null;
    is_public?: boolean;
    location?: string | null;
    notes?: string | null;
    updated_at: string;
  };
  const patch: Patch = { updated_at: new Date().toISOString() };

  const labelRaw = formData.get('label');
  if (typeof labelRaw === 'string') {
    const trimmed = labelRaw.trim().slice(0, 120);
    if (trimmed.length === 0) throw new Error('Label cannot be empty');
    patch.label = trimmed;
  }

  const startRaw = formData.get('start_at');
  if (startRaw !== null) {
    const iso = parseDatetimeLocal(startRaw);
    if (!iso) throw new Error('Invalid start time');
    patch.start_at = iso;
  }

  const endRaw = formData.get('end_at');
  if (endRaw !== null) {
    if (typeof endRaw === 'string' && endRaw.length === 0) {
      patch.end_at = null;
    } else {
      const iso = parseDatetimeLocal(endRaw);
      if (!iso) throw new Error('Invalid end time');
      patch.end_at = iso;
    }
  }

  const visibilityRaw = formData.get('is_public');
  if (visibilityRaw !== null) {
    patch.is_public = visibilityRaw === 'true' || visibilityRaw === 'on';
  }

  const locationRaw = formData.get('location');
  if (locationRaw !== null) {
    patch.location = nullIfBlank(locationRaw);
  }

  const notesRaw = formData.get('notes');
  if (notesRaw !== null) {
    patch.notes = nullIfBlank(notesRaw);
  }

  // Travel double-book guard on retime (ai-travel-scheduling): moving a TOUR
  // block onto another tour's slot is rejected at save, mirroring create.
  // The extra read runs only when a time actually changes; non-tour blocks
  // (every block on every non-travel event) skip straight to the update.
  if (patch.start_at !== undefined || patch.end_at !== undefined) {
    const { data: current } = await supabase
      .from('event_schedule_blocks')
      .select('block_type, label, start_at, end_at')
      .eq('block_id', blockId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (current?.block_type === 'tour') {
      const nextStart = patch.start_at ?? (current.start_at as string);
      const nextEnd =
        patch.end_at !== undefined ? patch.end_at : ((current.end_at as string | null) ?? null);
      const existing = await fetchScheduleBlocks(supabase, eventId);
      const conflict = findTourOverlap(
        { start_at: nextStart, end_at: nextEnd, block_id: blockId },
        existing,
      );
      if (conflict) {
        throw new Error(
          tourDoubleBookMessage(
            {
              label: patch.label ?? ((current.label as string) || 'This tour'),
              start_at: nextStart,
              end_at: nextEnd,
            },
            conflict,
          ),
        );
      }
    }
  }

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update(patch)
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Reorder blocks within a single level (top-level OR siblings under the
 * same parent). Caller passes the ORDERED list of block_ids · server
 * assigns sort_order = idx * 10 (gap-10 spacing leaves room for insertion
 * without a full reorder on every add).
 *
 * Bulk update via individual statements per row · acceptable for V1
 * because a wedding-day schedule is bounded (typically ~20-30 blocks
 * total · max realistic ~50). If we hit perf issues at scale, switch to
 * a single UPDATE … SET sort_order = CASE block_id WHEN … THEN … ELSE …
 * END statement via supabase.rpc.
 */
export async function reorderScheduleBlocks(formData: FormData) {
  const eventId = formData.get('event_id');
  const orderedIdsRaw = formData.get('ordered_block_ids');

  if (typeof eventId !== 'string' || typeof orderedIdsRaw !== 'string') {
    throw new Error('Invalid input');
  }

  // Expected payload shape: comma-separated UUIDs in target order.
  const orderedIds = orderedIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (orderedIds.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('event_schedule_blocks')
      .update({ sort_order: (i + 1) * 10, updated_at: now })
      .eq('block_id', orderedIds[i]!)
      .eq('event_id', eventId);
    if (error) throw new Error(`Reorder failed at row ${i}: ${error.message}`);
  }

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/*
  ─── BOTH FIRST-OPEN SCHEDULE SEEDS ARE GONE FROM THIS FILE ──────────────

  `seedNonWeddingRunOfShow` MOVED OUT (2026-08-21) — it lives in
  `lib/schedule-seed.server.ts` now. It was never a form action: the schedule
  PAGE was its only caller, and it called it during render, where the two
  `revalidatePath` calls at the end of it are fatal. Every first-ever visit to a
  non-wedding event's Schedule returned a 500, and because the INSERT commits
  before the revalidate, refreshing made it go away.

  `seedDefaultScheduleBlocks` DELETED (2026-09-03) — the WEDDING twin of that
  same mistake, and the reason this note now covers both. Same shape (an
  idempotent seed-into-empty, written for "Card 15 first-open"), same fatal tail
  (two `revalidatePath` calls), and zero callers: the wedding branch of
  `schedule/page.tsx` never seeds — the comment there says weddings "keep their
  own (separate) spine and are untouched."

  🔑 What actually fills an empty wedding schedule is `loadScheduleTemplate`
  below, wired from `_components/ros-p2.tsx` — additive-into-empty, and SUBMITTED
  by the host. That is the difference that matters: a `'use server'` module is
  for things a person submits. Had anyone ever wired this one as designed, it
  would have shipped the identical 500 a second time.

  Do not move either back.
*/

/**
 * Compile the Emcee / Host script for the wedding day. Fetches the event header,
 * the schedule blocks (run-of-show), and the guest list (for the wedding-party
 * roster), then runs the pure `buildEmceeScript` compiler. RLS-gated via the
 * authenticated client — a host can only generate their own event's script.
 *
 * Returns the formatted plain-text script for the client to copy / download.
 * `includePrivate` lets the host include private blocks (family-only ritual
 * parts) in their personal reading copy.
 */
export async function generateEmceeScript(
  eventId: string,
  includePrivate = false,
): Promise<string> {
  if (!eventId) throw new Error('event_id required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [eventRes, blocks, guests] = await Promise.all([
    supabase
      .from('events')
      .select('display_name, event_date')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchScheduleBlocks(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);

  const event = eventRes.data ?? { display_name: null, event_date: null };
  return buildEmceeScript({
    event: {
      displayName: (event as { display_name: string | null }).display_name ?? null,
      eventDate: (event as { event_date: string | null }).event_date ?? null,
    },
    blocks,
    guests,
    options: { includePrivateBlocks: includePrivate },
  });
}

/**
 * Resolve a vendor timeline suggestion — feature-access program Phase 3
 * (corpus 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 4).
 * Accept applies the proposal (adjust → update the block's proposed fields;
 * new → create a draft block); decline just flips the status. RLS gates both
 * sides: the suggestion UPDATE policy + the block write policies admit the
 * couple and delegates holding schedule edit, nobody else.
 */
export async function resolveScheduleSuggestion(formData: FormData) {
  const eventId = formData.get('event_id');
  const suggestionId = formData.get('suggestion_id');
  const decision = formData.get('decision');
  if (
    typeof eventId !== 'string' ||
    typeof suggestionId !== 'string' ||
    (decision !== 'accept' && decision !== 'decline')
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: suggestion } = await supabase
    .from('event_schedule_suggestions')
    .select(
      'suggestion_id, block_id, kind, proposed_label, proposed_start_at, proposed_end_at, proposed_location, note, status, vendor_profile_id',
    )
    .eq('suggestion_id', suggestionId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!suggestion || suggestion.status !== 'open') {
    redirect(`/dashboard/${eventId}/schedule?view=event-day`);
  }

  if (decision === 'accept') {
    if (suggestion.kind === 'adjust' && suggestion.block_id) {
      const patch: Record<string, string> = {};
      if (suggestion.proposed_start_at) patch.start_at = suggestion.proposed_start_at;
      if (suggestion.proposed_end_at) patch.end_at = suggestion.proposed_end_at;
      if (suggestion.proposed_location) patch.location = suggestion.proposed_location;
      if (suggestion.proposed_label) patch.label = suggestion.proposed_label;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from('event_schedule_blocks')
          .update(patch)
          .eq('block_id', suggestion.block_id)
          .eq('event_id', eventId);
        if (error) throw new Error(error.message);
      }
    } else if (suggestion.kind === 'new') {
      // Lands as a PRIVATE draft — the couple decides when guests see it.
      const { error } = await supabase.from('event_schedule_blocks').insert({
        event_id: eventId,
        label: (suggestion.proposed_label ?? 'Vendor-requested slot').slice(0, 120),
        block_type: 'custom',
        start_at: suggestion.proposed_start_at,
        end_at: suggestion.proposed_end_at,
        location: suggestion.proposed_location,
        notes: suggestion.note,
        is_public: false,
      });
      if (error) throw new Error(error.message);
    }
  }

  const { error: resolveError } = await supabase
    .from('event_schedule_suggestions')
    .update({
      status: decision === 'accept' ? 'accepted' : 'declined',
      resolved_by_user_id: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('suggestion_id', suggestionId)
    .eq('event_id', eventId)
    .eq('status', 'open');
  if (resolveError) throw new Error(resolveError.message);

  // Notify the suggesting vendor of the couple's decision (best-effort — the
  // suggestion is already resolved; a failed notify must not roll it back).
  // The status flip lives on the couple's table; the vendor has no read-push,
  // so without this the vendor never learns their proposal was accepted or
  // declined. Resolve the vendor's user_id via the admin client.
  if (suggestion.vendor_profile_id) {
    try {
      const admin = createAdminClient();
      const [vendorRes, eventRes] = await Promise.all([
        admin
          .from('vendor_profiles')
          .select('user_id')
          .eq('vendor_profile_id', suggestion.vendor_profile_id)
          .maybeSingle(),
        admin
          .from('events')
          .select('display_name')
          .eq('event_id', eventId)
          .maybeSingle(),
      ]);
      if (vendorRes.data?.user_id) {
        const eventName = eventRes.data?.display_name?.trim() || 'the couple';
        const accepted = decision === 'accept';
        await emitNotification({
          userId: vendorRes.data.user_id,
          type: 'schedule_suggestion',
          title: accepted
            ? `${eventName} accepted your timeline suggestion`
            : `${eventName} declined your timeline suggestion`,
          body: accepted
            ? 'Your proposed change is now on their schedule.'
            : 'Your proposed change was not applied.',
          relatedUrl: `/vendor-dashboard/clients/${eventId}`,
        });
      }
    } catch (e) {
      console.error('[resolveScheduleSuggestion] vendor notify failed:', e);
    }
  }

  revalidatePath(`/dashboard/${eventId}/schedule`);
  redirect(`/dashboard/${eventId}/schedule?view=event-day`);
}

// ─────────────────  Coordinator P2 · filtered run-of-show  ─────────────────
//
// Three actions (Coordinator_Whats_Next_2026-07-18 §P2), all through the
// AUTHENTICATED client so the existing RLS decides who may write: the couple
// (couple_write) and a coordinator holding the moderator schedule-'edit'
// grant (event_schedule_blocks_moderator_write, 20261129003000). No new
// permission surface. UI entry points are gated by the in-app Data Privacy
// board control 'coordinator_run_of_show' (isDataPrivacyControlActive), NOT by
// an env var. This comment named NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED, which no
// code has ever read — and that control is `active` in prod, so these surfaces
// are LIVE, not inert (verified against the live DB 2026-08-06).

/**
 * Set the responsible party on one run-of-show row: the free-text label
 * (vendor / crew / family) and/or the tagged event-vendor ids that drive the
 * per-vendor filtered view. Tagged ids are validated against THIS event's
 * vendor registry so a row can never reference another event's vendor.
 */
export async function setBlockResponsibleParty(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  if (typeof eventId !== 'string' || typeof blockId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const responsibleParty = nullIfBlank(formData.get('responsible_party'));
  if (responsibleParty && responsibleParty.length > 120) {
    throw new Error('Responsible party must be 120 characters or fewer');
  }

  // Multi-select posts one entry per selected vendor. Intersect with the
  // event's own vendor registry (RLS-scoped read) — anything else is dropped.
  const requestedVendorIds = formData
    .getAll('responsible_vendor_ids')
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  let vendorIds: string[] = [];
  if (requestedVendorIds.length > 0) {
    const { data: eventVendors, error: vendorsErr } = await supabase
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', eventId);
    if (vendorsErr) throw new Error(vendorsErr.message);
    const valid = new Set((eventVendors ?? []).map((v) => v.vendor_id as string));
    vendorIds = [...new Set(requestedVendorIds)].filter((id) => valid.has(id));
  }

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update({
      responsible_party: responsibleParty,
      responsible_vendor_ids: vendorIds,
      updated_at: new Date().toISOString(),
    })
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Bulk retime — shift a contiguous span of the run-of-show by ±N minutes in
 * ONE action: the anchor block and everything after it (optionally stopping
 * at `to_block_id`), children travelling with their parents. The classic
 * "ceremony ran 30 minutes late → cascade the rest of the day".
 *
 * Span + patch math is the pure `computeRetimePatches` (unit-tested);
 * durations are preserved by construction so the end_at > start_at CHECK can
 * never break. Row-by-row UPDATEs mirror reorderScheduleBlocks — bounded
 * (~50 rows max) and each write re-checked by RLS.
 */
export async function bulkRetimeScheduleBlocks(formData: FormData) {
  const eventId = formData.get('event_id');
  const fromBlockId = formData.get('from_block_id');
  const toBlockIdRaw = formData.get('to_block_id');
  const deltaRaw = formData.get('delta_minutes');
  if (
    typeof eventId !== 'string' ||
    typeof fromBlockId !== 'string' ||
    fromBlockId.length === 0 ||
    typeof deltaRaw !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  const deltaMinutes = Number(deltaRaw);
  if (!Number.isFinite(deltaMinutes)) throw new Error('Invalid shift amount');
  const toBlockId =
    typeof toBlockIdRaw === 'string' && toBlockIdRaw.length > 0 ? toBlockIdRaw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS-scoped read — rows only come back if the caller can see this event.
  const blocks = await fetchScheduleBlocks(supabase, eventId);
  const patches = computeRetimePatches(blocks, fromBlockId, deltaMinutes, toBlockId);
  if (patches.length === 0) return;

  const now = new Date().toISOString();
  for (const patch of patches) {
    const { error } = await supabase
      .from('event_schedule_blocks')
      .update({ start_at: patch.start_at, end_at: patch.end_at, updated_at: now })
      .eq('block_id', patch.block_id)
      .eq('event_id', eventId);
    if (error) throw new Error(`Retime failed at ${patch.block_id}: ${error.message}`);
  }

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Load a run-of-show template into an EMPTY schedule. Strictly
 * additive-into-empty: any existing block (even one) makes this a no-op —
 * a template can NEVER overwrite or merge over rows the couple authored.
 * Insert goes through the authenticated client, so the couple and a
 * schedule-'edit' coordinator can load one; nobody else can.
 */
export async function loadScheduleTemplate(formData: FormData) {
  const eventId = formData.get('event_id');
  const templateId = formData.get('template_id');
  if (typeof eventId !== 'string' || typeof templateId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const template = getScheduleTemplate(templateId);
  if (!template) throw new Error('Unknown template');

  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('event_type, event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  const eventType = (ev?.event_type as string | null | undefined) ?? 'wedding';
  if (!templatesForEventType(eventType).some((t) => t.id === template.id)) {
    throw new Error('Template not available for this event type');
  }

  // The never-overwrite guard: refuse when ANY row exists.
  const { data: existing, error: existingErr } = await supabase
    .from('event_schedule_blocks')
    .select('block_id')
    .eq('event_id', eventId)
    .limit(1);
  if (existingErr) throw new Error(existingErr.message);
  if (existing && existing.length > 0) return;

  const rows = buildTemplateInsertRows(
    template,
    (ev?.event_date as string | null | undefined) ?? null,
  ).map((row) => ({ ...row, event_id: eventId }));

  const { error } = await supabase.from('event_schedule_blocks').insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}
