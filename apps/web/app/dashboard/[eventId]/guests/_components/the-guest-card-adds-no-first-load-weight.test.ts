/**
 * the-guest-card-adds-no-first-load-weight.test.ts — THE CARD STAYS OUT OF THE MAKER'S FIRST LOAD (since 2026-10-24).
 *
 * `launch/page.tsx` imports `GuestCardBody` (each parent's own card, Details › The Invitation), so every CLIENT module the
 * card reaches is in the Event Hub Maker's first-load JavaScript, whose ceiling has ~0.1 KB of room
 * (`check-maker-js-budget.mjs`; it needs a build, so this is the cheap source-level guard). The card's autosave imports the Undo
 * store; when store and host were one file (2B) it dragged `PeekToast` and a portal along. They are two files now, and this
 * holds the line:
 *   · the files the card reaches (the list below) import NO toast drawing, no portal, no form-row template and no
 *     Guests-only pop-up;
 *   · the store is React-free and imports the toast's tone as a TYPE only;
 *   · only the pages mount the host.
 * (Growing the list means a build and a number, not a guess.)
 *
 * SABOTAGE (each seen RED, then restored): the autosave importing the host · the store importing `PeekToast` as a value · the
 * card importing the Form row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

/**
 * 🪪 2026-10-24 (owner: "the guest card on wedding march is not same with the guest card") — THE CARD LEFT THE MAKER'S FIRST
 * LOAD. The Maker no longer draws any guest's card with its page (the parents' cards were drawn there, by a hand-drawn kit
 * the first-load budget forced on them — the second-looking card the owner saw). Every in-place card is read AT THE TAP by
 * `openGuestCard` and drawn by `GuestCard`, so the templates may reach the card, and the line this file holds moved: nothing
 * of the card may come back into the Maker's page.
 */
const LAUNCH = stripComments(readFileSync(join(HERE, '..', '..', 'launch', 'page.tsx'), 'utf8'));

test('the Maker’s page draws no guest card and imports none of it — every in-place card is read at the tap', () => {
  assert.doesNotMatch(LAUNCH, /guest-card|GuestCardBody|GuestCard\b|loadGuestCard|TEMPLATE_KIT/, 'the Maker’s first load draws or reads a guest card again');
});

test('the Undo store is React-free; its only toast import is a type', () => {
  const st = read('undo-store.ts');
  assert.doesNotMatch(st, /from 'react'|from 'react-dom'|'use client'/);
  assert.match(st, /import type \{ PeekToastTone \} from '@\/app\/_components\/toast\/peek-toast';/);
  assert.doesNotMatch(st, /import \{[^}]*PeekToast[^}]*\} from/);
});

test('the autosave and the delete flow use the STORE; only the pages use the host', () => {
  assert.match(read('guest-card-autosave.tsx'), /import \{ pushUndo \} from '\.\/undo-store';/);
  assert.match(read('guest-delete.tsx'), /from '\.\/undo-store';/);
  for (const f of ['guest-card-autosave.tsx', 'card-fields.tsx', 'invited-to-chips.tsx', 'guest-card-body.tsx']) {
    assert.doesNotMatch(read(f), /from '\.\/undo-toast'/, `${f} imports the toast HOST`);
  }
  for (const page of [join('..', 'page.tsx'), join('..', '[guestId]', 'page.tsx')]) {
    assert.match(read(page), /import \{ UndoToastHost \} from '(?:\.\.\/_components|\.\/_components)\/undo-toast';/, `${page} does not mount the host`);
  }
});

test('ONE kit: the card draws its leaves with the templates, and no page can hand it another', () => {
  const body = read('guest-card-body.tsx');
  assert.match(body, /import \{ TEMPLATE_KIT \} from '\.\/guest-card-template-kit';/);
  assert.match(body, /const K: CardKit = TEMPLATE_KIT;/);
  assert.doesNotMatch(body, /\bOLD_KIT\b|\bkit\?: CardKit\b/, 'a second kit (or a door to hand one in) is back');
  assert.doesNotMatch(read('guest-card-kit.ts'), /^import\s+(?!type\b)/m, 'the kit file has a runtime import');
});
