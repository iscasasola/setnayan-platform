/**
 * the-today-wears-the-website-look.test.ts — 🔒 THE COUPLE'S TODAY IN THE WEBSITE'S LOOK (owner 23 Nov 2026: *"we want
 * it to be the same design template as our website"* → *"Yes, approve"* on the v5 redraw; specs DECISION_LOG "EVENT
 * SERVICES v5 (WEBSITE TEMPLATE) APPROVED, WITH THE TODAY DOOR", drawing
 * `prototypes/buy_event_services_one_place_2026-11-23/strip-v5-today.jpg`; HOUSE_DESIGN_STANDARD Part H).
 *
 *   1 · the sheet is Today's alone: scoped to `[data-home-first-screen]`, loaded by the event layout (and the lab), made
 *       of existing tokens only — no hex, no rgb() literal, no raw timing;
 *   2 · a white page and no peach band: the card's colour ground sits on the page;
 *   3 · the rows carry no tint and no coloured edge; the level is an OUTLINED word in the line, still said in words;
 *   4 · ONE terracotta: every button in the sections and rows is a quiet pill; the strip's is the main one;
 *   5 · the sections' heads say "See all" and the widgets are the board's one copy at every width.
 *
 * SABOTAGE (each seen red once, 23 Nov, then restored): the `:has([data-home-first-screen])` page rule removed (2) ·
 * the tint style put back on the row (3) · `et-tag` dropped from the level word (3) · the quiet-pill rule's selector
 * narrowed to `[data-home-control]` only (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl } from '@/lib/home-control-fixture';
import { count, drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (...rel: string[]) => readFileSync(join(WEB, ...rel), 'utf8');
const SHEET_PATH = ['app', 'dashboard', '[eventId]', '_components', 'today-website.css'] as const;
const sheet = () => stripComments(read(...SHEET_PATH));

test('1 · the sheet is Today’s alone, loaded where Today draws, and made of tokens', () => {
  const css = sheet();
  for (const rule of css.split('}').map((r) => r.trim()).filter(Boolean)) {
    const selector = rule.slice(0, rule.indexOf('{')).trim();
    assert.match(selector, /\[data-home-first-screen\]/, `a rule reaches past Today: ${selector}`);
  }
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'a typed hex colour');
  assert.doesNotMatch(css, /\brgba?\(\s*\d/, 'a typed rgb() colour');
  assert.doesNotMatch(css, /\b\d+ms\b|cubic-bezier|transition|animation/, 'Today’s look grew a motion of its own');
  assert.match(stripComments(read('app', 'dashboard', '[eventId]', 'layout.tsx')), /import '\.\/_components\/today-website\.css';/, 'the event layout does not load the sheet');
  assert.match(stripComments(read('app', 'dev', 'home-lab', 'page.lab.tsx')), /today-website\.css'/, 'the lab no longer shows what the page shows');
  assert.doesNotMatch(read('app', 'globals.css'), /today-website/, 'the sheet was folded into the global stylesheet');
});

test('2 · a white page and no peach band', () => {
  const css = sheet();
  assert.match(css, /html:not\(\.dark\):has\(\[data-home-first-screen\]\)\s*\{\s*--sn-page-bg: var\(--color-raised\);/, 'Today’s page is not white');
  assert.match(css, /\[data-home-first-screen\] \.hc-ecard-plain \{\s*background: rgb\(var\(--sn-page-bg\)\);/, 'the peach band is back under the card');
  const html = drawHome();
  assert.match(slice(html, 'data-home-cover', ['data-home-column']), /class="hc-ecard-kick /, 'the card’s kicker lost its hook');
});

test('3 · rows carry no tint and no edge; the level is an outlined word, still said', () => {
  const list = stripComments(read('app', 'dashboard', '[eventId]', '_components', 'event-today-list.tsx'));
  assert.doesNotMatch(list, /--sn-danger-soft|--sn-warning-soft|borderLeft/, 'a row is tinted or edged again');
  assert.match(list, /<span data-event-today-level=\{u\.level\} className="et-tag">/, 'the level word is not the outlined tag');
  assert.match(sheet(), /\.et-tag \{[^}]*border: 1px solid currentColor/, 'the tag is not outlined');
  const c = fixtureControl('e1');
  const html = drawHome({ control: c });
  const row = slice(html, 'data-event-today-row="pay:li-2"', ['data-event-today-row="']);
  assert.match(row, /class="et-tag">Soon</, 'an amber row does not wear its word as a tag');
  assert.match(row.replace(/<[^>]+>/g, ''), /Soon · ₱22,275/, 'a reader no longer hears the level and the line as one sentence');
});

test('4 · ONE terracotta: every section and row button is a quiet pill; the strip keeps the main one', () => {
  assert.match(
    sheet(),
    /\[data-home-first-screen\] :is\(\[data-home-control\], \[data-event-today\], \[data-home-services\]\) :is\(button, a\)\.ab\.ab\.ab\.ab \{[^}]*border: 1px solid var\(--web-line\);[^}]*background: transparent;/,
    'the quiet pill does not reach every section and row',
  );
  const html = drawHome();
  const strip = slice(html, 'data-home-today=', ['</div>']);
  assert.match(strip, /ab-main/, 'the strip lost its one main button');
});

test('5 · section heads say See all, and the widgets are drawn once', () => {
  const html = drawHome();
  for (const k of ['guests', 'budget', 'sup', 'hub']) {
    const card = slice(html, `data-home-card-key="${k}"`, ['data-home-card-key="', 'data-home-tile="']);
    assert.match(card, /<span aria-hidden="true" class="hc-see-all">See all</, `${k}: the head does not say See all`);
  }
  assert.equal(count(html, 'data-home-control="compact"') + count(html, 'data-home-control="detail"'), 0, 'a second copy of the widgets is back');
  assert.equal(count(html, 'data-home-card-key="guests"'), 1, 'Guests is drawn more than once');
});
