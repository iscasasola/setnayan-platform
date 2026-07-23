/**
 * Off-platform-contact filter for in-app chat (couple ↔ vendor).
 *
 * WHY THIS EXISTS
 *   Setnayan's whole economy assumes the deal stays ON the platform (the vendor
 *   booking-fee, the vendor subscription, the couple's paid SKUs all depend on
 *   it). The single biggest leak is disintermediation over chat: one party drops
 *   a phone number / email / "add me on Viber" and the relationship walks off
 *   Setnayan. This module is the deterministic (no-LLM, ₱0/scan) detector that
 *   the send path uses to MASK the actual contact payload and FLAG the message
 *   for admin review. It runs on BOTH directions (couple + vendor) and covers
 *   BOTH send surfaces (web server action + the native JSON endpoint) because it
 *   is wired into the shared core `sendChatMessageCore` (lib/chat-send.ts).
 *
 * DESIGN
 *   Pure + synchronous + dependency-free so it is trivially unit-testable and
 *   safe to call on the hot send path. Two buckets of signal:
 *     · HARD tokens — an actual off-platform address: phone, email, URL to a
 *       social/messaging domain, or an @handle. These carry the payload, so they
 *       are what a mask must remove.
 *     · SOFT signals — intent with no payload: a bare app name (facebook, viber,
 *       "ig"), a colour-coded euphemism ("blue app", "purple app"), or a
 *       solicitation ("add me on", "my number is"). These are what a human uses
 *       to route AROUND a naive number filter, so we detect + flag them too.
 *
 *   `MASK_CATEGORIES` decides which hits are actually blanked in the delivered
 *   body. It defaults to masking EVERYTHING (owner listed app names + euphemisms
 *   as things to catch). To soften false positives on casual app mentions
 *   ("we found your work on Instagram"), move 'social_app' / 'euphemism' /
 *   'solicit' out of MASK_CATEGORIES and they become flag-only (recorded for
 *   review, delivered verbatim). One-line tune — the owner sign-off point.
 *
 * NOT IN V1 (tracked follow-ups): spelled-out digits ("zero nine one seven…"),
 * OCR of a phone number inside an attached business-card image, and generic
 * non-social URLs (a couple linking a venue site / Pinterest board is legit).
 */

export type ContactHitCategory =
  | 'phone'
  | 'email'
  | 'url'
  | 'handle'
  | 'social_app'
  | 'euphemism'
  | 'solicit';

export interface ContactHit {
  category: ContactHitCategory;
  /** The raw substring that matched (for the admin flag record). */
  match: string;
  start: number;
  end: number;
}

export interface ContactScanResult {
  /** True when at least one hit was found (the message should be flagged). */
  hasHit: boolean;
  /** Every detected span, de-overlapped, in document order. */
  hits: ContactHit[];
  /**
   * The body with every masked-category hit replaced by MASK_TOKEN. Equal to
   * the input (referentially different only when a masked hit existed) — a
   * caller can `=== body` compare to know whether anything was blanked.
   */
  masked: string;
  /** Distinct categories present, for a compact flag label. */
  categories: ContactHitCategory[];
}

/** What replaces a masked span in the delivered message. */
export const MASK_TOKEN = '•••';

/**
 * Categories that get BLANKED (not just flagged). Defaults to all — see the
 * module docstring. Edit this Set to make soft signals flag-only.
 */
const MASK_CATEGORIES: ReadonlySet<ContactHitCategory> = new Set<ContactHitCategory>([
  'phone',
  'email',
  'url',
  'handle',
  'social_app',
  'euphemism',
  'solicit',
]);

