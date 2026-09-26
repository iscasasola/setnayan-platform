/**
 * maker-pro-controls-wear-the-paid-mark.test.ts — no Maker Pro control draws
 * its own "Pro" pill or its own lock.
 *
 * Owner, verbatim (2026-09-25): *"for all parts that are Paid to unlock, let us
 * use the padlock icon. and a diamond icon when unlocked"*. The one mark is
 * `<PaidMark>` (`app/_components/paid-mark.tsx`); before it, the Maker had a
 * bare "Pro" word on the reveal rows, a gold Sparkles "PRO" chip on the
 * editorial desk, a terracotta "Pro" pill on the widgets list, and four
 * hand-sized lucide locks — six spellings of one fact, none of which could
 * show the OWNED state at all.
 *
 * Three checks over the Event Hub Maker's files (comments stripped first, so a
 * docblock ABOUT a pill is not a pill):
 *
 *   1. NO BARE "Pro" PILL — a JSX text node that is exactly `Pro` / `PRO`.
 *      The word may still appear, but only as `<PaidMark text="Pro" />`.
 *   2. NO HAND-DRAWN PRO LOCK — a `<Lock` element within a few lines of the
 *      word Pro. (A lock beside something that is NOT paid — a fixed scene, a
 *      section with no content yet — is a different meaning and stays.)
 *   3. EVERY PRO CONTROL WEARS THE MARK — a component file that reads the
 *      couple's `ownsPro` renders `<PaidMark`. A new Pro control that forgets
 *      the mark fails here, by name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVENT = 'app/dashboard/[eventId]';

/** The Maker, and the editors it opens. Folders are walked; files are single. */
const SCOPE_DIRS = [
  `${EVENT}/launch/_components`,
  `${EVENT}/website/editor/_components`,
  `${EVENT}/website/_components`,
  `${EVENT}/story/_components`,
];
const SCOPE_FILES = [`${EVENT}/website/widgets/page.tsx`, `${EVENT}/guests/invite/_components/invite-theme-picker.tsx`];

function walk(rel: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(WEB, rel))) {
    const r = `${rel}/${name}`;
    if (statSync(join(WEB, r)).isDirectory()) out.push(...walk(r));
    else if (r.endsWith('.tsx') && !r.includes('.test.')) out.push(r);
  }
  return out;
}

const FILES = [...SCOPE_DIRS.flatMap(walk), ...SCOPE_FILES];
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A JSX text node that is only the word Pro — `>Pro<`, or `Pro` alone on its line. */
function bareProPills(src: string): string[] {
  const hits: string[] = [];
  for (const m of src.matchAll(/>[ \t]*(Pro|PRO)[ \t]*</g)) hits.push(m[0].trim());
  for (const m of src.matchAll(/^\s*(Pro|PRO)\s*$/gm)) hits.push(m[0].trim());
  return hits;
}

/** A `<Lock` element with the word Pro within `span` lines either side. */
function proLocks(src: string, span = 4): number[] {
  const lines = src.split('\n');
  const out: number[] = [];
  lines.forEach((line, i) => {
    if (!/<Lock\b/.test(line)) return;
    const window = lines.slice(Math.max(0, i - span), i + span + 1).join('\n');
    if (/\b(Pro|PRO)\b/.test(window)) out.push(i + 1);
  });
  return out;
}

test('the scope is real — the Maker files are found', () => {
  console.log(`[paid-mark] scope files=${FILES.length}`);
  assert.ok(FILES.length > 20, `only ${FILES.length} files — has the Maker moved?`);
  for (const must of [
    `${EVENT}/launch/_components/maker-reveal.tsx`,
    `${EVENT}/website/editor/_components/pro-panels.tsx`,
  ]) {
    assert.ok(FILES.includes(must), `${must} is not in scope`);
  }
});

test('no Maker Pro control renders a bare "Pro" pill', () => {
  const offenders = FILES.flatMap((f) => bareProPills(code(f)).map((h) => `${f}: ${h}`));
  console.log(`[paid-mark] bare Pro pills=${offenders.length}`);
  assert.deepEqual(offenders, [], 'use <PaidMark text="Pro" /> — the word never stands alone');
});

test('no Maker Pro control draws its own lock', () => {
  const offenders = FILES.flatMap((f) => proLocks(code(f)).map((l) => `${f}:${l}`));
  console.log(`[paid-mark] hand-drawn Pro locks=${offenders.length}`);
  assert.deepEqual(offenders, [], 'a paid lock is <PaidMark state="locked" />, not a lucide <Lock>');
});

test('every Maker component that reads ownsPro renders the PaidMark', () => {
  const readers = FILES.filter((f) => !f.endsWith('/page.tsx') && /\bownsPro\b/.test(code(f)));
  const missing = readers.filter((f) => !/<PaidMark\b/.test(code(f)));
  console.log(`[paid-mark] ownsPro readers=${readers.length} missing the mark=${missing.length}`);
  assert.ok(readers.length >= 5, `only ${readers.length} readers — did ownsPro get renamed?`);
  assert.deepEqual(missing, []);
});

test('the detectors catch what they are for (sabotage, in memory)', () => {
  assert.deepEqual(bareProPills('<span className="x">Pro</span>'), ['>Pro<']);
  assert.deepEqual(bareProPills('<span>\n  PRO\n</span>'), ['PRO']);
  assert.deepEqual(bareProPills('<PaidMark state="locked" label="x" text="Pro" />'), []);
  assert.deepEqual(proLocks('<p>\n<Lock aria-hidden />\nPart of Event Hub Pro\n</p>'), [2]);
  assert.deepEqual(proLocks('<p>\n<Lock aria-hidden />\nThis scene is fixed\n</p>'), []);
});
