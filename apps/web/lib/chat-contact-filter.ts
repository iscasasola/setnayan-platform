/**
 * Chatroom blocked-rules engine for in-app chat (couple <-> vendor).
 *
 * WHY THIS EXISTS
 *   Setnayan's economy assumes the deal stays ON the platform (vendor booking
 *   fee + vendor subscription + couple SKUs). The biggest leak is
 *   disintermediation over chat: one party passes a phone number / email /
 *   "add me on Viber" and the relationship walks off Setnayan. When enabled, a
 *   message that trips any rule below is BLOCKED (never sent) and the attempt is
 *   recorded (metadata only) for admin review.
 *
 * DESIGN - a rules engine + an editable blocklist (owner ask 2026-07-23):
 *   1. PHONE - evasion-resistant. People hide numbers as `0917 880 7163`,
 *      `0 9 1 7 8 8 0 7 1 6 3`, spelled out ("zero nine one seven..."), with
 *      words jammed between the digits (`0917 my number is 8807163`), or with a
 *      `+63` prefix. So we NORMALIZE first - map spelled-out digits to numerals,
 *      then collapse short filler (spaces, punctuation, brief words) BETWEEN
 *      digits - and then match PH mobile / `+63` shapes on the collapsed digit
 *      string. A LONG gap of prose between two numbers is treated as a break, so
 *      two unrelated numbers ("150 pax ... 8000 budget") are not fused into a
 *      false phone.
 *   2. BLOCKLIST - `BLOCKLIST` below is the single, editable "list of text that
 *      isn't allowed": app names (Facebook, Viber, Messenger, WhatsApp, IG...),
 *      the colour-coded euphemisms ("blue app", "purple app"), and solicitation
 *      phrasing ("add me on...", "my number is..."). Add or remove a line here
 *      to tune what the chatroom blocks - no other file changes.
 *   3. EMAIL / URL / HANDLE - structural patterns for an email address, a
 *      social/messaging link, or a bare @handle.
 *
 * PROFILES - because CARD TEXT IS NOT CHAT TEXT (added 2026-07-27):
 *   The same engine now also gates what a vendor types onto a public service
 *   card / package (lib/service-text-integrity.ts). The leak it stops is real -
 *   a phone number in an inclusion label reaches EVERY couple who opens the
 *   card, not one chat partner - but the chat-tuned rules refuse honest card
 *   copy, and a card is written once and read forever, so an over-block there
 *   is a vendor who cannot describe what they sell. Two measured examples:
 *     - "TikTok highlights package" - on a card that names a DELIVERABLE, not a
 *       place to take the deal. (Setnayan's own SKU copy, "Patiktok - 250
 *       TikTok recordings", was refused by the chat rules too.)
 *     - "Php 9,000 per hour, minimum 4 hours, 150 pax, 20 staff" - a price
 *       line, whose digits fuse into a PH-mobile shape once 20 chars of filler
 *       are collapsed between them.
 *   So `evaluateMessage(body, profile)` takes a profile. `'chat'` is the
 *   DEFAULT and is byte-identical to what shipped - do not retune it here.
 *   `'card'` differs in exactly four ways, each marked `CARD:` below:
 *     (a) phone Tier 1 collapses at most CARD_PHONE_FILLER_GAP chars of filler
 *         (2, not 20) - a card's numbers sit in prose, not in a disguise;
 *     (b) phone Tier 2 (the dense 11+ digit run) is skipped - date ranges and
 *         pax/price lists live there legitimately;
 *     (c) `app_name` + `euphemism` blocklist entries are skipped - on a card
 *         those name deliverables ("Instagram teaser reel"). The trade this
 *         buys, and why it is affordable, is written out at the skip itself;
 *     (d) the `solicit` rule reads the body with any "message me on Setnayan"
 *         PHRASE scrubbed out ("Message me on Setnayan for the full menu"
 *         points AT us). Scoped to the phrase, never the whole message - see
 *         SOLICIT_TO_SETNAYAN for the bypass that taught us the difference.
 *   EMAIL / EMAIL_OBFUSCATED / SOCIAL_URL / HANDLE are unchanged in BOTH
 *   profiles: those are contact info wherever they appear.
 *
 * Pure + synchronous + dependency-free: safe to import on BOTH the server (the
 * authoritative send gate + native endpoint) and the client (instant pre-send
 * feedback). No I/O, no throw. `evaluateMessage()` is the only entry point.
 *
 * NOT IN V1 (tracked follow-ups): Tagalog spelled-out digits ("isa dalawa..." -
 * skipped to avoid matching them inside ordinary words), and OCR of a number
 * inside an attached image.
 */

