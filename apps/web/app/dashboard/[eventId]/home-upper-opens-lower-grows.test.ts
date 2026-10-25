/**
 * home-upper-opens-lower-grows.test.ts — THE SPLIT (owner, 24 Oct ~16:10: *"the upper parts are the ones that open to
 * another page. the lower parts are the ones that expand."*; prototype `home_control_center_2026-10-24_fable.html`).
 *
 *   1 · UPPER widgets NEVER grow in place: no tile and no card of the control row carries a press that expands
 *       (`aria-expanded`), a settings region, or open/closed state — each is a door (a link) to its page.
 *   2 · LOWER services DO grow in place: a service's phone tile is a button that opens the card in place
 *       (`aria-expanded`, `aria-controls` → the card's settings region); the card's head grows it; the "Open … ›" door
 *       comes LAST inside it. Papic draws no phone tile (owner 2026-10-26) — its head grows it on every width.
 *   3 · ONE OPEN AT A TIME: every growing service joins `useOneOpen` (`lib/one-open.ts`), and wraps what it holds in
 *       `OneOpenScope` so a dropdown inside never closes its own card.
 *
 * SABOTAGE (seen red): an `aria-expanded` on the Guests tile (1 red) · the service tile drawn as a Link (2 red) ·
 * `useOneOpen` removed from HomeServiceCard (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { HOME_CONTROL_KEYS } from './_components/home-control-faces';
import { drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));

test('1 · no upper widget grows in place — every one is a door', () => {
  const html = drawHome();
  const row = slice(html, 'data-home-control="compact"', ['data-home-services']);
  assert.ok(row.length > 0, 'premise: the control row is drawn');
  // The only `aria-expanded` allowed is the ⓘ's own (InfoTip, "About …") — a tip, never the widget growing — and a
  // button that opens a SHEET over the page (`aria-haspopup="dialog"`): the Event Hub tile's "Pick what shows" (owner
  // 2026-10-24, "opens, in place, as a bottom sheet"). The sheet rises over Home; the tile itself never grows.
  const expanding = [...row.matchAll(/<button [^>]*aria-expanded[^>]*>/g)]
    .map((m) => m[0])
    .filter((b) => !/aria-label="About /.test(b) && !/aria-haspopup="dialog"/.test(b));
  assert.deepEqual(expanding, [], 'an upper widget expands in place');
  assert.doesNotMatch(row, /role="region"/, 'an upper widget holds a settings region');
  for (const key of HOME_CONTROL_KEYS) {
    const tile = slice(row, `data-home-tile="${key}"`, ['data-home-tile="', 'data-home-control="detail"']);
    assert.match(tile, /<a [^>]*class="hc-door"/, `compact: the ${key} tile is not a door`);
    const card = slice(row, `data-home-card-key="${key}"`, ['data-home-card-key="', 'data-home-services']);
    assert.match(card, /class="hc-card-door"/, `detail: the ${key} card is not a door`);
  }
  // The sources hold no grow state at all.
  for (const f of ['_components/home-control-row.tsx', '_components/home-tile.tsx']) {
    assert.doesNotMatch(read(f), /aria-expanded|useOneOpen|data-home-card-settings/, `${f} grows something`);
  }
});

test('2 · a service grows IN PLACE — its phone tile opens the card, its door comes last', () => {
  const card = read('_components/home-service-card.tsx');
  assert.match(
    card,
    /<button type="button" className="hc-tile hc-svc-tile" aria-expanded=\{false\} aria-controls=\{regionId\} onClick=\{\(\) => setOpen\(true\)\}>/,
    'the service tile does not grow the card in place',
  );
  assert.match(card, /role="region"[\s\S]{0,200}?data-home-card-settings=/, 'the card has no settings region to grow');
  const region = card.slice(card.indexOf('data-home-card-settings='));
  assert.ok(region.indexOf('{settings}') < region.indexOf('data-home-card-door'), 'the "Open … ›" door is not last inside the card');
  const papic = read('_components/papic-home-card.tsx');
  // 📷 Papic has no phone tile (owner 2026-10-26: one card, the head and its switch, on every width) — its HEAD grows it.
  assert.doesNotMatch(papic, /hc-svc-tile/, 'Papic has its own phone tile again');
  assert.match(papic, /<button\s+type="button"\s+aria-expanded=\{open\}\s+aria-controls=\{regionId\}\s+onClick=\{\(\) => setOpen\(\(v\) => !v\)\}/, 'the Papic head does not grow its card in place');
});

test('3 · one service open at a time', () => {
  for (const f of ['_components/home-service-card.tsx', '_components/papic-home-card.tsx']) {
    const s = read(f);
    assert.match(s, /const oneOpenId = useOneOpen\(open, setOpen\);/, `${f}: does not join one-open`);
    assert.match(s, /<OneOpenScope id=\{oneOpenId\}>/, `${f}: a dropdown inside would close its own card`);
  }
});
