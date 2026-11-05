/**
 * 🏠 THE NFC SHEET IS A HOUSE SHEET — owner 2026-10-25, on two phone screenshots of the guest card's "Write to NFC"
 * sheet: "the NFC write does not follow our design templates". It had a monospace eyebrow strip, a monospace link
 * box, and bare bordered text buttons that wrapped in a row with no main verb.
 *
 * Held here, on the file's source (the sheet needs a radio to open, so no browser test can reach it):
 *   · it opens in the shared `Sheet`, WITHOUT the `title` strip (that strip is the mono eyebrow);
 *   · every button in the sheet is an `ActionButton` — no raw `<button>` remains below the trigger;
 *   · no monospace anywhere (`font-mono`, `<code>`);
 *   · every outcome is the house `StatusLine`, and each outcome state has exactly ONE `main` verb.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, 'nfc-write-button.tsx'), 'utf8');
/** The sheet half: from the `<Sheet open=` mount to the Web NFC writers. */
const SHEET = SRC.slice(SRC.indexOf('<Sheet open='), SRC.indexOf('// ── Web NFC'));

/** One state's block inside NfcSheetBody, by its `state.kind === '<kind>'` opener. */
function block(kind: string): string {
  const at = SHEET.indexOf(`state.kind === '${kind}' ? (`);
  assert.ok(at > 0, `the sheet draws the '${kind}' state`);
  const next = SHEET.indexOf('{state.kind === ', at + 1);
  return SHEET.slice(at, next > 0 ? next : SHEET.indexOf('function SheetTitle'));
}

test('the sheet is the shared Sheet, without the mono title strip', () => {
  assert.match(SRC, /import \{ Sheet \} from '@\/app\/_components\/sheet'/);
  const mount = SHEET.slice(0, SHEET.indexOf('>'));
  assert.doesNotMatch(mount, /\btitle=/, 'Sheet `title` draws the monospace eyebrow strip — the heading is the house title instead');
});

test('no monospace anywhere in the NFC sheet', () => {
  assert.doesNotMatch(SRC, /font-mono/);
  assert.doesNotMatch(SRC, /<code\b/);
});

test('every control in the sheet is an ActionButton', () => {
  assert.match(SRC, /import \{ ActionButton, useFitRow \} from '@\/components\/action-button'/);
  assert.equal((SHEET.match(/<button\b/g) ?? []).length, 0, 'a raw <button> in the NFC sheet');
  assert.ok((SHEET.match(/<ActionButton\b/g) ?? []).length >= 8);
});

test('each outcome is a StatusLine with one main verb', () => {
  const want: Record<string, { tone: string; mains: number }> = {
    written: { tone: 'info', mains: 1 },
    unconfirmed: { tone: 'warn', mains: 1 },
    failed: { tone: 'bad', mains: 1 },
  };
  for (const [kind, { tone, mains }] of Object.entries(want)) {
    const b = block(kind);
    assert.match(b, new RegExp(`<StatusLine tone="${tone}"`), `${kind} uses the house status line`);
    assert.equal((b.match(/<ActionButton[^>]*\bmain\b/g) ?? []).length, mains, `${kind}: one main verb`);
  }
  assert.match(block('written'), /<ActionButton tone="brand" main icon=\{Nfc\} label="Write another"/);
  assert.match(block('unconfirmed'), /<ActionButton tone="brand" main icon=\{ScanLine\} label="Check tag"/);
});
