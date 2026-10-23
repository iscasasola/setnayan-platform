/**
 * GUARD — a set-once choice is a ROW, and the row opens the SHIPPED picker.
 *
 * Owner, opening his own wedding's Papic page: *"entering papic inside an event
 * needs to me simpler and better to manage. if I am a customer and I see this,
 * I will be confused."* The first thing on that screen was five large gradient
 * cards asking him to choose a look — a decision made once, months before the
 * day, occupying the space where *"what do I do"* belongs.
 *
 * 🔑 THE RULE IS HOW OFTEN YOU TOUCH THE THING:
 *   · made once      → a row showing its current answer, opening a sheet
 *   · come back to it → stays on the page (the library, ways in, credits)
 *   · we can answer it → deleted (photo quality, "where your photos go")
 *
 * 🚨 THE FAILURE THIS GUARDS IS NOT LAYOUT, IT IS DUPLICATION. The tempting
 * next edit is to reimplement the five looks inside the sheet "so the row owns
 * its own UI". That is how this codebase ends up with two copies of one
 * control, drifting — the exact shape that produced a tier title with three
 * different values in three places on this same day. `StylePicker` must be
 * RENDERED, not reproduced.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
// 📍 The look moved with the camera settings (2026-10-23): ONE component draws them on Home's Papic card and on this
// page, and the owner calls it "Filter". The rule is unchanged — one row's height, the shipped picker rendered.
const PAGE = readFileSync(join(PAPIC, '_components/papic-camera-settings.tsx'), 'utf8');
const ROW = readFileSync(join(PAPIC, '_components/setting-row.tsx'), 'utf8');

test('the row primitive still exists and still opens a sheet', () => {
  assert.ok(ROW.includes('export function SettingRow'), 'the row primitive is gone');
  assert.ok(/<Sheet\b/.test(ROW), 'the row no longer opens a sheet');
  assert.ok(/\{children\}/.test(ROW), 'the row stopped rendering its children — see the docblock');
});

test('🚨 the look is ONE ROW, not five cards on the page', () => {
  // 📍 2026-10-24: the approved one-page controller drew Filter as "A" — five small swatches across ONE thumb-width
  // row, one tap saves (`papic_controller_one_page_2026-10-23.html`). Still one row's height, never the 2×3 cards.
  assert.ok(/<StylePicker\s+variant="strip"/.test(PAGE), 'the look is not drawn as the one-row strip');
  assert.equal((PAGE.match(/<StylePicker\b/g) ?? []).length, 1, 'the picker is drawn more than once');
  assert.ok(!/<StylePicker(?![^>]*variant="strip")[^>]*\/>/.test(PAGE), 'the five tall cards are back on the page');
});

test('🚨 the strip IS the shipped picker, never a copy of it', () => {
  // The strip is a variant of `StylePicker` — the same table, the same forms, the same action.
  const picker = readFileSync(join(PAPIC, 'style-picker.tsx'), 'utf8');
  const strip = picker.slice(picker.indexOf("if (variant === 'strip')"), picker.indexOf('grid-cols-2', picker.indexOf("if (variant === 'strip')")));
  assert.ok(strip.length > 100, 'premise: the strip branch');
  assert.match(strip, /PAPIC_STYLES\.map/, 'the strip no longer draws from the style table');
  assert.match(strip, /action=\{setPapicStyle\}/, 'the strip saves through something other than the shipped action');
  for (const look of ['Retro', 'Mono', 'Cine', 'Lomo']) {
    assert.ok(
      !new RegExp(`>\\s*${look}\\s*<`).test(PAGE),
      `"${look}" is being drawn in the settings — the picker is being reproduced instead of rendered`,
    );
  }
});

test('🚨 the current answer is shown, DERIVED not re-typed', () => {
  assert.ok(
    /\{papicStyleLabel\} · every camera/.test(PAGE),
    'the line no longer says the current look — a picker without its answer read in words is worse than the card it replaced',
  );
  assert.ok(
    /PAPIC_STYLES\.find/.test(PAGE),
    'the label is no longer derived from the style table — a second copy of those five words will drift from the picker',
  );
});
