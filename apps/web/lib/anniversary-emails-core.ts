// Pure, `server-only`-free core for the two anniversary emails, so the copy is
// unit-testable. `lib/anniversary-emails.ts` re-exports it behind the
// `server-only` guard the other email modules wear; nothing else changes for
// callers. Same split, and the same reason, as lib/papic-fullres-drop-core.ts.
//
// 🪤 IT HAD TO BE SPLIT TO BE GUARDED AT ALL. `server-only` is a Next.js
// build-time shim and is not an installed package — importing a module that
// requires it under `tsx --test` dies with MODULE_NOT_FOUND before a single
// assertion runs. A guard that cannot import the thing it guards is not a
// weaker guard, it is no guard.
import { renderBrandedEmail } from '@/lib/email-template';
import { articleFor, type EventWords } from '@/app/[slug]/_lib/event-words';

// Anniversary "on this day" re-engagement email (PR-G).
//
// A daily CRON-FREE job (runAnniversaryDigest in lib/daily-email-jobs.ts, fired
// from public-page after() traffic) resolves the couples whose
// anniversary is TODAY (via the couples_with_anniversary_today RPC) and
// sends each this warm "N years ago today — relive your day" recap. This module
// only SHAPES the email; the cron does the DB read, the idempotency lock, and
// the actual sendEmail() call.
//
// buildAnniversaryEmail() is pure + side-effect-free (the 'server-only' guard
// just keeps it off the client bundle, mirroring the other email modules). The
// copy is worded so it still reads right if a couple opens it late.
//
// ── 🚨 IT SAID "YOU SAID I DO" TO EVERY EVENT TYPE ──────────────────────────
// Both builders below were hardcoded wedding copy, and NOTHING upstream
// filtered by event type: the selector matched on month/day alone, and its
// recipient is picked by `event_members.member_type = 'couple'` — LEGACY
// NAMING that every event type mints, not a wedding marker. Measured against
// production: both non-wedding events carry a 'couple'-typed member. So this
// was live, not latent.
//
// One year after a wake, a bereaved family was in line to receive
// *'1 year ago today, you said "I do."'* and, six weeks before it,
// *"Your first wedding anniversary is about 6 weeks away … worth
// celebrating."*
//
// ── THE FIX IS TWO GATES, IN TWO PLACES, ON PURPOSE ─────────────────────────
// 1. The SELECTOR refuses solemn event types outright (migration
//    20271174085072). That is the fence: a predicate cannot be forgotten by
//    the next template the way a branch in this file can.
// 2. THIS FILE cannot speak wedding words to a non-wedding, and REFUSES TO
//    RENDER AT ALL for the solemn register — both builders return `null`, and
//    the job treats `null` as "do not send".
//
// ⚖ THE FAILURE DIRECTION IS SILENCE. An unsent anniversary email costs one
// marketing touch; a wrongly-sent one arrives unprompted in a grieving
// family's inbox. Every unknown resolves toward not sending.
//
// 🔒 A WEDDING READS BYTE-IDENTICALLY TO BEFORE THIS CHANGE. The wedding arm
// is keyed on the EVENT TYPE, never on the resolved noun (an admin can edit
// `event_word`; the type key is what the profile is filed under), and
// `anniversary-emails.test.ts` pins its literal strings. If a future edit moves
// what a couple reads, that test fails rather than the change shipping quietly.

export const ANNIVERSARY_SUPPORT_EMAIL = 'support@setnayan.com';

/**
 * The words this module needs, and no more.
 *
 * A narrow structural type rather than the whole `EventWords` so the builders
 * stay pure and directly testable — but `EventWords` satisfies it, so the job
 * hands its resolved words straight in with no adapter.
 */
export type AnniversaryWords = Pick<EventWords, 'eventWord' | 'solemn'>;

export type AnniversaryEmailParts = {
  /** The couple's display name, e.g. "Maria & Jose". */
  coupleName: string;
  /** The event's display name (used as a gentle fallback in copy). */
  eventName: string;
  /** Whole years since the event (>= 1). */
  yearsAgo: number;
  /** Absolute URL to relive the day (their gallery / library). */
  ctaHref: string;
  /**
   * The event's own type key — 'wedding' · 'funeral' · 'birthday' · …
   *
   * Keyed on the TYPE, not the noun: this is what selects the byte-identical
   * wedding arm, and an admin can rename any type's `event_word` from the
   * console while the key it is filed under stays put.
   */
  eventType: string | null;
  /** The event's own words, resolved by the caller from its profile. */
  words: AnniversaryWords;
};

export type AnniversaryEmail = {
  subject: string;
  text: string;
  html: string;
};

/** "1 year" vs "3 years" — keep the plural honest. Pure. */
function yearsPhrase(yearsAgo: number): string {
  const n = Math.max(1, Math.trunc(yearsAgo));
  return n === 1 ? '1 year' : `${n} years`;
}

/**
 * "your wedding" · "your birthday" · "your trip" · "an event".
 *
 * 🪤 THE ARTICLE IS A CALL, NEVER A CONCATENATION. The guest tree already paid
 * for this: a door that used to say the literal "a wedding" and started saying
 * `a ${eventWord}` shipped "a event" and "a anniversary" to real readers, and
 * its author found them only by rendering every type. `articleFor` is the
 * repo's one answer; this module reuses it rather than growing a second.
 */
function anEvent(words: AnniversaryWords): string {
  const w = words.eventWord.trim() || 'event';
  return `${articleFor(w)} ${w}`;
}

