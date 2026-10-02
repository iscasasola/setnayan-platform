/**
 * the-toolbar-never-hides-restore-undo-apply.test.ts
 *
 * Owner, 2026-09-25, on the live Maker: *"i thought there will be an action
 * buttons RESTORE/UNDO/APPLY on the upper right nav?"* → *"upper right of the
 * top nav"*. Before this build the dock rendered NOTHING once `!hasChanges`
 * (the "Draft" badge and Apply both return early) and Undo/Restore/Reset only
 * existed inside a `<details>` a couple had to open first — on production
 * that read as "Draft · No draft — the preview is what guests see." with no
 * button anywhere.
 *
 * Two layers, because `HubDraftToolbar` calls `useRouter()` (`next/navigation`)
 * unconditionally and throws outside a real App Router — the same reason
 * `hub-draft-wiring.test.ts` proves the writers by their SOURCE, not by
 * mounting them:
 *
 *   1. `DraftButton` — the shared primitive with zero Next-specific deps — is
 *      MOUNTED for real (`renderToStaticMarkup`), enabled and disabled, and
 *      the actual emitted HTML is read: present either way, `disabled` only
 *      when told to be, and an adjacent `InfoTip` appears ONLY when disabled.
 *   2. `HubDraftToolbar`'s source proves the wiring `DraftButton` cannot see
 *      by itself: that Restore, Undo and Apply are never wrapped in a
 *      `summary.hasChanges ? … : null` (or any other conditional) the way the
 *      old "Draft" badge and Apply button were, that each disables off the
 *      right field, and that Reset / the Pro line / the store-shell line /
 *      the outcome report — the rest of the Phase 2 dock's behaviour — are
 *      still there, just behind the ⋯.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/* tsx compiles these components to the CLASSIC runtime (bare
   `React.createElement`), so React must be global BEFORE they are imported,
   and the imports are dynamic — `hub-stage-renders.test.ts` documents why. */
(globalThis as unknown as { React: unknown }).React = React;

const FILE = join(__dirname, 'hub-draft-bar.tsx');
const SRC = stripComments(readFileSync(FILE, 'utf8'));

/** The text of one function/component, up to the next top-level declaration. */
function body(name: string): string {
  const start = SRC.search(new RegExp(`^(?:export\\s+)?function\\s+${name}\\s*\\(`, 'm'));
  assert.ok(start >= 0, `${name} not found in ${FILE}`);
  const rest = SRC.slice(start + 1);
  const next = rest.search(/^(?:export\s+)?function\s+\w+\s*\(/m);
  return next < 0 ? SRC.slice(start) : SRC.slice(start, start + 1 + next);
}

/* ═══════════════════════════════════════ 1 · DraftButton, actually mounted ═══ */

async function paintButton(opts: { disabled: boolean; primary?: boolean }) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  // NOT './hub-draft-bar' — that module also imports `hubDraftAction`, which
  // reaches `'server-only'` (real inside Next's bundler, unresolvable to a
  // bare `tsx --test` run). `DraftButton` lives in its own module exactly so
  // it can be mounted here; see hub-draft-button.tsx's docblock.
  const { DraftButton } = await import('./hub-draft-button');
  return renderToStaticMarkup(
    React.createElement(DraftButton as never, {
      label: 'Apply',
      icon: React.createElement('span', { 'aria-hidden': true }, '✓'),
      primary: opts.primary ?? false,
      disabled: opts.disabled,
      disabledReason: 'No changes to apply',
      onClick: () => {},
    }),
  );
}

test('a DraftButton renders — enabled AND disabled, never absent', async () => {
  const enabled = await paintButton({ disabled: false });
  const disabled = await paintButton({ disabled: true });
  for (const html of [enabled, disabled]) {
    assert.match(html, /<button[^>]*aria-label="Apply"/, 'the button itself must be in the markup');
  }
  assert.doesNotMatch(enabled, /\bdisabled=""/, 'an enabled button must not carry the disabled attribute');
  assert.match(disabled, /\bdisabled=""/, 'a disabled button must actually be disabled');
});

test('only a disabled DraftButton grows an InfoTip, and it carries the reason', async () => {
  const enabled = await paintButton({ disabled: false });
  const disabled = await paintButton({ disabled: true });
  assert.doesNotMatch(enabled, /aria-label="Why Apply is off"/, 'an enabled button explains nothing — there is nothing to explain');
  assert.match(disabled, /aria-label="Why Apply is off"/, 'a disabled button must be able to say why');
  assert.match(disabled, /No changes to apply/, 'the actual reason must be in the popover, not just referenced');
});

test('Apply (primary) reads through the shared button-primary class, like every other Maker CTA', async () => {
  const html = await paintButton({ disabled: false, primary: true });
  assert.match(html, /class="[^"]*\bbutton-primary\b/);
});

/* ═══════════════════════════════ 2 · HubDraftToolbar, proved by its source ═══ */

/*
 * ✂ THE MAKER IN 4 (2026-10-02, approved design `maker_in_four_2026-09-30_fable.html`,
 * "Restore → ⋯ › Restore — still restores the last Applied hub"): Undo and Apply
 * stay in the bar, never hidden; Restore became a row of the Maker toolbar's ONE
 * ⋯ — registered from this bar (`MakerState.draft`) and still switched off, with
 * its reason, on the same field. This bar's own ⋯ button went (one ⋯ per bar).
 */
