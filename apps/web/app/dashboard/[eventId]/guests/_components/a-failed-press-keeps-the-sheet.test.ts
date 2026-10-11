/**
 * a-failed-press-keeps-the-sheet.test.ts — on the guest list, a press whose REQUEST fails keeps the sheet and what
 * was typed, and says it did not save. It never replaces the roster with the app's error screen.
 * (`hear-action.ts` has the story.)
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `startTransition(async () => { const res = await quickAddGuest(…) … })`. The action answers with a result object,
 * and every call site handled `!res.ok` — but a request that FAILS (offline, 5xx, a throw) has no result: the await
 * rejects, a rejected `useTransition` action is thrown into the nearest error boundary, and the dashboard has none
 * of its own. The whole screen became "Something on our end didn't work." and the typed names — or the invitation
 * message being written — were lost.
 *
 * ── What is proven, and how ────────────────────────────────────────────────
 * BEHAVIOUR (`hearAction`, driven with real promises):
 *   1 · a result passes through untouched — a landed save and a refusal alike;
 *   2 · a request that rejects, or a call that throws, answers `{ ok: false, error: '' }` — nothing is thrown;
 *   3 · that answer makes each call site say its OWN existing sentence (`plainRefusal('', fallback)` → fallback);
 *   4 · the framework's redirect and not-found pass through — they are not failures;
 *   5 · the action is called exactly once (it is not a retry).
 * THE PROPERTY (read from the syntax tree of the five listed components):
 *   6 · inside every callback handed to a `start…Transition(…)`, every `await` is either a `hearAction(…)` call or
 *       stands inside a `try` that has a `catch` — so no rejection can leave the transition. By file and line.
 *
 * ── Caveats — read before trusting a green run ─────────────────────────────
 *   · No browser runs here. That the sheet is still mounted and the inputs still hold their text after the answer
 *     is what React does when nothing is thrown; it was not rendered in this test (there is no DOM in this suite).
 *   · § 6 walks the callbacks of transitions in these five files. A server action awaited in a plain `async`
 *     click handler is NOT a crash (a rejection there never reaches an error boundary) and is not walked — but it
 *     is not heard either: nothing is said. None of the listed presses is written that way today.
 *   · An `await` inside a helper the callback calls is the helper's business and is not followed.
 *   · "Not saved" is said for a request whose fate is unknown (the connection dropped after the server had the
 *     press). A second press of an Add can then add the same name twice until the list re-reads — the sheet's
 *     "already on your list" check catches it only after a refresh. Needs a real network drop to see.
 *
 * Sabotage (2026-10-11, each on the real file, restored by hash):
 *   hearAction rethrows everything ............................... § 2 · 3 red
 *   hearAction swallows the redirect ............................. § 4 red
 *   quick-add: `quickAddGuest` awaited bare ...................... § 6 red
 *   capture-bar: `addSingleGuest` awaited bare ................... § 6 red
 *   add-from-people: `addGuestsFromPeople` awaited bare .......... § 6 red
 *   guest-invite-cell: `setGuestInvitationSent` awaited bare ..... § 6 red
 *   send-invite: `saveInviteMessage` awaited bare ................ § 6 red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { hearAction } from './hear-action';
import { plainRefusal } from './plain-refusal';

const HERE = __dirname;
const FILES = ['quick-add-sheet.tsx', 'capture-bar.tsx', 'add-from-people-sheet.tsx', 'guest-invite-cell.tsx', 'send-invite.tsx'] as const;

/** Next's redirect signal, as the browser receives it from a server action. */
const REDIRECT = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/dashboard/e-1/guests;307;' });
const NOT_FOUND = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });

// ── 1–5 · hearAction ───────────────────────────────────────────────────────

test('1 · a result passes through untouched', async () => {
  const landed = { ok: true as const, guest: { guest_id: 'g-1', first_name: 'Ana' } };
  const refused = { ok: false as const, error: 'That name is already on your list.' };
  assert.equal(await hearAction(async () => landed), landed);
  assert.equal(await hearAction(async () => refused), refused);
});

test('2 · a request that FAILS answers like a refusal — nothing is thrown', async () => {
  for (const failure of [
    new TypeError('Failed to fetch'), // offline
    new Error('An unexpected response was received from the server.'), // a 5xx
    Object.assign(new Error('boom'), { digest: '1234567890' }), // the action threw on the server
  ]) {
    assert.deepEqual(await hearAction(() => Promise.reject(failure)), { ok: false, error: '' }, failure.message);
  }
  // A call that throws before it returns a promise is a failure too, not a crash.
  assert.deepEqual(
    await hearAction((): { ok: boolean } => {
      throw new Error('threw synchronously');
    }),
    { ok: false, error: '' },
  );
});

