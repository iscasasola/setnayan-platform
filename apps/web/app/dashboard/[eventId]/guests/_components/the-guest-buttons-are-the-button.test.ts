/**
 * the-guest-buttons-are-the-button.test.ts — STEP 2A of bringing the guest list onto the approved shared controls
 * (owner 2026-10-09 via the controller; `components/action-button.tsx` is THE BUTTON).
 *
 * THE CLAIM: in the six live guest files that draw action buttons, no `<button>` wears its own fill or accent
 * (`bg-ink` · `bg-mulberry` · `bg-terracotta-*` · `button-primary` · `button-secondary` · `border-mulberry` ·
 * `text-mulberry`), the forward step of each is an `ActionButton` with the tone the rule gives it, and the three
 * native `<select>`s of the quick-add sheet are the app's `PickMenu`.
 *
 * Bare `<button>`s that carry NO colour of their own stay legal on purpose — a scrim, a list row, a menu item, a
 * disclosure — they are not "hand-coloured buttons".
 *
 * The scanner reads each opening tag to its real end (an arrow `=>` inside `onClick={…}` does not end it), and is run
 * over fixtures first so a scanner that catches nothing cannot pass.
 *
 * SABOTAGE (each seen RED, then restored): a `bg-ink` fill put back on a `send-invite.tsx` button · the Invite
 * button turned back into a bare `<button>` · a native `<select>` put back in `quick-add-sheet.tsx` · the "Save
 * ticket" link losing `actionButtonClass`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

/** The opening tags of every `<button …>` in a source, each read to its closing `>` (braces and quotes respected). */
export function buttonOpeningTags(source: string): string[] {
  const out: string[] = [];
  const re = /<button(?=[\s>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let i = m.index + 7;
    let depth = 0;
    let quote: string | null = null;
    for (; i < source.length; i++) {
      const c = source[i];
      if (quote) {
        if (c === quote && source[i - 1] !== '\\') quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(source.slice(m.index, i + 1));
  }
  return out;
}

/* A utility on the button itself — not `hover:bg-ink/5` (a variant), not a part of another word. */
const OWN_COLOUR = /(?<![:\w-])(bg-ink|bg-mulberry|bg-terracotta[\w-]*|button-primary|button-secondary|border-mulberry|text-mulberry)(?![\w-])/;
/* A scrim is the whole-screen dismiss layer under a pop-up — the pop-up rule's business (step 2C), not a button. */
const SCRIM = /\babsolute inset-0\b/;

export function handColouredButtons(source: string): string[] {
  return buttonOpeningTags(source).filter((t) => OWN_COLOUR.test(t) && !SCRIM.test(t));
}

test('the scanner catches a hand-coloured button and passes a quiet one (fixtures)', () => {
  assert.equal(handColouredButtons('<button type="button" onClick={() => go()} className="rounded-full bg-ink px-4">x</button>').length, 1);
  assert.equal(handColouredButtons('<button className={`a ${on ? "bg-mulberry" : ""}`}>x</button>').length, 1);
  assert.equal(handColouredButtons('<button type="button" className="button-primary">x</button>').length, 1);
  assert.equal(handColouredButtons('<button type="button" onClick={() => a >= 1} className="hover:bg-ink/5">x</button>').length, 0);
  assert.equal(handColouredButtons('<button aria-label="Close" className="absolute inset-0 bg-ink/50">x</button>').length, 0, 'a scrim is not a button');
  assert.equal(buttonOpeningTags('<button onClick={() => x}>a</button><button>b</button>').length, 2);
});

const FILES = [
  'send-invite.tsx',
  'guest-invite-cell.tsx',
  'guest-ticket-parts.tsx',
  'add-guest-sheet.tsx',
  'quick-add-sheet.tsx',
  'add-from-people-sheet.tsx',
] as const;

test('no button in the six live guest files wears its own fill or accent', () => {
  for (const f of FILES) {
    const bad = handColouredButtons(read(f));
    assert.deepEqual(bad, [], `${f}: a button wears its own colour — use ActionButton with a tone:\n${bad.join('\n')}`);
  }
});

test('every one of the six draws its buttons through the shared pieces', () => {
  for (const f of FILES) {
    assert.match(read(f), /from '@\/components\/action-button'/, `${f} no longer imports the shared button`);
  }
});

/** The ActionButton element whose label matches, read to its end, so a tone is asserted on THAT button. */
function actionButtonWith(source: string, label: RegExp): string | null {
  const re = /<ActionButton\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let i = m.index + 13;
    let depth = 0;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '/' && source[i + 1] === '>' && depth === 0) break;
    }
    const el = source.slice(m.index, i + 2);
    if (label.test(el)) return el;
  }
  return null;
}

