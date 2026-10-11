import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STAGE_SCENES } from '@/lib/stage-scenes';
import { makerStagesPageOf, makerStagesPages } from '@/lib/maker-stage-filing';
import { labDraftCookies, labDraftStep, labDraftedRows, labRows, LAB_ROWS_COOKIE } from './lab-draft';
import { emptyHubDraft } from '@/lib/hub-draft';
import { labStageTiles } from './lab-navigator';
import { LAB_SAMPLE } from './guest/lab-sample';

/* `tsx --test` compiles a `.tsx` component to the classic runtime — React is in scope before one is loaded. */
(globalThis as unknown as { React: unknown }).React = React;

/**
 * 🧪 THE LAB'S CANVAS DRAWS THE STAGE THE MAKER LISTS — AND ITS STUDIO IS THE SAME EVENT
 * (the walk of 2026-10-11: P03 · P04 · P07 · P11 · P12).
 *
 * The lab is the only place anyone but the owner can walk the Maker. Each of these was the LAB showing something a
 * signed-in couple's Maker does not: every stage carrying the whole invitation, tabs that moved a highlight over one
 * long page, "Only you see this" on a guest's page, a Seat plan tile that opened the March, two dates and two venues.
 */

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'app', 'dev', ...p), 'utf8');
const GUEST = read('maker-lab', 'guest', 'page.tsx');

test('P12 — a stage draws its own parts: Save the Date and Post Event do not carry the invitation', () => {
  const rows = labRows();
  const std = labStageTiles(rows, 'save_the_date');
  for (const no of ['w:schedule', 'w:venue_map', 'w:dress_code', 'f:gifts', 'f:look', 'f:entourage', 'w:special_message']) assert.equal(std.includes(no), false, `Save the Date draws ${no}`);
  assert.deepEqual(std.filter((k) => k.startsWith('w:')), ['w:countdown', 'w:our_love_story']);
  const post = labStageTiles(rows, 'editorial');
  for (const no of ['w:countdown', 'w:schedule', 'w:venue_map', 'w:dress_code', 'f:gifts', 'f:look']) assert.equal(post.includes(no), false, `Post Event draws ${no}`);
  /* A stage's scenes are never outside the one table that says which scenes a stage has. */
  for (const stage of ['save_the_date', 'rsvp', 'event', 'editorial'] as const)
    for (const k of labStageTiles(rows, stage).filter((x) => x.startsWith('w:'))) assert.ok((STAGE_SCENES[stage] as readonly string[]).includes(k.slice(2)), `${stage} draws ${k}`);
  /* …and the canvas draws THAT list — it keeps no list of its own. */
  assert.doesNotMatch(GUEST, /\{mark\('w:countdown'\)\}\s*\{scene\.countdown\}/, 'the hand-written list is back');
});

const draw = async (props: { tiles: string[]; tab?: string; paged: boolean; stage?: 'rsvp' | 'save_the_date' }) => {
  const { LabStagePages } = await import('./guest/lab-stage');
  const given = Object.fromEntries(props.tiles.map((k) => [k, createElement('i', { 'data-node': k })]));
  return renderToStaticMarkup(
    createElement(LabStagePages, { stage: props.stage ?? 'rsvp', tiles: props.tiles, tab: props.tab, paged: props.paged, mark: (key: string) => createElement('span', { hidden: true, 'data-maker-section': key }), given, selfMarked: ['f:entourage'] }),
  );
};
/** The pages of a drawn stage: each `data-hub-tab` group, whether it is hidden, and the nodes in it, in order. */
const pagesOf = (html: string) =>
  [...html.matchAll(/<div data-hub-tab="([a-z]+)"([^>]*)>([\s\S]*?)(?=<div data-hub-tab=|<\/div>$)/g)].map((m) => ({
    key: m[1]!,
    hidden: /\shidden=""/.test(m[2]!),
    nodes: [...m[3]!.matchAll(/data-node="([^"]+)"/g)].map((n) => n[1]!),
  }));

