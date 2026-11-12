/**
 * ONE SERVICE CARD, EVERYWHERE — every service card in the app is drawn by `app/_components/service-face.tsx`.
 *
 * Owner, 12 Nov 2026: *"service cards needs to stay and look consistent all throughout the app"*. Asked whether the
 * text-first cards on the shop page were the template: *"Something else"* — then *"Yes, build it"* on the
 * Now-beside-Proposed prototype (corpus `prototypes/service_cards_one_template_2026-11-12/`, DECISION_LOG "ONE SERVICE
 * CARD, EVERYWHERE"). Before this, three components drew three different cards: the shop page's text-first card, the
 * maker's cover card, and Find's hand-built card.
 *
 * 🔑 HOW IT DRIFTED: every surface had passed its own test while drawing its own card. So this test does not ask
 * "does the card look right" — it asks "does anyone draw a card other than the one face", across the whole app.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { includesLineOf, notIncludedWord } from '@/app/_components/service-face';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(resolve(WEB, p), 'utf8'));

const FACE = 'app/_components/service-face.tsx';
/** The adapters: they map their data into the face and draw nothing of their own. */
const ADAPTERS = [
  'app/_components/service-card-view.tsx',
  'app/vendor-dashboard/services/_components/service-card-face.tsx',
] as const;

/**
 * Files that may read a card's price AND its inclusions without drawing the face — each for a stated reason.
 * Adding a line here is a decision, not a fix: say why the surface is not a service card.
 */
const NOT_A_CARD_FACE: Record<string, string> = {
  'app/v/[slug]/_components/service-details-sheet.tsx':
    'the Service card grown — the full card the face OPENS (photos, clip, reviews, record), not a second face',
};

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
      out.push(...tsxFiles(p));
    } else if (name.endsWith('.tsx') && !/\.test\./.test(name)) {
      out.push(p);
    }
  }
  return out;
}

test('the one face exists and draws the Find card: cover left, facts beside it', () => {
  const face = src(FACE);
  assert.match(face, /export function ServiceFace\(/);
  assert.match(face, /grid-cols-\[80px_minmax\(0,1fr\)\]/, 'the face lost the Find layout (80 px cover column)');
  assert.match(face, /h-28 w-20/, 'the cover is no longer 80 × 112');
  assert.match(face, /Not included: \{notIncluded\.join\(' · '\)\}/, 'not-included is no longer ONE line');
});

test('every adapter renders the face and draws nothing of its own', () => {
  for (const rel of ADAPTERS) {
    const s = src(rel);
    assert.match(s, /<ServiceFace\b/, `${rel} no longer renders the one face`);
    // The old text-first card's tells: a photo strip, a mono price, the VIEW DETAILS link, the crew meal said twice.
    assert.doesNotMatch(s, /<Image\b|h-16 w-16/, `${rel} draws a photo strip again`);
    assert.doesNotMatch(s, /font-mono/, `${rel} draws mono text again (the card dropped monospace)`);
    assert.doesNotMatch(s, /View details\s*</, `${rel} draws its own VIEW DETAILS link again — the face is the door`);
    assert.doesNotMatch(s, /crew meal required/i, `${rel} says the crew meal twice again`);
    assert.doesNotMatch(s, /rounded-(xl|2xl) border/, `${rel} draws its own card frame again`);
  }
});

test("Find's card is drawn by the face too", () => {
  const find = src('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  const at = find.indexOf('function InlineMoreCard(');
  assert.ok(at >= 0, 'InlineMoreCard moved — point this test at it');
  const body = find.slice(at, find.indexOf('\nfunction ', at + 10));
  assert.match(body, /<ServiceFace\b/, "Find's card stopped using the one face");
  assert.doesNotMatch(body, /className="sc-price|className="sc-inc|className="sc-not/, 'Find draws its own facts again');
});

test('no surface draws a service card of its own', () => {
  // A file that reads a card's price AND its inclusions is drawing a service card. It must draw it through the face
  // (directly or through an adapter), or be listed above with the reason it is not a card face.
  const offenders: string[] = [];
  for (const abs of tsxFiles(resolve(WEB, 'app'))) {
    const rel = relative(WEB, abs);
    if (rel === FACE || NOT_A_CARD_FACE[rel]) continue;
    const s = stripComments(readFileSync(abs, 'utf8'));
    const readsPrice = /\.(priceLabel|priceText)\b/.test(s);
    const readsInclusions = /\.(inclusions|includesLine|notIncluded)\b/.test(s);
    if (!readsPrice || !readsInclusions) continue;
    if (!/\b(ServiceFace|ServiceCardView|ServiceCardFace)\b/.test(s)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `these draw a service card of their own — use ServiceFace: ${offenders.join(', ')}`);
});

test('the shop page lists every service in ONE grid, so a one-card group never strands half a row', () => {
  const gallery = src('app/v/[slug]/_components/services-gallery.tsx');
  assert.match(gallery, /data-services-one-grid/);
  assert.equal((gallery.match(/<ul\b/g) ?? []).length, 1, 'the gallery is back to one grid per group');
  assert.match(gallery, /path=\{g\.label\}/, "the group is no longer said on each card's path line");
});

test('the words: includes is one line of words, not-included says the crew meal once', () => {
  assert.equal(includesLineOf([]), null);
  assert.equal(includesLineOf(['Sound system', '4 sets']), 'Includes: Sound system · 4 sets');
  assert.equal(includesLineOf(['a', 'b', 'c', 'd'], 2), 'Includes: a · b · c +3');
  assert.doesNotMatch(includesLineOf(['Sound system'])!, /₱/);
  assert.equal(notIncludedWord('Crew meal not included'), 'crew meal');
  assert.equal(notIncludedWord('Transport: ₱1,500'), 'transport: ₱1,500');
});
