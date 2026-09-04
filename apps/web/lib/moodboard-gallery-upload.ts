/**
 * lib/moodboard-gallery-upload.ts — MB11's DECISION CORE for the supplier
 * upload path. Pure, synchronous, dependency-free, no I/O: every rule a photo
 * has to pass before it can reach the couple-facing gallery pool is decided
 * here and unit-tested in milliseconds. The server action
 * (app/vendor-dashboard/moodboard-library/actions.ts) does the bytes and the
 * database; this file does the judgement.
 *
 * ── THE FIVE QUESTIONS ──────────────────────────────────────────────────────
 *   1. MAY THIS SHOP UPLOAD TO THIS SLOT?     `slotUploadVerdict`
 *   2. HAS IT ROOM LEFT?                      `backCatalogueQuotaVerdict`
 *   3. DID IT WARRANT THE RIGHTS?             `RIGHTS_WARRANTY_VERSION`
 *   4. IS THERE A QR CODE IN THE PHOTO?       `qrHit`
 *   5. IS THE SHOP'S OWN CONTACT INFO IN IT?  `findOwnContactHits`
 *
 * ── WHY THE TRADE GATE IS DERIVED AND NOT LISTED ───────────────────────────
 * The page shipped in May 2026 gated on the single service key
 * `reception_decor` — so gown designers, florists and cake makers, i.e. the
 * exact trades whose photographs a couple wants, could not upload at all. The
 * fix reads MB10's `canonicalServicesForSlot`, which derives the answer from
 * `MOODBOARD_SLOT_TRADES` → `lib/taxonomy.ts`. A second hand-kept list of
 * "trades that may upload" is precisely the drift MB10's docblock warns about:
 * add a trade to the slot map and this gate widens with it, or it does not
 * widen at all — never half.
 *
 * ── WHY THE CONTACT MATCH IS AGAINST ONE SHOP'S OWN VALUES ─────────────────
 * 🛑 THE REPO ALREADY HAS A GENERIC CONTACT DETECTOR — `lib/chat-contact-
 * filter.ts` — AND IT IS THE WRONG TOOL HERE, deliberately not imported. It
 * matches ANY phone-shaped digit run, which is correct for a chat message and
 * catastrophic for a wedding photograph: a table number, a date on a signage
 * board, a price on a menu card, or the COUPLE'S OWN mobile number on their
 * own save-the-date all read as "a phone number", and every one of those would
 * bounce an honest supplier's photo with an accusation about contact details
 * they never put there. That same file's own docblock records the card-profile
 * retune it needed after "Php 9,000 per hour, minimum 4 hours, 150 pax" fused
 * into a PH-mobile shape.
 *
 * So the match here is against KNOWN VALUES: this uploading shop's own
 * business name, phone, email and website domain, read from its own
 * `vendor_profiles` row. A hit means "your own phone number is printed in this
 * photo", which is a sentence we can put in front of a vendor and be right
 * about. Anything else is not our business.
 *
 * ⚠ SOCIAL HANDLES ARE ACCEPTED BY THE MATCHER AND NOTHING FEEDS THEM YET —
 * `vendor_profiles` has no handle column today, so the caller passes none and
 * that one check does not run. Named here rather than left as a field that
 * looks wired: when a handle column lands, pass it and the check turns on.
 *
 * ⚠ AND SHORT / GENERIC NEEDLES ARE DROPPED, NOT MATCHED. A two-word shop name
 * like "The Barn", a `gmail.com` email domain, a `facebook.com` website — each
 * would match half the wedding photographs in the country. `isUsableNeedle`
 * refuses them and the check simply does not run for that field, which is
 * honest; a block we cannot justify is worse than no block.
 */

import {
  canonicalServicesForSlot,
  slotHasSupplierTrade,
  GALLERY_SLOT_KEYS,
} from './moodboard-gallery';
import type { MoodboardSlotKey } from './moodboard-slots';

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE RIGHTS WARRANTY
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The rights warranty, DEFINED in lib/moodboard-gallery-pure.ts and re-exported
 * here so server callers keep one import path. It lives there because the
 * upload FORM renders the sentence and is a client component, while this module
 * reaches `lib/supabase/admin.ts` through the slot→trade map.
 */
