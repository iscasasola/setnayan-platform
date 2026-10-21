/**
 * GUARD — THE FIRST PHOTO IS ONE ROW THAT FITS ITS CARD (owner 2026-10-21: "i noticed some misalignment where they
 * upload their first profile photo. on that page. can you show me that step"; then, on the prototype: "make it
 * follow our design template and rules. make each step simple and easy to understand as well").
 *
 * MEASURED before (prototype first_run_you_and_next_steps_2026-10-21 §1, and /dev/you-lab): the You card put the
 * upload widget in a 96 px column, but its round slot was a FIXED 160 px circle and its picture 132 — both spilled
 * 64 / 36 px over the Display name beside it; the name box shrank to 167 px and cut its own placeholder; and the
 * circle told a person "Add your logo".
 *
 * The properties held here (each sabotaged RED, then restored — see the PR body):
 *   1. NEVER WIDER THAN ITS COLUMN: every round footprint the widget draws is either capped by its column
 *      (`max-w-full` + `aspect-square`, never a fixed height that would make an oval) or is the photo row's 72 px
 *      circle, beside words that wrap (`min-w-0`).
 *   2. THE PHOTO ROW IS THE WHOLE WIDGET: in `row` form nothing else is drawn — no formats line under, no help
 *      line, no filename rows — and the circle is the one thing pressed (a <label> for the file input).
 *   3. EACH STATE SAYS WHAT IS TRUE, in the drawn words: empty "<help> · PNG, JPG or WEBP · up to 2 MB"; chosen
 *      "Not saved yet — press Done below" + Remove; uploading the ring + "Uploading · N% · size" + Cancel; refused
 *      "Tap the circle to try another file"; saved "Saved" + Remove.
 *   4. A PERSON'S PHOTO NEVER SAYS "logo": every profile-photo upload is the row ("Your photo") or names its own
 *      slot ("Add a photo"); the shop logo keeps "Add your logo".
 *   5. The You card draws the photo row and then the Display name at full width — no fixed-width wrapper.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { FileUpload } from '@/app/_components/file-upload';

(globalThis as unknown as { React: unknown }).React = React;

const UPLOAD = stripComments(readFileSync('app/_components/file-upload.tsx', 'utf8'));
const CARD = stripComments(readFileSync('app/signup/you/_components/you-card.tsx', 'utf8'));

const draw = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    React.createElement(FileUpload, {
      bucket: 'media',
      pathPrefix: 'profile-photo/u',
      name: 'profile_photo_url',
      unsavedHint: 'press Done below',
      maxSizeMB: 2,
      acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
      variant: 'square',
      roundPreview: true,
      help: 'Optional',
      ...extra,
    } as never),
  );

/** Every class list in the markup that draws a circle (`rounded-full`) with a fixed pixel or spacing width. */
function circles(html: string): string[] {
  return [...html.matchAll(/class="([^"]*\brounded-full\b[^"]*)"/g)].map((m) => m[1]!).filter((c) => /(?:^|\s)w-(?:\[\d+px\]|\d+)(?:\s|$)/.test(c));
}

test('1 · no round footprint is wider than its column', () => {
  for (const [label, html] of [
    ['the shop-logo slot', draw({ pathPrefix: 'vendors/x/logo', name: 'logo_url', unsavedHint: 'x', help: undefined })],
    ['the photo row', draw({ row: { title: 'Your photo' } })],
  ] as const) {
    const cs = circles(html);
    assert.ok(cs.length > 0, `${label}: no circle drawn — the scan no longer sees it`);
    for (const c of cs) {
      const w = Number(/(?:^|\s)w-\[(\d+)px\]/.exec(c)?.[1] ?? Number(/(?:^|\s)w-(\d+)(?:\s|$)/.exec(c)?.[1]) * 4);
      const capped = /(?:^|\s)max-w-full(?:\s|$)/.test(c) && /aspect-square/.test(c) && !/(?:^|\s)h-\[\d+px\]/.test(c);
      assert.ok(capped || (w <= 72 && /flex-none/.test(c)), `${label}: a ${w} px circle that can spill out of a narrower column — "${c}"`);
    }
  }
  // The finished-picture circle under a full slot is capped the same way (it only draws once seeded, so: source).
  const pic = /className="flex aspect-square w-\[132px\] max-w-full[^"]*rounded-full/.test(UPLOAD);
  assert.ok(pic, 'the 132 px picture is not capped by its column');
  // The row's words can always wrap beside the 72 px circle.
  assert.match(draw({ row: { title: 'Your photo' } }), /<div class="grid min-w-0 gap-\[3px\]">/);
});

