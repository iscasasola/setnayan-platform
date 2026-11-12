'use server';

import { scheduleAudienceForWrite } from '@/lib/schedule-audience';
import { revalidatePath } from 'next/cache';
import { makerQuietWrite } from '@/lib/maker-live-preview';
import { fromDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadRoleNames } from '@/lib/role-names.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { notifyScheduleShifted } from '@/lib/schedule-shift-notify.server';
// ⏭ Where a moment "right after the one above" goes (4 additions (1), migration 20271302727358).
import { rightAfterPlace } from '@/lib/moment-follow.server';
import { isOrMinutes, isTimeShape, type TimeShape } from '@/lib/time-shape';
// 🔔 THE ONE NOTIFIER for a host's change to a supplier's part (audit D6): read BEFORE the write, tell AFTER it.
import { partBefore, postChapterMovedLines, tellPartSuppliers } from '@/lib/supplier-part-notify.server';
import { timesThatStay } from '@/lib/schedule-hand-in-hand';
// 🔒 CHANGE LOCK (audit D7): a change to a LOCKED supplier's part is refused here, in words, before any write — and by
// the database's `*_part_lock` triggers (20271303409352) whatever door it comes through.
import { refuseLockedPart } from '@/lib/supplier-part-lock.server';
import { patchTouchesPart } from '@/lib/supplier-part-lock';
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
import { APPROVE_ALL_MAX, computeRetimePatches } from '@/lib/schedule-ros';
// ✅ The ONE accept path — Approve, Approve all and Auto-agree all run it (moved to lib in Step 4b).
import { NOTHING_CHANGED, decideSuggestion } from '@/lib/schedule-suggestion-decide.server';
import type { ScheduleRequestAnswer } from '@/lib/schedule-request-answer';
import {
  FAITH_TEMPLATE_ID,
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
import { eventWordsForEvent, untitledEventName } from '@/app/[slug]/_lib/event-words';
import { refuseLimitedHelper } from '@/lib/host-gate';
import { userHostsEvent } from '@/lib/events';
import { isCallLead, isMomentOp, isPhotoWhen, isPhotoWho } from '@/lib/schedule-chapters';
import { runMomentOp } from '@/lib/schedule-chapters.server';
import { askSupplierToChange } from '@/lib/schedule-ask.server';
import { runMomentMarch } from './moment-march-step';

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
    .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
    .is('removed_at', null)
    .maybeSingle();
  return !!data;
}

/**
 * 👁 ONLY THE HOSTS AND THE COORDINATOR SHOW A MOMENT TO GUESTS (owner 2026-10-29, answering "Who can show schedule
 * items to guests?": *"coordinator and host/s of the event"*; DECISION_LOG "SUPPLIERS › BOOKED = TEAM · BUDGET ·
 * SCHEDULE"). "Host" is the ONE definition every host check reads — `userHostsEvent`: the couple, and an accepted
 * primary host role, the external coordinator among them. A helper who may edit the day still edits it; a moment
 * they add starts hidden from guests, and turning one ON for guests is refused in words. A refused check is a no.
 */
const ONLY_HOSTS_SHOW_GUESTS = 'Only the hosts and the coordinator can show a moment to guests.';

