/**
 * the-uploader-tells-after-the-set.test.ts — THE APP'S UPLOADER TELLS ITS PARENT AFTER THE SET, NEVER INSIDE IT.
 *
 * The Maker walk, 2026-10-12 (F2): a picture uploaded on the RSVP stage printed React's
 * "Cannot update a component (`StageTools`) while rendering a different component (`FileUpload`)". Cause, in
 * `app/_components/file-upload.tsx`: a landing called `emitChange(next)` — the parent's `onChange` — from INSIDE its
 * `setItems((prev) => …)` updater. React runs an updater while it RENDERS the component, so whatever the parent
 * set in `onChange` (the RSVP stage asks for one edit of its list; the toolbar picks the new line) was set during
 * FileUpload's render; and React's development double-run of an updater told the parent TWICE (measured in the lab:
 * one upload, two picture lines — #6483 then guarded by hand with `handed`). `removeItem` did the same.
 *
 * NOW: an updater only RECORDS what to say (`toSay.current = next`), and ONE effect, after the commit, says it once.
 *
 * There is no DOM in this runner, so the component is read, not mounted (the browser walk saw the warning go —
 * controller-2026-10-12/maker-polish). Pinned:
 *   (1) no `setItems` updater calls the parent (`emitChange` / `onChange`) — every updater is pure of it;
 *   (2) the parent is told in exactly ONE place: the effect that reads `toSay`, clears it, then says it, on
 *       `[items, emitChange]`;
 *   (3) both value changes — a landing and ✕ on a kept file — record what to say inside their updater.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const UP = stripComments(readFileSync(join(__dirname, '..', 'app/_components/file-upload.tsx'), 'utf8'));

/** The text of every `setItems( … )` call, its parentheses balanced. */
function setItemsCalls(src: string): string[] {
  const out: string[] = [];
  let at = src.indexOf('setItems(');
  while (at >= 0) {
    let depth = 0;
    let i = at + 'setItems'.length;
    for (; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push(src.slice(at, i + 1));
    at = src.indexOf('setItems(', i);
  }
  return out;
}

test('(1) no setItems updater tells the parent — React runs updaters while rendering', () => {
  const calls = setItemsCalls(UP);
  assert.ok(calls.length >= 3, `anti-vacuity: expected the seed, the landing and ✕ — found ${calls.length} setItems calls`);
  for (const call of calls) {
    assert.doesNotMatch(call, /emitChange\(|onChange\(|onChange\?\.\(/, `an updater tells the parent again:\n${call.slice(0, 300)}`);
  }
});

test('(2) the parent is told in ONE place: after the commit, once, from what an updater recorded', () => {
  assert.equal((UP.match(/emitChange\(/g) ?? []).length, 1, 'emitChange is called from more than one place again');
  assert.match(
    UP,
    /const toSay = useRef<UploadedItem\[\] \| null>\(null\);\s*useEffect\(\(\) => \{\s*const next = toSay\.current;\s*if \(!next\) return;\s*toSay\.current = null;\s*emitChange\(next\);\s*\}, \[items, emitChange\]\);/,
    'the after-the-set effect is gone or changed shape',
  );
  /* The effect is declared after `emitChange` (it closes over it) — and `onChange` itself is called only inside it. */
  assert.ok(UP.indexOf('const emitChange = useCallback(') < UP.indexOf('const toSay = useRef'), 'the effect no longer follows emitChange');
  assert.equal((UP.match(/\bonChange\(/g) ?? []).length, 2, 'onChange is called somewhere other than emitChange\'s two branches');
});

test('(3) a landing and ✕ on a kept file each record what to say inside their updater', () => {
  const recording = setItemsCalls(UP).filter((c) => /toSay\.current = next;/.test(c));
  assert.equal(recording.length, 2, 'the landing and ✕ no longer both record what to say');
  assert.ok(recording.some((c) => /multiple \? \[\.\.\.prev, completed\] : \[completed\]/.test(c)), 'the landing no longer records');
  assert.ok(recording.some((c) => /prev\.filter\(\(i\) => i\.id !== id\)/.test(c)), '✕ on a kept file no longer records');
  assert.equal((UP.match(/toSay\.current = next;/g) ?? []).length, 2, 'something else records what to say');
});
