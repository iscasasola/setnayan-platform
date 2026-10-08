/**
 * a-failed-save-says-so.test.ts — STEP 4C: THE CARD SAYS WHAT ITS LAST SAVE DID, IN PLAIN WORDS, WITHIN THE PRESS.
 *
 * (1) A save that did NOT land never reads as one that did. The line used to say "Saved" whenever the pending state ended — which a
 *     thrown save also does; and the Undo was offered at once, before the answer. Now the form hears the action's own answer:
 *     "Saving…" in flight · "Saved" only after it LANDED · "Couldn’t save." with a real Try again button when it did not (kept
 *     until the next save lands, never an Undo for a change that was not made) — and the host's unsaved words STAY ON SCREEN
 *     (React 19 resets a form after its action returns, a failed one included; the reset is refused for a failed save).
 *     A redirect/not-found (the action's own way of sending an error to be SEEN) passes through untouched.
 * (2) A refused save comes back as `?error=`: a code the card knows says its sentence; a database's own message never reaches the
 *     host — one plain line of the card's own does (`guest-card-error-copy.ts`, mapped on the SERVER, so nothing is downloaded).
 * (3) The card's small forms' buttons (This is me · Send sign-in link · Give the spot · Take the seat back) are a kit leaf: the
 *     Maker's card keeps its hand classes (it cannot import ActionButton), the Guests pages draw the ONE button.
 *
 * Also exercised in a real browser against a bundled harness (not committed): a thrown save → "Couldn’t save." + Try again, no Undo
 * toast, the typed words still there; Try again that fails again stays failed; one that lands says "Saved".
 *
 * SABOTAGE (each seen RED, then restored): "Saved" set before the action answers · the Undo offered before the answer · the reset not
 * refused · a redirect swallowed · the database's words let through · a hand-classed button on the templated card.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { createRequire } from 'node:module';

// `server-only` / `client-only` resolve to an empty module (the card's body reaches server actions), as in the-card-posts-the-same-form.test.ts.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_failed_save__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const AUTO = read('guest-card-autosave.tsx');

let guestCardErrorCopy: (raw: string) => string;
let GUEST_CARD_FALLBACK: string;
test('loads the card’s error copy', async () => {
  ({ guestCardErrorCopy, GUEST_CARD_FALLBACK } = await import('./guest-card-error-copy'));
});

test('(1) the save line is told by the action’s answer — Saved only after it landed, Couldn’t save when it threw', () => {
  const run = AUTO.slice(AUTO.indexOf('const run = useCallback('), AUTO.indexOf('const schedule = () => {'));
  assert.match(run, /try \{\s*await action\(fd\);\s*\} catch \(e\) \{\s*if \(isFrameworkSignal\(e\)\) throw e;\s*failedLast\.current = true;/);
  assert.match(run, /setOutcome\(\{ kind: 'failed' \}\);\s*return;\s*\}\s*setOutcome\(\{ kind: 'saved', n: \+\+landed\.current \}\);/, '"saved" is set on a path a failure can take');
  assert.ok(run.indexOf("kind: 'saved'") > run.indexOf('await action(fd)'), '"Saved" is set before the action answered');
  /* The Undo is offered only once the save LANDED. */
  assert.ok(run.indexOf('pushUndo(') > run.indexOf("kind: 'saved'"), 'the Undo is offered before the save landed');
  assert.doesNotMatch(AUTO.slice(AUTO.indexOf('const schedule = () => {'), AUTO.indexOf('return (\n    <OutcomeContext.Provider')), /pushUndo\(/, 'schedule() still offers the Undo at once');
  assert.match(AUTO, /pushUndo\(\{ label, undo: \(\) => undoTo\(prev\) \}\)/, 'the Undo is no longer the previous payload through the same action');
  /* A failed save keeps lastSaved on the payload before it, so the next Undo goes back to what is really saved. */
  assert.match(run, /if \(change\?\.prev\) lastSaved\.current = change\.prev;/);
  /* The framework's own signals are not failures. */
  assert.match(AUTO, /digest\.startsWith\('NEXT_REDIRECT'\)/);
  assert.match(AUTO, /digest\.startsWith\('NEXT_NOT_FOUND'\)/);
});

