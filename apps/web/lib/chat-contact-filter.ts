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
 * Pure + synchronous + dependency-free: safe to import on BOTH the server (the
 * authoritative send gate + native endpoint) and the client (instant pre-send
 * feedback). No I/O, no throw. `evaluateMessage()` is the only entry point.
 *
 * NOT IN V1 (tracked follow-ups): Tagalog spelled-out digits ("isa dalawa..." -
 * skipped to avoid matching them inside ordinary words), and OCR of a number
 * inside an attached image.
 */

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

// PH mobile shapes on the collapsed digit string: 09XXXXXXXXX (11), 9XXXXXXXXX
// (10, dropped leading 0), or 639XXXXXXXXX (12, +63 with the + stripped).
const PHONE_SHAPE = /(?:0|63)?9\d{9}/;

function containsPhone(raw: string): boolean {
  const normalized = spelledDigitsToNumerals(raw);
  // Collapse each non-digit run: short (<= gap) -> removed (fuse the digits),
  // long -> a newline break. Then test each digit group for a phone shape.
  const collapsed = normalized.replace(/[^\d]+/g, (run) =>
    run.length <= PHONE_FILLER_GAP ? '' : '\n',
  );
  for (const group of collapsed.split('\n')) {
    if (group.length >= 10 && PHONE_SHAPE.test(group)) return true;
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
 * Evaluate a chat body against the chatroom blocked-rules. Pure - no I/O, no
 * throw. `blocked` is true when ANY rule fires; the caller rejects the send.
 */
export function evaluateMessage(body: string): ContactEvaluation {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { blocked: false, categories: [], matched: [] };
  }

  const matched: ContactMatch[] = [];

  if (containsPhone(body)) matched.push({ category: 'phone', label: 'Phone number' });
  if (EMAIL.test(body) || EMAIL_OBFUSCATED.test(body))
    matched.push({ category: 'email', label: 'Email address' });
  if (SOCIAL_URL.test(body)) matched.push({ category: 'url', label: 'Social/messaging link' });
  if (HANDLE.test(body)) matched.push({ category: 'handle', label: '@handle' });
  for (const rule of BLOCKLIST) {
    if (rule.re.test(body)) matched.push({ category: rule.category, label: rule.label });
  }

  const categories = Array.from(new Set(matched.map((m) => m.category)));
  return { blocked: matched.length > 0, categories, matched };
}