async function mayShowToGuests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventId: string,
): Promise<boolean> {
  try {
    return await userHostsEvent(supabase, userId, eventId);
  } catch {
    return false;
  }
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

/**
 * 🕑 How a moment's clock is meant (4 additions (2), migration 20271303051692): `time_shape` 'at' · 'about' · 'or', and
 * on 'or' the second time as `time_or_minutes` after the start (1–240). Null when nothing was posted; an unknown word
 * or a second time out of range is refused here, and again by the column's CHECK.
 */
function timeShapeFrom(formData: FormData): { time_shape: TimeShape; time_or_minutes: number | null } | null {
  const raw = formData.get('time_shape');
  if (raw === null) return null;
  if (!isTimeShape(raw)) throw new Error('Invalid time');
  if (raw !== 'or') return { time_shape: raw, time_or_minutes: null };
  const n = Number(formData.get('time_or_minutes'));
  if (!isOrMinutes(n)) throw new Error('The second time must be after the first, and within 4 hours of it.');
  return { time_shape: 'or', time_or_minutes: n };
}

function parseDatetimeLocal(raw: FormDataEntryValue | null): string | null {
  // The wall clock the couple typed, stored verbatim. Its twin — the prefill —
  // lives in the same module so the two can never disagree again; when they
  // did, saving without editing moved the block eight hours.
  return typeof raw === 'string' ? fromDatetimeLocalValue(raw) : null;
}

/**
 * ⚡ A SCHEDULE EDIT FROM THE EVENT HUB MAKER REVALIDATES NOTHING (owner
 * 2026-09-30: *"editing … the Programme … so hard to edit … the delay of
 * response is terrible"*). A `revalidatePath` inside a server action makes its
 * answer carry a whole render of the page it was SENT FROM, whatever path it
 * names — from the Maker that is the whole Maker (3–6 s on production), and
 * Next runs actions one at a time, so the next edit waited behind it. The
 * Maker's rail already shows the change (its overrides) and its canvases take
 * it through the editor bridge (`lib/maker-live-preview.ts`); the two pages
 * below are dynamic and re-read on the next visit anyway. Everywhere else the
 * paths are revalidated exactly as before. The flag touches cache freshness
 * only — who may write what is still RLS's.
 */
/** A block's id as the database makes it — the only shape `createScheduleBlock` takes one in. */
const BLOCK_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function revalidateScheduleUnlessMaker(eventId: string, formData: FormData): void {
  if (makerQuietWrite(formData)) return;
  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
  // Booked › Schedule draws the same page at /vendors?part=schedule.
  revalidatePath(`/dashboard/${eventId}/vendors`);
}

export async function createScheduleBlock(formData: FormData) {
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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
    // 👁 Shown to guests only by a host or the coordinator — anyone else's new moment starts hidden.
    is_public: formData.get('is_public') === 'on' && (await mayShowToGuests(supabase, user.id, eventId)),
    parent_block_id: parentBlockId,
  };
  // 📖 A CHAPTER WITH NO TIME YET (owner 2026-11-01, "Time TBA", migration 20271300482585): `start_at` carries its DAY
  // at 00:00 and `time_tba` says the clock is not known. Only a chapter may be TBA, it has no end, and it is never
  // shown to guests — so a reader that does not know the flag can never put a guessed midnight on the Event Hub.
  // 🕑 "ABOUT 3:15" OR "2:15/2:30" (owner 2026-11-02, 4 additions (2); migration 20271303051692): how the clock is
  // meant. `start_at` stays the earliest time written; the second time of an 'or' is minutes after it.
  const shape = timeShapeFrom(formData);
  if (shape) Object.assign(insertRow, shape);
  // ⏭ A MOMENT "RIGHT AFTER THE ONE ABOVE" (owner 2026-11-02, 4 additions (1); migration 20271302727358): the same
  // flag on a moment means no clock of its own. Its `start_at` becomes the start of the moment it follows — an order
  // key, never a guessed time — and the database moves it with that moment.
  if (formData.get('time_tba') === '1') {
    insertRow.time_tba = true;
    insertRow.end_at = null;
    insertRow.is_public = false;
    if (parentBlockId) {
      const place = await rightAfterPlace(supabase, {
        eventId,
        blockId: null,
        parentBlockId,
        followsRaw: formData.get('follows_block_id'),
      });
      if (place) {
        insertRow.start_at = place.start_at;
        insertRow.follows_block_id = place.follows_block_id;
      }
    }
  }
  // ➕ Studio › Schedule's "Add a moment" (2026-10-08) names the new row itself: the Maker draws it at the tap and
  // no render follows a quiet write, so the id cannot come back in one. Taken ONLY from a quiet Maker write and
  // only when it is a uuid; the column's own default names every other row. An id already in use is refused by
  // the primary key — an insert can never overwrite a row.
  const blockIdRaw = formData.get('block_id');
  if (makerQuietWrite(formData) && typeof blockIdRaw === 'string' && BLOCK_ID_SHAPE.test(blockIdRaw)) {
    insertRow.block_id = blockIdRaw;
  }
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

  // From the Maker's Studio (quiet) nothing is revalidated — no whole render of the Maker per added moment.
  revalidateScheduleUnlessMaker(eventId, formData);
}

export async function deleteScheduleBlock(formData: FormData) {
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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

  // 🔔 Read who is on it (and on its children, which cascade) BEFORE it is gone — afterwards nothing names them.
  const part = await partBefore(supabase, eventId, [blockId], { withChildren: true });
  await refuseLockedPart(supabase, part, { kind: 'delete' });

  // ON DELETE CASCADE on parent_block_id self-FK means deleting a parent
  // automatically removes all its child parts · no app-layer cleanup needed.
  const { data: gone, error } = await supabase
    .from('event_schedule_blocks')
    .delete()
    .eq('block_id', blockId)
    .eq('event_id', eventId)
    .select('block_id');
  if (error) throw new Error(error.message);
  // RLS answers a refused DELETE with zero rows and no error — said, never "deleted" (a chapter's Delete shows it).
  if (!gone || gone.length === 0) throw new Error(NOTHING_CHANGED);
  await tellPartSuppliers(supabase, part, user.id);

  revalidateScheduleUnlessMaker(eventId, formData);
}