test('2 · in row form the row is the whole widget, and the circle is the press', () => {
  const html = draw({ row: { title: 'Your photo' } });
  assert.equal((html.match(/data-upload-row=/g) || []).length, 1);
  assert.doesNotMatch(html, /PNG · JPEG · WEBP/i, 'the caps formats line under the slot is drawn as well');
  assert.doesNotMatch(html, /<p class="block text-xs text-ink\/55">Optional<\/p>/, 'the help is drawn twice (under the row too)');
  assert.doesNotMatch(html, /min-h-\[160px\]|h-\[160px\]|w-\[160px\]/, 'the 160 px slot is drawn beside the row');
  const circle = /<label\b[^>]*for="([^"]+)"[^>]*class="([^"]*h-\[72px\] w-\[72px\][^"]*)"/.exec(html);
  assert.ok(circle, 'the 72 px circle is not a press for the file input');
  assert.match(html, new RegExp(`<input[^>]*id="${circle[1]!.replace(/[:]/g, '\\:')}"[^>]*type="file"|<input[^>]*type="file"[^>]*id="${circle[1]!.replace(/[:]/g, '\\:')}"`));
});

test('3 · each state says what is true, in the drawn words', () => {
  const empty = draw({ row: { title: 'Your photo' } });
  assert.match(empty, /Your photo/);
  assert.match(empty, /Optional · PNG, JPG or WEBP · up to 2 MB/);
  // The other four are reached by a pick / an upload, so they are read from the row's source.
  const rowSrc = UPLOAD.slice(UPLOAD.indexOf('const photoRow = rowMode ?'), UPLOAD.indexOf('const photoRow = rowMode ?') + 6000);
  assert.match(rowSrc, /Tap the circle to try another file/, 'refused');
  assert.match(rowSrc, /Uploading · \{flying!\.progress\}% · \{bytesToHuman\(flying!\.size\)\}/, 'uploading');
  assert.match(rowSrc, /cancelInFlight\(flying!\.id\)[\s\S]{0,120}Cancel/, 'uploading has Cancel');
  assert.match(rowSrc, /conic-gradient\(#C24E25 \$\{flying!\.progress\}%/, 'the circle is the progress ring');
  assert.match(rowSrc, /Not saved yet — \{unsavedTail\(unsavedHint\)\}/, 'chosen');
  assert.match(rowSrc, />Saved</, 'saved');
  assert.match(rowSrc, /removeItem\(first!\.id\)[\s\S]{0,120}Remove/, 'Remove');
  assert.doesNotMatch(rowSrc, /truncate/, 'a status line in the row is cut off instead of wrapping');
});

test('4 · a person’s photo never says "logo"; the shop logo still does', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) {
        if (n !== 'node_modules' && n !== '.next') walk(p);
      } else if (p.endsWith('.tsx')) files.push(p);
    }
  };
  walk('app');
  let seen = 0;
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/<FileUpload\b[\s\S]*?\/>/g)) {
      if (!/pathPrefix=\{`profile-photo\//.test(m[0])) continue;
      seen += 1;
      // Either the photo row ("Your photo") or the full slot with its own words — never the logo default.
      const says = /slotSays="([^"]*)"/.exec(m[0])?.[1];
      assert.ok(/row=\{\{[\s\S]*?title: 'Your photo'/.test(m[0]) || (says !== undefined && !/logo/i.test(says)), `${f}: a person's photo says "Add your logo"`);
    }
  }
  assert.ok(seen >= 2, `only ${seen} profile-photo uploads found — the scan no longer sees the You card and the profile`);
  assert.doesNotMatch(draw({ row: { title: 'Your photo' } }), /logo/i);
  assert.match(draw({ pathPrefix: 'vendors/x/logo', name: 'logo_url', unsavedHint: 'x' }), /Add your logo/, 'the shop logo lost its words');
});

test('5 · the You card: the photo row, then the Display name at full width', () => {
  const fu = /<FileUpload\b[\s\S]*?\n\s{12}\/>/.exec(CARD)?.[0] ?? '';
  assert.ok(fu, 'the You card has no photo upload');
  assert.match(fu, /row=\{\{/, 'the You card photo is not the row');
  const after = CARD.slice(CARD.indexOf(fu) + fu.length, CARD.indexOf(fu) + fu.length + 300);
  assert.match(after, /^\s*<div className="hr-si-field">\s*<label htmlFor="hr-you-name"/, 'the Display name is not the full-width field right under the row');
  assert.doesNotMatch(CARD, /width:\s*96|display: 'flex', alignItems: 'center', gap: 14/, 'the 96 px side-by-side is back');
});
