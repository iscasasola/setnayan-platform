/**
 * GUARD — BUSY STATES: THE GHOST SKELETON, AND A PRESSED BUTTON THAT NAMES ITS STEP (final check B19 · SW-SPIN ·
 * A5-G4-09 · A5-G6-21 · A8·L-6; drawing `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html`
 * § B19, approved by the owner 25 Nov).
 *
 *   1. A block that is loading draws the skeleton (`Sk` / `Ghost`, `components/skeletons`): what is known shows as itself,
 *      the unknown parts are grey blocks crossed by the Sheen. No `animate-pulse` block.
 *   2. A button that is working STAYS PRESSED and names its step in words ("Posting…", "Uploading photo…", "Saving…").
 *      No spinner: `SubmitButton` (every form button, the admin's included) and `ActionButton busy` draw none.
 *   3. A failure is said in the danger token, with Try again.
 *
 * Area 5 (the supplier dashboard and Open a shop) is swept here: no `animate-spin`, no `animate-pulse` in either tree.
 * The one exception is the camera's REC dot (`papic-capture-controller.tsx`) — it is not a busy state, it says a
 * recording is running.
 *
 * Sabotage: put a `<Loader2 … animate-spin>` back in any supplier file (1 red) · give SubmitButton its spinner back
 * (1 red) · drop the held press from globals.css (1 red) · let a working ActionButton still fire its press (1 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx') && !full.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

const REC_DOT = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-capture-controller.tsx';

test('1 · area 5 draws no spinner and no pulsing block', () => {
  const files = [...walk(join(web, 'app/vendor-dashboard')), ...walk(join(web, 'app/open-shop'))];
  assert.ok(files.length > 200, `the sweep reads almost nothing (${files.length} files)`);
  const spin: string[] = [];
  const pulse: string[] = [];
  for (const f of files) {
    const rel = relative(web, f);
    const code = stripComments(readFileSync(f, 'utf8'));
    if (/animate-spin|<Loader2\b/.test(code)) spin.push(rel);
    const pulses = (code.match(/animate-pulse/g) ?? []).length;
    if (rel === REC_DOT ? pulses !== 1 : pulses > 0) pulse.push(rel);
  }
  assert.deepEqual(spin, [], `a spinner on a supplier screen — the button stays pressed and names its step instead:\n  ${spin.join('\n  ')}`);
  assert.deepEqual(pulse, [], `a pulsing block — draw the skeleton (Sk / Ghost) instead:\n  ${pulse.join('\n  ')}`);
  assert.match(src(REC_DOT), /<i aria-hidden className="animate-pulse" \/> REC/, 'the REC dot moved — re-check the exception');
});

test('2 · SubmitButton and ActionButton say the step and stay pressed — no spinner', () => {
  const submit = src('app/_components/submit-button.tsx');
  assert.doesNotMatch(submit, /Loader2|animate-spin/, 'every form button spins again');
  assert.match(submit, /aria-busy=\{pending\}/);
  assert.match(submit, /<span className="sn-m-busy inline-flex items-center gap-2" data-busy="">\s*\{pendingLabel \|\|/);
  const btn = src('components/action-button.tsx');
  assert.match(btn, /const working = typeof props\.busy === 'string' && props\.busy\.length > 0 \? props\.busy : null;/);
  assert.match(btn, /const label = working \?\? props\.label;/, 'a working button does not name its step');
  assert.match(btn, /const stopped = Boolean\(waiting \|\| working\);/);
  assert.match(btn, /onClick=\{stopped \? undefined : p\.onClick\}/, 'a working button still fires its press');
  assert.equal((btn.match(/aria-busy=\{working \? true : undefined\}/g) ?? []).length, 2, 'a working button or link is not marked busy');
  const css = readFileSync(join(web, 'app/globals.css'), 'utf8');
  assert.match(css, /button\[aria-busy='true'\],\s*a\[aria-busy='true'\],\s*label\[aria-busy='true'\] \{\s*scale: 0\.97;/, 'a working button is not held pressed');
});

test('3 · the drawing’s three frames: Analytics, the Locked QR proof photo, a form button', () => {
  // Frame 1 · Shop › Analytics: the word shows at once, the card is a grey block.
  const shop = src('app/vendor-dashboard/shop/page.tsx');
  const ph = shop.slice(shop.indexOf('function AnalyticsPlaceholder'), shop.indexOf('function AnalyticsPlaceholder') + 600);
  assert.match(ph, />Analytics</, 'the known word does not show at once');
  assert.match(ph, /<Sk className="h-\[260px\] rounded-2xl" \/>/, 'the card is not the skeleton');
  // Frame 2 · Locked QR › proof photo: held pressed, "Uploading photo…", failure in danger with Try again.
  const qr = src('app/vendor-dashboard/invite/_components/locked-qr-generator.tsx');
  assert.equal((qr.match(/<UploadSlotControl slot=\{(proof|remembrance)\}/g) ?? []).length, 2, 'a slot draws its own control again');
  assert.match(qr, /aria-busy=\{slot\.busy \|\| undefined\}/);
  assert.match(qr, /slot\.busy \? 'Uploading photo…' : 'Choose file'/);
  assert.match(qr, /style=\{\{ color: 'rgb\(var\(--color-danger\)\)' \}\}[^>]*>\s*\{slot\.err\}\s*<ActionButton tone="neutral" quiet icon=\{RotateCcw\} label="Try again" onClick=\{slot\.retry\} \/>/);
  assert.doesNotMatch(qr, /text-terracotta-700">\{(proof|remembrance)\.err\}/, 'the error words are back in the couple’s colour');
  assert.match(qr, /function retry\(\) \{\s*if \(lastFile\.current\) void upload\(lastFile\.current\);/, 'Try again does not send the same file');
  // A supplier ActionButton that works names its step.
  assert.match(src('app/vendor-dashboard/on-the-day/_components/vendor-status-updates.tsx'), /label="Post"\s*busy=\{pending \? 'Posting…' : null\}/);
  assert.equal((src('app/open-shop/_components/open-shop-wizard.tsx').match(/busy=\{continueBusy\}/g) ?? []).length, 2);
});
