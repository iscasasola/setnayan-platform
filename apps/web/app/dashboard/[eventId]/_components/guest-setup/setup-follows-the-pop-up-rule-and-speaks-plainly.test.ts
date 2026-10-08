/**
 * setup-follows-the-pop-up-rule-and-speaks-plainly.test.ts — STEP 3C of Guests › Setup.
 *
 * (1) THE FINALIZE POP-UP follows the pop-up rule (owner 2026-10-08): drawn by `GuestPopup` on <body> — above the bottom bar,
 *     dark and blurred behind, a tap on the dark closes it, nothing behind works or scrolls — mounted only while open, and a
 *     press in flight cannot be closed away. No shared `Sheet`, no hand portal, no terracotta; "Not now" is the neutral
 *     button and "Finalize" the OK-toned filled one.
 * (2) EVERY REFUSAL IN THE SETUP VIEW IS ONE PLAIN SENTENCE (controller 2026-10-09: a host never reads database words): a
 *     refused save of the asks / how guests get in, a refused Finalize or Reopen, and a refused Reply by date. The action's
 *     own words are kept only when they are a plain sentence (`plain-refusal.ts`).
 *
 * SABOTAGE (each seen RED, then restored): the pop-up back on `Sheet` · the save refusal printing the action's text ·
 * Finalize printing `res.error` · the Reply by wrapper dropped · the close guard dropped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { keepInPlainWords } from './setup-frames';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROWS = stripComments(readFileSync(join(HERE, 'guest-setup-rows.tsx'), 'utf8'));

test('(1) the Finalize pop-up is GuestPopup, mounted only while open, and cannot be closed mid-press', () => {
  assert.match(ROWS, /\{open \? \(\s*<GuestPopup\s+onClose=\{\(\) => \(pending \? undefined : setOpen\(false\)\)\}/);
  assert.match(ROWS, /rootClassName="fixed inset-0 z-\[96\] flex items-end justify-center lg:items-center"/);
  assert.match(ROWS, /pb-\[max\(env\(safe-area-inset-bottom\),16px\)\]/, 'the buttons can sit under the home indicator');
  assert.match(ROWS, /data-finalize-sheet=""/);
  assert.doesNotMatch(ROWS, /@\/app\/_components\/sheet|<Sheet\b|createPortal|react-dom|terracotta|bg-ink\/|backdrop-blur/, 'the old sheet, a hand portal, terracotta or a wash is back');
});

test('(1b) Finalize is the OK-toned filled step, Not now is neutral — one filled step in the pop-up', () => {
  const go = ROWS.slice(ROWS.indexOf('label={pending ? \'Finalizing…\''), ROWS.indexOf('data-testid="setup-finalize-go"'));
  assert.ok(go.length > 20, 'the confirm button is gone');
  const before = ROWS.slice(ROWS.indexOf('label={pending ? \'Finalizing…\'') - 80, ROWS.indexOf('label={pending ? \'Finalizing…\''));
  assert.match(before, /tone="ok"\s+main/);
  assert.match(ROWS, /<ActionButton tone="neutral" icon=\{X\} label=\{FINALIZE_SHEET\.cancel\}/);
});

test('(2) a refused save, Finalize and Reopen are told in the page’s own sentence', () => {
  assert.match(ROWS, /refused = plainRefusal\(r\.error, 'Please try again\.'\)/);
  assert.doesNotMatch(ROWS, /refused = r\.error/);
  assert.match(ROWS, /setError\(plainRefusal\(res\.error, 'Couldn’t finalize the list\. Try again\.'\)\)/);
  assert.match(ROWS, /setError\(plainRefusal\(res\.error, 'Couldn’t reopen the list\. Try again\.'\)\)/);
  assert.doesNotMatch(ROWS, /setError\(res\.error\)/, 'a refusal is printed raw');
});

test('(2b) a refused Reply by date: the database’s words become a sentence, a plain one stays', async () => {
  const raw = keepInPlainWords(async () => ({ ok: false, error: 'It is back as it was. invalid input syntax for type date: "2027-02-30"' }));
  assert.deepEqual(await raw('2027-02-30'), { ok: false, error: 'The reply-by date did not save, so it is back as it was.' });
  const plain = keepInPlainWords(async () => ({ ok: false, error: 'It is back as it was. Please try again.' }));
  assert.deepEqual(await plain('2027-02-01'), { ok: false, error: 'It is back as it was. Please try again.' });
  const ok = keepInPlainWords(async () => ({ ok: true }));
  assert.deepEqual(await ok('2027-02-01'), { ok: true });
  const frames = stripComments(readFileSync(join(HERE, 'setup-frames.tsx'), 'utf8'));
  assert.match(frames, /onKeep=\{keepInPlainWords\(row\.keep\)\}/, 'Setup’s Reply by does not use the plain wrapper');
});

test('(3) the slots the page hands the screen are single children, not list members (the lab’s dev overlay: "Each child in a list should have a unique key")', () => {
  const screen = stripComments(readFileSync(join(HERE, '..', '..', 'guests', '_components', 'guests-screen.tsx'), 'utf8'));
  assert.match(screen, /function Handed\(\{ children \}: \{ children: ReactNode \}\) \{\s*return <>\{children\}<\/>;\s*\}/);
  assert.match(screen, /\{empty && !q \? <Handed>\{empty\}<\/Handed> : null\}/, 'the empty slot sits among the list’s children again');
  assert.match(screen, /\{gview === 'share' \? <Handed>\{setup\}<\/Handed> :/, 'the Setup slot sits among the screen’s children again');
});

test('(4) the lab’s Digital Pass picture is drawn inline — never the production address its CSP refuses', () => {
  const lab = readFileSync(join(HERE, '..', '..', '..', '..', 'dev', 'guests-lab', 'page.tsx'), 'utf8');
  assert.match(lab, /passSrc=\{LAB_PASS_SRC\}/);
  assert.match(lab, /const LAB_PASS_SRC =\s*'data:image\/svg\+xml;utf8,'/);
  assert.doesNotMatch(lab, /passSrc="https?:/, 'the lab asks the live site for the pass picture again (img-src refuses it)');
  /* The REAL Setup view hands a same-origin path, which the page's img-src allows. */
  const panel = readFileSync(join(HERE, '..', '..', 'guests', 'invite', '_components', 'invite-panel.tsx'), 'utf8');
  assert.match(panel, /passSrc=\{`\/api\/hub-print\/pass\?event=\$\{eventId\}&mode=screen&pass_guest=first`\}/, 'the real Setup view’s pass picture is no longer same-origin');
});
