/**
 * the-guest-list-says-it-with-the-approved-toast.test.ts — STEP 2B of the guest list onto the shared controls.
 *
 * THE CLAIM: nothing in the guest list says a result with the older bottom toast (`useToast`) or a strip of its own.
 * Every message is the approved toast that peeks from the TOP (`PeekToast`):
 *   · the removal's "N guests deleted — Undo" (`UndoToastHost`) is that toast with an UNDO action — the same `runUndo`,
 *     the same 6 000 ms window, and the window equals how long the toast stays (`PEEK_TOAST_ACTION_MS`);
 *   · a result that must outlive its component (a refused delete, "Could not undo") is said by the host's store
 *     (`guestToast`), not by a hook inside a sheet that has already closed;
 *   · the other call sites (capture bar, guests screen, the invite page's Regenerate QR, quick add) hold one message each
 *     through `usePeekToast`, drawn on <body>.
 * The app-wide `ToastProvider` is NOT moved — only these call sites.
 *
 * SABOTAGE (each seen RED, then restored): `useToast` put back in `capture-bar.tsx` · the Undo window changed in
 * `undo-toast.tsx` · the host's Undo no longer runs `runUndo` · the bottom `bg-ink` pill put back in `quick-add-sheet.tsx`.
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import React from 'react';
import { PEEK_TOAST_ACTION_MS } from '@/app/_components/toast/peek-toast';
import { getUndoToast, pushUndo, runUndo, dismissUndo } from './undo-toast';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const GUESTS = join(HERE, '..');
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const readGuests = (f: string) => stripComments(readFileSync(join(GUESTS, f), 'utf8'));

const SITES: Array<[string, string]> = [
  ['capture-bar.tsx', read('capture-bar.tsx')],
  ['guest-delete.tsx', read('guest-delete.tsx')],
  ['guests-screen.tsx', read('guests-screen.tsx')],
  ['quick-add-sheet.tsx', read('quick-add-sheet.tsx')],
  ['invite/_components/regenerate-qr-button.tsx', readGuests('invite/_components/regenerate-qr-button.tsx')],
];

test('no guest-list call site uses the older bottom toast', () => {
  for (const [name, src] of SITES) {
    assert.doesNotMatch(src, /\buseToast\b|toast-provider/, `${name} still uses the older app-wide toast`);
  }
});

test('the hand-made bottom pill of quick add is gone', () => {
  const q = SITES.find(([n]) => n === 'quick-add-sheet.tsx')![1];
  assert.doesNotMatch(q, /bottom-24|pointer-events-none fixed[^"]*bg-ink/, 'quick add draws a toast of its own');
  assert.match(q, /\{toastNode\}/);
  assert.match(q, /toast\.info\('Skipped — already on your list'\)/);
});

test('usePeekToast: success is the accent ✓, error the failure, info a note — drawn on <body>, one life per message', () => {
  const h = read('use-peek-toast.tsx');
  assert.match(h, /success: \(w\) => say\('ok', w\), error: \(w\) => say\('bad', w\), info: \(w\) => say\('note', w\)/);
  assert.match(h, /<PeekToast key=\{now\.n\} tone=\{now\.tone\}/);
  assert.match(h, /createPortal\([\s\S]*?body,?\s*\)/);
  assert.doesNotMatch(h, /setInterval|fetch\(|useToast|router\./);
  for (const [name, src] of SITES.filter(([n]) => n !== 'guest-delete.tsx')) {
    assert.match(src, /usePeekToast\(\)/, `${name} lost its toast`);
    assert.match(src, /\{toastNode\}/, `${name} says nothing: the message is never drawn`);
  }
});

test('every message the old toast said is still said', () => {
  const del = SITES.find(([n]) => n === 'guest-delete.tsx')![1];
  assert.equal((del.match(/guestToast\.error\(/g) ?? []).length, 4, 'a delete / undo refusal is no longer said');
  assert.match(del, /Could not undo — refresh and try again\./);
  assert.match(del, /Could not delete — check your connection and try again\./);
  assert.match(SITES.find(([n]) => n === 'guests-screen.tsx')![1], /toast\.info\('Everyone selected is already invited'\)/);
  const regen = SITES.find(([n]) => n.endsWith('regenerate-qr-button.tsx'))![1];
  assert.match(regen, /toast\.error\(plainRefusal\(result\.error, /);
  assert.match(regen, /toast\.success\('New invite QR ready\. Share the fresh link with your guests\.'\)/);
  assert.match(SITES.find(([n]) => n === 'capture-bar.tsx')![1], /toast\.error\(plainRefusal\(res\.error, /);
});

test('the removal toast: the approved toast with an Undo action — same function, same 6 s window', () => {
  const u = read('undo-toast.tsx');
  assert.match(u, /const UNDO_WINDOW_MS = 6000;/);
  assert.equal(PEEK_TOAST_ACTION_MS, 6000, 'the toast leaves before (or after) the undo window ends');
  assert.match(u, /timer = setTimeout\(\(\) => \{[\s\S]{0,400}state: 'expired'[\s\S]{0,40}\}, UNDO_WINDOW_MS\);/, 'the window no longer closes at 6 s');
  assert.match(u, /<PeekToast[\s\S]{0,200}action=\{\{ label: toast\.state === 'undoing' \? 'Undoing…' : 'Undo', onPress: runUndo \}\}/, 'Undo does not run runUndo');
  assert.match(u, /await t\.undo\(\);/);
  assert.doesNotMatch(u, /bottom-\[max\(env|gl-toast|text-terracotta/, 'the bottom snackbar is back');
  assert.match(u, /export function UndoToastHost\(\)/);
  assert.match(u, /export function pushUndo\(/);
  assert.match(u, /export function dismissUndo\(/);
  /* A newer message replaces an old one, and an undo that finishes late never clears a newer toast. */
  assert.match(u, /if \(current\?\.id === t\.id\) set\(null\);/);
});

