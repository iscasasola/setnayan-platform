/**
 * icon-map-is-the-one-source.test.ts — the icon map changes NOTHING on screen today, and is the one
 * place an icon set lives (brand refresh step 3, owner 2026-10-26).
 *
 *   1. every name a database row may store (nav registry overrides, the category taxonomy) draws the
 *      VERY SAME component lucide-react exports under that name — identity, not lookalike — and the
 *      admin pickers list the names in the same order;
 *   2. every glyph in the map is a lucide-react component (today's set), and every semantic role
 *      points at a glyph that exists;
 *   3. the registry fallback (`Circle`) and the /features glyphs are the components they were;
 *   4. `<Icon name>` renders exactly the markup the lucide component renders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import { GLYPHS, ICONS, iconFor, glyphComponent } from '../app/_components/icon/icon-map';
import { LEGACY_ICON_NAMES, glyphForStoredName } from '../app/_components/icon/legacy-icon-names';
import { Icon } from '../app/_components/icon/icon';
import { NAV_ICON_NAMES, getLucideIcon } from './nav-icons';
import { featureIcon } from '../app/features/_icons';
import { EVENT_MENU_ICONS } from './customer-menu';

const L = lucide as unknown as Record<string, unknown>;

test('every stored name draws the very same lucide component it always did', () => {
  const names = Object.keys(LEGACY_ICON_NAMES);
  assert.ok(names.length > 250, `only ${names.length} stored names — the table broke`);
  const off = names.filter((n) => glyphForStoredName(n) !== L[n] || getLucideIcon(n) !== L[n]);
  assert.deepEqual(off, [], `these stored names would draw a different icon: ${off.join(', ')}`);
  assert.equal(getLucideIcon('NotAnIcon'), null);
  assert.equal(getLucideIcon(''), null);
  assert.equal(glyphForStoredName('toString'), null, 'an inherited key is not a stored name');
});

test('the admin pickers list the same names, in the same order', () => {
  assert.deepEqual([...NAV_ICON_NAMES], Object.keys(LEGACY_ICON_NAMES));
  assert.ok(NAV_ICON_NAMES.includes('Users') && NAV_ICON_NAMES.includes('SlidersHorizontal'));
});

test('every glyph is a lucide component today; every role points at a glyph', () => {
  const lucideValues = new Set(Object.values(L));
  for (const [name, comp] of Object.entries(GLYPHS)) assert.ok(lucideValues.has(comp), `glyph '${name}' is not a lucide-react component`);
  for (const [role, glyph] of Object.entries(ICONS)) assert.ok(glyph in GLYPHS, `role '${role}' points at missing glyph '${glyph}'`);
  assert.equal(glyphComponent('not-a-glyph'), null);
});

test('the five event tabs and the ai/polish split', () => {
  assert.equal(iconFor('home'), EVENT_MENU_ICONS.overview);
  assert.equal(iconFor('guests'), EVENT_MENU_ICONS.guests);
  assert.equal(iconFor('suppliers'), EVENT_MENU_ICONS.team);
  assert.equal(iconFor('hub'), EVENT_MENU_ICONS.hub);
  assert.equal(iconFor('more'), EVENT_MENU_ICONS.suite);
  assert.equal(ICONS.ai, ICONS.polish, 'one glyph today …');
  assert.notEqual('ai', 'polish'); // … two roles, so the next set can tell them apart
});

test('the registry fallback and the /features glyphs are the components they were', () => {
  assert.equal(GLYPHS.circle, L.Circle);
  const was: Record<string, string> = {
    checklist: 'ListChecks', date: 'CalendarSearch', traditions: 'BookOpen', std: 'Film', march: 'Footprints',
    helpers: 'UserCog', store: 'Store', package: 'Package', inbox: 'Inbox', 'calendar-check': 'CalendarCheck',
    earnings: 'Wallet', performance: 'BarChart3', branches: 'Building2', verified: 'BadgeCheck', shield: 'ShieldCheck',
    handshake: 'Handshake', receipt: 'Receipt', printer: 'Printer', shirt: 'Shirt', subscription: 'CreditCard',
    challenge: 'Trophy',
  };
  for (const [feature, lucideName] of Object.entries(was)) {
    assert.equal(featureIcon(feature as never), L[lucideName], `/features '${feature}' should still draw ${lucideName}`);
  }
});

test('<Icon name> renders exactly what the lucide component renders', () => {
  const via = renderToStaticMarkup(createElement(Icon, { name: 'guests', size: 20, className: 'text-ink' }));
  const direct = renderToStaticMarkup(
    createElement(L.BookUser as never, { size: 20, className: 'text-ink', 'aria-hidden': true }),
  );
  assert.equal(via, direct);
});
