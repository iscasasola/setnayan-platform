/**
 * THE 7-DAY GUEST NOTICE BEFORE A SUPPLIER'S EVENT PHOTO GOES ON ITS PAGE — pure (words, states, grouping).
 *
 * ⚖ Owner rulings (corpus DECISION_LOG.md):
 *   · 2026-10-03 "A SUPPLIER'S OWN PAPIC PHOTOS GO ON ITS PORTFOLIO AUTOMATICALLY AFTER A 7-DAY GUEST NOTICE": each
 *     guest pictured is told once — a quiet line in their Event Hub: "<Supplier> will show this photo on their page ·
 *     Remove". No Remove within 7 days → it goes public. Remove keeps working afterwards and pulls it off the page.
 *   · 2026-10-03 "CHALLENGE PHOTOS … WITH NO RECOGNISED FACES, EVERY GUEST GETS THE ONE-LINE 7-DAY NOTICE" (2): when
 *     nobody is tagged in a supplier's photos, every guest of the event gets ONE line — "<Supplier> will show N photos
 *     … on their page · See them", each photo with Remove.
 *   · 2026-10-28 "OWNER: Agree to all" (1) — build it now; and the same day's (3): notices are IN-APP, no new email.
 *
 * 🔑 WHO IS "IN IT": a supplier's album photo can never be face-tagged (`photo_tags.source_table` admits only the two
 * couple-side tables), so the ruled no-recognised-faces branch is the one that applies: EVERY guest of the event sees
 * the line. Nothing here guesses a narrower audience.
 *
 * The window itself is the database's (`supplier_page_photo_notices`: stamped on insert, CHECKed ≥ 7 days, published
 * only by `publish_supplier_page_photo` after `public_from`). This file only says it.
 */

export const SUPPLIER_PAGE_NOTICE_DAYS = 7;

export type SupplierPageNoticeRow = {
  notice_id: string;
  public_from: string;
  published_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
};

export type SupplierPageNoticeState = 'waiting' | 'on_page' | 'removed_by_guest' | 'taken_down';

/** What a notice row means today. A removal wins over everything; a publish is a fact, never inferred from the date. */
export function supplierPageNoticeState(row: SupplierPageNoticeRow): SupplierPageNoticeState {
  if (row.removed_at) return row.removed_by === 'guest' ? 'removed_by_guest' : 'taken_down';
  if (row.published_at) return 'on_page';
  return 'waiting';
}

/** "Nov 4" in Manila — the day a waiting photo may go up. */
export function noticeDay(iso: string, timeZone = 'Asia/Manila'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', timeZone }).format(d);
}

/** The supplier's tile, per state. Short — the rest lives in the section's ⓘ. */
export function supplierTileLabel(state: SupplierPageNoticeState, publicFromIso: string): string {
  switch (state) {
    case 'waiting':
      return `Goes up ${noticeDay(publicFromIso)}`;
    case 'on_page':
      return 'On your page';
    case 'removed_by_guest':
      return 'A guest asked to keep it off';
    case 'taken_down':
      return 'Taken down';
  }
}

/** The toast after "Put on my page" — the photo is NOT public yet, and the supplier is told when it will be. */
export function putOnPageQueuedText(publicFromIso: string): string {
  return `Goes on your page ${noticeDay(publicFromIso)} — the guests are told first`;
}

/** One photo in a guest's line. */
export type GuestNoticePhoto = {
  noticeId: string;
  /** The album photo — the id the guest's Remove files against (`askToTakeMyPhotoDown`). */
  photoId: string;
  url: string | null;
  onPage: boolean;
  publicFrom: string;
};

/** One supplier's line in a guest's Event Hub. */
export type GuestNoticeGroup = {
  supplierName: string;
  photos: GuestNoticePhoto[];
};

/** The one quiet line (ruling 2026-10-03 (2)). Counts what is shown, never raw rows. */
export function guestNoticeLine(group: GuestNoticeGroup): string {
  const n = group.photos.length;
  const name = group.supplierName.trim() || 'A supplier';
  const photos = n === 1 ? 'a photo' : `${n} photos`;
  const allUp = n > 0 && group.photos.every((p) => p.onPage);
  return allUp
    ? `${name} shows ${photos} from this event on their page`
    : `${name} will show ${photos} from this event on their page`;
}

/** The short line under a waiting photo — when it goes up unless removed. */
export function guestPhotoWhen(photo: GuestNoticePhoto): string {
  return photo.onPage ? 'On their page' : `Goes up ${noticeDay(photo.publicFrom)}`;
}

type GuestNoticeInputRow = {
  notice_id: string;
  photo_id: string;
  vendor_profile_id: string;
  public_from: string;
  published_at: string | null;
  removed_at: string | null;
  supplier_name: string | null;
  url: string | null;
};

/**
 * Group the event's open notices by supplier for the guest. A removed notice is dropped (nothing left to remove); a
 * published one stays, because Remove keeps working afterwards (ruling (4)).
 */
export function groupGuestNotices(rows: ReadonlyArray<GuestNoticeInputRow>): GuestNoticeGroup[] {
  const by = new Map<string, GuestNoticeGroup>();
  for (const r of rows) {
    if (r.removed_at) continue;
    let g = by.get(r.vendor_profile_id);
    if (!g) {
      g = { supplierName: (r.supplier_name ?? '').trim() || 'A supplier', photos: [] };
      by.set(r.vendor_profile_id, g);
    }
    g.photos.push({ noticeId: r.notice_id, photoId: r.photo_id, url: r.url, onPage: r.published_at != null, publicFrom: r.public_from });
  }
  return [...by.values()];
}
