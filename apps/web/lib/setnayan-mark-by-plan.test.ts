/**
 * 🏷 THE SETNAYAN MARK FOLLOWS THE EVENT'S PLAN — A GUARD PER PLAN (DECISION_LOG 2026-11-04 "SETNAYAN MARKINGS BY
 * PLAN: FREE = THE WATERMARK · PLUS = MINIMAL · PRO = NONE"; Build 6 Lane L: "One helper decides the mark from the
 * event's plan, with a guard per plan").
 *
 *   · the helper: Free → watermark · Plus → quiet · Pro → none (Pro wins over Plus);
 *   · the line: Event Pro renders NOTHING; Plus renders only "Made with Setnayan" (no address, no "Powered by");
 *   · paper: Event Pro prints and passes carry no Setnayan mark; Plus the tiny quiet mark; never louder than the look;
 *   · the plan is READ from the shipped entitlement readers (Rule 0), and a failed read is the free watermark;
 *   · SCAN: no guest page under app/[slug] spells the watermark itself — every one draws `SetnayanMarkLine`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { printBrandForMark, setnayanMarkFor, setnayanMarkWords, SETNAYAN_WATERMARK_WORDS } from './setnayan-mark-by-plan';
import { SetnayanMarkLine, markOrLegacy } from '../app/_components/setnayan-mark-line';
import { brandPiece } from './print-layout';
import type { PrintDoc } from './print-layout';
import type { PrintLook } from './print-pieces';

// The components compile to classic JSX under tsx (the repo's other render tests do the same).
(globalThis as unknown as { React: unknown }).React = React;

const ROOT = process.cwd();
const code = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const line = (mark: Parameters<typeof SetnayanMarkLine>[0]['mark']) => renderToStaticMarkup(React.createElement(SetnayanMarkLine, { mark, className: 'mt-3 text-xs' }));

test('FREE — the watermark, as every footer printed it', () => {
  assert.equal(setnayanMarkFor({ pro: false, plus: false }), 'watermark');
  assert.match(line('watermark'), /Powered by Setnayan · setnayan\.com/);
  assert.equal(setnayanMarkWords('watermark'), SETNAYAN_WATERMARK_WORDS);
});

test('EVENT PLUS — ONE small, quiet "Made with Setnayan"; the watermark is off', () => {
  assert.equal(setnayanMarkFor({ pro: false, plus: true }), 'quiet');
  const html = line('quiet');
  assert.match(html, />Made with Setnayan</);
  assert.doesNotMatch(html, /Powered by|setnayan\.com/, 'Plus still carries the watermark');
  assert.equal((html.match(/<p\b/g) ?? []).length, 1, 'Plus carries more than ONE mark');
  assert.match(html, /opacity:0\.6/, 'the quiet mark is no quieter than the watermark');
});

test('SABOTAGE-PROVEN: EVENT PRO — no Setnayan mark at all, and Pro wins over Plus', () => {
  assert.equal(setnayanMarkFor({ pro: true, plus: false }), 'none');
  assert.equal(setnayanMarkFor({ pro: true, plus: true }), 'none');
  assert.equal(line('none'), '');
  assert.equal(setnayanMarkWords('none'), null);
  // The legacy boolean still means what it meant: hidden = none, shown = watermark; a plan mark wins.
  assert.equal(markOrLegacy(null, true), 'none');
  assert.equal(markOrLegacy(undefined, false), 'watermark');
  assert.equal(markOrLegacy('quiet', false), 'quiet');
});

test('SABOTAGE-PROVEN: PAPER — Pro prints carry nothing, Plus the tiny mark, never louder than the look', () => {
  assert.equal(printBrandForMark('none', 'line'), 'none');
  assert.equal(printBrandForMark('none', 'mark'), 'none');
  assert.equal(printBrandForMark('quiet', 'line'), 'mark', 'a Plus print still carries the free line');
  assert.equal(printBrandForMark('watermark', 'line'), 'line');
  assert.equal(printBrandForMark('watermark', 'mark'), 'mark', 'a Prints-part print got LOUDER');
  // brandPiece itself adds nothing on a `none` look.
  const doc = { w: 300, h: 420, ops: [] } as unknown as PrintDoc;
  const out = brandPiece([doc, doc], { theme: 'house', ink: '#111111', brand: 'none' } as unknown as PrintLook);
  assert.deepEqual(out.map((d) => d.ops.length), [0, 0], 'an Event Pro print carries a Setnayan mark');
});

test('the plan is READ from the shipped readers — Pro = eventCoupleWebsiteProActive, Plus = EVENT_PLUS — a failed read is the watermark', () => {
  const src = code('lib/setnayan-mark-by-plan.server.ts');
  assert.match(src, /asViewed\(eventCoupleWebsiteProActive\(supabase, eventId\)\.catch\(\(\) => false\)\)/);
  assert.match(src, /asViewed\(eventSkuActive\(supabase, eventId, EVENT_PLUS_SKU\)\.catch\(\(\) => false\)\)/);
  assert.match(src, /return setnayanMarkFor\(\{ pro, plus \}\);/);
  assert.doesNotMatch(src, /process\.env|NEXT_PUBLIC_/, 'the mark must come from the plan, never a flag');
});

test('SABOTAGE-PROVEN: every surface reads the plan — the Hub, its pages, prints and passes', () => {
  const loaders = code('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /startAhead\(eventSetnayanMark\(admin, event\.event_id\)\)/);
  const page = code('app/[slug]/page.tsx');
  assert.ok((page.match(/setnayanMark=\{setnayanMark\}/g) ?? []).length >= 2, 'the private landing is not handed the mark');
  assert.match(code('app/[slug]/_components/site-body.tsx'), /hideWatermark=\{proWatermarkHidden\}\s*setnayanMark=\{setnayanMark\}/);
  for (const [file, comp] of [
    ['app/[slug]/_components/invitation-shell.tsx', 'markOrLegacy(setnayanMark, hideWatermark)'],
    ['app/[slug]/_components/kit-piece.tsx', 'markOrLegacy(setnayanMark, hideWatermark)'],
    ['app/[slug]/seat/page.tsx', '<EventSetnayanMarkLine eventId={eventId}'],
    ['app/[slug]/find-my-table/page.tsx', '<EventSetnayanMarkLine eventId={eventId}'],
    ['app/[slug]/recap/page.tsx', '<EventSetnayanMarkLine eventId={eventId}'],
  ] as const) {
    assert.ok(code(file).includes(comp), `${file} no longer draws the plan's mark`);
  }
  // The seat / find-my-table headers carry the Setnayan logo on Free only.
  for (const file of ['app/[slug]/seat/page.tsx', 'app/[slug]/find-my-table/page.tsx']) {
    assert.match(code(file), /<EventHubHeaderBrand eventId=\{eventId\} \/>/);
    assert.doesNotMatch(code(file), /<Logo\b/, `${file} draws the Setnayan logo whatever the plan`);
  }
  // Both recap footers are handed the event (the published one printed the watermark on Pro).
  assert.equal((code('app/[slug]/recap/page.tsx').match(/<RecapFooter hideWatermark=\{hideWatermark\} eventId=\{event\.event_id\} \/>/g) ?? []).length, 2);
  const print = code('lib/print-set.server.ts');
  assert.match(print, /brand: printBrandForMark\(planMark, printBrandOf\(worn\.look\)\)/);
  assert.match(print, /printPreviewVersion\(\{ event, inputs, qrLook, hub, setnayanMark \}\)/, 'a cached preview keeps the old mark');
  assert.match(code('lib/pass-card.server.ts'), /setnayanMark: !ownsPro && planMark !== 'none'/);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}

test('SABOTAGE-PROVEN: no guest page spells the watermark itself — it is drawn by SetnayanMarkLine only', () => {
  const spelled = walk('app/[slug]').filter((f) => code(f).includes('Powered by Setnayan · setnayan.com'));
  assert.deepEqual(spelled, [], 'a page prints the watermark without asking the plan');
});
