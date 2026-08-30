/**
 * THE PUBLIC PAPIC PAGE SAYS ONLY WHAT IS TRUE.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Three drafts of `/papic` have now been written. Two of them were made without
 * access to the running product, both were beautifully made, and both promised
 * things we cannot do — one printed an invented "0.4 second" face-match time,
 * one turned our six-month SHOOTING window into an expiry date, and one led on
 * a per-guest allowance that is still being built. None of it was caught by a
 * reviewer, because every sentence read like something we would obviously have.
 *
 * A fourth draft is a matter of time. So the prohibitions stop living in a
 * brief somebody has to remember to open, and become a test.
 *
 * `papic-copy-guardrails.test.ts` is the sibling of this file and does NOT
 * overlap it: that one forbids a hand-typed NUMBER where a derived one belongs.
 * This one forbids a CLAIM we cannot keep, whatever the arithmetic.
 *
 * ── EVERY PROHIBITION CARRIES ITS OWN PROOF ─────────────────────────────────
 * A banned-list guard has one failure mode and it is silent: a pattern that can
 * no longer match anything passes forever and protects nothing. So each entry
 * carries `sample` — the claim as somebody actually wrote it — and a test
 * asserts the pattern still matches its own sample. A regex that rots fails
 * here rather than going quiet.
 *
 * And each entry carries `stillSayable`: true sentences that live on the page
 * today and MUST keep passing. A guard that cries wolf gets skimmed past, and
 * these are the near-misses — "the credits land in seconds" is not a latency
 * figure, "free and unlimited" cameras is not "unlimited uploads".
 *
 * ── ONE CORRECTION, WORTH MORE THAN THE GUARD ───────────────────────────────
 * The brief this was built from bans "chapters" outright as unbuilt. Measured:
 * `lib/papic-chapters.ts` SHIPS, derives a chapter from `captured_at` with
 * nothing stored, and is rendered by the guest's own gallery
 * (`app/papic/me/[token]/page.tsx`) and the pool grid. What is unbuilt is THE
 * YEAR — linking two celebrations, which nothing in the code does. So the
 * prohibition below is on the year, and the chapters line is listed under
 * `stillSayable`.
 *
 * ⚠ CORRECTED 2026-08-30 — that sentence used to end "so a later reader cannot
 * tidy a true claim off the page", and `stillSayable` DOES NOT DO THAT. It
 * asserts a pattern does not FIRE on a true sentence; nothing asserts the
 * sentence exists. Measured by deleting one: every `stillSayable` test stayed
 * green. Keeping a claim on the page takes its own assertion — see the last
 * test in this file, which is the only one that pins anything.
 *
 * ── STRIPPED FIRST ──────────────────────────────────────────────────────────
 * Comments are removed with the repo's one string-aware stripper before any
 * match, because these files quote the banned claims verbatim in their own
 * docblocks — including the one directly above.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/**
 * Every file that renders a word of the public Papic page. A new section is one
 * line here — and a claim moved one file over is the way this guard would
 * otherwise be defeated.
 */
const PAPIC_PAGE_FILES = [
  'app/(shell)/papic/page.tsx',
  'app/(shell)/papic/_papic-dial.tsx',
  'app/(shell)/papic/_papic-sections.tsx',
  'app/(shell)/papic/_papic-scan.tsx',
  'app/(shell)/papic/_papic-film.tsx',
  'app/(shell)/papic/try/page.tsx',
] as const;

type Prohibition = {
  /** Short name, used in the failure message. */
  id: string;
  /** Why it may not be said — this is what a future author reads. */
  why: string;
  pattern: RegExp;
  /** The claim as somebody wrote it. The pattern MUST still match this. */
  sample: string;
  /** True sentences on the page today that must NOT match. */
  stillSayable: readonly string[];
};

