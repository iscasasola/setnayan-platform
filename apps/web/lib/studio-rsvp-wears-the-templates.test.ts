/**
 * studio-rsvp-wears-the-templates.test.ts — STUDIO › RSVP AND THE RSVP STAGE'S FORM ARE ONE LIST OF TEMPLATE ROWS.
 *
 * Owner, 2026-10-08: *"Then let us fix RSVP"* · *"we want the whole app to be adaptive to the same feel"* · *"field
 * follow form row style"* · *"cannot edit the other. no more check just (X) tapping out is auto accept or pressing
 * enter"* · the minimum-request rule: *"the least amount of request for the tasks to be done"*. The approved gallery
 * (`prototypes/control_templates_2026-10-08.html`): § 1 Pill selector · § 2 Dropdown · § 6 Form row (and its
 * "Reply by") · § 8 Calendar · § 10 Field · § 11 Chips.
 *
 *   (1) ONE SOURCE, TWO DOORS — Studio › RSVP and the stage's form draw the SAME rows, in the same order (rendered:
 *       the two lists are the same markup), on the Studio's white band and in the stage's panel.
 *   (2) EACH ROW IS ITS KIND, RENDERED — How guests answer is a pill selector; each word a typed pill reading the
 *       page's own words in grey until the couple writes theirs, with Start from ▾ under it and the quiet reset only
 *       once there is something to reset; a message opens the taller box. No box, no native field, no switch, no
 *       Save and no "Saved" in ANY door's rows — the two after-screens included.
 *   (3) THE SHARED PARTS, IN THE MAKER'S FRAME — Reply by is the date pill, How guests get in a dropdown in a row
 *       (its sentence behind the ⓘ), the six asks chips in a row; each still carries its part's own marks, and no
 *       part wraps its row. The chips are the SAME markup in Guests › Setup.
 *   (4) A PRESS IN STUDIO = ONE DRAFT WRITE, NO RENDER OF THE MAKER — held, the newest of a burst winning, the Apply
 *       count in the answer, on the Maker's own copy; typing in a row sends NOTHING until the row is left, and the
 *       page still shows the words as they are typed.
 *   (5) EVERYTHING WAITS FOR ✓ APPLY — the panel's only writers are the draft door and the Reply by part mounted
 *       with `draft`; no row says "Guests see this right away".
 *   (6) A REFUSAL IS SAID ONCE, WHERE IT HAPPENED — a word's own row says it (with Try again) and the panel's line
 *       stays quiet; every other control says it on the panel's one line, in red.
 *   (7) A WORD TAPPED ON THE CANVAS still brings its row up — and opens it.
 *   (8) THE WATCH — the panel hand-makes no field, switch, dropdown, date input or toggle button.
 *
 * Mutations seen RED (2026-10-08), each restored: the stage's form given its own list (the words first) → (1); the
 * Studio drawing How guests answer as a dropdown again → (1) and (8); a word's pill no longer reading the page's own
 * words → (2); the reset drawn while there is nothing to reset → (2); a message no longer `long` → (2); the asks'
 * frame dropping the part's marks → (3); the get-in sentence drawn under the row instead of behind its ⓘ → (3); the
 * Studio save through an unheld `makerSave` → (4); the Studio save without the latest-write → (4); `previewWord`
 * also saving → (4); the Maker's Reply by mounted without `draft` → (5); a word's refusal also said on the panel's
 * line → (6); the canvas tap still looking for an `<input>` → (7); a hand-made `<input>` back in the panel → (8).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The panel imports the draft door (a server action file): its server-only marks are not for a test run. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const G = 'app/dashboard/[eventId]/_components/guest-setup';
const PANEL = `${L}/maker-rsvp-ask.tsx`;
const STAGE = `${L}/maker-rsvp-stage.tsx`;
const ROW = 'app/_components/form-row.tsx';
const PILL = 'app/_components/pill-selector.tsx';
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
/**
 * The three shared parts reach the panel through a lazy door (`guest-setup-lazy.tsx`, the Maker's first-load budget):
 * a render draws them only once their chunk has arrived. So the panel is drawn until they are in it — every render
 * after that holds ALL the rows, and two doors can be compared row for row (never one drawn before the parts came
 * and one after).
 */
