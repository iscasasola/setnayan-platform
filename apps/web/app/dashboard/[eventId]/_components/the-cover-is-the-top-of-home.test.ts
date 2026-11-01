/**
 * ☀ THE COVER IS THE TOP OF HOME — nothing renders above it; every prompt is a line of the Today list (owner
 * 2026-10-29, verbatim, over a phone screenshot of his Home: *"The popup for the access and other popups above the
 * header can be presented better"*).
 *
 * What he saw: above the cover band ("WEDDING · DECEMBER 18, 2026 / Indalecio & Claire / ⚙") sat a plain block —
 * "Your coordinator has joined — what can they do? ⓘ … [Limited] [Full access]" — and four prompts in all could stack
 * there (the coordinator's access, access requests, a date change, "Event day soon"). They are now `HomeTodayItem`
 * lines UNDER the cover, first in the Today list.
 *
 * Properties:
 *   1 · Home's first screen opens on the cover: `<HomeCoverBand` is the section's FIRST element, and the asks slot
 *       sits after it and before the Today line.
 *   2 · Home's page draws nothing visible before the phase branches except what has no box (tours, the preloader) or
 *       what only the day-of console draws (it has no cover); the four prompts live ONLY in `todayAsks`, which is
 *       handed to the first screen and otherwise drawn only where there is no cover.
 *   3 · Each prompt IS a Today line (`HomeTodayItem` / `TodaySheetItem`), never a tile of its own.
 *   4 · The coordinator's line names the SHOP that joined — never the bare word "coordinator" — and the name is
 *       sought from every couple-readable source, the shop's own access request included (the live seat has no label).
 *
 * Sabotage (each run once, each went RED): moving `<CoordinatorLevelCard … />` back above the phase branch (2) ·
 * rendering `{asks}` before `<HomeCoverBand` (1) · the line's words set to a bare "Your coordinator joined" (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { levelTodayWords } from '@/lib/coordinator-access-level';

const WEB = join(__dirname, '../../../..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const DIR = 'app/dashboard/[eventId]/_components';

const ASKS = ['CoordinatorLevelCard', 'AccessRequestsDoorway', 'DateChangeDoorway', 'EventDayPrepCta'] as const;

/** Drawn before the phase branch, and why each may be: none of them puts a box above the cover. */
const NO_BOX_OR_NO_COVER: Readonly<Record<string, string>> = {
  MiniTour: 'a first-visit tour — an overlay, no box in the flow',
  Spotlight: 'a spotlight tour — an overlay, no box in the flow',
  AutoPreloadOnEventDay: 'renders null (a background pre-load)',
  ReadyForNoSignal: 'the event-day console only (gated on dayOfActive) — that view has no cover',
  DayOfModeGrid: 'the event-day console only (gated on dayOfActive) — that view has no cover',
  DayPapicRow: 'a prop of DayOfModeGrid',
};

test('1 · the first screen opens on the cover; the asks sit under it, before the Today line', () => {
  const s = src(`${DIR}/home-first-screen.tsx`);
  const body = s.slice(s.indexOf('export function HomeFirstScreen('));
  const open = body.indexOf('<section data-home-first-screen');
  assert.ok(open > -1, 'the first screen lost its section');
  const firstTag = body.slice(open + 1).match(/<([A-Za-z][\w.]*)/);
  assert.equal(firstTag?.[1], 'HomeCoverBand', `something renders above Home's cover: <${firstTag?.[1]}>`);
  const cover = body.indexOf('<HomeCoverBand');
  const asks = body.indexOf('{asks}');
  const today = body.indexOf('<HomeToday ');
  assert.ok(asks > cover, 'the asks render above the cover');
  assert.ok(asks < today, 'the asks are not first in the Today list');
});