test('(1b) the line: Saving… · Saved (only for a landed save) · Couldn’t save + a real Try again button', () => {
  const state = AUTO.slice(AUTO.indexOf('export function AutosaveState'));
  assert.match(state, /\{pending \? \(\s*'Saving…'\s*\) : outcome\.kind === 'failed' \? \(/);
  assert.match(state, /Couldn’t save\./);
  assert.match(state, /<button type="button" onClick=\{retry\} data-autosave-retry=""/);
  assert.match(state, /: outcome\.kind === 'saved' && shown \? \(/, '"Saved" can show for something that did not land');
  assert.doesNotMatch(state, /wasPending|justSaved/, 'the old "pending ended, so it saved" rule is back');
  /* The templated card draws the same facts. */
  const rows = read('guest-card-rows.tsx');
  const line = rows.slice(rows.indexOf('export function CardSaveState'));
  assert.match(line, /outcome\.kind === 'failed' \? \(/);
  assert.match(line, /<ActionButton tone="danger" label="Try again"/);
  assert.match(line, /outcome\.kind === 'saved' && shown/);
});

test('(1c) the unsaved words stay on screen: the reset React runs after a FAILED save is refused (a native listener)', () => {
  assert.match(AUTO, /form\.addEventListener\('reset', keepUnsaved\);/, 'React does not run onReset for its own form.reset() — it must be a native listener');
  assert.match(AUTO, /const keepUnsaved = \(e: Event\) => \{\s*if \(failedLast\.current\) e\.preventDefault\(\);\s*\};/);
  assert.match(AUTO, /failedLast\.current = false;/, 'a later save never clears the failure flag, so every reset would be refused');
  assert.doesNotMatch(AUTO, /onReset=/, 'onReset is not called for React’s own reset (measured) — a prop here would guard nothing');
});

test('(1d) an Undo that does not land says so too', () => {
  const undo = AUTO.slice(AUTO.indexOf('const undoTo = useCallback('), AUTO.indexOf('/* The action the form posts'));
  assert.match(undo, /\} catch \(e\) \{\s*if \(isFrameworkSignal\(e\)\) throw e;[\s\S]*setOutcome\(\{ kind: 'failed' \}\);\s*return;\s*\} finally \{/);
});

test('(2) a database’s own words never reach the card; a known code and a plain sentence do (fixtures)', () => {
  assert.equal(guestCardErrorCopy('missing_name'), 'Please enter both first and last name.');
  assert.equal(guestCardErrorCopy('swap_failed'), 'The spot could not be given away just now — nothing was changed. Please try again.');
  assert.equal(guestCardErrorCopy(encodeURIComponent('Only the couple can unlink an account.')), 'Only the couple can unlink an account.');
  for (const raw of [
    'new row violates row-level security policy for table "guests"',
    'invalid input syntax for type uuid: "x"',
    'duplicate key value violates unique constraint "guests_pkey"',
    'some_unmapped_code',
    '%E0%A4%A',
  ]) {
    assert.equal(guestCardErrorCopy(encodeURIComponent(raw)), GUEST_CARD_FALLBACK, `printed to the host: ${raw}`);
  }
  assert.match(GUEST_CARD_FALLBACK, /nothing was changed/);
});

test('(2b) all three pages say it through that one function — never the raw value', () => {
  const pages: Array<[string, string]> = [
    ['the list’s panel', read('..', 'page.tsx')],
    ['the card page', read('..', '[guestId]', 'page.tsx')],
    ['the dev lab', readFileSync(join(HERE, '..', '..', '..', '..', 'dev', 'guests-lab', 'page.tsx'), 'utf8')],
  ];
  for (const [name, src] of pages) {
    assert.match(src, /guestCardErrorCopy\(/, `${name} does not use the card’s error copy`);
    assert.doesNotMatch(src, /GUEST_CARD_ERROR_COPY\[|\?\? decodeURIComponent|\?\? rawError/, `${name} prints an unmapped value as it came`);
  }
  assert.doesNotMatch(read('guest-card-body.tsx'), /guest-card-error-copy|plain-refusal/, 'the card body imports the helper (it must be mapped on the server, by the page)');
});

test('(3) the card’s small forms’ buttons are a kit leaf — no hand-classed SubmitButton left in the body', () => {
  const body = read('guest-card-body.tsx');
  const uses = body.match(/<K\.Submit\b/g) ?? [];
  assert.equal(uses.length, 4, 'This is me · Send sign-in link · Give the spot · Take the seat back');
  const real = body.slice(0, body.indexOf('function Field('));
  assert.doesNotMatch(real, /<SubmitButton\b/, 'a SubmitButton is drawn in the card’s body');
  assert.match(body, /<K\.Submit main pendingLabel="Giving the spot…">/, 'Give the spot is not the one filled step of its form');
  const rows = read('guest-card-rows.tsx');
  assert.match(rows, /actionButtonClass\(main \? 'brand' : 'neutral', \{ main, extra: 'w-full min-h-11' \}\)/);
  assert.match(rows, /<Explain title=\{label\}>/, 'the Give-this-spot ⓘ is not the approved Explain on the Guests pages');
  assert.doesNotMatch(body.slice(body.indexOf('return (\n    <div className="space-y-4">'), body.indexOf('function Field(')), /terracotta/, 'a terracotta alert or avatar fill is back');
});
