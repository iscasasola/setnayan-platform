/**
 * the-maker-choice-is-never-a-failed-read.test.ts — 🧯 A READ THAT DID NOT
 * ANSWER NEVER PICKS A MAKER.
 *
 * Production incident, 2026-10-08. Owner, verbatim: *"why did i see the old
 * event hub maker?"* The new Maker ("Stages | Studio") is on for the flag, or
 * for an internal viewer — and "internal" is a database read
 * (`users.is_internal`). While PostgREST was refusing connections that read
 * timed out, came back as `false`, and `false` with the flag off is the
 * SHIPPED Maker. A failure rendered as a different product, to the one person
 * testing the new one.
 *
 * The rule, from the failed read to what the page does:
 *
 *   read failed  →  `internalAnswerFrom` says `read: false`
 *                →  `viewAsFreeSwitch().measured` is false
 *                →  `makerChoiceIsUnread` is true (while the flag is off)
 *                →  the launch page throws the house "Reconnecting…" error
 *                   BEFORE it chooses — neither Maker is drawn.
 *
 * Verified end to end on a local run against a stand-in database with the
 * `users` read answering 504 PGRST003: the response carried the
 * `SETNAYAN_SCHEMA_BLIP` digest from `LaunchPage.makerChoice` and no Maker
 * markup at all; with the read healthy it carried the new Maker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { makerChoiceIsUnread, makerStagesStudioEnabled } from './maker-stages-studio-flag';
import { internalAnswerFrom } from './internal-viewer-read';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const KEY = 'NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED';

function withFlag<T>(value: string | undefined, fn: () => T): T {
  const before = process.env[KEY];
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env[KEY];
    else process.env[KEY] = before;
  }
}

const TIMEOUT = { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool' };

test('a failed read is "did not answer" — never "not internal"', () => {
  assert.deepEqual(internalAnswerFrom({ data: null, error: TIMEOUT }), { read: false, internal: false });
  assert.deepEqual(internalAnswerFrom({ data: null, error: { code: '42501', message: 'permission denied' } }), { read: false, internal: false });
  // …and a read that DID answer says what it said, either way.
  assert.deepEqual(internalAnswerFrom({ data: { is_internal: true }, error: null }), { read: true, internal: true });
  assert.deepEqual(internalAnswerFrom({ data: { is_internal: false }, error: null }), { read: true, internal: false });
  assert.deepEqual(internalAnswerFrom({ data: { is_internal: null }, error: null }), { read: true, internal: false });
  // No row is an answer ("no such user row" is not internal), not a failure.
  assert.deepEqual(internalAnswerFrom({ data: null, error: null }), { read: true, internal: false });
});

test('the incident, replayed: flag off + the read timed out → the choice is UNREAD, where it used to be "the old Maker"', () => {
  withFlag(undefined, () => {
    const answer = internalAnswerFrom({ data: null, error: TIMEOUT });
    // What the page computed on 2026-10-08, and still computes for the boolean itself:
    assert.equal(makerStagesStudioEnabled({ internal: answer.internal }), false, 'the old Maker is what a failed read used to select');
    // …and what stops it being drawn:
    assert.equal(makerChoiceIsUnread({ internalRead: answer.read }), true, 'a failed read was allowed to choose the Maker');
  });
});

test('the choice is unread ONLY when the read is what decides it', () => {
  withFlag(undefined, () => {
    assert.equal(makerChoiceIsUnread({ internalRead: true }), false, 'a read that answered is a decided choice (a real couple keeps the shipped Maker)');
    assert.equal(makerChoiceIsUnread({ internalRead: false }), true);
  });
  for (const on of ['true', '1', 'yes', 'on', ' TRUE ']) {
    withFlag(on, () => {
      // The flag decides: everyone gets the new Maker, so a failed read changes nothing and must not block the page.
      assert.equal(makerChoiceIsUnread({ internalRead: false }), false, `"${on}": the page was refused over a read that could not change the answer`);
      assert.equal(makerChoiceIsUnread({ internalRead: true }), false);
    });
  }
  for (const off of ['false', '0', '', 'no']) {
    withFlag(off, () => assert.equal(makerChoiceIsUnread({ internalRead: false }), true, `"${off}" is off — the read decides`));
  }
});

test('`measured` is the read’s own answer, and `offered` still fails closed for the view switch', () => {
  const server = read('lib/view-as-free.server.ts');
  // The one read, through the one pure rule.
  assert.match(server, /\.select\('is_internal'\)/);
  assert.match(server, /return internalAnswerFrom\(\{ data, error \}\);/, 'the read no longer goes through internalAnswerFrom — its failure is a "no" again');
  assert.equal((server.match(/\.select\('is_internal'\)/g) ?? []).length, 1, 'a second read of is_internal: two answers that can disagree');
  // `measured` comes from `.read` and is false when the read itself threw.
  assert.match(server, /const measured = await viewerInternalRead\(\)\.then\(\s*\(r\) => r\.read,\s*\(\) => false,\s*\);/);
  assert.match(server, /return \{ offered, on: offered && on, measured \};/);
  // The view switch's own boolean is unchanged: internal only when the read said so.
  assert.match(server, /export const viewerIsInternal = cache\(async \(\): Promise<boolean> => \(await viewerInternalRead\(\)\)\.internal\);/);
});

test('the launch page refuses BEFORE it chooses, with the house reconnecting error — and only where there is a Maker to choose', () => {
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  const refuse = "if (hasWork && makerChoiceIsUnread({ internalRead: freeSwitch.measured })) throw schemaBlipError('LaunchPage.makerChoice');";
  const choose = 'const stagesStudio = hasWork && makerStagesStudioEnabled({ internal: freeSwitch.offered });';
  const at = page.indexOf(refuse);
  assert.ok(at > 0, 'the launch page no longer refuses an unread choice — a timed-out read picks the old Maker again');
  assert.equal(page.indexOf(refuse, at + 1), -1);
  const chosen = page.indexOf(choose);
  assert.ok(chosen > at, 'the Maker is chosen before the unread choice is refused');
  assert.equal(page.slice(at + refuse.length, chosen).trim(), '', 'something runs between the refusal and the choice');
  // Nothing else on the page reads the flag or decides the Maker.
  assert.equal((page.match(/makerChoiceIsUnread\(/g) ?? []).length, 1);
  // The error is the one the root boundary retries ("Reconnecting…"), then says so — never a blank or a redirect.
  const boundary = read('app/error.tsx');
  assert.match(boundary, /if \(isSchemaBlip\(error\) && !reconnectSpent\) \{\s*return <Reconnecting /);
  // …and the flag module asks the flag through its one reader, never the env a second time.
  const flag = read('lib/maker-stages-studio-flag.ts');
  assert.equal((flag.match(/process\.env\./g) ?? []).length, 1, 'the flag is read in two places');
  assert.match(flag, /return internalRead !== true && !makerStagesStudioEnabled\(\{ internal: false \}\);/);
});