// A phone-shaped run: starts with an optional +/( then a digit, then a mix of
// digits and phone separators, ending on a digit. We accept the run only if it
// carries at least MIN_PHONE_DIGITS actual digits — this is what keeps prices
// (₱12,999), pax counts (150), and years (2026) from tripping the filter while
// still catching PH mobile (11 digits), PH landline (9–10), and international.
const PHONE_CANDIDATE = /[+(]?\d[\d\s().\-]{5,}\d/g;
const MIN_PHONE_DIGITS = 9;

// Standard email, plus a light "(at)/(dot)" obfuscation (explicit markers only —
// never the bare words "at"/"dot", which are far too common in prose).
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const EMAIL_OBFUSCATED =
  /\b[A-Za-z0-9._%+-]+\s*(?:\(at\)|\[at\])\s*[A-Za-z0-9.-]+\s*(?:\(dot\)|\[dot\])\s*[A-Za-z]{2,}\b/gi;

// Known social / messaging domains + short-link hosts. Deliberately NOT a
// generic-URL catch (venue sites / inspo boards are legitimate). Two shapes:
// complete short-link hosts (wa.me/…, m.me/…) that already carry their TLD, and
// bare brand names that need a TLD after them.
const SOCIAL_URL = new RegExp(
  '\\b(?:https?:\\/\\/)?(?:www\\.)?(?:' +
    // short-link / already-qualified hosts (own their TLD)
    '(?:wa\\.me|m\\.me|t\\.me|fb\\.me|instagr\\.am)(?:\\/[^\\s]*)?' +
    '|' +
    // bare brand names + a required TLD
    '(?:facebook|fb|messenger|instagram|whatsapp|viber|telegram|tiktok|twitter|x|linkedin|snapchat|kakao|wechat)\\.(?:com|net|org|me|ph|io)(?:\\/[^\\s]*)?' +
    ')',
  'gi',
);

// A bare @handle. Must start with a letter (so "@5pm" and "meet @ 6" don't
// match) and is length-bounded. Emails are matched first and win the overlap.
const HANDLE = /(?<![\w@/])@[A-Za-z][A-Za-z0-9._]{1,30}\b/g;

// Bare app / platform names used to route off-platform. Word-boundaried so "ig"
// won't fire inside "big"/"dig" and "fb"/"insta" stay tight.
const SOCIAL_APP =
  /\b(?:facebook|fb|messenger|viber|whatsapp|whats\s?app|wassap|telegram|instagram|insta|ig|snapchat|tiktok|kakaotalk|wechat|imessage)\b/gi;

// Colour-coded / oblique euphemisms — the deliberate evasions ("blue app" =
// Messenger, "purple app" = Viber, "green app" = WhatsApp).
const EUPHEMISM = /\b(?:blue|purple|green|pink)\s+app\b/gi;

// Solicitation phrasing: intent to move the contact off-platform. Catches the
// signal even when the number/handle sits on a separate line.
const SOLICIT =
  /\b(?:(?:message|msg|add|find|reach|contact|call|text|chat|dm|pm|ping)\s+me\s+(?:on|at|via)|(?:my|here'?s\s+my|this\s+is\s+my)\s+(?:number|cell|mobile|contact|email|gcash|viber|whatsapp)|hit\s+me\s+up|let'?s\s+(?:connect|chat)\s+(?:on|via)|outside\s+the\s+app|off\s+(?:the\s+)?platform)\b/gi;

const RULES: { re: RegExp; category: ContactHitCategory }[] = [
  { re: EMAIL, category: 'email' },
  { re: EMAIL_OBFUSCATED, category: 'email' },
  { re: SOCIAL_URL, category: 'url' },
  { re: HANDLE, category: 'handle' },
  { re: EUPHEMISM, category: 'euphemism' },
  { re: SOLICIT, category: 'solicit' },
  { re: SOCIAL_APP, category: 'social_app' },
];

function collectPhoneHits(text: string): ContactHit[] {
  const out: ContactHit[] = [];
  PHONE_CANDIDATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHONE_CANDIDATE.exec(text)) !== null) {
    const raw = m[0];
    const digitCount = (raw.match(/\d/g) ?? []).length;
    if (digitCount >= MIN_PHONE_DIGITS) {
      out.push({ category: 'phone', match: raw, start: m.index, end: m.index + raw.length });
    }
  }
  return out;
}

function collectRuleHits(text: string): ContactHit[] {
  const out: ContactHit[] = [];
  for (const { re, category } of RULES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // Zero-width guard — should never happen with these patterns, but keeps
      // the exec loop from spinning if one is ever edited to allow empty.
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      out.push({
        category,
        match: m[0],
        start: m.index,
        end: m.index + m[0].length,
      });
    }
  }
  return out;
}

/**
 * De-overlap the raw hits: sort by start (then by longest span), then greedily
 * keep a hit only if it doesn't overlap one already kept. Earlier + longer wins,
 * so an email beats the @handle nested inside it and a phone run beats a stray
 * digit group inside it.
 */
function dedupeSpans(raw: ContactHit[]): ContactHit[] {
  const sorted = [...raw].sort((a, b) => a.start - b.start || b.end - a.end - (b.start - a.start));
  const kept: ContactHit[] = [];
  let lastEnd = -1;
  for (const hit of sorted) {
    if (hit.start >= lastEnd) {
      kept.push(hit);
      lastEnd = hit.end;
    }
  }
  return kept;
}

/**
 * Scan a chat body for off-platform contact info. Pure — no I/O, no throw.
 * Returns the (possibly) masked body plus the list of hits for flagging.
 */
export function scanForContactInfo(body: string): ContactScanResult {
  if (typeof body !== 'string' || body.length === 0) {
    return { hasHit: false, hits: [], masked: body ?? '', categories: [] };
  }

  const raw = [...collectPhoneHits(body), ...collectRuleHits(body)];
  const hits = dedupeSpans(raw);

  if (hits.length === 0) {
    return { hasHit: false, hits: [], masked: body, categories: [] };
  }

  // Rebuild the body, replacing masked-category spans with MASK_TOKEN. Hits are
  // in document order (dedupeSpans sorts by start), so a single pass works.
  let masked = '';
  let cursor = 0;
  for (const hit of hits) {
    masked += body.slice(cursor, hit.start);
    masked += MASK_CATEGORIES.has(hit.category) ? MASK_TOKEN : body.slice(hit.start, hit.end);
    cursor = hit.end;
  }
  masked += body.slice(cursor);

  const categories = Array.from(new Set(hits.map((h) => h.category)));
  return { hasHit: true, hits, masked, categories };
}
