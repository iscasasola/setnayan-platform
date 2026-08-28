/**
 * THE SUPPLIER'S PATH IS NEVER BLOCKED BY THE ASSISTANT (C4, 2026-08-28).
 *
 * ── THE TWO WAYS THIS COULD GO WRONG ────────────────────────────────────────
 * 1. A supplier presses "Request", a model call fails, and they lose the
 *    submission — or meet an error about an assistant they never asked for. The
 *    request must already be INSERTED before anything is drafted, and the
 *    drafter must be incapable of throwing.
 * 2. A supplier cannot find their trade and concludes they cannot make a card.
 *    The card is universal (owner, 2026-08-28: "the card is universal fit for
 *    any service") — Miscellaneous is always on the screen and the screen has
 *    to SAY so, in the two places a supplier meets the dead end.
 *
 * ⚠ SOURCE MATCHING CANNOT SEE A MISSING IMPORT — run `tsc` beside this file.
 * Comments are stripped (the repo's own `loadSources`), so a docblock promising
 * any of this can never make the guard green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { loadSources } from './gate-writers';

const WEB_ROOT = join(import.meta.dirname, '..');
const SOURCES = new Map(loadSources(WEB_ROOT).map((s) => [s.path, s.code]));

function read(rel: string): string {
  const code = SOURCES.get(rel);
  assert.ok(code !== undefined, `no source at ${rel} — did the file move?`);
  return code;
}

/** The `proposeCategory` body only — indices elsewhere in a 3000-line file
 *  would prove nothing about the order inside this one action. */
function proposeCategoryBody(): string {
  const code = read('app/vendor-dashboard/services/actions.ts');
  const start = code.indexOf('export async function proposeCategory(');
  assert.ok(start > 0, 'proposeCategory is gone');
  const end = code.indexOf('\nexport async function ', start + 1);
  assert.ok(end > start, 'could not find the end of proposeCategory');
  return code.slice(start, end);
}

test('the request is INSERTED before anything is drafted, and drafted before the redirect', () => {
  const body = proposeCategoryBody();
  const insert = body.indexOf(".from('taxonomy_category_requests')");
  const insertFailed = body.indexOf('if (error) {');
  const draft = body.indexOf('maybeDraftCategoryProposal(');
  const done = body.indexOf('?requested=1');
  assert.ok(insert > 0 && insertFailed > insert, 'the insert or its error branch is gone');
  assert.ok(
    draft > insertFailed,
    'the draft is attempted before the request is safely filed — a model fault would cost the supplier their submission',
  );
  assert.ok(done > draft, 'the supplier is redirected to the "we have it" screen after');
});

test('the drafter is keyed on an id the action itself minted, never one from the form', () => {
  const body = proposeCategoryBody();
  assert.match(body, /\.select\('request_id'\)/);
  assert.match(body, /maybeDraftCategoryProposal\(created\?\.request_id \?\? '',/);
  // If a request id could arrive on the FormData, a signed-in stranger could
  // attach a forged proposal to somebody else's request.
  assert.equal(
    body.includes("formData.get('request_id')"),
    false,
    'proposeCategory started reading a request id from the browser',
  );
});

test('the drafter cannot throw: one try, one catch, nothing returned to handle', () => {
  const code = read('lib/category-proposal-draft-server.ts');
  assert.match(
    code,
    /export async function maybeDraftCategoryProposal\([\s\S]*?\): Promise<void> \{\s*try \{/,
    'the exported drafter no longer opens with a try, or no longer returns void',
  );
  assert.match(code, /\}\s*catch \{[\s\S]*?\}\s*\}/, 'the catch is gone');
});

test('the flag is checked FIRST — with it off, nothing is read and nothing is spent', () => {
  const code = read('lib/category-proposal-draft-server.ts');
  const flag = code.indexOf('isCategoryProposalDraftEnabled()');
  const tree = code.indexOf('await loadLiveTree()');
  const model = code.indexOf('askTheModelForADraft(');
  const write = code.indexOf('await writeDraft(');
  assert.ok(flag > 0 && tree > flag, 'the live tree is read before the flag is consulted');
  assert.ok(model > flag && write > flag, 'the model or the write runs before the flag is consulted');
});

test('the model is reached only after the shipped ranker has come back empty', () => {
  const code = read('lib/category-proposal-draft-server.ts');
  assert.match(
    code,
    /lexicalDraft\(typedLabel, trades\);[\s\S]*?if \(!draft\) draft = await askTheModelForADraft\(/,
    'the model is no longer gated on the free lexical arm finding nothing',
  );
});

test('a missing key is a normal state, not an error path', () => {
  const code = read('lib/category-proposal-draft-server.ts');
  assert.match(code, /if \(!aiConfigured\(\)\) return null;/);
  // Reuses the shipped client + key check rather than adding a second one.
  assert.match(code, /import \{ aiConfigured \} from '@\/lib\/admin-map\/ask-the-admin';/);
});

test('both dead ends tell the supplier they can ship under Miscellaneous today', () => {
  const maker = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  const manager = read('app/vendor-dashboard/services/_components/services-manager.tsx');
  assert.match(maker, /Miscellaneous/, 'the maker’s empty search state stopped saying it');
  assert.match(manager, /Miscellaneous/, 'the request form stopped saying it');
});