/**
 * Which surface the text was typed on. `'chat'` is the shipped behaviour and
 * the default, so every existing caller is unaffected.
 */
export type ContactProfile = 'chat' | 'card';

export type ContactRuleCategory =
  | 'phone'
  | 'email'
  | 'url'
  | 'handle'
  | 'app_name'
  | 'euphemism'
  | 'solicit';

export interface ContactMatch {
  category: ContactRuleCategory;
  /** Human label for the admin record. */
  label: string;
}

export interface ContactEvaluation {
  /** True when the message trips any rule and must be blocked. */
  blocked: boolean;
  /** Distinct rule categories that fired. */
  categories: ContactRuleCategory[];
  /** Every rule that fired (category + label). `matched.length` = severity. */
  matched: ContactMatch[];
}

/** User-facing copy when a message is blocked. */
export const CONTACT_BLOCK_MESSAGE =
  'For your safety, phone numbers, emails, and outside-app contacts (Viber, ' +
  'Messenger, WhatsApp, Instagram, Facebook, etc.) are not allowed in chat. ' +
  'Please remove them and send again - keep the conversation here on Setnayan.';

// -- Phone detection (evasion-resistant) -------------------------------------

const SPELLED_DIGIT: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

/** "call me at zero nine one seven..." -> "call me at 0 9 1 7...". Word-
 *  boundaried so it never rewrites the digit-words inside ordinary text. */
function spelledDigitsToNumerals(text: string): string {
  return text.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (m) => SPELLED_DIGIT[m.toLowerCase()] ?? m,
  );
}

// Max run of non-digit filler BETWEEN two digits that we still treat as part of
// ONE number (defeats "0917 my number is 8807163" and "0 9 1 7 ..." — "my number
// is " is 14 chars). A longer run is a break, so two numbers separated by a whole
// clause ("150 guests ... 80000 budget") stay separate and don't fuse into a
// false phone. Digit-heavy messages that DO happen to collapse into a PH mobile
// shape are blocked — that over-block is accepted (owner chose Block; the sender
// just rewords).
const PHONE_FILLER_GAP = 20;

// CARD (a): the same gap, retuned for card text. A card carries prose numbers -
// "Php 9,000 per hour, minimum 4 hours, 150 pax, 20 staff" fuses into a PH
// mobile shape at gap 20 (measured). At 2 only the separators a real number is
// written with (a space, a dash, ", ", ") ") still collapse, so every disguise
// in the test matrix - "0917 880 7163", "(0917) 880 7163", "0 9 1 7 ...",
// "+63 917 880 7163", spelled-out - is still caught, while a price line is not.
// The one thing gap 2 gives up is words jammed BETWEEN the digits ("0917 my
// number is 8807163"); on a card, that is a trade the owner ruling accepts -
// the same string still trips the `solicit` rule.
const CARD_PHONE_FILLER_GAP = 2;

// PH mobile shapes on the collapsed digit string: 09XXXXXXXXX (11), 9XXXXXXXXX
// (10, dropped leading 0), or 639XXXXXXXXX (12, +63 with the + stripped).
const PHONE_SHAPE = /(?:0|63)?9\d{9}/;

type PhoneOptions = {
  /** Max run of non-digit filler still collapsed between two digits (Tier 1). */
  fillerGap: number;
  /** Whether Tier 2 (the dense 11+ digit run) applies. */
  denseRun: boolean;
};