test('HubDraftToolbar renders exactly Undo and Apply as DraftButton — unconditionally — and registers Restore for ⋯', () => {
  const fn = body('HubDraftToolbar');
  const calls = [...fn.matchAll(/<DraftButton\b/g)];
  assert.equal(calls.length, 2, `expected 2 <DraftButton>, found ${calls.length}`);
  assert.doesNotMatch(fn, /label="Restore"/, 'Restore is back on the bar — it is ⋯’s row (the Maker in 4)');
  const at = fn.indexOf('label="Undo"');
  assert.ok(at > 0, "Undo's DraftButton is missing");
  const before = fn.slice(Math.max(0, at - 120), at);
  assert.doesNotMatch(before, /summary\.hasChanges\s*\?|summary\.hasChanges\s*&&|summary\.canUndo\s*\?|summary\.canUndo\s*&&/, 'Undo must not be conditionally rendered');
  const applyAt = fn.indexOf('label={applyLabel}');
  assert.ok(applyAt > 0, "Apply's DraftButton is missing");
  const beforeApply = fn.slice(Math.max(0, applyAt - 160), applyAt);
  assert.doesNotMatch(beforeApply, /summary\.hasChanges\s*&&\s*!onlyPro|onlyPro\s*\?/, 'Apply must not be hidden when every change is Pro-gated — disabled + InfoTip instead');
  // Restore: registered with the shell unconditionally, running this bar's own act.
  assert.match(fn, /setDraftDoor\(\{ canRestore, restore: \(\) => actRef\.current\(\{ intent: 'restore' \}\) \}\)/);
});

test('each control disables off the field that actually means "nothing to do", not off pending alone', () => {
  const fn = body('HubDraftToolbar');
  const block = (label: string) => {
    const at = fn.indexOf(label);
    assert.ok(at > 0, `${label} not found`);
    return fn.slice(at, at + 260);
  };
  assert.match(fn, /const canRestore = !pending && summary\.hasChanges;/, 'Restore: nothing to restore once the draft matches live');
  assert.match(block('label="Undo"'), /disabled=\{pending \|\| !summary\.canUndo\}/, 'Undo: only the history says whether a step back exists');
  assert.match(block('label={applyLabel}'), /disabled=\{pending \|\| !summary\.hasChanges\}/, 'Apply: nothing to apply once the draft matches live');
});

test('Apply is the one primary (filled) button, and it wears the count of changes waiting', () => {
  const fn = body('HubDraftToolbar');
  const undo = fn.slice(fn.indexOf('label="Undo"'), fn.indexOf('label={applyLabel}'));
  const apply = fn.slice(fn.indexOf('label={applyLabel}'), fn.indexOf('label={applyLabel}') + 900);
  assert.doesNotMatch(undo, /\bprimary\b/, 'Undo must not be the primary button');
  assert.match(apply, /\bprimary\b/, 'Apply must be the primary button');
  assert.match(apply, /data-maker-apply-count=""/, 'Apply lost its count (design: "Apply 3")');
  // The bar's Phone button sits between Undo and Apply (Exit · Page ▾ · Look · Details · Undo · Phone · Apply · ⋯).
  assert.match(undo, /\{maker\?\.viewToggle \?\? null\}/);
});

test('Reset stays in the draft panel — opened by ⋯ › Reset, never promoted beside Undo/Apply', () => {
  const fn = body('HubDraftToolbar');
  const panelAt = fn.indexOf('data-maker-draft-panel=""');
  assert.ok(panelAt > 0, 'the draft panel is gone');
  const beforePanel = fn.slice(0, panelAt);
  assert.doesNotMatch(beforePanel, /Reset\s*\{RESET_LABEL/, 'Reset must not render before the panel opens');
  assert.match(fn.slice(panelAt), /Reset\s*\{RESET_LABEL\[stage\]\}/, 'Reset must still be reachable, inside the panel');
  // Drawn only while open (portalled to the screen since 2026-10-02 — it ran off a phone's left edge).
  assert.match(fn.slice(panelAt), /\{open && typeof document !== 'undefined' \? createPortal\(/, 'the panel shows only when opened');
  assert.doesNotMatch(fn, /<summary\b/, 'a second ⋯ is back on the bar');
});

test('the rest of the Phase 2 dock survives the redesign: Pro line, store-shell line, outcome report', () => {
  const fn = body('HubDraftToolbar');
  assert.match(fn, /Apply needs Event Hub Pro/, 'the try-then-pay Pro line must still render');
  assert.match(fn, /can be applied on the web/, 'the store-shell line must still render — no price, no pay path in the shell');
  assert.match(fn, /<ResultLine result=\{result\}\s*\/>/, 'the outcome of the last action must still be reported');
  assert.match(fn, /Reset in your draft\. Guests still see the old page until you Apply\./, "Reset's own confirmation copy must still render");
});

test('the ⋯ panel NEVER opens by itself — what an action reports is said beside Apply', () => {
  const fn = body('HubDraftToolbar');
  // Superseded 2026-10-02 (owner, live phone test: the "Reset Save the Date…"
  // box came back after every Apply and would not close). The answer is said in
  // the status line (`hubDraftOutcome` → `OutcomeLine`), and the panel opens
  // only from ⋯ › "Reset this stage…" — held by lib/the-draft-panel-never-pops-up.test.ts.
  assert.match(fn, /useEffect\(\(\) => \{\s*if \(result\) setOpen\(false\);\s*\}, \[result\]\);/);
  assert.match(fn, /<OutcomeLine outcome=\{outcome\} \/>/, 'the outcome is no longer said beside Apply');
});
