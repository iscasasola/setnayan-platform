/**
 * Every `aria-modal="true"` overlay must manage focus.
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
 * `aria-modal="true"` is a PROMISE to assistive technology: nothing outside
 * this element exists right now. A component can make that promise in markup
 * while doing nothing to keep it — no Escape handler, no Tab trap, no focus
 * restore. A screen-reader or keyboard user then tabs straight out of a modal
 * that says the page behind it is inert, lands on controls they cannot see,
 * and cannot get back. `lib/use-modal-a11y.ts` was written for exactly this
 * in the 2026-06-25 audit; three overlays shipped afterwards without it,
 * including the guest-facing Papic buy sheet, which OPENS BY ITSELF over the
 * viewfinder at the out-of-shots moment.
 *
 * ── WHY THIS IS A SOURCE SCAN ───────────────────────────────────────────────
 * There is no DOM in `tsx --test` and no route harness here, so this asserts
 * the WIRING: a file that renders `aria-modal` must also reference the shared
 * hook (directly, or by rendering one of the primitives that call it). That is
 * the regression that actually happens — someone hand-rolls a new overlay and
 * the hook never gets added.
 *
 * ⚠ What this does NOT prove: that focus behaves correctly at runtime. The
 * hook's own behaviour is covered separately; this file only proves nobody is
 * making the promise without calling it.
 *
 * ── ADDING AN EXEMPTION ─────────────────────────────────────────────────────
 * Don't, in almost every case. If an overlay genuinely must not trap focus, it
 * should not claim `aria-modal="true"` — drop the attribute instead. The one
 * legitimate class is a file that DEFINES a primitive rather than consuming
 * one; those are listed by exact path below with a reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const WEB_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCAN_DIRS = ['app', 'components'];

/**
 * Files that render `aria-modal` and legitimately do not call the hook.
 * Exact repo-relative paths — never a prefix or a glob, so a new file cannot
 * inherit an exemption it was never argued for.
 */
const EXEMPT = new Map<string, string>([
  [
    'app/dashboard/(account)/life-flash/_components/flash.tsx',
    'Hand-rolls the COMPLETE contract and predates the hook: focus into the stop button on open, Tab/Shift-Tab cycled between first and last, Escape, and focus restored to the launcher on close. Verified line by line 2026-08-02. It is a full-screen playback surface with its own key handling, so migrating it is a rewrite with real risk and no defect to fix. Re-verify if that key handling is ever touched.',
  ],
]);

/** Anything that proves the file routes through the shared focus management. */
const EVIDENCE = [
  'useModalA11y', // the hook itself
  '_components/sheet', // <Sheet> — calls the hook
  'confirm-dialog', // <ConfirmDialog> — manages focus inline
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

test('a11y · no overlay claims aria-modal without managing focus', () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const scanDir of SCAN_DIRS) {
    const root = join(WEB_ROOT, scanDir);
    let files: string[];
    try {
      files = walk(root);
    } catch {
      continue; // directory may not exist in every checkout shape
    }
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('aria-modal')) continue;
      checked += 1;
      const rel = relative(WEB_ROOT, file);
      if (EXEMPT.has(rel)) continue;
      if (!EVIDENCE.some((marker) => src.includes(marker))) offenders.push(rel);
    }
  }

  // A scan that found nothing to check would pass silently forever — the
  // "a test that cannot fail is worse than none" trap. Pin the floor.
  assert.ok(
    checked >= 20,
    `only ${checked} files with aria-modal were scanned — the walk is probably ` +
      `pointed at the wrong root, so this guard is inert`,
  );

  assert.deepEqual(
    offenders,
    [],
    `these overlays promise aria-modal="true" but never manage focus. Call ` +
      `useModalA11y({ open, onClose, containerRef }) and put the ref on the ` +
      `element carrying role="dialog" — or drop aria-modal if it must not trap:\n` +
      offenders.map((f) => `  · ${f}`).join('\n'),
  );
});

test('a11y · every exemption names a file that still exists and still needs it', () => {
  for (const [rel, reason] of EXEMPT) {
    const src = readFileSync(join(WEB_ROOT, rel), 'utf8');
    assert.ok(
      src.includes('aria-modal'),
      `${rel} is exempted but no longer renders aria-modal — delete the exemption`,
    );
    assert.ok(reason.length > 30, `${rel}'s exemption reason is too thin to review`);
  }
});
