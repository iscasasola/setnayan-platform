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
 * prohibition below is on the year, and `stillSayable` pins the chapters line
 * so a later reader cannot "tidy" a true claim off the page.
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

/** A ninth prohibition is one entry. Nothing else changes. */
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
    id: 'a per-guest shot limit',
    why:
      'Not built yet — it is being built now. The page may claim it only once ' +
      'it ships. The dial’s "about N photographs from every guest" is ' +
      'arithmetic about how far a shared pot goes, which is a different claim.',
    pattern:
      /\bper[- ]guest\s+(?:limit|cap|allowance|allotment)\b|\beach guest (?:gets|has|holds)\s+\d+|\b\d+\s+(?:shots?|photos?|photographs?|credits?)\s+(?:each|apiece)\b|\bcamera that holds\s+\S+\s+shots?\b/i,
    sample: 'Hand every guest a camera that holds twelve shots',
    stillSayable: [
      'That is about 15 photographs from every guest.',
      'Enough for every one of 200 guests to take about 15 photographs.',
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
  assert.ok(FORBIDDEN.length >= 9, 'the prohibition list lost entries');
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
