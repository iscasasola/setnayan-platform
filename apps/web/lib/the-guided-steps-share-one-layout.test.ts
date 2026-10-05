/**
 * the-guided-steps-share-one-layout.test.ts — EVERY GUIDED STEP WEARS ONE
 * LAYOUT AND BEHAVES THE SAME (`lib/guided-step-layout.ts`).
 *
 * Owner, live iPhone test 2026-10-05, walking "Finish your Event Hub": *"why
 * are there so many inconsistencies"*. The logo step's control sat outside its
 * sheet; the names step had its own Save; Love Story's Back/Next ran off the
 * screen behind a whole studio; the bar's title flipped between "Look" and
 * "Event Details" inside one stage; what sat behind the sheet changed from step
 * to step; "Almost ready" had two Apply buttons; RSVP's "before we start"
 * listed 2 of its 3 facts.
 *
 * This fails when ANY step brings back its own Save, a caption or heading row
 * in its sheet, a header row of its own, or a picture of its own behind the
 * sheet. Held where it can be EXECUTED — the workspace rendered on every step of
 * every stage — and, for the steps' real editors (which need the Maker's server
 * and draft door to render), on their sources, file by file.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';
import { buildGuidedPlan, type GuidedItem, type GuidedStepKey } from './details-guided-flow';
import { STEP_PARTS, stagesOfStep, beforeWeStart, stageProgress, SETUP_STAGES } from './stage-setup';
import { STEP_OWN_BODY, guidedStepBody, stagePageSrc } from './guided-step-layout';
import { phoneHeightPx } from './maker-phone-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SCREEN_H = 812;

/** Every Details item a step can stand on — so every step of every stage is in the plan. */
const ITEMS = ['names', 'date', 'theme', 'logo', 'hero', 'love-story', 'rsvp', 'venues', 'schedule', 'parents', 'march', 'mood-board', 'special-message', 'seating', 'papic', 'address'];

function plan() {
  const nav = ITEMS.map((k) => ({ key: k, group: 'g', label: k, icon: null, done: false }));
  return { nav, plan: buildGuidedPlan(nav as GuidedItem[], { solemn: false, parentsOffered: true }) };
}

async function paintStep(step: GuidedStepKey, round: string, item: string, pieces: Record<string, React.ReactNode> = {}): Promise<string> {
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const { nav, plan: p } = plan();
  return renderSettled(
    React.createElement(DetailsWorkspace, {
      groups: [{ key: 'g', label: 'G', items: nav }],
      bodies: Object.fromEntries(ITEMS.map((k) => [k, React.createElement('i', { 'data-stub-body': k })])),
      editors: Object.fromEntries(ITEMS.map((k) => [k, React.createElement('i', { 'data-stub-editor': k })])),
      initial: item,
      pieces,
      guide: { plan: p, open: true, entry: { kind: 'step', step, round }, addressed: true, actions: { previewHref: null, shareUrl: null, sendHref: '/x' } },
    }),
  );
}

/** The phone sheet's markup — from its aside to the aside's end. */
function sheetOf(html: string): string {
  const at = html.indexOf('data-half-sheet=');
  assert.ok(at > 0, 'anti-vacuity: no half sheet');
  return html.slice(html.lastIndexOf('<aside', at), html.indexOf('</aside>', at));
}

/* ── (1) the layout, on every step of every stage ──────────────────────── */

