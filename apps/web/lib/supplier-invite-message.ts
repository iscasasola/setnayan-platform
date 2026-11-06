/**
 * THE MESSAGE A COUPLE SENDS A SUPPLIER THEY ADDED THEMSELVES — one supplier, their claim link, one builder.
 *
 * ── THE OWNER'S WORDS (DECISION_LOG 2026-10-30, "THE INVITE TEXTS — GUEST AND SELF-ADDED SUPPLIER — APPROVED; A
 * SELF-ADDED SUPPLIER GETS A SHARE BUTTON, AN AUTOMATIC CLAIM LINK AND A DIGITAL CARD") ───────────────────────────
 * *"for the manual suppliers. we will use the same share button. with a text to invite them to sync with our event."*
 * · *"this is another website's message. we want our own"* · *"english. but a more wow approach"* → *"perfect"*.
 *
 * 🔒 THE TEXT BELOW IS THE APPROVED ONE, WORD FOR WORD, ONE LINE PER " / " OF THE RULING. It is not a starting point
 * to improve: `lib/the-supplier-invite-text-is-the-approved-one.test.ts` holds every line of it.
 *
 * ── WHAT FILLS IT ─────────────────────────────────────────────────────────────────────────────────────────────────
 *   {supplier} — the contact person's first name ("Hi Liza!", the prototype's sample), else the shop's name
 *   {event}    — "our wedding": the couple is the one sending ("our event", "our debut")
 *   {date}     — `formatInviteDate`, the guest message's own date rule (a day only; the year when not this year)
 *   {service}  — the row the couple added them under ("Stylist / Decorator")
 *   {link}     — THEIR claim link (made automatically — `createManualVendorInvite`, the one writer)
 *   {hosts}    — `events.display_name`, signing it
 *
 * An absent value takes its lead-in with it, never "on ." or "Hi !". No link → no message (`null`): a message without
 * the door is a broken one, and the caller then offers no Share — the guest builder's rule.
 *
 * Pure: the Share button builds it in the browser and the tests execute it.
 */
import { formatInviteDate } from '@/lib/guest-invite-message';

/** The approved text — the ruling's lines, in order. Placeholders are filled by `buildSupplierInviteMessage`. */
export const SUPPLIER_INVITE_LINES = [
  'Hi {supplier}! 👋',
  "You're part of the team behind {event} on {date}, and we're so glad to have you as our {service}.",
  "We're bringing everything together on Setnayan. Tap to join our event — it only takes a minute:",
  '{link}',
  "Our date, venue, schedule and payments in one place, plus your own card and price. It's free for you.",
  'This link was made just for our event, so please keep it between us.',
  "Let's make it unforgettable. ✨",
  '{hosts}',
] as const;

/* Laid out like the guest invite (lib/guest-invite-message.ts): a blank line between paragraphs, and the link on the
   line right under the sentence that asks for the tap. */
export const SUPPLIER_INVITE_TEMPLATE = SUPPLIER_INVITE_LINES.map((line, i) => (i === 0 ? line : line === '{link}' ? `\n${line}` : `\n\n${line}`)).join('');

export type SupplierInviteFacts = {
  /** The shop's name as the couple recorded it. */
  shopName: string;
  /** The contact person, as typed (may be blank). */
  contactPerson?: string | null;
  /** The event type's word — 'wedding' · 'debut' · 'event'. */
  eventWord?: string | null;
  /** ISO `YYYY-MM-DD`, or null. */
  eventDate?: string | null;
  /** `events.event_date_precision` — only a DAY is written as a date. */
  datePrecision?: string | null;
  /** The row they were added under — "Stylist / Decorator". */
  service?: string | null;
  /** `events.display_name` — "Indalecio & Claire". */
  hostsName?: string | null;
};

/** "Liza" from "Liza Mendoza"; the shop's name when nobody was named. */
export function supplierGreetingName(facts: Pick<SupplierInviteFacts, 'shopName' | 'contactPerson'>): string {
  const first = (facts.contactPerson ?? '').replace(/\s+/g, ' ').trim().split(' ')[0] ?? '';
  return first || (facts.shopName ?? '').replace(/\s+/g, ' ').trim();
}

/** "our wedding" — the couple speaking. */
export function supplierEventPhrase(eventWord: string | null | undefined): string {
  const word = (eventWord ?? '').trim().toLowerCase() || 'event';
  return `our ${word}`;
}

export function buildSupplierInviteMessage(
  ctx: SupplierInviteFacts & { link: string; now?: Date },
): string | null {
  const link = (ctx.link ?? '').trim();
  if (!link) return null;
  const supplier = supplierGreetingName(ctx);
  const date = formatInviteDate(ctx.eventDate, ctx.datePrecision, ctx.now);
  const service = (ctx.service ?? '').trim();
  const hosts = (ctx.hostsName ?? '').trim();
  let t = SUPPLIER_INVITE_TEMPLATE;
  if (!hosts) t = t.replace(/\n+\{hosts\}$/, '');
  if (!supplier) t = t.replace(' {supplier}', '');
  if (!date) t = t.replace(' on {date}', '');
  if (!service) t = t.replace(' as our {service}', '');
  // ONE pass, function replacer: a shop named "{link}" or "$&" is printed as typed and never expands.
  return t.replace(/\{(supplier|event|date|service|link|hosts)\}/g, (_m, key: string) => {
    switch (key) {
      case 'supplier':
        return supplier;
      case 'event':
        return supplierEventPhrase(ctx.eventWord);
      case 'date':
        return date ?? '';
      case 'service':
        return service;
      case 'hosts':
        return hosts;
      default:
        return link;
    }
  });
}