export async function toggleBlockVisibility(formData: FormData) {
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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
  // 👁 Hiding a moment is anyone's who may edit the day; SHOWING one to guests is the hosts' and the coordinator's.
  if (desired && !(await mayShowToGuests(supabase, user.id, eventId))) throw new Error(ONLY_HOSTS_SHOW_GUESTS);

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update({ is_public: desired, updated_at: new Date().toISOString() })
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidateScheduleUnlessMaker(eventId, formData);
}

/**
 * Coordinator P1 prep-then-release: STAGE a block (coordinator_only — hidden
 * from the couple, guests, and booked vendors) or RELEASE it to the couple
 * (couple_visible — stamps released_at). Only the external coordinator may call
 * this (the couple can't see staged blocks to begin with). Flag-gated.
 */
export async function setBlockPrepVisibility(formData: FormData) {
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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

  revalidateScheduleUnlessMaker(eventId, formData);
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
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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

  // 📖 THE MOMENT SHEET'S TASKS AND ITS DELETE COUNT (Step 3b, owner 2026-11-01 §3c) — an intent branch on this door,
  // not a new exported action (the server-action budget is at its ceiling). `block_id` is the moment (a task's) or
  // the chapter (the Papic count). RLS decides every write; each one answers in words and reads back what it changed.
  const momentOp = formData.get('moment_op');
  if (momentOp !== null) {
    if (!isMomentOp(momentOp)) throw new Error('Invalid input');
    // 🔔 A crew line, a supplier ticked on or off, a march: the moment's suppliers (before AND after) are told once.
    // A crew line or a march changes the moment in a way its fields cannot show (`touched`); ticking a supplier on or
    // off is seen by the before/after supplier lists themselves.
    const writes = momentOp !== 'papic_count';
    const part = writes ? await partBefore(supabase, eventId, [blockId], { touched: momentOp !== 'for_set' }) : null;
    // 🚶 "This is a march" (migration 20271301571290): the moment names a march, or a new one is made for it.
    // 🗓 "Ask a supplier to change their times" (D2, owner 2026-11-02): the database decides who may ask.
    const answer =
      momentOp === 'ask_supplier'
        ? await askSupplierToChange(supabase, user.id, eventId, blockId, formData)
        : momentOp === 'march_set' || momentOp === 'march_new'
          ? await runMomentMarch(supabase, momentOp, eventId, blockId, formData)
          : await runMomentOp(supabase, momentOp, blockId, formData, user.id);
    // 🔄 A task or a march that saved refreshes every page that reads the day (a read — the Papic count — does not).
    if (answer.ok && part) await tellPartSuppliers(supabase, part, user.id);
    if (answer.ok && momentOp !== 'papic_count') revalidateScheduleUnlessMaker(eventId, formData);
    return answer;
  }

  type Patch = {
    label?: string;
    start_at?: string;
    end_at?: string | null;
    is_public?: boolean;
    location?: string | null;
    notes?: string | null;
    block_type?: ScheduleBlockType;
    audience?: string | null;
    spot?: string | null;
    ingress_minutes_before?: number | null;
    egress_minutes_after?: number | null;
    call_lead_minutes?: number;
    on_invitation?: boolean;
    photo_who?: string;
    photo_when?: string;
    is_optional?: boolean;
    travel_from?: string | null;
    travel_to?: string | null;
    time_tba?: boolean;
    follows_block_id?: string | null;
    time_shape?: TimeShape;
    time_or_minutes?: number | null;
    updated_at: string;
  };
  const patch: Patch = { updated_at: new Date().toISOString() };

  // 👥 For ▾ (owner 2026-10-06/07, "THE MISSING FIELDS ARE APPROVED"): who this
  // moment is for. Everyone is stored as NULL; an unknown word is refused.
  const audienceRaw = formData.get('audience');
  if (audienceRaw !== null) {
    const audience = scheduleAudienceForWrite(audienceRaw);
    if (audience === undefined) throw new Error('Invalid audience');
    patch.audience = audience;
  }

  // The Schedule rail's inspector changes a moment's phase in place (Schedule
  // rebuild, 2026-09-27). Only the ordinary types are accepted here — the two
  // travel-only classes keep their own create path and its clash guard.
  const blockTypeRaw = formData.get('block_type');
  if (blockTypeRaw !== null) {
    if (typeof blockTypeRaw !== 'string' || !VALID_TYPES.has(blockTypeRaw as ScheduleBlockType)) {
      throw new Error('Invalid block type');
    }
    patch.block_type = blockTypeRaw as ScheduleBlockType;
  }

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
    // 👁 A save that would SHOW a hidden moment to guests is the hosts' and the coordinator's. A save that only keeps
    // a moment as it is (the inspector sends its switch with every save) is anyone's who may edit the day.
    if (patch.is_public === true && !(await mayShowToGuests(supabase, user.id, eventId))) {
      const { data: was } = await supabase
        .from('event_schedule_blocks')
        .select('is_public')
        .eq('block_id', blockId)
        .eq('event_id', eventId)
        .maybeSingle();
      if ((was as { is_public?: boolean } | null)?.is_public !== true) throw new Error(ONLY_HOSTS_SHOW_GUESTS);
    }
  }

  const locationRaw = formData.get('location');
  if (locationRaw !== null) {
    patch.location = nullIfBlank(locationRaw);
  }

  const notesRaw = formData.get('notes');
  if (notesRaw !== null) {
    patch.notes = nullIfBlank(notesRaw);
  }

  // 📖 A CHAPTER'S AND A MOMENT'S OWN FIELDS (owner 2026-11-01, migration 20271300072429 — the Chapters row of Home ›
  // Event Settings saves each one as it is kept). Each is read only when posted; an unknown word is refused here and
  // again by the column's CHECK.
  const spotRaw = formData.get('spot');
  if (spotRaw !== null) {
    const spot = nullIfBlank(spotRaw);
    if (spot && spot.length > 120) throw new Error('Keep the exact spot under 120 letters');
    patch.spot = spot;
  }
  for (const [field, max] of [['ingress_minutes_before', 1440], ['egress_minutes_after', 2880]] as const) {
    const raw = formData.get(field);
    if (raw === null) continue;
    if (typeof raw === 'string' && raw.trim() === '') {
      patch[field] = null; // blank = no ingress / no egress (owner: "not placing a time means no ingress")
      continue;
    }
    const n = typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error('Invalid ingress or egress time');
    patch[field] = n;
  }
  const leadRaw = formData.get('call_lead_minutes');
  if (leadRaw !== null) {
    const n = typeof leadRaw === 'string' ? Number(leadRaw) : NaN;
    if (!isCallLead(n)) throw new Error('Invalid call time');
    patch.call_lead_minutes = n;
  }
  const whoRaw = formData.get('photo_who');
  if (whoRaw !== null) {
    if (!isPhotoWho(whoRaw)) throw new Error('Invalid photo setting');
    patch.photo_who = whoRaw;
  }
  const whenRaw = formData.get('photo_when');
  if (whenRaw !== null) {
    if (!isPhotoWhen(whenRaw)) throw new Error('Invalid photo setting');
    patch.photo_when = whenRaw;
  }
  const optionalRaw = formData.get('is_optional');
  if (optionalRaw !== null) patch.is_optional = optionalRaw === 'true' || optionalRaw === 'on';
  const travelToRaw = formData.get('travel_to');
  if (travelToRaw !== null) {
    patch.travel_to = nullIfBlank(travelToRaw);
    patch.travel_from = patch.travel_to ? nullIfBlank(formData.get('travel_from')) : null;
  }
  const inviteRaw = formData.get('on_invitation');
  if (inviteRaw !== null) {
    patch.on_invitation = inviteRaw === 'true' || inviteRaw === 'on';
    // 👁 Putting a chapter ON the invitation reaches guests (Step 5) — the hosts' and the coordinator's call, the same
    // rule as showing a moment to guests. Keeping it as it is, or taking it off, is anyone's who may edit the day.
    if (patch.on_invitation === true && !(await mayShowToGuests(supabase, user.id, eventId))) {
      const { data: was } = await supabase
        .from('event_schedule_blocks')
        .select('on_invitation')
        .eq('block_id', blockId)
        .eq('event_id', eventId)
        .maybeSingle();
      if ((was as { on_invitation?: boolean } | null)?.on_invitation !== true) throw new Error(ONLY_HOSTS_SHOW_GUESTS);
    }
  }

  // 🕑 "About 3:15" · "2:15/2:30" (migration 20271303051692) — read only when posted.
  const shapePatch = timeShapeFrom(formData);
  if (shapePatch) Object.assign(patch, shapePatch);

  // 📖 TIME TBA (migration 20271300482585): a chapter whose time is not known keeps its day in `start_at` (00:00) and
  // has no end, no ingress, no egress and no guests (the database refuses the rest). Posting a real time clears it.
  const tbaRaw = formData.get('time_tba');
  if (tbaRaw !== null) {
    patch.time_tba = tbaRaw === '1' || tbaRaw === 'true';
    if (patch.time_tba) {
      patch.end_at = null;
      patch.is_public = false;
      // No clock, so nothing to be "about" and no second time (the database refuses a shape on a TBA row).
      patch.time_shape = 'at';
      patch.time_or_minutes = null;
      // ⏭ A MOMENT goes "right after the one above" (migration 20271302727358): it takes that moment's start as its
      // order key; a chapter keeps its day as before and drops its ingress and egress.
      const place = await rightAfterPlace(supabase, { eventId, blockId, parentBlockId: null, followsRaw: formData.get('follows_block_id') });
      if (place) {
        patch.start_at = place.start_at;
        patch.follows_block_id = place.follows_block_id;
      } else {
        patch.ingress_minutes_before = null;
        patch.egress_minutes_after = null;
      }
    } else {
      // A time of its own: it follows nothing any more (the database refuses an anchor on a timed row).
      patch.follows_block_id = null;
    }
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

  // 📖 MOVING A CHAPTER MOVES ITS MOMENTS (plan §3 "Time moves"): with `with_moments`, a new start on a top-level block
  // shifts the chapter AND every moment in it by the same amount, in one statement under the caller's own RLS
  // (`move_schedule_chapter`, migration 20271300072429). Its ingress and egress are minutes from the start, so they
  // come along. A move that reached no row is said, never a quiet "saved".
  const withMoments = formData.get('with_moments') === '1' && patch.start_at !== undefined;
  // 🔔 One save, one notice per supplier: the moment — and, on a chapter move, every moment in it — read BEFORE.
  const part = await partBefore(supabase, eventId, [blockId], { withChildren: withMoments });
  // 🗓 SCHEDULES HAND-IN-HAND part (b), rule 1 (owner 2026-11-12): a supplier's own arrive / done STAY when the chapter
  // moves — every other moment comes along, as shipped. Their card says what moved against what they planned.
  const keep = withMoments ? timesThatStay(blockId, part.before) : [];
  const movedFrom = withMoments ? ((part.before.find((m) => m.block_id === blockId)?.start_at as string | null | undefined) ?? null) : null;
  const movedTo = withMoments ? (patch.start_at ?? null) : null;
  // 🔒 A chapter move carries every moment in it (but the kept times); a field save meets the lock only if it really
  // moves the part.
  await refuseLockedPart(
    supabase,
    part,
    { kind: 'fields' },
    withMoments ? part.before.filter((m) => !keep.includes(m.block_id)) : part.before.filter((m) => patchTouchesPart(m, patch)),
  );
  if (withMoments) {
    const { data: moved, error: moveError } = await supabase.rpc('move_schedule_chapter', {
      p_block_id: blockId,
      p_start_at: patch.start_at,
      p_keep_block_ids: keep,
    });
    if (moveError) throw new Error(moveError.message);
    if (typeof moved !== 'number' || moved < 1) throw new Error(NOTHING_CHANGED);
    delete patch.start_at;
  }

  const { data: changed, error } = await supabase
    .from('event_schedule_blocks')
    .update(patch)
    .eq('block_id', blockId)
    .eq('event_id', eventId)
    .select('block_id');
  if (error) throw new Error(error.message);
  // RLS answers a refused UPDATE with zero rows and no error — said, never "saved" (a chapter's row says "didn't save").
  if (!changed || changed.length === 0) throw new Error(NOTHING_CHANGED);
  await tellPartSuppliers(supabase, part, user.id);
  // 🗓 Rule 1 + 3: one schedule card in each booked supplier's chat on this chapter ("Ceremony is now 30 min later than
  // you planned"), pinned on their side until they press Seen. Best-effort: the move already landed.
  if (withMoments) await postChapterMovedLines(part, blockId, movedFrom, movedTo);

  revalidateScheduleUnlessMaker(eventId, formData);
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
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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

  const [eventRes, blocks, guests, roleNames, eventWords] = await Promise.all([
    supabase
      .from('events')
      .select('display_name, event_date')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchScheduleBlocks(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    // The couple's own words for roles (owner 2026-09-30) — the roster says them.
    loadRoleNames(supabase, eventId, 'generateEmceeScript.roleNames'),
    eventWordsForEvent(eventId).catch(() => null),
  ]);

  const event = eventRes.data ?? { display_name: null, event_date: null };
  return buildEmceeScript({
    event: {
      displayName: (event as { display_name: string | null }).display_name ?? null,
      untitledName: untitledEventName(eventWords),
      eventDate: (event as { event_date: string | null }).event_date ?? null,
    },
    blocks,
    guests,
    options: { includePrivateBlocks: includePrivate },
    roleNames,
  });
}

/**
 * Resolve a vendor timeline suggestion — feature-access program Phase 3
 * (corpus 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 4).
 * Accept applies the proposal (adjust → update the block's proposed fields;
 * new → create a draft block tagged to the supplier; remove → delete the
 * block); decline just flips the status. RLS gates both
 * sides: the suggestion UPDATE policy + the block write policies admit the
 * couple and delegates holding schedule edit, nobody else.
 */
/**
 * Approve, Noted or Decline ONE suggestion — the Requests sheet's door (the path: `decideSuggestion`).
 * 🔁 SAVES IN PLACE (audit 2026-11-02 #15): it ANSWERS (`ScheduleRequestAnswer`) and never redirects — a redirect closed
 * the sheet after every press and sent a refusal to the error page. Held by `the-requests-sheet-saves-in-place.test.ts`.
 */
export async function resolveScheduleSuggestion(formData: FormData): Promise<ScheduleRequestAnswer> {
  // ✅ Approve all rides this one action (decision=accept_all) — no new export: every exported action is a Vercel
  // route, and that budget is full (`scripts/lint-server-action-budget.mjs`).
  if (formData.get('decision') === 'accept_all') return approveAllScheduleSuggestions(formData);
  // 🤝 Auto-agree (Event Details › Event access) rides this action too — the same budget reason. It still throws on a
  // refusal (its row catches that and says so).
  if (formData.get('decision') === 'auto_agree') {
    await setSupplierAutoAgree(formData);
    return { ok: true };
  }
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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

  try {
    await decideSuggestion(supabase, user.id, eventId, suggestionId, decision);
  } catch (e) {
    console.error('[resolveScheduleSuggestion] refused', e instanceof Error ? e.message : e, { event_id: eventId });
    return { ok: false, error: requestRefusalWords(e, decision) };
  }
  // Already answered elsewhere (another host, Auto-agree) — the list is refreshed so it leaves the sheet; nothing failed.
  revalidateScheduleUnlessMaker(eventId, formData);
  return { ok: true };
}

/** A refusal in words the host can act on — the door's own sentence when it wrote one, else what did not happen. */
function requestRefusalWords(e: unknown, decision: 'accept' | 'decline'): string {
  const said = e instanceof Error ? e.message.trim() : '';
  if (said && said.length <= 200 && !/violates|duplicate key|syntax|relation|column|permission denied|PGRST/i.test(said)) return said;
  return decision === 'accept'
    ? 'That change wasn’t approved — nothing on your schedule moved. Try again.'
    : 'That wasn’t declined — try again.';
}

/**
 * ✅ APPROVE ALL (owner 2026-11-01: *"also have an approve all"*; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §6b) — every
 * supplier change the host was SHOWN (the ids the sheet posts, never "whatever is open now": a change that arrived after
 * they looked is not approved unseen), through the one accept path above. A suggestion in words is left for Noted.
 * Each supplier approved is told in-app, as with one Approve. Reached through `resolveScheduleSuggestion`
 * (decision=accept_all). A refused one does not stop the rest; the count of
 * refused ones is said, never the look of success.
 */
async function approveAllScheduleSuggestions(formData: FormData): Promise<ScheduleRequestAnswer> {
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
  const eventId = formData.get('event_id');
  const ids = [...new Set(formData.getAll('suggestion_id').filter((v): v is string => typeof v === 'string' && v.length > 0))];
  if (typeof eventId !== 'string' || ids.length === 0 || ids.length > APPROVE_ALL_MAX) throw new Error('Invalid input');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let refused = 0;
  for (const id of ids) {
    try {
      await decideSuggestion(supabase, user.id, eventId, id, 'accept', true);
    } catch (e) {
      refused += 1;
      console.error('[approveAllScheduleSuggestions] one change was refused', e instanceof Error ? e.message : e, { event_id: eventId });
    }
  }
  revalidateScheduleUnlessMaker(eventId, formData);
  if (refused > 0) {
    return {
      ok: false,
      error: `${refused} of ${ids.length} change${ids.length === 1 ? '' : 's'} could not be approved — the rest are on your schedule. Try those again.`,
    };
  }
  return { ok: true };
}

/**
 * 🤝 AUTO-AGREE — the host's one setting for supplier changes (3 Oct; ruled 1 Nov: starts Off). Only a host of the event
 * (`userHostsEvent`: the couple, an accepted primary host) sets it; the write is the service role's, after that check,
 * and is read back, so a refused one throws instead of looking saved. No redirect: the dropdown stays.
 * Reached through `resolveScheduleSuggestion` (decision=auto_agree).
 */
async function setSupplierAutoAgree(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const on = formData.get('auto_agree');
  if (typeof eventId !== 'string' || (on !== '1' && on !== '0')) throw new Error('Invalid input');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!(await mayShowToGuests(supabase, user.id, eventId))) throw new Error('Only a host of the event can change this.');
  // `events` carries no UPDATE grant for this column (its SELECT is a column allowlist): the service role writes it,
  // only after the host check above — the shape of `same_date_count_opt_out` (20271285020592).
  const { data, error } = await createAdminClient()
    .from('events')
    .update({ supplier_requests_auto_agree: on === '1' })
    .eq('event_id', eventId)
    .select('event_id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Nothing changed — this account cannot change the event.');
  revalidatePath(`/dashboard/${eventId}/details`);
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
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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

  // 🔔 Before AND after: a supplier taken off is told as surely as one put on.
  const part = await partBefore(supabase, eventId, [blockId]);
  // 🔒 Putting a locked supplier on, or taking them off, is their part; another supplier's presence is not.
  await refuseLockedPart(supabase, part, { kind: 'vendors', after: vendorIds });
  const { data: changed, error } = await supabase
    .from('event_schedule_blocks')
    .update({
      responsible_party: responsibleParty,
      responsible_vendor_ids: vendorIds,
      updated_at: new Date().toISOString(),
    })
    .eq('block_id', blockId)
    .eq('event_id', eventId)
    .select('block_id');
  if (error) throw new Error(error.message);
  // An UPDATE that RLS filtered to nothing raises no error — read back what changed, so a refusal is not "saved".
  if (!changed?.length) throw new Error(NOTHING_CHANGED);
  await tellPartSuppliers(supabase, part, user.id);

  revalidateScheduleUnlessMaker(eventId, formData);
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
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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
  // Nothing this caller can see to move is not a shift — the sheet must not close as if the day moved.
  if (patches.length === 0) throw new Error(NOTHING_CHANGED);

  // 🔔 A drag of one moment (or a span) tells the suppliers on what moved — once each. Running late (`shift_notice`)
  // already tells EVERY booked supplier the day moved, so it is not told twice.
  const shiftNotice = formData.get('shift_notice') === '1';
  const part = await partBefore(supabase, eventId, patches.map((p) => p.block_id));

  if (shiftNotice) {
    /* 🏃 RUNNING LATE MOVES A LOCKED SUPPLIER'S MOMENTS (owner, DECISION_LOG 2026-11-03 (2): *"A host's RUNNING-LATE
       shift moves a supplier's moments even when that supplier has locked their times; the supplier still gets the
       notice."*). So no lock check here — the ONE door the database lets past a lock, and only for a pure shift of
       exactly these minutes (migration 20271303571970). All or nothing: a refused row undoes the whole shift. */
    const { data: moved, error } = await supabase.rpc('running_late_shift_schedule', {
      p_event_id: eventId,
      p_block_ids: patches.map((p) => p.block_id),
      p_minutes: deltaMinutes,
    });
    if (error) throw new Error(error.code === 'P0002' ? NOTHING_CHANGED : `Retime failed: ${error.message}`);
    if (moved !== patches.length) throw new Error(NOTHING_CHANGED);
  } else {
    // 🔒 A drag of one moment (or a span) is a host edit like any other: a locked supplier's clock is theirs.
    await refuseLockedPart(supabase, part, { kind: 'fields' });
    const now = new Date().toISOString();
    for (const patch of patches) {
      const { data: changed, error } = await supabase
        .from('event_schedule_blocks')
        .update({ start_at: patch.start_at, end_at: patch.end_at, updated_at: now })
        .eq('block_id', patch.block_id)
        .eq('event_id', eventId)
        .select('block_id');
      if (error) throw new Error(`Retime failed at ${patch.block_id}: ${error.message}`);
      // RLS answers a refused UPDATE with zero rows and no error: read it back, never a quiet "moved".
      if (!changed?.length) throw new Error(NOTHING_CHANGED);
    }
  }

  /* ⏱ A SHIFT OF THE DAY TELLS EVERY BOOKED SUPPLIER — once, after every block landed (owner 2026-10-23). Only the
     Running-late sheet sends `shift_notice`: a drag of one moment rides this same action and is not a shift of the
     day. Best-effort — the shift is written; a failed notice never undoes it. */
  if (!shiftNotice) await tellPartSuppliers(supabase, part, user.id);
  if (formData.get('shift_notice') === '1') {
    const anchor = blocks.find((b) => b.block_id === fromBlockId) ?? null;
    await notifyScheduleShifted({
      eventId,
      deltaMinutes,
      fromStartAt: anchor?.start_at ?? null,
      fromLabel: anchor?.label ?? null,
      actorUserId: user.id,
    });
  }

  revalidateScheduleUnlessMaker(eventId, formData);
}

