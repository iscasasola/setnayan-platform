/**
 * home-numbers-count.test.ts — H2 of the Home redraw (owner 2026-10-07:
 * *"all numbers on the app will animate going to that number … upon load or
 * change"*, BUTTON_RULE rule 2/3; Maker PR 4e).
 *
 * RE-AIMED 2026-10-24 (the control row, owner-approved `home_control_center_2026-10-24_fable.html`): every figure of
 * every widget face — days to go · coming · no reply · not invited · can't come · booked · % done · each payment ·
 * owing — and the cards' Paid / Still owing / % paid render through the shared `Count` (`components/count.tsx`, #6400) —
 * the ONE engine, keyed by a stable id so a re-render does not replay and only a
 * real change moves. Rendered here: each figure carries its `data-count` id and
 * the final value (SSR prints the value, so a phone with JS off still reads true).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl } from '@/lib/home-control-fixture';
import { homeControlTiles } from './_components/home-control-faces';
import { count, drawHome, loadHome } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));

test('every numeric face, and the cards’ money, render through Count — each with its id and its true value', () => {
  const html = draw();
  const value = (id: string) => html.match(new RegExp(`data-count="${id}"[^>]*>([^<]*)<`))?.[1] ?? null;
  assert.equal(value('home-count'), '51', 'days to go');
  // 🌐 23 Nov 2026 (owner, v5 drawing in the website look): the board's cards are the ONE copy of the widgets at every
  // width, and they count under their own ids (`-board`, components/count.tsx plays once per id).
  assert.equal(value('home-guests-coming-board'), '96');
  assert.equal(value('home-guests-noreply-board'), '35');
  assert.equal(value('home-guests-declined-board'), '4');
  assert.equal(value('home-paid-board'), '₱120,450');
  assert.equal(value('home-owing-board'), '₱44,550');
  assert.equal(value('home-paid-pct-board'), '73%');
  // 🎴 The late ₱8,000 is Now's (Home redraw 2026-11-02, "Now never repeats below") — the next payment row counts.
  assert.equal(value('home-pay-li-2-board'), '₱22,275', 'a payment row’s amount does not count');
  // Every face that HAS a number counts it; the words-only faces ("Couldn't load", "Invitation") do not. Only the
  // Schedule is still drawn as a tile (its faces); every other widget states its figures on its board card (above).
  const { tiles } = homeControlTiles(fixtureControl('e1'));
  for (const t of tiles) for (const f of t.faces) {
    if (/^[₱+\d]/.test(f.big) && f.id !== 'pay-more') assert.ok(f.count, `${t.key}/${f.id}: "${f.big}" is a number that does not count`);
    if (f.count && t.key === 'sched') assert.equal(count(html, `data-count="home-${f.id}"`) >= 1, true, `${t.key}/${f.id}: not drawn through Count`);
  }
});
function draw(): string {
  return drawHome();
}

test('the share paid is stated, counted, and true', () => {
  // 🌐 23 Nov 2026 (owner, v5 drawing): the Budget's paid bar is gone — the share paid is a word on the section's one
  // fine line ("Paid ₱… · still owing ₱… · 25% paid of ₱… agreed"), drawn through Count with its true value.
  const html = drawHome({ control: fixtureControl('e1', { budget: { paidPhp: 250_000, owingPhp: 750_000, pays: [] } }) });
  assert.match(html, /data-count="home-paid-pct-board"[^>]*>25%</, 'the Budget card does not state 25% paid');
  assert.match(html, /data-home-money=""[\s\S]*?25%<\/span> paid of ₱1,000,000 agreed/, 'the share paid is not said against what was agreed');
});

test('the Home takes Count from the ONE shared engine — no second counter', () => {
  for (const f of ['_components/home-tile.tsx', '_components/home-control-row.tsx']) {
    assert.match(src(f), /import \{ Count \} from '@\/components\/count';/, `${f}: not counting through Count`);
  }
  // The faces' own ticker (rotation) is the ONE requestAnimationFrame on Home, and it moves faces, never a number.
  const tile = src('_components/home-tile.tsx');
  assert.equal(tile.split('requestAnimationFrame').length - 1, 2, 'a second animation loop in the tile');
  assert.doesNotMatch(src('_components/home-first-screen.tsx') + src('_components/home-parts.tsx') + src('_components/home-control-row.tsx'), /requestAnimationFrame|setInterval/, 'a second animation engine on Home');
});

test('a word ("No date yet", "Couldn’t load") is printed, not counted', () => {
  const html = drawHome({ control: fixtureControl('e1', { countdown: { value: '—', label: 'days to go', days: null, hasDate: false, long: null, placeLine: null } }) });
  assert.equal(count(html, 'data-count="home-count"'), 0);
  assert.match(html, />No date yet</);
});
