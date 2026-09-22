/**
 * the-page-says-what-is-true.test.ts — CTRL-B3 builds 3, 8 and 11.
 *
 * Three ways a live page said something the product could not back:
 *   · a shipped host control with no door anywhere in the app;
 *   · a download page that contradicted itself about Apple notarization;
 *   · a review promise — "24 hours after the event" — that nothing kept, on
 *     every shop page, with a number the code has never used.
 *
 * 🪤 EVERY ASSERTION HERE READS STRIPPED SOURCE. Four guards earlier in this
 * work convicted their own documentation, because a comment saying *"this used
 * to promise 24 hours"* is the opposite of the defect and must not read as it.
 *
 * 🛡 Mutation-checked; each sabotage verified to apply before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

const REVIEW_SURFACES = [
  'app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx',
  'app/v/[slug]/page.tsx',
];

// ── BUILD 11 ───────────────────────────────────────────────────────────────

// SABOTAGE: restore "24 hours after the event" on either surface → RED.
// SABOTAGE: write "7 days" by hand instead → RED.
test('no shop surface promises a review interval the code does not compute', () => {
  for (const f of REVIEW_SURFACES) {
    const src = readCode(f);
    assert.equal(
      count(src, /review request \d+ hours/i),
      0,
      `${f}: promised a review request on a clock the code has never used — reviewState computes 7 and 30 DAYS, and nothing generated a request at all`,
    );
    // 🔑 THE PROPERTY IS "NO HAND-TYPED DURATION", not "not the words 24 hours".
    // A reword to "a day after" or "7 days after" makes the identical promise
    // and would pass a phrasing ban.
    assert.equal(
      count(src, /A review opens once[^.]{0,120}\b\d+\s*(hour|day|week)/i),
      0,
      `${f}: a hand-typed duration is exactly how this drifted to 24 hours; the sentence names the STEPS instead`,
    );
    assert.match(
      src,
      /A review opens once/,
      `${f}: must still say what actually opens a review`,
    );
  }
});

// ── BUILD 8 ────────────────────────────────────────────────────────────────

// SABOTAGE: make the Value card's body an unconditional string again → RED.
test('the download page cannot claim notarization while saying it is not notarized', () => {
  const src = readCode('app/download/page.tsx');
  assert.equal(
    count(src, /body="Signed with an Apple Developer ID and notarized by Apple/),
    0,
    'the hero branches on mac.signed and says "Not yet notarized" — an unconditional card beside it told the same visitor the opposite, louder',
  );
  // ⚠ UPDATED 2026-09-22 (register DSK-6). This asserted the literal
  // `mac?.signed`, because that is what the hero read when BUILD 8 was written.
  // It no longer does: `stapler`/`spctl` on the live build proved signed and
  // notarized are DIFFERENT facts — signed ✓, notarized ✗ — so the hero was
  // repointed at `mac.notarized` and the card followed it.
  //
  // 🔑 The PROPERTY this test states has never changed: "the card must be gated
  // on the SAME fact the hero reads." Pinning the literal made it fail when the
  // page got MORE correct. So it now derives the hero's fact and requires the
  // card to match, which is strictly stronger — it would also catch the two
  // drifting apart in a direction nobody has thought of yet.
  const heroFact = /\{mac\.(signed|notarized) \?/.exec(src)?.[1];
  assert.ok(heroFact, 'could not find the hero branch — has the download page been restructured?');
  const cardFact = /mac\?\.(signed|notarized)\s*\n?\s*\?/.exec(src)?.[1];
  assert.ok(cardFact, 'could not find the Value card branch');
  assert.equal(
    cardFact,
    heroFact,
    `the hero reads mac.${heroFact} and the card reads mac?.${cardFact} — a copy of the condition ` +
      'is a second place for the page to disagree with itself',
  );
  assert.match(
    src,
    new RegExp(`mac\\?\\.${heroFact}[\\s\\S]{0,400}not Apple-notarized yet`),
    'the card must still carry the honest branch beside the claim',
  );
});

// ── BUILD 3 ────────────────────────────────────────────────────────────────

// SABOTAGE: remove the stories entry from the controller's list → RED.
test('every shipped host control has a door — including the one that never had one', () => {
  const launch = readCode('app/dashboard/[eventId]/launch/page.tsx');
  assert.equal(
    count(launch, /\$\{base\}\/website\/stories/),
    1,
    '/website/stories is the host choosing which supplier stories appear on their celebration (owner 2026-08-15) and had NO link from anywhere in the app — only its own actions.ts and two tests named the path',
  );
  // The siblings the controller already owns, so a refactor that drops the list
  // fails here rather than orphaning four pages at once.
  for (const child of ['website/editor', 'website/our-story', 'website/stories']) {
    assert.ok(
      launch.includes(child),
      `${child} lost its door — the comment on this list records two pages that were nearly orphaned the same way`,
    );
  }
});
