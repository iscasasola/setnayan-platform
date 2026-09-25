/**
 * COMPRESS FIRST, THEN CHECK (DECISION_LOG 2026-09-25). `<FileUpload>` used to
 * check `file.size > maxBytes` on the RAW file before any compression ran —
 * so a phone photo/clip that would have shrunk well under the cap was
 * rejected on a number nobody was ever going to upload.
 *
 * `FileUpload` is a browser component (XHR, drag/drop, canvas) with no
 * `.test.tsx` counterpart anywhere in this repo (`find app lib -iname
 * "*.test.tsx"` is empty) — every existing test here exercises component
 * logic by scanning the compiled source for the invariant, the same approach
 * `lib/vendor-captures-compress.test.ts` and its siblings use. This one pins
 * both halves of the reorder so a future edit can't silently put the check
 * back in front of compression.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SRC_PATH = join(import.meta.dirname, 'file-upload.tsx');
const raw = readFileSync(SRC_PATH, 'utf8');
const code = stripComments(raw);

test('the raw-size gate in handleFiles is skipped for a file this instance will compress', () => {
  assert.match(
    code,
    /const willCompress =\s*\(compressImage && isImage\(file\.type\)\) \|\|\s*\(compressVideo && isVideo\(file\.type\)\);/,
  );
  assert.match(code, /if \(!willCompress && file\.size > maxBytes\) \{/);
});

test('uploadOne re-checks maxBytes AFTER both compression steps, against the file that will actually upload', () => {
  // The step markers are comment TEXT — search the RAW source (comments still
  // in), not the comment-stripped `code` this file otherwise uses for
  // pattern matches.
  const imageStep = raw.indexOf('Step 0a: compress image');
  const videoStep = raw.indexOf('Step 0b: compress video');
  assert.ok(imageStep > -1 && videoStep > imageStep, 'image compression must run before video compression');

  // Everything past here is real code, so it is found in the stripped `code`.
  const compressVideoCall = code.indexOf('compressVideoForWeb(file');
  const postCheck = code.indexOf('if (file.size > maxBytes) {', compressVideoCall);
  const presignFetch = code.indexOf("fetch('/api/upload'");
  assert.ok(compressVideoCall > -1, 'the video compression call must exist');
  assert.ok(postCheck > compressVideoCall, 'the post-compression size check must come after BOTH compression steps');
  assert.ok(postCheck < presignFetch, 'the check must run before the network round-trip (presign)');
});

test('a file that could not be compressed under the cap is still refused, with an honest sentence', () => {
  assert.match(code, /even after compression — max \$\{maxSizeMB\} MB/);
});

test('a Maker video profile and silent flag are threaded through to compressVideoForWeb', () => {
  assert.match(code, /videoCompressProfile\?:\s*'quality'\s*\|\s*'maker'/);
  assert.match(code, /videoSilent\?:\s*boolean/);
  assert.match(
    code,
    /file = await compressVideoForWeb\(file, \{\s*maxDurationS: maxVideoDurationS,\s*profile: videoCompressProfile,\s*silent: videoSilent,/,
  );
});
