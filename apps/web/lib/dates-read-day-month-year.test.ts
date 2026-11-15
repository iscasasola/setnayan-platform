/**
 * 📅 A SHORT DATE READS DAY FIRST — "14 Nov 2026", never "Nov 14, 2026".
 *
 * Seen live (14 Nov 2026): the couple's proposal page said "Accepted on Nov 14, 2026" — the US order, on a
 * product whose whole market writes the day first. The day-first formatter already existed:
 * `formatRecordedAt` (lib/recorded-at.ts), pinned to Asia/Manila, which prints "14 Nov 2026" for a bare DATE
 * key and lands a timestamp on the Manila day it happened. Screens had rolled their own instead —
 * `toLocaleDateString('en-US', { month: 'short', day, year })`, an `Intl.DateTimeFormat('en-US', …)` with the
 * same options, or a bare `toLocaleDateString()` whose order is decided by whichever machine renders it.
 *
 * This guard walks app/ (minus app/dev and tests) and fails on:
 *   · an `en-US` short month WITH a year — the "Nov 14, 2026" shape;
 *   · `toLocaleDateString()` / `toLocaleDateString(undefined, …)` — the machine picks the order;
 *   · a date-fns style "MMM d, yyyy" / "MMMM d, yyyy" pattern.
 *
 * It does NOT fire on the owner-ruled long form ("December 18, 2026", lib/format-date.ts, owner 2026-09-08),
 * on a weekday alone, or on number formatting (`toLocaleString('en-US')` for a count is fine).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { formatRecordedAt } from '@/lib/recorded-at';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');

/**
 * Explicit, per-file exceptions. Each needs a reason a reviewer can check. Empty today — keep it small.
 * key: repo-relative path from apps/web · value: why the US short date is right there.
 */
const ALLOW: Record<string, string> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (rel === 'app/dev') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

/** The text of the options object that follows a call's opening paren, up to its first closing brace. */
function optionsAfter(src: string, from: number): string {
  const slice = src.slice(from, from + 400);
  const close = slice.indexOf('}');
  const paren = slice.indexOf(')');
  if (close === -1 || (paren !== -1 && paren < slice.indexOf('{'))) return '';
  return slice.slice(0, close + 1);
}

function usShortDates(source: string): string[] {
  const src = stripComments(source);
  const hits: string[] = [];
  const lineOf = (i: number) => src.slice(0, i).split('\n').length;

  for (const m of src.matchAll(/(?:toLocaleDateString|toLocaleString|new\s+Intl\.DateTimeFormat)\(\s*(['"])en-US\1/g)) {
    const opts = optionsAfter(src, m.index! + m[0].length);
    if (/month:\s*['"]short['"]/.test(opts) && /\byear:/.test(opts) && /\bday:/.test(opts)) {
      hits.push(`line ${lineOf(m.index!)}: en-US short month with a year — "Nov 14, 2026"`);
    }
  }
  for (const m of src.matchAll(/toLocaleDateString\(\s*(?:\)|undefined\b)/g)) {
    hits.push(`line ${lineOf(m.index!)}: toLocaleDateString with no locale — the machine picks the order`);
  }
  for (const m of src.matchAll(/(['"`])MMMM? d,? y{2,4}\1/g)) {
    hits.push(`line ${lineOf(m.index!)}: ${m[0]} — month-first date pattern`);
  }
  return hits;
}

test('the house formatter prints day first, in Manila', () => {
  assert.equal(formatRecordedAt('2026-11-14'), '14 Nov 2026');
  // A timestamp after 16:00 UTC is already the next day in Manila.
  assert.equal(formatRecordedAt('2026-11-14T17:00:00Z'), '15 Nov 2026');
  // en-GB's CLDR month is "Sept" on current ICU; the app writes three letters.
  assert.equal(formatRecordedAt('2026-09-14'), '14 Sep 2026');
});

test('the detector catches each US shape (so a green run below means something)', () => {
  assert.equal(usShortDates("d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })").length, 1);
  assert.equal(usShortDates("new Intl.DateTimeFormat('en-US', {\n  month: 'short',\n  day: 'numeric',\n  year: 'numeric',\n})").length, 1);
  assert.equal(usShortDates('d.toLocaleDateString()').length, 1);
  assert.equal(usShortDates("d.toLocaleDateString(undefined, { month: 'long' })").length, 1);
  assert.equal(usShortDates("format(d, 'MMM d, yyyy')").length, 1);
  // Not dates in US order: a weekday alone, a count, the owner's long form.
  assert.equal(usShortDates("d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })").length, 0);
  assert.equal(usShortDates("n.toLocaleString('en-US')").length, 0);
  assert.equal(usShortDates("// d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })").length, 0);
});

test('no user-facing screen prints a short date month first', () => {
  const files = walk(APP);
  assert.ok(files.length > 500, `walked only ${files.length} files — the walker is broken`);
  const bad: string[] = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    if (rel in ALLOW) continue;
    for (const h of usShortDates(readFileSync(f, 'utf8'))) bad.push(`${rel} ${h}`);
  }
  assert.deepEqual(bad, [], 'route the date through formatRecordedAt (lib/recorded-at.ts) — "14 Nov 2026"');
});

test('every allowlist entry still names a real file that still needs it', () => {
  for (const [rel, why] of Object.entries(ALLOW)) {
    assert.ok(why.trim().length > 10, `${rel} has no reason`);
    assert.ok(usShortDates(readFileSync(path.join(ROOT, rel), 'utf8')).length > 0, `${rel} no longer needs its exception`);
  }
});

test('the proposal page says "Accepted on 14 Nov 2026"', () => {
  const page = stripComments(readFileSync(path.join(APP, 'proposals/[publicId]/page.tsx'), 'utf8'));
  const fn = page.slice(page.indexOf('function fmtDate('), page.indexOf('function fmtDate(') + 400);
  assert.match(fn, /formatRecordedAt\(iso\)/, 'the proposal page no longer uses the day-first formatter');
  assert.match(page, /\{PROPOSAL_STATUS_LABEL\[proposal\.status\]\} on \{fmtDate\(proposal\.resolved_at\)\}/);
});
