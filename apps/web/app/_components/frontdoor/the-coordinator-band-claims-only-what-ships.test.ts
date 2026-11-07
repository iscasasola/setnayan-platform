/**
 * the-coordinator-band-claims-only-what-ships.test.ts — the front page's "For coordinators" band says "Free" only
 * where the app makes a tool free, and never offers calls.
 *
 * CLOUD_BOARD "TRUE-CLAIMS CHECK" (5 Nov, the owner's instruction): calls left chat on 28 Oct, so no in-app voice or
 * video calls may be promised; and the coordinator's floor kit (live schedule · requests inbox · seat scanner) is
 * paywalled by `lib/vendor-specialization-gate.ts` while the free-until date is unset — so it is tagged "Free", and
 * the heading says "The tools are free.", only while that same rule (`specializationFreeWindowActive`) says so.
 * Rendered, not grepped: the assertions read the HTML a stranger gets.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

async function band(floorKitFree: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorLanding } = await import('./front-door-landing');
  const html = renderToStaticMarkup(
    React.createElement(FrontDoorLanding, {
      eventTypes: [],
      planPrices: { plus: null, pro: null },
      floorKitFree,
      sample: null,
      shelves: null,
    }),
  );
  const m = /<section\b[^>]*\bid="coordinators"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  assert.ok(m, 'the front page lost its "For coordinators" band');
  return m[1] ?? '';
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ').trim();

test('no voice or video calls are offered (calls left chat on 28 Oct)', async () => {
  for (const free of [true, false]) {
    assert.doesNotMatch(text(await band(free)), /\b(voice|video)\b[^.]*\bcalls?\b|\bcalls?\b/i, 'the coordinator band offers calls');
  }
});

test('while the floor kit is paywalled, only the login row says Free and the heading makes no free claim', async () => {
  const t = text(await band(false));
  assert.doesNotMatch(t, /The tools are free/, 'the heading says the tools are free while the floor kit is paid');
  const frees = t.match(/\bFree\b(?! —)/g) ?? [];
  assert.equal(frees.length, 1, `expected exactly one "Free" tag (the login row), found ${frees.length}: ${t}`);
  assert.match(t, /Free One login for every event you run/);
});

test('once the paywall itself makes the floor kit free, the band says so in full', async () => {
  const t = text(await band(true));
  assert.match(t, /You run the day\. The tools are free\./);
  assert.match(t, /Free One schedule, each supplier sees their part/);
  assert.match(t, /Free Door check-in and the seat scanner/);
});

test('the page asks the paywall’s own rule, never a second copy of it', async () => {
  const { readFileSync } = await import('node:fs');
  const { stripComments } = await import('@/lib/strip-comments');
  const door = stripComments(readFileSync(new URL('./front-door.tsx', import.meta.url), 'utf8'));
  assert.match(
    door,
    /floorKitFree=\{specializationFreeWindowActive\(vendorDayOfFreeUntilIso\(\), Date\.now\(\)\)\}/,
    'front-door.tsx must read the floor kit’s free state from the paywall’s own rule',
  );
});
