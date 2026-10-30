/**
 * couple-photo-share.ts — 📸 A COUPLE'S OWN PHOTO, SHARED TO A SUPPLIER'S SERVICE CARD.
 *
 * Owner, 2026-10-30 (DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A SUPPLIER'S INSPIRATION — THE SUPPLIER APPROVES, IT
 * SYNCS TO THEIR SERVICE CARD; THE CUSTOMER GETS A CREDIT LINE + AN OPTIONAL SUPPLIER GIFT, NEVER CASH"): a host's own
 * board photo, tagged to a linked supplier's service card, is sent to that supplier; on Approve it shows on the card
 * with a credit line the uploader chose — their first names + month/year, or "A couple". Consent is a checkbox. The
 * uploader can withdraw and it leaves the card.
 *
 * PURE and import-light on purpose — the couple's sheet (a client component), the server actions, the shop's list and
 * the tests all read it. The database is the gate (migration 20271297221336: four SECURITY DEFINER doors and one public
 * reader); this file is the WORDS and the one OPEN money question.
 */
import { coupleFirstNamesLine } from './typed-names';
import { normalizeVisibility } from './event-visibility';

/* ══════════════════════════════════════════════════════════════════════════
   🔓 OPEN — THE PAGE-PHOTO ROOM (owner question, NOT decided)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Does an APPROVED couple photo count toward the supplier's paid page-photo room (the 2026-10-28 wallet row: the free
 * room, then 1 credit a photo — `file_supplier_page_notice` / `shop_portfolio_commit`)?
 *
 * 🔓 OPEN — the owner has not ruled. AS BUILT: **NO**. A couple photo lives in `couple_photo_shares`, which no room or
 * wallet function reads, and no door here calls `shop_papic_wallet_spend`. This constant is the ONE place that says
 * so; `a-couples-photo-never-costs-the-shop.test.ts` holds it false and holds the room functions blind to the table.
 * If the owner rules "yes", the change starts here and in those functions — not in the share doors.
 */
export const COUPLE_PHOTOS_USE_PAGE_ROOM = false as const;

/* ══════════════════════════════════════════════════════════════════════════
   CONSENT + CREDIT
   ══════════════════════════════════════════════════════════════════════════ */

/** Stored on every share (`couple_photo_shares.consent_version`) — bump it when the sentence changes. */
export const COUPLE_PHOTO_CONSENT_VERSION = 'couple-photo-consent-v1';

/** The checkbox's sentence. `shop` is the supplier's name. */
export function couplePhotoConsentText(shop: string): string {
  return `This photo is mine to share, and the people in it agree to it showing on ${shop}’s service card.`;
}

export type CoupleCreditStyle = 'names' | 'a_couple';

/** The credit "A couple" prints — the database CHECKs this exact string for the 'a_couple' style. */
export const A_COUPLE_CREDIT = 'A couple';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Feb 2027" from a `YYYY-MM-DD` (or ISO) string; null when it cannot be read. */
export function monthYearOf(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : null;
}

export type CoupleCreditSource = {
  display_name?: string | null;
  bride_name?: string | null;
  groom_name?: string | null;
  /** `events.event_date` — the month the credit names; a `year`-only date names none. */
  event_date?: string | null;
  event_date_precision?: string | null;
};

/**
 * "Ana & Ben · Feb 2027" — the couple's FIRST names (never a surname: the first word of each stored name, else the
 * page's names, which are first names by construction) and the event's month/year. No month when the event has none
 * set to the month (a year-only or undecided date); `fallbackMonthIso` (the day they share it) is used then. Null when
 * there is no name at all — the sheet then offers "A couple" only.
 */
export function coupleNamesCredit(ev: CoupleCreditSource, fallbackMonthIso: string): string | null {
  const names = (coupleFirstNamesLine(ev) || (ev.display_name ?? '').trim()).slice(0, 60).trim();
  if (!names) return null;
  const precise = ev.event_date && ev.event_date_precision !== 'year';
  const when = (precise ? monthYearOf(ev.event_date) : null) ?? monthYearOf(fallbackMonthIso);
  return when ? `${names} · ${when}` : names;
}

/** The credit dropdown's two choices (PickMenu) — names first when there are names. */
export function coupleCreditChoices(namesCredit: string | null): Array<{ key: CoupleCreditStyle; label: string }> {
  return [
    ...(namesCredit ? [{ key: 'names' as const, label: namesCredit }] : []),
    { key: 'a_couple' as const, label: A_COUPLE_CREDIT },
  ];
}

/* ══════════════════════════════════════════════════════════════════════════
   WHO SEES IT — the couple's audience (owner 2026-10-30)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Owner, verbatim: *"make it or set who gets to see it (only hosts, exclusive, private, public)"*. The words are the
 * Event Hub's viewing terms (DECISION_LOG 2026-10-27 "EXCLUSIVE · PRIVATE · PUBLIC") plus Only hosts. The database
 * CHECKs the same four values and decides who is inside each (`viewer_service_card_couple_photos`).
 */