function yourEvent(words: AnniversaryWords): string {
  return `your ${words.eventWord.trim() || 'event'}`;
}

/**
 * Build the anniversary recap email for one event.
 *
 * Returns `null` when the occasion is one this email has no business marking —
 * today, the solemn register (a wake). Pure: the caller pairs the returned
 * parts in sendEmail() and adds the RFC 8058 unsubscribe headers.
 */
export function buildAnniversaryEmail(
  parts: AnniversaryEmailParts,
): AnniversaryEmail | null {
  const { coupleName, eventName, yearsAgo, ctaHref, eventType, words } = parts;

  // 🔒 THE SECOND GATE. The selector already refuses solemn types, so reaching
  // here means something upstream changed — a new caller, a widened predicate,
  // a hand-run backfill. Refuse rather than trust that it stayed refused.
  if (words.solemn) return null;

  const yp = yearsPhrase(yearsAgo);
  const who = (coupleName ?? '').trim() || (eventName ?? '').trim() || 'you';
  const isWedding = eventType === 'wedding';

  const subject = `${yp} ago today 💛`;

  const greeting = `Hi ${who},`;
  // 🔒 The wedding arm is the string that shipped, character for character.
  const p1 = isWedding
    ? `${yp} ago today, you said "I do." We hope this finds you smiling at the memory.`
    : `${yp} ago today, you had ${anEvent(words)} worth remembering. We hope this finds you smiling at the memory.`;
  const p2 = `Every photo, every clip, every moment from ${
    isWedding ? 'your wedding' : yourEvent(words)
  } is still waiting for you on Setnayan. Take a few minutes today to scroll back through it — relive your day exactly as it happened.`;
  const p3 = `Here's to many more. 💛`;

  const footnote = `You're receiving this because you celebrated ${
    isWedding ? 'your wedding' : yourEvent(words)
  } with Setnayan. To stop anniversary reminders, reply with "unsubscribe" or email ${ANNIVERSARY_SUPPORT_EMAIL}.`;

  const text = [
    greeting,
    '',
    p1,
    '',
    p2,
    '',
    `Relive your day:`,
    ctaHref,
    '',
    p3,
    '',
    `— Set na 'yan.`,
    '',
    footnote,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: `${yp} ago today 💛`,
    paragraphs: [greeting, p1, p2, p3],
    ctaLabel: 'Relive your day',
    ctaHref,
    footnote,
  });

  return { subject, text, html };
}

/**
 * Build the FIRST-ANNIVERSARY HEADS-UP email (date-anchor planning-timing
 * reminder). Sent ~6 weeks BEFORE a couple's 1st anniversary (the
 * proactive nudge the lifecycle research valued most — the moment to plan
 * something and the natural Membership touch). Pure; the cron-free job pairs it
 * in sendEmail(). `weeksAway` is the friendly countdown (default 6).
 *
 * Returns `null` for the solemn register, exactly like the digest above — and
 * this one matters more, because its whole subject is *"worth celebrating"*.
 */
export function buildAnniversaryHeadsupEmail(
  parts: {
    coupleName: string;
    eventName: string;
    ctaHref: string;
    weeksAway?: number;
    eventType: string | null;
    words: AnniversaryWords;
  },
): AnniversaryEmail | null {
  const { coupleName, eventName, ctaHref, eventType, words } = parts;
  if (words.solemn) return null;

  const weeks = Math.max(1, Math.trunc(parts.weeksAway ?? 6));
  const who = (coupleName ?? '').trim() || (eventName ?? '').trim() || 'you';
  const away = weeks === 1 ? 'about a week' : `about ${weeks} weeks`;
  const isWedding = eventType === 'wedding';

  const subject = `Your 1st anniversary is coming up 💛`;
  const greeting = `Hi ${who},`;
  // 🔒 Wedding: byte-identical. Otherwise the sentence is rebuilt rather than
  // patched — "Your first birthday anniversary" is what a naive noun swap
  // produces, and a birthday's anniversary is just a birthday.
  const p1 = isWedding
    ? `Your first wedding anniversary is ${away} away. A whole year already — worth celebrating.`
    : `${away.charAt(0).toUpperCase()}${away.slice(1)} from now it will be a year since ${yourEvent(
        words,
      )}. A whole year already — worth celebrating.`;
  const p2 = `There's still plenty of time to plan something lovely: a dinner, a getaway, a little surprise. Open Setnayan to see it on your year and start when you're ready — no pressure, we'll keep track of the date for you.`;
  const p3 = `Here's to your first of many. 💛`;

  const footnote = `You're receiving this because you celebrated ${
    isWedding ? 'your wedding' : yourEvent(words)
  } with Setnayan. To stop anniversary reminders, reply with "unsubscribe" or email ${ANNIVERSARY_SUPPORT_EMAIL}.`;

  const text = [
    greeting, '', p1, '', p2, '', `Plan your anniversary:`, ctaHref, '', p3, '',
    `— Set na 'yan.`, '',
    footnote,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: `Your 1st anniversary is coming up 💛`,
    paragraphs: [greeting, p1, p2, p3],
    ctaLabel: 'Plan your anniversary',
    ctaHref,
    footnote,
  });

  return { subject, text, html };
}

/** RFC 8058 one-click unsubscribe headers for the anniversary send. Pure. */
export function anniversaryUnsubscribeHeaders(): Record<string, string> {
  return {
    'List-Unsubscribe': `<mailto:${ANNIVERSARY_SUPPORT_EMAIL}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
