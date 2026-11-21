/**
 * a-failed-tool-read-is-never-clean.test.ts — 🧰 A SUPPLIER TOOL PAGE NEVER STATES A RESULT IT DID NOT MEASURE.
 *
 * Controller, 21 Nov 2026, approving the tool pages redraw (DECISION_LOG "11 SUPPLIER TOOL PAGES REDRAW — APPROVED
 * (v3)"; drawing `supplier_tools_redraw_v3_fable.html`, "Failures that looked like success or emptiness"): *"a failed
 * read must never read as clean or empty."* The same disease `reads-are-honest.test.ts` (beside this file) fences on
 * the render layer — Supabase RESOLVES with `{ error }`, `?? []` turns a refusal into an empty list — found in reads
 * that live OUTSIDE the files that guard walks:
 *
 *   Theft Watch .... `fetchVendorReposts` returned [] on a refused read, and the page said *"No reposts flagged — your
 *                    work is clean. We'll keep watching."* — a supplier told they are safe when nothing was checked.
 *   Track record ... `fetchVendorTrackRecord` returned [] when its RPC errored, and the page said "No completed events
 *                    yet" to a supplier with a real record.
 *   My lines ....... only the lines read was checked; a refused SEGMENTS read made the "Tied to" picker vanish in
 *                    silence. Its place now says "Couldn't load your segments" with Try again.
 *
 * ── What it holds, per page ─────────────────────────────────────────────────
 *   1 · THE READ SAYS IT FAILED: the fetcher's failure branches return `null` — never `[]`.
 *   2 · THE PAGE BRANCHES ON THE FAILURE FIRST: `=== null` is asked before the empty line is drawn.
 *   3 · THE FAILURE REACHES THE RENDER in the approved words, with its own Try again (a log line never changed a pixel).
 *
 * SABOTAGE (each run once, each went red, then restored): `return null;` → `return [];` in the theft-watch catch (1) ·
 * the theft-watch page's `reposts === null ?` branch deleted (2) · "This is not a clean result." reworded (3) · the
 * track-record RPC failure back to `return [];` (1) · the track-record `rows === null` branch moved after the empty
 * line (2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The body of `export async function <name>(…) { … }` — to its closing brace at depth 0. */
function fnBody(src: string, name: string): string {
  const at = src.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `anti-vacuity: ${name} is not in the file`);
  const sig = /\):\s*Promise<[^{]*>\s*\{/g;
  sig.lastIndex = at;
  const m = sig.exec(src);
  assert.ok(m, `anti-vacuity: ${name} has no \`): Promise<…> {\` signature`);
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

type Page = {
  name: string;
  fetcherFile: string;
  fetcher: string;
  page: string;
  /** The variable the page holds the read in, and the empty line it may draw only after asking for null. */
  held: string;
  empty: string;
  failWords: readonly string[];
  retry: string;
};

const PAGES: readonly Page[] = [
  {
    name: 'Theft Watch',
    fetcherFile: 'lib/vendor-theft-watch.ts',
    fetcher: 'fetchVendorReposts',
    page: 'app/vendor-dashboard/theft-watch/_components/theft-watch-view.tsx',
    held: 'reposts',
    empty: 'No reposts flagged',
    failWords: ['We couldn’t check for reposts just now.', 'This is not a clean result.'],
    retry: 'retryHref="/vendor-dashboard/theft-watch"',
  },
  {
    name: 'Track record',
    fetcherFile: 'app/vendor-dashboard/_components/vendor-track-record-panel.tsx',
    fetcher: 'fetchVendorTrackRecord',
    page: 'app/vendor-dashboard/track-record/_components/track-record-view.tsx',
    held: 'rows',
    empty: 'No completed events yet',
    failWords: ['We couldn’t read your track record.'],
    retry: 'retryHref="/vendor-dashboard/track-record"',
  },
];

for (const p of PAGES) {
  test(`${p.name} · 1 · the read returns null when it fails, never []`, () => {
    const body = fnBody(read(p.fetcherFile), p.fetcher);
    assert.match(body, /return null;/, `${p.fetcher} has no failure branch that says so`);
    assert.doesNotMatch(body, /return \[\];/, `${p.fetcher} turns a failed read into an empty list again`);
  });

  test(`${p.name} · 2 · the page asks "did the read fail?" before it draws the empty line`, () => {
    const src = read(p.page);
    const asked = src.indexOf(`${p.held} === null`);
    const empty = src.indexOf(p.empty);
    assert.ok(asked >= 0, `${p.page} never branches on a failed read (\`${p.held} === null\`)`);
    assert.ok(empty >= 0, `anti-vacuity: ${p.page} no longer draws "${p.empty}"`);
    assert.ok(asked < empty, `${p.page} draws "${p.empty}" before it asks whether the read failed`);
  });

  test(`${p.name} · 3 · the failure reaches the render in the approved words, with Try again`, () => {
    const src = read(p.page);
    for (const w of p.failWords) assert.ok(src.includes(w), `${p.page} lost the approved words "${w}"`);
    assert.ok(src.includes('<ToolFail'), `${p.page} does not draw the failed read`);
    assert.ok(src.includes(p.retry), `${p.page}'s failed read has no Try again`);
  });
}

test('My lines · a refused segments read is said in the "Tied to" picker’s place, never hidden', () => {
  // SABOTAGE (run once, red, restored): `activitiesRes.error ? null :` dropped from the page → 1; the `activities === null`
  // branch moved after `activities.length > 0` → 2.
  const page = read('app/vendor-dashboard/lines/page.tsx');
  assert.match(page, /const activities = activitiesRes\.error \? null :/, 'the page no longer hands a refused segments read on as null');
  const rows = read('app/vendor-dashboard/lines/_components/line-rows.tsx');
  const asked = rows.indexOf('activities === null');
  const picker = rows.indexOf('activities.length > 0');
  assert.ok(asked >= 0 && picker >= 0, 'anti-vacuity: the picker branches are gone');
  assert.ok(asked < picker, 'the picker is drawn before the page asks whether the segments were read');
  assert.ok(rows.includes('Couldn’t load your segments'), 'the approved words are gone');
  assert.match(rows, /label="Try again" href="\/vendor-dashboard\/lines"/, 'the failed segments read has no Try again');
});
