/**
 * invitation-words-draft — the couple's note to their guests, started for them.
 *
 * ─── THE DEFECT ───────────────────────────────────────────────────────────
 * "Special message" is a blank box. Every other invitation product on the
 * market drafts something and lets you change it; we ask a couple to write to
 * their whole guest list from nothing, in a 4-row textarea, with a placeholder
 * that only describes what a good message would be like. Most people write
 * nothing at all, so the section simply never appears on their site.
 *
 * ─── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────
 * ⛔ NOT A LANGUAGE MODEL, and it must never become one. Setnayan AI is
 * DETERMINISTIC by owner lock, and the product already has the composer this
 * follows: `app/[slug]/_components/editorial/compose.ts` weaves the same kind
 * of prose for the story page under one rule — **it never invents facts. Every
 * sentence is gated on a field being present, and if nothing is present it
 * renders less.** This is that discipline applied one surface earlier.
 *
 * ⛔ NOT A WRITE. Nothing here is saved. The draft is offered as the starting
 * text of the box; it becomes the couple's message only when they press Save,
 * exactly as anything they typed themselves would. The stored value stays
 * empty until then, so the editor row still honestly reads "Not set".
 *
 * ─── THE RULES THAT MAKE IT SAFE TO SHOW ──────────────────────────────────
 *
 * 1 · IT SAYS ONLY WHAT THE EVENT ALREADY KNOWS. The names, the date, the
 *     venue. A missing field drops its clause rather than inviting a guess, and
 *     with nothing to go on it returns `null` and the box stays as it is —
 *     because a draft reading "join us at TBD" is worse than a blank box.
 *
 * 2 · 🕊 A WAKE IS NEVER DRAFTED A CELEBRATION. The solemn register (owner
 *     2026-08-17: a funeral is a TONE across the whole guest tree) gets its own
 *     quiet words — no "celebrate", no "can't wait", no exclamation. This is
 *     the single most important line in the file: a cheerful auto-draft on a
 *     funeral page is the exact defect the whole solemn register exists to
 *     prevent, and an auto-composer is the likeliest place for it to come back.
 *
 * 3 · IT SPEAKS THE EVENT'S OWN VOCABULARY. `occasionNoun` and `eventWord`
 *     come from the type's terminology, so a birthday does not read "wedding"
 *     and a gathering does not read "celebration".
 */

export type InvitationWordsInput = {
  /** How the couple's own chrome names them ("Cale & Ice"). */
  displayName: string | null;
  /** ISO date, or null when it is not settled. */
  eventDate: string | null;
  /** Where it happens, or null. */
  venueName: string | null;
  /** The type's own word for the occasion ('celebration' / 'gathering'). */
  occasionNoun: string;
  /** 'celebratory' for every type but a wake. */
  register: 'celebratory' | 'solemn';
  /** Already-written words. A draft is only ever offered into an EMPTY box. */
  existing: string | null;
};

const MAX = 600;

/** "12 December 2026" in the event's own calendar day — never re-derived from
 *  an instant, because `events.event_date` is a DATE and `new Date('…')` reads
 *  it as midnight UTC, which is the previous day west of Greenwich. */
function readableDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = MONTHS[Number(mo) - 1];
  if (!month) return null;
  return `${Number(d)} ${month} ${y}`;
}

const clean = (s: string | null | undefined): string =>
  typeof s === 'string' ? s.trim() : '';

/**
 * The draft, or `null` when there is nothing true to say — or when the couple
 * has already written something.
 */
export function invitationWordsDraft(input: InvitationWordsInput): string | null {
  // ⚠ NEVER OVER SOMEBODY'S OWN WORDS. Even one character means they have
  // started; replacing it would be the product editing their message.
  if (clean(input.existing) !== '') return null;

  const names = clean(input.displayName);
  const venue = clean(input.venueName);
  const date = readableDate(input.eventDate);
  const occasion = clean(input.occasionNoun) || 'celebration';

  // Nothing known ⇒ nothing offered. A draft made of placeholders is worse
  // than the blank box it replaced.
  if (!names && !venue && !date) return null;

  if (input.register === 'solemn') {
    // 🕊 The quiet arm. No "celebrate", no exclamation, no anticipation —
    // "we can't wait to see you" is a sentence nobody writes about a wake.
    const where =
      venue && date
        ? `We will gather at ${venue} on ${date}.`
        : venue
          ? `We will gather at ${venue}.`
          : date
            ? `We will gather on ${date}.`
            : null;
    return [
      'Thank you for being with us.',
      where,
      'Your presence means a great deal to our family.',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, MAX);
  }

  // The opening does not repeat the couple's own names back at them — this is
  // written in THEIR voice, on their own page, where the names are already the
  // headline. `names` is read only as evidence the event is real enough to
  // draft for at all.
  const opening = `We are so glad you are part of this ${occasion}.`;
  const where =
    venue && date
      ? `Join us at ${venue} on ${date}.`
      : venue
        ? `Join us at ${venue}.`
        : date
          ? `Join us on ${date}.`
          : null;
  return [opening, where, 'It would not be the same without you.']
    .filter(Boolean)
    .join(' ')
    .slice(0, MAX);
}

/** The line shown under the box, so nobody mistakes our words for theirs. */
export const INVITATION_WORDS_HINT =
  'A starting point, not your words yet — change anything, or clear it. Nothing is saved until you press Save.';
