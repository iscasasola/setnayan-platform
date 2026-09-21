/**
 * lib/only-remove-upload-deletes-the-upload.test.ts
 *
 * ONE RULE: the couple's uploaded logo (`events.monogram_uploaded_svg`) is
 * deleted by exactly one thing — the explicit "Remove upload" action. Nothing
 * else may write it to null.
 *
 * WHY. Owner, asked whether to keep the original uploaded file once a couple
 * composes from it in the studio: *"yes keep it."* The upload flow never kept
 * the source PHOTO — only this traced SVG — so a deleted upload is gone for good.
 *
 * It was being deleted anyway. `saveStudioAction` set `monogram_uploaded_svg:
 * null` on every studio save, for a reason that was true until 2026-09-20: every
 * surface resolved `uploaded ?? custom`, so a leftover upload would have hidden
 * the new design. That day the precedence flipped to `custom ?? uploaded` AND
 * the studio learned to open ON the uploaded logo — so "open your logo, add a
 * frame, save" erased the original. Caught by reading the action while building
 * something else; exactly one event in production had an upload at risk (the
 * owner's own), and it was still intact.
 *
 * A source scan: it proves what the code writes, not what any row holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
/* Comments are stripped so prose that NAMES the write — like this rule's own
 * explanation in studio-actions.ts — is not mistaken for the write. */
import { stripComments as code } from './strip-comments';

/** The one place allowed to delete it, and the function that must do it. */
const ALLOWED = { file: 'app/dashboard/[eventId]/monogram/upload-actions.ts', fn: 'clearUploadedMarkAction' };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const NULLS = /monogram_uploaded_svg\s*:\s*null/g;

test('only "Remove upload" writes monogram_uploaded_svg to null', () => {
  const files = ['app', 'lib'].flatMap((r) => walk(r));
  const offenders: string[] = [];
  let allowedHits = 0;
  for (const f of files) {
    const src = code(readFileSync(f, 'utf8'));
    const hits = src.match(NULLS)?.length ?? 0;
    if (!hits) continue;
    if (f === ALLOWED.file) {
      allowedHits += hits;
      continue;
    }
    offenders.push(`${f} (${hits})`);
  }
  assert.ok(files.length > 300, `scanned only ${files.length} files — the walk is broken, not the code`);
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} file(s) delete the couple's uploaded logo outside "Remove upload":\n  ` +
      offenders.join('\n  ') +
      '\n→ the original photo was never kept; a deleted upload is gone for good.',
  );
  /* The floor: "Remove upload" itself must still exist and still delete. If it
   * were renamed or removed, the loop above would pass by finding nothing. */
  assert.equal(allowedHits, 1, `expected exactly one delete, in ${ALLOWED.fn}; found ${allowedHits}`);
});

test('and that one delete really is inside clearUploadedMarkAction', () => {
  const src = code(readFileSync(ALLOWED.file, 'utf8'));
  const start = src.indexOf(`export async function ${ALLOWED.fn}(`);
  assert.ok(start >= 0, `${ALLOWED.fn} is missing from ${ALLOWED.file}`);
  // Slice to the NEXT export, so the window cannot reach into another function.
  const next = src.indexOf('export async function', start + 1);
  const body = src.slice(start, next === -1 ? undefined : next);
  assert.match(body, NULLS, 'the delete must live in the explicit remove action, not beside it');
});
