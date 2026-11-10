/**
 * 📐 EVERY ONBOARDING STEP WEARS THE ONE TEMPLATE — guard (HOUSE_TEMPLATES T32, "NO GUARD — needs one").
 *
 * Owner, 10 Nov (DECISION_LOG "ONBOARDING: ONE TEMPLATE, THE EVENT NAME, AND EVERY REQUIRED PART"),
 * verbatim: *"Also noticed an inconsistent design template on the onboarding. Like the text of the names…
 * We still requested that our template design should always be followed and build according to the
 * design."* Seen live (Step 0 rows 34–35): the wedding names were a different text style and their text
 * sat against the box edge.
 *
 * The parts live in ONE file (`app/onboarding/_shared/step-field.tsx`): the labelled field, the shared
 * 48 px input with its 14 px inner padding, the full-width dropdown, Enter-moves-on. This guard:
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

/** The steps already on the parts: file · start anchor · end anchor · how many shared inputs it draws. */
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

test('the shared input is the template’s: 48 px, radius 12, 14 px inner padding, 16 px text', () => {
  const parts = read('app/onboarding/_shared/step-field.tsx');
  const box = /export const STEP_BOX_CLASS =\s*'([^']+)'/.exec(parts)?.[1] ?? '';
  for (const cls of ['h-12', 'w-full', 'rounded-xl', 'px-[14px]', 'text-base']) {
    assert.ok(box.split(/\s+/).includes(cls), `STEP_BOX_CLASS carries ${cls}`);
  }
  assert.match(parts, /export const STEP_INPUT_CLASS = `\$\{STEP_BOX_CLASS\} /, 'the input wears the box');
  assert.match(parts, /className=\{`\$\{STEP_INPUT_CLASS\} \$\{className\}`\}/, 'StepInput draws the shared class');
  assert.match(parts, /onKeyDown=\{\(e\) => \{\s*onKeyDown\?\.\(e\);\s*if \(!e\.defaultPrevented\) enterMovesOn\(e\);/, 'Enter moves on');
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
    const shared = src.match(/<StepInput\b/g)?.length ?? 0;
    const heads = src.match(/<h[1-6]\b/g)?.length ?? 0;
    const serif = src.match(/font-serif/g)?.length ?? 0;
    const pill = src.match(/<PickMenu\b/g)?.length ?? 0;
    console.log(`  ${s.name}: <input> ${raw} · <StepInput> ${shared} · headings ${heads} · serif ${serif} · bare PickMenu ${pill}`);
    assert.equal(raw, 0, 'no bespoke <input> — use StepInput');
    assert.equal(shared, s.inputs, 'the shared input, as many as the step draws');
    assert.equal(heads, 0, 'no own heading — the frame’s title is the only one');
    assert.equal(serif, 0, 'no serif type (the “&” divider and the serif title are gone)');
    assert.equal(pill, 0, 'a set of choices is StepPick (the full-width dropdown), not a bare PickMenu pill');
    assert.match(src, /<StepField\b/, 'each field is labelled above');
  });
}
