/**
 * The shop page's Inquire pop-up — the pieces that are not drawing (owner 2026-11-07; the sheet is
 * `app/v/[slug]/_components/inquire-sheet.tsx`).
 *
 * 🔁 COMING BACK TO IT. Two presses leave the shop page mid-ask: Sign in (OAuth leaves for Google) and Start a new
 * event (create-event, then `?next=` back here). Both return to the address the sheet wrote, and the address carries
 * the ask: `?inquire=1` reopens the sheet, `&isvc=a,b` the services already picked. Everything else in the address —
 * the arrival (`src`, `event`), so the shop's Back stays right — is kept; the hash is dropped so the return does not
 * jump to a section.
 */

import { serviceKeyStem } from '@/lib/distinct-shop-services';
import type { BuildNotSentReason } from '@/lib/package-picks-summary';

/** `?inquire=1` — reopen the Inquire pop-up on arrival. */
export const INQUIRE_PARAM = 'inquire';
/** `?isvc=a,b` — the services already picked in it. */
export const INQUIRE_SERVICES_PARAM = 'isvc';
/**
 * 🆕 OWN-02 (walk 13 Nov): the event the couple just STARTED from "For which event? › Start a new event". The new
 * event's commit writes it into the way back (`withNewInquireEvent`), and the sheet opens with it picked — it used to
 * come back with nothing picked, so the couple had to find the event they had made a second ago.
 */
export const INQUIRE_EVENT_PARAM = 'ievent';

/** The way back to an open ask, with the event just made named in it. Any other path is returned as it was. */
export function withNewInquireEvent(nextPath: string, eventId: string): string {
  const url = new URL(nextPath, 'https://setnayan.invalid');
  if (url.searchParams.get(INQUIRE_PARAM) !== '1') return nextPath;
  url.searchParams.set(INQUIRE_EVENT_PARAM, eventId);
  return `${url.pathname}${url.search}${url.hash}`;
}
/** The Undo window before the ask is sent — the same five seconds as Check a date. */
export const INQUIRE_UNDO_MS = 5000;

/**
 * The one plain line for a shop with no active service (owner 2026-11-07: "inquire does nothing" on SetnaProd — it had
 * no card, so Inquire scrolled to a dead end). The ask still goes: a general question.
 */
export function NO_SERVICES_LINE(shopName: string): string {
  return `${shopName} has no services listed yet — ask them a general question.`;
}

/** This shop page's address with the ask in it — a relative href (path + query, no hash). */
export function inquireResumeHref(currentHref: string, serviceIds: readonly string[]): string {
  const url = new URL(currentHref, 'https://setnayan.invalid');
  url.searchParams.set(INQUIRE_PARAM, '1');
  if (serviceIds.length > 0) url.searchParams.set(INQUIRE_SERVICES_PARAM, serviceIds.join(','));
  else url.searchParams.delete(INQUIRE_SERVICES_PARAM);
  return `${url.pathname}${url.search}`;
}

