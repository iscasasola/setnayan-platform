/**
 * THE SHARED PIECES CARRY THEIR DARK AT THE SOURCE (dark-mode PR 4 "shared pieces", 2026-10-13).
 *
 * The owner approved dark mode (DECISION_LOG 2026-10-13, "approve all"): the warm set — page #17160F, card #232019
 * (`raised`), the scrim black — and every control drawn as the approved template draws it in Dark
 * (`prototypes/control_templates_round2_2026-10-12.html`: a dropdown, a field, a chip, a toast's small pill and the
 * confirm box are the card `--surf`; the QR is "ALWAYS dark on white"). PR 3 shipped the switch with an EMPTY
 * ready-list, so nobody sees dark yet; the area PRs open it screen by screen. Every area screen draws these shared
 * pieces, so they are made right ONCE, here, before any area opens.
 *
 * What the builders measured in forced dark (2026-10-12/13): the dropdown button a light-grey pill (white at 70 %),
 * the toast's "note" and its Undo / Try again white with dark-mode (light) words, its failure's words cream (dark) on
 * dark red, the build-cart peek a light slab, the switch's "off" track sunk into the card, the three shared filled
 * buttons (`.m-btn-primary`, `.m-btn-orange`, `.sn-btn-primary`) white words on fills that turn light.
 *
 * THE RULE THIS HOLDS, per source: a SOLID light fill (`bg-white`, an ink card) never stands alone — it carries the
 * `dark:` partner that paints the approved card, and its words carry theirs. Light is not touched: only `dark:` classes
 * and `html.dark` rules were added (the light proof is the PR's goldens + screenshots). `lint:contrast`'s dark pass
 * measures the pairs; this pins the partner so a refactor cannot drop it silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const css = read('app/globals.css');
const has = (cls: string, t: string) => cls.split(/\s+/).includes(t);

/** Every class string in a source: className="…", template literals and quoted constants that look like classes. */
function classStrings(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className="([^"]+)"/g)) out.push(m[1]!);
  for (const m of src.matchAll(/'([^'\n]*\b(?:bg|text|border|ring)-[^'\n]*)'/g)) out.push(m[1]!);
  for (const m of src.matchAll(/`([^`]*\b(?:bg|text|border|ring)-[^`]*)`/g)) out.push(m[1]!);
  return out;
}

/** A solid light fill in a class string, and whether a dark partner for the fill (and, on an ink card, the words) is there. */
function unpaired(cls: string): string | null {
  const t = cls.split(/\s+/);
  const solidWhite = t.some((x) => /^!?bg-white$/.test(x));
  if (solidWhite && !t.some((x) => /^dark:!?bg-/.test(x))) return 'bg-white with no dark:bg-* partner';
  if (t.some((x) => /^dark:!?bg-(white|cream)$/.test(x)) && solidWhite) return 'its dark partner is white or the page (cream) — the approved card is bg-raised';
  const inkCard = t.some((x) => /^!?bg-ink$/.test(x)) && t.some((x) => /^!?text-cream$/.test(x));
  if (inkCard && !(t.some((x) => /^dark:!?bg-/.test(x)) && t.some((x) => /^dark:!?text-/.test(x)))) return 'an ink card with cream words and no dark partners';
  return null;
}

const SOURCES = [
  'app/_components/form-row.tsx',
  'app/_components/chips.tsx',
  'app/_components/toast/peek-toast.tsx',
  'app/_components/confirm-dialog.tsx',
  'app/_components/requirements-modal.tsx',
  'app/_components/timeline-row.tsx',
  'components/print-button.tsx',
  'app/dashboard/[eventId]/website/editor/_components/pick-menu-place.ts',
  'app/dashboard/[eventId]/vendors/_components/build-cart.tsx',
];

/** Reasoned exemptions — exact class strings. */
const EXEMPT: Record<string, string> = {
  // PickMenu's picked row INSIDE the guest Event Hub only (`plain`) — dark never reaches the Hub (owner call 5).
  'bg-ink text-cream': 'the Hub-only picked row (pickOptionClass plain)',
};

test('no shared piece draws a solid light fill without its dark partner', () => {
  for (const rel of SOURCES) {
    const strings = classStrings(read(rel));
    assert.ok(strings.length > 0, `${rel}: no class strings read — the reader is blind`);
    for (const cls of strings) {
      if (EXEMPT[cls.trim()]) continue;
      const why = unpaired(cls);
      assert.equal(why, null, `${rel}: ${why}\n  in: ${cls}`);
    }
  }
});

