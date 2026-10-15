/**
 * The shared public chrome keeps a 44px PRESS on every control — the locked tap
 * floor — without changing its paint.
 *
 * Quality sweep 2026-10-13, item 6 measured, on every public page: footer links
 * + "Cookie settings" 40, the help/article top bars 32 (logo) and 20 ("All help
 * topics"), the Taglish/English switch 17–20, the header wordmark 23. Two
 * techniques, chosen by whether the control is PAINTED:
 *  - unpainted text links grow their own box and hand the room back
 *    (`min-height: 44px` + negative margin, or a smaller gap), so the element
 *    itself measures 44;
 *  - painted controls (a pill, a circle) keep their drawing's size and carry an
 *    absolutely-positioned `::after` expander — the header's menu (40 + 2×2),
 *    Sign in (36 + 2×5) and search button (+ 2×3) already did; the wordmark now
 *    does too. An element-box audit cannot see a pseudo-element, which is why
 *    the sweep counted those three: measured with elementFromPoint instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { LOCALE_SWITCH_CLASS } from '@/lib/marketing-i18n';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const rule = (css: string, sel: string) => {
  const i = css.indexOf(sel + ' {');
  assert.ok(i >= 0, `rule ${sel} is gone`);
  return css.slice(i, css.indexOf('}', i));
};

test('footer links and "Cookie settings" are 44px tall, at the same row pitch', () => {
  const css = read('app/_components/home/home-reskin.css');
  const link = rule(css, '.home-reskin .hr-foot-col a,\n.home-reskin .hr-foot-linkbtn');
  const h = Number(link.match(/min-height:\s*(\d+)px/)?.[1]);
  assert.ok(h >= 44, `footer link min-height is ${h}px — under the 44px floor`);
  const gap = Number(rule(css, '.home-reskin .hr-foot-col').match(/gap:\s*(\d+)px/)?.[1]);
  assert.equal(h + gap, 49, `footer row pitch is ${h + gap}px — it was 49 (40 + 9); keep the look`);
});

test('the header wordmark and the bar controls carry a press expander', () => {
  const css = read('app/_components/frontdoor/front-door.css');
  for (const sel of ['.fd-wordmark::after', '.fd-iconbtn::after', '.fd-searchgo::after']) {
    assert.ok(css.includes(sel + ' {'), `${sel} expander is gone`);
  }
  assert.match(css, /\.fd-topbar \.fd-btn-quiet::after\s*\{[^}]*inset:\s*-5px 0/, 'the bar Sign in pill lost its -5px expander');
  assert.match(rule(css, '.fd-wordmark::after'), /inset:\s*-(1[0-9]|[2-9][0-9])px/, 'the wordmark expander is under 10px each way');
});

test('the Taglish/English switch and the help/article top bars press at 44', () => {
  assert.match(LOCALE_SWITCH_CLASS, /min-h-\[44px\]/, 'LOCALE_SWITCH_CLASS lost its 44px press');
  assert.match(LOCALE_SWITCH_CLASS, /-my-3/, 'LOCALE_SWITCH_CLASS grows its row (no negative margin)');
  for (const f of ['app/(shell)/about/page.tsx', 'app/(shell)/about/_about-motion.tsx', 'app/tl/about/page.tsx']) {
    assert.ok(!/text-\[11px\][^"]*hrefLang|hrefLang[^>]*text-\[11px\]/.test(read(f)), `${f} carries its own 11px switch again — use LOCALE_SWITCH_CLASS`);
    assert.ok(read(f).includes('LOCALE_SWITCH_CLASS'), `${f} no longer uses LOCALE_SWITCH_CLASS`);
  }
  for (const f of ['app/help/[slug]/page.tsx', 'app/blog/[slug]/page.tsx']) {
    const src = read(f);
    assert.ok(src.includes('className="-my-1.5 flex min-h-[44px] items-center text-ink"'), `${f}: the top-bar logo link is not 44px`);
    assert.ok(/sm:min-h-\[44px\]/.test(src), `${f}: the top-bar "All …" link is not 44px`);
  }
});