/** The same address with the ask taken out again — written when the sheet closes, so a reload does not reopen it. */
export function inquireClearedHref(currentHref: string): string {
  const url = new URL(currentHref, 'https://setnayan.invalid');
  url.searchParams.delete(INQUIRE_PARAM);
  url.searchParams.delete(INQUIRE_SERVICES_PARAM);
  url.searchParams.delete(INQUIRE_EVENT_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** What the address asks for on arrival: `null` = nothing to reopen. */
export function inquireResumeOf(search: string): { serviceIds: string[]; eventId: string | null } | null {
  const q = new URLSearchParams(search);
  if (q.get(INQUIRE_PARAM) !== '1') return null;
  return {
    serviceIds: (q.get(INQUIRE_SERVICES_PARAM) ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    eventId: q.get(INQUIRE_EVENT_PARAM)?.trim() || null,
  };
}

/**
 * 📋 EVERY SERVICE THE SHOP SAYS IT PROVIDES (owner 2026-11-07, verbatim "Yes, list all"). The pop-up used to list only
 * the shop's ACTIVE cards — and 4 of 5 real shops have services picked at sign-up (`vendor_profiles.services`) but no
 * active card, so Rondo Musical (band_dj, band_live_music · 0 cards) read as a shop with nothing to ask about.
 *
 *   · a card                       → as before: its label, its price, `serviceId` = vendor_service_id.
 *   · a provided service, no card  → its taxonomy label (the caller's `labelOf`, the ONE resolver), "Price on request",
 *                                     `serviceId` = `k:<key>`, `provided: true`, `category` = the key.
 *   · a provided service whose key a card already carries → the card row only, never a second row.
 *   · a card whose category is not among the provided services → still listed (as before).
 *
 * Cards first, then the card-less services in the shop's own order. NOTHING is picked by default
 * (`inquireOpeningPicks`): only the card the couple tapped.
 */
export const PRICE_ON_REQUEST = 'Price on request';
/**
 * A card-less row whose kind HAS a priced card the shop has not put live yet (Build 5 F4, Lane W walk 2 item 4: Photo
 * booth read "Price on request" though its hidden card is ₱14,999). The price is the shop's, it is just not public yet.
 */
export const PRICE_WHEN_LIVE = 'Price shown once the card is live';
/** The pop-up's id for a provided service with no card — never a vendor_service_id, so it cannot be mistaken for one. */
export const PROVIDED_PREFIX = 'k:';

export type InquireListItem = {
  serviceId: string;
  label: string;
  price: string;
  category: string | null;
  /** A service the shop provides with no active card — no price, filed on the event under its own key. */
  provided?: boolean;
  /** A provided row whose kind has a PRICED card that is not live yet — said "price shown once the card is live". */
  waiting?: boolean;
};

/** The small line under a row in the pop-up: the card's price, else why there is none. */
export function inquireRowNote(item: InquireListItem): string | undefined {
  if (item.price) return item.price;
  if (item.waiting) return PRICE_WHEN_LIVE;
  return item.provided ? PRICE_ON_REQUEST : undefined;
}

/**
 * ☝ WHAT IS PICKED WHEN THE POP-UP OPENS (Build 5 F4, Lane W walk 2 item 1b: the sheet opened with Mobile bar ON though
 * only Photo booth was tapped). Only what the couple pressed — the card whose "Inquire about this" they tapped, or the
 * picks `?isvc=` brings back — and only ids that are rows of the list. Nothing tapped (the shop's own Inquire button),
 * or nothing that matches → NOTHING picked. Never "the first service" as a default.
 */
export function inquireOpeningPicks(
  services: ReadonlyArray<InquireListItem>,
  picks: ReadonlyArray<string> | null | undefined,
): string[] {
  const ids = new Set(services.map((s) => s.serviceId));
  return [...new Set((picks ?? []).filter((id) => ids.has(id)))];
}

export function inquireServiceList(
  cards: ReadonlyArray<{ serviceId: string; label: string; price: string; category: string | null }>,
  providedKeys: ReadonlyArray<string> | null | undefined,
  labelOf: (key: string) => string,
  /** Kinds that have a PRICED card the shop has not put live yet (`PRICE_WHEN_LIVE`). */
  pricedNotLiveKinds?: ReadonlyArray<string> | null,
): InquireListItem[] {
  const waiting = new Set((pricedNotLiveKinds ?? []).map((k) => (k ?? '').trim()).filter(Boolean));
  const out: InquireListItem[] = cards.map((c) => ({ ...c }));
  // 🧹 CYC-07 (walk 13 Nov): ONE service, one row — compared by its words, not its spelling (`serviceKeyStem`, RW-167).
  // A shop whose sign-up kept an older spelling (`lights_and_sound` beside its cards' `lights_sound`) listed a 4th
  // "Lights & Sound · Price on request" row the shop page never shows.
  const stem = (k: string) => serviceKeyStem(k) || k;
  const carried = new Set(cards.map((c) => (c.category ?? '').trim()).filter(Boolean).map(stem));
  const waitingStems = new Set([...waiting].map(stem));
  const seen = new Set<string>();
  for (const raw of providedKeys ?? []) {
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (!key || carried.has(stem(key)) || seen.has(stem(key))) continue;
    seen.add(stem(key));
    out.push({
      serviceId: `${PROVIDED_PREFIX}${key}`,
      label: labelOf(key),
      price: '',
      category: key,
      provided: true,
      ...(waiting.has(key) || waitingStems.has(stem(key)) ? { waiting: true } : {}),
    });
  }
  return out;
}

/**
 * What the pop-up hands the ONE send for the picks, in pick order. The FIRST pick is where the shop is filed on the
 * event's Find (one Find pick per event and shop — `event_vendors_unique_marketplace_pick_per_event`):
 *   · first is a card     → `initialServiceId` = that card (filed under its category, as before);
 *   · first is a provided → `initialServiceId` = '' and `serviceKeys[0]` = its key (filed under THAT service).
 * Every other pick rides along: cards as `alsoServiceIds`, provided services as `serviceKeys`.
 */
export function inquireSendPicks(
  picked: ReadonlyArray<InquireListItem>,
): { initialServiceId: string; initialCategoryKey: string | null; alsoServiceIds: string[]; serviceKeys: string[] } {
  const first = picked[0];
  const cards = picked.filter((s) => !s.provided);
  const serviceKeys = picked.filter((s) => s.provided && s.category).map((s) => s.category as string);
  if (first && !first.provided) {
    return {
      initialServiceId: first.serviceId,
      initialCategoryKey: first.category ?? null,
      alsoServiceIds: cards.slice(1).map((s) => s.serviceId),
      serviceKeys,
    };
  }
  return {
    initialServiceId: '',
    initialCategoryKey: first?.category ?? null,
    alsoServiceIds: cards.map((s) => s.serviceId),
    serviceKeys,
  };
}

/**
 * 📨 "SENT" ONLY WHEN IT WAS SENT (supplier launch walk 22 Nov 2026, step 6 · Build 1). A couple's first inquiry used to
 * say "Sent ✓" when the opening note never landed: `startServiceInquiry` ignored the first note's delivery result, so
 * the thread existed, the chat was empty, the supplier was never told, and the couple waited for a reply that could not
 * come. Both shop sheets (Inquire, Check a date) now read the send's result through `inquireSendOutcome` — one reading,
 * so the two can never disagree about what counts as sent.
 */
export const INQUIRY_NOT_SENT = 'Your message didn’t send. Try again.';

/**
 * The couple-facing line for a first note that did not post. A plain failure (`failed`) is the one sentence above — a
 * raw database error never reaches the couple. A refusal they can act on (the off-platform contact filter, a closed
 * conversation, the one follow-up) keeps the server's own teaching copy after it, because "Try again" alone would send
 * the same refused words again.
 */
export function inquiryNotSentLine(reason: BuildNotSentReason, serverMessage?: string | null): string {
  const said = (serverMessage ?? '').trim();
  if (reason === 'failed' || !said) return INQUIRY_NOT_SENT;
  return `Your message didn’t send. ${said}`;
}

/** What a shop sheet shows after its one send: the Sent step, or a failure note with the couple's words kept. */
export type InquireSendOutcome =
  | { sent: true; eventId: string; threadId: string; listed: boolean; posted: boolean }
  | { sent: false; note: string };

/**
 * The ONE reading of `startServiceInquiry`'s result for a shop sheet. Only `status: 'ok'` is sent. Every other status —
 * including `ok_build_not_sent`, where the conversation opened but the words did not post — is a failure note, never
 * the Sent step, and never an empty string. `signInLine` is the sheet's own sign-in wording (each keeps its picks).
 */
export function inquireSendOutcome(
  res:
    | { status: 'ok'; threadId: string; eventId: string; listed: boolean; posted: boolean }
    | { status: 'ok_build_not_sent'; reason: BuildNotSentReason; message: string }
    | { status: 'not_signed_in' }
    | { status: 'not_secured' }
    | { status: 'no_event' }
    | { status: 'error'; message: string },
  signInLine: string,
): InquireSendOutcome {
  switch (res.status) {
    case 'ok':
      return { sent: true, eventId: res.eventId, threadId: res.threadId, listed: res.listed === true, posted: res.posted === true };
    case 'not_signed_in':
    case 'not_secured':
      return { sent: false, note: signInLine };
    case 'no_event':
      return { sent: false, note: 'That event isn’t yours to ask from. Pick another.' };
    case 'ok_build_not_sent':
      return { sent: false, note: inquiryNotSentLine(res.reason, res.message) };
    case 'error':
      return { sent: false, note: (res.message ?? '').trim() || INQUIRY_NOT_SENT };
    default:
      // A status added tomorrow is not a delivery until someone says it is.
      return { sent: false, note: INQUIRY_NOT_SENT };
  }
}