/**
 * Load a run-of-show template into an EMPTY schedule. Strictly
 * additive-into-empty: any existing block (even one) makes this a no-op —
 * a template can NEVER overwrite or merge over rows the couple authored.
 * Insert goes through the authenticated client, so the couple and a
 * schedule-'edit' coordinator can load one; nobody else can.
 */
export async function loadScheduleTemplate(formData: FormData) {
  await refuseLimitedHelper(formData.get('event_id'), 'schedule');
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

  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('event_type, event_date, ceremony_type, secondary_ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  const eventType = (ev?.event_type as string | null | undefined) ?? 'wedding';
  const rites = {
    ceremony_type: (ev?.ceremony_type as string | null | undefined) ?? null,
    secondary_ceremony_type: (ev?.secondary_ceremony_type as string | null | undefined) ?? null,
  };
  // The SAME list the menu drew (rite-shaped: a dance-free rite's templates
  // carry no cocktail/dancing blocks), so what loads is what was shown.
  const template = templatesForEventType(eventType, rites).find((t) => t.id === templateId);
  if (!template) throw new Error('Template not available for this event type');

  // The never-overwrite guard: refuse when ANY row exists.
  const { data: existing, error: existingErr } = await supabase
    .from('event_schedule_blocks')
    .select('block_id')
    .eq('event_id', eventId)
    .limit(1);
  if (existingErr) throw new Error(existingErr.message);
  // Never over rows that exist — but a screen still offering templates is stale (someone else added a moment):
  // redraw it, so the host sees the schedule that is there instead of a press that did nothing.
  if (existing && existing.length > 0) {
    revalidatePath(`/dashboard/${eventId}/schedule`);
    return;
  }

  const eventDate = (ev?.event_date as string | null | undefined) ?? null;
  if (template.id === FAITH_TEMPLATE_ID) {
    // ⛪ The ceremony's own day: `buildScheduleSeed`'s two passes — the
    // top-level blocks, then each one's parts under the ids just returned.
    const seed = buildScheduleSeed((rites.ceremony_type as SeedCeremonyType | null) ?? null, eventDate, rites);
    const { data: parents, error: parentErr } = await supabase
      .from('event_schedule_blocks')
      .insert(seed.topLevel.map(({ key: _key, ...row }) => ({ ...row, event_id: eventId, parent_block_id: null })))
      .select('block_id, sort_order');
    if (parentErr) throw new Error(parentErr.message);
    const idOf = (key: string) => {
      const order = seed.topLevel.find((b) => b.key === key)?.sort_order;
      return (parents ?? []).find((p) => p.sort_order === order)?.block_id as string | undefined;
    };
    const children = seed
      .buildChildren({ ceremony: idOf('ceremony') ?? '', reception: idOf('reception') ?? '' })
      .flatMap(({ parent_key, ...row }) => {
        const parent = idOf(parent_key);
        return parent ? [{ ...row, event_id: eventId, parent_block_id: parent }] : [];
      });
    if (children.length > 0) {
      const { error: childErr } = await supabase.from('event_schedule_blocks').insert(children);
      if (childErr) throw new Error(childErr.message);
    }
    revalidatePath(`/dashboard/${eventId}/schedule`);
    revalidatePath(`/dashboard/${eventId}`);
    return;
  }

  const rows = buildTemplateInsertRows(
    template,
    eventDate,
  ).map((row) => ({ ...row, event_id: eventId }));

  const { error } = await supabase.from('event_schedule_blocks').insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}