/** A tenth prohibition is one entry. Nothing else changes. */
const FORBIDDEN: readonly Prohibition[] = [
  {
    id: 'a speed or latency figure',
    why:
      'Nothing in the product measures one. An invented number is a number a ' +
      'competitor can test, and one draft printed "0.4 seconds" as fact.',
    pattern:
      /\blatency\b|\b\d+(?:\.\d+)?\s*ms\b|\b(?:in|under|within|takes|takes about)\s+(?:just\s+|only\s+|about\s+)?\d+(?:\.\d+)?\s*(?:milli)?seconds?\b/i,
    sample: 'every face is matched in 0.4 seconds',
    stillSayable: [
      'the new credits land in seconds on top of what you already have',
      'our ten-second video, the longest there is',
    ],
  },
  {
    id: 'a per-guest number the couple did not choose',
    why:
      'UNLOCKED 2026-08-30 — the ceiling SHIPPED and is SERVING (#5002 · ' +
      '#5017 · #5014 · #5019, all ancestors of the deployed 0d0b265), so the ' +
      'blanket ban on mentioning it is retired and the claim now lives in the ' +
      '"Let the whole room shoot" card. What survives is narrower and outlives ' +
      'the build: THE COUPLE PICKS THE NUMBER, so this page may never print ' +
      'one. A figure here is a promise the product does not make — and the ' +
      'sponsor default (principal ×3, cord/veil/coin/candle ×2) is a ' +
      'PLACEHOLDER the couple overwrites, never an allowance anybody receives.',
    pattern:
      /\beach guest (?:gets|has|holds)\s+\S+\s+(?:shots?|photos?|photographs?|credits?)\b|\b\d+\s+(?:shots?|photos?|photographs?|credits?)\s+(?:each|apiece)\b|\bcamera that holds\s+\S+\s+shots?\b/i,
    sample: 'Hand every guest a camera that holds twelve shots',
    stillSayable: [
      'That is about 15 photographs from every guest.',
      'Enough for every one of 200 guests to take about 15 photographs.',
      // A live near-miss, found by mutation: this sentence is on the page and
      // is about GALLERIES, not credits. The pattern requires a shots/credits
      // noun after the verb precisely so it cannot fire here.
      'Each guest gets their own personal gallery',
      // The claim this guard used to forbid. Pinned so a reader acting on the
      // OLD wording cannot tidy a now-true sentence off the page.
      'You can decide how many credits one guest may spend — name the few who should have more, and the rest split what is left evenly.',
      'Nothing is carved out, so whatever a guest doesn’t use is still there for everyone else.',
    ],
  },
  {
    id: 'having invented per-guest limits',
    why:
      'A rival (Lense) already ships per-guest limits — this is checkable ' +
      'against their homepage in fifteen seconds, which is what makes it the ' +
      'expensive kind of false claim. It becomes reachable only NOW, because ' +
      'a page that never mentioned limits could not overclaim them. What is ' +
      'ours is a limit PAIRED WITH A LIVE WALL, which nobody pairs. Claim the ' +
      'narrow thing.',
    pattern:
      /\b(?:we|setnayan)\s+(?:invented|pioneered|were the first to (?:build|ship|invent))\b[^.]{0,60}\b(?:limits?|caps?|ceilings?|allowances?)\b/i,
    sample: 'we invented per-guest shot limits',
    stillSayable: [
      'Nobody else pairs a limit like that with a live wall.',
      'You can decide how many credits one guest may spend',
    ],
  },
  {
    id: 'the year — one pot across several celebrations',
    why:
      'Nothing in the code links two celebrations, and the shot pot is ' +
      'per-celebration by construction. NOTE: a gallery reading in chapters ' +
      'WITHIN one celebration ships and may be claimed — see the docblock.',
    pattern:
      /\bengagement[- ]to[- ]wedding\b|\b(?:the|your) whole year\b|\bacross (?:all )?your celebrations\b|\bone pot[^.]{0,40}\bacross\b/i,
    sample: 'the proposal, the shower and the day — one pot of credits across your celebrations',
    stillSayable: [
      'A gallery that reads in chapters',
      'Grouped by how far from the day each photo was taken, so the run-up reads as the run-up.',
    ],
  },
  {
    id: 'an expiry',
    why:
      'Nothing closes. Six months is how long you may SHOOT for, never how ' +
      'long we keep anything — and being the one product without an expiry is ' +
      'the strongest thing we can say.',
    pattern:
      /\b(?:closes?|expires?|ends?|shuts? down)\s+(?:after|in)\s+\S+\s+months?\b|\bthe live service closes\b/i,
    sample: 'the live service closes after six months',
    stillSayable: [
      'Cameras can open months before the day',
      'Nothing here expires',
      'Credits never expire, and they are not a subscription.',
    ],
  },
  {
    id: 'a price in another currency',
    why: 'Pesos only. Every figure is read live from the price list.',
    pattern: /\$\s?\d|\bUSD\b|\bdollars?\b/i,
    sample: 'from $29 a celebration',
    stillSayable: ['₱50 buys 100 credits'],
  },
  {
    id: 'a separate Papic address',
    why:
      'No such subdomain exists, deliberately — it contradicts our own ' +
      'argument that Papic is not a separate site that expires.',
    pattern: /papic\.setnayan\.com/i,
    sample: 'visit papic.setnayan.com',
    stillSayable: ['setnayan.com/papic/try opens straight to the codes'],
  },
  {
    id: 'a retired product name',
    why: 'There is one product: Papic. The two-product model was retired 2026-08-11.',
    pattern: /\bPapic\s+(?:Pool|One|Mini|Ltd|Max)\b/,
    sample: 'Papic Pool and Papic One',
    stillSayable: ['Papic lives on the celebration page you already have'],
  },
  {
    id: 'unlimited uploads',
    why:
      'Never. The credits ladder is the entire price of the product — anyone ' +
      'promising unlimited uploads must raise their price or drop the ' +
      'matching. Cameras being free and unlimited is a different claim, and true.',
    pattern: /\bunlimited\s+(?:uploads?|photos?|shots?|credits?|photographs?)\b/i,
    sample: 'unlimited uploads for every guest',
    stillSayable: [
      'The cameras are free and unlimited',
      'Cameras are free and unlimited',
    ],
  },
  {
    id: 'a bigger share for the ninongs',
    why:
      'The Filipino roles are modelled in lib/event-sponsors.ts and NOTHING ' +
      'acts on them yet. It is a good line and it is not true today.',
    pattern:
      /\b(?:ninong|ninang|principal sponsor)s?\b[^.]{0,80}\b(?:credits?|shots?|allowance|allotment|more|bigger)\b/i,
    sample: 'your ninongs and ninangs get a bigger share of credits',
    stillSayable: ['Your guests become the crew'],
  },
];

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/**
 * ANTI-VACUITY. A banned-list guard dies quietly when a pattern stops matching
 * anything — this is the test that notices.
 */
