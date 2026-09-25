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
  [EDITOR, 'saveRsvpBackdrop', /draftBackdrop\(/],
  [EDITOR, 'clearRsvpBackdrop', /draftBackdrop\(/],
  // Maker Phase 6 — the one hero.
  [HERO, 'uploadHeroPhoto', /draftHero\(/],
  [HERO, 'removeHeroPhoto', /draftHero\(/],
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

test('the guest page reads a draft only under ?editor=1', () => {
  const page = read('app/[slug]/page.tsx');
  const calls = [...page.matchAll(/loadHostPreviewDraft\(/g)].length;
  assert.equal(calls, 1, 'one call site, inside the editor branch');
  const at = page.indexOf('loadHostPreviewDraft(admin');
  const guard = page.lastIndexOf("search.editor === '1'", at);
  assert.ok(guard > 0 && at - guard < 400, 'the draft read must sit inside the ?editor=1 branch');
  const loaders = read('app/[slug]/_lib/loaders.ts');
  const loader = loaders.slice(loaders.indexOf('export const loadHostPreviewDraft'));
  assert.match(loader.slice(0, 400), /loadHostMembership\(/, 'the loader must answer null for a non-host');
});
