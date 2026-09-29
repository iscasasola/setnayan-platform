/**
 * apps/web/lib/guest-requests.ts
 *
 * 🛂 NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE COUPLE KEEPS OR LINKS THEM
 * (owner, DECISION_LOG 2026-09-26 — *"yes they need to be link and accepted to
 * an existing guest list"* — reversing the 2026-06-25 optimistic admit).
 *
 * A REQUEST is a `guests` row with `entry_source = 'self_added_unlisted'` that
 * carries the person's own answers, and NOTHING that lets them in:
 *
 *   · no `event_members` row (so the event is absent from their account, their
 *     app and their event picker — owner: *"that event won't show until they
 *     are part of the list"*);
 *   · no guest-session cookie (the cookie IS the key on the accountless path);
 *   · a signed-in asker is remembered in `guest_claims` (claimer_user_id →
 *     target_guest_id = the request row, status `pending_review`) so Keep/Link
 *     can bind THAT account afterwards — no new table, no new column.
 *
 * The couple decides in Guest List → Requests with the shipped verbs
 * **Keep · Remove · Link** (owner 2026-09-26: *"Keep remove and link"*).
 * Keep or Link issues the key; Remove tells them nothing.
 *
 * A NAME IS NOT A SECRET. A typed name only ever SUGGESTS a match to the couple
 * (`suggestRequestMatch`); it never binds anyone to anything.
 *
 * Pure — no I/O — so the rules can carry a unit suite.
 */
import { classifyClaimMatch, MAX_NAME_LENGTH, type SeedCandidate } from '@/lib/guest-claim-core';
import { MEAL_LABELS, type MealPreference, type RsvpStatus } from '@/lib/guests';
import { rsvpAsks, type RsvpAskConfig } from '@/lib/rsvp-ask';
import { formatCount } from '@/lib/format-number';

/**
 * What the guest may answer on the ask-to-join form — yes or no, nothing else.
 * ⚖ NO MIDDLE ANSWER (owner 2026-09-30: "for now. let us fix the RSVP remove
 * the maybe"). A posted 'maybe' finds no entry here and is refused as
 * `missing_answer` ("Please tell us whether you will be there."). The column and
 * its CHECK still allow 'maybe' — the couple's own Guest list can set it.
 */
export const REQUEST_ANSWERS: readonly { value: Extract<RsvpStatus, 'attending' | 'declined'>; label: string }[] = [
  { value: 'attending', label: 'Joyfully accepts' },
  { value: 'declined', label: 'Regretfully declines' },
];

/** The most seats one request may ask for (themselves + four). */
export const REQUEST_MAX_SEATS = 5;

const MEALS = Object.keys(MEAL_LABELS) as MealPreference[];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RequestAnswers = {
  name: string;
  rsvp_status: 'attending' | 'declined';
  seats: number;
  meal_preference: MealPreference;
  dietary_restrictions: string | null;
  guest_note: string | null;
  email: string | null;
  mobile: string | null;
};

type Getter = { get(name: string): FormDataEntryValue | null };

const text = (fd: Getter, key: string, max: number): string =>
  String(fd.get(key) ?? '').trim().slice(0, max);

/**
 * Read the ask-to-join form. Only the questions the couple still asks are
 * read (`ask`), exactly as the RSVP enforces them. Contact is required — an
 * email or a mobile — because Keep/Link has to reach the person with their
 * key; a signed-in asker's account email counts (`accountEmail`).
 */
