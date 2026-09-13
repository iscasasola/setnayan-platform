import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../strip-comments';

/**
 * DSK-1 · THE WIRING GUARD — the four joins no pure test can see.
 *
 * `shouldAttemptStart`, `pasteSubmit`, `pasteRefusalSentence` and the key bus are
 * each tested directly. What none of them can prove is that the COMPONENTS
 * actually call them, and that is precisely where this class of defect lives:
 * every stage of this encoder was built, tested and green while NOTHING CALLED
 * ANY OF THEM (build-sessions/encoder/ENC1-RULE0.md measured nine such gaps).
 * A stage with a passing test and no caller is the failure mode, not the
 * exception.
 *
 * This repo has no React test harness (no `.test.tsx`, no jsdom/RTL), so the
 * joins are asserted against source text — with the ONE canonical stripper
 * (`lib/strip-comments.ts`), because these files carry long docblocks that name
 * every symbol asserted below. Without stripping, every negative assertion here
 * would pass on prose.
 */

const WEB = join(process.cwd());
const HOST = join(
  WEB,
  'app/panood/control/[eventId]/_components/desktop-encoder-host.tsx',
);
const PANEL = join(WEB, 'app/_components/encoder-key-panel.tsx');
const CONTROLLER = join(WEB, 'app/panood/control/[eventId]/page.tsx');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  // A stripper that silently ate the file would make every assertion below pass
  // against a blank — the exact failure lint-one-comment-stripper.mjs documents.
  assert.ok(
    stripped.length > raw.length * 0.25,
    `stripping ${path} removed too much (${raw.length} -> ${stripped.length}); ` +
      'the assertions below would be running against a near-empty string',
  );
  return stripped;
}

test('the encoder host LISTENS for a key, and stops listening on teardown', () => {
  const src = code(HOST);
  assert.equal(
    (src.match(/subscribeStreamKeyHeld\(/g) ?? []).length,
    1,
    'the host must subscribe to the key bus exactly once — without it a pasted ' +
      'key changes a fact nothing re-reads, and the encoder stays dead',
  );
  assert.match(
    src,
    /offKeyHeld\(\);/,
    'the subscription must be released in the effect teardown, or a navigated-away ' +
      'host keeps being woken for a wedding it no longer serves',
  );
});

test('the retry decision is the tested one, not an inline conjunction', () => {
  const src = code(HOST);
  assert.match(src, /shouldAttemptStart\(\{\s*cancelled,\s*started,\s*starting\s*\}\)/);
  assert.doesNotMatch(
    src,
    /if\s*\(\s*cancelled\s*\|\|\s*started\s*\|\|\s*starting\s*\)/,
    'the guard was inlined again, which puts it back out of reach of a test',
  );
});

test('`started` is set only AFTER encoder_start resolves', () => {
  // Setting it before the await would make a REFUSED start look started, and the
  // retry would then refuse to run — the bug, rebuilt.
  const src = code(HOST);
  const marks = src.match(/started = true;/g) ?? [];
  assert.equal(marks.length, 1, 'exactly one place may mark the session started');
  const at = src.indexOf('started = true;');
  const awaitAt = src.indexOf('await session.start(eventId);');
  assert.ok(awaitAt > -1, 'the start call moved — this guard must be re-aimed, not deleted');
  assert.ok(
    awaitAt < at,
    '`started = true` must come after `await session.start(...)`, never before it',
  );
});

test('the paste panel announces the key only after Rust confirms it', () => {
  const src = code(PANEL);
  const announces = src.match(/announceStreamKeyHeld\(/g) ?? [];
  assert.equal(announces.length, 1, 'exactly one announcement, on the success path only');

  // The announcement must sit inside the `.then(` of the invoke — announcing on
  // submit would wake the encoder for a key Rust went on to refuse, and the retry
  // would fail for a reason nobody was ever shown.
  const setAt = src.indexOf('setPastedStreamKey(');
  const thenAt = src.indexOf('.then(', setAt);
  const catchAt = src.indexOf('.catch(', setAt);
  const announceAt = src.indexOf('announceStreamKeyHeld(');
  assert.ok(setAt > -1 && thenAt > -1 && catchAt > -1, 'the submit path moved — re-aim this guard');
  assert.ok(
    announceAt > thenAt && announceAt < catchAt,
    'announceStreamKeyHeld must be inside the .then() of setPastedStreamKey',
  );
});

test('the key still crosses IPC with an address, and the field still clears first', () => {
  const src = code(PANEL);
  assert.match(
    src,
    /setPastedStreamKey\(result\.send, result\.rtmpsUrl\)/,
    'the address must travel with the key, or Rust holds it against "" and refuses',
  );
  const clearAt = src.indexOf('setFieldValue(result.nextFieldValue);');
  const sendAt = src.indexOf('setPastedStreamKey(');
  assert.ok(clearAt > -1 && clearAt < sendAt, 'the field must be cleared before the invoke');
});

test('the by-hand route renders a place to give the encoder a key', () => {
  const src = code(CONTROLLER);
  const mounts = src.match(/<DesktopOwnChannelKeyCard\b/g) ?? [];
  assert.equal(
    mounts.length,
    1,
    'the manual-air route had NOWHERE to hand the encoder a key; exactly one mount',
  );
  // It must be gated on the by-hand route, not on activeBroadcast — being inside
  // `{activeBroadcast ? … }` is the original defect.
  const at = src.indexOf('<DesktopOwnChannelKeyCard');
  const window = src.slice(Math.max(0, at - 200), at);
  assert.match(
    window,
    /manualOnAir/,
    'the card must be gated on the by-hand route (manualOnAir)',
  );
  assert.doesNotMatch(
    window,
    /activeBroadcast\s*\?/,
    'gating on activeBroadcast is the defect: the by-hand route has none',
  );
});

test('the card renders nothing outside the desktop shell', () => {
  const src = code(PANEL);
  // The same JS ships to plain browsers, where none of the Tauri commands exist.
  assert.match(
    src,
    /if \(!desktop \|\| ownsHostedChannel\) return null;/,
    'the by-hand card must be gated on isTauri() and own-channel only',
  );
});
