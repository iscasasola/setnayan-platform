'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { anyoneMayAskToJoin } from '@/lib/rsvp-ask';
import { GUEST_LIST_ONLY, inviteReplyPath, selfJoinRefusalPath } from '@/lib/invite-arrival';
import { readGuestSession } from '@/lib/guest-session';
import { formalNameFromForm } from '@/lib/formal-name';
import {
  FIND_ME_IP_LIMIT,
  FIND_ME_NAME_LIMIT,
  FIND_ME_ROW_LIMIT,
  FIND_ME_WINDOW_SECS,
  findOutcome,
  isFindable,
  lastFourMatches,
  namesMatchExactly,
  readTypedLastFour,
} from '@/lib/find-me';
import {
  forgetFindState,
  loadFindableRows,
  logFindAttempt,
  readFindState,
  readFindableRow,
  spendDigitsTry,
  spendNameLookup,
  writeFindState,
} from '@/lib/find-me.server';

/**
 * 🔎 THE GENERIC QR FINDS YOU (owner, DECISION_LOG 2026-09-30). The three
 * presses of the name-first door on an "Anyone, I approve" event — the rules
 * are `lib/find-me.ts`, the state and budgets `lib/find-me.server.ts`.
 *
 * 🔒 NOTHING HERE MINTS A GUEST SESSION. A correct last-4 is sent through
 * `/{slug}/redeem` with that guest's own key — byte-for-byte the hop their
 * personal QR takes — so there is one way in, not two
 * (`lib/find-me-door.test.ts` holds this file to zero `setGuestSession`).
 *
 * Every refusal lands back on the same door with the same kind of answer the
 * existing ask-to-join uses (`selfJoinRefusalPath`), and the door's URL never
 * carries the name, the guest or the digits.
 */

type DoorOpen = { slug: string };

