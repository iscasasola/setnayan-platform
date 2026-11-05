/**
 * SERVICE-CARD MODERATION — the words and rules behind the admin supplier
 * page's "Take down card", "Put back" and "Remove photo" (admin minimum for the
 * 7 Nov 2026 supplier registration).
 *
 * Pure on purpose: the server actions (app/admin/vendors/[vendorProfileId]/
 * card-actions.ts) import it, and a unit test can read every sentence the
 * supplier is sent without a database.
 *
 * The mechanism, in one paragraph: a take-down sets the card's existing public
 * switch `is_active` to false — the switch the public read policy, the shop
 * page and Find already honour — and puts a hold on it (`taken_down_at` +
 * `taken_down_reason`, migration 20271309211124) that the database will not let
 * the supplier lift or publish past. A removed photo is detached from the card
 * (`primary_photo_r2_key` / `showcase_photo_r2_keys`); the file itself stays in
 * storage and its key is kept in the audit row, so the removal can be undone by
 * hand.
 */

/** The same bounds as the CHECK `vendor_services_a_take_down_says_why`. */
export const MODERATION_REASON_MIN = 10;
export const MODERATION_REASON_MAX = 500;

/** A trimmed reason inside the bounds, or null. */
export function parseModerationReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const reason = raw.trim().replace(/\s+/g, ' ');
  if (reason.length < MODERATION_REASON_MIN || reason.length > MODERATION_REASON_MAX) return null;
  return reason;
}

export const REASON_REFUSAL = `Write a reason the supplier will read (${MODERATION_REASON_MIN}–${MODERATION_REASON_MAX} characters).`;

/** `admin_audit_log.action` codes. Prefixed `vendor_service_` (counted on the Shops tile, lib/admin/what-you-change.ts). */
export const CARD_AUDIT_ACTION = {
  takenDown: 'vendor_service_taken_down',
  putBack: 'vendor_service_put_back',
  photoRemoved: 'vendor_service_photo_removed',
} as const;

export type CardStatus = 'live' | 'draft' | 'taken_down';

/** What the admin sees on the card's status chip. One definition, three words. */
export function cardStatusOf(card: { is_active: boolean | null; taken_down_at: string | null }): CardStatus {
  if (card.taken_down_at) return 'taken_down';
  return card.is_active === true ? 'live' : 'draft';
}

export const CARD_STATUS_LABEL: Readonly<Record<CardStatus, string>> = {
  live: 'Live',
  draft: 'Draft — couples cannot see it',
  taken_down: 'Taken down by Setnayan',
};

export type PhotoSlot = 'cover' | 'showcase';

export function isPhotoSlot(v: unknown): v is PhotoSlot {
  return v === 'cover' || v === 'showcase';
}

/** The showcase list without `key` (every copy of it). */
export function withoutShowcasePhoto(keys: readonly string[] | null | undefined, key: string): string[] {
  return (keys ?? []).filter((k) => k !== key);
}

function cardName(title: string | null | undefined): string {
  const t = (title ?? '').trim();
  return t ? `“${t}”` : 'one of your service cards';
}

export type CardModerationNotice = { title: string; body: string };

/**
 * The in-app notice the supplier gets (`service_card_moderated`). It always
 * says WHICH card, WHAT happened and WHY — a card or photo vanishing with no
 * explanation is its own defect (see lib/tell-the-supplier-it-came-down.ts).
 */
export function cardModerationNotice(
  what:
    | { kind: 'taken_down'; reason: string }
    | { kind: 'put_back'; live: boolean }
    | { kind: 'photo_removed'; slot: PhotoSlot; reason: string },
  cardTitle: string | null | undefined,
): CardModerationNotice {
  const name = cardName(cardTitle);
  switch (what.kind) {
    case 'taken_down':
      return {
        title: `Setnayan took down ${name}`,
        body: `Couples can no longer see this card. Why: ${what.reason} You can still edit it and save it as a draft; once it is fixed, reply to Setnayan and we will put it back.`,
      };
    case 'put_back':
      return {
        title: `${name.charAt(0).toUpperCase()}${name.slice(1)} is back`,
        body: what.live
          ? 'Setnayan put this card back. Couples can see it again.'
          : 'Setnayan lifted the take-down. The card is saved as a draft — publish it from your Services when it is ready.',
      };
    case 'photo_removed':
      return {
        title: `Setnayan removed a photo from ${name}`,
        body: `${what.slot === 'cover' ? 'The cover photo' : 'A showcase photo'} was removed. Why: ${what.reason}${
          what.slot === 'cover' ? ' Add a new cover so couples see your work first.' : ''
        }`,
      };
  }
}

/** Where the notice sends the supplier: their own card in the Services manager. */
export function supplierCardUrl(vendorServiceId: string): string {
  return `/vendor-dashboard/services#service-${vendorServiceId}`;
}