test('every prohibition can still fire, and none of them cries wolf', () => {
  assert.ok(FORBIDDEN.length >= 10, 'the prohibition list lost entries');
  for (const p of FORBIDDEN) {
    assert.match(
      p.sample,
      p.pattern,
      `The pattern for "${p.id}" no longer matches its own sample. It is ` +
        `protecting nothing — repair the pattern, do not delete the entry.`,
    );
    for (const ok of p.stillSayable) {
      assert.equal(
        p.pattern.test(ok),
        false,
        `The pattern for "${p.id}" fires on a TRUE sentence: "${ok}". A guard ` +
          `that cries wolf gets skimmed past on the day it is right.`,
      );
    }
  }
});

for (const p of FORBIDDEN) {
  test(`the Papic page never claims: ${p.id}`, () => {
    for (const rel of PAPIC_PAGE_FILES) {
      const m = read(rel).match(p.pattern);
      assert.equal(
        m,
        null,
        `${rel} carries "${m?.[0]}" — ${p.why}`,
      );
    }
  });
}

/**
 * ── THE SHAPE, not the words ────────────────────────────────────────────────
 * Three structural repairs shipped on 2026-08-29 and each one can be undone by
 * an edit that looks like an improvement.
 */

test('the sixteen-row price wall cannot come back', () => {
  // The ladder was recut from three rungs to sixteen and the page went on
  // printing all of them: 1,111px, a fifth of the page, with the full price
  // list linked directly underneath it. It is a +/- dial now, and the dial
  // shows ONE rung. Mapping the list into rows is the regression.
  for (const rel of PAPIC_PAGE_FILES) {
    const src = read(rel);
    assert.equal(
      /\brungs\s*\.\s*map\s*\(/.test(src),
      false,
      `${rel} maps the rung list into rendered rows. Sixteen priced rungs is a ` +
        `fifth of the page; the dial exists so a reader meets one number.`,
    );
  }
});

test('the cost section has a heading, and the reader is told what before how much', () => {
  const src = read('app/(shell)/papic/page.tsx');

  const cost = src.indexOf('aria-label="What Papic costs"');
  assert.notEqual(cost, -1, 'the cost section lost its label');
  const costEnd = src.indexOf('</section>', cost);
  assert.ok(
    /<h2\b/.test(src.slice(cost, costEnd)),
    'The cost block has no heading. It ran headless while being the tallest ' +
      'block on the page — a wall of prices nobody had introduced.',
  );

  const ways = src.indexOf('Two ways to run it');
  assert.notEqual(ways, -1, '"Two ways to run it" is gone');
  assert.ok(
    ways < cost,
    'The cost block now comes first. Somebody is told the price before they ' +
      'are told what they would be buying.',
  );
});

test('the long feature list stays folded, and its count is derived', () => {
  // Owner, 2026-08-29, reading the page on a phone: "cut it down". Measured at
  // 375px before the cut, this list ran 4,792px of a 12,847px page — 37%, and
  // nearly six phone screens on its own.
  //
  // Folded, NOT deleted: every line is a real thing the product does, and
  // <details> keeps the content in the DOM, so it stays indexed and a reader
  // who wants the specification can still open it.
  const src = read('app/(shell)/papic/_papic-sections.tsx');

  const list = src.indexOf('EVERYTHING_ELSE.map(');
  assert.notEqual(list, -1, 'the long feature list is gone entirely');
  const openTag = src.lastIndexOf('<details', list);
  assert.notEqual(
    openTag,
    -1,
    'The long feature list is no longer folded. It was six phone screens of ' +
      'specification standing between the reader and the price.',
  );
  // and the fold must actually enclose the list
  assert.ok(
    src.indexOf('</details>', list) !== -1,
    'the <details> does not close after the list',
  );

  assert.ok(
    /\{EVERYTHING_ELSE\.length\}/.test(src),
    'The "N more" count is typed rather than derived. It is wrong the first ' +
      'time somebody adds a row, and no number on this page is hand-written.',
  );
});

test('everything it does comes AFTER the price', () => {
  // Owner, 2026-08-29: "yes after the price". Somebody deciding meets the
  // comparison, the two ways to run it and the cost first; somebody who
  // already wants it will read a long list.
  const src = read('app/(shell)/papic/page.tsx');
  const cost = src.indexOf('aria-label="What Papic costs"');
  const feat = src.indexOf('<PapicFeatures />');
  const faq = src.indexOf('aria-label="Questions about Papic"');
  assert.notEqual(feat, -1, 'the feature section is no longer mounted');
  assert.ok(
    cost < feat && feat < faq,
    'The feature list has moved back above the price. It was 37% of the page ' +
      'and everything a buyer decides on sat behind it.',
  );

  // ⚠ AND IT MUST NOT BE MOUNTED INSIDE THE COST BLOCK'S CONDITIONAL. That
  // block renders only when a price resolves and fails quiet by design, so a
  // degraded price read would silently take a third of the page with it.
  const costEnd = src.indexOf('</section>', cost);
  assert.ok(feat > costEnd, 'the feature list is mounted inside the cost conditional');
});

test('the headline is followed by the product, not by an explaining line', () => {
  // Owner, 2026-08-19, on every page in the product: "we do not need these. it
  // just eats up space." The eyebrow and the sub-paragraph came off. They creep
  // back one page at a time, because a lede always feels helpful.
  const src = read('app/(shell)/papic/page.tsx');
  const h1 = src.indexOf('<h1');
  assert.notEqual(h1, -1, 'the page lost its <h1>');

  const heroStart = src.lastIndexOf('<section', h1);
  assert.equal(
    /<p\b/.test(src.slice(heroStart, h1)),
    false,
    'There is an eyebrow above the headline.',
  );

  const afterH1 = src.indexOf('</h1>', h1) + '</h1>'.length;
  const firstImage = src.indexOf('<Image', afterH1);
  assert.notEqual(firstImage, -1, 'the hero lost its photograph');
  assert.equal(
    /<p\b/.test(src.slice(afterH1, firstImage)),
    false,
    'There is an explaining paragraph under the headline. Headline, then the ' +
      'product.',
  );
});

/**
 * ── THE CLAIM HAS TO REACH THE RENDER ───────────────────────────────────────
 * 🚨 `stillSayable` DOES NOT KEEP A TRUE SENTENCE ON THE PAGE. It only stops a
 * pattern crying wolf at one. This file's own docblock said it "pins the
 * chapters line so a later reader cannot tidy a true claim off the page" —
 * measured by execution on 2026-08-30, that is false: deleting the sentence
 * leaves every `stillSayable` test green, because nothing ever asserts the
 * sentence is there.
 *
 * It is the same defect this whole stream exists to cure — a measurement that
 * never reaches the render changes nothing — so the per-guest claim gets a real
 * assertion rather than an assumed one. The chapters line is still unpinned;
 * that belongs to whoever owns that copy, and is recorded rather than silently
 * adopted here.
 *
 * Matched on whitespace-normalised source so reflowing the JSX cannot break it.
 */
test('the per-guest claim is actually on the page', () => {
  const src = read('app/(shell)/papic/page.tsx').replace(/\s+/g, ' ');

  assert.match(
    src,
    /decide how many credits one guest may spend/i,
    'The per-guest claim is gone from the page. It was unlocked on 2026-08-30 ' +
      'by #5002 · #5017 · #5014 · #5019 — a shipped, serving feature the page ' +
      'is now allowed to sell. Do not remove it to save height; the whole ' +
      'point of the four builds was that a customer can read this.',
  );

  assert.match(
    src,
    /nothing is carved out, so whatever a guest doesn.t use is still there for everyone else/i,
    'The second half of the claim is gone, and it is the differentiator. It ' +
      'is true BY CONSTRUCTION — the ceiling carves nothing out of the pot ' +
      '(see 20271184624871: "no guest holds a wallet; unspent credits stay ' +
      'shared") — so it cannot rot unless the mechanism itself changes.',
  );
});
