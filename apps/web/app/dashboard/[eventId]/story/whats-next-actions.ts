'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { ensureFreePapicPoolGrantAdmin } from '@/lib/papic-free-grant';
import { ensureFreePapicOneCameraAdmin } from '@/lib/papic-one';
import { shopAccountMayNotCreateEvents } from '@/lib/vendor-event-creation';
import { getBlockingLifeEvent } from '@/app/dashboard/(account)/create-event/life-event-guard';
import { authorizePlanNextYear } from '@/lib/plan-next-year-authz';
import { anchorForType } from '@/lib/event-anchor';
import { NEVER_OFFERED_AS_NEXT, NOTHING_YET } from '@/lib/whats-next';
import { hostUserId } from './_lib/host-authority';

/**
 * WHAT'S NEXT — the two actions, and the difference between them (`02` §7).
 *
 * ⚖ THE OWNER'S RULING IS THAT MOST STORIES END. So the resting state writes
 * nothing, and these two are the only ways anything is written at all:
 *
 *   `announceNext`  — puts a sentence on this story's back cover. **CREATES
 *                     NOTHING.** One `event_editorial.draft_json` key, on a row
 *                     that already exists. No `events` insert is reachable from
 *                     this function; `announce-creates-nothing.test.ts` proves
 *                     it by counting, not by reading.
 *   `startTheNext`  — the go-signal tap. Creates ONE event, pre-filled, and
 *                     writes `previous_event_id` back to this story.
 *
 * 🔑 THE TWO MUST NEVER COLLAPSE INTO ONE "CONTINUE" BUTTON. `event-anchor.ts`'s
 * owner lock — *"an event exists only on the user's go-signal tap"* — is the
 * whole reason a derived candidate can be shown at all. A single button that
 * announced AND created would make every announcement a creation, which is the
 * behaviour that lock exists to forbid.
 */

export type NextActionResult = { ok: true } | { ok: false; error: string };

const NO_ACCESS = 'You don’t have access to this celebration.';
const NOT_OFFERED = 'That isn’t one of the celebrations we can follow this one with.';

/**
 * Merge one key into `event_editorial.draft_json`, preserving everything else.
 * The same read-modify-write `saveEditorial` does — the story's draft is one
 * JSON document and a blind overwrite loses the words the host typed.
 */
