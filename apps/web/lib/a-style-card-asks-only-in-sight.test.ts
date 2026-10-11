/**
 * a-style-card-asks-only-in-sight.test.ts — 🧯 A STYLE CARD'S MINIATURE IS ASKED FOR ONLY ONCE THE CARD CAN BE SEEN.
 *
 * Measured 2026-10-11 (`controller-2026-10-08/speed/MAKER-WHO-ASKS.md`): 11 of the 22 guest-page renders of one
 * Maker session were the Style cards of a picked part — 5 for the Countdown, 3 and 3 for the next two — although
 * the couple never opened Style. Each card is an `<iframe src="/<slug>?…&only=…&style=…">`, a WHOLE server render
 * of the guest page; the toolbar opens on Edit, where the look body waits under `visibility:hidden`
 * (`stage-tools.tsx`), and a hidden iframe still loads (checked in Chromium).
 *
 * So `StylePreview` asks for nothing until its card is near the screen AND in sight (`styleCardInSight`), and once
 * asked it stays asked. There is no DOM in this runner: the pure check is run on stand-in elements, the wiring is
 * held from the source, and the stage-tools rules that hide the look body are read so a NEW hiding attribute
 * cannot slip past the watcher. The lab run with a request log counts the renders for real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const PANEL = 'app/dashboard/[eventId]/launch/_components';
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** A stand-in element: its boxes and its computed visibility. */
const el = (boxes: number, visibility: string) =>
  [{ getClientRects: () => ({ length: boxes }) } as unknown as Element, { getComputedStyle: () => ({ visibility }) as CSSStyleDeclaration }] as const;

test('in sight = laid out and not hidden — a card under Edit (visibility:hidden) or display:none is not', async () => {
  const { styleCardInSight } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/style-preview');
  assert.equal(styleCardInSight(...el(1, 'visible')), true, 'a card on screen asks');
  assert.equal(styleCardInSight(...el(1, 'hidden')), false, 'the look body waiting under Edit is hidden — and a hidden iframe still loads');
  assert.equal(styleCardInSight(...el(1, 'collapse')), true, 'only "hidden" hides');
  assert.equal(styleCardInSight(...el(0, 'visible')), false, 'display:none has no box');
});

test('the miniature\'s address waits for `asked`, which only a card in sight sets — and never unsets', () => {
  const prev = stripComments(read(`${PANEL}/stage-panel/style-preview.tsx`));
  const body = prev.slice(prev.indexOf('export function StylePreview('));
  assert.match(body, /const src = asked && canvas && canvasKey \? stylePreviewSrc\(/, 'the card asks for its page before it is in sight');
  assert.equal((body.match(/stylePreviewSrc\(/g) ?? []).length, 1, 'ONE address, behind the gate');
  assert.equal((body.match(/<iframe/g) ?? []).length, 1);
  assert.match(body, /\{src \? \(\s*<iframe/, 'no iframe without an address');
  assert.equal((body.match(/setAsked\(/g) ?? []).length, 1, 'ONE place asks');
  assert.match(body, /if \(styleCardInSight\(b\)\) setAsked\(true\);/);
  assert.doesNotMatch(body, /setAsked\(false\)/, 'a card drawn stays drawn');
  // Near the screen: the strip's neighbour too, the rest as they are swiped in.
  assert.match(body, /new IntersectionObserver\(/);
  assert.match(body, /\{ rootMargin: '0px 96px' \}/);
  assert.match(body, /near = es\.some\(\(e\) => e\.isIntersecting\);\s+if \(near\) look\(\);/);
  // Showing the look body moves no box — the toolbar's attributes are watched for it.
  assert.match(body, /mo\.observe\(document\.body, \{ attributes: true, subtree: true, attributeFilter: SIGHT_ATTRIBUTES \}\);/);
  assert.match(body, /io\.disconnect\(\);\s+mo\.disconnect\(\);/, 'both let go on unmount');
  // While it waits the card says so — never a blank card (`every-look-draws-a-picture.test.ts`).
  assert.match(body, /data-style-preview=\{!src \? 'loading'/);
});

test('every attribute stage-tools hides the look body by is one the card watches', () => {
  const prev = stripComments(read(`${PANEL}/stage-panel/style-preview.tsx`));
  const watched = new Set(
    [...(prev.match(/const SIGHT_ATTRIBUTES = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!),
  );
  assert.ok(watched.size >= 3, `the watched list moved — re-anchor this test (${[...watched].join(', ')})`);
  const tools = read(`${PANEL}/stage-tools.tsx`);
  const hiding = [...tools.matchAll(/'([^']*\[data-phone-chrome="panel"\]\{visibility:hidden[^']*)'/g)].map((m) => m[1]!);
  assert.ok(hiding.length >= 2, `stage-tools' hiding rules moved — re-anchor this test (${hiding.length})`);
  for (const rule of hiding) {
    const attrs = [...rule.slice(0, rule.indexOf('[data-phone-chrome')).matchAll(/\[([a-z-]+)(?:[=\]])/g)]
      .map((m) => m[1]!)
      .filter((a) => a !== 'data-maker-shell' && a !== 'data-stage-tools');
    assert.ok(attrs.length > 0, `a rule hides the look body by nothing the card can watch: ${rule}`);
    for (const a of attrs) assert.ok(watched.has(a), `stage-tools hides the look body by [${a}], which the card does not watch: ${rule}`);
  }
});