export const COUPLE_PHOTO_AUDIENCES = ['hosts', 'exclusive', 'private', 'public'] as const;
export type CouplePhotoAudience = (typeof COUPLE_PHOTO_AUDIENCES)[number];

export function isCouplePhotoAudience(v: unknown): v is CouplePhotoAudience {
  return typeof v === 'string' && (COUPLE_PHOTO_AUDIENCES as readonly string[]).includes(v);
}

/** The dropdown's words. ⚠ Private FAILS CLOSED to Exclusive — "the people around me" is still OPEN (2026-10-27). */
export const COUPLE_PHOTO_AUDIENCE_LABEL: Record<CouplePhotoAudience, string> = {
  hosts: 'Only hosts',
  exclusive: 'Exclusive',
  private: 'Private',
  public: 'Public',
};
export const COUPLE_PHOTO_AUDIENCE_HINT: Record<CouplePhotoAudience, string> = {
  hosts: 'You and your co-hosts — and the supplier, who approves it.',
  exclusive: 'Your hosts and the people invited to your event.',
  private: 'For now the same as Exclusive — who “the people around you” are is not settled yet, so it never shows wider.',
  public: 'Everyone who opens their service card.',
};

/**
 * The default: the event's OWN Event Hub viewing setting (`events.landing_page_visibility`, read through
 * `normalizeVisibility`). Only a Public hub defaults to Public; everything else — Unlisted, invited accounts, Private
 * (= hosts + guests, the new Exclusive per the 2026-10-27 row) and unknown — defaults to Exclusive. Never wider.
 */
export function defaultCouplePhotoAudience(landingPageVisibility: string | null | undefined): CouplePhotoAudience {
  return normalizeVisibility(landingPageVisibility) === 'public' ? 'public' : 'exclusive';
}

/** A Public photo's copy lives in the public bucket; every other audience's in a private one, behind signed URLs. */
export function audienceIsPublic(a: CouplePhotoAudience): boolean {
  return a === 'public';
}

/* ══════════════════════════════════════════════════════════════════════════
   STATES + WORDS
   ══════════════════════════════════════════════════════════════════════════ */

export type CouplePhotoShareState = 'waiting' | 'approved' | 'declined' | 'withdrawn';

/** The couple's line for one share — said on the sheet beside the photo. */
export function coupleShareStateLine(state: CouplePhotoShareState, shop: string): string {
  switch (state) {
    case 'waiting':
      return `Sent to ${shop} · waiting for them`;
    case 'approved':
      return `On ${shop}’s service card`;
    case 'declined':
      return `${shop} isn’t using this one`;
    case 'withdrawn':
      return 'You took it back';
  }
}

/** Every answer the share door can give, in plain words. `ok` is not here — it is not a refusal. */
const SHARE_REFUSALS: Record<string, string> = {
  no_consent: 'Tick the box first — the photo is yours, and the people in it agree.',
  not_own_photo: 'Only a photo you uploaded yourself can be shared with a supplier.',
  not_your_photo: 'Only the person who uploaded this photo can share it.',
  no_card: 'That service card is no longer live.',
  not_on_event: 'That supplier is not on your event any more.',
  bad_credit: 'Pick how the photo is credited.',
  already: 'This photo is already with that supplier.',
  bad_audience: 'Pick who sees it on their card.',
  bad_input: 'That did not go through — try again.',
  not_publishable: 'Photos can’t be published just now — nothing changed. Try again in a moment.',
};

export function shareRefusalWords(status: string | null | undefined): string {
  return SHARE_REFUSALS[String(status ?? '')] ?? 'That did not go through — nothing was sent. Try again.';
}

/** The shop's answer words, and what each did to the card. */
export function shopAnswerDoneLine(approved: boolean, was: CouplePhotoShareState | null): string {
  if (approved) return 'Approved — it is on your service card now.';
  return was === 'approved' ? 'Taken off your service card.' : 'Declined — it will not show anywhere.';
}