async function writeAnnouncement(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  value: { kind: string } | null,
): Promise<boolean> {
  const { data: existing, error: readError } = await admin
    .from('event_editorial')
    .select('draft_json')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ A REFUSED READ IS NOT AN EMPTY DRAFT. Writing `{ whatsNext }` over a
  // document we failed to read would delete the host's headline, deck and every
  // chapter override — the exact defect the editor's own "we couldn't load the
  // story you saved" banner exists for. Refuse instead.
  if (readError) return false;

  const base =
    existing?.draft_json && typeof existing.draft_json === 'object'
      ? (existing.draft_json as Record<string, unknown>)
      : {};

  const { error } = await admin.from('event_editorial').upsert(
    {
      event_id: eventId,
      draft_json: { ...base, whatsNext: value },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  return !error;
}

/**
 * ANNOUNCE IT ONLY — the back cover gains a line. Nothing is created.
 *
 * Pass `NOTHING_YET` (or anything that is not an offered kind) to go back to the
 * resting state, which removes the back cover entirely rather than leaving a
 * dashed placeholder behind: **a story that ends at the last word is finished.**
 */
export async function announceNext(
  eventId: string,
  kind: unknown,
): Promise<NextActionResult> {
  if (!(await hostUserId(eventId))) return { ok: false, error: NO_ACCESS };

  const value = typeof kind === 'string' ? kind.trim() : '';
  const clearing = !value || value === NOTHING_YET;
  if (!clearing && NEVER_OFFERED_AS_NEXT.has(value)) {
    return { ok: false, error: NOT_OFFERED };
  }

  const admin = createAdminClient();
  const ok = await writeAnnouncement(admin, eventId, clearing ? null : { kind: value });
  if (!ok) return { ok: false, error: 'Could not save. Please try again.' };

  revalidatePath(`/dashboard/${eventId}/story`);
  const { data: event } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (typeof event?.slug === 'string') revalidatePath(`/${event.slug}`);
  return { ok: true };
}

/**
 * START IT NOW — the go-signal tap. One event, pre-filled and linked.
 *
 * ═══ EVERY GATE `planNextYearEvent` KEEPS, KEPT HERE FOR THE SAME REASONS ═══
 * This is a fourth `events` INSERT path, so it runs the same three checks the
 * other three do, and the ORDER matters: authority is proved on the caller's own
 * session BEFORE anything touches the service-role client.
 *
 *   1. **COUPLE-ONLY, via `authorizePlanNextYear`** — reused verbatim, not
 *      re-derived. `hostUserId` above admits an accepted co-host, which is right
 *      for editing a story and WRONG here: the insert below makes the caller
 *      `member_type='couple'` of a brand-new event, and a delegate proposes,
 *      never executes. That distinction was a live privilege escalation on this
 *      exact shape in July.
 *   2. **The shop account does not plan celebrations** (owner 2026-08-15).
 *   3. **The life-event cardinality gate** — one in-planning life event per
 *      (account × type × honoree). Every events-insert path runs it, and
 *      `lib/life-event-gate.test.ts` scans for exactly that.
 *
 * ═══ WHAT NO. 2 INHERITS ════════════════════════════════════════════════════
 * The names, the mark and the colours — the masthead carries over, which is what
 * `02` §7 promises. ⛔ **NOT the guest list.** `02` §7 lists it; the owner's
 * 2026-07-12 recurrence lock says the clone scope is *"Details, not the guest
 * list"*, and the shipped `buildNextYearClonePayload` keeps to that. Two
 * documents disagree, one of them is an owner lock, and the lock wins until the
 * owner says otherwise. Flagged in the PR, not resolved here.
 *
 * ⚠ AND NOT A BIRTHDATE, EVER. A `person_birthdate`-anchored type (christening ·
 * birthday · debut) is created with `anchor_date` NULL — the same counsel gate
 * `lib/onboarding/event-insert.ts` enforces on its own path. The screen says so
 * out loud: *"We will not ask you for one, and we will not guess."*
 */
export async function startTheNextCelebration(
  eventId: string,
  kind: unknown,
): Promise<NextActionResult> {
  const value = typeof kind === 'string' ? kind.trim() : '';
  if (!value || value === NOTHING_YET || NEVER_OFFERED_AS_NEXT.has(value)) {
    return { ok: false, error: NOT_OFFERED };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NO_ACCESS };

  const authz = await authorizePlanNextYear(eventId, user.id, {
    readMembership: async (id, userId) => {
      const { data } = await supabase
        .from('event_members')
        .select('member_type')
        .eq('event_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      return data as { member_type?: string | null } | null;
    },
  });
  if (!authz.ok) return { ok: false, error: NO_ACCESS };

  if (await shopAccountMayNotCreateEvents(supabase, user.id)) {
    return { ok: false, error: 'This account doesn’t plan celebrations.' };
  }

  // Defence-in-depth only — the gate is above. `events_host`, not `events`:
  // the couple/moderator-scoped read path, same reasoning as planNextYearEvent.
  const { data: source, error: sourceError } = await supabase
    .from('events_host')
    .select(
      'event_id, display_name, event_date, region, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_motion_key, role_palette, moodboard_theme_name',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (sourceError || !source) return { ok: false, error: NO_ACCESS };

  const blocking = await getBlockingLifeEvent(supabase, user.id, { eventType: value });
  if (blocking) {
    return {
      ok: false,
      error: 'You already have one of these in planning. Finish that one first.',
    };
  }

  const admin = createAdminClient();
  const displayName = (source.display_name as string | null) ?? 'My Celebration';
  const slug = await generateUniqueSlug(admin, displayName);
  const anchor = anchorForType(value);

  const { data: inserted, error: insertError } = await admin
    .from('events')
    .insert({
      event_type: value,
      display_name: displayName,
      // THE LINK. The whole reason this action exists rather than a plain
      // "create an event" link — written on the tap, never derived, never
      // auto-created (S4's own column comment).
      previous_event_id: source.event_id,
      anchor_kind: anchor.kind,
      // ⚠ THE COUNSEL GATE. A person_birthdate anchor NEVER carries a date on
      // this path; a union_date anchor takes the day just held, which is the
      // whole of "derived from this day".
      anchor_date:
        anchor.kind === 'union_date' ? ((source.event_date as string | null) ?? null) : null,
      // Fresh timing — the host picks the day. Same as the recurrence clone.
      event_date: null,
      date_mode: 'specific',
      // The masthead carries over: their names, their mark, their colours.
      monogram_text: source.monogram_text ?? null,
      monogram_color: source.monogram_color ?? null,
      monogram_style: source.monogram_style ?? null,
      monogram_font_key: source.monogram_font_key ?? null,
      monogram_frame_key: source.monogram_frame_key ?? null,
      monogram_motion_key: source.monogram_motion_key ?? null,
      role_palette: source.role_palette ?? null,
      moodboard_theme_name: source.moodboard_theme_name ?? null,
      region: source.region ?? null,
      slug,
      is_primary: true,
      // Wedding-only CHECK columns: NULL/false by construction — `value` is
      // never 'wedding' (NEVER_OFFERED_AS_NEXT, checked above), which is what
      // `events_wedding_fields_consistency` requires.
      ceremony_type: null,
      venue_setting: null,
      ceremony_sub_type: null,
      is_mixed_ceremony: false,
      secondary_ceremony_type: null,
      ceremony_type_locked_at: null,
      ceremony_type_locked_by: null,
      bride_name: null,
      groom_name: null,
    })
    .select('event_id')
    .single();

  if (insertError || !inserted) {
    console.error('[whats-next] insert failed', insertError);
    return { ok: false, error: 'Could not start it. Please try again.' };
  }

  const { error: memberError } = await admin.from('event_members').insert({
    event_id: inserted.event_id,
    user_id: user.id,
    member_type: 'couple',
    joined_via: 'created_event',
  });
  if (memberError) {
    // The event exists and nobody owns it. Roll it back so trying again is
    // safe — otherwise "try again" quietly mints a second unreachable event.
    // Same rule as every other create path.
    console.error('[whats-next] member link failed', memberError);
    await admin.from('events').delete().eq('event_id', inserted.event_id);
    return { ok: false, error: 'Could not start it. Please try again.' };
  }

  // The new event is metered like any other (owner-locked 2026-07-27 · 2026-07-29).
  // Idempotent + non-fatal: a celebration with no camera has nothing to try.
  await ensureFreePapicPoolGrantAdmin(admin, inserted.event_id, user.id);
  await ensureFreePapicOneCameraAdmin(admin, inserted.event_id);

  // The back cover reads the same whichever button was pressed, so the
  // announcement is written here too — the door on this story is the point.
  await writeAnnouncement(admin, eventId, { kind: value });

  revalidatePath(`/dashboard/${eventId}/story`);
  revalidatePath('/dashboard');
  redirect(`/dashboard/${inserted.event_id}`);
}
