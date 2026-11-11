/**
 * fair-presentation.ts — THE FAIR-PRESENTATION CHECKS FOR EVERYTHING A SUPPLIER WRITES (owner 2026-11-08).
 *
 * ⚖ The rulings this module carries out, all DECISION_LOG 2026-11-08 + plan `plans/supplier_build_2_2026-11-08/`:
 *   · 🚫 "NO CLAIM WORDS IN ANY SUPPLIER-WRITTEN NAME — THE FULL LIST IS BANNED" — *"any of these words should not be
 *     allowed"*: the admin list `card_claim_words`, on shop name · tagline · card · inclusions · extras · package names ·
 *     About, disguised forms included (`lib/claim-text-fold.ts`).
 *   · 🚫 "NO EMOJI IN SUPPLIER-WRITTEN NAMES" — *"no emojis as well"*: Extended_Pictographic, keycaps, flags, ZWJ
 *     sequences, on shop name · tagline · card name · inclusion lines · add-on names · package names. **Not** About
 *     (the row says so: "Chat messages and About text are not covered by this ruling").
 *   · *"0001 is still number 1"*: RANK forms, not only the word list — 0001 · #01 · No./N°/Nr. + 1 · "first choice" ·
 *     "numero uno" · "the one" · "Top 1/3/5/10", spaced or with look-alike letters. A number that is a QUANTITY
 *     ("100 guests", "1 photographer") is never a rank.
 *   · ✅ "FAIR PRESENTATION: 18 checks" — *"we want to offer professional service cards"*. Each check that can be read
 *     from the text itself is HERE; the ones that need other data reuse the shipped machinery or are listed, honestly,
 *     as not built (`FAIR_PRESENTATION_CHECKS` below — the PR body and the guard read that list, never prose).
 *   · ⛔ The copy names NO law and NO agency (owner: *"ok remove the DTI statement. just make it professionally stated
 *     and still proactive."*) — `FAIR_LINE_LEAD` · `fairLine` · `FAIR_WHY_WE_CHECK` · `fairNoticeLine` are the ruled
 *     sentences, word for word.
 *
 * Each problem is a plain message under its own line, and Save / Publish / Create stays off until it is fixed; the
 * server asks the SAME function again at save (`lib/fair-presentation.server.ts`). Nothing live is ever taken down.
 *
 * PURE — no I/O. The word list is read by the page / the save and handed in.
 */
import { baseFold, claimReadings, joinSpacedLetters } from './claim-text-fold';
import { claimWordPattern, findClaimWords, normaliseCardText, type ClaimWord } from './service-card-checks';
import { evaluateMessage } from './chat-contact-filter';
import { serviceHandleMessage, serviceTextIntegrityEnabled } from './service-text-integrity';

// ── the fields and the checks ───────────────────────────────────────────────

/** Every supplier-written field the ruling covers. */
export type FairField = 'shop_name' | 'tagline' | 'card_name' | 'included' | 'extras' | 'package_name' | 'about';

/** The checks this module reads from the text (the rest live elsewhere — see `FAIR_PRESENTATION_CHECKS`). */
export type FairCheck =
  | 'claim'
  | 'rank'
  | 'emoji'
  | 'shouting'
  | 'contact'
  | 'discount'
  | 'free'
  | 'stuffing'
  | 'numbers'
  | 'setnayan'
  | 'urgency'
  | 'placeholder'
  | 'too_long'
  | 'price_in_name'
  | 'duplicate';

export type FairText = {
  field: FairField;
  /** Which line of a list field (what's included · extras), 0-based. */
  index?: number;
  value: string | null | undefined;
};

export type FairHit = {
  check: FairCheck;
  field: FairField;
  index: number;
  /** What the supplier wrote that tripped it, as they wrote it (or the list word). */
  sample: string;
  /** The "[what to change]" of the ruled sentence — lower-case, no full stop: `reword “best”`. */
  fix: string;
  /** One line for the ⓘ: why this one. */
  why: string;
};