/** The in-app notices (no email: neither type is on EMAIL_ENABLED_TYPES). */
export function sharedNoticeTitle(serviceTitle: string): string {
  return `A couple shared a photo for “${serviceTitle}”`;
}
export function answeredNoticeTitle(shop: string, approved: boolean): string {
  return approved ? `${shop} put your photo on their service card` : `${shop} isn’t using your photo`;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE ONE ACTION'S SHAPES (`app/_actions/couple-photo-share-actions.ts`) — here, so a client file can name them
   without importing the action module (the lab guard forbids that).
   ══════════════════════════════════════════════════════════════════════════ */

export type SendPhotoShareInput = {
  eventId: string;
  inspirationId: string;
  vendorServiceId: string;
  creditStyle: CoupleCreditStyle;
  creditLine: string | null;
  /** The checkbox — false sends nothing (the database refuses it too: no consent version, no share). */
  consent: boolean;
  /** Who sees it on their card. */
  audience: CouplePhotoAudience;
};

export type CouplePhotoShareRequest =
  | { op: 'read'; eventId: string; slotKey: string; slotPosition: number }
  | ({ op: 'send' } & SendPhotoShareInput)
  | { op: 'take_back'; eventId: string; shareId: string }
  | { op: 'answer'; shareId: string; approve: boolean }
  | { op: 'audience'; eventId: string; shareId: string; audience: CouplePhotoAudience }
  | { op: 'viewer_looks'; vendorServiceIds: string[] };

export type CouplePhotoShareReply =
  | { op: 'read'; result: PhotoShareOptions }
  | { op: 'send'; result: ShareResult }
  | { op: 'take_back'; result: { status: 'ok' | 'gone' | 'error' } }
  | { op: 'answer'; result: AnswerCouplePhotoResult }
  | { op: 'audience'; result: { status: 'ok' | 'gone' | 'error' } }
  | { op: 'viewer_looks'; result: Record<string, Array<{ id: string; url: string; credit: string }>> };

export type PhotoShareCard = { vendorServiceId: string; title: string; shop: string };

export type PhotoShareRow = { shareId: string; state: CouplePhotoShareState; shop: string; serviceTitle: string; credit: string; audience: CouplePhotoAudience };

export type PhotoShareOptions =
  | {
      status: 'ok';
      /** The photo is the couple's own upload AND this person uploaded it — only then may it be shared. */
      shareable: boolean;
      inspirationId: string;
      cards: PhotoShareCard[];
      shares: PhotoShareRow[];
      /** "Ana & Ben · Feb 2027", or null when the event has no names (then only "A couple" is offered). */
      namesCredit: string | null;
      /** The audience the dropdown starts on — the event's own Event Hub viewing setting (unknown → Exclusive). */
      defaultAudience: CouplePhotoAudience;
    }
  | { status: 'gone' | 'error' };

export type ShareResult = { status: 'ok'; shareId: string; shop: string } | { status: 'refused'; message: string };

export type AnswerCouplePhotoResult =
  | { status: 'ok'; approved: boolean; line: string }
  | { status: 'refused'; message: string };

/* ══════════════════════════════════════════════════════════════════════════
   THE FROZEN PUBLIC COPY (security review #7089, F1 + F3)
   ══════════════════════════════════════════════════════════════════════════ */

/** Where every published couple photo lives — a neutral folder: no event id, no file name. */
export const COUPLE_LOOKS_PREFIX = 'couple-looks/';

/** The image types a frozen copy may carry — what the upload action accepts. Anything else is stored as `.jpg`. */
const LOOK_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/**
 * The frozen copy's key for ONE APPROVE ATTEMPT: `couple-looks/<share_id>/<attempt>.<ext>` — the attempt is 16 hex
 * characters, fresh per Approve, so two approves (two shop members, or a double tap) never write or delete the same
 * object: the losing attempt deletes only its own copy (review #7089, round 2). The extension is read off the
 * snapshot's key and kept only when it is an image type the upload accepts (else `jpg`). The database CHECKs exactly
 * this shape, pinned to the share's own id, so a shop can never point a share at another object.
 */
export function coupleLookKey(shareId: string, snapshotKey: string, attempt: string): string {
  // 16 hex = 64 bits: a Public copy sits in a public bucket, so its name must not be guessable.
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(snapshotKey.trim());
  const raw = m ? m[1]!.toLowerCase() : '';
  const ext = LOOK_EXTS.has(raw) ? raw : 'jpg';
  if (!/^[0-9a-f]{16}$/.test(attempt)) throw new Error('coupleLookKey: the attempt must be 16 hex characters');
  return `${COUPLE_LOOKS_PREFIX}${shareId}/${attempt}.${ext}`;
}

/** The share id a frozen copy belongs to — null for anything that is not `couple-looks/<uuid>/<attempt>.<ext>`. */
export function shareIdOfCoupleLook(key: string): string | null {
  const m = /^couple-looks\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{16}\.(?:jpg|jpeg|png|webp)$/.exec(key);
  return m ? m[1]! : null;
}

/**
 * An upload the upload action wrote for THIS event (`inspiration/<event_id>/…`) and NOT a supplier's suggested photo,
 * which is stored in the same folder under `suggestions/` — the SQL door checks the same (review #7089, round 2).
 */
export function isEventUploadKey(eventId: string, key: string | null | undefined): boolean {
  return (
    typeof key === 'string' &&
    key.startsWith(`inspiration/${eventId}/`) &&
    !key.startsWith(`inspiration/${eventId}/suggestions/`) &&
    !key.includes('..')
  );
}

/**
 * A copy's storage REF (`r2://<bucket>/<key>`) — the shape the house signer and the cleanup executor take. Public →
 * the public media bucket; any other audience → the private thread-files bucket. Pure (no server import), so the
 * erasure purge can build it too.
 */
export function coupleLookRef(key: string, isPublic: boolean): string {
  return `r2://${isPublic ? 'setnayan-media' : 'setnayan-thread-files'}/${key}`;
}

/** Where the shop answers — its Shop › Services, at the list (`id="couple-photos"`). */
export const SHOP_COUPLE_PHOTOS_HREF = '/vendor-dashboard/shop#couple-photos';
