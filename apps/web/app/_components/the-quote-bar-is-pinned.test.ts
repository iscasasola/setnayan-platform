/**
 * the-quote-bar-is-pinned.test.ts — THE QUOTE'S Total · Save · Send quote BAR IS ON THE SCREEN'S FOOT.
 *
 * Live bug, owner screenshot at 390 px (12 Nov 2026): the bar floated mid-page with line items under it. It was
 * `sticky` inside the form, and the quote is mounted inside scroll boxes — the chat tool panel (`max-h-[55dvh]
 * overflow-y-auto`) and the picked client's body — so it stuck to THEIR bottom, then stood a dock's height
 * (`--sn-bottomdock-h`) above it, in a layer that already covers the dock.
 *
 * Holds:
 *   1 · the maker draws the bar through `QuotePinnedBar`, never a `sticky` element of its own;
 *   2 · the bar is PORTALED (`createPortal`) and `fixed` — `fixed` in place is trapped by `.sn-page-enter`'s transform —
 *       and the portal waits for `useHydrated()`, never `typeof document`;
 *   3 · it lands in the right LAYER: the picked client's thumb layer (`ThumbLayerContext`), else the form's nearest
 *       `position: fixed` ancestor (the phone's chat takeover), else <body> on the dock / thumb row;
 *   4 · a spacer in the form reserves the bar's measured height, so the last line scrolls clear of it;
 *   5 · every control in the portaled bar names the form (`form={formId}`) — outside the form's DOM, Send would post
 *       nothing (`lib/portaled-fields-join-their-form.ts`), and the form carries that id.
 *
 * 🛡 Sabotages watched red: `sticky` back on the bar; the portal removed; `form={formId}` dropped from Send; the
 * thumb-layer branch removed; the spacer removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../lib/strip-comments';

const maker = stripComments(readFileSync(join(__dirname, 'proposal-maker.tsx'), 'utf8'));
const bar = stripComments(readFileSync(join(__dirname, 'quote-pinned-bar.tsx'), 'utf8'));

/** The children the maker hands the bar — everything between its open and close tags. */
function barChildren(): string {
  const at = maker.indexOf('<QuotePinnedBar');
  const end = maker.indexOf('</QuotePinnedBar>', at);
  assert.ok(at > 0 && end > at, 'the maker no longer draws its bar through QuotePinnedBar');
  return maker.slice(at, end);
}

test('1 · the maker draws the bar through QuotePinnedBar, never a sticky element of its own', () => {
  const kids = barChildren();
  assert.doesNotMatch(kids, /(?<![-\w])sticky\b/, 'a sticky element is back inside the bar');
  assert.doesNotMatch(maker, /data-quote-pinned-bar/, 'the maker draws its own pinned bar again (it must be QuotePinnedBar)');
  assert.match(kids, /data-quote-answer=""/, 'the total left the bar');
});

test('2 · the bar is portaled, fixed, and waits for hydration', () => {
  assert.match(bar, /createPortal\(/, 'the bar is no longer portaled — fixed in place is trapped by the page transform');
  assert.match(bar, /data-quote-pinned-bar=""/);
  assert.match(bar, /className="fixed z-sn-sticky\b/, 'the bar is not fixed on the page layer token');
  assert.doesNotMatch(bar, /(?<![-\w])sticky\b/, 'the bar went back to sticky');
  assert.match(bar, /useHydrated\(\)/, 'the portal must wait for useHydrated()');
  assert.doesNotMatch(bar, /typeof document/, 'gate the portal on useHydrated(), not typeof document');
});

test('3 · it lands in the right layer and stands on the right thing', () => {
  assert.match(bar, /useContext\(ThumbLayerContext\)/, 'inside the picked client the bar would sit under its layer');
  assert.match(bar, /getComputedStyle\(el\)\.position === 'fixed'/, 'inside the chat takeover the bar would sit under it');
  assert.match(bar, /host: document\.body, standsOn: ON_THE_DOCK/, 'on <body> the bar must stand on the dock');
  assert.match(bar, /const ON_THE_DOCK = 'max\(var\(--sn-bottomdock-h, 0px\), var\(--sn-thumb-room, 0px\)\)'/);
  assert.match(bar, /const ON_THE_EDGE = '0px'/, 'inside a full-screen layer the bar is the bottom itself');
  assert.match(bar, /bottom: where\.standsOn/);
  assert.match(bar, /safe-area-inset-bottom/, 'the bar no longer clears the home indicator');
});

test('4 · a spacer reserves what the bar covers', () => {
  assert.match(bar, /data-quote-bar-spacer=""/, 'the spacer is gone — the last line hides behind the bar');
  assert.match(bar, /height: up \? `calc\(\$\{barH\}px \+ \$\{where\.standsOn\}\)`/);
  assert.match(bar, /new ResizeObserver\(measure\)[\s\S]{0,80}ro\?\.observe\(bar\)/, 'the spacer no longer measures the bar');
});

test('5 · every control in the portaled bar names the form', () => {
  const kids = barChildren();
  const controls = (kids.match(/<(button|SubmitButton)\b/g) ?? []).length;
  const named = (kids.match(/<(?:button|SubmitButton)\b[^>]*?\bform=\{formId\}/g) ?? []).length;
  assert.ok(controls >= 2, `expected Save and Send in the bar, saw ${controls}`);
  assert.equal(named, controls, `${controls - named} control(s) in the portaled bar do not name the form — Send would post nothing`);
  assert.match(maker, /<form\s+ref=\{formRef\}\s+id=\{formId\}/, 'the form lost the id its portaled controls name');
  assert.match(maker, /<QuotePinnedBar formRef=\{formRef\}>/);
});
