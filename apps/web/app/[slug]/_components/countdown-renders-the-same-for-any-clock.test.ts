/**
 * THE COUNTDOWN'S SERVER MARKUP DOES NOT DEPEND ON THE CLOCK.
 *
 * Measured on prod (`/<slug>`, a stranger, 375 px, three deployments running):
 * "Minified React error #418" — text content does not match server-rendered
 * HTML. Reproduced unminified against this very component: the server rendered
 * the Secs tile at one second and the phone, hydrating a moment later, at
 * another (`+ 05` / `- 18`). The cause was `Date.now()` read INSIDE render
 * (`useState(() => compute(target))`), which runs once on the server and again
 * on the client.
 *
 * The property held here is the one hydration actually checks: render the
 * widget the way the server does (`renderToString`) at three unrelated
 * instants — far before the day, one second before it, and after it — and the
 * markup must be byte-identical. If a `Date.now()` ever moves back into render,
 * these differ (in the digits, or in whether the section exists at all) and
 * this test goes red before a guest's console does.
 *
 * ⚠ The classic-runtime global (`globalThis.React`) + DYNAMIC import is the
 * same shape as `app/pay/[reference]/_components/one-stage-at-a-time.test.ts`:
 * tsconfig has `"jsx": "preserve"`, so tsx compiles the component's JSX to bare
 * `React.createElement`, and a static import would hoist above the assignment.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

const TARGET_ISO = '2026-12-12';
const TZ = 'Asia/Manila';
const DAY_START_MS = Date.UTC(2026, 11, 11, 16, 0, 0); // 2026-12-12 00:00 Manila (UTC+8)

async function renderAt(nowMs: number): Promise<string> {
  const realNow = Date.now;
  Date.now = () => nowMs;
  try {
    const { CountdownWidget } = await import('./countdown');
    return renderToString(React.createElement(CountdownWidget, { targetIso: TARGET_ISO, timeZone: TZ }));
  } finally {
    Date.now = realNow;
  }
}

test('the countdown renders byte-identical server markup at any instant — nothing in render reads the clock', async () => {
  const farBefore = await renderAt(DAY_START_MS - 74 * 86_400_000 - 15 * 3_600_000 - 33 * 60_000 - 18_000);
  const oneSecondBefore = await renderAt(DAY_START_MS - 1_000);
  const after = await renderAt(DAY_START_MS + 3_600_000);

  assert.ok(farBefore.length > 0, 'the widget renders a shell on the server');
  assert.equal(oneSecondBefore, farBefore, 'seconds apart, the server markup must not differ (this WAS #418)');
  assert.equal(after, farBefore, 'even past the day the SERVER cannot know it — the shell is the same; the client retires it after mount');

  // The shell shows every tile, holding its height, and no digit that could be
  // wrong — the clock is read after mount, never before.
  for (const label of ['Days', 'Hours', 'Mins', 'Secs']) assert.ok(farBefore.includes(label), `the ${label} tile is in the shell`);
  assert.equal((farBefore.match(/––/g) ?? []).length, 4, 'four tiles, four placeholders, zero digits');
  assert.doesNotMatch(farBefore, />\d\d</, 'no two-digit reading is rendered on the server');
});

test('a date that cannot be anchored still draws no clock at all', async () => {
  const { CountdownWidget } = await import('./countdown');
  const html = renderToString(React.createElement(CountdownWidget, { targetIso: 'not-a-date', timeZone: TZ }));
  assert.equal(html, '', 'no target → nothing, as before');
});
