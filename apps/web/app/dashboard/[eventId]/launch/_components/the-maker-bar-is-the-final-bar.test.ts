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
 * THE BAR IS THE OWNER'S FINAL BAR — in order, with its one divider.
 *
 *   Save the Date · Invitation · On the Day · Post Event │ Details
 *
 * 🗂 OPTION B (owner 2026-09-28, verbatim: *"B. maximize this concept so it is
 * easier to find everything to populate the event hub"*; DECISION_LOG "OPTION B
 * — EVERYTHING MADE ONCE LIVES IN DETAILS; THE TOP MENU IS THE FOUR STAGES +
 * DETAILS"): the place menu is the four stages and Details — nothing else.
 * Logo, Hero, Reveal, Love Story and RSVP were pages here (the 2026-09-25/27
 * bar); they are items of Details now, and their old addresses land on them
 * (`lib/maker-details-items.ts` `movedPageItem`). Prints & Tickets folded in
 * the same way on 2026-09-28.
 *
 * Asserted on the RENDERED bar, not only the list: a list can be right while
 * the component drops an item, merges a group, or forgets a divider.
 */

/* Owner, 2026-09-28 (Option B): "Save the Date · Invitation · The Day · Post
   Event · Details" — the stages in their one vocabulary (`PUBLIC_STAGE_LABELS`). */
const FINAL = ['Save the Date', 'Invitation', 'On the Day', 'Post Event', 'Details'];

async function paint(
  opts: { hasWork?: boolean; liveStage?: 'rsvp' | null; selection?: { kind: 'tool'; key: 'details' } | null } = {},
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

test('the rendered bar has the five items in order and exactly one divider', async () => {
  const html = await paint();
  const order = FINAL.map((label) => html.indexOf(label.replace('&', '&amp;')));
  for (const [i, at] of order.entries()) assert.ok(at > -1, `"${FINAL[i]}" is missing from the bar`);
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i]! > order[i - 1]!, `"${FINAL[i]}" renders before "${FINAL[i - 1]}"`);
  }
  assert.equal((html.match(/data-maker-divider/g) ?? []).length, 1, 'one divider, two groups');
  const firstDivider = html.indexOf('data-maker-divider');
  assert.ok(order[3]! < firstDivider && firstDivider < order[4]!, 'the divider sits between the stages and Details');
  assert.doesNotMatch(html, /Prints &amp; Tickets/, 'Prints & Tickets is part of Details now — not a page of its own');
  // The five pages that moved into Details are not buttons of their own any more.
  for (const gone of ['logo', 'hero', 'reveal', 'love-story', 'rsvp-page']) {
    assert.doesNotMatch(html, new RegExp(`data-maker-bar-item="${gone}"`), `${gone} is still a page of its own on the bar`);
  }
});

test('the live stage wears the red dot, and only it', async () => {
  assert.equal(((await paint()).match(/Live today/g) ?? []).length, 1);
  assert.equal(((await paint({ liveStage: null })).match(/Live today/g) ?? []).length, 0);
});

test('no bar item is a dead button', async () => {
  const html = await paint();
  // Details is a real tool — it opens its page (which holds every print since the fold).
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
  // Two groups: the four stages, then Details (Option B, 2026-09-28).
  assert.equal(groups.length, 2, 'two groups');
  assert.match(groups[0]!, /\bms-auto\b/, 'the first group centres with margin-inline-start:auto');
  assert.match(groups[1]!, /\bme-auto\b/, 'the last group centres with margin-inline-end:auto');
});

test('ONE highlight in every state — a tool takes it from the stage, and any item can hold it', async () => {
  /* Owner 2026-09-25: "there should also be only one highlighted here. stage
     must leave" · "allow other to be highlighted". */
  const pressed = (html: string) => [...html.matchAll(/data-maker-bar-item="([^"]+)"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-maker-bar-item="([^"]+)"/g)].map((m) => m[1] ?? m[2]);
  const none = pressed(await paint());
  assert.deepEqual(none, ['rsvp'], 'with no tool open the stage is the one highlight');
  const on = pressed(await paint({ selection: { kind: 'tool', key: 'details' } }));
  assert.deepEqual(on, ['details'], `with Details open, Details alone is highlighted (got ${on.join(', ')})`);
});
