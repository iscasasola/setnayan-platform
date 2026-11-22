/**
 * the-fee-bar-really-drags.test.ts — the For Suppliers fee ruler says "drag the bar", so the bar drags (owner, 20 Nov:
 * "shouldn't the line bar be moving?" — it was `aria-hidden` with `pointer-events: none`, and the copy promised a drag
 * nothing answered).
 *
 *   · the copy's "drag" promise is backed: the bar takes a pointer down AND a pointer move, and nothing switches it off;
 *   · it is a real slider — role, value, a spoken value, arrow keys — not a picture of one;
 *   · the dot and the cards are ONE control: the bar scrolls the cards, and the cards' scroll moves the dot;
 *   · its press area is at least 44 px tall.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DIR = join(__dirname, '_components');
const src = stripComments(readFileSync(join(DIR, 'supplier-front-client.tsx'), 'utf8'));
const css = stripComments(readFileSync(join(DIR, 'supplier-front.module.css'), 'utf8'));
const from = src.indexOf('export function FeeRuler');
const to = src.indexOf('\nexport function', from + 10);
const ruler = src.slice(from, to < 0 ? undefined : to);
const barTag = ruler.match(/<div\s+ref=\{bar\}[\s\S]*?>/)?.[0] ?? '';
const rule = (sel: string) => css.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

test('anti-vacuity: the ruler and its bar are found', () => {
  assert.ok(from >= 0 && ruler.length > 500, 'FeeRuler moved or was renamed');
  assert.ok(barTag.includes('className={s.fxBar}'), 'the bar element is not the ref={bar} div');
});

test('the copy promises a drag, and the bar answers one', () => {
  assert.match(ruler, /drag the bar/i, 'anti-vacuity: the drag promise is gone — if it is retired, retire this guard with it');
  for (const h of ['onPointerDown', 'onPointerMove']) assert.ok(barTag.includes(`${h}={`), `the bar has no ${h} — "drag the bar" is untrue`);
  assert.match(ruler, /setPointerCapture\(/, 'a drag that leaves the bar would drop the dot');
  assert.doesNotMatch(barTag, /aria-hidden/, 'the bar is hidden from assistive tech');
  assert.doesNotMatch(rule('.fxBar'), /pointer-events\s*:\s*none/, 'the bar ignores the pointer');
  assert.match(rule('.fxBar'), /touch-action\s*:\s*pan-y/, 'on a phone a sideways drag on the bar would scroll the page instead');
});

test('it is a real slider: role, value, spoken value, arrow keys', () => {
  for (const a of ['role="slider"', 'tabIndex={0}', 'aria-valuemin=', 'aria-valuemax=', 'aria-valuenow={at}', 'aria-valuetext=', 'onKeyDown={']) {
    assert.ok(barTag.includes(a), `the bar lacks ${a}`);
  }
  for (const k of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) assert.ok(ruler.includes(k), `the ${k} key does nothing`);
});

test('the dot and the cards are one control, both ways', () => {
  const go = ruler.match(/const go = [\s\S]*?\n {2}\};/)?.[0] ?? '';
  assert.match(go, /setAt\(/, 'moving the bar does not move the dot');
  assert.match(go, /scrollTo\(/, 'moving the bar does not move the cards');
  const onScroll = ruler.match(/const onScroll = [\s\S]*?\n {2}\};/)?.[0] ?? '';
  assert.match(onScroll, /setAt\(best\)/, 'swiping the cards does not move the dot');
  assert.match(ruler, /requestAnimationFrame\(\(\) => go\(FEE_STOP_START/, 'the ruler does not open with the dot and the cards on the same stop');
});

test('the press area is at least 44 px tall', () => {
  const h = Number(rule('.fxBar').match(/(?<![\w-])height\s*:\s*(\d+)px/)?.[1] ?? 0);
  assert.ok(h >= 44, `the bar is ${h}px tall`);
});