test('the forward step of each is the filled brand button; Copy, Cancel and the rest are neutral', () => {
  const forward: Array<[string, RegExp]> = [
    ['send-invite.tsx', /label=\{big \? `Send to/],
    ['send-invite.tsx', /label=\{pending \? 'Saving…' : 'Mark as sent'\}/],
    ['send-invite.tsx', /label=\{pending \? 'Saving…' : 'Save for every guest'\}/],
    ['guest-invite-cell.tsx', /label="Invite"/],
    ['add-guest-sheet.tsx', /label=\{label\}\s*onClick=\{\(\) => window\.dispatchEvent\(new CustomEvent\(OPEN_EVENT\)\)\}\s*\/>/],
    ['quick-add-sheet.tsx', /label=\{isPending \? 'Adding…' : 'Done'\}/],
    ['quick-add-sheet.tsx', /label=\{isGroupPending \? 'Creating…' : 'Create'\}/],
    ['add-from-people-sheet.tsx', /'Add guest'/],
  ];
  for (const [f, label] of forward) {
    const el = actionButtonWith(read(f), label);
    assert.ok(el, `${f}: the forward button ${label} is not an ActionButton`);
    assert.match(el!, /tone="brand"/, `${f}: ${label} is not the brand tone`);
    assert.match(el!, /\bmain\b/, `${f}: ${label} is not the filled main button`);
  }
  const cancel = actionButtonWith(read('guest-ticket-parts.tsx'), /label="Cancel"/);
  assert.ok(cancel && /tone="neutral"/.test(cancel), 'guest-ticket-parts.tsx: Cancel is not the neutral button');
  const copy = actionButtonWith(read('send-invite.tsx'), /'Copy message'/);
  assert.ok(copy && /tone="neutral"/.test(copy), 'send-invite.tsx: Copy message is not the neutral button');
});

test('a button that cannot be used yet is WAITING, still a button (Add guest with nobody picked)', () => {
  const el = actionButtonWith(read('add-from-people-sheet.tsx'), /'Add guest'/);
  assert.ok(el && /waiting=\{pickedKeys\.length === 0 && !pending\}/.test(el), 'Add guest with nobody picked is not "waiting"');
  const sub = read('add-from-people-sheet.tsx');
  assert.match(sub, /if \(pickedKeys\.length === 0 \|\| pending\) return;/, 'the submit lost its own empty-pick guard');
});

test('the file-save link and the submit button wear the shared button class, not a colour of their own', () => {
  const ticket = read('guest-ticket-parts.tsx');
  assert.match(ticket, /<SaveFileLink[\s\S]{0,260}actionButtonClass\('brand', \{ main: true/, 'Save ticket lost the shared button class');
  assert.match(ticket, /<SubmitButton[\s\S]{0,120}actionButtonClass\('brand', \{ main: true/, 'the New QR / Unlink confirm lost the shared button class');
  assert.match(read('send-invite.tsx'), /<SaveFileLink[\s\S]{0,300}actionButtonClass\('neutral'\)/, 'Download ticket lost the shared button class');
});

test('a row\'s Invite is NAMED for its guest (and the day it went) — the word is "Invite", the name is more', () => {
  const el = actionButtonWith(read('guest-invite-cell.tsx'), /label="Invite"/);
  assert.ok(el, 'the Invite button is gone');
  assert.match(el!, /name=\{sentAt \? `Invite \$\{guest\.fullName\} — sent \$\{sentDay\}` : `Invite \$\{guest\.fullName\}`\}/, 'Invite is not named for its guest');
});

test('the ⋯ opener is the neutral icon button and keeps its name, menu and open state', () => {
  const el = actionButtonWith(read('guest-ticket-parts.tsx'), /More for \$\{guestName\}/);
  assert.ok(el, 'the ⋯ is not an ActionButton');
  assert.match(el!, /tone="neutral"/);
  assert.match(el!, /iconOnly/);
  assert.match(el!, /aria-haspopup="menu"/);
  assert.match(el!, /aria-expanded=\{open\}/);
});

test('quick add: Side · Role · Group are the PickMenu dropdown — no native <select> is left', () => {
  const q = read('quick-add-sheet.tsx');
  assert.doesNotMatch(q, /<select\b/, 'a native <select> is back in the quick-add sheet');
  for (const label of ['Side', 'Role', 'Group']) {
    assert.match(q, new RegExp(`<PickMenu\\s+label="${label}"`), `${label} is not a PickMenu`);
  }
  // The same values: the sheet's three states are still what the pick writes.
  assert.match(q, /onPick=\{\(key\) => setSide\(key as GuestSide\)\}/);
  assert.match(q, /onPick=\{\(key\) => setRole\(key as GuestRole\)\}/);
  assert.match(q, /\{ key: '__new__', label: '＋ New group…' \}/);
  assert.match(q, /\{ key: '', label: 'No group' \}/);
});