export function readRequestAnswers(
  fd: Getter,
  ask: RsvpAskConfig,
  accountEmail: string | null = null,
): { ok: true; value: RequestAnswers } | { ok: false; error: string } {
  const name = text(fd, 'name', MAX_NAME_LENGTH);
  if (!name) return { ok: false, error: 'missing_name' };

  const answer = text(fd, 'rsvp_status', 16);
  const picked = REQUEST_ANSWERS.find((a) => a.value === answer);
  if (!picked) return { ok: false, error: 'missing_answer' };

  let seats = 1;
  if (rsvpAsks(ask, 'plus_ones') && picked.value !== 'declined') {
    const n = Number.parseInt(text(fd, 'seats', 2), 10);
    if (Number.isFinite(n)) seats = Math.min(REQUEST_MAX_SEATS, Math.max(1, n));
  }

  const mealRaw = text(fd, 'meal_preference', 32) as MealPreference;
  const meal_preference: MealPreference =
    rsvpAsks(ask, 'meal') && MEALS.includes(mealRaw) ? mealRaw : 'no_preference';
  const dietary_restrictions = rsvpAsks(ask, 'dietary') ? text(fd, 'dietary_restrictions', 500) || null : null;
  const guest_note = rsvpAsks(ask, 'note') ? text(fd, 'guest_note', 1000) || null : null;

  const typedEmail = text(fd, 'contact_email', 254).toLowerCase();
  if (typedEmail && !EMAIL_RE.test(typedEmail)) return { ok: false, error: 'bad_email' };
  const email = typedEmail || (accountEmail ? accountEmail.trim().toLowerCase() : '') || null;
  const mobile = rsvpAsks(ask, 'mobile') ? text(fd, 'contact_mobile', 32) || null : null;
  if (!email && !mobile) return { ok: false, error: 'missing_contact' };
  // The Terms tick on the request (prototype 7b) — unticked is refused here,
  // not only by the browser's `required`.
  if (String(fd.get('terms') ?? '') !== 'on') return { ok: false, error: 'missing_terms' };

  return {
    ok: true,
    value: { name, rsvp_status: picked.value, seats, meal_preference, dietary_restrictions, guest_note, email, mobile },
  };
}

/**
 * The seats a request asked for ride in the couple's own note on the request
 * row — never in `plus_one_count`, which would make seats nobody has approved.
 * Keep reads it back to prefill "+N"; the couple decides.
 */
const SEATS_NOTE_RE = /^Asked for (\d) seats?\./;
export function requestedSeatsNote(seats: number): string | null {
  if (!Number.isFinite(seats) || seats <= 1) return null;
  return `Asked for ${formatCount(Math.min(REQUEST_MAX_SEATS, Math.floor(seats)))} seats.`;
}
export function readRequestedSeats(notes: string | null | undefined): number {
  const m = SEATS_NOTE_RE.exec((notes ?? '').trim());
  return m ? Math.min(REQUEST_MAX_SEATS, Number(m[1])) : 1;
}

/**
 * The suggested match the couple sees beside a request ("Same as Carla D.").
 * A SUGGESTION ONLY — the couple presses Link to act on it. Ambiguous (two
 * people on the list look alike) or no match → null ("No one like this on
 * your list").
 */
export function suggestRequestMatch(name: string, candidates: SeedCandidate[]): SeedCandidate | null {
  const m = classifyClaimMatch(name, candidates);
  return m.kind === 'confident' ? m.candidate : null;
}

/**
 * The Keep line prefilled for the couple: the typed name, plus "+N" when the
 * request asked for more than one seat (the capture bar's own grammar).
 */
export function keepLineFor(name: string, notes: string | null | undefined): string {
  const extra = readRequestedSeats(notes) - 1;
  return extra > 0 ? `${name} +${extra}` : name;
}

/**
 * MAY THIS EMAIL BIND AN ACCOUNT TO A SEAT? The email fast paths (a signed-in
 * account whose address the couple recorded on a guest) are proof of the
 * inbox, not a name — but a REQUEST row carries the address the asker typed
 * themselves, so matching it would let anyone in by typing their own email on
 * the request and then signing in. Only a row the couple put on the list
 * (`host_seeded`) may be bound by email.
 */
export function emailMayBindRow(entrySource: string | null | undefined): boolean {
  return entrySource === 'host_seeded';
}

/** "2 h ago" / "yesterday" / "3 d ago" — how long a request has waited. */
export function requestAge(createdAt: string, now: number = Date.now()): string {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} d ago`;
}

/** "+63 917 ··· 4421" — enough for the couple to recognise, not to copy. */
export function maskMobile(mobile: string | null | undefined): string | null {
  const digits = (mobile ?? '').replace(/[^\d+]/g, '');
  if (digits.length < 7) return null;
  return `${digits.slice(0, digits.startsWith('+') ? 6 : 4)} ··· ${digits.slice(-4)}`;
}