function containsPhone(raw: string, { fillerGap, denseRun }: PhoneOptions): boolean {
  const normalized = spelledDigitsToNumerals(raw);

  // Tier 1 — PH mobile shape, tolerating short filler (incl. a few words)
  // between the digits. Collapse each non-digit run: short (<= gap) -> removed
  // (fuse the digits), long -> a break. Catches 0917 880 7163 / 0 9 1 7 ... /
  // 0917 my number is 8807163 / spelled-out / +63.
  const t1 = normalized.replace(/[^\d]+/g, (run) =>
    run.length <= fillerGap ? '' : '\n',
  );
  for (const group of t1.split('\n')) {
    if (group.length >= 10 && PHONE_SHAPE.test(group)) return true;
  }

  // CARD (b): Tier 2 is chat-only. On a card the commonest discount-conditions
  // string, "Valid 2026-09-17 - 2026-12-31", is exactly the dense run this
  // tier looks for, and so is a bracket table of pax counts.
  if (!denseRun) return false;

  // Tier 2 — a densely written number of 11+ digits using ONLY tight phone
  // separators (space, parens, +, -). Catches international / long numbers that
  // aren't PH-mobile-shaped ("or other" · owner). Commas, colons, slashes, and
  // letters BREAK the run — so a number list ("5, 10, 3, 200, 50") and a
  // datetime ("2026-09-17 14:30") don't fuse into a false hit. The 11-digit
  // floor (not 10) keeps a date+hour from tripping it.
  const t2 = normalized.replace(/[\s().+-]{1,2}/g, '');
  for (const group of t2.split(/\D+/)) {
    if (group.length >= 11) return true;
  }

  return false;
}

// -- Structural patterns -----------------------------------------------------
// NB: no /g flag - these are used with .test() for a boolean, so they must be
// stateless (a /g regex carries lastIndex between .test() calls).

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const EMAIL_OBFUSCATED =
  /[A-Za-z0-9._%+-]+\s*(?:\(at\)|\[at\]|\bat\b)\s*[A-Za-z0-9.-]+\s*(?:\(dot\)|\[dot\]|\bdot\b)\s*[A-Za-z]{2,}/i;

const SOCIAL_URL = new RegExp(
  '(?:https?:\\/\\/)?(?:www\\.)?(?:' +
    '(?:wa\\.me|m\\.me|t\\.me|fb\\.me|instagr\\.am)(?:\\/[^\\s]*)?' +
    '|' +
    '(?:facebook|fb|messenger|instagram|whatsapp|viber|telegram|tiktok|twitter|x|linkedin|snapchat|kakao|wechat)\\.(?:com|net|org|me|ph|io)(?:\\/[^\\s]*)?' +
    ')',
  'i',
);

const HANDLE = /(?:^|[^\w@/])@[A-Za-z][A-Za-z0-9._]{1,30}\b/;

// CARD (d): a solicitation whose destination is Setnayan ITSELF is the OPPOSITE
// of disintermediation — it is the vendor telling the couple to stay. "Message
// me on Setnayan for the full menu" is honest card copy that the `solicit` rule
// (which only reads the verb, not where it points) refuses.
//
// SUPPRESS THE MATCH, NOT THE BODY. The first cut tested a bare
// /\b(?:on|via|in)\s+setnayan\b/ against the WHOLE string and skipped the
// solicit rule when it fired. That was a bypass: because `app_name` is also
// skipped on a card, "Message me on Viber, not on Setnayan" named another
// platform, pointed at it, and then said "Setnayan" to disarm the rule — all
// four of these were measured PASSING under 'card' and BLOCKING under 'chat':
//   "Message me on Viber, not on Setnayan" · "Faster on Viber than on Setnayan"
//   "We reply on Setnayan or add me on WhatsApp" · "reach me on IG, we are on
//   Setnayan too"
// So the exemption is scoped to the PHRASE, not the message: the honest case is
// a vendor saying "ask me HERE", and the thing that makes it honest is the
// destination — so only the verb-plus-Setnayan phrase is scrubbed out before
// the solicit rule reads the text. Any OTHER solicitation left in the same
// string still blocks. The verb list mirrors the `solicit` entry's own.
//
// /g is required (replace-all) and is therefore STATELESS ONLY under
// String.replace — never call .test() on this, it carries lastIndex (see the
// structural-patterns note above).
const SOLICIT_TO_SETNAYAN =
  /\b(?:message|msg|add|find|reach|contact|call|text|chat|dm|pm|ping)\s+me\s+(?:on|at|via)\s+setnayan\b/gi;