test('(1) every step of every stage: half sheet, ONE header row, the field, the foot — no row between, nothing of its own', async () => {
  const { plan: p } = plan();
  let walked = 0;
  for (const s of p.steps) {
    for (const round of s.stages) {
      const html = await paintStep(s.key, round, s.items[0]!);
      const sheet = sheetOf(html);
      const where = `${s.key} on ${round}`;
      // Half, at rest.
      const aside = sheet.slice(0, sheet.indexOf('>') + 1);
      assert.match(aside, /data-half-sheet="half"/, `${where}: not at half`);
      const px = phoneHeightPx(/\bclass="([^"]*)"/.exec(aside)?.[1] ?? '', SCREEN_H);
      assert.ok(px !== null && px <= SCREEN_H * 0.5, `${where}: the sheet rests over half the screen`);
      // ONE header row: the step ▾ · Peek · ×.
      const head = sheet.slice(sheet.indexOf('data-half-sheet-head'), sheet.indexOf('data-half-sheet-close'));
      assert.match(head, /data-half-sheet-lead=""[\s\S]*data-details-guide-steps=""/, `${where}: the step ▾ is not the header`);
      assert.match(head, /data-half-sheet-peek=""/, `${where}: no Peek in the header`);
      // Nothing between the header and the field: no heading, eyebrow, caption or second line.
      const afterHead = sheet.indexOf('</div>', sheet.indexOf('data-half-sheet-close'));
      const between = sheet.slice(afterHead, sheet.indexOf('data-details-editor='));
      assert.doesNotMatch(between, /<(p|h2|h3|header|small)\b/, `${where}: a row came back between the header and the field`);
      assert.doesNotMatch(between, /data-details-guide-(top|head|unlocks)|data-details-guide-all/, `${where}: the flow's line or heading is in the sheet again`);
      // The step's field is in the sheet, shown; then the foot.
      const item = s.items[0]!;
      assert.match(sheet, new RegExp(`data-details-editor="${item}" class="flex flex-col gap-3"`), `${where}: its field is not in the sheet`);
      assert.match(sheet, /data-details-guide-foot-sheet=""/, `${where}: no Back · Next in the sheet`);
      assert.doesNotMatch(sheet, /type="submit"|>\s*Save\s*</, `${where}: a Save in the step's chrome`);
      // Behind the sheet: the stage's ONE rule.
      const body = guidedStepBody(s.key, round as never);
      if (body.kind === 'own') {
        assert.doesNotMatch(html, /data-guided-step-preview=/, `${where}: its own tool is covered by the stage page`);
      } else {
        assert.match(html, new RegExp(`data-guided-step-preview="${body.kind}"[^>]*`), `${where}: the stage's page is not behind the sheet`);
        assert.match(html, /class="flex min-h-0 flex-1 flex-col pb-\[calc\(45dvh-104px\)\] lg:hidden" data-guided-step-preview=/, `${where}: the preview is not the phone's, fitted above the sheet`);
        assert.match(html, /max-lg:hidden"><div hidden="" data-details-body-item=|max-lg:hidden"><div data-details-body-item=/, `${where}: the item's own picture still shows behind the sheet on a phone`);
      }
      walked += 1;
    }
  }
  assert.ok(walked >= 15, `anti-vacuity: walked only ${walked} steps`);
});

/* ── (2) one rule per stage, exhaustive ────────────────────────────────── */

test('(2) behind the sheet: each stage’s page (RSVP: its reply page), except a subject only its own tool shows', () => {
  for (const step of Object.keys(STEP_PARTS) as GuidedStepKey[]) {
    for (const stage of stagesOfStep(step)) {
      const body = guidedStepBody(step, stage);
      if (STEP_OWN_BODY.includes(step)) assert.equal(body.kind, 'own', step);
      else if (stage === 'rsvp-stage') assert.equal(body.kind, 'rsvp-page', `${step} on RSVP`);
      else assert.ok(body.kind === 'page' || (step === 'hero' && body.kind === 'cover'), `${step} on ${stage}: ${body.kind}`);
      if (body.kind === 'page' || body.kind === 'cover') assert.equal(body.phase, stage, `${step} shows another stage's page`);
    }
  }
  // The page is the draft (`editor=1`) wearing the theme being picked (the live-preview fix).
  assert.equal(stagePageSrc('/m-j', { kind: 'page', phase: 'save_the_date', anchor: '' }, 'cyber'), '/m-j?phase=save_the_date&editor=1&theme=cyber');
  assert.equal(stagePageSrc('/m-j', { kind: 'page', phase: 'rsvp', anchor: '#site-story' }, null), '/m-j?phase=rsvp&editor=1#site-story');
  assert.equal(stagePageSrc('/m-j', { kind: 'own' }, 'cyber'), null);
});

/* ── (3) one title per stage ───────────────────────────────────────────── */

test('(3) the bar says ONE title per stage while the flow is on screen — never Look and Event Details by turns', () => {
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /const guideTitle = !at \|\| !plan \? null : at\.kind === 'stages' \? GUIDED_FLOW_TITLE : roundName\(plan, at\.round\);/, 'the flow does not name its stage');
  assert.match(ws, /setGuideTitle\?\.\(guideTitle\);/);
  assert.match(ws, /useEffect\(\(\) => \(\) => setGuideTitle\?\.\(null\), \[setGuideTitle\]\);/, 'the title outlives the flow');
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /const openStageWord = \(openDoor === 'look' \|\| openDoor === 'details'\) && guideTitle \? guideTitle :/, 'the bar does not read the flow’s title');
});

/* ── (4) one Apply; the counts list what they count ────────────────────── */

test('(4) "Almost ready" has no Apply of its own; "before we start" lists every fact its stage counts', async () => {
  const ready = read(`${L}/details-guide.tsx`);
  assert.doesNotMatch(ready, /data-details-guide-apply|pressMakerApply\(/, 'a second Apply came back on the Ready screen');
  const { plan: p } = plan();
  for (const stage of SETUP_STAGES) {
    if (!p.rounds.includes(stage as never)) continue;
    const b = beforeWeStart(p, stage);
    const n = stageProgress(p, stage);
    assert.equal(b.have.length + b.ask.length, n.total, `${stage}: "before we start" lists ${b.have.length + b.ask.length} of the ${n.total} the picker counts`);
    assert.equal(b.have.length, n.done, `${stage}: "in place" disagrees with the picker`);
  }
  // The Maker counts with the function Home and Event Details count with.
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /done: guidedItemDone\(i\.key, doneFacts\) \?\? i\.done/, 'the Maker counts done its own way again');
  assert.match(read('app/dashboard/[eventId]/launch/page.tsx'), /doneFacts: guided,/);
});

