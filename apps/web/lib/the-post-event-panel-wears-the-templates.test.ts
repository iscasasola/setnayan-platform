/**
 * the-post-event-panel-wears-the-templates.test.ts — THE POST EVENT STAGE'S PANEL IS TEMPLATE ROWS.
 *
 * Owner, 2026-10-08: *"we want the whole app to be adaptive to the same feel"* · *"Then Stages that matter to
 * Invitation and RSVP / Then the rest of event hub"*. `INTERACTION_RULES.md` § 9 (kinds 3 Switch · 6 Form row ·
 * 7 ⓘ · 9 Action button · 10 Field · 18 Reorder) and § 2: *"Yes/No settings → a switch."* The panel
 * (`post-event-scene-panel.tsx`) was the old inspector: a "Shown" pill whose WORDS flipped on a tap, hand-made
 * Earlier / Later pills, pencil pills, a `<dl>`, five printed sentences, a bare box for a part's words.
 *
 *   (1) SHOWN IS THE ONE SWITCH — rendered: one `role="switch"`, on while guests meet the scene, and its NAME never
 *       changes with its state (a control that cycles its words is not a switch). It saves the scene's switch into
 *       the draft (EXECUTED: the patch it sends), drawn at the tap.
 *   (2) ORDER IS THE REORDER KIND'S ARROWS, AS HOUSE ACTIONS — Earlier · Later; the one that cannot move is not
 *       pressable (first / last of the run, or a place that is fixed); a move saves the run's new order (EXECUTED).
 *   (3) ITS PARTS ARE DOORS — one house action per part the scene's style draws, each opening that part's sheet.
 *   (4) NOTHING IS PRINTED THAT IS NOT A FACT OR A FAILURE — what the scene is and what fills it are quiet rows;
 *       every sentence the panel printed is behind the ⓘ of the row it explains, word for word; "Saved to your
 *       draft…" is gone; a read that FAILED is still said ON the panel, in red.
 *   (5) A PART'S WORDS ARE A TYPED FORM ROW — a pill reading the couple's words (or "Written from your day"), the
 *       body a long one; no box on arrival; "Use the written line" is the quiet action, only once they wrote their
 *       own; a refusal is the row's own (said once).
 *   (6) WHAT IT SAVES IS UNCHANGED — every control posts the ONE draft door (`intent=save`) with the story's own
 *       keys (or the section's canvas for a shared style); there is no live writer and no link out.
 *   (7) THE WATCH — the panel hand-makes no switch, button, field or dropdown.
 *
 * Mutations seen RED (2026-10-09), each restored: the switch's name flipping with its state → (1); the switch on
 * while the scene is hidden → (1); Shown saving `!shown` → (1); Earlier pressable at the first place → (2); the
 * arrows hand-made `<button>`s again → (2) and (7); a part's door calling `onPart` with the wrong part → (3); a
 * caption printed on the panel again → (4); a sentence reworded → (4); the failed read tucked behind an ⓘ → (4); the
 * words' reset shown before anything is written → (5); the body no longer a long box → (5); a word's refusal also
 * said on the panel's line → (5); a second writer (`fetch`) in the file → (6); a refused save leaving the tap
 * drawn → (6); a hand-made `<input>` back → (7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { postEventMove, postEventRun, postEventShow, type PostEventArrangement } from './post-event-draft';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The panel asks the app router for a refresh; a test run has none mounted. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PANEL = 'app/dashboard/[eventId]/website/editor/_components/post-event-scene-panel.tsx';
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const seen = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const EMPTY: PostEventArrangement = { sections: {}, sectionOrder: null, sceneLooks: {}, customIds: [] };
type Tile = Record<string, unknown>;
/** "What guests told you" — moves in the run, has its own switch, two word parts. */
const WISHES: Tile = { kind: 'post-event', key: 'p:wishes', anchor: 'p:wishes', scene: 'wishes', label: 'Wishes', status: 'auto', hidden: false, drawn: true, position: 3, template: null, source: 'the wishes your guests left', note: null, open: false, pinned: false, switchKey: 'kwento', runKey: 'kwento' };
const COVER: Tile = { ...WISHES, key: 'p:cover', anchor: 'p:cover', scene: 'cover', label: 'The cover', source: 'your names and your day', pinned: true, switchKey: null, runKey: null };
async function panel(props: Record<string, unknown> = {}): Promise<string> {
  const { PostEventScenePanel } = await import(`../${PANEL}`);
  return paint(
    h(PostEventScenePanel, {
      eventId: 'ev-1',
      tile: WISHES,
      arrangement: EMPTY,
      writtenAt: '2026-12-13T07:04:00Z',
      dayHappened: true,
      eventType: 'wedding',
      sectionCanvases: {},
      draftAction: async () => ({ ok: true }),
      onPart: () => {},
      ...props,
    } as Record<string, unknown>),
  );
}

