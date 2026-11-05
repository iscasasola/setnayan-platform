/**
 * An Inspiration upload's refusal REACHES the supplier, and a phone photo is
 * shrunk before it travels.
 *
 * ── WHY (2026-11-05) ───────────────────────────────────────────────────────
 * `uploadStylistAsset` threw every refusal ("None of your shop's services…",
 * the back-catalogue quota, "Please confirm you hold the rights…", the screen's
 * reason). A production Next build REPLACES a thrown server-action message
 * with a generic one, so the supplier read "An error occurred…" for each — the
 * sentences existed only in dev. And the photo went up full-size inside the
 * action's request body, so a 10 MB phone photo failed before any gate ran.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';

const ACTIONS = stripComments(readFileSync('app/vendor-dashboard/moodboard-library/actions.ts', 'utf8'));
const EDITOR = stripComments(
  readFileSync('app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx', 'utf8'),
);

test('the exported action returns a result and cannot throw a refusal', () => {
  const start = ACTIONS.indexOf('export async function uploadStylistAsset(');
  assert.ok(start >= 0);
  const body = ACTIONS.slice(start, ACTIONS.indexOf('\n}\n', start));
  assert.match(body, /Promise<UploadStylistAssetResult>/);
  assert.match(body, /try \{\s*return \{ ok: true, \.\.\.\(await uploadStylistAssetOrThrow\(formData\)\) \};\s*\} catch \(err\) \{\s*return uploadRefusal\(err\);/);
  assert.doesNotMatch(body, /throw /, 'the exported action throws — its message is blanked in production');
});

test('the gates’ own sentences are passed through; only storage faults become a generic retry line', () => {
  assert.match(ACTIONS, /const UPLOAD_FAULT_PREFIXES = \['upload failed:', 'db insert failed:'\];/);
  // Every gate's message the supplier must read is still thrown by the inner function, so it is the one returned.
  const inner = ACTIONS.slice(ACTIONS.indexOf('async function uploadStylistAssetOrThrow('));
  for (const gate of [
    /throw new Error\(\s*'Please confirm you hold the rights to publish this photo before uploading\.',?\s*\)/,
    /if \(!slot\.allowed\) throw new Error\(slot\.message\);/,
    /if \(!quota\.allowed\) throw new Error\(quota\.message\);/,
  ]) {
    assert.match(inner, gate);
  }
});

test('the editor shows the returned refusal, and compresses the photo before it is sent', () => {
  assert.match(EDITOR, /import \{ compressImageForWeb \} from '@\/lib\/image-compress';/);
  const compress = EDITOR.indexOf("formData.set('file', await compressImageForWeb(picked), picked.name);");
  const send = EDITOR.indexOf('const answer = await uploadStylistAsset(formData);');
  assert.ok(compress > 0 && send > compress, 'the photo is sent before it is compressed');
  assert.match(EDITOR, /if \(!answer\.ok\) \{\s*setActionError\(answer\.error\);\s*return;\s*\}/);
});