export {
  RIGHTS_WARRANTY_VERSION,
  RIGHTS_WARRANTY_TEXT,
} from './moodboard-gallery-pure';

/* ══════════════════════════════════════════════════════════════════════════
   2 · WHICH SLOT, AND MAY THIS SHOP FILL IT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The vendor-facing name of each gallery slot. A `Record` over the FULL slot
 * union (not the derived gallery keys), so a slot added to
 * lib/moodboard-slots.ts is a compile error here until somebody names it or
 * says it has no supplier shelf — the same mechanism MB10 uses for the trade
 * map itself.
 *
 * ⚠ The couple sees its own wording in `inspiration-board.tsx`'s GROUPS. These
 * are the supplier's side of the same shelf and are deliberately phrased for
 * somebody uploading their work ("Bridal gown", not "Bride").
 */
export const GALLERY_SLOT_LABEL: Readonly<
  Record<MoodboardSlotKey, string | null>
> = {
  venue: 'Ceremony venue',
  reception_venue: 'Reception venue',
  backdrop: 'Wall design / backdrop',
  tunnel: 'Entrance tunnel',
  stage: 'Stage',
  table: 'Table styling',
  ceiling: 'Ceiling',
  flowers: 'Flowers',
  cocktail: 'Cocktail hour',
  cake: 'Cake',
  overall: 'Overall styling',
  bride: 'Bridal gown / hair & make-up',
  groom: 'Groom’s attire',
  principal_sponsor: 'Principal sponsors’ attire',
  entourage: 'Entourage attire',
  parents: 'Parents’ attire',
  guests: 'Guest attire',
  // 🔑 NULL IS THE ANSWER, NOT A GAP. `palette` has no supplying trade at all
  // (MB10: a colour reference is nobody's portfolio), so there is no supplier
  // shelf to name. Typed `string | null` over the FULL slot union rather than
  // over the derived gallery keys, so a slot added to lib/moodboard-slots.ts
  // is a COMPILE ERROR here until somebody says whether suppliers fill it.
  palette: null,
};

export type SlotUploadVerdict =
  | { allowed: true; slotKey: MoodboardSlotKey }
  | { allowed: false; reason: 'unknown_slot' | 'no_supplier_trade' | 'wrong_trade'; message: string };

/**
 * MAY THIS SHOP UPLOAD INTO THIS INSPIRATION SLOT?
 *
 * The shop's own `vendor_profiles.services[]` (canonical service keys) must
 * intersect the slot's supplying trades. `palette` has no supplying trade at
 * all — a colour reference is nobody's portfolio — and is refused for every
 * shop rather than quietly accepted into a shelf couples never browse.
 */
export function slotUploadVerdict(
  slotKey: string,
  vendorServices: readonly string[] | null | undefined,
): SlotUploadVerdict {
  if (!(GALLERY_SLOT_KEYS as readonly string[]).includes(slotKey)) {
    if (!slotHasSupplierTrade(slotKey)) {
      return {
        allowed: false,
        reason: 'no_supplier_trade',
        message:
          'That part of the mood board is not a supplier shelf — couples fill it themselves.',
      };
    }
    return {
      allowed: false,
      reason: 'unknown_slot',
      message: 'Pick which part of the mood board this photo belongs in.',
    };
  }

  const wanted = new Set(canonicalServicesForSlot(slotKey));
  const owned = (vendorServices ?? []).filter((s) => wanted.has(s));
  if (owned.length === 0) {
    const label = GALLERY_SLOT_LABEL[slotKey as MoodboardSlotKey] ?? 'that shelf';
    return {
      allowed: false,
      reason: 'wrong_trade',
      message: `Your shop’s services don’t cover ${label}. Add that service under Coverage first, then upload here.`,
    };
  }
  return { allowed: true, slotKey: slotKey as MoodboardSlotKey };
}

