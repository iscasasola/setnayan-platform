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
 * ── THE SWEEP BEHIND THE 2026-09-20 TIGHTENING ──────────────────────────────
 * Before requiring a CALL rather than a mention, the tightened matchers were
 * run across the tree to see whom they would newly name, because a stricter
 * rule that turns up real defects must not be weakened back to green: 54 files
 * render `aria-modal`, 53 are cleared by the tight matchers, 1 is the
 * exemption below — NEWLY NAMED: ZERO. Nothing was hiding behind the loose
 * rule, so nothing needed exempting. Re-run that sweep, do not assume it.
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
import { stripComments } from './strip-comments';

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

/**
 * Anything that proves the file routes through the shared focus management.
 *
 * 🔴 EACH MATCHER REQUIRES A USE, NEVER A MENTION — AND THAT IS THE THIRD TIME
 * THIS DISTINCTION HAS HAD TO BE MADE HERE. The docblock above records the
 * first two: prose about a construct is not the construct, in either direction,
 * which is why comments are stripped. An IMPORT is the third form, and it
 * survives the stripper because an import is code.
 *
 * MEASURED 2026-09-20 on `claude/the-reply-is-a-sheet` (#5790): the markers
 * used to be the bare strings `'useModalA11y'`, `'_components/sheet'` and
 * `'confirm-dialog'`. Deleting
 * `useModalA11y({ open, onClose: closeSheet, containerRef: panelRef });` from
 * `app/[slug]/_components/rsvp-sheet.tsx` — leaving the import line in place —
 * left this guard GREEN. The sheet still claimed `aria-modal="true"`, still
 * trapped nothing, and still let Tab walk out into the page behind it. Only
 * that file's own local assertion caught it.
 *
 * 🔑 Two of the three markers were literally import-PATH fragments, so for
 * those the import WAS the whole test.
 *
 * ⚖ `confirm-dialog` is matched by `useConfirm(` as well as by a
 * `<ConfirmDialog>` render, because that is how it is actually consumed —
 * checked, not assumed: every current importer takes the `useConfirm` hook and
 * none renders the component directly. A render-only matcher would have been
 * tight AND wrong.
 */
const EVIDENCE: { name: string; matcher: RegExp }[] = [
  { name: 'useModalA11y', matcher: /useModalA11y\s*\(/ },
  { name: '<Sheet>', matcher: /<Sheet[\s/>]/ },
  { name: 'confirm-dialog', matcher: /<ConfirmDialog[\s/>]|useConfirm\s*\(/ },
];

/**
 * The rule itself, pulled out so the fixtures at the bottom of this file can
 * EXECUTE it. A guard whose rule exists only inline can be reopened by an edit
 * that no test observes — which is exactly how the import hole got in.
 */
export function overlayManagesFocus(strippedSource: string): boolean {
  return EVIDENCE.some(({ matcher }) => matcher.test(strippedSource));
}

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
      /*
        🔴 COMMENTS ARE STRIPPED FIRST, AND THIS GUARD USED TO SKIP THAT STEP.
        It scanned raw text, so a file that DELIBERATELY DOES NOT claim
        `aria-modal` — and explains in its docblock why it must not, because it
        is a disclosure over a page that is still live behind it — was reported
        as an overlay making a promise it does not keep. Measured 2026-09-09
        when `find-in-this-day.tsx` landed saying exactly that.

        ⚖ AND IT CUTS THE OTHER WAY TOO, WHICH IS THE BETTER HALF. The EVIDENCE
        markers below were also being matched inside comments, so a file that
        rendered `aria-modal` and merely MENTIONED `useModalA11y` in a note
        counted as wired. Prose about a construct is not the construct, in
        either direction. `lib/strip-comments.ts` is the one stripper this
        repo has for exactly this — see its header for what a hand-rolled
        regex version deleted.
      */
      const src = stripComments(readFileSync(file, 'utf8'));
      if (!src.includes('aria-modal')) continue;
      checked += 1;
      const rel = relative(WEB_ROOT, file);
      if (EXEMPT.has(rel)) continue;
      if (!overlayManagesFocus(src)) offenders.push(rel);
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

/**
 * THE RULE, TESTED AGAINST SYNTHETIC SOURCE.
 *
 * The scan above can only ever say "nobody in the tree is an offender today".
 * It cannot say the RULE still distinguishes wired from unwired — and a rule
 * that stops distinguishing reports a clean tree forever. These fixtures are
 * the part that fails when somebody relaxes a matcher back to an identifier.
 */
test('a11y · the evidence rule wants the CALL, not the import', () => {
  const importOnly = `import { useModalA11y } from '@/lib/use-modal-a11y';\nexport function S() { return <div aria-modal="true" />; }`;
  assert.equal(
    overlayManagesFocus(importOnly),
    false,
    'importing the hook and never calling it counts as managing focus again — ' +
      'this is the exact hole measured on #5790',
  );

  const called = `${importOnly}\nuseModalA11y({ open, onClose, containerRef });`;
  assert.equal(overlayManagesFocus(called), true, 'a real call is no longer recognised');
});

test('a11y · the primitives count when RENDERED or USED, not when imported', () => {
  const sheetImportOnly = `import { Sheet } from '@/app/_components/sheet';`;
  assert.equal(overlayManagesFocus(sheetImportOnly), false, 'importing <Sheet> is not rendering it');
  assert.equal(overlayManagesFocus(`${sheetImportOnly}\n<Sheet open={o} />`), true);

  const confirmImportOnly = `import { useConfirm } from '@/app/_components/confirm-dialog';`;
  assert.equal(overlayManagesFocus(confirmImportOnly), false, 'importing useConfirm is not calling it');
  // Both real consumption shapes, because every current importer uses the hook
  // and a render-only matcher would be tight and wrong.
  assert.equal(overlayManagesFocus(`${confirmImportOnly}\nconst confirm = useConfirm();`), true);
  assert.equal(overlayManagesFocus('<ConfirmDialog open={o} />'), true);
});

test('a11y · a near-miss identifier is not evidence', () => {
  // `useModalA11yish`, a variable named after the hook, or a type-only import.
  assert.equal(overlayManagesFocus('const useModalA11yEnabled = true;'), false);
  assert.equal(overlayManagesFocus('type X = typeof useModalA11y;'), false);
  assert.equal(overlayManagesFocus('<SheetFooter />'), false);
});

test('a11y · every exemption names a file that still exists and still needs it', () => {
  for (const [rel, reason] of EXEMPT) {
    const src = stripComments(readFileSync(join(WEB_ROOT, rel), 'utf8'));
    assert.ok(
      src.includes('aria-modal'),
      `${rel} is exempted but no longer renders aria-modal — delete the exemption`,
    );
    assert.ok(reason.length > 30, `${rel}'s exemption reason is too thin to review`);
  }
});
