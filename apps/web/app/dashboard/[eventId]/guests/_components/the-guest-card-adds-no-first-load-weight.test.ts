/**
 * the-guest-card-adds-no-first-load-weight.test.ts — THE CARD IS IN THE MAKER'S FIRST LOAD; KEEP IT LIGHT.
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

/** What the card (a server file) pulls into the Maker's first load, as far as the guests folder is concerned. */
const FIRST_LOAD = ['guest-card-body.tsx', 'guest-card-autosave.tsx', 'card-fields.tsx', 'invited-to-chips.tsx', 'guest-access-control.tsx', 'undo-store.ts', 'guest-card-kit.ts'] as const;
const HEAVY = /form-row|toast\/peek-toast|guest-card-rows|guest-card-template-kit|_components\/chips|_components\/fold|switch-track|guest-popup|undo-toast'|use-peek-toast|guest-actions-context|guest-delete|add-guest-sheet|quick-add-sheet|overlay-primitives|\/sheet'/;

test('the card’s first-load files import no toast, portal, template or pop-up (value imports)', () => {
  for (const f of FIRST_LOAD) {
    const src = read(f);
    const bad = [...src.matchAll(/^import\s+(?!type\b)[^;]*from\s+'([^']+)';/gms)].map((m) => m[1]!).filter((p) => HEAVY.test(`${p}'`) || HEAVY.test(p));
    assert.deepEqual(bad, [], `${f} pulls ${bad.join(', ')} into the Maker's first load`);
    assert.doesNotMatch(src, /createPortal/, `${f} draws a portal`); // `useFormStatus` from react-dom is the autosave's own and already shipped
  }
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

test('the templates reach the card ONLY through the kit the Guests pages hand in — never the Maker (4B, measured 505.7 of 507.0 KB)', () => {
  /* The card takes the kit as a prop and falls back to its own hand-drawn leaves; the kit file is TYPES only. */
  const body = read('guest-card-body.tsx');
  assert.match(body, /import type \{[^}]*\bCardKit\b[^}]*\} from '\.\/guest-card-kit';/);
  assert.match(body, /const K: CardKit = kit \?\? OLD_KIT;/);
  assert.doesNotMatch(read('guest-card-kit.ts'), /^import\s+(?!type\b)/m, 'the kit file has a runtime import');
  /* The pages that draw the card for the host hand the kit in; the Maker's launch page does not. */
  for (const page of [join('..', 'page.tsx'), join('..', '[guestId]', 'page.tsx')]) {
    assert.match(read(page), /import \{ TEMPLATE_KIT \} from '(?:\.\/|\.\.\/)_components\/guest-card-template-kit';/, `${page} does not import the kit`);
    assert.match(read(page), /\bkit=\{TEMPLATE_KIT\}/, `${page} does not hand the kit in`);
  }
  const launch = readFileSync(join(HERE, '..', '..', 'launch', 'page.tsx'), 'utf8');
  assert.doesNotMatch(launch, /guest-card-template-kit|guest-card-rows|TEMPLATE_KIT|\bkit=\{/, 'the Maker’s first load imports the templates through the card');
});