test('P04 — the Invitation is four pages, one on screen, each part on the page the real filing puts it on', async () => {
  const tiles = labStageTiles(labRows(), 'rsvp');
  const pages = pagesOf(await draw({ tiles, paged: true }));
  const want = makerStagesPages('rsvp').map((p) => p.key);
  assert.deepEqual(pages.map((p) => p.key), want);
  assert.deepEqual(pages.map((p) => p.key), ['home', 'details', 'story', 'me']);
  assert.deepEqual(pages.filter((p) => !p.hidden).map((p) => p.key), ['home'], 'more than one page is on screen');
  for (const p of pages) for (const k of p.nodes) assert.equal(makerStagesPageOf('rsvp', k, want), p.key, `${k} is on ${p.key}`);
  assert.ok(pages.find((p) => p.key === 'details')!.nodes.includes('w:schedule'));
  assert.ok(pages.find((p) => p.key === 'home')!.nodes.includes('f:hero'));
  /* `?tab=me` opens that page — the address the Maker's tab reload puts back. */
  assert.deepEqual(pagesOf(await draw({ tiles, paged: true, tab: 'me' })).filter((p) => !p.hidden).map((p) => p.key), ['me']);
  /* A stage that is one page (Save the Date), and any page not asked for as tabs, has no groups at all. */
  assert.doesNotMatch(await draw({ tiles: labStageTiles(labRows(), 'save_the_date'), paged: true, stage: 'save_the_date' }), /data-hub-tab/);
  assert.doesNotMatch(await draw({ tiles, paged: false }), /data-hub-tab/);
  /* Each part is right after its marker, as the bridge finds it — and a self-marked one is not marked twice. */
  const one = await draw({ tiles, paged: false });
  assert.match(one, /<span hidden="" data-maker-section="w:schedule"><\/span><i data-node="w:schedule">/);
  assert.doesNotMatch(one, /data-maker-section="f:entourage"/);
  /* The canvas asks for tabs exactly when the Maker's address does. */
  assert.match(GUEST, /paged=\{sp\.tabs === '1' && !only\}/);
});

test('P02 — a scene moved or removed in the draft is drawn where the draft puts it, inside its own page', async () => {
  const save = (d: ReturnType<typeof emptyHubDraft>, patch: unknown) => labDraftStep(d, { intent: 'save', patch: JSON.stringify(patch) }, false).draft;
  const tilesOf = (d: ReturnType<typeof emptyHubDraft>) => labStageTiles(labDraftedRows(labDraftCookies(d, false)[LAB_ROWS_COOKIE] ?? undefined), 'rsvp');
  const details = async (d: ReturnType<typeof emptyHubDraft>) => pagesOf(await draw({ tiles: tilesOf(d), paged: true })).find((p) => p.key === 'details')!.nodes;
  const before = await details(emptyHubDraft());
  assert.deepEqual(before.slice(0, 3), ['w:schedule', 'w:venue_map', 'w:dress_code']);
  /* Later on the Schedule: the stage's whole order, as the Maker saves it. */
  const order = ['countdown', 'special_message', 'our_love_story', 'event_details', 'venue_map', 'schedule', 'dress_code', 'what_to_bring'];
  const moved = save(emptyHubDraft(), { widgets: Object.fromEntries(order.map((t, i) => [t, { stage_order: { rsvp: i } }])) });
  assert.deepEqual((await details(moved)).slice(0, 3), ['w:venue_map', 'w:schedule', 'w:dress_code']);
  const removed = save(moved, { widgets: { venue_map: { is_visible: false } } });
  assert.equal((await details(removed)).includes('w:venue_map'), false);
  assert.deepEqual((await details(save(removed, { widgets: { venue_map: { is_visible: true } } }))).slice(0, 3), ['w:venue_map', 'w:schedule', 'w:dress_code']);
});

