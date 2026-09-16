/**
 * THE MESSAGE A COUPLE PASTES INTO VIBER — one guest, one link.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Measured on a real event, 2026-09-16: **75 of 77 guests have no email AND no
 * mobile**; exactly one has an email. V1 sends no SMS and delivers no Viber
 * message itself, so for 97% of that guest list there is no channel the product
 * can reach at all. What the couple actually does is open Viber and type.
 *
 * Sponsors already had this: `buildInvitationMessage` in `event-sponsors.ts`
 * writes the text, the modal copies it, "Mark sent" records it — and its own
 * docblock says *"host pastes into Messenger / Viber / email."* Guests had a
 * single shared join link and nothing else. **This is that shipped pattern
 * extended to guests; it is not a new idea.**
 *
 * 🔑 THE ONE THING THAT MAKES IT DIFFERENT FROM THE SPONSOR MESSAGE: it carries
 * the guest's OWN invitation link. A sponsor message is an asking; a guest
 * message is a door. Which is why a message without the link is not a weaker
 * message — it is a broken one, and this module refuses to build it.
 */

/** Roles whose ceremonial standing is worth naming in the message itself. */
const ROLE_SENTENCE: Record<string, string> = {
  principal_sponsor_ninong: 'It would mean the world to us to have you stand with us as our Ninong.',
  principal_sponsor_ninang: 'It would mean the world to us to have you stand with us as our Ninang.',
  best_man: 'And we would be honoured if you would stand beside us as our Best Man.',
  maid_of_honor: 'And we would be honoured if you would stand beside us as our Maid of Honour.',
  bridesmaid: 'And we would love for you to walk with us as one of our bridesmaids.',
  groomsman: 'And we would love for you to walk with us as one of our groomsmen.',
};

export type GuestInviteContext = {
  /** The guest's name as stored — the first word is what the greeting uses. */
  guestName: string;
  /** `guests.role`. Unknown or plain-guest roles simply add no sentence. */
  role?: string | null;
  /** "Cale & Ice" — whatever the event calls the couple. */
  coupleNames: string;
  /** ISO date, or null when the couple has not set one. */
  weddingDate?: string | null;
  /** Ceremony venue, or null. */
  venue?: string | null;
  /** THE GUEST'S OWN invitation URL. Blank → no message at all. */
  inviteUrl: string;
};

/**
 * Format the date the way a Filipino couple would write it in a chat message.
 * Returns null for anything unparseable so the sentence elides cleanly rather
 * than pasting "Invalid Date" into somebody's Viber thread.
 */
function formatDate(raw: string): string | null {
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Build the message, or return NULL when there is no link to put in it.
 *
 * ⚠ THE NULL IS THE SAFETY RULE, NOT AN EDGE CASE. A guest whose QR token has
 * not been issued has no door; a cheerful "you're invited!" with no way in is
 * worse than no message, because the couple has already hit send by the time
 * anybody notices. The caller must not offer a Copy button when this is null.
 *
 * ⚖ THE GREETING USES THE FIRST NAME, and that is a deliberate contrast with
 * `printedCardName` (2026-09-16), which puts the FORMAL name — title, middle
 * name, suffix — on the printed card. Paper is formal; a chat message that
 * opens "Dear Atty. Indalecio Subia Casasola II" reads like a summons. The
 * surface decides, every time.
 */
export function buildGuestInviteMessage(ctx: GuestInviteContext): string | null {
  const url = (ctx.inviteUrl ?? '').trim();
  if (!url) return null;

  const whole = (ctx.guestName ?? '').trim();
  const firstName = whole.split(/\s+/)[0] || null;
  const greeting = firstName ? `Dear ${firstName},` : 'Hello,';

  const couple = (ctx.coupleNames ?? '').trim() || 'We';
  const dateLine = ctx.weddingDate ? formatDate(ctx.weddingDate) : null;
  const venueLine = ctx.venue?.trim() || null;
  const whenWhere = [dateLine, venueLine].filter(Boolean).join(' at ');

  const opening = whenWhere
    ? `${couple} are getting married on ${whenWhere}, and we would love for you to be there.`
    : `${couple} are getting married, and we would love for you to be there.`;

  const roleLine = ctx.role ? (ROLE_SENTENCE[ctx.role] ?? null) : null;

  /* The link gets its own paragraph and its own sentence saying what it IS.
     A bare URL in a chat thread reads as something to be suspicious of; naming
     it as their invitation, with their QR for the day, is the difference
     between a link somebody opens and a link somebody ignores. */
  const linkLines = [
    'Here is your invitation — it carries your own QR code for the day:',
    url,
  ];

  const closing = 'Please let us know if you can make it. We hope to see you there.';
  const sign = `With love,\n${couple}`;

  return [
    greeting,
    '',
    opening,
    ...(roleLine ? ['', roleLine] : []),
    '',
    ...linkLines,
    '',
    closing,
    '',
    sign,
  ].join('\n');
}
