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

test('HubDraftToolbar renders exactly Restore, Undo and Apply as DraftButton — unconditionally', () => {
  const fn = body('HubDraftToolbar');
  const calls = [...fn.matchAll(/<DraftButton\b/g)];
  assert.equal(calls.length, 3, `expected 3 <DraftButton>, found ${calls.length}`);
  // None of the three may sit behind a truthiness guard the way the retired
  // "Draft" badge (`if (!summary.hasChanges) return null`) and the old Apply
  // button (`summary.hasChanges && !onlyPro ? (…) : null`) did.
  for (const label of ['Restore', 'Undo']) {
    const at = fn.indexOf(`label="${label}"`);
    assert.ok(at > 0, `${label}'s DraftButton is missing`);
    const before = fn.slice(Math.max(0, at - 120), at);
    assert.doesNotMatch(before, /summary\.hasChanges\s*\?|summary\.hasChanges\s*&&|summary\.canUndo\s*\?|summary\.canUndo\s*&&/, `${label} must not be conditionally rendered`);
  }
  const applyAt = fn.indexOf('label={applyLabel}');
  assert.ok(applyAt > 0, "Apply's DraftButton is missing");
  const beforeApply = fn.slice(Math.max(0, applyAt - 160), applyAt);
  assert.doesNotMatch(beforeApply, /summary\.hasChanges\s*&&\s*!onlyPro|onlyPro\s*\?/, 'Apply must not be hidden when every change is Pro-gated — disabled + InfoTip instead');
});

test('each button disables off the field that actually means "nothing to do", not off pending alone', () => {
  const fn = body('HubDraftToolbar');
  const block = (label: string) => {
    const at = fn.indexOf(label);
    assert.ok(at > 0, `${label} not found`);
    return fn.slice(at, at + 260);
  };
  assert.match(block('label="Restore"'), /disabled=\{pending \|\| !summary\.hasChanges\}/, 'Restore: nothing to restore once the draft matches live');
  assert.match(block('label="Undo"'), /disabled=\{pending \|\| !summary\.canUndo\}/, 'Undo: only the history says whether a step back exists');
  assert.match(block('label={applyLabel}'), /disabled=\{pending \|\| !summary\.hasChanges\}/, 'Apply: nothing to apply once the draft matches live');
});

test('Apply is the one primary (filled) button of the three', () => {
  const fn = body('HubDraftToolbar');
  const restore = fn.slice(fn.indexOf('label="Restore"'), fn.indexOf('label="Undo"'));
  const undo = fn.slice(fn.indexOf('label="Undo"'), fn.indexOf('label={applyLabel}'));
  const apply = fn.slice(fn.indexOf('label={applyLabel}'), fn.indexOf('label={applyLabel}') + 260);
  assert.doesNotMatch(restore, /\bprimary\b/, 'Restore must not be the primary button');
  assert.doesNotMatch(undo, /\bprimary\b/, 'Undo must not be the primary button');
  assert.match(apply, /\bprimary\b/, 'Apply must be the primary button');
});

test('Reset stays behind the ⋯ (inside <details>), never promoted beside Restore/Undo/Apply', () => {
  const fn = body('HubDraftToolbar');
  const detailsAt = fn.indexOf('<details');
  assert.ok(detailsAt > 0, 'the ⋯ menu (<details>) is gone');
  const beforeDetails = fn.slice(0, detailsAt);
  assert.doesNotMatch(beforeDetails, /Reset\s*\{RESET_LABEL/, 'Reset must not render before the ⋯ opens');
  const afterDetails = fn.slice(detailsAt);
  assert.match(afterDetails, /Reset\s*\{RESET_LABEL\[stage\]\}/, 'Reset must still be reachable, inside the ⋯');
});

test('the rest of the Phase 2 dock survives the redesign: Pro line, store-shell line, outcome report', () => {
  const fn = body('HubDraftToolbar');
  assert.match(fn, /Apply needs Event Hub Pro/, 'the try-then-pay Pro line must still render');
  assert.match(fn, /can be applied on the web/, 'the store-shell line must still render — no price, no pay path in the shell');
  assert.match(fn, /<ResultLine result=\{result\}\s*\/>/, 'the outcome of the last action must still be reported');
  assert.match(fn, /Reset in your draft\. Guests still see the old page until you Apply\./, "Reset's own confirmation copy must still render");
});

test('the ⋯ opens by itself when an action reports back — an Apply that held keys back is never silent', () => {
  const fn = body('HubDraftToolbar');
  assert.match(fn, /const act = \(fields: Record<string, string>\) => \{\s*run\(fields\);\s*setAsking\(false\);\s*setOpen\(true\);\s*\};/);
});