test('the pieces wear the approved card in dark — named, so a "fix" to some other colour is seen', async () => {
  const { FORM_PILL_CLASS, FORM_PICK_CLASS } = await import('../app/_components/form-row');
  const { CHIP_OFF_CLASS } = await import('../app/_components/chips');
  const { PEEK_TOAST_TONE } = await import('../app/_components/toast/peek-toast');
  const { pickButtonClass } = await import('../app/dashboard/[eventId]/website/editor/_components/pick-menu-place');
  assert.ok(has(FORM_PILL_CLASS, 'dark:bg-raised'), 'the form-row pill is not the card in dark');
  assert.ok(has(FORM_PICK_CLASS, 'dark:!bg-raised'), 'the form-row dropdown is not the card in dark');
  assert.ok(has(CHIP_OFF_CLASS, 'dark:bg-raised'), 'a chip that is off is not the card in dark');
  for (const compact of [false, true]) {
    const b = pickButtonClass(compact);
    // The light pill is white at 70 % — over a dark page a light-grey pill. Dark: the card, with the template's hairline.
    for (const c of ['dark:bg-raised', 'dark:hover:bg-raised', 'dark:border', 'dark:border-ink/15']) assert.ok(has(b, c), `the dropdown button lost ${c}`);
  }
  assert.ok(has(PEEK_TOAST_TONE.note, 'dark:bg-raised'), 'the note toast is white in dark');
  assert.ok(has(PEEK_TOAST_TONE.bad, 'dark:text-ink'), "the failure toast's words are cream (dark) on dark red");
  const toast = read('app/_components/toast/peek-toast.tsx');
  const buttons = [...toast.matchAll(/<button\b[^>]*className="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(buttons.length >= 2);
  for (const b of buttons) assert.ok(has(b, 'dark:bg-raised'), `a toast pill is white in dark: ${b}`);
  assert.match(read('app/_components/confirm-dialog.tsx'), /data-confirm-box=""[\s\S]{0,200}dark:bg-raised/, 'the confirm box is not the card in dark');
  assert.match(read('app/_components/requirements-modal.tsx'), /bg-cream dark:bg-raised/, 'the requirements modal is not the card in dark');
});

test('globals.css: the switch, the QR plate and the shared filled buttons have their dark', () => {
  // The switch's "off": the template's dark line (ink at 28 %), at the base rule's weight so "on" still wins.
  const sw = css.match(/:where\(html\.dark\)\s+\.sn-switch\s*\{([^}]*)\}/);
  assert.ok(sw, 'the switch has no dark "off"');
  assert.match(sw![1]!, /rgb\(var\(--color-ink\)\s*\/\s*0\.28\)/, 'the dark "off" is not the template line (ink 28 %)');
  assert.ok(css.indexOf(':where(html.dark) .sn-switch') > css.indexOf('.sn-switch {'), 'the dark "off" comes before the base rule and loses');
  // The QR plate: white in dark (a scanner needs dark on white) — on every on-screen plate (`.qr-slot`).
  const qr = css.match(/html\.dark \.qr-slot\s*\{([^}]*)\}/);
  assert.ok(qr, 'the QR plate has no dark rule — a cream plate turns near-black under dark modules');
  assert.match(qr![1]!, /background-color:\s*#fff\b/, 'the QR plate is not white in dark');
  // The three shared filled buttons: dark words on the fills that turn light.
  assert.match(css, /html\.dark :is\(\.m-btn-primary, \.m-btn-orange, \.sn-btn-primary\)\s*\{\s*color:\s*rgb\(var\(--color-cream\)\)/, 'the shared filled buttons keep white words on light fills in dark');
});

test('the reader is not blind: it accuses the faults it exists for', () => {
  assert.ok(unpaired('rounded-full bg-white text-ink'));
  assert.ok(unpaired('rounded-full bg-white text-ink dark:bg-cream'));
  assert.ok(unpaired('rounded-2xl bg-ink px-3 text-cream'));
  assert.equal(unpaired('rounded-full bg-white text-ink dark:bg-raised'), null);
  assert.equal(unpaired('rounded-full bg-white/70 text-ink'), null, 'translucent white is glass — reviewed, not converted');
});
