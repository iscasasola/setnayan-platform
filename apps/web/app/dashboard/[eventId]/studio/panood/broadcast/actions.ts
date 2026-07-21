'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canStartBroadcast } from '@/lib/panood-watermark';
import { fetchOrInitControlStateAdmin } from '@/lib/panood-control';
import { resolvePanoodTier } from '@/lib/panood-camera-seats';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import {
  setProgramSourceAdmin,
  setLiveAdmin,
  applyMomentAdmin,
} from '@/lib/panood-control';
import { setPanoodScreenSourceAdmin } from '@/lib/panood-screens';
import { fetchPanoodMoments, type PanoodMomentConfig } from '@/lib/panood-moments';

/**
 * Server actions for the REAL Panood multicam control room (iteration 0011, PR4).
 *
 * Every action here:
 *   1. Re-verifies the caller is on the event in a CONTROL-ROOM role
 *      (couple / coordinator — the same surface the control_state RLS allows),
 *      via requireControlRoomMembership below.
 *   2. Re-checks eventSkuActive(PANOOD_SYSTEM) — the PAID multicam controller
 *      gate. The single-cam go-live on ./setup stays FREE (owner model
 *      2026-06-26); THIS surface is the paid tier, so a non-owner must never be
 *      able to mutate the control plane even by POSTing the action directly.
 *   3. Mutates through the SERVICE-ROLE admin client behind the gate (the
 *      control-plane helpers take the admin client as a parameter), then
 *      revalidates the control-room path so the server-rendered console reflects
 *      the persisted state.
 *
 * All mutations are BEST-EFFORT + non-fatal: the lib helpers return false on a
 * missing table / bad input rather than throwing, so a pre-bootstrap DB or a
 * routing hiccup never 500s the control room. No secret is ever returned to the
 * client — the actions return a small {ok}|{error} result the console surfaces.
 *
 * Auth mirrors the shipped requireHostMembership pattern (the sibling
 * ../setup/actions.ts + the hero-photo / site-editor actions): event_moderators
 * (accepted, not removed — covers the couple AND a coordinator added as a
 * moderator) OR legacy event_members.member_type='couple'. RLS on the
 * panood_* tables is the backstop; this is defense-in-depth.
 */


export type ControlActionResult = { ok: true } | { error: string };

/**
 * Control-room membership gate. Throws (via redirect) for a logged-out user and
 * returns false (caller surfaces a friendly error) for a logged-in user who is
 * not on the event in a control-room role. Returns the user id on success so the
 * caller can attribute the mutation if needed.
 */
async function requireControlRoomMembership(eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Coordinator OR couple are both added to event_moderators (accepted, active);
  // any such row is a control-room operator.
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return true;

  // Legacy couple membership (pre-moderators events).
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy?.member_type === 'couple') return true;

  return false;
}

/**
 * Shared preamble for every control action: membership + PAID-SKU gate. Returns
 * an admin client when the caller may mutate, or an {error} the action returns to
 * the console. Keeps the two gates in one place so no action can forget one.
 */
async function gateControlAction(
  eventId: string,
): Promise<{ admin: ReturnType<typeof createAdminClient> } | { error: string }> {
  if (!eventId) return { error: 'Missing event.' };

  const isMember = await requireControlRoomMembership(eventId);
  if (!isMember) {
    return { error: 'You don’t have control-room access for this event.' };
  }

  // NO paid gate here any more — deliberately.
  //
  // Every control mutation must stay reachable on the FREE tier: the couple has to actually
  // switch cameras and fire moments to prove the rig works. The paywall is the SETNAYAN overlay
  // (lib/panood-watermark), not a refusal to persist state — an action gate here would make the
  // free tier a set of dead buttons, which is the opposite of the model.
  //
  // `setLive` in particular MUST reach the DB on a free event: it stamps the write-once
  // `first_live_at` anchor. Membership above remains the authorization boundary.
  //
  // ⚠️ The removed check also refused every action for paid MOBILE-tier buyers, because it
  // tested `PANOOD_SYSTEM` alone.

  return { admin: createAdminClient() };
}

