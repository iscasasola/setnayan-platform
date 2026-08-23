/**
 * THE TWO MAKER EPILOGUE FIXES, GUARDED AT THE WIRING.
 *
 * (1) THE CLIP PILL SAYS THE LENGTH — and the measurement has a path to it.
 * (2) SAVING "WHO IT'S FOR" DOES NOT NAVIGATE — and a refusal is visible.
 *
 * `formatClipDuration` is proved by its own unit tests. What those cannot see is
 * whether anything CALLS it, or whether the picker still hands the number over.
 * The defect this closes is not a wrong number; it is a placeholder standing in
 * for a fact the browser already had — so the regression to guard against is the
 * WIRING quietly coming apart while every pure test stays green.
 *
 * Source-scanned, because the alternative is a DOM harness for a `<video>`
 * metadata probe, which this repo has none of. Every assertion below has been
 * mutation-checked by occurrence count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CANVAS = join(ROOT, 'app/vendor-dashboard/services/_components/canvas-maker.tsx');
const PICKER = join(ROOT, 'app/vendor-dashboard/services/_components/showcase-media-fields.tsx');

/** Strip comments — a note ABOUT the old placeholder must not read as the bug. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('the card face renders the MEASURED length, not the placeholder word', () => {
  const raw = stripComments(readFileSync(CANVAS, 'utf8'));
  assert.equal(
    [...raw.matchAll(/▶ \{clipPillLabel\(clipSeconds\)\}/g)].length,
    1,
    'the visible pill must render the measured length through clipPillLabel',
  );
  // The old hardcoded pill is the defect itself. `clipPillLabel` still returns
  // the word 'clip' when the duration is unreadable — that fallback belongs in
  // the helper, where it is tested, and nowhere else.
  assert.doesNotMatch(
    raw,
    /▶ clip\b/,
    'a hardcoded "▶ clip" is the placeholder this fix removed',
  );
  // The screen-reader line must not disagree with what is on screen.
  assert.equal(
    [...raw.matchAll(/clipPillLabel\(clipSeconds\)/g)].length,
    2,
    'the visible pill AND its sr-only twin both speak the measured length',
  );
});

test('the picker actually hands the measurement over', () => {
  const canvas = stripComments(readFileSync(CANVAS, 'utf8'));
  assert.equal(
    [...canvas.matchAll(/onClipDurationSeconds=\{onClipDurationSeconds\}/g)].length,
    1,
    'the canvas must pass the reporter to ShowcaseMediaFields, or the pill can never learn a number',
  );

  const picker = stripComments(readFileSync(PICKER, 'utf8'));
  // CLEAR-THEN-PROBE. Without the leading report(null) a replacement clip whose
  // duration cannot be read inherits the PREVIOUS file's number — a fabricated
  // fact about a different video, and green in every pure test.
  assert.match(
    picker,
    /report\?\.\(null\);\s*const d = await readVideoDurationSeconds\(file\);\s*report\?\.\(d\);/,
    'the validator must clear the reported duration BEFORE probing the new file',
  );
  // The duration must not become a form field: the canvas's input-name set is
  // pinned against the wizard's, and the server has no use for the number.
  assert.doesNotMatch(
    picker,
    /name="showcase_video_duration/,
    'the measurement is a callback, not a wire field',
  );
});

test('saving "who it’s for" reports its outcome instead of navigating away', () => {
  const raw = stripComments(readFileSync(CANVAS, 'utf8'));

  // A refusal must be VISIBLE. The redirecting action showed one by putting
  // `?error=` on the URL it landed on; this form lands nowhere, so a refusal
  // that is not rendered here is a refusal nobody ever sees — indistinguishable
  // from a save that worked.
  assert.equal(
    [...raw.matchAll(/\{audienceState\.message\}/g)].length,
    1,
    'the audience sheet must render the action’s refusal message',
  );
  assert.match(raw, /role="alert"/, 'the refusal must be announced, not just drawn');

  // "Saved" is a claim about a SELECTION. The sheet stays open, so the note has
  // to be bound to what was stored — otherwise it sits there confirming an
  // answer the vendor has since changed.
  assert.match(
    raw,
    /audienceState\.savedKey === coverageServesKey\(coverageId, events, faiths\)/,
    'the Saved note must be bound to the stored selection, not to a bare ok flag',
  );
  assert.doesNotMatch(
    raw,
    /audienceSaved =\s*audienceState\.ok;/,
    'a bare ok flag leaves "Saved" standing under a selection nobody saved',
  );

  // The copy that promised a redirect is the copy the redirect justified.
  assert.doesNotMatch(
    raw,
    /returns you to Services/,
    'the sheet must stop warning about a navigation that no longer happens',
  );
});