/** Every slot this shop may upload into, in board order — drives the picker. */
export function uploadableSlotsForShop(
  vendorServices: readonly string[] | null | undefined,
): Array<{ key: MoodboardSlotKey; label: string }> {
  const out: Array<{ key: MoodboardSlotKey; label: string }> = [];
  for (const k of GALLERY_SLOT_KEYS) {
    const label = GALLERY_SLOT_LABEL[k];
    if (!label) continue;
    if (slotUploadVerdict(k, vendorServices).allowed) out.push({ key: k, label });
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE QUOTA — BACK-CATALOGUE ONLY
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Where a gallery photo came from.
 *
 *   · `back_catalogue` — the shop's own archive, no celebration attached.
 *     COUNTED against `TierCaps.galleryBackCatalogPhotosPerCategory`, PER
 *     INSPIRATION CATEGORY (MB19).
 *   · `event_linked`   — delivered on a celebration this shop was booked on
 *     and is the couple's recommended pick for (an `editorial_vendor_media`
 *     promotion). NEVER counted, at any tier or category, including free.
 *
 * 🔑 THE DISTINCTION IS THE WHOLE POINT OF THE GATE. Rationing the work a shop
 * actually did for a real couple would charge them for the wedding they
 * worked; rationing an archive dump is what stops the gallery becoming a stock
 * library. Counting event-linked rows would collapse both into one number and
 * nothing would go red — the quota would simply be wrong, quietly.
 */
export type GalleryUploadMode = 'back_catalogue' | 'event_linked';

export type QuotaVerdict = {
  allowed: boolean;
  /** The per-category ceiling. 0 means this category may not back-catalogue at all. */
  cap: number;
  /** Back-catalogue rows already held IN THIS CATEGORY (event-linked rows are NOT in here). */
  used: number;
  /** Vendor-facing sentence when refused; empty when allowed. */
  message: string;
};

/**
 * Decide one NEW insert.
 *
 * `event_linked` is allowed unconditionally — there is no tier below which a
 * shop may not show the work it delivered. `back_catalogue` is allowed while
 * `used < cap`.
 *
 * ⚠ MB19: THE QUOTA IS PER CATEGORY, NOT PER ACCOUNT. `cap` and `used` are
 * both scoped to the single inspiration category (`categoryLabel`) this
 * upload targets — a shop holding 20 Flowers photos may still upload to
 * Tables. `categoryLabel` names that category in the refusal message so the
 * message reads as a fact about the shelf a vendor just tried to fill, not a
 * tier statement (the earlier copy said "on your plan" — every tier now
 * shares the same cap, so that phrase would be false).
 *
 * ⚠ THIS IS A CHECK ON NEW INSERTS AND NOTHING ELSE. It never retires, hides
 * or deletes an existing row, so a shop that is over its cap (because it
 * uploaded under a looser ladder, or because an event was deleted and its
 * photos demoted to back-catalogue) keeps every photo it has and simply cannot
 * add another. Grandfathering is therefore the default behaviour and no rescue
 * migration will ever be needed for it.
 */
export function backCatalogueQuotaVerdict(input: {
  mode: GalleryUploadMode;
  cap: number;
  backCatalogueUsed: number;
  categoryLabel: string;
}): QuotaVerdict {
  const cap = Number.isFinite(input.cap) ? Math.max(0, Math.floor(input.cap)) : Infinity;
  const used = Math.max(0, Math.floor(input.backCatalogueUsed));

  if (input.mode === 'event_linked') {
    return { allowed: true, cap, used, message: '' };
  }
  if (cap <= 0) {
    return {
      allowed: false,
      cap,
      used,
      message: `You can add ${input.categoryLabel} photos from celebrations you were booked on, but not from your back catalogue. Those never count against any category.`,
    };
  }
  if (used >= cap) {
    return {
      allowed: false,
      cap,
      used,
      message: `You’ve used all ${cap} ${input.categoryLabel} photo${cap === 1 ? '' : 's'}. Retire one, or add photos from a celebration you were booked on — those never count.`,
    };
  }
  return { allowed: true, cap, used, message: '' };
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE CONTENT CHECKS — WHAT THE PHOTO ITSELF CARRIES
   ══════════════════════════════════════════════════════════════════════════ */

/** What a content check found. `label` is what the vendor is told we saw. */
export type ContentHitKind =
  | 'qr_code'
  | 'business_name'
  | 'phone'
  | 'email'
  | 'website'
  | 'social_handle'
  | 'own_logo';

export type ContentHit = {
  kind: ContentHitKind;
  /** The vendor-facing name of the thing, e.g. "your phone number". */
  label: string;
  /** What we actually matched, echoed back so the vendor can find it. */
  found: string;
};

const HIT_LABEL: Readonly<Record<ContentHitKind, string>> = {
  qr_code: 'a QR code',
  business_name: 'your shop’s name',
  phone: 'your phone number',
  email: 'your email address',
  website: 'your website address',
  social_handle: 'your social handle',
  own_logo: 'your shop’s logo',
};

/** One value of this shop's own that we look for inside the photo's text. */
export type ContactNeedle = {
  kind: Exclude<ContentHitKind, 'qr_code' | 'own_logo'>;
  /** Normalised form used for matching. */
  needle: string;
  /** The original value, for the message. */
  display: string;
  /** Digits-only comparison (phones) rather than substring. */
  digitsOnly?: boolean;
};

/**
 * Domains and hosts that belong to everybody, so a shop whose "website" is one
 * of these has given us nothing distinctive to match on. Matching `gmail.com`
 * would bounce every photograph with an email printed anywhere in it.
 */
const GENERIC_HOSTS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.com.ph', 'hotmail.com', 'outlook.com',
  'icloud.com', 'protonmail.com', 'aol.com', 'live.com', 'msn.com',
  'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 'twitter.com',
  'x.com', 'linktr.ee', 'youtube.com', 'linkedin.com', 'pinterest.com',
  'setnayan.com',
]);