test('3 · …and the call site then says its own existing sentence', async () => {
  const res = await hearAction<{ ok: true } | { ok: false; error: string }>(() => Promise.reject(new TypeError('Failed to fetch')));
  assert.equal(res.ok, false);
  if (!res.ok) {
    for (const fallback of ['Couldn’t save that. Try again.', 'Couldn’t add that guest. Try again.', 'Couldn’t add them just now. Try again.', 'Couldn’t make that group. Try again.']) {
      assert.equal(plainRefusal(res.error, fallback), fallback, 'a failed request shows something other than the page\'s own line');
    }
  }
});

test('4 · the framework\'s redirect and not-found pass through — they are not failures', async () => {
  await assert.rejects(() => hearAction(() => Promise.reject(REDIRECT)), (e) => e === REDIRECT, 'a redirect was reported as "not saved"');
  await assert.rejects(() => hearAction(() => Promise.reject(NOT_FOUND)), (e) => e === NOT_FOUND, 'a not-found was reported as "not saved"');
});

test('5 · the action is called once — hearing is not retrying', async () => {
  let calls = 0;
  await hearAction(() => {
    calls += 1;
    return Promise.reject(new TypeError('Failed to fetch'));
  });
  assert.equal(calls, 1, 'a failed write was sent again');
});

// ── 6 · the property ───────────────────────────────────────────────────────

type Found = { file: string; line: number; what: string; heard: boolean };

function awaitsInTransitions(file: string): Found[] {
  const text = readFileSync(join(HERE, file), 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Found[] = [];

  /** Is `node` inside the `try` block of a try that has a catch, without leaving `root`? */
  const insideCaughtTry = (node: ts.Node, root: ts.Node): boolean => {
    for (let n: ts.Node = node; n !== root && n.parent; n = n.parent) {
      const p = n.parent;
      if (ts.isTryStatement(p) && p.tryBlock === n && p.catchClause) return true;
    }
    return false;
  };

  const walkCallback = (root: ts.Node) => {
    const visit = (n: ts.Node) => {
      // A nested function is its own scope of awaits only if it is itself awaited/called here; keep it simple and
      // walk it too — an await in a nested callback of the transition is still the transition's rejection to lose.
      if (ts.isAwaitExpression(n)) {
        let operand: ts.Expression = n.expression;
        while (ts.isParenthesizedExpression(operand)) operand = operand.expression;
        const isHeard = ts.isCallExpression(operand) && ts.isIdentifier(operand.expression) && operand.expression.text === 'hearAction';
        out.push({
          file,
          line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          what: operand.getText(sf).split('\n')[0]!.slice(0, 60),
          heard: isHeard || insideCaughtTry(n, root),
        });
      }
      ts.forEachChild(n, visit);
    };
    visit(root);
  };

  const find = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^start\w*Transition$/.test(n.expression.text)) {
      const cb = n.arguments[0];
      if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) walkCallback(cb.body);
    }
    ts.forEachChild(n, find);
  };
  find(sf);
  return out;
}

test('6 · no await inside a transition on the guest list can reject out of it', () => {
  const all = FILES.flatMap(awaitsInTransitions);
  // Anti-vacuity: the walker finds the presses this work caught, in every file.
  for (const file of FILES) {
    assert.ok(all.some((f) => f.file === file && f.heard), `the walker found no heard press in ${file} — it moved, or the walker is blind`);
  }
  assert.ok(all.length >= 9, `anti-vacuity: ${all.length} awaits found in transitions; there were 9 presses when this was written`);
  for (const name of ['quickAddGuest', 'addRoleToGuest', 'setGuestPrimaryRole', 'quickCreateGroup', 'addSingleGuest', 'addGuestsFromPeople', 'setGuestInvitationSent', 'saveInviteMessage']) {
    const src = FILES.map((f) => readFileSync(join(HERE, f), 'utf8')).join('\n');
    assert.match(src, new RegExp(`hearAction\\(\\(\\) =>\\s*${name}\\(`), `anti-vacuity: ${name} is no longer called through hearAction`);
  }

  const bare = all.filter((f) => !f.heard).map((f) => `${f.file}:${f.line}  await ${f.what}`);
  assert.deepEqual(
    bare,
    [],
    'A request that fails here rejects the transition, and the app\'s error screen replaces the guest list — what the ' +
      'host typed is gone. Call it through `hearAction(() => …)` (it answers like a refusal), or await it inside try/catch:\n  ' +
      bare.join('\n  '),
  );
});
