/**
 * THEIR WEDDING ON YOUR HOME SCREEN — owner, 2026-09-20: teach a guest on a
 * phone to save the invitation as an icon, "so they can access it anytime".
 *
 * The two ways this ships broken, both executed here:
 *   1. the tile opens OUR app instead of their invitation (start_url/scope);
 *   2. iOS gets an SVG it cannot use, and the guest gets a grey tile.
 *
 * (A third — "an already-installed guest is taught to install again" — went
 * with the on-page teaching card itself, 2026-09-30: the owner removed it from
 * the Event Hub. See the-event-hub-has-no-home-screen-card.test.ts.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_ICON_BG,
  buildEventIconSvg,
  buildEventManifest,
  eventShortcutMetadata,
  homeScreenLabel,
  iconInitials,
  safeHex,
  unwrapMark,
} from './event-app-icon';

const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 436 560"><g><path d="M129 60.5L129 70.5Z"/></g></svg>';

test('the installed tile opens THEIR invitation, not our app', () => {
  const m = buildEventManifest({ slug: 'cale-ice', displayName: 'Cale & Ice', eventDate: '2026-12-18' });
  assert.equal(m.start_url, '/cale-ice');
  assert.equal(m.scope, '/cale-ice', 'and stays inside it');
  assert.equal(m.name, 'Cale & Ice');
  assert.notEqual(m.name, 'Setnayan');
});

test('the label under the icon is short enough to survive a home screen', () => {
  const m = buildEventManifest({ slug: 'x', displayName: 'Maria Angelica & Jose Antonio' });
  assert.ok(String(m.short_name).length <= 12, `${m.short_name}`);
});

test('iOS is served a PNG and Android an SVG — from the same drawing', () => {
  const m = buildEventManifest({ slug: 'cale-ice', displayName: 'Cale & Ice' });
  const icons = m.icons as { src: string; type: string; purpose?: string }[];
  assert.ok(icons.some((i) => i.type === 'image/png'), 'a PNG exists for iOS');
  assert.ok(icons.some((i) => i.purpose === 'maskable'), 'Android can mask it without losing the mark');
  for (const i of icons) assert.match(i.src, /^\/cale-ice\/icon\//, i.src);
});

test('the couple’s own mark is placed whole, through its own viewBox', () => {
  const svg = buildEventIconSvg({ markSvg: MARK, background: '#EFE6D6', size: 512 });
  assert.match(svg, /viewBox="0 0 436 560"/, 'the mark keeps its own coordinate space');
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/, 'so a portrait mark is not squashed');
  assert.match(svg, /<rect width="512" height="512" fill="#EFE6D6"\/>/);
  assert.doesNotMatch(svg, /<text/, 'with a mark, no initials');
});

test('a couple with no mark still gets an icon, never an empty tile', () => {
  const svg = buildEventIconSvg({ markSvg: null, initials: 'C&I', size: 192 });
  assert.match(svg, /<text/);
  assert.match(svg, />CI</, 'the joiner is not an initial — "C&I" must not render as "C&"');
  assert.doesNotMatch(svg, /&(?!amp;|lt;|gt;)/, 'and nothing unescaped reaches the XML');
  assert.equal(iconInitials('maria jose'), 'MA');
  assert.equal(iconInitials('C&I'), 'CI');
  assert.equal(iconInitials(''), 'S');
});

test('a malformed or wrapper-less mark falls back instead of producing broken XML', () => {
  assert.equal(unwrapMark('not svg at all'), null);
  assert.equal(unwrapMark('<svg></svg>'), null, 'empty');
  assert.equal(unwrapMark('<svg viewBox="bad"><path/></svg>'), null, 'an unusable viewBox');
  const svg = buildEventIconSvg({ markSvg: '<svg><path d="M0 0"/></svg>', initials: 'AB' });
  assert.match(svg, /<text/, 'no viewBox → the initials, not a mark drawn at the wrong scale');
});

test('a bad colour never reaches the markup', () => {
  assert.equal(safeHex('#842334', DEFAULT_ICON_BG), '#842334');
  assert.equal(safeHex('red', DEFAULT_ICON_BG), DEFAULT_ICON_BG);
  assert.equal(safeHex('"><script>', DEFAULT_ICON_BG), DEFAULT_ICON_BG);
  assert.equal(safeHex(null, DEFAULT_ICON_BG), DEFAULT_ICON_BG);
});

test('both public routes ask the visibility question themselves', () => {
  const source = readFileSync(join(__dirname, '..', 'app', '[slug]', '_lib', 'icon-source.ts'), 'utf8');
  assert.match(source, /canViewSlugEvent\(/, 'a private wedding’s mark is not public');
  assert.match(source, /createAdminClient/, 'precondition: it reads past RLS, which is why it must ask');
  for (const rel of [
    ['app', '[slug]', 'manifest.webmanifest', 'route.ts'],
    ['app', '[slug]', 'icon', '[spec]', 'route.ts'],
  ]) {
    const src = readFileSync(join(__dirname, '..', ...rel), 'utf8');
    assert.match(src, /loadEventIconSource\(/, `${rel.join('/')} goes through the gated loader`);
    assert.match(src, /status: 404/, `${rel.join('/')} 404s rather than rendering a placeholder`);
  }
});

test('the icon route is not an open image resizer', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', 'icon', '[spec]', 'route.ts'), 'utf8');
  assert.match(src, /const SIZES = new Set\(\[/, 'sizes come from a list');
  assert.match(src, /SIZES\.has\(size\)/, 'and anything else is refused');
  assert.match(src, /\^\(\\d\{2,4\}\)\\\.\(svg\|png\)\$/, 'the spec is parsed, not trusted');
});

test('the invitation names the manifest AND the apple icon — iOS ignores the manifest', () => {
  // ONE copy (`eventShortcutMetadata`), worn by the Event Hub and by the
  // thank-you that carries the "Keep it handy" line (owner 2026-10-03).
  const meta = eventShortcutMetadata('cale-ice', 'Cale & Ice');
  assert.equal(meta.manifest, '/cale-ice/manifest.webmanifest', 'the tile does not open THAT event');
  assert.ok(meta.icons.apple.length > 0, 'without this iOS falls back to a screenshot of the page');
  assert.equal(meta.icons.apple[0]!.url, '/cale-ice/icon/180.png', 'the size iOS actually asks for first');
  assert.equal(meta.appleWebApp.title, 'Cale & Ice', 'the label is the couple, not "Setnayan"');
  const page = readFileSync(join(__dirname, '..', 'app', '[slug]', 'page.tsx'), 'utf8');
  assert.match(page, /\.\.\.eventShortcutMetadata\(slug, event\.display_name\),/, 'the Event Hub names its tile some other way');
});

test('the home-screen label is a word, not a cut — seen in prod as "Indalecio & "', () => {
  // The real event, the real defect.
  assert.equal(homeScreenLabel('Indalecio & Claire'), 'Indalecio');
  assert.equal(buildEventManifest({ slug: 'x', displayName: 'Indalecio & Claire' }).short_name, 'Indalecio');

  assert.equal(homeScreenLabel('Cale & Ice'), 'Cale & Ice', 'a short name is left whole');
  assert.equal(homeScreenLabel('Maria and Jose'), 'Maria', 'the word "and" separates too');
  assert.equal(homeScreenLabel('Bartholomew Fitzgerald III'), 'Bartholomew', 'no partner, still a word');
  assert.equal(homeScreenLabel(''), 'Invitation', 'never empty under an icon');
  for (const raw of ['Indalecio & Claire', 'A & B & C', 'Maria, Jose, and everyone else']) {
    const label = homeScreenLabel(raw);
    assert.ok(label.length <= 12, `${label} fits`);
    assert.doesNotMatch(label, /[\s&+,.·-]$/, `${label} does not trail on punctuation`);
  }
});