// -- BLOCKLIST - the editable "list of text that isn't allowed" ---------------
// Add or remove a line to tune what the chatroom blocks. Each entry is a
// case-insensitive pattern + the label shown in the admin record. Word
// boundaries keep short tokens ("ig", "fb") from firing inside ordinary words
// ("big", "dig"). This is the owner-maintained surface - everything else in
// this file is detection machinery.
const BLOCKLIST: { category: ContactRuleCategory; label: string; re: RegExp }[] = [
  { category: 'app_name', label: 'Facebook / Messenger', re: /\bfacebook\b|\bfb\b|\bmessenger\b/i },
  { category: 'app_name', label: 'Viber', re: /\bviber\b/i },
  { category: 'app_name', label: 'WhatsApp', re: /\bwhats\s?app\b|\bwassap\b|\bwsp\b/i },
  { category: 'app_name', label: 'Telegram', re: /\btelegram\b/i },
  { category: 'app_name', label: 'Instagram', re: /\binstagram\b|\binsta\b|\big\b/i },
  {
    category: 'app_name',
    label: 'Other messaging app',
    re: /\bsnapchat\b|\btiktok\b|\bwechat\b|\bkakao(?:talk)?\b|\bimessage\b|\bsignal app\b|\bline app\b/i,
  },
  { category: 'euphemism', label: 'Coded app name', re: /\b(?:blue|purple|green|pink)\s+app\b/i },
  {
    category: 'solicit',
    label: 'Solicitation to move off-platform',
    re: /\b(?:(?:message|msg|add|find|reach|contact|call|text|chat|dm|pm|ping)\s+me\s+(?:on|at|via)|(?:my|here'?s\s+my|this\s+is\s+my)\s+(?:number|cell|mobile|contact|email|gcash|viber|whatsapp)|hit\s+me\s+up|let'?s\s+(?:connect|chat|talk)\s+(?:on|via|outside)|outside\s+the\s+app|off\s+(?:the\s+)?platform)\b/i,
  },
];

/**
 * Evaluate a body against the blocked-rules. Pure - no I/O, no throw. `blocked`
 * is true when ANY rule fires; the caller rejects the send / save.
 *
 * `profile` defaults to `'chat'`, which is exactly the shipped behaviour — so
 * every existing caller keeps calling `evaluateMessage(body)` and gets the
 * identical result. Pass `'card'` for vendor card / package text; see the
 * PROFILES block at the top of this file for the four differences and why.
 */
export function evaluateMessage(
  body: string,
  profile: ContactProfile = 'chat',
): ContactEvaluation {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { blocked: false, categories: [], matched: [] };
  }

  const isCard = profile === 'card';
  const matched: ContactMatch[] = [];

  if (
    containsPhone(body, {
      fillerGap: isCard ? CARD_PHONE_FILLER_GAP : PHONE_FILLER_GAP,
      denseRun: !isCard,
    })
  )
    matched.push({ category: 'phone', label: 'Phone number' });
  if (EMAIL.test(body) || EMAIL_OBFUSCATED.test(body))
    matched.push({ category: 'email', label: 'Email address' });
  if (SOCIAL_URL.test(body)) matched.push({ category: 'url', label: 'Social/messaging link' });
  if (HANDLE.test(body)) matched.push({ category: 'handle', label: '@handle' });

  // CARD (d): the solicit rule — and ONLY that rule — reads a copy of the body
  // with any "message me on Setnayan" phrase scrubbed out. Every other rule
  // keeps reading the original `body`, so nothing else can be laundered by
  // mentioning us. String.replace with /g is the one stateless use of that
  // regex.
  const solicitBody = isCard ? body.replace(SOLICIT_TO_SETNAYAN, ' ') : body;
  for (const rule of BLOCKLIST) {
    // CARD (c): driven off the entry's CATEGORY, never a hand-picked regex, so
    // a new blocklist line inherits the profile rule for free.
    //
    // THE TRADE, written down rather than discovered: skipping `app_name` means
    // a bare platform mention with NO destination verb ("Viber only", "we also
    // post on IG") passes on a card. That is the deliberate price of allowing
    // "Instagram teaser reel" / "TikTok highlights package" / Setnayan's own
    // "Patiktok — 250 TikTok recordings", and it is safe because a bare name
    // carries no way to REACH the vendor — there is no number, no handle, no
    // link, and no instruction. The moment it acquires one, a different rule
    // fires: `solicit` on "add me on viber", HANDLE on "@juanphotos",
    // SOCIAL_URL on "facebook.com/…", `phone` on a number. Those four are all
    // still live on a card, which is what makes this skip affordable.
    if (isCard && (rule.category === 'app_name' || rule.category === 'euphemism')) continue;
    const subject = rule.category === 'solicit' ? solicitBody : body;
    if (rule.re.test(subject)) matched.push({ category: rule.category, label: rule.label });
  }

  const categories = Array.from(new Set(matched.map((m) => m.category)));
  return { blocked: matched.length > 0, categories, matched };
}
