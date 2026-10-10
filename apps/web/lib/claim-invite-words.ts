/**
 * claim-invite-words.ts — WHAT A COUPLE'S OWN LINK SAYS TO THE SUPPLIER WHO
 * OPENS IT: who invited them, and the date.
 *
 * Owner, 2026-10-10 (`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`, "3 yes"): the
 * couple's link shows the supplier WHO invited them (first names) and the DATE.
 * 🔒 This supersedes the 2026-05-19 "identity only" lock on the claim page FOR
 * A COUPLE'S OWN LINK ONLY — and only for these two facts. The price, what is
 * included and the payment plan still wait until the supplier has joined
 * ("Package & payment details stay private until you finish signup").
 *
 * Until now the link the couple shares (`vendor_invites.source =
 * 'auto_share_link'`) loaded neither: the page named "Setnayan" as the inviter,
 * said "their upcoming event", and claimed the supplier had been "locked in" —
 * about a record the couple's own page calls "your record, not a booking".
 *
 * PURE: the claim page and its test both read this file.
 */
import { suppliersDateFact } from './suppliers-shell';

export type ClaimInviterNames = {
  /** `events.display_name` — the page's names, the first names ("Ana & Paolo"). */
  display_name: string | null;
  /** `events.bride_name` / `groom_name` — stored "First Last". */
  bride_name: string | null;
  groom_name: string | null;
};

/**
 * The inviters' FIRST names. `display_name` is the couple's own page name and is
 * first names by construction (`coupleNameColumns` in lib/typed-names.ts). When
 * it is empty, the first word of each stored name — never a surname.
 * Null = nothing to show; the page then says who it can ("A Setnayan couple").
 */
export function inviterFirstNames(ev: ClaimInviterNames | null): string | null {
  if (!ev) return null;
  const display = (ev.display_name ?? '').trim();
  if (display) return display;
  const firsts = [ev.bride_name, ev.groom_name]
    .map((n) => (n ?? '').trim().split(/\s+/)[0] ?? '')
    .filter(Boolean);
  return firsts.length > 0 ? firsts.join(' & ') : null;
}

/**
 * The date as the link says it — or null when there is none to show.
 *
 * Read through `suppliersDateFact`, the couple's own date line, so the supplier
 * reads the date exactly as the couple's Suppliers page states it: a day
 * ("Fri, Dec 18, 2026") when the couple has set one, a month or a year when
 * that is all they have decided. A vague date is shown as vague — a day the
 * couple never chose must not be printed for a supplier to hold.
 */
export function claimDateLabel(
  eventDate: string | null | undefined,
  precision: string | null | undefined,
): string | null {
  if (!eventDate) return null;
  const fact = suppliersDateFact(String(eventDate).slice(0, 10), precision ?? 'day');
  return fact.text === 'Pick your date' ? null : fact.text;
}

/** "on Fri, Dec 18, 2026" · "in December 2026" · "in 2026" — the preposition follows the precision. */
export function claimDatePhrase(
  eventDate: string | null | undefined,
  precision: string | null | undefined,
): { preposition: 'on' | 'in'; label: string } | null {
  const label = claimDateLabel(eventDate, precision);
  if (!label) return null;
  return { preposition: precision === 'month' || precision === 'year' ? 'in' : 'on', label };
}
