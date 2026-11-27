/**
 * Final check A4-55 / A4-81 (approved drawing §§ 05–06): from My photos, "Decorate a photo" and "Browse everyone's
 * photos" rise full screen OVER the page instead of throwing the guest onto a new page. This pins the wiring, read
 * from the files (the risen body needs a live session, so a render test cannot reach it):
 *  · the slot lives on `app/papic/layout.tsx`, the layout both addresses share — measured in a dev lab, an intercept
 *    under `me/[token]` never fires for a sibling outside it;
 *  · each risen screen is a `RiseRoute` around the SAME page, re-exported (never a second copy);
 *  · My photos opens both through `RiseDoor` (bridge first, then the soft push the intercept catches);
 *  · the full pages hide their own back link + heading only while risen (`data-rise-hide`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const APP = join(__dirname, '..', 'app');
const read = (p: string) => readFileSync(join(APP, p), 'utf8');
const code = stripComments;

test('the Papic layout draws the @rise slot after the page', () => {
  const src = code(read('papic/layout.tsx'));
  assert.match(src, /\{children\}\s*\{rise\}/);
  for (const f of ['default.tsx', '[...rest]/page.tsx']) {
    assert.ok(existsSync(join(APP, 'papic/@rise', f)), `@rise/${f} missing`);
    assert.match(code(read(`papic/@rise/${f}`)), /return null/);
  }
  // NO @rise/page.tsx: /papic itself is the marketing page in app/(shell)/papic, a different route tree. A slot page
  // for /papic is never built, and Vercel's deploy failed on its missing client-reference manifest (26 Nov, f303b87).
  assert.equal(existsSync(join(APP, 'papic/@rise/page.tsx')), false, '@rise/page.tsx breaks the Vercel deploy');
  assert.equal(existsSync(join(APP, 'papic/me/[token]/@rise')), false, 'a slot under me/[token] never intercepts a sibling');
});

for (const [seg, title] of [['decorate', 'Decorate a photo'], ['pool', 'Everyone’s photos']] as const) {
  test(`${seg} rises as a RiseRoute around the same page`, () => {
    const layout = code(read(`papic/@rise/(.)${seg}/layout.tsx`));
    assert.match(layout, new RegExp(`<RiseRoute title="${title}" data="papic-${seg}">`));
    assert.match(layout, /\[&_\[data-rise-hide\]\]:hidden/);
    assert.match(code(read(`papic/@rise/(.)${seg}/page.tsx`)), new RegExp(`export \\{ default, dynamic \\} from '\\.\\./\\.\\./${seg}/page';`));
  });
}

test('My photos opens both through RiseDoor', () => {
  const page = code(read('papic/me/[token]/page.tsx'));
  assert.equal((page.match(/<RiseDoor\b/g) ?? []).length, 2);
  assert.match(page, /pageHref="\/papic\/decorate"/);
  assert.match(page, /pageHref="\/papic\/pool"/);
  const door = code(read('papic/me/[token]/_components/rise-door.tsx'));
  assert.match(door, /fetch\(href/);
  assert.match(door, /router\.push\(pageHref\)/);
  assert.match(door, /window\.location\.assign\(href\)/);
});

test('the full pages step their own back + heading aside only when risen', () => {
  for (const f of ['papic/decorate/_components/kwento-decorator.tsx', 'papic/pool/page.tsx']) {
    assert.ok((code(read(f)).match(/data-rise-hide=""/g) ?? []).length >= 2, f);
  }
});
