/**
 * 🪪 INVITATION › ME — WHO, AS WHAT, WHEN AND WHERE, AND THE ONE QUESTION (owner 2026-10-24, approved: "Approve the
 * corrected Me redesign. Build it." — the contract is `Setnayan/prototypes/me_tab_redraw_2026-10-24_fable.html`).
 *
 *   top       "Your invitation" (a guest) · the FORMAL name, in the event's Name style (`placeCardName`) — never
 *             "Hi, Inda" (2026-09-30) · the role in small caps with "· Groom's side" after it (a plain guest has NO
 *             role line — no "Guest" badge) · the date (only as exact as the hosts decided; none → no line) ·
 *             Ceremony / Reception, each on its labelled line (`VENUE_ROLE_LABEL`; one place for both → one line).
 *   foot      the shipped Reply card's words (`replyCardOf`): "Will you join us?" · "Reply by …" · Reply; after a
 *             yes "You're coming ✓" · "N seats" · an outline "Change my reply"; declined "You can't make it"; a shut
 *             window draws its line and no button.
 *
 * 🎨 The role's colours are NOT on the role line (the prototype's review: "the palette dots are dropped from the line:
 * the same colours sit two sections down, named") — one place for the colour fact: Me › What to wear.
 *
 * 🔤 NO SENTENCE. The "We'd love to celebrate with you on … You're joining us as …" paragraph was OUR default copy (no
 * field held it); it left the Welcome with this, and with it the word "celebrate".
 *
 * Pure: the page hands in what it already resolved; `guest-greeting.tsx` draws it.
 */
import type { ReplyCard } from './guest-me-parts';
import type { EventVenue } from './event-venues';
import { VENUE_ROLE_LABEL } from './event-venues';
import { formatEventDate, formatEventDateWithPrecision } from './events';

export type GuestGreetingAsk = {
  /** The line in the display face: "Will you join us?" · "You're coming" · "You can't make it" · a shut window's. */
  line: string;
  /** Draw a ✓ after the line (a guest who is coming). */
  check: boolean;
  /** The small line under it: "Reply by …", "1 seat", "Need to change? Message the couple." — or null. */
  sub: string | null;
  /** The button: its words and where it goes, or null (a shut window draws none). */
  cta: { label: string; href: string; quiet: boolean } | null;
  /** The card's kind, for the `data-arrival-action` mark the couple's Look › Buttons keys on. */
  kind: ReplyCard['kind'];
};

export type GuestGreeting = {
  eyebrow: string;
  name: string | null;
  role: string | null;
  /** "Groom's side" — said after the role (never alone: a plain guest has no role line). */
  tail: string | null;
  date: string | null;
  venues: { label: string | null; name: string }[];
  /** 🧍 "Standing in for Mrs. Ma. Theresa Sacdalan-Tria" (a proxy) · "Maria Catherine Sacdalan is standing in for you"
   *  (the role holder) — `lib/guest-proxy.ts`. Null for everyone else. */
  standIn: string | null;
};

/** The roles that are no role at all — a plain guest gets no role line. */
const PLAIN_ROLES: ReadonlySet<string> = new Set(['guest']);

/** The question block, from the shipped Reply card (`replyCardOf`) — its words and its CTA, re-placed. */
export function greetingAskOf(card: ReplyCard | null): GuestGreetingAsk | null {
  if (!card) return null;
  if (card.cta === null || card.href === null) {
    return { line: card.line, check: false, sub: card.replyBy, cta: null, kind: card.kind };
  }
  const cta = card.cta;
  const href = card.href;
  if (card.kind === 'going') {
    /* "You’re coming · 2 seats" → "You’re coming ✓" over "2 seats" (the prototype's state 2). */
    const at = card.line.indexOf(' · ');
    const head = at > 0 ? card.line.slice(0, at) : card.line;
    const seats = at > 0 ? card.line.slice(at + 3) : null;
    /* "N more answers" is still something to DO — it keeps the filled button. */
    return { line: head, check: true, sub: seats, cta: { label: cta, href, quiet: !('more' in card && card.more) }, kind: 'going' };
  }
  if (card.kind === 'declined') {
    return { line: card.line, check: false, sub: null, cta: { label: cta, href, quiet: true }, kind: 'declined' };
  }
  return { line: card.line, check: false, sub: card.replyBy, cta: { label: cta, href, quiet: false }, kind: card.kind };
}

export function guestGreetingOf(input: {
  /** The formal name in the event's Name style (`placeCardName`), else the display name. */
  name: string | null;
  /** The guest's role code ('guest', 'groom', a sponsor …) and its word (`roleWordOfGuest`). */
  roleCode: string | null;
  roleWord: string | null;
  /** "Groom's side" etc. — null where the event has no sides (`side_labels`). */
  sideLabel: string | null;
  /** The date line, already worded to the precision the hosts decided — null with none. */
  date: string | null;
  venues: readonly Pick<EventVenue, 'role' | 'name'>[] | null;
  /** The single venue line, when the event has no venue list. */
  venueName: string | null;
  /** 🧍 The proxy line, already worded (`standingInWords` / `standsInForYouWords`) — absent for everyone else. */
  standIn?: string | null;
}): GuestGreeting {
  const name = input.name?.trim() || null;
  const role = input.roleCode && !PLAIN_ROLES.has(input.roleCode) ? input.roleWord?.trim() || null : null;
  const tail = input.sideLabel?.trim() || null;
  const named = (input.venues ?? [])
    .map((v) => ({ label: VENUE_ROLE_LABEL[v.role] ?? null, name: (v.name ?? '').trim() }))
    .filter((v) => v.name.length > 0);
  const venues = named.length > 0 ? named : input.venueName?.trim() ? [{ label: null, name: input.venueName.trim() }] : [];
  return {
    eyebrow: 'Your invitation',
    name,
    role,
    // A plain guest's side is not a role line.
    tail: role ? tail : null,
    date: input.date?.trim() || null,
    venues,
    standIn: input.standIn?.trim() || null,
  };
}

/**
 * The date line — the day alone, or only as much as the hosts decided ("August 2027", "Sometime in 2027"); null with
 * no date (a dateless event prints no hole — `a-dateless-event-prints-no-hole.test.ts`).
 */
export function greetingDateLine(eventDate: string | null | undefined, precision?: string | null): string | null {
  const iso = (eventDate ?? '').trim();
  if (!iso) return null;
  if (precision === 'month' || precision === 'year') return formatEventDateWithPrecision(iso, precision) || null;
  return formatEventDate(iso) || null;
}
