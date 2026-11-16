/**
 * SHOP-02 v7 (owner-approved 14 Nov 2026 · prototype "Check A Date Seats") — Check a date rises over the shop and reads
 * like a cinema seat plan. Each test is one promise of the approved design.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dayShines, heatTierOfDay } from '@/lib/hot-date';
import { datesSheetHref } from '@/lib/check-a-date';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CAL = code('app/v/[slug]/dates/_components/check-a-date-calendar.tsx');
const SEATS = code('app/v/[slug]/dates/_components/seat-months.tsx');
const CSS = readFileSync(join(WEB, 'app/v/[slug]/dates/_components/seat-months.module.css'), 'utf8');
const GLOBALS = readFileSync(join(WEB, 'app/globals.css'), 'utf8');

test('a popular day is the SHIPPED hot-date rule (In demand · Hottest), read as a local calendar day', () => {
  assert.equal(dayShines('2026-12-12'), true, 'Saturday 12·12 in December shines');
  assert.equal(dayShines('2027-02-14'), true, "Valentine's shines");
  assert.equal(dayShines('2026-07-08'), false, 'an ordinary July Wednesday stays plain');
  assert.equal(heatTierOfDay('2026-12-12'), 4, 'never read through UTC (the 11th west of Greenwich)');
  assert.match(code('app/onboarding/_shared/date-calendar.tsx'), /export \{ heatTier \} from '@\/lib\/hot-date';/, 'the setup calendar uses the same rule, moved not copied');
});

test('green you can ask · grey striped you cannot · popular stays green, with ✦ — never colour alone', () => {
  assert.match(SEATS, /state === 'not_bookable' \? s\.off : ''/);
  assert.match(SEATS, /const pop = state === 'available' && dayShines\(day\);/, 'only an AVAILABLE day may shine');
  assert.match(SEATS, /'not bookable' : pop \? 'available, popular' : 'available'/, 'what a screen reader hears');
  assert.match(SEATS, /✦/);
  assert.match(CSS, /\.off \{[^}]*repeating-linear-gradient/s, 'a closed day is striped, not only grey');
});

test('every seat colour is a token, and the green is the SAME in both themes (owner ruling)', () => {
  assert.doesNotMatch(CSS, /#[0-9a-f]{3,8}\b/i, 'a hex colour in the seat stylesheet — colours live in the token file only');
  // Exactly two definitions each, light first then the `html.dark` one (globals.css "🎟 SHOP-02").
  const tops = [...GLOBALS.matchAll(/--seat-top: (#[0-9A-F]{6});/g)].map((m) => m[1]);
  const shines = [...GLOBALS.matchAll(/--seat-shine: ([\d.]+);/g)].map((m) => m[1]);
  assert.deepEqual(tops, ['#B4E5AE', '#B4E5AE'], 'dark mode keeps the same green');
  assert.deepEqual(shines, ['0.60', '0.14'], 'only the shine changes');
  const darkAt = GLOBALS.indexOf('--seat-shine: 0.14;');
  assert.ok(GLOBALS.lastIndexOf('html.dark {', darkAt) > GLOBALS.lastIndexOf(':root {', darkAt), 'the 0.14 shine is not inside html.dark');
});

test('reduced motion: the light stops as a still band, the months move without a glide', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.months \{ scroll-behavior: auto; \}[\s\S]*?animation: none;/);
});

test('it rises OVER the shop: × is the one way out ("See the shop" goes), and the header shows the logo', () => {
  assert.doesNotMatch(CAL, /See the shop/);
  assert.match(CAL, /aria-label="Close"/);
  assert.match(CAL, /\{logoUrl \? \(/, 'the logo, initials only when there is none');
  assert.match(CAL, /<SeatMonths/);
});

test('a tapped green day lists the shop\'s services at once, the ones that can take it FIRST', () => {
  assert.match(CAL, /\[\.\.\.services\]\.sort\(\(a, b\) => Number\(serviceOpen\(b\.serviceId, day\)\) - Number\(serviceOpen\(a\.serviceId, day\)\)\)/);
  assert.match(CAL, /note=\{open \? s\.price \|\| undefined : 'Not bookable that day'\}/, 'a card that cannot take the day says so — never why');
  assert.match(CAL, /label="Ask about this date" onClick=\{\(\) => setStep\('event'\)\}/, 'Ask goes straight to "For which event?"');
  assert.doesNotMatch(CAL, /step === 'services'/, 'the separate services step is gone');
});

test('the printed QR address opens the shop with the sheet up, keeping the day, services, step and arrival', () => {
  assert.equal(datesSheetHref('tita', {}), '/tita?dates=1');
  assert.equal(
    datesSheetHref('tita', { d: '2026-11-22', s: 'a,b', step: 'event', src: 'own' }),
    '/tita?src=own&dates=1&d=2026-11-22&s=a%2Cb&step=event',
  );
  assert.equal(datesSheetHref('tita', { d: 'not-a-day' }), '/tita?dates=1', 'a malformed day is dropped');
});