/* ── (1) Shown ────────────────────────────────────────────────────────── */

test('(1) Shown is the ONE switch: on while guests meet the scene, its name never flips — and it saves the scene’s own switch', async () => {
  const shown = await panel();
  const hidden = await panel({ tile: { ...WISHES, hidden: true } });
  for (const [html, on] of [[shown, true], [hidden, false]] as const) {
    assert.equal(count(html, /role="switch"/g), 1, 'the panel does not draw exactly one switch');
    assert.match(html, new RegExp(`<button type="button" role="switch" aria-checked="${on}" aria-label="Shown to guests" data-form-row-switch=""`), `hidden=${!on}: the switch is not ${on ? 'on' : 'off'}`);
    assert.match(html, new RegExp(`data-post-event-shown="${on ? 'shown' : 'hidden'}"`));
    // THE CLAIM: its name is the same on and off (the old pill read "Hidden from guests" when off).
    assert.match(html, />Shown to guests</);
    assert.doesNotMatch(html, /Hidden from guests|data-post-event-eye/, 'the control flips its words with its state');
    assert.match(html, /<span aria-hidden="true" data-on="(true|false)" class="sn-switch /, 'the switch is not the one drawing');
  }
  // A scene with no switch of its own (the cover) draws none.
  assert.equal(count(await panel({ tile: COVER }), /role="switch"/g), 0);
  // What a tap sends — drawn first, then the story's own key into the draft.
  const src = read(PANEL);
  assert.match(src, /onChange=\{\(shown\) => void save\(\{ editorial: postEventShow\(arrangement, tile\.switchKey!, shown\) \}, \{ hidden: !shown \}\)\}/);
  assert.match(src, /on=\{!hiddenNow\}/);
  assert.match(src, /const hiddenNow = drawn\?\.hidden \?\? tile\.hidden;/);
  // EXECUTED: hiding writes the switch off; showing takes the key away again (the default is never frozen in).
  assert.deepEqual(postEventShow(EMPTY, 'kwento', false), { sections: { kwento: false } });
  assert.deepEqual(postEventShow({ ...EMPTY, sections: { kwento: false } }, 'kwento', true), { sections: {} });
});

/* ── (2) Order ────────────────────────────────────────────────────────── */

test('(2) Order is the arrows as house actions: Earlier · Later; the one that cannot move is not pressable', async () => {
  const html = await panel();
  const arrows = [...html.matchAll(/<button type="button"( disabled="")? aria-label="(Earlier|Later)"[^>]*class="([^"]*)"[^>]*data-testid="post-event-move-(earlier|later)"/g)];
  assert.deepEqual(arrows.map((m) => `${m[2]}:${m[1] ? 'off' : 'on'}`), ['Earlier:on', 'Later:on'], 'the two arrows are not both drawn, or one is dead in the middle of the run');
  for (const m of arrows) assert.ok(m[3]!.split(' ').includes('ab') && m[3]!.split(' ').includes('ab-neutral'), 'an arrow is not the house action');
  // First of the run: Earlier cannot be pressed. Last: Later cannot.
  const run = postEventRun(EMPTY);
  const first = await panel({ tile: { ...WISHES, scene: 'ch-1', runKey: 'chapters' } });
  assert.equal(run[0], 'chapters', 'anti-vacuity: the chapters are no longer first in the run');
  assert.match(first, /<button type="button" disabled="" aria-label="Earlier"/);
  assert.match(first, /<button type="button" aria-label="Later"/);
  // A place that is fixed has no Order row at all — it says so in a quiet row.
  const cover = await panel({ tile: COVER });
  assert.doesNotMatch(cover, /post-event-move-|data-post-event-order/);
  assert.match(cover, /data-form-row="place" data-form-row-kind="fact"[\s\S]*?>Place<[\s\S]*?>Fixed<[\s\S]*?The story always opens here\./);
  // What a press sends: the run with the scene one place earlier / later (EXECUTED on the story's own rule).
  const src = read(PANEL);
  assert.match(src, /const earlier = arrangement \? postEventMove\(arrangement, scene, -1\) : null;\s*const later = arrangement \? postEventMove\(arrangement, scene, 1\) : null;/);
  assert.match(src, /disabled=\{pending \|\| !earlier\}[^>]*onClick=\{\(\) => earlier && void save\(\{ editorial: earlier \}, \{ moved: 'earlier' \}\)\}/);
  assert.match(src, /disabled=\{pending \|\| !later\}[^>]*onClick=\{\(\) => later && void save\(\{ editorial: later \}, \{ moved: 'later' \}\)\}/);
  const at = run.indexOf('kwento');
  const moved = postEventMove(EMPTY, 'wishes', -1)!.sectionOrder!;
  assert.equal(moved.indexOf('kwento'), at - 1, 'Earlier does not move the scene one place earlier');
  assert.equal(postEventMove(EMPTY, 'ch-1', -1), null);
});

/* ── (3) Its parts ────────────────────────────────────────────────────── */

test('(3) Its parts are doors: one house action per part the style draws, each opening that part', async () => {
  const html = await panel();
  const doors = [...html.matchAll(/<button type="button" aria-label="([^"]+)"[^>]*class="([^"]*)"[^>]*data-testid="post-event-part-(\w+)"/g)];
  assert.deepEqual(doors.map((m) => `${m[3]}:${m[1]}`), ['label:Label', 'heading:Heading'], 'the scene’s parts are not its style’s word parts');
  for (const m of doors) assert.ok(m[2]!.split(' ').includes('ab'), 'a part’s door is not the house action');
  assert.match(html, /data-form-row="parts"[\s\S]*?>Its parts</);
  // No sheet to open them in (the shell handed no `onPart`) → no doors drawn.
  assert.doesNotMatch(await panel({ onPart: null }), /post-event-part-|Its parts/);
  assert.match(read(PANEL), /\{parts\.map\(\(p\) => \(\s*<ActionButton key=\{p\} tone="neutral" icon=\{PencilLine\} label=\{HUB_ELEMENT_LABEL\[p\]\} data-testid=\{`post-event-part-\$\{p\}`\} onClick=\{\(\) => onPart\(p\)\} \/>/);
});

/* ── (4) nothing printed but facts and failures ───────────────────────── */

test('(4) nothing is printed that is not a fact or a failure: every sentence is behind an ⓘ, word for word; a failed read is said', async () => {
  const { POST_EVENT_ABOUT } = await import(`../${PANEL}`);
  // The sentences are the panel's own, unchanged.
  assert.deepEqual(POST_EVENT_ABOUT, {
    waiting: 'This scene fills itself from your day. Until then your guests never meet an empty box — you see it here, waiting, in the style you pick.',
    written: 'Written from what happened. Tap any part of the scene to edit it here.',
    sharedStyle: 'This style is shared with the same scene on your other stages — pick once.',
    galleryShare: 'The day’s chapters and the gallery share one switch — hiding one hides both.',
    chaptersMove: 'The day’s chapters move together, in the order they happened.',
  });
  const cases = [
    await panel(),
    await panel({ tile: { ...WISHES, status: 'waiting', note: 'the wishes your guests leave' }, writtenAt: null, dayHappened: false }),
    await panel({ tile: { ...WISHES, scene: 'gallery', switchKey: 'gallery', runKey: 'gallery' }, sectionCanvases: { our_photos: {} } }),
    await panel({ tile: { ...WISHES, scene: 'ch-1', runKey: 'chapters', switchKey: 'gallery' }, sectionCanvases: { schedule: {} } }),
  ];
  for (const html of cases) {
    for (const line of Object.values(POST_EVENT_ABOUT) as string[]) assert.ok(!seen(html).includes(line.slice(0, 40)), `a caption is printed on the panel: ${line.slice(0, 40)}…`);
    assert.doesNotMatch(html, /Saved to your draft|goes live when you press Apply|<dl\b|<dt\b/, 'the "Saved to your draft" line or the old list is back');
  }
  // …and each row that has something to explain carries its ⓘ.
  assert.match(cases[0]!, /aria-label="About Wishes"/, 'the scene has no ⓘ');
  assert.match(cases[2]!, /aria-label="About Shown to guests"/, 'the shared switch is not explained');
  assert.match(cases[3]!, /aria-label="About Order"/, 'the chapters’ shared move is not explained');
  assert.doesNotMatch(cases[0]!, /aria-label="About (Shown to guests|Order)"/, 'an ⓘ with nothing to say');
  const src = read(PANEL);
  assert.match(src, /about=\{tile\.switchKey === 'gallery' \? \{ words: POST_EVENT_ABOUT\.galleryShare \} : null\}/);
  assert.match(src, /about=\{tile\.runKey === 'chapters' \? \{ words: POST_EVENT_ABOUT\.chaptersMove \} : null\}/);
  assert.match(src, /<span>\{tile\.status === 'waiting' \? POST_EVENT_ABOUT\.waiting : POST_EVENT_ABOUT\.written\}<\/span>\s*\{home \? <span>\{POST_EVENT_ABOUT\.sharedStyle\}<\/span> : null\}/);
  // THE FACTS stay on the panel: what the scene is, when it was written, what fills it.
  // (The lone "i" is the ⓘ's own mark; the stamp's shape is the device's — only that it is there is held.)
  assert.match(seen(cases[0]!), /This scene i Auto · written [\w ,:]+\d Filled from: the wishes your guests left|This scene i Auto · written [\w ,:]+ (AM|PM|am|pm) Filled from: the wishes your guests left/);
  assert.match(seen(cases[1]!), /This scene i Not yet · fills itself after the day What fills it: the wishes your guests leave/);
  // A READ THAT FAILED is said ON the panel, in red — never behind an ⓘ — and no control is drawn on a guess.
  const unread = await panel({ arrangement: null });
  assert.match(unread, /<p role="alert" data-post-event-unread="" class="[^"]*text-danger-700">Your story’s scenes could not be read just now — open the Maker again in a moment\.<\/p>/);
  assert.doesNotMatch(unread, /role="switch"|post-event-move-/, 'a switch or an arrow is drawn over a story that could not be read');
  assert.doesNotMatch(src, /terracotta/, 'a failure is said in the gold');
});

/* ── (5) a part's words ───────────────────────────────────────────────── */

test('(5) a part’s words are a typed Form row: a pill, the body a long box; the quiet reset only once they wrote their own', async () => {
  const { PostEventWordsField } = await import(`../${PANEL}`);
  const field = (part: string, arrangement: PostEventArrangement) =>
    paint(h(PostEventWordsField, { eventId: 'ev-1', scene: 'wishes', part, arrangement, draftAction: async () => ({ ok: true }) } as Record<string, unknown>));
  const none = await field('heading', EMPTY);
  assert.match(none, /^<div data-post-event-words="heading"><div data-form-rows="post-event-words"/);
  assert.match(none, /data-form-row="words-heading" data-form-row-kind="typed"/);
  assert.match(none, /data-form-row-pill="typed" aria-label="Heading: not set yet\. Tap to change"[^>]*><span[^>]*text-ink\/45[^>]*><span>Written from your day<\/span>/);
  assert.match(seen(none), /Written from what happened$/);
  assert.doesNotMatch(none, /<input\b|<textarea\b|Use the written line|edited by you/, 'a box is open on arrival, or the reset is offered with nothing to reset');
  const own = await field('heading', { ...EMPTY, sceneLooks: { wishes: { words: { heading: 'What you told us' } } } } as PostEventArrangement);
  assert.match(own, /aria-label="Heading: What you told us\. Tap to change"/);
  assert.match(seen(own), /Written from what happened · edited by you/);
  const reset = /<div class="flex justify-end pb-2" data-post-event-words-reset=""><button type="button" aria-label="Use the written line"[^>]*class="([^"]*)"/.exec(own);
  assert.ok(reset, 'the reset is not offered once they wrote their own');
  assert.deepEqual(reset![1]!.split(' ').filter((c) => c === 'ab' || c === 'quiet' || c === 'ab-main'), ['ab', 'quiet'], 'the reset is not the house quiet action');
  const src = read(PANEL);
  assert.match(src, /long=\{part === 'body'\}\s*maxLength=\{max\}/, 'the body is not a long box, or a word can outgrow its limit');
  // Kept ONCE, through the story's own rule; '' or the reset go back to the written line; the row says a refusal itself.
  assert.match(src, /const r = postEventSetWords\(arrangement, scene, part, value\);\s*if \(!r\) return \{ ok: true \};\s*if \('refused' in r\) return \{ ok: false, error: `Keep it under \$\{max\} characters\.` \};\s*return save\(\{ editorial: r \}, \{\}, true\);/);
  assert.match(src, /void commit\(null\)\.then\(\(r\) => \{\s*if \(!r\.ok\) setProblem\(`\$\{name\} did not save\. \$\{r\.error\}`\);/);
  assert.equal(count(src, /if \(!said\) setError\(/g), 2, 'a refusal the row says is also said on the panel’s line');
});

/* ── (6) what it saves is unchanged ───────────────────────────────────── */

test('(6) what it saves is unchanged: the ONE draft door, the story’s own keys — no live writer, no link out', () => {
  const src = read(PANEL);
  assert.equal(count(src, /draftAction\(eventId, fd\)/g), 1, 'the panel has more than one writer');
  assert.match(src, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(patch\)\);/);
  assert.doesNotMatch(src, /\bfetch\(|from '[^']*actions'|next\/link|href=|<form\b/, 'a second writer, a server action of its own, a link out or a form');
  // A shared style is the section's own canvas, merged whole; every other pick is the story's key.
  assert.match(src, /save\(\{ widgets: \{ \[home\]: \{ canvas: \{ \.\.\.\(sectionCanvases\[home\] \?\? \{\}\), style: id \} \} \} \}, \{ style: id \}\);/);
  assert.match(src, /const patch = postEventSetStyle\(arrangement, scene, id, def\);\s*if \(patch\) save\(\{ editorial: patch \}, \{ style: id \}\);/);
  // Drawn at the tap, before the save — and put back when it is refused.
  assert.match(src, /setDrawn\(draw\);\s*return new Promise<SaveAnswer>\(\(answer\) => \{\s*start\(async \(\) => \{/);
  assert.equal(count(src, /setDrawn\(null\);\s*if \(!said\) setError\(/g), 2, 'a refused save leaves the tap drawn');
});

/* ── (7) the watch ────────────────────────────────────────────────────── */

const HAND_MADE: Array<{ what: string; re: RegExp }> = [
  { what: 'a text box of its own (`<textarea>`)', re: /<textarea\b/ },
  { what: 'a field of its own (`<input>`)', re: /<input\b/ },
  { what: 'a native `<select>`', re: /<select\b/ },
  { what: 'a switch of its own (`role="switch"` — use `SwitchRow`)', re: /role="switch"|aria-checked/ },
  { what: 'a bare `<button>` (an action is `ActionButton`)', re: /<button\b/ },
  { what: 'the old inspector’s row (`IRow` / `ISection`)', re: /<IRow\b|<ISection\b|inspector-kit/ },
  { what: 'the old `InfoTip`', re: /InfoTip/ },
  { what: 'a dropdown outside a row (`<PickMenu>`)', re: /<PickMenu\b/ },
  { what: 'a colour written for a control', re: /#[0-9a-fA-F]{6}\b|\btext-white\b|\bbg-ink(?![\/\w-])|mulberry/ },
];

test('(7) the watch: the Post Event panel hand-makes no switch, button, field or dropdown', () => {
  const src = read(PANEL);
  assert.ok(src.length > 6000, 'anti-vacuity: the panel was not read');
  for (const { what, re } of HAND_MADE) {
    const line = src.split('\n').find((l) => re.test(l));
    assert.equal(line, undefined, `the Post Event panel draws ${what}: ${line?.trim().slice(0, 120)}`);
  }
  assert.match(src, /import \{ FactRow, FormRow, FormRows, SwitchRow, TypedRow \} from '@\/app\/_components\/form-row';/);
  assert.match(src, /import \{ ActionButton \} from '@\/components\/action-button';/);
  for (const used of ['<SwitchRow', '<TypedRow', '<FactRow', '<FormRow', '<ActionButton']) assert.ok(src.includes(used), `${used} is imported and never drawn`);
});
