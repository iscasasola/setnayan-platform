/**
 * 📐 EVERY ONBOARDING STEP WEARS THE ONE TEMPLATE — guard (HOUSE_TEMPLATES T32, "NO GUARD — needs one").
 *
 * Owner, 10 Nov (DECISION_LOG "ONBOARDING: ONE TEMPLATE, THE EVENT NAME, AND EVERY REQUIRED PART"),
 * verbatim: *"Also noticed an inconsistent design template on the onboarding. Like the text of the names…
 * We still requested that our template design should always be followed and build according to the
 * design."* Seen live (Step 0 rows 34–35): the wedding names were a different text style and their text
 * sat against the box edge.
 *
 * A typed answer is the ONE Field template, `TypedRow boxed` (`app/_components/form-row.tsx`) — never a second
 * input (lint:field-template). The other parts live in `app/onboarding/_shared/step-field.tsx`: the labelled
 * field, the full-width dropdown, the tab-scoped rows. This guard:
 *   · pins the parts' measurements to the approved prototype (`onboarding_every_step_2026-11-10`, `.in`);
 *   · fails when a MIGRATED step draws its own `<input>` or its own heading instead of the parts. Each
 *     step is anchored by its own block, never by its file — a file-level match cannot say which step
 *     still holds a bespoke field (repo CLAUDE.md, the 2026-08-20 "sabotage landed 2→1 and stayed green").
 *
 * The list GROWS one step per slice of Lane P; a step is added the moment it is moved onto the parts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.cwd();
const read = (p: string) => readFileSync(join(web, p), 'utf8');

/** The block of `src` from `from` up to (not including) `to`. */
function block(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `anchor not found: ${from}`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > a, `end anchor not found after ${from}: ${to}`);
  return src.slice(a, b);
}

/** The steps already on the parts: file · start anchor · end anchor · how many `TypedRow boxed` it draws. */
const MIGRATED: { name: string; file: string; from: string; to: string; inputs: number }[] = [
  {
    name: 'wedding 1 · Who’s getting married? (w_names)',
    file: 'app/onboarding/wedding/_components/wedding-cards.tsx',
    from: "if (card === 'w_names') {",
    to: "if (card === 'w_kind') {",
    // one field() helper, drawn four times (two per side)
    inputs: 1,
  },
];

test('the typed answer is TypedRow boxed: 48 px, radius 12, 14 px inner padding, 16 px text — at rest and open', () => {
  const rowSrc = read('app/_components/form-row.tsx');
  const rest = block(rowSrc, 'data-form-row-boxed="line"', '</button>');
  const restBox = /<button\s+className=\{`([^`$]+)/.exec(rest)?.[1] ?? '';
  for (const cls of ['h-12', 'w-full', 'rounded-xl', 'px-[14px]', 'text-[16px]']) {
    assert.ok(restBox.split(/\s+/).includes(cls), `the resting box carries ${cls}`);
  }
  assert.match(rest, /<RowName\b/, 'its name above the box');
  const open = block(rowSrc, 'data-form-row-field="boxed"', '\n  return (');
  const openBox = /data-form-row-box=""\s+className=\{`([^`$]+)/.exec(open)?.[1] ?? '';
  for (const cls of ['h-12', 'w-full', 'rounded-xl', 'pl-[14px]']) assert.ok(openBox.split(/\s+/).includes(cls), `the open box carries ${cls}`);
  // Step 0 row 35: "two outlines and two ✕" — open, ONE ✕ (inside, it empties), never the outer leave-as-it-was ✕ too.
  assert.equal(open.match(/<ClearButton\b/g)?.length ?? 0, 1, 'one ✕, inside the box');
  assert.doesNotMatch(open, /\{x\}/, 'no second ✕ beside the box');
  assert.match(open, /onKeyDown=\{onKeys\}/, 'Enter keeps, Esc leaves it as it was — the row’s own keys');
  // The dropdown wears the same box; the label above is 14 px / 500.
  const parts = read('app/onboarding/_shared/step-field.tsx');
  const box = /export const STEP_BOX_CLASS =\s*'([^']+)'/.exec(parts)?.[1] ?? '';
  for (const cls of ['h-12', 'w-full', 'rounded-xl', 'px-[14px]', 'text-base']) {
    assert.ok(box.split(/\s+/).includes(cls), `STEP_BOX_CLASS carries ${cls}`);
  }
  assert.doesNotMatch(parts, /^\s*<input\b/m, 'no second input in the step parts — the Field template only');
  assert.match(parts, /className="flex items-center gap-1\.5 text-sm font-medium text-ink"/, 'the label above: 14 px / 500');
});

test('the setup frame’s title is the template’s on every skin — no serif italic, no light serif', () => {
  const frame = block(read('app/onboarding/_shared/setup-card.tsx'), 'export function SetupFrame(', '\ntype Props = {');
  const h1 = /<h1 className="([^"]+)" data-step-title>/.exec(frame)?.[1];
  assert.ok(h1, 'SetupFrame draws ONE static title class (data-step-title)');
  for (const cls of ['font-sans', 'text-[22px]', 'font-semibold']) assert.ok(h1!.split(/\s+/).includes(cls), `title carries ${cls}`);
  assert.doesNotMatch(frame, /font-serif/, 'no serif type in the frame');
});

for (const s of MIGRATED) {
  test(`${s.name} draws its fields with the shared parts only`, () => {
    const src = block(read(s.file), s.from, s.to);
    const raw = src.match(/<input\b/g)?.length ?? 0;
    const typed = src.match(/<TypedRow\b/g)?.length ?? 0;
    const shared = src.match(/<TypedRow\s+boxed\b/g)?.length ?? 0;
    const heads = src.match(/<h[1-6]\b/g)?.length ?? 0;
    const serif = src.match(/font-serif/g)?.length ?? 0;
    const pill = src.match(/<PickMenu\b/g)?.length ?? 0;
    console.log(`  ${s.name}: <input> ${raw} · <TypedRow boxed> ${shared}/${typed} · headings ${heads} · serif ${serif} · bare PickMenu ${pill}`);
    assert.equal(raw, 0, 'no bespoke <input> — use TypedRow boxed');
    assert.equal(shared, s.inputs, 'TypedRow boxed, as many as the step draws');
    assert.equal(typed, shared, 'every TypedRow of a step wears the boxed look');
    assert.equal(heads, 0, 'no own heading — the frame’s title is the only one');
    assert.equal(serif, 0, 'no serif type (the “&” divider and the serif title are gone)');
    assert.equal(pill, 0, 'a set of choices is StepPick (the full-width dropdown), not a bare PickMenu pill');
    assert.match(src, /<StepField\b|<TypedRow\s+boxed\b/, 'each field is labelled above');
  });
}
