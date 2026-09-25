/**
 * hub-draft-wiring.test.ts — the draft's DOORS, held as properties of the source.
 *
 * `hub-draft.test.ts` proves the rules. This proves the wiring that makes them
 * reach a real request — each anchored per FUNCTION (never per file), with the
 * counts printed so a green run shows what it looked at:
 *
 *   1. ONE new server action (the +1 budget), and it asks the Pro gate before it
 *      writes; in the store shell it never treats the couple as owning Pro.
 *   2. Every draftable writer diverts to the draft BEFORE its live `.update(`,
 *      and skips its Pro gate ONLY on the draft path (`!drafting`) — never
 *      unconditionally.
 *   3. The guest page reads a draft only under `?editor=1`, through the host
 *      check — every guest request skips it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The text of one function (exported or not), up to the next top-level function. */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm'));
  assert.ok(start >= 0, `function ${name} not found`);
  const rest = src.slice(start + 1);
  const next = rest.search(/^(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

const ACTIONS = 'app/dashboard/[eventId]/website/hub-draft-actions.ts';
const WIDGETS = 'app/dashboard/[eventId]/website/widgets/actions.ts';
const EDITOR = 'app/dashboard/[eventId]/website/editor/actions.ts';
const HERO = 'app/dashboard/[eventId]/website/hero-photo/actions.ts';

test('the draft action file exports exactly ONE server action', () => {
  const src = read(ACTIONS);
  assert.match(src, /^\s*['"]use server['"]/);
  const exports = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)/gm)].map((m) => m[1]);
  console.log(`[hub-draft-wiring] exports of ${ACTIONS}: ${exports.join(', ')}`);
  assert.deepEqual(exports, ['hubDraftAction']);
});

test('apply asks the Pro gate before its first live write, and the store shell never counts as Pro', () => {
  const body = fn(read(ACTIONS), 'hubDraftAction');
  const gate = body.search(/\blookProAllows\s*\(/);
  const firstUpdate = body.search(/\.update\s*\(/);
  assert.ok(gate > 0, 'apply must ask lookProAllows');
  assert.ok(firstUpdate > gate, 'a live .update( comes before the Pro gate');
  assert.match(body, /storeShell\s*\?\s*false\s*:\s*await\s+lookProAllows\(/, 'in the store shell a Pro key must never apply');
  assert.match(body, /planHubDraftApply\(\s*current,\s*live,\s*ownsPro\s*\)/, 'the plan must be decided with the measured ownsPro');
});

const DRAFTABLE: Array<[file: string, name: string, divert: RegExp]> = [
  [WIDGETS, 'setWidgetMotion', /saveCanvasToDraft\(/],
  [WIDGETS, 'setWidgetBackground', /saveCanvasToDraft\(/],
  [WIDGETS, 'setWidgetCrop', /saveCanvasToDraft\(/],
  [WIDGETS, 'setSectionMode', /saveWidgetToDraft\(/],
  [WIDGETS, 'moveWidget', /saveHubDraftPatch\(/],
  [WIDGETS, 'toggleWidgetVisibility', /saveWidgetToDraft\(/],
  [WIDGETS, 'saveCustomSection', /saveCanvasToDraft\(/],
  [EDITOR, 'saveRsvpBackdrop', /draftBackdrop\(/],
  [EDITOR, 'clearRsvpBackdrop', /draftBackdrop\(/],
  // Maker Phase 6 — the one hero.
  [HERO, 'uploadHeroPhoto', /draftHero\(/],
  [HERO, 'removeHeroPhoto', /draftHero\(/],
  // 2026-09-25 — the Maker's live savers: colours and the couple's words.
  ['app/dashboard/[eventId]/website/colors/actions.ts', 'updateSiteColors', /draftEventsAndReturn\(/],
  ['app/dashboard/[eventId]/website/special-message/actions.ts', 'updateSpecialMessage', /draftEventsAndReturn\(/],
  ['app/dashboard/[eventId]/website/what-to-bring/actions.ts', 'updateWhatToBring', /draftEventsAndReturn\(/],
  ['app/dashboard/[eventId]/website/our-story/actions.ts', 'updateOurStory', /draftEventsAndReturn\(/],
  ['app/dashboard/[eventId]/website/our-story/actions.ts', 'loveStoryMomentAction', /draftEventsAndReturn\(/],
  ['app/dashboard/[eventId]/website/dress-code/actions.ts', 'updateDressCode', /draftEventsAndReturn\(/],
  ['app/dashboard/[eventId]/website/photo-moments/actions.ts', 'updatePhotoMoments', /saveHubDraftPatch\(/],
];

test('every draftable writer diverts to the draft before its first live write', () => {
  for (const [file, name, divert] of DRAFTABLE) {
    const body = fn(read(file), name);
    const d = body.search(divert);
    const u = body.search(/\.update\s*\(/);
    assert.ok(d > 0, `${name} has no draft door`);
    assert.ok(u > d, `${name} writes live before it can divert to the draft`);
    assert.match(body, /isHubDraftWrite\(formData\)/, `${name} must decide by the form's draft field`);
    console.log(`[hub-draft-wiring]   diverts  ${file}#${name}`);
  }
});

test('a Pro gate in a draftable writer is skipped ONLY on the draft path', () => {
  let gates = 0;
  for (const [file, name, divert] of DRAFTABLE) {
    const body = fn(read(file), name);
    const firstDivert = body.search(divert);
    let at = 0;
    for (const line of body.split('\n')) {
      const pos = at;
      at += line.length + 1;
      if (!/\brequireLookPro\s*\(/.test(line)) continue;
      gates += 1;
      // Either the gate itself is conditioned on the live path, or the draft
      // path has already left (redirected) before the gate is reached.
      const conditioned = /if\s*\(\s*!drafting\s*\)/.test(line);
      const draftLeftFirst = firstDivert >= 0 && firstDivert < pos && /isHubDraftWrite\(formData\)\)\s*await/.test(body.slice(0, pos));
      assert.ok(conditioned || draftLeftFirst, `${name}: a Pro gate the draft path can reach — "${line.trim()}"`);
    }
    const tx = body.split('\n').find((l) => /step\.needsPro/.test(l));
    if (tx) assert.match(tx, /!drafting/, `${name}: the transition Pro check must only be skipped for a draft`);
  }
  console.log(`[hub-draft-wiring] conditioned Pro gates: ${gates}`);
  assert.ok(gates >= 4, `only ${gates} gates seen — the scan is not looking at the writers`);
});

test('the guest page reads a draft only for the host canvas (?editor=1 · ?preview=draft)', () => {
  const page = read('app/[slug]/page.tsx');
  const calls = [...page.matchAll(/loadHostPreviewDraft\(/g)].length;
  assert.equal(calls, 1, 'one call site, inside the editor branch');
  const at = page.indexOf('loadHostPreviewDraft(admin');
  // The canvas (?editor=1) and the ▶ Play tab (?preview=draft) both ask through
  // ONE predicate — `asksForHostCanvas`, app/[slug]/_lib/editor-canvas.ts.
  const guard = page.lastIndexOf('if (asksForHostCanvas(search))', at);
  assert.ok(guard > 0 && at - guard < 400, 'the draft read must sit inside the host-canvas branch');
  const ask = read('app/[slug]/_lib/editor-canvas.ts');
  assert.match(ask, /return search\?\.editor === '1' \|\| search\?\.preview === 'draft';/, 'only these two params may ask');
  const loaders = read('app/[slug]/_lib/loaders.ts');
  const loader = loaders.slice(loaders.indexOf('export const loadHostPreviewDraft'));
  assert.match(loader.slice(0, 400), /loadHostMembership\(/, 'the loader must answer null for a non-host');
});

test('the eye diverts on draft=1: toggleWidgetVisibility drafts is_visible AFTER its checks and BEFORE its live write', () => {
  const body = fn(read(WIDGETS), 'toggleWidgetVisibility');
  const alwaysOn = body.search(/row\.is_always_on\s*&&\s*!nextVisible/);
  const gate = body.search(/if\s*\(\s*isHubDraftWrite\(formData\)\s*\)/);
  const door = body.search(/saveWidgetToDraft\(formData,\s*eventId,\s*row\.widget_type[^)]*\{\s*is_visible:\s*nextVisible\s*\}\s*\)/);
  const live = body.search(/\.update\(\{\s*is_visible:\s*nextVisible\s*\}\)/);
  console.log(`[hub-draft-wiring] toggleWidgetVisibility: always-on@${alwaysOn} gate@${gate} door@${door} live@${live}`);
  assert.ok(alwaysOn > 0, 'the always-on refusal is gone');
  assert.ok(gate > alwaysOn, 'the draft door must come after the always-on refusal (a draft may not hide Home either)');
  assert.ok(door > gate, 'on draft=1 the eye must save { is_visible: nextVisible } to the draft');
  assert.ok(live > door, 'the live is_visible write must come after the door, so a drafted eye never reaches it');
  // `saveWidgetToDraft` redirects (returns never), so the live write is unreachable on the draft path.
  assert.match(fn(read(WIDGETS), 'saveWidgetToDraft'), /Promise<never>/);
});

test('a custom section drafts ONLY its canvas (layout, template, slots, clip); its words and removal stay live', () => {
  const body = fn(read(WIDGETS), 'saveCustomSection');
  const arrange = body.indexOf("intent === 'arrange'");
  const door = body.search(/if \(drafting\) \{\s*const base = await canvasBase\(true/);
  assert.ok(arrange > 0 && door > arrange, 'the layout door must sit inside the arrange branch');
  const elseAt = body.indexOf('} else {', arrange);
  assert.ok(door < elseAt, 'the door must not reach the words branch');
});

test('a template scene (Phase 5) drafts its template, slot and clip writes, building on the drafted canvas', () => {
  const body = fn(read(WIDGETS), 'saveCustomSection');
  const scene = body.indexOf("intent === 'template' || intent === 'slot' || intent === 'video'");
  assert.ok(scene > 0, 'the scene intents are gone');
  const drafting = body.search(/const drafting = isHubDraftWrite\(formData\)/);
  assert.ok(drafting > 0 && drafting < scene, 'the draft decision must be made before the scene branch');
  const base = body.search(/sanitizeHubCanvas\(drafting \? await canvasBase\(true, eventId, row\) : existing\)/);
  assert.ok(base > scene, 'a drafted scene edit must build on the drafted canvas, not the live one');
  const door = body.indexOf('if (drafting) await saveCanvasToDraft(formData, eventId, row.widget_type, nextCanvas)');
  const arrange = body.indexOf("intent === 'arrange'");
  assert.ok(door > base && door < arrange, 'the scene door must sit at the end of the scene branch');
  const gates = body.split('\n').filter((l) => /\brequireLookPro\s*\(/.test(l));
  assert.ok(gates.length >= 2, `only ${gates.length} scene Pro gates seen`);
  for (const g of gates) assert.match(g, /if\s*\(\s*!drafting\s*\)/, `a scene Pro gate the draft path can reach: ${g.trim()}`);
});

test('Apply re-checks every slot picture is the couple\'s own, not only the background', () => {
  const body = fn(read(ACTIONS), 'hubDraftAction');
  assert.match(body, /drafted\?\.media,\s*\.\.\.\(drafted\?\.slots \?\? \[\]\)\.map\(\(s\) => s\.media\)/);
  assert.match(body, /refs\.some\(\(r\) => !ownRefs\.has\(r\)\)/);
});
