/**
 * THE DESKTOP RAIL MUST NOT SIT ON TOP OF THE PAGE — asserted, not eyeballed.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Above `xl` the pinned bottom bar is replaced by a rail FLOATING IN THE LEFT
 * MARGIN. Every room centres its column with `mx-auto`, so the space the rail
 * has is:
 *
 *     margin = (viewport − widest column any room uses) ÷ 2
 *
 * 🚨 THE TRAP, AND I FELL IN IT WRITING THIS. My first cut put an 11rem rail at
 * `lg` (1024px). That fits beside the 48rem plate — the column MOST rooms use —
 * and sits ON TOP of the venue page and the editorial, which use the 64rem
 * stage. **The constraint is the WIDEST column, not the common one**, and the
 * common one is what you reach for when you picture the page.
 *
 * There is no local build in this repo and every production event is a wedding,
 * so this cannot be checked by looking. It is arithmetic, so it is checked as
 * arithmetic — and the numbers are read OUT OF THE COMPONENT, not re-typed
 * here, because a guard comparing two hand-typed things is not a guard.
 *
 * Run from inside this directory: `npx tsx --test ./rail-fits.test.ts`
 * 🪤 As `npx tsx --test "app/[slug]/_lib/rail-fits.test.ts"` it prints
 * "# tests 0" AND EXITS GREEN — the brackets are a glob character class.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BAR = readFileSync(resolve(HERE, '../_components/site-menu-bar.tsx'), 'utf8');

/** Tailwind's declared screens (tailwind.config.ts re-declares the defaults so
 *  a theme cannot shift them). Only the two this file reasons about. */
const SCREEN_PX = { lg: 1024, xl: 1280 } as const;
const ROOT_PX = 16;

/** The widest column any room uses — the STAGE (`max-w-5xl`). This is the
 *  number the rail must clear, and the whole point of the test. */
const WIDEST_COLUMN_REM = 64;

/**
 * The rail's `<nav>` block ONLY — every number below is read from inside it.
 *
 * 🪤 THE FIRST CUT OF THIS FILE SCANNED THE WHOLE COMPONENT and its width regex
 * matched `w-[1.375rem]` — THE CAMERA GLYPH — hundreds of lines away. So the
 * fit check was comparing an icon's size against the margin, always passed, and
 * was decoration on the one number this file exists to police. It was caught by
 * a mutation (widening the rail 7rem → 9rem stayed GREEN), not by reading it.
 * **Scope the extraction to the element you are asserting about.**
 */
function railBlock(): string {
  const m = /<nav\b[^>]*className="fixed left-0[\s\S]*?<\/nav>/.exec(BAR);
  assert.ok(m, 'could not find the rail <nav> in site-menu-bar.tsx');
  return m![0];
}

/** Read the rail's own width out of the rail block. */
function railWidthRem(): number {
  const m = /\bw-\[(\d+(?:\.\d+)?)rem\]/.exec(railBlock());
  assert.ok(m, 'could not find the rail width inside the rail <nav>');
  return Number(m![1]);
}

/** Read the rail's outer gutter (`pl-N`) — Tailwind spacing is N × 0.25rem. */
function railGutterRem(): number {
  const m = /className="fixed left-0[^"]*\bpl-(\d+)\b/.exec(BAR);
  assert.ok(m, 'could not find the rail gutter in site-menu-bar.tsx');
  return Number(m![1]) * 0.25;
}

/** Which breakpoint actually turns the rail on. */
function railBreakpoint(): 'lg' | 'xl' {
  const m = /className="fixed left-0[^"]*\b(lg|xl):block\b/.exec(BAR);
  assert.ok(m, 'could not find the rail breakpoint in site-menu-bar.tsx');
  return m![1] as 'lg' | 'xl';
}

test('the rail fits in the margin beside the WIDEST column, not the common one', () => {
  const bp = railBreakpoint();
  const marginRem = (SCREEN_PX[bp] / ROOT_PX - WIDEST_COLUMN_REM) / 2;
  const needed = railWidthRem() + railGutterRem();
  assert.ok(
    needed <= marginRem,
    `the rail needs ${needed}rem but only ${marginRem}rem of margin exists at ` +
      `${bp} (${SCREEN_PX[bp]}px) beside the ${WIDEST_COLUMN_REM}rem stage — ` +
      `it would sit ON TOP of the venue page and the editorial. Narrow the rail ` +
      `or raise the breakpoint.`,
  );
});

test('lg would NOT have fitted — the trap this test exists for', () => {
  // Pins the reason the breakpoint is xl. If someone lowers it to lg believing
  // it is "the app's usual switch", the test above fires; this one records why.
  const marginAtLg = (SCREEN_PX.lg / ROOT_PX - WIDEST_COLUMN_REM) / 2;
  assert.ok(
    railWidthRem() + railGutterRem() > marginAtLg,
    'the rail now fits at lg — if that is genuinely true, move the breakpoint ' +
      'down and delete this test rather than leaving it asserting a stale reason',
  );
});

test('the bar and its height reservation vanish at exactly the rail breakpoint', () => {
  // If they disagree, either a dead 3.5rem strip is reserved at the foot of a
  // desktop page, or the bar and the rail are both drawn at once.
  const bp = railBreakpoint();
  const hides = [...BAR.matchAll(/\b(lg|xl):hidden\b/g)].map((m) => m[1]);
  assert.ok(hides.length >= 3, `expected the spacer, the reason popover and the bar to hide; found ${hides.length}`);
  assert.deepEqual(
    [...new Set(hides)],
    [bp],
    `the bar hides at ${[...new Set(hides)].join('/')} but the rail appears at ${bp}`,
  );
});

test('the rail renders the resolved slots verbatim — it cannot invent a sixth', () => {
  // Five slots is an owner ruling. The rail maps `slots` and does no filtering,
  // slicing or concatenation of its own; the bar's centre-camera split is the
  // only layout surgery in the file and it is on the PHONE form.
  assert.ok(
    /\{slots\.map\(renderRailSlot\)\}/.test(BAR),
    'the rail no longer maps the resolved slots directly — it may now be deciding',
  );
  assert.ok(
    !/renderRailSlot[\s\S]{0,400}\.(filter|slice|concat)\(/.test(BAR),
    'the rail is filtering or reordering slots; that belongs to the resolver',
  );
});

test('the camera keeps the action colour on the rail, and gold never becomes text', () => {
  // `text-mulberry` IS the action terracotta #C24E25 (4.61:1 on cream). The slot
  // NAMED terracotta is the atelier gold #A9834B at 3.37:1 — under the 4.5 floor
  // — so it must never appear as a text colour here.
  const rail = /const renderRailSlot[\s\S]*?\n  };/.exec(BAR)?.[0] ?? '';
  assert.ok(rail.includes('text-mulberry'), 'the camera lost its action colour on the rail');
  assert.ok(
    !/text-terracotta(?!-)/.test(rail),
    'gold is being used as a text colour on the rail — it fails AA on cream',
  );
});

test('a locked slot on the rail still says why, and is not pressable', () => {
  const rail = /const renderRailSlot[\s\S]*?\n  };/.exec(BAR)?.[0] ?? '';
  assert.ok(rail.includes('aria-disabled="true"'), 'a locked rail slot is pressable');
  assert.ok(rail.includes('setOpenReason'), 'a locked rail slot cannot say why it is locked');
  assert.ok(rail.includes('<Lock'), 'a locked rail slot has no padlock');
});
