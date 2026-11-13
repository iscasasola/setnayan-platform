/**
 * GUARD — THE PER-GUEST SUPPLIER ROW GREYS, NEVER HIDES (owner 2026-11-13).
 * Owner, verbatim: "do not hide it. just grey it out until there is an available pax related booked supplier" ·
 * "same on guest card". Both places draw a greyed, unpressable row while no supplier is priced per head, and a
 * refused read says "Couldn't load" — never "none yet" (a failure must not render as emptiness).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const G = join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'guests');
const read = (p: string) => stripComments(readFileSync(join(G, p), 'utf8'));

test('Show & sort always draws the pax topic; with no service it is greyed, and a refusal says so', () => {
  const screen = read('_components/guests-screen.tsx');
  assert.match(screen, /pax=\{\{\s*services: paxServices,\s*refused: paxRefused,/, 'pax is always handed to the sheet');
  assert.doesNotMatch(screen, /paxServices\.length > 0\s*\?/, 'the pax topic is not gated on having services');
  const panel = read('_components/guests-filter-panel.tsx');
  assert.match(panel, /pax\.services\.length === 0 \?[\s\S]{0,200}aria-disabled="true"[\s\S]{0,120}opacity-50/);
  assert.match(panel, /pax\.refused \? PAX_REFUSED_LINE : PAX_NONE_LINE/);
  assert.match(read('page.tsx'), /paxRefused=\{!notCountedList\}/);
});

test('the guest card draws a greyed "Not counted for" that posts nothing while no service is per head', () => {
  const card = read('_components/guest-card-body.tsx');
  const greyed = card.match(/data-card-not-counted-none=""[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.ok(greyed, 'the greyed row exists');
  assert.match(card, /aria-disabled="true" className="pointer-events-none[^"]*opacity-50[^"]*" data-card-not-counted-none=""/);
  assert.match(greyed, /name="not_counted_unavailable"/, 'a decoy name, never the real field');
  assert.doesNotMatch(greyed, /NOT_COUNTED_POSTED|NOT_COUNTED_FIELD/, 'the greyed row can never save');
  assert.match(greyed, /Couldn’t load your suppliers/, 'a refused read is said as such');
});
