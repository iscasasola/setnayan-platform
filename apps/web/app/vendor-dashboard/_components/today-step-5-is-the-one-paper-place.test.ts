/**
 * today-step-5-is-the-one-paper-place.test.ts — 🧾 TODAY'S STEP 5 IS THE ONE UPLOAD PLACE, NEVER THREE ADD ROWS.
 *
 * Owner 2026-11-14 (DECISION_LOG "supplier papers demo approved"): one upload button, the app reads each paper and
 * ticks it Reading… → Recognised. #7624 shipped it on Your details › Get verified (`docs-body.tsx`), and on 15 Nov the
 * owner found Today's step 5 still drawing three rows (DTI/SEC · BIR 2303 · Business Permit), each with its own Add —
 * a second, older drawing of the same three papers. This holds the fix:
 *
 *   1 · step 5 mounts `SetupPaperPlace`, which renders the shipped `PaperUploadPlace` — and never `SetupPapers`;
 *   2 · the retired three-row component stays gone (no file, no import anywhere in app/ or lib/);
 *   3 · the Get verified fold's "Go to your papers" lands on the place (its id) and presses at 44+ (`sn-hit`).
 *
 * 🛡 SABOTAGE (seen RED, then restored, 2026-11-15): `<SetupPaperPlace` → `<SetupPapers` in supplier-setup-screen.tsx
 * (red: 1) · `sn-hit` dropped from the link (red: 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · Today’s step 5 renders PaperUploadPlace (through SetupPaperPlace) — never SetupPapers', () => {
  const screen = code('app/vendor-dashboard/_components/supplier-setup-screen.tsx');
  const docs = screen.slice(screen.indexOf('docs: ('), screen.indexOf('qr: ('));
  assert.ok(docs.length > 0, 'step 5’s body was not found');
  assert.match(docs, /<SetupPaperPlace\b/, 'step 5 does not mount the one paper place');
  assert.doesNotMatch(docs, /<SetupPapers\b/, 'step 5 draws the three Add rows again');
  const place = code('app/vendor-dashboard/_components/setup-paper-place.tsx');
  assert.match(place, /<PaperUploadPlace\b/, 'the step-5 place no longer renders the shipped PaperUploadPlace');
});

test('2 · the three-row SetupPapers is retired — no file, no import, no render anywhere', () => {
  assert.ok(!existsSync(join(WEB, 'app/vendor-dashboard/_components/setup-papers.tsx')), 'setup-papers.tsx is back');
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  assert.ok(files.length > 500, `only ${files.length} source files were read — the walk broke`);
  const users = files.filter((f) => /\bSetupPapers\b/.test(stripComments(readFileSync(f, 'utf8'))));
  assert.deepEqual(users, [], 'SetupPapers is used again');
});

test('3 · "Go to your papers" lands on the place and presses at 44+', () => {
  const screen = code('app/vendor-dashboard/_components/supplier-setup-screen.tsx');
  const id = screen.match(/const SETUP_PAPERS_ID = '([a-z-]+)';/)?.[1];
  assert.ok(id, 'the place lost its id');
  assert.match(screen, /<div id=\{SETUP_PAPERS_ID\}[^>]*>\s*<SetupPaperPlace\b/, 'the id is not on the one paper place');
  assert.match(screen, /papersAbove=\{SETUP_PAPERS_ID\}/, 'Get verified no longer points at the place');
  const verify = code('app/vendor-dashboard/shop/_components/verify-section.tsx');
  const link = verify.match(/<a href=\{`#\$\{papersAbove\}`\}[^>]*>/)?.[0] ?? '';
  assert.ok(link, '"Go to your papers" is gone');
  assert.match(link, /\bsn-hit\b/, '"Go to your papers" presses under 44 again');
});
