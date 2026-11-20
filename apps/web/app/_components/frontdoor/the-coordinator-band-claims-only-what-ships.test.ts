/**
 * GUARD — the front page's coordinator door claims only what ships.
 *
 * 🔁 MOVED, NOT LOOSENED (20 Nov 2026). Until the 20 Nov front page (prototypes/front_page_home_2026-11-19 v5,
 * approved 20 Nov, specs ef5df0b5) the front page drew a whole "For coordinators" band, and this guard held its two
 * claims: no voice or video calls (calls left chat on 28 Oct), and "Free" on the floor kit only while the paywall's own
 * rule (`specializationFreeWindowActive`) made it free. The approved drawing replaced the band with ONE door row —
 * "I’m a coordinator · Every client’s event, one screen." — and the pitch lives on /for-coordinators, which carries
 * its own truth guard (`app/(shell)/for-coordinators/for-coordinators-says-what-ships.test.ts`).
 *
 * So the front page's half of the rule is now: the coordinator door opens /for-coordinators, and the front page makes
 * neither of the two claims the band was guarded for — no calls, and no "free" floor kit or "free tools" for
 * coordinators — because the page no longer reads the paywall's rule and so may not say it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

async function page(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorLanding } = await import('./front-door-landing');
  return renderToStaticMarkup(
    React.createElement(FrontDoorLanding, {
      planPrices: { plus: null, pro: null, ultra: null },
      planFacts: { plusCredits: null, proCredits: null, freePapic: null },
    }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ').trim();

test('the coordinator door opens /for-coordinators and says only the drawn line', async () => {
  const html = await page();
  const door = /<a\b[^>]*href="([^"]*)"[^>]*>\s*<b>I(?:’|&rsquo;)m a coordinator<\/b>\s*<span>([^<]*)<\/span>/.exec(html);
  assert.ok(door, 'the front page lost its "I’m a coordinator" door');
  assert.equal(door[1], '/for-coordinators');
  assert.equal(text(door[2] ?? ''), 'Every client’s event, one screen.');
});

test('no voice or video calls are offered (calls left chat on 28 Oct)', async () => {
  assert.doesNotMatch(text(await page()), /\b(voice|video)\b[^.]*\bcalls?\b|\bcalls?\b/i, 'the front page offers calls');
});

test('the front page makes no free claim about the coordinator floor kit', async () => {
  assert.doesNotMatch(text(await page()), /The tools are free|floor kit|seat scanner/i, 'the front page claims the coordinator tools are free');
});