/** A card name is 50 characters at most (8 Nov "Plus: card names ≤ 50 characters"). */
export const CARD_NAME_MAX = 50;

const NAME_CHECKS: FairCheck[] = ['claim', 'rank', 'emoji', 'shouting', 'contact', 'discount', 'numbers', 'setnayan', 'urgency', 'placeholder', 'price_in_name'];
const LINE_CHECKS: FairCheck[] = ['claim', 'rank', 'emoji', 'shouting', 'contact', 'discount', 'numbers', 'setnayan', 'urgency', 'placeholder'];

/**
 * WHICH CHECK READS WHICH FIELD. The emoji ruling lists its six fields and leaves About out; About is in the claim-word
 * ruling ("the same check on shop name, tagline, package names and About") and the plan's "About for contact details".
 * "Free" is not read on a shop name (a brand like "Free Spirit Studio" is not an offer) nor on a what's-included line
 * (an inclusion IS the ₱0 line the ruling allows). An extra is the paid part of a card, so "free" there is refused —
 * a free thing belongs under What's included (and no extra's price is read: "no price check of any kind", 26 Oct).
 */
export const FAIR_FIELD_CHECKS: Readonly<Record<FairField, ReadonlySet<FairCheck>>> = {
  shop_name: new Set(NAME_CHECKS),
  card_name: new Set([...NAME_CHECKS, 'free', 'stuffing', 'too_long', 'duplicate']),
  package_name: new Set([...NAME_CHECKS, 'free', 'stuffing']),
  tagline: new Set(['claim', 'rank', 'emoji', 'shouting', 'contact', 'discount', 'free', 'numbers', 'setnayan', 'urgency']),
  included: new Set(LINE_CHECKS),
  extras: new Set([...LINE_CHECKS, 'free']),
  about: new Set(['claim', 'rank', 'contact', 'setnayan']),
};

/** Where a field is, for the save's refusal (a live note sits under its own line and needs no "where"). */
export function fairWhere(field: FairField, index = 0): string {
  switch (field) {
    case 'shop_name':
      return 'your shop name';
    case 'tagline':
      return 'your tagline';
    case 'card_name':
      return 'the card name';
    case 'included':
      return `what’s-included line ${index + 1}`;
    case 'extras':
      return `extra ${index + 1}`;
    case 'package_name':
      return 'the package name';
    case 'about':
      return 'your About';
  }
}

// ── the ruled copy (owner 2026-11-08 — no law or agency named) ──────────────

/** The first sentence of every note under a flagged line. */
export const FAIR_LINE_LEAD = 'Setnayan presents every service on the same fair footing, so couples choose on what you actually offer.';

/** The ⓘ on the card maker. */
export const FAIR_WHY_WE_CHECK =
  'Why we check: couples compare services side by side. Words like “#1”, “best” or “trending” can’t be checked by a couple, so we keep every card to clear facts — what you do, what’s included, what it costs.';