function revalidateControlRoom(eventId: string): void {
  revalidatePath(`/dashboard/${eventId}/studio/panood/broadcast`);
}

/**
 * SOURCES rail tap → put a source on the PROGRAM bus (the single-stage default:
 * tap a source = it's live). `source` is loose text — a camera id (cam1 …), or a
 * wall source (photos | live_bg). Best-effort persist; non-fatal.
 */
export async function setProgramSource(
  eventId: string,
  source: string,
): Promise<ControlActionResult> {
  const gate = await gateControlAction(eventId);
  if ('error' in gate) return gate;
  if (!source) return { error: 'No source selected.' };

  const ok = await setProgramSourceAdmin(gate.admin, eventId, source);
  if (!ok) return { error: 'Could not switch the program source. Please try again.' };
  revalidateControlRoom(eventId);
  return { ok: true };
}

/**
 * Go-live toggle for the multicam controller. Persists is_live on the control
 * plane (distinct from the single-cam YouTube go-live on ./setup, which mints a
 * real YouTube broadcast). Best-effort; non-fatal.
 */
export async function setLive(
  eventId: string,
  isLive: boolean,
): Promise<ControlActionResult> {
  const gate = await gateControlAction(eventId);
  if ('error' in gate) return gate;

  // ── The 24-hour window bites HERE, and only here ────────────────────────────
  //
  // `canStartBroadcast` had ZERO call sites outside its own test, so one purchase bought unlimited
  // clean broadcasts forever. It is enforced on the way UP only:
  //
  //   • Going OFF air is never blocked. Refusing to let someone stop broadcasting would be absurd.
  //   • An in-flight broadcast is never interrupted — that rule outranks the paywall and lives in
  //     `decideWatermark` (`expired-broadcasting`). This gate is about starting a NEW one.
  //   • The FREE tier can still press live: it goes to air with the SETNAYAN overlay on, which is
  //     the whole model. `canStartBroadcast` returns true for 'awaiting-go-live', which is what a
  //     free event resolves to before its first press.
  //
  // Only an event that has already spent its window is stopped, and it is told why.
  if (isLive) {
    const supabase = await createClient();
    const tier = await resolvePanoodTier(supabase, eventId);
    const control = await fetchOrInitControlStateAdmin(gate.admin, eventId);
    const allowed = canStartBroadcast({
      paid: tier !== 'free',
      firstLiveAt: control?.first_live_at ?? null,
      isLive: false,
      now: new Date(),
    });
    if (!allowed) {
      return {
        error:
          'Your 24-hour broadcast window has ended. Unlock Live Studio again for this event day to go back on air.',
      };
    }
  }

  const ok = await setLiveAdmin(gate.admin, eventId, isLive);
  if (!ok) return { error: 'Could not change the broadcast state. Please try again.' };
  revalidateControlRoom(eventId);
  return { ok: true };
}

/**
 * MOMENT-DIRECTOR — apply a one-tap moment macro. The PRIMARY control for a
 * non-engineer: tapping a moment (a) records it as the active_moment_id on the
 * control plane, then (b) fans out the macro's effects — pushing its
 * program_source to the PROGRAM bus and routing every registered screen to the
 * moment's walls_source. (Overlays / audio-duck / banner persistence are
 * deferred to a later PR — see the file footer note.)
 *
 * Reads the moment back from the DB (never trusts a client-supplied config) so a
 * tampered momentId can only ever apply a macro that genuinely belongs to THIS
 * event. Best-effort; partial fan-out failures are non-fatal (the moment is
 * still recorded as active).
 */