let partsIn = false;
async function panel(door: Record<string, unknown>, current: Record<string, unknown> = {}): Promise<string> {
  for (let i = 0; !partsIn && i < 200; i += 1) {
    partsIn = /data-setup-row="asks"/.test(await panelOnce({ studio: true }, {}));
    if (!partsIn) await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(partsIn, 'anti-vacuity: the shared parts never arrived in the panel');
  return panelOnce(door, current);
}
async function panelOnce(door: Record<string, unknown>, current: Record<string, unknown>): Promise<string> {
  const { MakerRsvpSettings } = await import(`../${PANEL}`);
  return paint(
    h(MakerRsvpSettings, {
      eventId: 'ev-1',
      current,
      drafted: false,
      replyBy: { date: '2026-11-18', isDefault: true },
      replyByOwn: { deadline: null, pricingMode: 'realtime' },
      requests: { count: 0, list: null },
      draftAction: async () => ({ ok: true }),
      replyByAction: async () => ({ ok: true }),
      ...door,
    } as Record<string, unknown>),
  );
}
/** One element's own markup, from its opening tag to its matching close (`<div …>` nesting counted). */
function block(html: string, open: string): string {
  const at = html.indexOf(open);
  assert.ok(at >= 0, `anti-vacuity: ${open} was not drawn`);
  let depth = 0;
  for (const m of html.slice(at).matchAll(/<(\/?)div\b[^>]*>/g)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(at, at + m.index! + m[0].length);
  }
  assert.fail(`${open} never closes`);
}
/** React's generated ids differ from one render to the next: they are not what a row is. */
const noIds = (html: string) => html.replace(/(id|aria-labelledby|aria-controls|for)="[^"]*"/g, '$1=""');
/** A stretch of the panel's source between two anchors. */
function between(src: string, from: string | RegExp, to: string): string {
  const at = typeof from === 'string' ? src.indexOf(from) : src.search(from);
  assert.ok(at >= 0, `anti-vacuity: "${from}" was not found`);
  const end = src.indexOf(to, at + (typeof from === 'string' ? from.length : 1));
  assert.ok(end > at, `anti-vacuity: "${to}" was not found after "${from}"`);
  return src.slice(at, end);
}

/* ── (1) one source, two doors ────────────────────────────────────────── */

test('(1) one source, two doors: Studio › RSVP and the stage’s form draw the SAME rows, in the same order', async () => {
  const words = { words: { attending: 'Count me in' }, oneAtATime: true };
  const studio = block(await panel({ studio: true }, words), '<div data-form-rows="rsvp"');
  const stage = block(await panel({ scene: 'form' }, words), '<div data-form-rows="rsvp"');
  assert.ok(studio.length > 1500, 'anti-vacuity: the rows were not drawn');
  const [a, b] = [noIds(stage), noIds(studio)];
  let at = 0;
  while (at < Math.min(a.length, b.length) && a[at] === b[at]) at += 1;
  assert.ok(a === b, `the stage’s form and Studio › RSVP are not the same rows — they part at ${at}: stage …${a.slice(Math.max(0, at - 90), at + 90)}… · Studio …${b.slice(Math.max(0, at - 90), at + 90)}…`);
  // In the Studio's order: Reply by · How guests answer · the two answers, each with its Start from · How guests
  // get in · the six asks.
  assert.deepEqual([...studio.matchAll(/data-form-row="([^"]+)"/g)].map((m) => m[1]), ['reply-by', 'how-guests-answer', 'word-attending', 'word-attending-start', 'word-declined', 'word-declined-start', 'get-in', 'asks']);
  // Each is a direct child of the ONE list — so the hairline between rows is drawn (`first:` is the list's first).
  assert.equal(count(studio, /class="border-t border-ink\/10 first:border-t-0"/g), 8, 'a row is wrapped, or a row is not on the list’s hairline');
  // ONE list in the source, drawn by both doors — with the three lazy parts in their places.
  const src = read(PANEL);
  assert.match(src, /<FormRows data="rsvp">\s*\{replyByRow\}\s*\{answerRow\}\s*\{wordRows\('form'\)\}\s*\{getInRow\}\s*\{asksRow\}\s*<\/FormRows>/);
  assert.equal(count(src, /<FormRows data="rsvp">/g), 1, 'a door has a list of its own');
  assert.match(src, /<div className="flex flex-col px-1" data-rsvp-stage-controls="form">\s*\{formRows\}\s*\{status\}\s*<\/div>/, 'the stage’s form draws more than the rows');
  assert.match(src, /<div className="flex flex-col" data-studio-rsvp="">\s*<div className=\{STUDIO_GROUP\}>\{formRows\}<\/div>/, 'Studio › RSVP does not open on the rows (a title or a heading is over them)');
  // No title and no group heading inside the Studio's page.
  const page = await panel({ studio: true });
  assert.doesNotMatch(page, /<h[1-6]\b|uppercase tracking-\[0\.2em\]|>Words<|the two answers/, 'Studio › RSVP has a title row or a group heading');
});

/* ── (2) each row is its kind ─────────────────────────────────────────── */

test('(2) each row is its kind: a pill selector, typed pills with Start from ▾ and the quiet reset — no box, no native field, no switch, no Save', async () => {
  const { PILL_ON_CLASS } = await import(`../${PILL}`);
  const { FORM_PILL_WIDTH } = await import(`../${ROW}`);
  const empty = await panel({ studio: true });
  // HOW GUESTS ANSWER — the pill selector: two named things, the stored one in the "on" look, its ⓘ beside the name.
  const answer = block(empty, '<div data-rsvp-setting="how-guests-answer"');
  assert.match(answer, /aria-label="About How guests answer"/);
  assert.match(answer, /<div role="group" aria-label="How guests answer" data-pill-selector="rsvp-answer"/);
  const onClass = (/<button type="button" aria-pressed="true" class="([^"]*)" data-seg="all"/.exec(answer)?.[1] ?? '').split(' ');
  for (const cls of PILL_ON_CLASS.split(' ')) assert.ok(onClass.includes(cls), `the picked answer is not in the "on" look (${cls})`);
  // THE WORDS, none written yet — each pill reads the words the page uses by itself, in grey; nothing to reset.
  assert.match(empty, /data-rsvp-word-field="attending" data-form-row="word-attending" data-form-row-kind="typed"/);
  assert.match(empty, /data-form-row-pill="typed" aria-label="Yes answer: not set yet\. Tap to change"[^>]*>(?:<span[^>]*text-ink\/45[^>]*>)<span>Joyfully accepts<\/span>/, 'an unwritten answer does not read the page’s own words');
  assert.match(empty, /aria-label="No answer: not set yet\. Tap to change"[^>]*><span[^>]*text-ink\/45[^>]*><span>Regretfully declines<\/span>/);
  assert.equal(count(empty, /data-form-row-pill="typed"/g), 2);
  assert.equal(count(empty, /aria-label="Yes answer — start from: Choose"|aria-label="No answer — start from: Choose"/g), 2, 'Start from ▾ is not under each answer');
  assert.doesNotMatch(empty, /Use the automatic words/, 'the reset is offered while there is nothing to reset');
  // Every pill of the list is the list's ONE width — typed and chosen alike.
  for (const m of empty.matchAll(/data-form-row-pill="typed"[^>]*class="([^"]*)"/g)) assert.ok(m[1]!.split(' ').includes(FORM_PILL_WIDTH.wide));
  // Written: the pill reads them; Start from names the premade line (or "Your own"); the quiet reset appears.
  const written = await panel({ studio: true }, { words: { attending: 'Count me in', declined: 'Next time!' } });
  assert.match(written, /aria-label="Yes answer: Count me in\. Tap to change"/);
  assert.match(written, /aria-label="Yes answer — start from: Count me in"/);
  assert.match(written, /aria-label="No answer — start from: Your own"/);
  const resets = [...written.matchAll(/<div class="flex justify-end pb-2" data-rsvp-word-reset="(\w+)"><button type="button" aria-label="Use the automatic words"[^>]*class="([^"]*)"/g)];
  assert.deepEqual(resets.map((m) => m[1]), ['attending', 'declined']);
  for (const m of resets) assert.deepEqual(m[2]!.split(' ').filter((c) => c === 'ab' || c === 'quiet' || c === 'ab-main'), ['ab', 'quiet'], 'the reset is not the house quiet action');
  // THE AFTER-SCREENS: a heading (one line) and a message (the taller box), the {name} sentence behind each ⓘ.
  for (const [scene, heading, message] of [['thanks', 'thanksHeading', 'thanksMessage'], ['decline', 'declineHeading', 'declineMessage']] as const) {
    const html = await panel({ scene }, { words: { [message]: 'Thank you for telling us' } });
    const rows = block(html, `<div data-form-rows="rsvp-${scene}"`);
    assert.deepEqual([...rows.matchAll(/data-rsvp-word-field="(\w+)"/g)].map((m) => m[1]), [heading, message]);
    assert.equal(count(rows, /aria-label="About (Heading|Message)"/g), 2, 'the {name} sentence is not behind each row’s ⓘ');
    assert.match(rows, /aria-label="Message: Thank you for telling us\. Tap to change"/);
    assert.match(rows, /aria-label="Heading: not set yet\. Tap to change"/);
    assert.doesNotMatch(rows, /Type \{name\}/, 'the {name} sentence is printed on the panel');
  }
  const src = read(PANEL);
  assert.match(src, /long=\{RSVP_WORD_MAX\[wordKey\] > 80\}\s*maxLength=\{RSVP_WORD_MAX\[wordKey\]\}/, 'a message does not open the taller box, or a word can outgrow its limit');
  assert.match(src, /const RSVP_NAME_HINT = 'Type \{name\} and each guest sees their own name\.';/);
  // IN EVERY DOOR'S ROWS: no box, no native field, no switch, no Save, no "Saved".
  for (const door of [{ studio: true }, { scene: 'form' }, { scene: 'thanks' }, { scene: 'decline' }]) {
    const html = await panel(door, { words: { attending: 'Count me in', thanksMessage: 'x', declineMessage: 'y' } });
    const rows = block(html, '<div data-form-rows="rsvp');
    assert.doesNotMatch(rows, /<input\b|<textarea\b|<select\b|role="switch"|type="date"|>\s*Save\s*<|>\s*Saved\b/, `${JSON.stringify(door)}: a hand-made field, switch or Save is in the rows`);
  }
});

/* ── (3) the shared parts, in the Maker's frame ───────────────────────── */

test('(3) the shared parts in the Maker’s frame: a date pill, a dropdown in a row, chips in a row — the part’s marks kept, and the SAME chips in Guests › Setup', async () => {
  const { replyByFrame, getInFrame, asksFrame } = await import(`../${PANEL}`);
  const { FormRows } = await import(`../${ROW}`);
  const { ReplyBy } = await import(`../${G}/reply-by`);
  const { GuestsGetIn } = await import(`../${G}/guests-get-in`);
  const { RsvpAsks } = await import(`../${G}/rsvp-asks`);
  const { PILL_ON_CLASS } = await import(`../${PILL}`);
  const list = (...rows: React.ReactElement[]) => paint(h(FormRows, { data: 'rsvp' } as Record<string, unknown>, ...rows));
  // REPLY BY — the date pill; the 30-day default is read while there is no date of their own.
  const replyBy = await list(h(ReplyBy, { layout: 'frame', frame: replyByFrame, eventId: 'ev-1', own: null, pricingMode: 'realtime', fallback: '2026-11-18', action: async () => ({ ok: true }), draft: true } as Record<string, unknown>));
  assert.match(replyBy, /^<div data-form-rows="rsvp"[^>]*><div data-setup-row="reply-by" data-rsvp-setting="reply-by" data-reply-by-field="draft" data-form-row-kind="date"/, 'Reply by is wrapped, or lost its part’s marks');
  assert.match(replyBy, /data-form-row-pill="date" aria-haspopup="dialog" aria-expanded="false" aria-label="Reply by: November 18, 2026\. Tap to change"/);
  assert.doesNotMatch(replyBy, /<input\b|type="date"|Guests see this right away|data-writes-live|>\s*Saved/);
  // HOW GUESTS GET IN — the dropdown in the row's own pill; the picked choice's sentence is behind the ⓘ.
  const getIn = await list(h(GuestsGetIn, { frame: getInFrame, value: 'list', onPick: () => {} } as Record<string, unknown>));
  assert.match(getIn, /^<div data-form-rows="rsvp"[^>]*><div data-setup-row="get-in" data-rsvp-setting="who-can-rsvp" data-get-in="list" data-form-row-kind="chosen"/);
  assert.match(getIn, /aria-label="About How guests get in"/);
  assert.match(getIn, /data-rsvp-who-pick=""/);
  assert.match(getIn, /Only my list · They reply/);
  assert.doesNotMatch(getIn, /You list every guest\. They answer yes or no\./, 'the choice’s sentence is printed under the row');
  assert.match(read(PANEL), /about=\{\{ words: row\.hint \}\}/);
  // THE SIX ASKS — a row named by the part, its sentence behind the ⓘ, the chips under it.
  const asks = await list(h(RsvpAsks, { frame: asksFrame, config: { meal: false, mobile: false }, onToggle: () => {} } as Record<string, unknown>));
  assert.match(asks, /^<div data-form-rows="rsvp"[^>]*><div data-setup-row="asks" data-made-once="rsvp-ask" data-form-row="asks"/, 'the asks’ row is wrapped, or lost its part’s marks');
  assert.match(asks, /aria-label="About RSVP asks"/);
  assert.doesNotMatch(asks, /Yes or no is always asked\./, 'the asks’ sentence is printed on the panel');
  const chips = [...asks.matchAll(/<button type="button" aria-pressed="(true|false)" data-chip="(\w+)" data-testid="rsvp-ask-(\w+)" class="([^"]*)">([^<]+)</g)];
  assert.deepEqual(chips.map((m) => `${m[2]}:${m[1]}:${m[5]}`), ['plus_ones:true:Plus-ones', 'meal:false:Meal', 'dietary:true:Dietary', 'song_request:true:Song request', 'note:true:A note', 'mobile:false:Mobile']);
  for (const m of chips) assert.equal(PILL_ON_CLASS.split(' ').every((c: string) => m[4]!.split(' ').includes(c)), m[1] === 'true', `${m[2]}: the chip's look is not its state`);
  // ONE LOOK IN BOTH DOORS: Guests › Setup's own row holds the very same chips.
  const setup = await paint(h(RsvpAsks, { config: { meal: false, mobile: false }, onToggle: () => {} } as Record<string, unknown>));
  assert.match(setup, /^<section [^>]*data-setup-row="asks"[^>]*>[\s\S]*Yes or no is always asked\./, 'anti-vacuity: Guests › Setup’s row was not drawn');
  assert.equal(block(setup, '<div role="group" aria-label="RSVP asks"'), block(asks, '<div role="group" aria-label="RSVP asks"'), 'the six asks look different in Guests › Setup');
});

/* ── (4) a press = one draft write, no Maker render ───────────────────── */

/** Where the Studio's own save begins, in `save`. */
const STUDIO_SAVE = /if \(studio\) \{\s*announceRsvpPreview\(next\);/;

test('(4) a press in Studio = ONE draft write and no render of the Maker; typing sends nothing until the row is left', () => {
  const src = read(PANEL);
  const studio = between(src, STUDIO_SAVE, 'start(async () => {');
  // THE CLAIM: held (`makerRedrawSave` — no Maker render is owed) around the latest-write around the ONE draft door.
  assert.match(studio, /res = await makerRedrawSave\(\s*\(\) =>\s*makerLatestWrite\(canvasWriteKey\(RSVP_DRAFT_TYPE\), \(\) => \{/, 'a Studio press brings a whole render of the Maker, or a burst is more than one write');
  assert.match(studio, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ events: \{ rsvp_ask_config: next \} \}\)\);\s*fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\);\s*return draftAction\(eventId, fd\);/, 'the Apply count does not come back with the save');
  assert.equal(count(studio, /draftAction\(/g), 1, 'more than one request per press');
  assert.doesNotMatch(studio, /\bmakerSave\(|router\.refresh|makerNeedsRender|setTimeout|setInterval/, 'the Studio save asks for a render, or writes on a timer');
  // It returns before the unheld path (Event Details' own) can run.
  assert.match(studio, /return \(async \(\): Promise<SaveAnswer> => \{[\s\S]*\}\)\(\);\s*\}\s*$/, 'the Studio save falls through to the unheld save');
  // The panel builds on the Maker's own copy — no render brings the server's back after a save.
  assert.match(src, /stage \|\| studio \? \(draftedCanvasOr\(RSVP_DRAFT_TYPE, server as HubSectionCanvas\) as RsvpAskConfig\) : server;/, 'reopening Studio › RSVP shows the rows as they were before this visit’s edits');
  assert.match(studio, /noteDraftedCanvas\(RSVP_DRAFT_TYPE, next as HubSectionCanvas, current as HubSectionCanvas\);/);
  // TYPING: the page is shown the words (a preview) — and nothing is saved until the row is left, ONCE.
  const preview = between(src, 'const previewWord = ', '};');
  assert.match(preview, /announceRsvpPreview\(\{ \.\.\.latest\.current, words: wordsWith\(key, text\) \}\);/);
  assert.doesNotMatch(preview, /save\(|draftAction|latest\.current =|setLocal/, 'typing in a row saves, or changes what the panel holds');
  assert.match(src, /onType=\{\(text\) => previewWord\(key, text\)\}\s*onKeep=\{\(text\) => saveWord\(key, text, true\)\}/);
  // The stage's own save is as it was: held, batched, the bar in the answer.
  const stage = src.slice(src.indexOf('if (stage) {'), src.search(STUDIO_SAVE));
  assert.ok(stage.length > 400, 'anti-vacuity: the stage’s save was not found');
  assert.match(stage, /res = await makerSave\(\s*\(\) =>\s*makerLatestWrite\(canvasWriteKey\(RSVP_DRAFT_TYPE\)/);
  assert.match(stage, /\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true \}/);
});

/* ── (5) everything waits for Apply ───────────────────────────────────── */

test('(5) everything waits for ✓ Apply: the panel’s only writers are the draft door and the Reply by part mounted with `draft`', () => {
  const src = read(PANEL);
  // The only actions the panel can call.
  const actions = [...src.matchAll(/import \{([^}]*)\} from '(\.\.\/\.\.\/[^']*actions)';/g)].map((m) => `${m[1]!.trim()} ← ${m[2]}`);
  assert.deepEqual(actions, ['hubDraftAction ← ../../website/hub-draft-actions', 'updatePaxSettings ← ../../actions']);
  // Every write of the config is the draft door's `intent=save`.
  assert.equal(count(src, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ events: \{ rsvp_ask_config: next \} \}\)\);/g), 3, 'a door writes the config some other way');
  assert.equal(count(src, /fd\.set\('intent'/g), 3);
  // Reply by: the part's one writer, asked for the DRAFT in every mount the Maker has.
  const mounts = src.match(/<ReplyBy\b[\s\S]*?\/>/g) ?? [];
  assert.equal(mounts.length, 2, 'anti-vacuity: the Maker’s Reply by mounts were not found');
  for (const m of mounts) assert.match(m, /\baction=\{replyByAction\}\s+draft\s*\/>$/, 'a Maker Reply by writes the live date');
  assert.match(read(`${G}/reply-by.tsx`), /if \(draft\) fd\.set\(HUB_DRAFT_FIELD, '1'\);/);
  // …and what `updatePaxSettings` does with it is unchanged: the date into the draft; the pricing view only if it differs.
  const pax = read('app/dashboard/[eventId]/actions.ts');
  assert.match(pax, /if \(isHubDraftWrite\(formData\)\) \{\s*try \{\s*await saveHubDraftPatch\(eventId, \{ events: \{ guest_list_edit_deadline: deadline \} \}\);/);
  assert.doesNotMatch(src, /Guests see this right away|HubSavesImmediately|data-writes-live/, 'a row of the Maker’s RSVP says it is live');
});

/* ── (6) a refusal is said once ───────────────────────────────────────── */

test('(6) a refusal is said once, where it happened: a word’s own row says it; every other control on the panel’s one red line', () => {
  const src = read(PANEL);
  // A word kept in its row: `said` — the row's own line and Try again say it (the template's), the panel's stays quiet.
  assert.match(src, /const saveWord = \(key: RsvpWordKey, text: string, said = false\) => save\(\{ words: wordsWith\(key, text\) \}, `“\$\{sceneWordName\(key\)\}”`, said\);/);
  assert.equal(count(src, /if \(!said\) setError\(/g), 2, 'a refusal of a word is also said on the panel’s line (or another control’s is not said at all)');
  // The save ANSWERS the row: kept, or not — and why.
  assert.equal(count(src, /return \{ ok: false, error: `It is back as it was\. \$\{res\.error \|\| 'Please try again\.'\}` \};/g), 2);
  // A pick from Start from ▾ and the reset are the row's own saves too: said under the row they belong to.
  const rows = between(src, 'function WordRows(', '\n}\n');
  assert.match(rows, /void onKeep\(text\)\.then\(\(r\) => \{\s*if \(!r\.ok\) setProblem\(`\$\{name\} did not save\. \$\{r\.error\}`\);/);
  // A word typed on the PAGE has no row to say it: the panel's line does.
  assert.match(src, /void saveWordRef\.current\(d\.key as RsvpWordKey, d\.text\);/);
  // The panel's one line is red (something is WRONG), never the gold the old one wore.
  assert.match(src, /<p role="alert" className="px-1 pt-2 text-\[12\.5px\] font-semibold text-danger-700" data-rsvp-stage-error="">/);
  assert.doesNotMatch(between(src, 'const status = error ? (', ') : null;'), /terracotta/);
});

/* ── (7) a word tapped on the canvas ──────────────────────────────────── */

test('(7) a word tapped on the canvas still brings its row up — and opens it', () => {
  const src = read(STAGE);
  const door = between(src, 'const openWordField = useCallback(', '}, []);');
  assert.match(door, /document\.querySelector<HTMLElement>\(`\[data-rsvp-word-field="\$\{key\}"\] \[data-form-row-pill\]`\)/, 'the tap looks for a box the rows no longer have');
  assert.match(door, /if \(key === 'reply-by'\) pill\?\.focus\(\{ preventScroll: true \}\);\s*else pill\?\.click\(\);/);
  assert.doesNotMatch(door, /\binput\b|textarea/, 'the tap still looks for a hand-made field');
  // The panel's rows carry the mark the tap looks for.
  assert.match(read(PANEL), /attrs=\{\{ 'data-rsvp-word-field': wordKey \}\}/);
});

/* ── (8) the watch ────────────────────────────────────────────────────── */

const HAND_MADE: Array<{ what: string; re: RegExp }> = [
  { what: 'a text box of its own (`<textarea>`)', re: /<textarea\b/ },
  { what: 'a field of its own (`<input>`)', re: /<input\b/ },
  { what: 'a native `<select>`', re: /<select\b/ },
  { what: 'a native date field', re: /type="date"/ },
  { what: 'a switch of its own', re: /role="switch"|peer-checked:|<Switch\b/ },
  { what: 'a dropdown outside a row (`<PickMenu>` — use `ChosenRow`)', re: /<PickMenu\b/ },
  { what: 'a bare `<button>` (the quiet action is `ActionButton`)', re: /<button\b/ },
  { what: 'a toggle made of buttons (`aria-pressed` — the six asks are the part’s chips)', re: /aria-pressed/ },
  { what: 'the Studio’s old row skin', re: /STUDIO_ROW\b|STUDIO_ROW_PICK|STUDIO_GROUP_HEAD/ },
  { what: 'a Save button', re: />\s*Save\s*</ },
  { what: 'a "Saved" word', re: />\s*Saved\b/ },
];

test('(8) the watch: the RSVP panel hand-makes no field, switch, dropdown, date input or toggle', () => {
  const src = read(PANEL);
  assert.ok(src.length > 8000, 'anti-vacuity: the panel was not read');
  assert.match(src, /<(TypedRow|ChosenRow|FormRow)\b/);
  for (const { what, re } of HAND_MADE) {
    const line = src.split('\n').find((l) => re.test(l));
    assert.equal(line, undefined, `the RSVP panel draws ${what}: ${line?.trim().slice(0, 120)}`);
  }
  // The templates it wears are the shared ones — imported, never copied.
  assert.match(src, /import \{ ChosenRow, FormRow, FormRows, TypedRow, type FormRowAbout \} from '@\/app\/_components\/form-row';/);
  assert.match(src, /import \{ DateRow \} from '@\/app\/_components\/form-row-date';/);
  assert.match(src, /import \{ PillSelector \} from '@\/app\/_components\/pill-selector';/);
  assert.match(src, /import \{ ActionButton \} from '@\/components\/action-button';/);
});
