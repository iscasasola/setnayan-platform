/**
 * THE HUB COVER, THE VENUE CARD AND /live CONNECT FOLLOW THE DRAWING (final check, area 4, lane B batch 7 · 25 Nov 2026).
 *
 * The approved drawing (specs `prototypes/final-check-area-4_2026-11-25/…html`, owner Add 29): § 01 (A4-B05) and
 * § 04 (A4-B04). Each claim is one change the drawing asks for, and nothing else.
 *
 * Red if:
 *   a pointer screen reads "Swipe up for the event" (no swipe with a mouse) .......... A4-B05 (a)
 *   the venue plate draws its printed inner frame inside the card's hairline ......... A4-B05 (b)
 *   "The entourage" sits flush under the block above on the host/stranger tree ....... A4-B05 (c)
 *   /live Connect gives no sign it heard the press, can be pressed twice, or spins .. A4-B04
 *   an empty press on /live is the browser's bubble, or spends a rate-limited try ..... A4-B04
 *   SubmitButton loses its spinner anywhere else ...................................... (the default holds)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { COVER_SCROLL_HINT, COVER_SWIPE_HINT } from './cover-scene';
import { LIVE_EMPTY_CODE_LINE } from '@/app/live/_lib/connect-words';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('A4-B05 (a) · a pointer screen reads "Scroll for the event"; a touch screen keeps "Swipe up"', () => {
  assert.equal(COVER_SWIPE_HINT, 'Swipe up for the event');
  assert.equal(COVER_SCROLL_HINT, 'Scroll for the event');
  const src = code('app/[slug]/_components/pahina-masthead.tsx');
  const hint = src.slice(src.indexOf('data-cover-hint=""'), src.indexOf('</p>', src.indexOf('data-cover-hint=""')));
  const touch = hint.slice(hint.indexOf('data-cover-hint-touch'), hint.indexOf('data-cover-hint-pointer'));
  const pointer = hint.slice(hint.indexOf('data-cover-hint-pointer'));
  assert.match(touch, /\[@media\(hover:hover\)_and_\(pointer:fine\)\]:hidden/, 'the swipe words still show on a pointer screen');
  assert.match(touch, /\{COVER_SWIPE_HINT\}/);
  assert.match(touch, /d="M6 15l6-6 6 6"/, 'the touch hint lost its up chevron');
  assert.match(pointer, /className="hidden [^"]*\[@media\(hover:hover\)_and_\(pointer:fine\)\]:flex/, 'the scroll words are not pointer-only');
  assert.match(pointer, /\{COVER_SCROLL_HINT\}/);
  assert.match(pointer, /d="M6 9l6 6 6-6"/, 'the pointer hint is not a down chevron');
  for (const part of [touch, pointer]) assert.match(part, /motion-reduce:animate-none/, 'a hint nods under reduced motion');
});

test('A4-B05 (b) · the photo-card venue is ONE frame: the plate’s inner printed frame is off', () => {
  const src = code('app/[slug]/_components/venue-widget.tsx');
  assert.match(src, /const VENUE_PLATE_STYLE = \{ \.\.\.VENUE_CHIP_GROUND, '--pahina-frame-opacity': '0' \} as CSSProperties;/);
  const plate = src.slice(src.indexOf('function VenuePlate('));
  assert.match(plate, /<div className="pahina-plate space-y-3" style=\{VENUE_PLATE_STYLE\}>/);
  // The knob is the plate frame's own, so this off switch reaches the frame and nothing else.
  assert.match(readFileSync(join(WEB, 'app/globals.css'), 'utf8'), /\.sn-editorial \.pahina-plate::after \{[^}]*opacity: var\(--pahina-frame-opacity, 1\);/);
});

test('A4-B05 (c) · 24 px between the block above and "The entourage" on the host/stranger tree', () => {
  const src = code('app/[slug]/_components/site-body.tsx');
  assert.match(
    src,
    /group\(at\('f:entourage', scenesTab\),[^\n]*<EntourageSection groups=\{entourage\} id="site-entourage"[^\n]*gapAbove \/>/,
    'the entourage sits flush under the block above',
  );
  const ent = code('app/[slug]/_components/entourage-section.tsx');
  assert.match(ent, /const ENTOURAGE_GAP_ABOVE = \{ marginTop: '1\.5rem' \} as const;/);
  assert.match(ent, /style=\{gapAbove \? ENTOURAGE_GAP_ABOVE : undefined\}/);
});

test('A4-B04 · /live Connect shows pressed at once, holds until the answer, never twice, no spinner, no veil', async () => {
  // The component's file uses the automatic JSX runtime; under this runner it needs React in scope.
  (globalThis as { React?: typeof React }).React = React;
  const { SubmitButton } = await import('@/app/_components/submit-button');
  // Children as the third argument (react/no-children-prop); the props are cast because the button's type requires them.
  const draw = (props: Record<string, unknown>, child: string) =>
    renderToStaticMarkup(React.createElement(SubmitButton as unknown as React.FC<Record<string, unknown>>, props, child));
  const form = code('app/live/_components/connect-fields.tsx');
  assert.match(form, /setSent\(true\);/);
  assert.match(form, /const box = e\.currentTarget\.elements\.namedItem\('code'\);\s*if \(box instanceof HTMLInputElement\) \{\s*box\.readOnly = true;/, 'the code field does not lock');
  assert.match(form, /<SubmitButton\s+pending=\{sent\}\s+overlay=\{false\}\s+spinner=\{false\}\s+pendingLabel="Connecting…"/);
  assert.match(code('app/live/page.tsx'), /data-\[pending=true\]:opacity-60/, 'the pressed button does not dim');
  assert.match(code('app/live/page.tsx'), /read-only:opacity-60/, 'the locked field does not dim');
  const page = code('app/live/page.tsx');
  assert.match(page, /<ConnectForm\s+key=\{renderKey\}\s+action=\{pairLiveScreen\}\s+prefill=\{prefill\}\s+message=\{message \?\? null\}\s+look=\{CONNECT_LOOK\}/, 'an answer does not unlock a fresh form');
  assert.match(page, /const renderKey = `\$\{error \?\? 'none'\}-\$\{Date\.now\(\)\}`;/);

  // The shared button: the opt-out removes the spinner; every other form keeps it.
  const quiet = draw({ pending: true, spinner: false, overlay: false, pendingLabel: 'Connecting…' }, 'Connect');
  assert.ok(quiet.includes('Connecting…') && !quiet.includes('<svg'), 'spinner={false} still draws a spinner');
  assert.match(quiet, /disabled=""/, 'a pressed Connect can be pressed again');
  const usual = draw({ pending: true, overlay: false, pendingLabel: 'Saving…' }, 'Save');
  assert.ok(usual.includes('<svg'), 'the default SubmitButton lost its spinner');
});

test('A4-B04 · an empty press is the page’s own line, never the bubble, and spends no try', () => {
  assert.equal(LIVE_EMPTY_CODE_LINE, 'Type the code first. It’s under Venue screens on the controller.');
  const form = code('app/live/_components/connect-fields.tsx');
  assert.match(form, /noValidate/);
  assert.doesNotMatch(form, /\brequired\b/, 'the browser bubble is back');
  assert.match(form, /if \(String\(code \?\? ''\)\.trim\(\) === ''\) \{\s*e\.preventDefault\(\);\s*setEmpty\(true\);/);
  const action = code('app/live/actions.ts');
  const empty = action.indexOf("redirect('/live?error=empty')");
  assert.ok(empty > -1 && empty < action.indexOf('enforceRateLimit('), 'an empty press spends a rate-limited try');
  assert.match(code('app/live/page.tsx'), /empty: LIVE_EMPTY_CODE_LINE,/);
});
