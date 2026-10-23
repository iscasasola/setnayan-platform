/**
 * GUARD — AN EMPTY DISCOVER SHELF IS ONE LINE AND ONE ACTION (owner, 23 Oct 2026).
 *
 * Owner rules this holds: visible copy is a title + one short line, every detail
 * inside an ⓘ; a frame only on something you press; no small explainer labels
 * beside headings (DECISION_LOG 2026-10-01 "NO SMALL EXPLAINER LABELS"). Measured
 * on live prod before this change: grey "soonest first" / "public events only ·
 * the host approves who joins" / "public profiles, most followed first" beside
 * the headings, and two-sentence paragraphs inside dashed boxes nobody could press.
 *
 * 🔑 RENDERED, NOT GREPPED. The shelves are drawn in every empty and failed state
 * and read back as HTML, with every ⓘ popover cut out first (what is behind an ⓘ
 * is allowed to be long). Then, per shelf:
 *   · no `fd-invite` (the dashed card) and no `fd-rule` (the grey house rule);
 *   · a `fd-meta` beside a heading only says "couldn't load" — a status;
 *   · the empty block shows ONE line (≤ 60 characters, one sentence) and ONE
 *     pressable action.
 * The feed's own shelves (Shops, real weddings, Trending) are a source check —
 * rendering `FrontDoorFeed` needs the whole front-door data shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only' || /\.css$/.test(request)) return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));

type Shelf = { status: 'ok'; items: never[] } | { status: 'unavailable' };
const EMPTY: Shelf = { status: 'ok', items: [] };
const DOWN: Shelf = { status: 'unavailable' };

async function paint(people: Shelf | null, world: Shelf, peopleToFollow: Shelf): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DiscoverEventShelves, PeopleToFollowShelf } = await import('./front-door-discover');
  const discover = {
    signedIn: people !== null,
    people,
    world,
    viewerRegionLabel: 'Metro Manila',
    peopleToFollow,
  } as unknown as React.ComponentProps<typeof DiscoverEventShelves>['discover'];
  return renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(DiscoverEventShelves, { discover }),
      React.createElement(PeopleToFollowShelf, { discover }),
    ),
  );
}

/** The markup with every ⓘ popover body removed — what is on the page before a press. */
function visible(html: string): string {
  return html.replace(/<span[^>]*role="tooltip"[^>]*>[\s\S]*?<\/span><\/span>/g, '');
}

const text = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&rsquo;|’/g, "'").trim();

function sections(html: string): string[] {
  return [...html.matchAll(/<section\b[\s\S]*?<\/section>/g)].map((m) => m[0]);
}

test('every empty or failed Discover shelf is one line + one action, details behind the ⓘ', async () => {
  let shelves = 0;
  for (const [what, people, world, ptf] of [
    ['signed in, all empty', EMPTY, EMPTY, EMPTY],
    ['signed in, all refused', DOWN, DOWN, DOWN],
    ['signed out, empty', null, EMPTY, EMPTY],
  ] as const) {
    const html = await paint(people, world, ptf);
    for (const sec of sections(visible(html))) {
      shelves++;
      const name = /data-discover-shelf="([^"]+)"/.exec(sec)?.[1] ?? '?';
      const where = `${what} · ${name}`;
      assert.doesNotMatch(sec, /fd-invite/, `${where}: a dashed invite card is back — a frame nobody presses`);
      assert.doesNotMatch(sec, /fd-rule/, `${where}: a grey explainer label beside the heading is back`);
      for (const m of sec.matchAll(/class="fd-meta"[^>]*>([\s\S]*?)<\/span>\s*<\/h2>/g)) {
        assert.match(text(m[1]!), /couldn't load/, `${where}: an explainer label beside the heading: "${text(m[1]!)}"`);
      }
      const empty = /data-empty-shelf=""[\s\S]*?<\/a>\s*<\/div>/.exec(sec)?.[0];
      assert.ok(empty, `${where}: the empty shelf has no one-line block`);
      const lines = [...empty.matchAll(/class="fd-empty-line"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1]!));
      assert.equal(lines.length, 1, `${where}: expected ONE visible line, saw ${lines.length}`);
      const line = lines[0]!;
      assert.ok(line.length <= 60, `${where}: the line is ${line.length} characters — the rest belongs in the ⓘ: "${line}"`);
      assert.ok((line.match(/[.!?](\s|$)/g) ?? []).length <= 1, `${where}: more than one sentence on the page: "${line}"`);
      assert.equal((empty.match(/<a\b/g) ?? []).length, 1, `${where}: the empty shelf must offer exactly ONE action`);
      assert.match(empty, /<a\b[^>]*class="fd-btn-quiet"/, `${where}: the one action is not a pressable button`);
    }
  }
  assert.equal(shelves, 8, `rendered ${shelves} shelves — expected 3+3+2; the read is wrong`);
});

test("the feed's own shelves (Shops, real weddings, Trending) use the same one-line block", () => {
  const feed = stripComments(readFileSync(join(HERE, 'front-door-feed.tsx'), 'utf8'));
  assert.doesNotMatch(feed, /fd-invite|fd-rule|fd-notice/, 'the feed draws a dashed card, a grey rule or a notice box again');
  assert.ok((feed.match(/<EmptyShelf\b/g) ?? []).length >= 3, 'Shops, real weddings and Trending must each end in <EmptyShelf>');
  assert.doesNotMatch(feed, /some with video, some\s+without/, 'the New uploads explainer is back beside its heading');
});