test('2 · Home draws nothing above the cover; the four prompts live only in todayAsks', () => {
  const page = src('app/dashboard/[eventId]/page.tsx');
  const ret = page.slice(page.indexOf('<LastSeenCapture page="home"'));
  const branch = ret.indexOf('{dayOfActive ? (\n        <>');
  assert.ok(branch > 0, 'the phase branch moved — re-aim this guard at it');
  const before = ret.slice(0, branch);
  for (const m of before.matchAll(/<([A-Z]\w*)/g)) {
    const tag = m[1]!;
    if (tag === 'LastSeenCapture') continue;
    assert.ok(tag in NO_BOX_OR_NO_COVER, `<${tag}> renders above Home's cover — make it a Today line (HomeTodayItem) instead`);
  }
  for (const tag of ['ReadyForNoSignal', 'DayOfModeGrid']) {
    assert.match(before, new RegExp(`\\{dayOfActive \\? \\(\\s*<${tag}`), `<${tag}> is no longer the day-of console's alone`);
  }
  // The asks: in the todayAsks block, handed to the first screen, otherwise only where there is no cover.
  const block = page.slice(page.indexOf('const todayAsks = ('), page.indexOf('const homeFirstScreen = ('));
  for (const a of ASKS) {
    assert.equal(page.split(`<${a} `).length - 1, 1, `<${a}> is drawn more than once`);
    assert.ok(block.includes(`<${a} `), `<${a}> left the Today asks`);
  }
  assert.ok(block.indexOf('<CoordinatorLevelCard ') < block.indexOf('<AccessRequestsDoorway '), 'the coordinator’s access is not first');
  assert.match(page, /asks=\{todayAsks\}/, 'the Today asks are not handed to the first screen');
  assert.match(before, /\{dayOfActive \|\| afterActive \? todayAsks : null\}/, 'the Today asks render above the cover');
  assert.equal(page.split('todayAsks').length - 1, 3, 'todayAsks is drawn somewhere else');
});

test('3 · each prompt IS a Today line, never a tile of its own', () => {
  const files: Record<string, RegExp> = {
    [`${DIR}/coordinator-level-ask.tsx`]: /<HomeTodayItem\b/,
    [`${DIR}/access-requests-doorway.tsx`]: /<HomeTodayItem\b/,
    [`${DIR}/date-change-doorway.tsx`]: /<TodaySheetItem\b/,
    'app/_components/event-day-prep-cta.tsx': /<HomeTodayItem\b/,
  };
  for (const [f, re] of Object.entries(files)) {
    const s = src(f);
    assert.match(s, re, `${f} is not a Today line`);
    assert.doesNotMatch(s, /className="sn-tile/, `${f} still draws a tile`);
  }
  // The answer opens the house Sheet — the shared one.
  assert.match(src(`${DIR}/coordinator-level-ask.tsx`), /import \{ Sheet \} from '@\/app\/_components\/sheet';/);
  assert.match(src(`${DIR}/home-parts.tsx`), /import \{ Sheet \} from '@\/app\/_components\/sheet';/);
});

test('4 · the coordinator’s line names the SHOP that joined, found from every couple-readable source', () => {
  assert.equal(levelTodayWords('The Wedding Project'), 'The Wedding Project joined as your coordinator');
  assert.match(levelTodayWords(null), /^A supplier joined/, 'a missing name falls back to a bare role word');
  const ask = src(`${DIR}/coordinator-level-ask.tsx`);
  assert.match(ask, /words=\{levelTodayWords\(ask\.shop\)\}/, 'the Today line does not name the shop');
  assert.match(ask, /logoUrl=\{openFor\.logoUrl\}/, 'the sheet lost the shop’s logo');
  const card = src(`${DIR}/coordinator-level-card.tsx`);
  assert.match(
    card,
    /shop: s\.display_label\?\.trim\(\) \|\| shop\?\.name \|\| askedName\.get\(s\.user_id!\) \|\| null,/,
    'the shop name is not sought label → shop → its access request',
  );
  assert.match(card, /\.from\('event_access_requests'\)/, 'the shop’s own request is not read — the live seat has no label');
  assert.match(card, /\.from\('event_vendors'\)/, 'the shop’s booking name is not read');
});
