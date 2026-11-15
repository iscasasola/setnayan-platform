/**
 * 🃏 HIDE PER CARD — the keys (Build 5 Lane C; DECISION_LOG 2026-11-10 "SERVICE CARD GROWN — PROTOTYPE APPROVED",
 * "… hide per card never deletes"; prototype `service-card-maker.html` `hidable()` / `fcKeys()`).
 *
 * In the grown card the supplier taps a photo, the clip, an event line or an inspiration photo to hide it on THIS card
 * only. One row of `vendor_service_card_hides` = one (card × item). The item is named by a kind and a key the card
 * already carries — never a new id:
 *
 *   photo:<stored ref>   the showcase photo's R2 ref (its display URL is presigned and changes, the ref does not)
 *   clip:<stored ref>    the clip's R2 ref
 *   event:<line>#<n>     the anonymised record line "type|month|band" and which occurrence of it — the record carries
 *                        no event id on purpose (`service_card_records`), so neither does a hide
 *   insp:<look id>       the approved inspiration look
 *   review:host:<id>     the hosts' review quoted on this card (`vendor_reviews.review_id`)
 *   review:guest:<id>    the guest review shown on this card (`guest_reviews.review_id`)
 *
 * ⭐ REVIEWS (owner ruling DECISION_LOG 2026-11-13, verbatim "Yes, add reviews" — superseding the prototype's "Reviews
 * and forms are never hidden here"): a shop may hide the review a card SHOWS, on that card only. Nothing is deleted:
 * the review stays on the shop page, in the card's number, and for the couple or guest who wrote it. Forms are still
 * not hideable here (a form is unlinked from the card instead).
 *
 * Pure (no I/O) so the rules are tested directly.
 */

import type { ServiceCard, ServiceShowcaseMedia } from '@/lib/service-card-view-model';

export const CARD_HIDE_KINDS = ['photo', 'clip', 'event', 'insp', 'review'] as const;
export type CardHideKind = (typeof CARD_HIDE_KINDS)[number];

/** Matches the table's CHECK (`length(item_key) BETWEEN 1 AND 600`). */
export const CARD_HIDE_KEY_MAX = 600;

/** "photo:r2://…" — the one string the card, the sheet and the action all agree on. */
export function cardHideKey(kind: CardHideKind, key: string): string {
  return `${kind}:${key}`;
}

/** The (kind, key) pair back out of a card hide key; null when it is not one. */
export function parseCardHideKey(raw: unknown): { kind: CardHideKind; key: string } | null {
  if (typeof raw !== 'string') return null;
  const at = raw.indexOf(':');
  if (at <= 0) return null;
  const kind = raw.slice(0, at);
  const key = raw.slice(at + 1);
  if (!(CARD_HIDE_KINDS as readonly string[]).includes(kind)) return null;
  if (key.length < 1 || key.length > CARD_HIDE_KEY_MAX) return null;
  return { kind: kind as CardHideKind, key };
}

type LedgerLine = { label: string; month: string | null; pax: string | null };

/**
 * Each record line's key, in order. Two identical lines (two weddings, Jun 2027, 100–199 pax) get #1 and #2, so either
 * can be hidden alone, and the same list always yields the same keys.
 */
export function eventLineKeys(lines: ReadonlyArray<LedgerLine>): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const base = [l.label, l.month ?? '', l.pax ?? ''].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return cardHideKey('event', `${base}#${n}`);
  });
}

/**
 * The refs behind a card's display URLs, so a hide can be keyed on what does not change. `photoUrls` and `photoRefs`
 * come from the same resolve; a photo whose URL failed to resolve is dropped from both, so they stay paired.
 */
export function pairPhotoRefs(
  refs: ReadonlyArray<string>,
  urls: ReadonlyArray<string | null | undefined>,
): { photos: string[]; photoRefs: string[] } {
  const photos: string[] = [];
  const photoRefs: string[] = [];
  refs.forEach((ref, i) => {
    const url = urls[i];
    if (url) {
      photos.push(url);
      photoRefs.push(ref);
    }
  });
  return { photos, photoRefs };
}

/** Group the table's rows by card. */
export function hidesByCard(
  rows: ReadonlyArray<{ vendor_service_id: string; item_kind: string; item_key: string }>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    if (!(CARD_HIDE_KINDS as readonly string[]).includes(r.item_kind)) continue;
    const k = cardHideKey(r.item_kind as CardHideKind, r.item_key);
    const list = out.get(r.vendor_service_id);
    if (list) list.push(k);
    else out.set(r.vendor_service_id, [k]);
  }
  return out;
}

/**
 * Attach what the grown card needs to hide per card: the refs behind the photos and the clip (only when the card's
 * photos ARE the showcase — a cover fallback is not hideable here), and the keys hidden on it. Absent fields when
 * there is nothing to attach, so a card without media or hides serializes exactly as before.
 */
export function withCardHides(
  card: ServiceCard,
  media: ServiceShowcaseMedia | undefined,
  hidden: ReadonlyArray<string> | undefined,
): ServiceCard {
  const out: ServiceCard = { ...card };
  const refs = media?.photoRefs;
  if (refs && refs.length > 0 && refs.length === card.photos.length && media?.photos === card.photos) out.photoRefs = [...refs];
  if (media?.videoRef && card.videoUrl) out.clipRef = media.videoRef;
  if (hidden && hidden.length > 0) out.hiddenOnCard = [...hidden];
  return out.photoRefs || out.clipRef || out.hiddenOnCard ? out : card;
}

