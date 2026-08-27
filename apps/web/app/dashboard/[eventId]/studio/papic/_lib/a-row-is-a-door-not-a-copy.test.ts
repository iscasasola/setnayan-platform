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
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');
const ROW = readFileSync(join(PAPIC, '_components/setting-row.tsx'), 'utf8');

test('the row primitive still exists and still opens a sheet', () => {
  assert.ok(ROW.includes('export function SettingRow'), 'the row primitive is gone');
  assert.ok(/<Sheet\b/.test(ROW), 'the row no longer opens a sheet');
  assert.ok(/\{children\}/.test(ROW), 'the row stopped rendering its children — see the docblock');
});

test('🚨 the look is a ROW, not five cards on the page', () => {
  assert.ok(/<SettingRow[\s\S]{0,300}?label="Your Papic look"/.test(PAGE), 'the look is not rendered as a row');
  // The old card led with a large heading in the page body. If that shape is
  // back, five gradient cards are the first thing on the screen again.
  assert.ok(
    !/Your Papic look\s*<\/p>/.test(PAGE),
    'the look heading is back in the page body — the card returned',
  );
});

test('🚨 the sheet renders the SHIPPED picker, never a copy of it', () => {
  // ⚠ ANCHOR ON THE LABEL, NOT ON "the first SettingRow". This matched the first
  // row on the page, which was fine while the look was the only one. The
  // 2026-08-27 one-page rebuild put the capture window above it, so the guard
  // started reading the WRONG row's contents and reported the look's picker
  // missing. A guard keyed on position answers a question about position.
  const row =
    /<SettingRow(?:(?!<\/SettingRow>)[\s\S])*?label="Your Papic look"[\s\S]*?<\/SettingRow>/.exec(
      PAGE,
    )?.[0] ?? '';
  assert.ok(row, 'no SettingRow block labelled "Your Papic look" was found');
  assert.ok(
    /<StylePicker\b/.test(row),
    'the sheet no longer renders StylePicker. A reimplementation of the five looks here is a SECOND COPY of a shipped control — the failure this file exists for.',
  );
  for (const look of ['Retro', 'Mono', 'Cine', 'Lomo']) {
    assert.ok(
      !new RegExp(`>\\s*${look}\\s*<`).test(row),
      `"${look}" is being drawn inside the row — the picker is being reproduced instead of rendered`,
    );
  }
});

test('🚨 the row shows the current answer, DERIVED not re-typed', () => {
  assert.ok(
    /value=\{papicStyleLabel\}/.test(PAGE),
    'the row no longer shows the current look — a row without its answer is strictly worse than the card it replaced',
  );
  assert.ok(
    /PAPIC_STYLES\.find/.test(PAGE),
    'the label is no longer derived from the style table — a second copy of those five words will drift from the picker',
  );
});
