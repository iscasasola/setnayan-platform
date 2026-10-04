/**
 * apps/web/lib/the-maker-promises-nothing.test.ts
 *
 * ⛔ THE EVENT HUB MAKER SAYS WHAT IT DOES TODAY — NEVER WHAT A LATER BUILD WILL.
 *
 * App Review rejects "coming soon" (the Apple check moves to Thursday 1 Oct —
 * DECISION_LOG 2026-09-28, "EVERY EVENT HUB BUILD FINISHES BEFORE THE APPLE
 * CHECK"). Until 2026-09-28 the Maker carried `MAKER_COMING_NEXT` — "Desktop and
 * phone side by side is coming in the next build", "One hero for every stage …
 * is coming in the next build" — and the Theme panel's "Coming next · all ten
 * themes … arrive in the next build". A control that is not built is not drawn;
 * a line that promises one is not written.
 *
 * Scans the rendered code (comments stripped — a docblock may tell history) of
 * every Maker surface: the Maker shell and bar, the editor's components, and the
 * Maker tour.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.includes('.test.')) out.push(p);
  }
  return out;
}

const MAKER_DIRS = [
  'app/dashboard/[eventId]/launch/_components',
  'app/dashboard/[eventId]/website/editor/_components',
];

const PROMISE = /next build|coming soon|coming next|comes next|arrives? in the next|in a later build|not built yet/i;

test('no Maker surface promises a later build', () => {
  const files = MAKER_DIRS.flatMap((d) => walk(join(WEB, d)));
  assert.ok(files.length > 20, `the Maker scanned short (${files.length} files) — the guard is looking at nothing`);
  const found: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const m = PROMISE.exec(src);
    if (m) found.push(`${relative(WEB, f)}: "${m[0]}"`);
  }
  assert.deepEqual(found, [], 'a Maker surface promises a later build — hide the control instead');
});

test('the Maker tour promises nothing either', () => {
  const tours = stripComments(readFileSync(join(WEB, 'lib/tours.ts'), 'utf8'));
  const start = tours.indexOf('customer_event_hub_maker_v1: {');
  assert.ok(start > 0, 'the Maker tour was not found — the scan is blind');
  const block = tours.slice(start, tours.indexOf('\n  },', start));
  assert.ok(block.length > 200, 'the Maker tour scanned nearly empty');
  assert.doesNotMatch(block, PROMISE);
});

test('`MAKER_COMING_NEXT` is gone, and the View menu offers only views that are drawn', () => {
  const bar = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-bar.ts'), 'utf8'));
  assert.ok(bar.length > 500, 'maker-bar scanned nearly empty');
  assert.doesNotMatch(bar, /MAKER_COMING_NEXT/, 'the coming-next table is back');
  const shell = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx'), 'utf8'));
  // ✂ The Maker in 4 (2026-10-02): View ▾ became the bar's Phone button and ⋯'s Both row;
  // 2026-10-04 both are rows of 👁 Preview (`previewRows`).
  const rows = shell.slice(shell.indexOf('const previewRows = '), shell.indexOf('  return (\n    <MakerContext.Provider'));
  const view = rows.slice(rows.lastIndexOf('<MenuItem', rows.indexOf('data-maker-tool-row="view"')), rows.indexOf('{bothView ? ('));
  assert.ok(view.includes('makerViewToggle(shownDevice)'), 'the Phone / Desktop row was not found — the scan is blind');
  assert.doesNotMatch(view, /disabled|note=/, 'the Phone / Desktop row is drawn switched off — a view that is not built is not drawn');
  const both = rows.slice(rows.indexOf('{bothView ? ('), rows.indexOf('data-maker-tool-row="scenes"'));
  assert.ok(both.length > 40, 'the Both row was not found — the scan is blind');
  assert.doesNotMatch(both, /disabled|note=/, 'the Both row is drawn switched off');
  assert.match(shell, /makerViewOptions\(wide\)\.find\(\(o\) => o\.key === 'both'\)/, 'Both is offered off its own rule (1024 px and wider)');
  /* "Both" came back 2026-09-29 as a BUILT view: offering it is honest only
     while the canvas draws its second pane (`the-maker-both-view-is-live.test.ts`). */
  if (bar.includes("label: 'Both'")) {
    const work = stripComments(
      readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
    );
    assert.match(work, /data-maker-both-phone=""/, 'the View menu offers "Both" but the canvas draws no phone pane');
  }
});