function joinFixes(fixes: ReadonlyArray<string>): string {
  const list = Array.from(new Set(fixes));
  if (list.length <= 1) return list[0] ?? 'reword it';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** Under a flagged line: the ruled sentence with its "[what to change]". */
export function fairLine(fixes: ReadonlyArray<string>): string {
  return `${FAIR_LINE_LEAD} Please ${joinFixes(fixes)} — your photos, inclusions and price will speak for you.`;
}

/** The repeat notice on a live card / shop (the sweep): the ruled sentence. `subject` defaults to the ruled "One of your cards". */
export function fairNoticeLine(what: string, subject = 'One of your cards'): string {
  return `${subject} needs a quick edit to meet our fair-presentation standard: ${what}. It stays visible while you fix it.`;
}

/** The save's refusal: the ruled sentence, each fix naming where it is. One sentence, every problem. */
export function fairRefusal(hits: ReadonlyArray<FairHit>): string | null {
  if (hits.length === 0) return null;
  return fairLine(hits.map((h) => `${h.fix} in ${fairWhere(h.field, h.index)}`));
}

// ── the detectors (each: text → the sample that tripped it, or null) ─────────

/** Text symbols that are Extended_Pictographic but print as text, not emoji: © ® ™ (a trademark is not an emoji). */
const TEXT_SYMBOLS = /[©®™]/u;
const EMOJI = /\p{Extended_Pictographic}|⃣|[\u{1F1E6}-\u{1F1FF}]/gu;

/** The first emoji in `s` (a keycap reads as its whole "1️⃣"), or null. */
export function findEmoji(s: string): string | null {
  for (const m of s.matchAll(EMOJI)) {
    const ch = m[0];
    if (TEXT_SYMBOLS.test(ch)) continue;
    if (ch === '⃣') {
      const at = m.index ?? 0;
      return s.slice(Math.max(0, at - 2), at + 1);
    }
    return ch;
  }
  return null;
}

/** Decorations that shout: ★ ✿ ♥ ✓ ~ … (any "other symbol" except the degree sign, №, © ® ™ and emoji, read above). */
const DECORATION = /[~\p{So}]/gu;
const NOT_DECORATION = /[°№©®™]/u;

export function findShouting(s: string): { sample: string; fix: string } | null {
  const bang = s.match(/[!?]{2,}/u);
  if (bang) return { sample: bang[0], fix: `drop the “${bang[0]}”` };
  for (const m of s.matchAll(DECORATION)) {
    const ch = m[0];
    if (NOT_DECORATION.test(ch) || /\p{Extended_Pictographic}/u.test(ch)) continue;
    return { sample: ch, fix: `drop the “${ch}”` };
  }
  const letters = s.match(/\p{L}/gu) ?? [];
  const upper = s.match(/\p{Lu}/gu) ?? [];
  const capsWords = s.match(/(?<!\p{L})\p{Lu}{4,}(?!\p{L})/gu) ?? [];
  const shouted = capsWords.length >= 2 || (capsWords.length >= 1 && letters.length >= 6 && upper.length / letters.length >= 0.8);
  return shouted ? { sample: capsWords[0]!, fix: 'write it in normal case, not ALL CAPS' } : null;
}

const NOT_A_LETTER_BEFORE = '(?<![\\p{L}\\p{N}])';
const NOT_A_LETTER_AFTER = '(?![\\p{L}\\p{N}])';

/** RANK FORMS ("0001 is still number 1"). Read on the folded text, digits kept. */
const RANK_FORMS: RegExp[] = [
  // #1 · #01 · # 1 · #️⃣1️⃣ (folded) · #l
  new RegExp(`#\\s*0*[1l|]${NOT_A_LETTER_AFTER}`, 'iu'),
  // No. 1 · N0. 1 · No.01 · Nr 1 · Num. 1 · Number 1 · N° 1 · No. I
  new RegExp(`${NOT_A_LETTER_BEFORE}(?:n\\s*[o0]|nr|num|number|n[°º])\\s*[.:°º]?\\s*#?\\s*0*[1l|i](?![\\p{L}\\p{N}.,])`, 'iu'),
  // 0001 · 01 standing alone (never a time, a date, a decimal or a phone number)
  new RegExp(`(?<![\\p{L}\\p{N}:.,/#\\-])0+1(?![\\p{L}\\p{N}.,/:\\-])`, 'u'),
  // 1st / first — only AS A RANK ("first choice", "1st in Cavite"), never "1st floor" or "first dance"
  new RegExp(`${NOT_A_LETTER_BEFORE}(?:1\\s*st|first)\\s+(?:choice|pick|place|class|rate|rated|among|in\\s+\\p{L}+)${NOT_A_LETTER_AFTER}`, 'iu'),
  // numero uno · number one (also on the word list) · one and only
  new RegExp(`${NOT_A_LETTER_BEFORE}(?:numero|number)\\s+(?:uno|one)${NOT_A_LETTER_AFTER}`, 'iu'),
  new RegExp(`${NOT_A_LETTER_BEFORE}(?:the\\s+)?(?:one|1)\\s+and\\s+only${NOT_A_LETTER_AFTER}`, 'iu'),
  // "the one" standing as the whole claim at the end of a name, or "the one for you"
  new RegExp(`${NOT_A_LETTER_BEFORE}the\\s+one(?:\\s+for\\s+you)?\\s*[.!]*\\s*$`, 'iu'),
  // Top 1 · Top 3 · Top-5 · Top10
  new RegExp(`${NOT_A_LETTER_BEFORE}top\\s*-?\\s*0*(?:1|3|5|10)${NOT_A_LETTER_AFTER}`, 'iu'),
];

/** The first rank form in `s` (as written in the folded reading), or null. */
export function findRankForm(s: string): string | null {
  const base = baseFold(s);
  for (const reading of [base, joinSpacedLetters(base)]) {
    for (const re of RANK_FORMS) {
      const m = reading.match(re);
      if (m) return m[0].trim();
    }
  }
  return null;
}

const DISCOUNT = new RegExp(
  `${NOT_A_LETTER_BEFORE}(?:was\\s*(?:₱|php|p)\\s*\\d[\\d,.]*|\\d{1,3}\\s*%\\s*(?:off|discount)|less\\s+\\d{1,3}\\s*%|on\\s+sale|sale|discounted|slashed\\s+price|promo\\s+price)${NOT_A_LETTER_AFTER}`,
  'iu',
);

/** "free" as an offer — never "free-flowing", "free-standing", "freestyle", "hands-free", "gluten-free". */
const FREE = /(?<![\p{L}\p{N}-])(?:free|libre)(?![\p{L}\p{N}])(?!\s*-?\s*(?:flow|flowing|standing|style|form|hand)(?!\p{L}))/iu;

const COUNT_NOUN = '(?:weddings?|events?|clients?|couples?|bookings?|reviews?|customers?|brides?|debuts?|parties|celebrations?|happy\\s+\\p{L}+)';
const NUMBERS: RegExp[] = [
  // "500+ weddings" · "1,000 happy couples" · "50 events" (a + or 10 and up — "good for 2 events" is a quantity)
  new RegExp(`${NOT_A_LETTER_BEFORE}(?:\\d[\\d,.]*\\s*(?:\\+|plus)|\\d{2,}[\\d,.]*|\\d+(?:\\.\\d)?\\s*k\\s*\\+?)\\s*${COUNT_NOUN}(?![\\p{L}])`, 'iu'),
  // "5★" · "5 stars" · "4.9 star" · "5-star"
  new RegExp(`${NOT_A_LETTER_BEFORE}\\d(?:\\.\\d)?\\s*-?\\s*(?:★|☆|stars?)(?![\\p{L}])`, 'iu'),
  // "rated 4.9" · "4.9/5 rating"
  new RegExp(`${NOT_A_LETTER_BEFORE}(?:rated|rating)\\s*:?\\s*\\d|\\d(?:\\.\\d)?\\s*\\/\\s*(?:5|10)\\s*(?:rating|rated|stars?)`, 'iu'),
  // "10 years of experience" · "15+ yrs in the business" (Setnayan shows the shop's own "since" year)
  new RegExp(`${NOT_A_LETTER_BEFORE}\\d+\\s*\\+?\\s*(?:years?|yrs?)\\s*(?:of\\s+)?(?:experience|exp|in\\s+(?:the\\s+)?(?:business|industry))(?![\\p{L}])`, 'iu'),
];

const URGENCY = new RegExp(
  `${NOT_A_LETTER_BEFORE}(?:(?:only\\s+)?\\d+\\s*(?:slots?|dates?|spots?|bookings?)\\s*(?:left|remaining)|(?:few|limited)\\s+(?:slots?|dates?|spots?)|(?:almost|nearly)\\s+(?:full|fully\\s+booked|sold\\s+out)|fully\\s+booked|selling\\s+fast|book\\s+now|last\\s+(?:chance|call)|while\\s+(?:slots|supplies)\\s+last|don'?t\\s+miss|first\\s+come,?\\s+first\\s+served?)${NOT_A_LETTER_AFTER}`,
  'iu',
);

/** "Setnayan" in a name speaks AS Setnayan; in About only a claim of standing with us ("Setnayan partner") does. */
const SETNAYAN_ANY = /setnayan/u;
const SETNAYAN_STANDING =
  /setnayan\s*(?:'?s\s+)?(?:partner|approved|certified|verified|accredited|official|recommended|exclusive|choice)|(?:partner|accredited|official|exclusive)\s+(?:of\s+|by\s+|ng\s+)?setnayan/u;

const PLACEHOLDER =
  /^(?:test(?:ing)?\s*\d*|tester|asdf\w*|qwer\w*|sample(?:\s+(?:card|name|package|service))?|untitled|lorem\s+ipsum.*|n\/?a|none|tbd|tba|todo|placeholder|dummy|foo|foobar|name|title|my\s+card|new\s+card|new\s+package)$/u;

/** A name that is not a name yet: a keyboard mash, "test", "untitled", one letter, or no letters at all. */
export function isPlaceholder(s: string): boolean {
  const t = joinSpacedLetters(baseFold(s)).replace(/[\s.!?\-_*]+$/u, '').trim();
  if (!t) return false; // a blank is auto-named at save, never a finding (owner 2026-07-27)
  const letters = t.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return true;
  if (/^(\p{L})\1{2,}$/u.test(t.replace(/\s+/g, ''))) return true; // "aaaa" · "x x x"
  return PLACEHOLDER.test(t) || /lorem\s+ipsum/u.test(t);
}

const PRICE_IN_NAME = /(?:₱|(?<![\p{L}])php(?![\p{L}])|(?<![\p{L}\p{N}])p(?=\s?\d))\s?\d|(?<![\p{L}\p{N}])\d[\d,.]*\s*(?:pesos?|php)(?![\p{L}])/iu;

/** Keyword stuffing: four or more services strung together, a hashtag run, or one word said three times. */
export function findStuffing(s: string): string | null {
  const hashtags = s.match(/#\p{L}[\p{L}\p{N}_]*/gu) ?? [];
  if (hashtags.length >= 2) return hashtags.slice(0, 2).join(' ');
  const parts = s
    .split(/\s*[|/,;+•·]\s*|\s+(?:&|and|at|x)\s+/iu)
    .map((p) => p.trim())
    .filter((p) => /\p{L}{2,}/u.test(p));
  if (parts.length >= 4) return parts.slice(0, 4).join(' · ');
  const counts = new Map<string, number>();
  for (const w of normaliseCardText(s).split(' ')) {
    if (w.length < 4) continue;
    const n = (counts.get(w) ?? 0) + 1;
    counts.set(w, n);
    if (n >= 3) return w;
  }
  return null;
}

function contactFix(s: string): { sample: string; fix: string } | null {
  // ⛳ The off-platform-contact rule is the shipped one (`chat-contact-filter` · 'card' profile), behind its shipped
  // flag (`NEXT_PUBLIC_SERVICE_TEXT_INTEGRITY_ENABLED`) — this module only carries it to the fields it never reached.
  if (!serviceTextIntegrityEnabled()) return null;
  const e = evaluateMessage(s, 'card');
  if (!e.blocked) return null;
  if (e.categories.length === 1 && e.categories[0] === 'handle') {
    const sample = e.matched.find((m) => m.category === 'handle')?.sample ?? '@';
    // "…Write "at Tagaytay" instead of "@Tagaytay"." → the fix part only.
    const advice = serviceHandleMessage(sample).replace(/^.*?Write /u, 'write ').replace(/\.$/u, '');
    return { sample, fix: advice };
  }
  return { sample: e.matched[0]?.label ?? 'contact details', fix: 'take out the contact details' };
}

// ── the one function every surface asks ─────────────────────────────────────

export type FairOptions = {
  /** The claim-word list this shop may not use (`loadClaimWordsFor`). `null` = unread: the word check is skipped (the
   *  caller says so — never "nothing to fix"); every other check still runs, none of them needs the list. */
  words: ReadonlyArray<ClaimWord> | null;
  /** This shop's OTHER card names — a card named the same as another is flooding. */
  siblingNames?: ReadonlyArray<string>;
};

/**
 * Every fair-presentation problem in `texts`, in field order, one hit per (line, check). A blank line is never a hit
 * (it is auto-named at save).
 */
export function findFairHits(texts: ReadonlyArray<FairText>, opts: FairOptions): FairHit[] {
  const hits: FairHit[] = [];
  const siblings = new Set((opts.siblingNames ?? []).map((n) => normaliseCardText(n)).filter(Boolean));
  for (const t of texts) {
    const value = (t.value ?? '').trim();
    if (!value) continue;
    const on = FAIR_FIELD_CHECKS[t.field];
    const index = t.index ?? 0;
    const add = (check: FairCheck, sample: string, fix: string, why: string) => hits.push({ check, field: t.field, index, sample, fix, why });

    if (on.has('claim') && opts.words) {
      const found = findClaimWords([{ field: 'name', value }], opts.words);
      // ONE problem per claim: a listed phrase inside a longer one that was also found ("best" in "the best") is the
      // same words, said once.
      const inLonger = (p: string) => found.some((o) => o.phrase !== p && o.phrase.length > p.length && claimWordPattern(p).test(o.phrase));
      const said = new Set<string>();
      for (const h of found) {
        if (said.has(h.phrase) || inLonger(h.phrase)) continue;
        said.add(h.phrase);
        // Quote what the supplier WROTE ("No. 1"), or the list word when it was found only in a disguised reading.
        const sample = value.match(claimWordPattern(h.phrase))?.[0] ?? h.phrase;
        add('claim', sample, `reword “${sample}”`, h.why);
      }
    }
    if (on.has('rank')) {
      const r = findRankForm(value);
      // A rank the word list already named ("#1") is one problem, not two.
      if (r && !hits.some((h) => h.field === t.field && h.index === index && h.check === 'claim' && normaliseCardText(h.sample) === normaliseCardText(r))) {
        add('rank', r, `reword “${r}”`, 'A rank a couple can’t check — 0001, No. 01 and #1 all read as number 1.');
      }
    }
    if (on.has('emoji')) {
      const e = findEmoji(value);
      if (e) add('emoji', e, `remove the emoji (${e})`, 'Names stay in plain words, so every card reads the same.');
    }
    if (on.has('shouting')) {
      const s = findShouting(value);
      if (s) add('shouting', s.sample, s.fix, 'Capitals, “!!!” and decorations shout over the cards beside yours.');
    }
    if (on.has('contact')) {
      const c = contactFix(value);
      if (c) add('contact', c.sample, c.fix, 'Couples book and chat with you here on Setnayan.');
    }
    if (on.has('discount')) {
      const m = value.match(DISCOUNT);
      if (m) add('discount', m[0], `take out “${m[0]}”`, 'A “was” price or “% off” is fair only when the card really was that price — and text can’t show that. Set a real discount on the card instead.');
    }
    if (on.has('free')) {
      const m = value.match(FREE);
      if (m) add('free', m[0], `move “${m[0]}” to a What’s included line`, '“Free” is fair only on a What’s included line — the part of the price that costs nothing extra.');
    }
    if (on.has('stuffing')) {
      const s = findStuffing(value);
      if (s) add('stuffing', s, 'name one service', 'A name that lists everything hides what the card actually is — list the rest under What’s included.');
    }
    if (on.has('numbers')) {
      for (const re of NUMBERS) {
        const m = value.match(re);
        if (m) {
          add('numbers', m[0].trim(), `remove “${m[0].trim()}”`, 'Setnayan shows your counts and ratings from its own records, so couples can trust them.');
          break;
        }
      }
    }
    if (on.has('setnayan')) {
      const pattern = t.field === 'about' ? SETNAYAN_STANDING : SETNAYAN_ANY;
      const read = claimReadings(value).find((r) => pattern.test(baseFold(r)));
      if (read) add('setnayan', 'Setnayan', 'take out “Setnayan”', 'Only Setnayan speaks as Setnayan — our name and badges are earned, never written in.');
    }
    if (on.has('urgency')) {
      const m = value.match(URGENCY);
      if (m) add('urgency', m[0], `remove “${m[0]}”`, 'Couples see your open dates from your real calendar, never from a countdown.');
    }
    if (on.has('placeholder') && isPlaceholder(value)) {
      add('placeholder', value, 'give it a real name', 'A placeholder tells a couple nothing about what you offer.');
    }
    if (on.has('too_long') && Array.from(value).length > CARD_NAME_MAX) {
      add('too_long', value, `shorten the name to ${CARD_NAME_MAX} characters`, 'Short names read whole on every card.');
    }
    if (on.has('price_in_name')) {
      const m = value.match(PRICE_IN_NAME);
      if (m) add('price_in_name', m[0], 'take the price out of the name', 'The price shows from the card’s own price, so it is always the real one.');
    }
    if (on.has('duplicate') && siblings.has(normaliseCardText(value))) {
      add('duplicate', value, 'name it differently from your other card of the same name', 'Two cards with one name read as the same card twice.');
    }
  }
  return hits;
}

/** A service card as the checks read it — the name, each what's-included line, each extra, in row order. */
export function cardFairTexts(card: { title: string; inclusionLabels: ReadonlyArray<string>; addonLabels: ReadonlyArray<string> }): FairText[] {
  return [
    { field: 'card_name', value: card.title },
    ...card.inclusionLabels.map((value, index) => ({ field: 'included' as const, index, value })),
    ...card.addonLabels.map((value, index) => ({ field: 'extras' as const, index, value })),
  ];
}

/** The hits on one line (a field, or one line of a list field). */
export function hitsOn(hits: ReadonlyArray<FairHit>, field: FairField, index?: number): FairHit[] {
  return hits.filter((h) => h.field === field && (index === undefined || h.index === index));
}

// ── 3 · bait price — BUILT BEHIND ITS RULE, OFF ─────────────────────────────

/**
 * ⛔ OFF, AND IT MUST STAY OFF UNTIL THE OWNER RULES. Two rulings disagree: 26 Oct *"ok then remove the price integrity
 * issue"* (pinned by `service-card-checks.test.ts` "no price check of any kind") and 8 Nov's 18 checks, #3 "Bait price
 * (card price far below the service band or the shop's own quotes)". No service price band is measured anywhere
 * today, so even with the rule on there is nothing honest to compare against — `unmeasured` is the only answer.
 */
export const BAIT_PRICE_RULE_ON = false;

/** How far below the band's low end is "far below" — a placeholder ratio, unused while the rule is off. */
export const BAIT_PRICE_FLOOR_RATIO = 0.5;

export function baitPriceVerdict(args: { pricePhp: number | null; bandLowPhp: number | null }): 'bait' | 'ok' | 'unmeasured' {
  if (!BAIT_PRICE_RULE_ON) return 'unmeasured';
  if (args.pricePhp == null || args.bandLowPhp == null || args.bandLowPhp <= 0) return 'unmeasured';
  return args.pricePhp < args.bandLowPhp * BAIT_PRICE_FLOOR_RATIO ? 'bait' : 'ok';
}

// ── the 18 checks, as built — the PR body and the guard read THIS, never prose ──

export type FairCheckStatus = 'built' | 'reused' | 'behind-rule' | 'not-built';

export const FAIR_PRESENTATION_CHECKS: ReadonlyArray<{ n: number | '+'; name: string; status: FairCheckStatus; where: string }> = [
  { n: 1, name: 'Shouting (ALL CAPS, “!!!”, ★ ✿ ~)', status: 'built', where: 'findShouting' },
  { n: 2, name: 'Off-platform contact', status: 'reused', where: 'chat-contact-filter (card profile), behind NEXT_PUBLIC_SERVICE_TEXT_INTEGRITY_ENABLED; now also on shop name · About · package names. Photos: the shipped QR guard. A phone number inside a photo: not built (no text reading of images).' },
  { n: 3, name: 'Bait price', status: 'behind-rule', where: 'baitPriceVerdict — BAIT_PRICE_RULE_ON = false (conflicts with 26 Oct “remove the price integrity issue”; no service band is measured)' },
  { n: 4, name: 'Fake discount', status: 'built', where: 'DISCOUNT — a “was” price or “% off” in text is refused (the card has no “was” price to check it against)' },
  { n: 5, name: '“Free” only on a ₱0 inclusion line', status: 'built', where: 'FREE — allowed only on What’s included lines; refused on names, tagline and extras' },
  { n: 6, name: 'Hidden extras', status: 'not-built', where: 'nothing to check: a card’s extras are optional by schema (vendor_service_addons has no “required”), and a bundle’s required lines already count in its total' },
  { n: 7, name: 'Keyword stuffing', status: 'built', where: 'findStuffing + the shipped findServiceMismatch' },
  { n: 8, name: 'Wrong category', status: 'reused', where: 'findServiceMismatch (lib/service-card-checks.ts)' },
  { n: 9, name: 'Flooding (duplicate cards)', status: 'built', where: '“duplicate” — same card name in one shop; the same photo is the shipped one-photo-one-card check' },
  { n: 10, name: 'Borrowed photos', status: 'reused', where: 'the shipped pHash one-photo-one-card check. Another shop’s watermark: not built (no image reading).' },
  { n: 11, name: 'Flyer as cover', status: 'not-built', where: 'needs text detection inside images — not measurable honestly today' },
  { n: 12, name: 'Unverifiable numbers', status: 'built', where: 'NUMBERS — “500+ weddings”, “5★”, “rated 4.9”, “10 years of experience”' },
  { n: 13, name: 'Pretending to be Setnayan', status: 'built', where: '“setnayan” — the name in any supplier name/line; About only a claim of standing. Our logo in a photo: not built.' },
  { n: 14, name: 'Other names (competitors, celebrities, “as seen at”)', status: 'reused', where: 'the admin word list card_claim_words (seeded “as seen on/at/in”); names are added by admin' },
  { n: 15, name: 'Couples’ names without consent', status: 'not-built', where: 'a couple’s name cannot be told from other words in free text — needs an owner rule' },
  { n: 16, name: 'Fake urgency', status: 'built', where: 'URGENCY — “2 slots left”, “almost fully booked”, “book now”' },
  { n: 17, name: 'Coverage matches the shop’s service areas', status: 'not-built', where: 'nothing to check: a card carries no coverage area of its own — it inherits the shop’s' },
  { n: 18, name: 'Empty / placeholder names', status: 'built', where: 'isPlaceholder — never an auto-name (“Option 2”)' },
  { n: '+', name: 'Card names ≤ 50 characters', status: 'built', where: 'CARD_NAME_MAX' },
  { n: '+', name: 'No price in the name', status: 'built', where: 'PRICE_IN_NAME' },
  { n: '+', name: 'Complete before publishing', status: 'reused', where: 'unmetPublishRequirements (lib/service-publish-gate.ts) — the 9 Sep bar' },
];
