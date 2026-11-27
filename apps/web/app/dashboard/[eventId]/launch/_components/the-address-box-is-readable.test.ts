/**
 * 🔆 THE ADDRESS BOX IS READABLE (Apple build 10 screenshots, 27 Nov 2026: in the Event Hub controller, "Address" and
 * "This is your address now" were dark words on a dark box).
 *
 * `HubStage` is obsidian in both themes and paints its own words from `OB` literals. The address editor inside it is
 * the shipped `SlugField`, which paints with the HOUSE tokens (`text-ink/55`, `.input-field`, `.button-secondary`).
 * Those are dark words in Light, so on `OB.card` they read at 1.27:1. The field now sits in a house frame
 * (`.sn-frame`), which pairs ground and words in both themes.
 *
 * Renders the real stage and reads the emitted HTML.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const NOW = new Date('2026-11-28T10:00:00+08:00').getTime();

async function paint(): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubStage } = await import('./hub-stage');
  const control = await import('@/lib/event-hub-control');
  const { PUBLIC_SITE_PAGES } = await import('@/lib/public-site-pages');
  const read = {
    measured: true,
    eventDate: '2026-12-12',
    eventEndDate: null,
    clearedAt: null,
    timezone: 'Asia/Manila',
    slug: 'maria-and-jomar',
  };
  const standing = control.resolveHubStanding(read, NOW);
  return renderToStaticMarkup(
    React.createElement(HubStage, {
      slug: read.slug,
      standing,
      facts: control.resolveHubFacts(read, { shared: true, measured: true, invited: 90, replied: 61 }, NOW),
      livePhase: standing.stage,
      initialPhase: standing.stage,
      stages: PUBLIC_SITE_PAGES.map((p) => ({ phase: p.phaseParam, blurb: p.blurb })),
      editHref: '/dashboard/E1/website/editor',
      rolesByPhase: {},
      armedRole: null,
      eventId: 'E1',
      slugAction: async () => {},
    }),
  );
}

/** The opening tag of the nearest element before `at` that opens a box around it (the last `<div` that is still open). */
function enclosingDivs(html: string, at: number): string[] {
  const stack: string[] = [];
  const re = /<div\b[^>]*>|<\/div>/g;
  for (let m = re.exec(html); m && m.index < at; m = re.exec(html)) {
    if (m[0] === '</div>') stack.pop();
    else stack.push(m[0]);
  }
  return stack;
}

test('the address field sits in a house frame, never on the obsidian card', async () => {
  const { OB } = await import('@/app/_components/site-stage/obsidian');
  const html = await paint();
  const at = html.indexOf('name="slug"');
  assert.ok(at > 0, 'the address field must render on the stage');
  const boxes = enclosingDivs(html, at);
  const box = boxes.find((b) => /data-hub-stage-address/.test(b));
  assert.ok(box, 'the field must be inside its own address box');
  assert.match(box, /class="sn-frame"/, 'the address box must be the house frame, whose ground pairs with the ink words');
  // The field's own words are ink tokens: nothing between the frame and the field may paint an obsidian ground.
  const inner = boxes.slice(boxes.indexOf(box));
  const card = OB.card.toLowerCase();
  for (const b of inner) {
    assert.doesNotMatch(b.toLowerCase(), new RegExp(`background-color:\\s*${card}`), `dark ground under the ink words: ${b}`);
  }
});

test('the field\'s quiet words are still the house ink tokens (the frame is what makes them readable)', async () => {
  const html = await paint();
  assert.match(html, /<label[^>]*class="[^"]*text-ink\/55[^"]*"[^>]*>Address<\/label>/, '"Address" is a visible house label');
});