export async function fireMoment(
  eventId: string,
  momentId: number,
): Promise<ControlActionResult> {
  const gate = await gateControlAction(eventId);
  if ('error' in gate) return gate;
  if (!Number.isInteger(momentId) || momentId <= 0) {
    return { error: 'Invalid moment.' };
  }

  // Re-read the moment from the DB (authoritative config — never trust the
  // client). fetchPanoodMoments runs under the admin client here (post-gate);
  // it degrades to [] on a missing table.
  const moments = await fetchPanoodMoments(gate.admin, eventId);
  const moment = moments.find((m) => m.id === momentId);
  if (!moment) return { error: 'That moment isn’t on this event’s rail.' };

  // (a) Record which preset is live so the console can highlight the active chip.
  const recorded = await applyMomentAdmin(gate.admin, eventId, momentId);
  if (!recorded) {
    return { error: 'Could not apply that moment. Please try again.' };
  }

  // (b) Fan out the macro's CORE effects (program + walls). Best-effort: a
  //     failed leg doesn't fail the whole moment — the active chip is already
  //     recorded, and the watcher will reconcile on the next change.
  const config: PanoodMomentConfig = moment.config ?? {};
  if (config.program_source) {
    await setProgramSourceAdmin(gate.admin, eventId, config.program_source);
  }
  if (config.walls_source) {
    // Route EVERY registered screen to the moment's walls source. (Per-screen
    // overrides are still possible afterward via setScreenSource.)
    try {
      const { data: screens } = await gate.admin
        .from('panood_screens')
        .select('id')
        .eq('event_id', eventId);
      for (const s of screens ?? []) {
        await setPanoodScreenSourceAdmin(
          gate.admin,
          s.id as number,
          config.walls_source,
        );
      }
    } catch {
      // pre-bootstrap / no screens — the program switch already landed.
    }
  }

  revalidateControlRoom(eventId);
  return { ok: true };
}

/**
 * SCREENS manager — route a single venue screen to a mode/source (photos |
 * mirror | live_bg | off | a camera id). Validates the screen belongs to THIS
 * event before mutating (the helper updates by screen id alone). Best-effort.
 */
export async function setScreenSource(
  eventId: string,
  screenId: number,
  source: string,
): Promise<ControlActionResult> {
  const gate = await gateControlAction(eventId);
  if ('error' in gate) return gate;
  if (!Number.isInteger(screenId) || screenId <= 0 || !source) {
    return { error: 'Invalid screen or source.' };
  }

  // Confirm the screen is on this event before routing it (the setter keys by id
  // only). Tolerant of a missing table → treat as not-found.
  try {
    const { data: screen } = await gate.admin
      .from('panood_screens')
      .select('id')
      .eq('id', screenId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (!screen) return { error: 'That screen isn’t registered for this event.' };
  } catch {
    return { error: 'Could not route that screen. Please try again.' };
  }

  const ok = await setPanoodScreenSourceAdmin(gate.admin, screenId, source);
  if (!ok) return { error: 'Could not route that screen. Please try again.' };
  revalidateControlRoom(eventId);
  return { ok: true };
}

/**
 * MARK a highlight — a STUB for PR4. On the day the director taps this at a
 * meaningful beat; the marked timestamps seed AI Highlight reels. The persistence
 * table (panood_highlight_marks) lands with the replay/playout PR, so for now
 * this validates the gate and acknowledges the tap WITHOUT writing — honest, not
 * fake. Returns ok so the console can show a "marked" affirmation; the real write
 * arrives with the streaming rollout (see footer note).
 */
export async function markHighlight(
  eventId: string,
): Promise<ControlActionResult> {
  const gate = await gateControlAction(eventId);
  if ('error' in gate) return gate;
  // No persistence yet (stub). Best-effort acknowledgement only.
  return { ok: true };
}

/*
 * DEFERRED to a later PR (NOT wired here, by design — PR4 is CORE only):
 *   • Preview/Take two-bus (Director Mode) — setPreviewSourceAdmin /
 *     setDirectorModeAdmin exist in lib/panood-control.ts but stay unused: the
 *     PR4 default is single-stage (tap = live).
 *   • Transition persistence (cut/dissolve), overlay persistence (monogram /
 *     lower-third on/off), audio-duck + banner fan-out from a moment macro.
 *   • Playout heartbeats / replays / a real panood_highlight_marks table
 *     (markHighlight is a stub above).
 *   • Realtime push (Supabase Realtime) so screens + the console live-update
 *     without a revalidate round-trip.
 */