test('P11 — "Only you see this" and the per-guest samples are the Maker’s canvas alone', () => {
  assert.match(GUEST, /const makerCanvas = sp\.editor === '1';/);
  assert.match(GUEST, /our_love_story: makerCanvas \? \(/, 'an empty scene is drawn on the guest page whoever asks');
  assert.match(GUEST, /const guestScene = \(which: 'greeting' \| 'pass' \| 'rsvp'\) =>\s*makerCanvas \? \(/);
  assert.match(GUEST, /const emptyScene = \(type: 'what_to_bring' \| 'our_photos'\) =>\s*makerCanvas \? \(/);
  /* Every mount of the empty-scene stand-in on the ordinary canvas sits behind that gate. */
  const mounts = [...GUEST.matchAll(/<MakerEmptyScene type=/g)].length;
  assert.equal(mounts, 2, 'a new empty-scene mount — is it behind `makerCanvas`?');
  /* The real page's rule, which this mirrors. */
  assert.match(readFileSync(join(process.cwd(), 'app', '[slug]', '_components', 'maker-empty-scene.tsx'), 'utf8'), /A guest\s+\* never receives this markup/);
});

test('P03 — the lab offers a Studio tile only for a page its Studio draws', () => {
  const page = read('maker-lab', 'page.tsx');
  assert.match(page, /const LAB_STUDIO_NOT_DRAWN: ReadonlyArray<\(typeof STUDIO_TILE_KEYS\)\[number\]> = \['seats'\];/);
  assert.match(page, /tiles: STUDIO_TILE_KEYS\.filter\(\(key\) => !LAB_STUDIO_NOT_DRAWN\.includes\(key\)\)\.map\(/);
  /* The reason is held by its own guard — `lib/the-seat-plan-chrome-wears-the-templates.test.ts` (4): no lab draws
     the seat plan. The day one does, that guard fails and this tile comes back with it. */
});

test('P07 — one sample event: Studio’s pages say the canvas’s date, venue, message and address', () => {
  const node = read('details-lab', 'details-lab-node.tsx');
  assert.match(node, /dateDisplay: fresh \? null : mj \? LAB_SAMPLE\.dateLabel : /);
  assert.match(node, /dateValue: fresh \? null : mj \? LAB_SAMPLE\.date : /);
  assert.match(node, /mj \? \{ role: 'reception', name: LAB_SAMPLE\.venue, address: LAB_SAMPLE\.venueAddress \}/);
  assert.match(node, /const specialMessage = mj \? LAB_SAMPLE\.message : /);
  assert.match(node, /const slug = mj \? LAB_SAMPLE\.slug : /);
  /* The Maker lab always asks for that shape… */
  assert.match(read('maker-lab', 'page.tsx'), /detailsLabNode\(\{ \.\.\.sp, shape: 'mj'/);
  /* …and the canvas and the Look sample draw the same facts. */
  /* (The names are the sample's until some are typed: the cover draws the drafted line — `labNamesFrom`.) */
  assert.match(GUEST, /const labNames = labNamesFrom\(\(await cookies\(\)\)\.get\(LAB_NAMES_COOKIE\)\?\.value, LAB_SAMPLE\.names\);/);
  assert.match(GUEST, /displayName=\{labNames\}\s*eventDate=\{LAB_SAMPLE\.date\}\s*venueName=\{LAB_SAMPLE\.venueLine\}/);
  assert.match(read('maker-lab', 'maker-lab-shell.tsx'), /words: \{ names: LAB_SAMPLE\.names, date: LAB_SAMPLE\.dateLabel, line: LAB_SAMPLE\.venue \}/);
  assert.equal(new Date(`${LAB_SAMPLE.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }), LAB_SAMPLE.dateLabel);
  assert.ok(LAB_SAMPLE.venueLine.startsWith(LAB_SAMPLE.venue));
});