/** The keys of every hideable item on a card, in the card's order — what the sheet walks. */
export function cardItemKeys(
  card: Pick<ServiceCard, 'photos' | 'photoRefs' | 'clipRef' | 'record' | 'inspirationLooks'> & Partial<Pick<ServiceCard, 'reviews'>>,
): {
  photos: Array<string | null>;
  clip: string | null;
  events: string[];
  insp: string[];
  /** The review each group SHOWS on this card (the hosts' quote · the newest guest line); null when none is shown. */
  reviews: { host: string | null; guest: string | null };
} {
  const hostId = card.reviews?.hosts?.quote ? card.reviews.hosts.reviewId : null;
  const guestId = card.reviews?.guests?.newest?.reviewId ?? null;
  return {
    photos: card.photos.map((_, i) => (card.photoRefs?.[i] ? cardHideKey('photo', card.photoRefs[i]!) : null)),
    clip: card.clipRef ? cardHideKey('clip', card.clipRef) : null,
    events: eventLineKeys(card.record?.ledger ?? []),
    insp: (card.inspirationLooks ?? []).map((l) => cardHideKey('insp', l.id)),
    reviews: {
      host: hostId ? cardHideKey('review', `host:${hostId}`) : null,
      guest: guestId ? cardHideKey('review', `guest:${guestId}`) : null,
    },
  };
}

/**
 * 🃏 What the hides read came back as. `error` is NOT "nothing hidden": the page cannot tell which items the shop took
 * off, so every card is drawn without its hideable items (fail closed) and says why (`hidesUnread`).
 */
export type CardHidesRead = { status: 'ok'; byCard: Map<string, string[]> } | { status: 'error' };

/**
 * 🃏 THE CARD A COUPLE GETS — the hidden items dropped ON THE SERVER, before the card is serialized into the page, so
 * nothing the shop hid ever reaches a couple's browser (not greyed, not behind a flag, not in the HTML). Run on every
 * card the page draws for anyone but the shop itself; the shop gets `withCardHides`' card and curates it.
 *
 * `hidden` is the card's hidden keys, or `'unread'` when the hides read failed. Then nothing hideable is shown — no
 * showcase photo the hide is keyed on, no clip, no event line, no inspiration photo, no review quote or guest line —
 * and `hidesUnread` makes the card say so (only when it actually lost something). Not-hideable content (a cover
 * fallback, the facts, the reviews' NUMBERS) is untouched: a hidden review still counts, it just is not quoted here. The refs and the key list are
 * the shop's working data and never ride along.
 */
export function cardWithoutHidden(card: ServiceCard, hidden: ReadonlyArray<string> | 'unread'): ServiceCard {
  const all = hidden === 'unread';
  const off = new Set(all ? [] : hidden);
  const gone = (key: string | null) => key !== null && (all || off.has(key));
  const keys = cardItemKeys(card);
  const { photoRefs: _refs, clipRef: _clip, hiddenOnCard: _hidden, ...rest } = card;
  const out: ServiceCard = { ...rest };

  let dropped = false;
  const photoKeep = card.photos.map((_, i) => !gone(keys.photos[i] ?? null));
  if (photoKeep.includes(false)) {
    dropped = true;
    out.photos = card.photos.filter((_, i) => photoKeep[i]);
  }
  if (card.videoUrl && gone(keys.clip)) {
    dropped = true;
    out.videoUrl = null;
  }
  if (card.record) {
    const ledger = card.record.ledger.filter((_, i) => !gone(keys.events[i] ?? null));
    if (ledger.length !== card.record.ledger.length) {
      dropped = true;
      out.record = { ...card.record, ledger };
    }
  }
  if (card.inspirationLooks) {
    const looks = card.inspirationLooks.filter((_, i) => !gone(keys.insp[i] ?? null));
    if (looks.length !== card.inspirationLooks.length) {
      dropped = true;
      out.inspirationLooks = looks;
    }
  }
  // ⭐ A hidden review: its words, name and photo go; the card's number stays (the review still exists).
  if (card.reviews) {
    const { hosts, guests } = card.reviews;
    const hostGone = hosts !== null && gone(keys.reviews.host);
    const guestGone = guests !== null && guests.newest !== null && gone(keys.reviews.guest);
    if (hostGone || guestGone) {
      dropped = true;
      out.reviews = {
        hosts: hostGone && hosts ? { ...hosts, quote: null, by: null, verifiedBooking: false, reviewId: null } : hosts,
        guests: guestGone && guests ? { ...guests, newest: null } : guests,
      };
    }
  }
  // Said only where something was actually left out — a card with nothing hideable is whole.
  if (all && dropped) out.hidesUnread = true;
  return out;
}

/** 🃏 A hide toggle's reply, in words. Anything but a plain `ok` is a failure the supplier is told about. */
export function cardHideSaveError(
  reply: { status: 'ok' | 'refused' | 'error' } | null,
  hide: boolean,
): string | null {
  if (reply?.status === 'ok') return null;
  const still = hide ? 'It is still showing on this card.' : 'It is still hidden on this card.';
  if (reply?.status === 'refused') return `That change wasn’t saved — this account can’t change this card. ${still}`;
  return `That change wasn’t saved. ${still} Try again.`;
}
