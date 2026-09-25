import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { MAKER_BAR } from './maker-bar';
import { TOURS } from '@/lib/tours';

/* tsx compiles these components to the CLASSIC runtime (bare
   `React.createElement`), so React must be global BEFORE they are imported,
   and the imports are dynamic — the set-up `hub-stage-renders.test.ts`
   documents. */
(globalThis as unknown as { React: unknown }).React = React;

/**
 * THE BAR IS THE OWNER'S FINAL BAR — in order, with its two dividers.
 *
 *   Details · Logo · Hero · Reveal · Love Story │ Save the Date · Invitation · On the Day · Post Event │ Prints & Tickets
 *
 * (DECISION_LOG 2026-09-24/25; EVENT_HUB_MAKER_BUILD_PLAN Phase 1.) Asserted on
 * the RENDERED bar, not only the list: a list can be right while the component
 * drops an item, merges a group, or forgets a divider.
 */

/* Owner, FINAL (2026-09-25): "DETAILS LOGO HERO REVEAL LOVE STORY / SAVE THE DATE
   INVITATION ON THE DAY POST EVENT | PRINTS AND TICKETS". */
const FINAL = [
  // Owner-final 2026-09-25: "DETAILS LOGO HERO REVEAL LOVE STORY / SAVE THE DATE
  // INVITATION ON THE DAY POST EVENT | PRINTS AND TICKETS" (MAKER_DETAILS_LABEL).
  'Details',
  'Logo',
  'Hero',
  'Reveal',
  'Love Story',
  'Save the Date',
  'Invitation',
  'On the Day',
  'Post Event',
  'Prints & Tickets',
];

async function paint(
  opts: { hasWork?: boolean; liveStage?: 'rsvp' | null; selection?: { kind: 'tool'; key: 'logo' | 'hero' | 'reveal' | 'love-story' } | null } = {},
) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerBar } = await import('./maker-shell');
  return renderToStaticMarkup(
    React.createElement(MakerBar, {
      stage: 'rsvp',
      liveStage: opts.liveStage === undefined ? 'rsvp' : opts.liveStage,
      selection: opts.selection ?? null,
      hasWork: opts.hasWork ?? true,
      onPress: () => {},
    }),
  );
}

test('the list is the final bar', () => {
  assert.deepEqual(MAKER_BAR.map((i) => i.label), FINAL);
});

test('the rendered bar has the ten items in order and exactly two dividers', async () => {
  const html = await paint();
  const order = FINAL.map((label) => html.indexOf(label.replace('&', '&amp;')));
  for (const [i, at] of order.entries()) assert.ok(at > -1, `"${FINAL[i]}" is missing from the bar`);
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i]! > order[i - 1]!, `"${FINAL[i]}" renders before "${FINAL[i - 1]}"`);
  }
  assert.equal((html.match(/data-maker-divider/g) ?? []).length, 2, 'two dividers, three groups');
  const firstDivider = html.indexOf('data-maker-divider');
  const secondDivider = html.indexOf('data-maker-divider', firstDivider + 1);
  assert.ok(order[4]! < firstDivider && firstDivider < order[5]!, 'the first divider sits after Love Story');
  assert.ok(order[8]! < secondDivider && secondDivider < order[9]!, 'the second sits before Prints & Tickets');
});

test('the live stage wears the red dot, and only it', async () => {
  assert.equal(((await paint()).match(/Live today/g) ?? []).length, 1);
  assert.equal(((await paint({ liveStage: null })).match(/Live today/g) ?? []).length, 0);
});

test('no bar item is a dead button', async () => {
  const html = await paint();
  // Phase 9: Details and Prints & Tickets are real tools — each opens its workspace, not a coming-next line.
  assert.match(html, /<button[^>]*data-maker-bar-item="prints"[^>]*aria-pressed=/, 'Prints & Tickets opens its workspace');
  assert.match(html, /<button[^>]*data-maker-bar-item="details"[^>]*aria-pressed=/, 'Details opens its panel');
  assert.equal((html.match(/data-maker-bar-item=/g) ?? []).length, FINAL.length, 'every item is a button');
});

test('the tour: the store shell drops the paid slide, and a price is only ever the catalogue’s', async () => {
  const { makerTourSlides } = await import('./maker-bar');
  const all = TOURS.customer_event_hub_maker_v1.slides;
  assert.ok(all.some((s) => s.sells), 'the Pro slide is marked as selling');
  const shell = makerTourSlides({ storeShell: true, priceLabel: '₱3,500' });
  assert.equal(shell.length, all.length - 1);
  assert.ok(shell.every((s) => !/₱|\{price\}/.test(s.body)), 'no price in the store shell');
  const web = makerTourSlides({ storeShell: false, priceLabel: '₱3,500' });
  assert.match(web[web.length - 1]!.body, /₱3,500, once/, 'the catalogue figure, when read');
  const unread = makerTourSlides({ storeShell: false, priceLabel: null });
  assert.ok(unread.every((s) => !/₱|\{price\}/.test(s.body)), 'no remembered number when unread');
});

test('every bar item is reachable by scrolling — the bar never centres by justify-content', async () => {
  /* Owner on the live Maker, 2026-09-25: "cannot see logo anymore even if i
     scroll". `justify-content: center` on a scroll container pushes the overflow
     off the LEFT edge where no scroll reaches. Centring must come from
     margin-inline:auto on the first and last groups (collapses on overflow). */
  const html = await paint();
  const nav = /<nav[^>]*data-maker-bar=""[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(nav, 'the bar was not rendered');
  assert.doesNotMatch(nav, /justify-(center|around|evenly|end)|justify-content:\s*center/, 'the scrolling bar must not justify-center');
  assert.match(nav, /overflow-x-auto/, 'the bar must scroll when it overflows');
  const groups = [...html.matchAll(/<span class="flex shrink-0 items-center gap-0\.5([^"]*)"/g)].map((m) => m[1]!);
  assert.equal(groups.length, 3, 'three groups');
  assert.match(groups[0]!, /\bms-auto\b/, 'the first group centres with margin-inline-start:auto');
  assert.match(groups[2]!, /\bme-auto\b/, 'the last group centres with margin-inline-end:auto');
});

test('ONE highlight in every state — a tool takes it from the stage, and any item can hold it', async () => {
  /* Owner 2026-09-25: "there should also be only one highlighted here. stage
     must leave" · "allow other to be highlighted". */
  const pressed = (html: string) => [...html.matchAll(/data-maker-bar-item="([^"]+)"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-maker-bar-item="([^"]+)"/g)].map((m) => m[1] ?? m[2]);
  const none = pressed(await paint());
  assert.deepEqual(none, ['rsvp'], 'with no tool open the stage is the one highlight');
  for (const key of ['logo', 'hero', 'reveal', 'love-story'] as const) {
    const on = pressed(await paint({ selection: { kind: 'tool', key } }));
    assert.deepEqual(on, [key], `with ${key} open, ${key} alone is highlighted (got ${on.join(', ')})`);
  }
});
