/**
 * the-editor-bar-has-one-main-button.test.ts — ✓ ONE MAIN BUTTON, WITH A WORD, READABLE LIGHT AND DARK.
 *
 * Owner walk 2026-11-27 (MASTER-PLAN B7), the Hub Maker `/launch`:
 *   · "an orange Done sits next to a grey ✓ with no name" — while an editor is risen its head is its name and ✓ Done
 *     (the house main button), and the draft's icon-only ✓ Apply stood beside it. It steps aside now, on every width,
 *     while the head is up — as it already did for an expanded editor on a phone.
 *   · "the mustard pill is unreadable" — the setup's "N left" pill wrote `text-terracotta-800`, a FIXED dark brown,
 *     on the accent's tint: dark on dark in dark mode. Its words are the page's paired ink now.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');

test('while an editor’s head (✓ Done) is up, the bar’s icon-only ✓ Apply steps aside — on every width', () => {
  const shell = read('maker-shell.tsx');
  assert.match(shell, /data-maker-editor-up=\{studioOn && studioTile && !printsPage \? '' : undefined\}/, 'the shell no longer says when an editor’s head is up');
  const rule = /'\[data-maker-editor-up\] \[data-maker-toolbar\]>\[data-maker-apply-slot\]\{display:none\}'/.exec(shell);
  assert.ok(rule, 'Apply’s ✓ still stands beside Done');
  // Not inside a width query: a tablet (820) and a desktop draw the head too.
  const before = shell.slice(0, rule!.index);
  assert.ok(!/@media[^']*$/.test(before.slice(before.lastIndexOf("'"))), 'the rule is limited to one width');
  // The head it steps aside for is the house main button, with its word.
  const parts = read('stages-studio-parts.tsx');
  assert.match(parts, /<ActionButton tone="brand" main icon=\{Check\} label="Done"/, 'the editor’s Done is no longer the main button with a word');
  // …and it is drawn for exactly the same editor the shell marks (`editor` = studioOn && studioTile).
  assert.match(shell, /editor=\{studioOn && studioTile \? \{/, 'the head and the mark no longer read the same condition');
});

test('the setup’s "N left" pill is readable in light AND dark — no fixed dark brown on the accent’s tint', () => {
  const src = read('details-workspace.tsx');
  const at = src.indexOf('data-details-guide-progress=""');
  assert.ok(at > 0, 'anti-vacuity: the progress pill moved');
  const cls = /className="([^"]*)"/.exec(src.slice(at, at + 1200))?.[1]?.split(/\s+/) ?? [];
  assert.ok(cls.includes('text-ink'), `the pill’s words are not the paired page ink (${cls.join(' ')})`);
  assert.ok(!cls.some((c) => /^text-terracotta-(?:8|9)00$/.test(c)), 'a fixed dark brown is back on the pill — dark on dark in dark mode');
});