/**
 * Words too ordinary to identify a shop on their own. A business name reduces
 * to its distinctive words before it becomes a needle, so "The Wedding Studio"
 * never matches the word "wedding" printed on a welcome sign.
 */
const GENERIC_NAME_WORDS = new Set([
  'the', 'and', 'of', 'by', 'for', 'a', 'an', 'co', 'inc', 'corp', 'ltd',
  'company', 'studio', 'studios', 'events', 'event', 'wedding', 'weddings',
  'bridal', 'bride', 'groom', 'flowers', 'florist', 'floral', 'cakes', 'cake',
  'catering', 'caterer', 'photo', 'photography', 'video', 'films', 'film',
  'design', 'designs', 'designer', 'decor', 'decors', 'rentals', 'rental',
  'ph', 'philippines', 'manila', 'cebu', 'davao', 'atelier', 'couture',
]);

/** Lower-cased, punctuation-collapsed, single-spaced. */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@./+_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every digit, in order. `+63 917 880 7163` → `639178807163`. */
function digits(value: string): string {
  return value.replace(/\D+/g, '');
}

/**
 * PH mobile numbers are written `0917…` and `+63917…` interchangeably. Both
 * collapse to the same national significant number so a photo printing one
 * form matches a profile holding the other.
 */
function phDigitCore(value: string): string {
  let d = digits(value);
  if (d.startsWith('63') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

function hostOf(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const withScheme = /^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    const host = new URL(withScheme).hostname.replace(/^www\./, '');
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

/**
 * TRUE when a candidate needle is distinctive enough to accuse somebody with.
 * Deliberately strict: the cost of dropping a needle is that one check does
 * not run; the cost of keeping a weak one is an honest supplier told their
 * photo contains contact details it does not.
 */
export function isUsableNeedle(needle: ContactNeedle): boolean {
  if (needle.digitsOnly) return needle.needle.length >= 9;
  if (needle.kind === 'business_name') return needle.needle.length >= 5;
  if (needle.kind === 'website') return !GENERIC_HOSTS.has(needle.needle);
  if (needle.kind === 'social_handle') return needle.needle.length >= 4;
  if (needle.kind === 'email') {
    const at = needle.needle.indexOf('@');
    return at > 0 && needle.needle.length >= 7;
  }
  return needle.needle.length >= 5;
}

/** The shop's own profile fields this check is allowed to look for. */
export type OwnContactSource = {
  business_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  website?: string | null;
  /** Social handles, if the shop has stated any (e.g. '@bloomandvine'). */
  social_handles?: readonly string[] | null;
};

/**
 * Reduce ONE shop's own profile to the set of strings worth looking for.
 *
 * The business name contributes its DISTINCTIVE words only — "Bloom & Vine
 * Wedding Studio" yields "bloom vine", never "wedding" or "studio". A name
 * with no distinctive words left contributes nothing at all.
 */
export function ownContactNeedles(profile: OwnContactSource): ContactNeedle[] {
  const out: ContactNeedle[] = [];

  const name = (profile.business_name ?? '').trim();
  if (name) {
    const distinctive = normalizeText(name)
      .split(' ')
      .filter((w) => w.length >= 3 && !GENERIC_NAME_WORDS.has(w));
    if (distinctive.length > 0) {
      out.push({
        kind: 'business_name',
        needle: distinctive.join(' '),
        display: name,
      });
    }
  }

  const phone = (profile.contact_phone ?? '').trim();
  if (phone) {
    out.push({
      kind: 'phone',
      needle: phDigitCore(phone),
      display: phone,
      digitsOnly: true,
    });
  }

  const email = (profile.contact_email ?? '').trim().toLowerCase();
  if (email.includes('@')) {
    out.push({ kind: 'email', needle: email, display: email });
  }

  const host = hostOf(profile.website ?? '');
  if (host) out.push({ kind: 'website', needle: host, display: host });

  for (const raw of profile.social_handles ?? []) {
    const handle = String(raw ?? '').trim().toLowerCase().replace(/^@+/, '');
    if (handle) {
      out.push({ kind: 'social_handle', needle: handle, display: `@${handle}` });
    }
  }

  return out.filter(isUsableNeedle);
}

/**
 * Look for THIS shop's own values inside text read out of the photo.
 *
 * Phones compare on the digit run (so `0917-880-7163`, `0917 880 7163` and
 * `+639178807163` are one number); everything else is a substring of the
 * normalised text. The business name matches only when EVERY distinctive word
 * is present, in any order — "Bloom" alone on a napkin is not a hit.
 */
export function findOwnContactHits(
  extractedText: string,
  needles: readonly ContactNeedle[],
): ContentHit[] {
  const text = normalizeText(extractedText);
  if (!text) return [];
  const textDigits = digits(extractedText);
  const hits: ContentHit[] = [];

  for (const n of needles) {
    if (n.digitsOnly) {
      if (n.needle.length >= 9 && textDigits.includes(n.needle)) {
        hits.push({ kind: n.kind, label: HIT_LABEL[n.kind], found: n.display });
      }
      continue;
    }
    if (n.kind === 'business_name') {
      const words = n.needle.split(' ');
      if (words.every((w) => text.includes(w))) {
        hits.push({ kind: n.kind, label: HIT_LABEL[n.kind], found: n.display });
      }
      continue;
    }
    if (text.includes(n.needle)) {
      hits.push({ kind: n.kind, label: HIT_LABEL[n.kind], found: n.display });
    }
  }
  return hits;
}

/** The QR hit. ANY decodable QR blocks — see `contentRejectionMessage`. */
export function qrHit(payload: string): ContentHit {
  return { kind: 'qr_code', label: HIT_LABEL.qr_code, found: payload.slice(0, 120) };
}

/** The own-logo hit. */
export function ownLogoHit(distance: number): ContentHit {
  return {
    kind: 'own_logo',
    label: HIT_LABEL.own_logo,
    found: `perceptual match, ${distance} bits apart`,
  };
}

/**
 * 🛑 THE REJECTION NAMES WHAT WAS FOUND. This is the whole difference between
 * a gate a vendor can clear and a wall they bounce off forever.
 *
 * The failure this repo keeps re-learning is a measurement that never reaches
 * the render: an upload refused with "invalid image" tells the supplier
 * nothing, so they re-upload the same photo, or give up and conclude Setnayan
 * is broken. Naming the thing — "we found your phone number in this photo" —
 * turns a block into an instruction they can act on in one minute.
 *
 * Nobody is banned, nothing is deleted, and the photo is never quietly
 * dropped: the upload simply does not happen and the vendor is told why.
 */
export function contentRejectionMessage(hits: readonly ContentHit[]): string {
  if (hits.length === 0) return '';
  const named = hits.map((h) => h.label);
  const list =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;

  const fix = hits.some((h) => h.kind === 'qr_code')
    ? 'Couples find your shop through the credit we print under the photo, so a QR code in the picture is never needed. Upload a version without it and it will go straight through.'
    : 'Upload a clean version without it — your shop is already credited under every photo, so couples can still find you.';

  return `We can’t add this photo yet: we found ${list} in it. ${fix}`;
}