/** The same gates as `selfJoinAction`, in the same order: "Anyone, I approve", public, has an address. */
async function openDoor(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  token: string,
): Promise<DoorOpen> {
  const { data: event } = await admin
    .from('events')
    .select('slug, rsvp_ask_config, landing_page_visibility, scheduled_launch_at, std_launched_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const slug = ((event?.slug as string | null) ?? '').trim() || null;
  const refuse = (error: string): never => redirect(selfJoinRefusalPath({ eventId, token, slug, error }));
  if (!anyoneMayAskToJoin(event?.rsvp_ask_config)) refuse(GUEST_LIST_ONLY);
  if (!event) refuse('invalid_token');
  if (resolveEffectiveVisibility(event!) === 'private') refuse('event_is_private');
  if (!slug) {
    const back = token ? `/join/${eventId}?token=${token}` : `/join/${eventId}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  return { slug: slug! };
}

/** The door this person is standing at (the branded one — every refusal already goes there). */
const doorPath = (slug: string, error?: string) =>
  error ? `/${slug}/invite?error=${encodeURIComponent(error)}` : `/${slug}/invite`;

/**
 * STEP 1 — the name. Always the same work (one candidate read, one match in
 * memory) and always the same redirect back to the door, whatever was found;
 * the door then draws the answer from the encrypted find state.
 */
async function lookUpName(eventId: string, token: string, formData: FormData) {
  const admin = createAdminClient();
  const { slug } = await openDoor(admin, eventId, token);

  // A device that already holds this event's key goes straight to its reply.
  const session = await readGuestSession();
  if (session && session.event_id === eventId) redirect(inviteReplyPath(slug));

  const parts = formalNameFromForm(formData);
  if (!parts.first_name || !parts.last_name) redirect(doorPath(slug, 'missing_name'));

  // Too many look-ups from this connection → it simply stops looking and shows
  // the ask-to-join form. Never an error: a person is not blocked, a scraper
  // just stops learning names.
  const mayLook = await spendNameLookup(eventId, await headers(), FIND_ME_NAME_LIMIT, FIND_ME_WINDOW_SECS);
  const read = mayLook ? await loadFindableRows(admin, eventId) : null;
  const outcome = read ? findOutcome(parts, read.rows, read.bound) : ({ kind: 'none' } as const);

  logFindAttempt({
    eventId,
    guestId: outcome.kind === 'none' ? null : outcome.guestId,
    step: 'name',
    outcome: mayLook ? (read ? outcome.kind : 'unread') : 'throttled',
  });
  await writeFindState({
    eventId,
    parts,
    outcome: outcome.kind,
    guestId: outcome.kind === 'none' ? null : outcome.guestId,
  });
  redirect(doorPath(slug));
}

/**
 * STEP 2 — the last 4 digits of the mobile on file. Correct → the personal
 * QR's own redeem hop. Wrong → "That doesn't match" (never which part).
 * Out of tries → the couple confirms them instead (their Link).
 */
async function checkLastFour(eventId: string, token: string, formData: FormData) {
  const admin = createAdminClient();
  const { slug } = await openDoor(admin, eventId, token);

  const state = await readFindState(eventId);
  if (!state || state.outcome !== 'digits' || !state.guestId) redirect(doorPath(slug));
  const guestId = state!.guestId!;

  // The budget is spent BEFORE the digits are looked at, so a right and a
  // wrong answer cost the same try, and no try is free.
  const allowed = await spendDigitsTry(eventId, guestId, await headers(), {
    ip: FIND_ME_IP_LIMIT,
    row: FIND_ME_ROW_LIMIT,
    windowSecs: FIND_ME_WINDOW_SECS,
  });
  if (!allowed) {
    logFindAttempt({ eventId, guestId, step: 'digits', outcome: 'throttled' });
    await writeFindState({ ...state!, outcome: 'confirm' });
    redirect(doorPath(slug));
  }

  // The row, LIVE: it must still be findable and still carry the name typed —
  // a guest bound, removed or renamed since step 1 is not opened.
  const { row: live, bound } = await readFindableRow(admin, eventId, guestId);
  const typed = readTypedLastFour(formData.get('last4'));
  const ok =
    !!live &&
    isFindable(live, bound) &&
    namesMatchExactly(state!.parts, live) &&
    !!live.qr_token &&
    lastFourMatches(live.mobile, typed);

  logFindAttempt({ eventId, guestId, step: 'digits', outcome: ok ? 'match' : 'no_match' });
  if (!ok) redirect(doorPath(slug, 'no_match'));

  await forgetFindState();
  // ⇒ EXACTLY what opening their personal QR does: `/{slug}?invite=<key>` hands
  // off to this same hop, which mints the guest session, records the scan and
  // sends them on (their reply first when it is still owed).
  redirect(`/${slug}/redeem?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(live!.qr_token!)}`);
}

/** "I don't know that number" — the couple confirms them instead. */
async function askHosts(eventId: string, token: string) {
  const admin = createAdminClient();
  const { slug } = await openDoor(admin, eventId, token);
  const state = await readFindState(eventId);
  if (state && state.outcome === 'digits') {
    logFindAttempt({ eventId, guestId: state.guestId, step: 'digits', outcome: 'asked_hosts' });
    await writeFindState({ ...state, outcome: 'confirm' });
  }
  redirect(doorPath(slug));
}

/** "Not you? Start over" — forget what was typed. */
async function startOver(eventId: string, token: string) {
  const admin = createAdminClient();
  const { slug } = await openDoor(admin, eventId, token);
  await forgetFindState();
  redirect(doorPath(slug));
}

/**
 * THE ONE EXPORTED ACTION for all four presses — each export is a Vercel route
 * and the app sits at its route budget (scripts/lint-server-action-budget.mjs).
 * The press is named by the form's `step`; an unknown step starts over.
 */
export async function findMeAction(eventId: string, token: string, formData: FormData) {
  const step = String(formData.get('step') ?? '');
  if (step === 'name') return lookUpName(eventId, token, formData);
  if (step === 'digits') return checkLastFour(eventId, token, formData);
  if (step === 'hosts') return askHosts(eventId, token);
  return startOver(eventId, token);
}
