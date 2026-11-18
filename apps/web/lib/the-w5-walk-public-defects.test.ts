/**
 * W5 walk of the public site, signed out, live fbd1fae (2026-11-18) — defects B2 · B4 · B5 stay fixed.
 * (B3, the hydration mismatch, has its own block at the end of this file.)
 *
 * SABOTAGE: put any min-height back under 44, bring back "celebrated" / "black-tie celebrations", or give the shop
 * or profile page a title that carries "Setnayan" itself (the root layout's template adds it) → RED, each assertion
 * names its control.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { ruleBody } from './press-reach';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── B2 · presses under 44 at 390 px ─────────────────────────────────────────────────────────────────────────────────
const floorOf = (css: string, sel: string): number => {
  const body = ruleBody(css, sel);
  assert.ok(body, `${sel} is gone`);
  return Number(body!.match(/(?:^|[;\s])min-height:\s*(\d+)px/)?.[1] ?? 0);
};

test('B2 · the standalone public links and the header Sign in are a 44px BOX, not a halo a box audit cannot see', () => {
  const door = read('app/_components/frontdoor/front-door.css');
  const landing = read('app/_components/frontdoor/front-door-landing.css');
  const reskin = read('app/_components/home/home-reskin.css');
  const cases: [string, string, string][] = [
    [door, '.fd-smallprint a', 'sidebar Company / Legal links (32)'],
    [landing, '.fd .fl-more', '"See the Event Hub Maker" · "All features…" · "Open a shop — free" (23)'],
    [landing, '.fd .fl-foot a', 'the front-page footer links (20)'],
    [reskin, '.home-reskin .hr-nav .hr-signin', 'header Sign in (36)'],
    [reskin, '.home-reskin .hr-foot-base a', 'footer DPO address (20)'],
    [reskin, '.home-reskin-ov .hr-si-remember', 'login "Stay signed in" label (the checkbox presses through it)'],
    [reskin, '.home-reskin-ov .hr-si-row .hr-si-link', 'login "Forgot password?" (19)'],
  ];
  for (const [css, sel, what] of cases) assert.ok(floorOf(css, sel) >= 44, `${what}: ${sel} min-height is under 44`);
});

test('B2 · the footer links of a wrapped row no longer share an overlapping invisible halo', () => {
  const landing = read('app/_components/frontdoor/front-door-landing.css');
  assert.equal(ruleBody(landing, '.fd .fl-foot a::after'), null, 'the -14px halo is back: two wrapped rows 6px apart overlap it');
});

// ── B4 · "event", never "celebration" ───────────────────────────────────────────────────────────────────────────────
test('B4 · no /start card tagline says "celebrate / celebration" (the house word is event)', () => {
  for (const rel of [
    'app/dashboard/(account)/create-event/_components/event-types.ts',
    'app/dashboard/(account)/create-event/_components/event-type-photo-picker.tsx',
  ]) {
    const src = read(rel);
    const taglines = [...src.matchAll(/description:\s*'([^']*)'|^\s*\w+:\s*'([^']*)',\s*$/gm)].map((m) => m[1] ?? m[2] ?? '');
    for (const t of taglines) assert.doesNotMatch(t, /celebrat/i, `${rel}: tagline "${t}" says celebrate/celebration`);
  }
});

test('B4 · a migration rewrites the two stored taglines the /start grid reads, guarded on the old text', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_event_words_not_celebration.sql'));
  assert.ok(file, 'the tagline migration is gone');
  const sql = readFileSync(join(dir, file!), 'utf8');
  assert.match(sql, /description\s*=\s*'Another year, with your people\.'[\s\S]*?AND description = 'Another year, celebrated\.'/);
  assert.match(sql, /black-tie events\.'[\s\S]*?AND description = '[^']*black-tie celebrations\.'/);
  // The two UPDATEs name the new text only; neither writes "celebrat" into the table.
  assert.doesNotMatch(sql.replace(/--.*/g, '').replace(/AND description = '[^']*'/g, ''), /celebrat/i);
});

// ── B5 · one "Setnayan" in a tab title ─────────────────────────────────────────────────────────────────────────────
// The root layout's `title.template` is '%s · Setnayan', so a page's own `title` must not carry the brand itself.
test('B5 · a supplier shop\'s document title does not repeat the brand the root template adds', () => {
  const src = read('app/v/[slug]/page.tsx');
  assert.match(src, /const docTitle = `.*· Supplier\$\{suffix\}`/, 'the shop page has no brand-free document title');
  assert.match(src, /return \{\s*title: docTitle,/, 'the shop page does not use docTitle as its <title>');
  assert.doesNotMatch(src, /docTitle = `.*Setnayan/, 'docTitle carries the brand: the template would print it twice');
  assert.doesNotMatch(src, /return \{ title: 'Setnayan supplier'/, 'the unavailable-shop title still says "Setnayan supplier · Setnayan"');
});

test('B5 · a person page that is not public still has its own title, never the bare brand', () => {
  const src = read('app/u/[userSlug]/page.tsx');
  assert.doesNotMatch(src, /title:\s*\{\s*absolute:\s*'Setnayan'\s*\}/, '/u/<slug> is titled just "Setnayan" again');
  assert.match(src, /title:\s*'Profile',/, 'the name-free profile title is gone');
});