/* ── (5) no Save in any step's own field ───────────────────────────────── */

/** A button that saves on a press: its words, a submit, or the shared Save rows. */
const SAVE_RE = />\s*(?:Save|Saving…|Save message|Use this photo)\s*</g;
const SUBMIT_RE = /type="submit"|<SubmitButton\b|<SaveRow\b/g;

/**
 * Every source a step's sheet draws, with the presses it may still hold and
 * why — a step's own field drafts as it changes (owner 2026-10-05). A count
 * that grows is a Save coming back.
 */
const STEP_EDITORS: ReadonlyArray<[file: string, saves: number, submits: number, why: string]> = [
  [`${L}/details-your-event.tsx`, 0, 0, 'Names · Date · Ceremony time · Venues: AutoDraft'],
  [`${L}/details-answers.tsx`, 0, 0, 'every "Do you want …?" answer drafts at the pick'],
  [`${L}/maker-theme-picker.tsx`, 0, 0, 'Theme: at the pick'],
  [`${L}/maker-rsvp-ask.tsx`, 0, 0, 'RSVP: who · questions · reply by — at the pick'],
  [`${L}/maker-logo.tsx`, 0, 0, 'the logo studio saves itself'],
  [`${L}/details-people.tsx`, 0, 0, 'Parents & hosts'],
  [`${L}/details-march.tsx`, 0, 0, 'The march'],
  ['app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx', 0, 0, 'Font · Colours: DraftsAsYouGo'],
  ['app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx', 0, 0, 'Behind every scene: at the pick'],
  [`${L}/special-message-field.tsx`, 1, 1, '"Save message" is the no-Maker form only (`eventId` absent); in the Maker it saves as typed'],
  [`${L}/maker-made-once.tsx`, 0, 1, 'the one submit is "Use the invitation card instead" — an action, not a Save; the photo drafts itself'],
  ['app/dashboard/[eventId]/studio/mood-board/_components/dress-code-lists-form.tsx', 1, 1, 'the studio page’s own Save; in the Maker the lists draft when a row is left'],
  ['app/dashboard/[eventId]/schedule/_components/moment-inspector.tsx', 0, 0, 'Schedule: every moment field saves as it is made'],
  [`${L}/details-tool-pieces.tsx`, 0, 0, 'Schedule: the inspector and Announce slots'],
  ['app/dashboard/[eventId]/details/_components/governed-fields.tsx', 0, 0, 'the record page’s "Check & save" only — an embedded step hides it (autoRow)'],
];

