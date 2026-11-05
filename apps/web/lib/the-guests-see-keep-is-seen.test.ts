/**
 * the-guests-see-keep-is-seen.test.ts — "WHAT GUESTS SEE": a Keep that worked LOOKS like it worked.
 *
 * Owner, 2026-10-21, on the sheet: *"after I pressed apply. it just greyed out?"* It had worked — the ticks were in the
 * draft — but the only sign was a small line and a button gone grey (it had nothing left to save), which reads as
 * "nothing happened". And the button said "Apply", the word of the Maker's own ✓, which is what publishes.
 *
 *   1. what a save's answer means: kept → the "Kept" line and a close after `GUESTS_SEE_KEPT_MS`; refused or thrown →
 *      NOT kept, the reason (or "could not be kept") and no close;
 *   2. the main button: kept → "Kept" in the confirm tone and pressable (never greyed); ticks waiting → "Keep · N
 *      changes"; nothing waiting → waiting. It never says the ✓'s word, "Apply";
 *   3. the close is scheduled ONLY once kept, after `GUESTS_SEE_KEPT_MS`, and the cleanup cancels it;
 *   4. the sheet is wired to those three: a refusal returns before the Kept state, nothing but the Kept state closes
 *      it after a save, and the button draws `guestsSeeMainButton`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  GUESTS_SEE_KEPT_MS,
  GUESTS_SEE_WORDS as W,
  guestsSeeCloseWhenKept,
  guestsSeeKeepOutcome,
  guestsSeeMainButton,
} from './guests-see-table';

const SHEET = 'app/dashboard/[eventId]/launch/_components/guests-see-sheet.tsx';
const src = stripComments(readFileSync(join(__dirname, '..', SHEET), 'utf8'));

test('1 · a kept save says Kept and closes; a refused or failed one stays open with its reason', () => {
  assert.deepEqual(guestsSeeKeepOutcome({ ok: true }), { kept: true, line: W.kept, closeAfterMs: GUESTS_SEE_KEPT_MS });
  assert.ok(GUESTS_SEE_KEPT_MS >= 800 && GUESTS_SEE_KEPT_MS <= 2000, `"✓ Kept" must be readable and brief, not ${GUESTS_SEE_KEPT_MS} ms`);
  for (const [answer, line] of [
    [{ ok: false, error: 'That stage is locked.' }, 'That stage is locked.'],
    [{ ok: false }, W.notKept],
    [{ ok: false, error: '' }, W.notKept],
    ['threw', W.notKept],
    [null, W.notKept],
  ] as const) {
    const out = guestsSeeKeepOutcome(answer);
    assert.equal(out.kept, false, `${JSON.stringify(answer)} was taken as kept`);
    assert.equal(out.line, line);
    assert.ok(!('closeAfterMs' in out), `${JSON.stringify(answer)} would close the sheet`);
  }
});

test('2 · the button: "Kept" in the confirm tone and pressable · "Keep · N changes" · never the ✓’s word', () => {
  const kept = guestsSeeMainButton(0, true, false);
  assert.deepEqual(kept, { label: W.keptButton, tone: 'ok', waiting: false, kept: true });
  assert.equal(W.keptButton, 'Kept');
  assert.deepEqual(guestsSeeMainButton(3, false, false), { label: 'Keep · 3 changes', tone: 'brand', waiting: false, kept: false });
  assert.equal(guestsSeeMainButton(1, false, false).label, 'Keep · 1 change');
  assert.equal(guestsSeeMainButton(3, false, true).waiting, true, 'pressable while its save is on its way');
  assert.deepEqual(guestsSeeMainButton(0, false, false), { label: W.keep, tone: 'brand', waiting: true, kept: false });
  for (const [n, k, s] of [[0, false, false], [2, false, false], [2, false, true], [0, true, false]] as const) {
    assert.doesNotMatch(guestsSeeMainButton(n, k, s).label, /apply/i, 'the sheet’s button says the word of the Maker’s ✓');
  }
  assert.doesNotMatch(W.leaveTitle, /apply/i);
  assert.match(W.publishLine, /publish with ✓/);
});

test('3 · the close is scheduled only once kept, after GUESTS_SEE_KEPT_MS, and the cleanup cancels it', () => {
  const fake = () => {
    const set: Array<{ fn: () => void; ms: number }> = [];
    const cleared: unknown[] = [];
    return { set, cleared, timer: { set: (fn: () => void, ms: number) => (set.push({ fn, ms }), set.length), clear: (id: unknown) => void cleared.push(id) } };
  };
  let closed = 0;
  const close = () => void (closed += 1);

  const idle = fake();
  guestsSeeCloseWhenKept(false, close, idle.timer)();
  assert.equal(idle.set.length, 0, 'a close was scheduled with nothing kept');
  assert.equal(closed, 0);

  const done = fake();
  const cancel = guestsSeeCloseWhenKept(true, close, done.timer);
  assert.equal(done.set.length, 1);
  assert.equal(done.set[0]!.ms, GUESTS_SEE_KEPT_MS);
  assert.equal(closed, 0, 'closed at once — "✓ Kept" was never seen');
  done.set[0]!.fn();
  assert.equal(closed, 1);
  cancel();
  assert.deepEqual(done.cleared, [1], 'the cleanup does not cancel the close');
});

test('4 · the sheet is wired: a refusal returns before Kept; only Kept closes it; the button draws guestsSeeMainButton', () => {
  assert.match(src, /useEffect\(\(\) => guestsSeeCloseWhenKept\(kept, \(\) => closeRef\.current\(\)\), \[kept\]\);/, 'the Kept state does not close the sheet');
  assert.match(src, /const main = guestsSeeMainButton\(n, kept, pending\);/);
  assert.match(src, /<ActionButton tone=\{main\.tone\} icon=\{Check\} label=\{main\.label\} main waiting=\{main\.waiting\} onClick=\{keep\}/);

  // The save's answer → the outcome → a refusal returns → only then the Kept state.
  const save = src.slice(src.indexOf('const keep = () => {'), src.indexOf('return (', src.indexOf('const keep = () => {')));
  assert.ok(save.length > 200, 'anti-vacuity: the keep handler was not found');
  const at = (needle: string) => save.indexOf(needle);
  const out = at('const out = guestsSeeKeepOutcome(r);');
  const refused = at('if (!out.kept) return;');
  const keptAt = at('setKept(true);');
  assert.ok(out > 0 && refused > out && keptAt > refused, 'a refused Keep reaches the Kept state');
  assert.equal((src.match(/setKept\(true\)/g) ?? []).length, 1, 'the Kept state is set somewhere else too');
  const caught = save.slice(save.indexOf('} catch'));
  assert.match(caught, /setLine\(guestsSeeKeepOutcome\('threw'\)\.line\)/);
  assert.doesNotMatch(caught, /setKept\(true\)|onClose|closeRef/, 'a failed Keep closes the sheet');
  // No save path calls the close itself: only the Kept state's effect does.
  assert.doesNotMatch(save.slice(at('start(async')), /onClose\(|closeRef\.current\(\)/, 'the save closes the sheet directly');
});
