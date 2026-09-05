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
import { HIT_LABEL, type ContentHit } from './moodboard-screen-findings';

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

/**
 * The finding vocabulary — kinds, labels, severities, the three outcomes and
 * both human-facing sentences — lives in lib/moodboard-screen-findings.ts and
 * is re-exported here so every server caller keeps ONE import path.
 *
 * 🔑 IT LIVES THERE BECAUSE OF THE CLIENT BOUNDARY, NOT FOR TIDINESS. MB21's
 * whole point is that a finding reaches a RENDER, and both renders are
 * `'use client'`. This file reaches `lib/supabase/admin.ts` through
 * `./moodboard-gallery` → `lib/taxonomy.ts`, so a component importing the
 * labels from here turns `lint-server-only-boundary` red.
 */
export {
  HIT_LABEL,
  HIT_SEVERITY,
  blockingHits,
  contentRejectionMessage,
  flaggedHits,
  parseScreenFindings,
  rejectionSentence,
  screenOutcome,
} from './moodboard-screen-findings';
export type {
  ContentHit,
  ContentHitKind,
  ContentHitSeverity,
  ScreenFindings,
  ScreenOutcome,
  TextScreenStatus,
} from './moodboard-screen-findings';

/** One value of this shop's own that we look for inside the photo's text. */
export type ContactNeedle = {
  // 🔑 SPELLED OUT, NOT `Exclude<ContentHitKind, …>`. MB21 widened the kind
  // union with three "any at all" blocks and four queue flags, and an Exclude
  // would have silently admitted every one of them as a needle kind — a
  // `heavy_text` needle is not a thing, and the compiler would never have said
  // so.
  kind: 'business_name' | 'phone' | 'email' | 'website' | 'social_handle';
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

/* ══════════════════════════════════════════════════════════════════════════
   5 · MB21 — THE WIDENED BLOCKS, AND WHAT GOES TO A HUMAN
   ══════════════════════════════════════════════════════════════════════════

   MB11 asked one question of the transcribed text: "is THIS shop's own contact
   information in it?" The owner's rule (2026-09-05) asks two more:

     · ANY web address, ANY social handle, ANY email address → HARD BLOCK.
       A stranger's Instagram printed on a styled shoot takes the couple off
       Setnayan exactly as effectively as the uploader's own would, and unlike
       a phone number there is nothing ambiguous about an `@` or a `.com`.
     · an unfamiliar NAME, a phone-SHAPED digit run, a logo-ish mark, or a wall
       of text → FLAG, and a person looks.

   🛑 AND THE THING THIS SECTION MOST HAD TO GET RIGHT IS WHAT IT DOES **NOT**
   BLOCK. Couples' names on backdrops, welcome signs, monograms and stage
   lettering ARE the design in the `backdrop` and `stage` shelves. `findNameLike`
   below therefore feeds a FLAG and nothing else; making it a block would empty
   two categories, and the only symptom would be honest suppliers quietly
   giving up. The same reasoning kills a generic phone matcher as a block — the
   false positives are written out in this file's own docblock.

   ⚠ `lib/chat-contact-filter.ts` IS STILL NOT IMPORTED HERE. It is tuned for a
   chat message, where a phone-shaped run IS a phone number. The card-profile
   retune its docblock records ("Php 9,000 per hour, minimum 4 hours, 150 pax"
   fusing into a PH-mobile shape) is exactly what a wedding photograph is full
   of. Nothing about MB21 changes that; the widened rules here are about the
   two shapes that ARE unambiguous — an `@` and a hostname.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The sentinel the vision model appends. Parsed and STRIPPED before any text
 * rule runs — see `parseScreenTranscript`.
 */
export const LOGO_MARK_SENTINEL = 'LOGO MARK:';

/** ≥ this many transcribed lines, or characters, reads as "heavy text". */
export const HEAVY_TEXT_LINES = 8;
export const HEAVY_TEXT_CHARS = 220;

/**
 * ≥ this many digits in one run reads as "phone-shaped". Seven, because a PH
 * landline is 7 digits and a mobile 11 — while a table number, a year, a price
 * and a time are all shorter. It FLAGS; it never blocks.
 */
export const PHONE_SHAPED_MIN_DIGITS = 7;

/**
 * Hostname endings we are willing to call a web address on sight. An
 * allow-list, not `\.[a-z]{2,}`: "Mr. and Mrs. Reyes" and "8:00 p.m." both
 * match a naive dotted pattern, and this one BLOCKS, so a false positive is an
 * honest supplier bounced.
 */
const URL_TLDS = [
  'com', 'net', 'org', 'ph', 'co', 'io', 'me', 'ly', 'tv', 'info', 'biz',
  'shop', 'store', 'studio', 'design', 'photo', 'events', 'app', 'site',
  'online', 'xyz', 'asia', 'link', 'page', 'live', 'art',
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const SCHEME_URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
const BARE_HOST_RE = new RegExp(
  String.raw`\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:${URL_TLDS.join('|')})\b(?:\/[^\s<>"')]*)?`,
  'gi',
);
/** `@handle` — 3+ characters, and never the tail of an email address. */
const HANDLE_RE = /(^|[^a-z0-9._%+-])@([a-z0-9._]{3,30})\b/gi;

/** A capitalised or all-caps word that could be part of somebody's name. */
const NAME_TOKEN_RE = /^(?:[A-Z][a-z'’-]{1,}|[A-Z]{2,})$/;

/**
 * Words that look like names on a sign and are not. Wedding signage is full of
 * them, and a run made only of these must never be reported as "a name" — the
 * flag would fire on every welcome board in the country and an admin who sees
 * a flag on everything sees a flag on nothing.
 */
const NOT_A_NAME = new Set([
  'WELCOME', 'TO', 'THE', 'OUR', 'WEDDING', 'OF', 'AND', 'SAVE', 'DATE',
  'RECEPTION', 'CEREMONY', 'MENU', 'TABLE', 'SEAT', 'SEATING', 'CHART',
  'GUEST', 'GUESTS', 'BOOK', 'GIFTS', 'CARDS', 'BAR', 'OPEN', 'PHOTO',
  'BOOTH', 'LOVE', 'FOREVER', 'ALWAYS', 'CELEBRATE', 'CELEBRATION',
  'TOGETHER', 'WITH', 'US', 'JOIN', 'MR', 'MRS', 'MS', 'THANK', 'YOU',
  'PLEASE', 'BE', 'SEATED', 'DINNER', 'LUNCH', 'COCKTAILS', 'DESSERT',
  'CAKE', 'ENTRANCE', 'EXIT', 'STAGE', 'DANCE', 'FLOOR', 'PROGRAM',
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST',
  'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  'A', 'AN', 'IS', 'ARE', 'FOR', 'FROM', 'AT', 'ON', 'IN', 'BY', 'HERE',
  'MANILA', 'CEBU', 'DAVAO', 'PHILIPPINES', 'CHURCH', 'GARDEN', 'HOTEL',
  'BALLROOM', 'HALL', 'CHAPEL', 'RESORT', 'BEACH', 'PAVILION',
]);

/** Strip the runs another rule has already reported, so one string is one hit. */
function without(text: string, taken: readonly string[]): string {
  let out = text;
  for (const t of taken) out = out.split(t).join(' ');
  return out;
}

function hit(kind: ContentHit['kind'], found: string): ContentHit {
  return { kind, label: HIT_LABEL[kind], found: found.slice(0, 120) };
}

function uniqueBy(hits: readonly ContentHit[]): ContentHit[] {
  const seen = new Set<string>();
  const out: ContentHit[] = [];
  for (const h of hits) {
    const key = `${h.kind}::${h.found.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/**
 * ANY web address, social handle or email address in the photo — a HARD BLOCK
 * regardless of whose it is.
 *
 * The order is load-bearing: emails are taken first and removed from the text,
 * because `hello@bloomandvine.com` otherwise reads as an email AND a bare host
 * AND (`@bloomandvine`) a handle, and the supplier is handed a refusal listing
 * three findings for one string on one sign.
 */
export function findPublishedContactHits(extractedText: string): ContentHit[] {
  const raw = extractedText ?? '';
  if (!raw.trim()) return [];
  const hits: ContentHit[] = [];

  const emails = raw.match(EMAIL_RE) ?? [];
  for (const e of emails) hits.push(hit('any_email', e));

  const afterEmails = without(raw, emails);

  const urls = [
    ...(afterEmails.match(SCHEME_URL_RE) ?? []),
    ...(afterEmails.match(BARE_HOST_RE) ?? []),
  ];
  for (const u of urls) hits.push(hit('any_url', u.replace(/[.,;:)]+$/, '')));

  const afterUrls = without(afterEmails, urls);
  for (const m of afterUrls.matchAll(HANDLE_RE)) {
    hits.push(hit('any_social_handle', `@${m[2]}`));
  }

  return uniqueBy(hits);
}

/**
 * Runs of capitalised words that read like somebody's name.
 *
 * Names joined by `&` or `and` are ONE run — "Maria & Jose" is one couple, not
 * two findings — and a run whose every word is in `NOT_A_NAME` is not reported
 * at all. Exported for its own unit tests: this is the single most consequential
 * function in MB21, because getting it wrong in the other direction (a block)
 * would empty the `backdrop` and `stage` shelves.
 */
export function findNameLike(extractedText: string): string[] {
  const out: string[] = [];
  for (const line of (extractedText ?? '').split(/[\n.;!?]+/)) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    let run: string[] = [];
    const flush = () => {
      const words = run.filter((t) => t !== '&' && t.toUpperCase() !== 'AND');
      const real = words.filter((w) => !NOT_A_NAME.has(w.toUpperCase()));
      if (real.length >= 2) out.push(run.join(' '));
      run = [];
    };
    for (const tok of tokens) {
      const bare = tok.replace(/^[^A-Za-z&]+|[^A-Za-z&’']+$/g, '');
      const isConnector =
        (bare === '&' || bare.toUpperCase() === 'AND') && run.length > 0;
      if (isConnector) {
        run.push(bare);
        continue;
      }
      if (NAME_TOKEN_RE.test(bare)) {
        run.push(bare);
        continue;
      }
      flush();
    }
    flush();
  }
  return Array.from(new Set(out));
}

/** Digit runs long enough to read like a phone number. Separators collapse. */
export function findPhoneShaped(extractedText: string): string[] {
  const out: string[] = [];
  for (const m of (extractedText ?? '').matchAll(/[+]?[\d][\d\s().-]{5,}\d/g)) {
    const raw = m[0].trim();
    if (raw.replace(/\D+/g, '').length >= PHONE_SHAPED_MIN_DIGITS) out.push(raw);
  }
  return Array.from(new Set(out));
}

/**
 * THE QUEUE'S HALF OF THE OWNER'S RULE — everything that is questionable and
 * nothing that is refusable.
 *
 * `blocked` hits are passed in so this can subtract them: the shop's OWN phone
 * number is already a hard block, and reporting it a second time as
 * "phone-shaped" would put a flag on a photo that is never going to exist.
 */
export function findQuestionableHits(input: {
  extractedText: string;
  /** From the vision sentinel. `null` = the model did not say, not "no". */
  logoMark?: boolean | null;
  /** Already-decided blocking hits, so nothing is reported twice. */
  blocked?: readonly ContentHit[];
}): ContentHit[] {
  const text = input.extractedText ?? '';
  const hits: ContentHit[] = [];

  const takenFound = (input.blocked ?? []).map((h) => h.found).filter(Boolean);
  const remaining = without(text, takenFound);

  for (const name of findNameLike(remaining)) hits.push(hit('unfamiliar_name', name));
  for (const num of findPhoneShaped(remaining)) hits.push(hit('phone_shaped', num));

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length >= HEAVY_TEXT_LINES || text.trim().length >= HEAVY_TEXT_CHARS) {
    hits.push(
      hit('heavy_text', `${lines.length} lines, ${text.trim().length} characters`),
    );
  }

  if (input.logoMark === true) {
    hits.push(hit('logo_mark', 'the model saw a logo-style mark'));
  }

  return uniqueBy(hits);
}

/**
 * Split the model's reply into the TEXT the rules read and the LOGO MARK
 * sentinel appended after it.
 *
 * 🔑 THE SENTINEL IS STRIPPED, AND THAT IS NOT COSMETIC. Left in the text it
 * would be transcribed content: `LOGO MARK: no` is eight capitalised
 * characters that `findNameLike` would happily report, so every single photo
 * would arrive at the admin queue flagged for a name that is our own prompt.
 *
 * An ABSENT sentinel yields `null`, never `false`. The model declining to
 * answer is not the model saying there is no logo, and a screen that reports
 * "no logo" when it was never told is the silent-non-answer failure this repo
 * keeps paying for.
 */
export function parseScreenTranscript(raw: string): {
  text: string;
  logoMark: boolean | null;
} {
  const lines = (raw ?? '').split('\n');
  let logoMark: boolean | null = null;
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.toUpperCase().startsWith(LOGO_MARK_SENTINEL)) {
      const answer = t.slice(LOGO_MARK_SENTINEL.length).trim().toLowerCase();
      if (answer.startsWith('yes')) logoMark = true;
      else if (answer.startsWith('no')) logoMark = false;
      continue;
    }
    kept.push(line);
  }
  const text = kept.join('\n').trim();
  return { text: text === 'NO TEXT' ? '' : text, logoMark };
}
