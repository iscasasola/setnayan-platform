/**
 * GUARD — "TELL US WHAT YOU DO" OPENS IN PLACE INSIDE THE MAKER'S LAYER (final check B9 · A5-G3-06; drawing
 * `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html` § B9, approved 25 Nov).
 *
 *   1. The three steps are steps, never page loads: no `?group=` / `?tile=` addresses, no second layer, no page title of
 *      their own, no "Back to your card" (the layer's ‹ is the way back).
 *   2. The maker stays MOUNTED (hidden) under the steps — nothing typed is lost — and its scroll comes back.
 *   3. While open, the layer's head reads "‹ Tell us what you do" over the screen's name; ‹ is in ✕'s place.
 *   4. Every way in: the maker's "Ask us" row and reason sentence open it in place (their address stays for a hard
 *      load); the old address forwards into the maker with the section open, carrying where it stood.
 *   5. No new server action: the name step posts the shipped `proposeCategory`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));
const VIEW = src('app/vendor-dashboard/services/requests/_components/tell-us-view.tsx');
const HOST = src('app/vendor-dashboard/services/requests/_components/tell-us-host.tsx');

test('1 · the steps are steps: pressed, never loaded; no title or "Back to your card" of their own', () => {
  assert.doesNotMatch(VIEW, /\?group=|\?tile=/, 'a step is a page load again');
  assert.doesNotMatch(VIEW, /PageMasthead|Back to your card|<Link\b/, 'the steps draw a page of their own');
  assert.equal((VIEW.match(/onPress=\{\(\) => go\(/g) ?? []).length, 2, 'the group and category rows are not steps');
  assert.match(VIEW, /onClick=\{\(\) => go\(\{ group: group\.id \}\)\}/, '"Change category" is not a step back');
  assert.match(VIEW, /label="Other groups" onClick=\{\(\) => go\(\{\}\)\}/);
  assert.match(VIEW, /label="Search again" onClick=\{searchAgain\}/);
  assert.match(VIEW, /label="Your requests" href=\{SERVICE_REQUESTS_HREF\}/);
  assert.match(src('app/_components/template-rows.tsx'), /\) : onPress \? \(\s*<button type="button" onClick=\{onPress\}/);
});

test('2 · the maker stays mounted under the steps, and comes back at its scroll', () => {
  assert.match(HOST, /<div hidden=\{open\} data-tell-us-maker="">\s*\{children\}\s*<\/div>/, 'the maker is unmounted (typed fields lost)');
  assert.match(HOST, /makerScroll\.current = scrollerOf\(root\.current\)\.scrollTop;/, 'the maker’s scroll is not kept');
  assert.match(HOST, /if \(dir === 'back'\) scrollerOf\(root\.current\)\.scrollTop = makerScroll\.current;/, 'the maker’s scroll is not put back');
  assert.match(HOST, /if \(at\.tile\) \{[\s\S]*?setAt\(groupOfTile \? \{ group: groupOfTile \} : \{\}\);[\s\S]*?if \(at\.group\) \{\s*setAt\(\{\}\);[\s\S]*?setOpen\(false\);/, '‹ does not step back one step, then out');
});

test('3 · the layer’s head reads ‹ Tell us what you do; ‹ sits where ✕ was', () => {
  assert.match(HOST, /setHead\(open \? \{ title: TELL_US_TITLE, back: \{ label: 'Back', onBack: back \} \} : null\);/);
  assert.match(HOST, /export const TELL_US_TITLE = 'Tell us what you do';/);
  const route = src('app/_components/rise/rise-route.tsx');
  assert.match(route, /const headTitle = over \? over\.title : title;\s*const headLine = over \? title : line;/, 'the head is not "Tell us what you do" over the screen’s name');
  assert.match(route, /back=\{over\?\.back\}/);
  const screen = src('app/_components/rise/rise-screen.tsx');
  const close = screen.slice(screen.indexOf('data-rise-close=""'), screen.indexOf('data-rise-title=""'));
  assert.match(close, /back \? \(\s*<ActionButton tone="neutral" iconOnly icon=\{ChevronLeft\} label=\{back\.label\} onClick=\{back\.onBack\} \/>\s*\) : \(\s*<ActionButton tone="neutral" iconOnly icon=\{X\} label="Close" onClick=\{close\} \/>/, '‹ is not in ✕’s place');
  assert.match(src('app/vendor-dashboard/_components/shop-door-screen.tsx'), /back \? \(\s*<ActionButton tone="neutral" iconOnly icon=\{ChevronLeft\}/, 'the dialog head has no ‹');
  // A hard load (no risen layer) draws the ‹ row itself.
  assert.match(HOST, /\{head \? null : \([\s\S]{0,300}data-tell-us-own-head=""/);
});

test('4 · every way in: the maker’s doors open it in place; the old address forwards with the section open', () => {
  const maker = src('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.equal((maker.match(/href=\{PROPOSE_CATEGORY_HREF\}\s*onClick=\{tellUsInPlace\}/g) ?? []).length, 2, 'a maker door still leaves the layer');
  assert.match(maker, /const tellUsInPlace = \(e: React\.MouseEvent\) => \{\s*if \(!tellUs\) return;\s*e\.preventDefault\(\);\s*setSheet\(null\);\s*tellUs\.open\(\);/);
  for (const [f, mount] of [
    ['app/vendor-dashboard/services/new/page.tsx', '<NewServiceMaker'],
    ['app/vendor-dashboard/services/new/[category]/page.tsx', '<CanvasMaker'],
    ['app/vendor-dashboard/services/[serviceId]/page.tsx', '<CanvasMaker'],
  ] as const) {
    const s = src(f);
    const i = s.indexOf('<TellUsHost');
    assert.ok(i > 0 && i < s.indexOf(mount) && s.indexOf('</TellUsHost>') > s.indexOf(mount), `${f}: the maker is not inside the host`);
    assert.match(s, /loadRequestTree\(\)/, `${f}: the categories are not read with the page`);
  }
  const forward = src('app/vendor-dashboard/services/requests/new/page.tsx');
  assert.match(forward, /const to = new URLSearchParams\(\{ tell: '1' \}\);/);
  assert.match(forward, /if \(sp\.group\) to\.set\('group', sp\.group\);\s*if \(sp\.tile\) to\.set\('tile', sp\.tile\);\s*if \(sp\.error\) to\.set\('tell_error', sp\.error\);/);
  assert.match(forward, /redirect\(`\$\{SERVICE_MAKER_HREF\}\?\$\{to\.toString\(\)\}`\);/);
  assert.match(src('app/vendor-dashboard/services/new/page.tsx'), /initial=\{\{ open: tell === '1', at: \{ group: group \|\| undefined, tile: tile \|\| undefined \}, error: tell_error \|\| null \}\}/);
});

test('5 · no new server action: the name step posts the shipped proposeCategory', () => {
  const form = src('app/vendor-dashboard/services/requests/_components/name-fields.tsx');
  assert.match(form, /<StayForm door="svServices\.proposeCategory" action=\{proposeCategory\}/);
  assert.match(VIEW, /<RequestNameForm\s+tileId=\{tile\.tileId\}\s+fromMaker=\{fromMaker\}/);
});

test('4b · the forward, run: the old address lands on the maker with the section open, where it stood', async () => {
  const { default: forward } = await import('./new/page');
  const landing = async (sp: Record<string, string>) => {
    try {
      await forward({ searchParams: Promise.resolve(sp) });
    } catch (e) {
      const digest = String((e as { digest?: string }).digest ?? '');
      const url = digest.split(';').find((part) => part.startsWith('/'));
      if (url) return url;
      throw e;
    }
    throw new Error('the old address no longer forwards');
  };
  assert.equal(await landing({}), '/vendor-dashboard/services/new?tell=1');
  assert.equal(await landing({ wantCategory: '1' }), '/vendor-dashboard/services/new?tell=1');
  assert.equal(await landing({ group: 'booths' }), '/vendor-dashboard/services/new?tell=1&group=booths');
  assert.equal(await landing({ tile: 'make_take', error: 'Give it a name of 2–80 characters.' }), `/vendor-dashboard/services/new?tell=1&tile=make_take&tell_error=${encodeURIComponent('Give it a name of 2–80 characters.').replace(/%20/g, '+')}`);
});