test('the older provider is untouched: it is still the app-wide toast', () => {
  const p = readFileSync(join(HERE, '..', '..', '..', '..', '_components', 'toast', 'toast-provider.tsx'), 'utf8');
  assert.match(p, /export function useToast/);
});

test('the Undo toast LEAVES like every other toast: the window closes at 6 s, the toast is not torn down', async () => {
  const u = read('undo-toast.tsx');
  /* The host clears an undo toast only when the toast itself has finished leaving. */
  assert.match(u, /action=\{\{[^}]*onPress: runUndo \}\}\s*onGone=\{\(\) => \{\s*if \(current\?\.kind === 'undo' && current\.id === toast\.id\) set\(null\);/, 'the undo toast is never cleared by its own leaving');
  assert.doesNotMatch(u, /if \(current\?\.id === id\) set\(null\);\s*\}, UNDO_WINDOW_MS/, 'the window tears the toast down at 6.0 s');
  /* Behaviour: pressed at 5.9 s it runs; at 6 s it is EXPIRED but still there; Undo then does nothing. */
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let undone = 0;
    pushUndo({ label: '2 guests deleted', undo: async () => void undone++ });
    mock.timers.tick(5999);
    const now = () => {
      const x = getUndoToast();
      return x && x.kind === 'undo' ? x.state : null;
    };
    assert.equal(now(), 'idle', 'the window closed early');
    mock.timers.tick(1);
    const t = getUndoToast();
    assert.ok(t, 'the toast vanished at 6.0 s');
    assert.equal(now(), 'expired', 'the window did not close');
    await runUndo();
    assert.equal(undone, 0, 'Undo ran after its window closed');
    dismissUndo();
    assert.equal(getUndoToast(), null);
    pushUndo({ label: 'x', undo: async () => void undone++ });
    await runUndo();
    assert.equal(undone, 1, 'Undo inside the window does not run');
  } finally {
    mock.timers.reset();
    dismissUndo();
  }
});