test('(5) no step’s own field brings back a Save — each drafts as it changes', () => {
  for (const [file, saves, submits, why] of STEP_EDITORS) {
    const src = read(file);
    assert.ok(src.length > 400, `anti-vacuity: ${file} was not read`);
    const s = (src.match(SAVE_RE) ?? []).length;
    const b = (src.match(SUBMIT_RE) ?? []).length;
    assert.equal(s, saves, `${file}: ${s} Save press(es), expected ${saves} — ${why}`);
    assert.equal(b, submits, `${file}: ${b} submit(s), expected ${submits} — ${why}`);
  }
  // The ones that remain are outside a step.
  assert.match(read(`${L}/special-message-field.tsx`), /\{eventId \? \(\s*<span hidden data-special-save-state=\{state\} \/>\s*\) : \(/, 'the message’s Save shows in the Maker');
  assert.match(read('app/dashboard/[eventId]/studio/mood-board/_components/dress-code-lists-form.tsx'), /\{inMaker \? \(\s*<DraftsAsYouGo settle \/>\s*\) : \(\s*<SubmitButton/, 'the lists’ Save shows in the Maker');
  const gf = read('app/dashboard/[eventId]/details/_components/governed-fields.tsx');
  assert.match(gf, /\{autoRow \? null : \(\s*<div className="flex flex-wrap items-center gap-2">\s*<button\s+type="button"\s+onClick=\{checkAndSave\}/, 'the date step shows "Check & save" again');
  assert.match(gf, /const t = window\.setTimeout\(\(\) => autoSave\.current\(\), 900\);/, 'the date step does not save its pick');
  // AutoDraft sends only a CHANGE (opening never writes).
  const ye = read(`${L}/details-your-event.tsx`);
  assert.match(ye, /if \(watch === sent\.current\) return;/, 'an opened step would draft what it was drawn with');
});

/* ── (6) the logo step: its answer in the sheet, the logo as guests see it ── */

test('(6) the logo step: "Do you want a logo?" is in its sheet; the logo shows without guide lines, fitted above the sheet', () => {
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /if \(logoA\) editors\.logo = logoA\.node;/, 'the logo’s answer is not the step’s field');
  assert.match(details, /max-lg:group-data-\[details-mode=guided\]\/ws:hidden" data-details-logo-strip=""/, 'the answer strip still shows over the logo in the flow');
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /className="group\/ws flex h-full/, 'the workspace no longer names the group the tools dress by');
  assert.match(ws, /\{editorsBody\(false\)\}\s*\{at\?\.kind === 'step' \? \(/, 'a step whose item draws its own tools hides its field');
  const logo = read(`${L}/maker-logo.tsx`);
  assert.match(logo, /data-logo-guides=""\s*className="group-data-\[details-mode=guided\]\/ws:hidden"/, 'the editor guide lines show in the flow');
  assert.match(logo, /max-lg:group-data-\[details-mode=guided\]\/ws:max-w-\[min\(100%,calc\(55dvh-8rem\)\)\]/, 'the logo is not fitted above the sheet');
});

/* ── (7) the Schedule step: the rail behind, one sections ▾, no row of its own ── */

test('(7) the Schedule step: its rail behind the sheet, its moments in ONE dropdown, the inspector without a header or a status line of its own', async () => {
  const html = await paintStep('schedule', 'rsvp', 'schedule', { schedule: React.createElement('i', { 'data-stub-piece': 'moments' }) });
  assert.doesNotMatch(html, /data-guided-step-preview=/, 'the page covers the rail the moments are picked on');
  const sheet = sheetOf(html);
  assert.match(sheet, /data-details-step-sections=""[\s\S]*data-sheet-sections=""/, 'the step has no way to pick a moment');
  for (const key of ['schedule', 'arrive'] as const) assert.equal(guidedStepBody(key, 'rsvp').kind, 'own', key);
  const insp = read('app/dashboard/[eventId]/schedule/_components/moment-inspector.tsx');
  assert.match(insp, /group-data-\[details-mode=guided\]\/ws:hidden" data-moment-head=""/, 'the inspector’s own header row shows in the step');
  assert.match(insp, /save === 'error' \? '' : 'group-data-\[details-mode=guided\]\/ws:hidden'/, 'the inspector’s status line shows in the step');
  assert.doesNotMatch(read(`${L}/details-tool-pieces.tsx`), /<p className/, 'a caption came back under Announce');
});

/* ── (8) no React key warning from the Maker's editors ─────────────────── */

test('(8) a server-made editor sits in a keyed slot — never an unkeyed child (the dev badge’s "1 Issue" on every step)', () => {
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /<Fragment key="editor">\{editors\[i\.key\] \?\? null\}<\/Fragment>/, 'the editor is an unkeyed child beside the cover background again');
  assert.match(ws, /<Fragment key="persistent">\{persistent\}<\/Fragment>/, 'the persistent part is an unkeyed child beside the editors');
  assert.match(ws, /<Fragment key="body">\{bodies\[i\.key\] \?\? null\}<\/Fragment>/);
});

/* ══ ROUND 2 — the owner's live walk on maria-and-jose, 2026-10-05 ══════════ */

test('(9) the Save the Date film follows the theme unless the couple picked its background — so the Theme step opens at the top, film included', async () => {
  const body = guidedStepBody('theme', 'save_the_date');
  assert.equal(body.kind === 'page' && body.anchor, '', 'the Theme step skips the film again');
  const { stdFilmBackground, resolveStdBackground } = await import('./std-backgrounds');
  // Never picked → the theme's paper; picked → the couple's own, untouched.
  assert.deepEqual(stdFilmBackground(null, '#0b0a12'), { kind: 'plain', value: '#0b0a12', legibility: 'auto' });
  assert.deepEqual(stdFilmBackground(undefined, '#0b0a12'), { kind: 'plain', value: '#0b0a12', legibility: 'auto' });
  const picked = { kind: 'plain', value: '#e8d9bd', legibility: 'auto' };
  assert.deepEqual(stdFilmBackground(picked, '#0b0a12'), resolveStdBackground(picked), 'a background the couple picked was overridden');
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /event\.std_background === null \|\| event\.std_background === undefined\s*\? stdFilmBackground\(null, INVITE_THEMES\[/, 'the guest page does not dress an unpicked film in the theme');
});

test('(10) one count: Event Details\' number IS the Maker\'s number — totals too — and the read costs no second pass', async () => {
  const { oneCountPlan, buildGuidedPlan: build } = await import('./details-guided-flow');
  const { setupProgress } = await import('./stage-setup');
  const items = (keys: readonly string[], done: (k: string) => boolean) =>
    keys.map((k) => ({ key: k, label: k, done: done(k) })) as GuidedItem[];
  // The SAME event, two derivations that disagree: Event Details (`readGuidedPlan`)
  // counts the seat plan and sees the names done; the Maker's own rows lack the
  // seat plan and see the date done.
  const shared = build(items(ITEMS, (k) => k === 'names' || k === 'theme'), { solemn: false, parentsOffered: true });
  const local = build(items(ITEMS.filter((k) => k !== 'seating'), (k) => k === 'date'), { solemn: false, parentsOffered: true });
  assert.notDeepEqual(setupProgress(local), setupProgress(shared), 'anti-vacuity: the fixture must disagree before the fix');
  const maker = oneCountPlan(shared, local);
  assert.deepEqual(setupProgress(maker), setupProgress(shared), 'the Maker and Event Details give different totals for one event');
  for (const r of SETUP_STAGES) assert.deepEqual(stageProgress(maker, r), stageProgress(shared, r), `${r}: the stage counts differ`);
  assert.equal(oneCountPlan(null, local), local, 'without the shared read the Maker keeps its own plan');

  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  // ⚡ Started beside the page's reads with what it already read — never re-read, never serial.
  assert.match(page, /const sharedPlanP = readGuidedPlan\(\{[\s\S]{0,120}pre: \{ event: printEvent, hosts: rsvpHosts, parents: printParents, drafted: draftedEvents, scheduleRows: scheduleMoments \}/, 'the Maker re-reads what it already has');
  assert.equal(page.match(/readGuidedPlan\(/g)?.length, 1, 'a second read of the plan');
  assert.match(page, /const sharedPlan = await sharedPlanP;/);
  assert.ok(page.indexOf('const sharedPlanP') < page.indexOf('const mayShowStdFilm'), 'the plan read starts after the page\'s other reads, not beside them');
  assert.match(page, /shared: sharedPlan \? sharedPlan\.plan : null,/);
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /const plan = rawPlan \? oneCountPlan\(props\.guide\?\.shared, rawPlan\) : null;/, 'the Maker counts its own way again');
  const home = read('app/dashboard/[eventId]/_components/details-guide-home-card.tsx');
  assert.match(home, /readGuidedPlan\(/, 'Event Details counts some other way');
});

test('(11) Parents & hosts opens on what is in place — a host before "Add a parent" — so the step agrees with its ✓ set', () => {
  const people = read(`${L}/details-people.tsx`);
  assert.match(people, /const first = parentsOffered \? \(parents\[0\]\?\.key \?\? hosts\[0\]\?\.key \?\? ADD\)/, 'the step opens on "Add a parent" beside a host already in place');
  assert.doesNotMatch(people, /A host’s number comes from their own account/, 'a caption came back under the host');
});

test('(12) opening a step is never dirty; the Mood Board steps show the board, with no note and no downloads in the sheet', () => {
  const top = read(`${L}/details-guide-top.tsx`);
  assert.match(top, /if \(touched && !fieldTouched\(touched, el\)\) continue;/, 'an untouched field can read as unsaved again');
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /hasUnsavedEdits\(stepScopesOf\(rootRef\.current, stepHere\.items\), touchRef\.current\.fields\)/, 'the step asks about fields nobody touched');
  // A field a tool fills itself is not the couple's touch (behaviour: (22)).
  assert.match(ws, /noteTouch\(touchRef\.current, e\);/);
  assert.match(read('lib/guided-step-touch.ts'), /if \(!e\.isTrusted\) return false;/, 'a field a tool fills itself counts as touched');
  for (const key of ['colours', 'wear'] as const) assert.equal(guidedStepBody(key, 'rsvp').kind, 'own', key);
  const mb = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx');
  assert.match(mb, /className="contents group-data-\[details-mode=guided\]\/ws:hidden" data-mood-board-note-wrap=""/, 'the board’s note shows in the step');
  assert.match(mb, /group-data-\[details-mode=guided\]\/ws:hidden" data-mood-board-exports=""/, 'the downloads show in the step');
});

test('(13) Reply by: one date line, the date in the field, one date format', () => {
  const ask = read(`${L}/maker-rsvp-ask.tsx`);
  const at = ask.lastIndexOf('data-rsvp-setting="reply-by"');
  const block = ask.slice(at, ask.indexOf('</DetailsPieceOnly>', at));
  assert.ok(block.length > 50, 'anti-vacuity: the reply-by block was not found');
  assert.doesNotMatch(block, /Set your event date first|formatDay\(replyBy\.date\)/, 'the date is said twice again');
  assert.match(block, /fallback=\{replyByFallback \?\? \(replyBy\?\.isDefault \? replyBy\.date : null\)\}/);
  assert.match(ask, /value=\{value \|\| fallback \|\| ''\}/, 'the field is empty while a date is in force');
  assert.match(ask, /toLocaleDateString\('en-US', \{\s*day: 'numeric',\s*month: 'long',/, 'not the Maker’s one date format');
  // Both RSVP panels (Details' settings and the RSVP stage) are handed the default the field shows.
  assert.equal((read('app/dashboard/[eventId]/launch/page.tsx').match(/replyByFallback=\{resolveReplyBy\(\{ deadline: null, eventDate: printEvent\.event_date \}\)\?\.date \?\? null\}/g) ?? []).length, 2);
});

test('(14) the March has no caption in the step; the cover has no "made once" line; the cover’s dropdown says the step’s word', () => {
  assert.match(read('app/dashboard/[eventId]/guests/_components/entourage-order-panel.tsx'), /group-data-\[details-mode=guided\]\/ws:hidden" data-march-caption=""/, 'the march’s caption shows in the step');
  assert.doesNotMatch(read(`${L}/maker-made-once.tsx`), /Made once, shown everywhere/, 'the cover’s caption came back');
  assert.match(read(`${L}/details-workspace.tsx`), /current=\{pieceLabels\[selected\]\?\.\[pieceMap\[selected\] \?\? ''\] \?\? stepHere\.title\}/, 'the step’s dropdown says the item’s word ("Hero")');
});

test('(15) How guests get in: label and dropdown on ONE row', () => {
  assert.match(read(`${L}/maker-rsvp-ask.tsx`), /<section className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1" data-rsvp-setting="who-can-rsvp">/);
});

test('(16) the Schedule’s Journey · Preparation · Event Day wears the one segmented control — and each view stays a LINK', () => {
  const t = read('app/dashboard/[eventId]/schedule/_components/schedule-mode-toggle.tsx');
  assert.match(t, /className=\{I_SEGMENTED_CLASS\}/, 'the views lost the segmented track');
  assert.match(t, /className=\{iSegClass\(on, 'wine'\)\}/, 'the views lost the segment look');
  assert.match(t, /<Link\b[\s\S]{0,120}href=\{hrefFor\(mode\)\}[\s\S]{0,120}aria-current=\{on \? 'page' : undefined\}/, 'a view is no longer a link with a current page');
  assert.doesNotMatch(t, /<button|router\.(replace|push)|onClick=/, 'a view went back to a button — no new tab, no deep link');
  assert.doesNotMatch(t, /sn-seg-item|role="tab"/, 'the old pill row came back');
  const kit = read('app/dashboard/[eventId]/website/editor/_components/inspector-kit.tsx');
  assert.match(kit, /className=\{`\$\{iSegClass\(on, tone\)\} \$\{className\}`\}/, 'ISeg and the links no longer share one look');
});

test('(17) The Day: ONE "Happening now", and "event" — never "celebration" — on the live card', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SpotlightCard } = await import('../app/[slug]/_components/spotlight-card');
  const html = renderToStaticMarkup(React.createElement(SpotlightCard, { spotlight: { kind: 'watch_live' } as never }));
  assert.match(html, /Watch the event live/, 'the live card says something else');
  assert.doesNotMatch(html, /celebration/);
  assert.match(read('app/[slug]/_components/site-body.tsx'), /dayOfPhase === 'live' && plan\.spotlight\?\.kind !== 'watch_live' \?/, 'the masthead pill doubles the live card again');
});

test('(18) the Seat plan step: the tool’s head is its controls only, and the room overview keeps every wall label whole — on every view', async () => {
  const phone = read('app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx');
  assert.match(phone, /text-ink group-data-\[details-mode=guided\]\/ws:hidden">Seat plan<\/h2>/, 'the tool’s title shows above the step');
  assert.match(phone, /data-seat-plan-status="" className="[^"]*group-data-\[details-mode=guided\]\/ws:hidden"/, 'the status line shows above the step');
  const editor = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(
    editor,
    /const z = roomOverviewZoom\(box, \[\.\.\.world\.querySelectorAll\('\*'\)\]\.map\(\(el\) => el\.getBoundingClientRect\(\)\)\);\s*applyView\(z, \{ x: \(box\.width \* \(1 - z\)\) \/ 2, y: \(box\.height \* \(1 - z\)\) \/ 2 \}\);/,
    'the overview fills the canvas edge to edge again (labels at the walls cut)',
  );
  assert.match(editor, /if \(!venueScaled \|\| view !== 'plan'\) return;/, 'the overview is measured with no plan on screen');
  assert.match(editor, /\}, \[venueScaled, view\]\);/, 'opening the plan from the List shows the room cut at the walls');
  assert.doesNotMatch(editor, /ROOM_OVERVIEW_ZOOM/, 'a guessed constant came back');

  // Measured on maria-and-jose's own room (normal page, 375 × 812): a 347 × 521 canvas,
  // wall labels reaching 28px past both walls at zoom 1 — every one whole after.
  const { roomOverviewZoom } = await import('./seat-plan-overview');
  const canvas = { left: 14, top: 200, right: 361, bottom: 721 };
  const W = 347;
  const labels = [
    { left: 14 - 28, top: 306, right: 14 - 28 + 90, bottom: 322 },
    { left: 361 - 62, top: 295, right: 361 + 28, bottom: 311 },
    { left: 0, top: 0, right: 0, bottom: 0 }, // a hidden layer — not a label past a wall
    { left: 14, top: 200, right: 361, bottom: 721 }, // the walls themselves
  ];
  const z = roomOverviewZoom(canvas, labels);
  assert.ok(z < 0.9, `a fixed 0.9 still cut the labels; measured zoom ${z}`);
  const m = (W * (1 - z)) / 2;
  for (const l of labels.slice(0, 2)) {
    const left = canvas.left + m + z * (l.left - canvas.left);
    const right = canvas.left + m + z * (l.right - canvas.left);
    assert.ok(left >= canvas.left && right <= canvas.right, `a wall label is still cut at zoom ${z}`);
  }
  assert.equal(roomOverviewZoom(canvas, [{ left: 40, top: 300, right: 120, bottom: 316 }]), 1, 'nothing past a wall: the room as large as it fits');
});

test('(19) Skip goes to the VERY next screen — a link step (the guests’ names) is a screen of the walk', async () => {
  const { hubSetupRound } = await import('./hub-setup-steps');
  const { skipScreen, nextScreen, guidedScreens, stageSteps, progressLabel } = await import('./details-guided-flow');
  const keys = ['names', 'date', 'theme', 'logo', 'hero', 'love-story', 'venues', 'schedule', 'parents', 'march', 'mood-board', 'special-message', 'rsvp'];
  const nav = keys.map((k) => ({ key: k, label: k, done: false }));
  const facts = { guestList: true, arrival: false, venuesLocked: { ceremony: false, reception: false }, venuesNamed: { ceremony: false, reception: false }, loveStoryMoments: 0, wear: false, replyBy: false, guests: 0 };
  const p = buildGuidedPlan(nav as GuidedItem[], { solemn: false, parentsOffered: true }, hubSetupRound(facts, new Set(keys)));
  const round = p.rounds.find((r) => p.links.some((l) => l.stages.includes(r)));
  assert.ok(round, 'anti-vacuity: no stage carries a link step');
  const last = stageSteps(p, round!).at(-1)!;
  const link = p.links.find((l) => l.stages.includes(round!))!;
  const at = { kind: 'step', step: last.key, round: round! } as const;
  assert.deepEqual(skipScreen(p, at), { kind: 'link', link: link.key, round }, 'Skip from the last step jumps past the guests’ names');
  assert.deepEqual(nextScreen(p, at), { kind: 'link', link: link.key, round });
  assert.ok(guidedScreens(p, round!).some((sc) => sc.kind === 'link'), 'the link step is not a screen');
  const total = stageSteps(p, round!).length + p.links.filter((l) => l.stages.includes(round!)).length;
  assert.match(progressLabel(p, { kind: 'link', link: link.key, round: round! }), new RegExp(`${total} of ${total}$`), 'the link step is not counted in its place');
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /\{plan && at\?\.kind === 'link' \? \(\s*<GuideLinkScreen/, 'the link screen is not drawn');
});

test('(20) a control that writes live says so plainly: "Guests see this right away" — the March order and Reply by included', () => {
  const field = read('app/dashboard/[eventId]/website/_components/hub-draft-field.tsx');
  assert.match(field, /export const HUB_LIVE_WORDS = 'Guests see this right away';/);
  assert.match(field, /<InfoTip label=\{HUB_LIVE_WORDS\}/, 'the live mark shows the plain words, not "Saves immediately"');
  assert.doesNotMatch(field, /['">]Saves immediately/, 'the old words are gone from the mark');
  for (const f of [`${L}/details-march.tsx`, `${L}/maker-rsvp-ask.tsx`]) {
    assert.match(read(f), /<HubSavesImmediately\b/, `${f} still says it writes live (owner: they stay instant)`);
  }
});

test('(21) every watch-live surface says "event" — the live card, the camera picker, the embed, the Facebook card', async () => {
  const { watchLiveOccasion } = await import('./watch-live-occasion');
  assert.equal(watchLiveOccasion('celebration'), 'event');
  assert.equal(watchLiveOccasion(undefined), 'event');
  assert.equal(watchLiveOccasion('gathering'), 'gathering', 'a funeral keeps its own word');
  const S = 'app/[slug]/_components';
  let said = 0;
  for (const f of ['watch-live-embed', 'roam-watch-picker', 'watch-live-block', 'spotlight-card']) {
    const src = read(`${S}/${f}.tsx`);
    // (spotlight-card's own default also words its RSVP line — not a watch-live string.)
    if (f !== 'spotlight-card') assert.doesNotMatch(src, /occasion = 'celebration'/, `${f}: the default word is "celebration" again`);
    assert.doesNotMatch(src, /(Watch the|broadcast of the) \$\{occasion\}/, `${f}: prints the raw occasion word on a watch-live line`);
    said += src.match(/(Watch the|broadcast of the) \$\{watchLiveOccasion\(occasion\)\}/g)?.length ?? 0;
  }
  assert.equal(said, 5, `watch-live lines said through the one mapping: ${said}`);
});

test('(22) touch a field → Skip asks; open only → Skip goes — a custom picker and a remounted field count', async () => {
  const T = await import('./guided-step-touch');
  const field = (name: string) => ({ tagName: 'INPUT', name, id: '' });
  const leaveOn = (touch: ReturnType<typeof T.newStepTouch>, via: 'skip' | 'next', unsaved = false) =>
    T.leaveAsks({ via, unsaved, touched: touch.any });

  // OPEN ONLY: the step draws, a tool fills a field on its own (untrusted), the couple taps nothing.
  const opened = T.newStepTouch();
  T.noteTouch(opened, { type: 'input', isTrusted: false, target: field('dress_code') });
  T.noteTouch(opened, { type: 'click', isTrusted: true, target: { tagName: 'BUTTON', closest: () => null } });
  assert.equal(leaveOn(opened, 'skip'), null, 'opening a step and skipping asked "you changed something"');

  // TYPED in a native field → Skip asks.
  const typed = T.newStepTouch();
  T.noteTouch(typed, { type: 'input', isTrusted: true, target: field('dress_code') });
  assert.equal(leaveOn(typed, 'skip'), 'skip', 'a keystroke then Skip went on without asking');
  assert.equal(leaveOn(typed, 'next'), null, 'Next after a change that saved asks for nothing');
  // …and the field REMOUNTED (a new element, the same name) is still the field they typed in.
  assert.ok(T.fieldTouched(typed.fields, field('dress_code')), 'a remounted field lost its touch');
  assert.ok(!T.fieldTouched(typed.fields, field('other')));

  // A CUSTOM PICKER: the one dropdown — its list portalled to <body>, outside the
  // step — belongs to the button that opened it, which IS in the step.
  const trigger = { tagName: 'BUTTON', closest: () => null };
  const doc = { querySelector: (sel: string) => (sel === '[aria-controls="pick-1"]' ? trigger : null) };
  const option = {
    tagName: 'BUTTON',
    closest: (sel: string) => (sel.includes('listbox') ? { getAttribute: () => 'pick-1' } : sel.includes('role="option"') ? {} : null),
  };
  assert.equal(T.touchOrigin(option, doc), trigger, 'a pick in the portalled list is not its button\'s');
  assert.equal(T.touchOrigin(trigger, doc), trigger);
  const picked = T.newStepTouch();
  T.noteTouch(picked, { type: 'click', isTrusted: true, target: option });
  assert.equal(leaveOn(picked, 'skip'), 'skip', 'a pick in the one dropdown then Skip went on without asking');
  // A picker's own announcement — a real event.
  const told = T.newStepTouch();
  const button = new EventTarget();
  button.addEventListener(T.MAKER_TOUCH_EVENT, (e) => T.noteTouch(told, e));
  T.announceMakerTouch(button);
  assert.equal(leaveOn(told, 'skip'), 'skip');
  // A segmented control / switch: a trusted press on a choice.
  const pressed = T.newStepTouch();
  T.noteTouch(pressed, { type: 'click', isTrusted: true, target: { tagName: 'BUTTON', closest: (sel: string) => (sel.includes('aria-pressed') ? {} : null) } });
  assert.equal(leaveOn(pressed, 'skip'), 'skip', 'a segmented pick then Skip went on without asking');
  // A field still unsaved asks on every way out.
  assert.equal(leaveOn(opened, 'next', true), 'unsaved');

  // The foot says which question it is asking.
  const { GuideFoot } = await import(`../${L}/details-guide`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const noop = () => {};
  const foot = (warning: 'skip' | 'unsaved' | null) =>
    renderToStaticMarkup(React.createElement(GuideFoot, { onBack: null, onSkip: noop, onNext: noop, warning, onKeepEditing: noop, onGoAnyway: noop }));
  assert.match(foot('skip'), /data-details-guide-unsaved="skip"[\s\S]*You changed something on this step\.[\s\S]*Skip anyway/);
  assert.match(foot('unsaved'), /isn’t saved yet[\s\S]*Go on without saving/);
  assert.doesNotMatch(foot(null), /data-details-guide-unsaved/);

  // Wired: the workspace hears the pickers, and Skip says it is Skip.
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /const kinds = \['input', 'change', 'click', MAKER_TOUCH_EVENT\];/, 'the step no longer hears the custom pickers');
  assert.equal(ws.match(/move\(skipScreen\(plan!?, at\), 'skip'\)/g)?.length, 3, 'a Skip button no longer says it is Skip');
  assert.match(ws, /leaveAsks\(\{ via, unsaved: hasUnsavedEdits\(/);
  assert.match(ws, /const t = touchOrigin\(e\.target, document\);/, 'a pick in the one dropdown\'s portalled list is outside the step again');
  // The one dropdown's list names its button while open — what `touchOrigin` follows.
  const pm = read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx');
  assert.match(pm, /aria-controls=\{open \? listId : undefined\}/);
  assert.match(pm, /id=\{listId\}\s*role="listbox"/);
});
