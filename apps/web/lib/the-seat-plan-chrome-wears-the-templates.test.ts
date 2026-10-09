/**
 * the-seat-plan-chrome-wears-the-templates.test.ts — STUDIO › SEAT PLAN, CHROME ONLY (2026-10-09; `INTERACTION_RULES.md` § 9). The seat canvas, the 3D, table drag and
 * every seating rule are NOT touched; a control that assigns or moves a guest only had its button swapped for the ONE ActionButton, with the same handler.
 *
 * control → kind:
 *   Auto arrange (a waiting button while it arranges)            → Action button (brand, the filled step)
 *   the Auto arrange line + Undo                                 → Messages: toast (`PeekToast`, one Undo action; leaves by itself)
 *   Edit / Take over / Opening… (the dock, the phone head, the "Viewing only" chip) → Action button
 *   "Drop here" / Cancel / OK (the drop's confirm bubble)        → Action button (brand + neutral)
 *   Move (the move-a-guest sheet)                                → Action button (brand)
 *   Show guests their seats early (+ its ⓘ, status line, refusal) → Switch (`SwitchRow`) — LIVE write, unchanged (`publishSeating` / `unpublishSeating`)
 *   Only unseated                                                → Switch (`SwitchRow`)
 *   View ▾ (2D · 3D · List)                                      → Dropdown (already `PickMenu`)
 * NOT MOVED, and why: the ⋯ and Rules ▾ popovers (`Pop` — no shared ⋯-menu template exists to move onto; each holds the editor's own rows) · the people sheet's peek and the
 * map (canvas) · the "Unseated: N" chip, the 3D door · the editor's other tick boxes (a seat rule's own rows, inside the table logic) · the move sheet's frame (a pop-up that
 * holds the guest being moved — only its button changed).
 *
 * SAVES: `lib/the-seat-plan-chrome-posts-the-same.golden.json` is which handler each press called BEFORE (recorded from the real components in Chromium); the browser run of
 * after matched in every press. NO LAB draws the seat plan (none passes it), so there is nothing for a lab press to reach — held below.
 *
 * SABOTAGE (each seen RED, then restored): Auto arrange as a hand-made button · the old toast back · Edit as a hand-made button · the door switch as a hand-made track · the Drop
 * confirm as a hand-made button · Move calling another handler · a lab drawing the seat plan · a static import of a template into a first-load Maker file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const WEB = join(__dirname, '..');
const S = 'app/dashboard/[eventId]/seating/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const golden = JSON.parse(readFileSync(join(__dirname, 'the-seat-plan-chrome-posts-the-same.golden.json'), 'utf8')) as Record<string, unknown>;
const tags = (m: string, tag: string) => [...m.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((x) => x[0]);

async function html(el: React.ReactElement) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

test('1 · the thumb zone is the templates’: Auto arrange is the ActionButton, the Auto arrange line is the PeekToast with its Undo', async () => {
  const { StudioSeatPlanTools, PhoneSeatPlanHead } = await import(`../${S}/seat-plan-phone`);
  for (const [toast, busy] of [[{ text: 'Added 2 tables of 10 · everyone has a seat', onUndo: () => {}, onDismiss: () => {} }, false], [null, true], [{ text: 'Everyone already has a seat', onUndo: null, onDismiss: () => {} }, false]] as const) {
    const m = await html(React.createElement(StudioSeatPlanTools as never, { onAutoArrange: () => {}, autoDisabled: false, autoBusy: busy, rules: null, view: '2d', onView: () => {}, show3D: true, toast } as never));
    const auto = /data-seat-plan-auto=""[^>]*>\s*<button[^>]*>/.exec(m)?.[0] ?? '';
    assert.match(auto, /class="ab ab-brand ab-main/, 'Auto arrange is not the filled ActionButton');
    if (busy) assert.match(auto, /aria-disabled="true"/, 'a busy Auto arrange is not a waiting button');
    /* Every button is the template's, the Rules ▾ popover's trigger, or the View ▾ dropdown. */
    for (const b of tags(m, 'button')) assert.match(b, /class="ab |data-peek-toast-action|data-seat-plan-rules|aria-haspopup="listbox"/, `a hand-made button in the thumb zone: ${b.slice(0, 90)}`);
    assert.doesNotMatch(m, /data-seat-plan-toast|data-seat-plan-undo|bg-ink px-3 py-2 text-\[13px\] text-cream/, 'the old hand-made toast is drawn');
    if (toast) assert.match(m, /data-peek-toast="seat-plan"/);
    assert.equal(/data-peek-toast-action/.test(m), Boolean(toast?.onUndo), 'Undo is offered with nothing to undo — or not offered with something');
  }
  /* The shipped phone head is the same pieces. */
  const head = await html(React.createElement(PhoneSeatPlanHead as never, { countLabel: '1 table', status: 's', unseated: 0, onUnseated: () => {}, onAutoArrange: () => {}, autoDisabled: false, autoBusy: false, rules: null, more: null, view: '2d', onView: () => {}, show3D: false, toast: { text: 'x', onUndo: () => {}, onDismiss: () => {} } } as never));
  assert.match(head, /data-seat-plan-auto=""[^>]*>\s*<button[^>]*class="ab ab-brand ab-main/);
  assert.match(head, /data-peek-toast-action/);
});

test('2 · the drop’s confirm bubble and the move sheet’s Move are the ActionButton — same handlers', async () => {
  const { DropConfirmBubble } = await import(`../${S}/drop-confirm-bubble`);
  const confirm = await html(React.createElement(DropConfirmBubble as never, { state: { kind: 'confirm', x: 1, y: 1 }, onConfirm: () => {}, onCancel: () => {} } as never));
  assert.deepEqual(tags(confirm, 'button').map((b) => /class="ab ab-(brand|neutral)/.exec(b)?.[1] ?? 'HAND'), ['brand', 'neutral']);
  assert.match(confirm, /aria-label="Confirm drop"/);
  assert.match(confirm, /aria-label="Cancel drop"/);
  const reject = await html(React.createElement(DropConfirmBubble as never, { state: { kind: 'reject', x: 1, y: 1, message: 'That table is full.' }, onConfirm: () => {}, onCancel: () => {} } as never));
  assert.deepEqual(tags(reject, 'button').map((b) => /class="ab ab-(neutral)/.exec(b)?.[1] ?? 'HAND'), ['neutral']);
  const phone = read(`${S}/seat-plan-phone.tsx`);
  assert.match(phone, /<span data-seat-plan-move-go="" className="flex">\s*<ActionButton tone="brand" main waiting=\{busy\} disabled=\{value === null && !busy\} icon=\{ArrowRight\} label="Move" onClick=\{onMove\}/, 'Move is not the ActionButton with the same handler');
  /* The recorded handlers: each press called the one handler it names. */
  assert.deepEqual(golden.auto, ['autoArrange']);
  assert.deepEqual(golden.undo, ['undo']);
  assert.deepEqual(golden.dropConfirm, ['dropConfirm']);
  assert.deepEqual(golden.dropCancel, ['dropCancel']);
  assert.deepEqual(golden.rejectDismiss, ['dropCancel']);
  assert.deepEqual(golden.move, ['move']);
  assert.deepEqual((golden.busy as { calls: unknown[] }).calls, [], 'a busy Auto arrange called a handler');
  for (const k of ['disabledCalls', 'moveEmpty', 'moveBusy']) assert.deepEqual(golden[k], [], `${k}: a disabled / busy button called a handler`);
  assert.match(phone, /onClick=\{onAutoArrange\}/);
});

test('3 · the editor’s chrome: Edit / Take over are the ActionButton with `lock.acquire`; the door and Only unseated are the Form row’s switch; the live write is unchanged', () => {
  const ed = read(`${S}/seating-editor.tsx`);
  assert.equal((ed.match(/<ActionButton[^>]*onClick=\{lock\.acquire\}/g) ?? []).length, 3, 'Edit / Take over: not all three are the ActionButton with the same handler');
  assert.doesNotMatch(ed, /onClick=\{lock\.acquire\}\s+disabled=\{lock\.status === 'acquiring'\}\s+className=/, 'a hand-made Edit button is back');
  assert.match(ed, /<SwitchRow\s+name="Show guests their seats early"[\s\S]{0,1200}on=\{doorOpen\}\s+onChange=\{\(open\) => flipDoor\(open\)\}/);
  assert.match(ed, /if \(open\) await publishSeating\(fd\);\s*else await unpublishSeating\(fd\);/, 'the door’s live write changed');
  assert.doesNotMatch(ed, /aria-label="Show guests their seats early"|data-seat-plan-door-switch="" onClick/, 'a hand-made door switch is back');
  assert.match(ed, /<SwitchRow name="Only unseated" on=\{onlyUnseated\} onChange=\{setOnlyUnseated\}/);
  assert.doesNotMatch(ed, /Only unseated\s*<\/label>/, 'the Only unseated tick box is back');
});

test('4 · NO LAB draws the seat plan — a lab press cannot reach it — and FIRST LOAD: the seating chrome is lazy, no first-load Maker file imports it or the templates it wears', () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && /seating-editor|seat-plan-phone|seatPlan=|seatPlan:\s*\{/.test(readFileSync(p, 'utf8'))) found.push(p.slice(WEB.length + 1));
    }
  };
  walk(join(WEB, 'app', 'dev'));
  assert.deepEqual(found, [], `a lab draws the seat plan: ${found.join(', ')}`);
  for (const f of ['maker-details.tsx', 'maker-shell.tsx', 'details-workspace.tsx', 'details-lazy.tsx']) {
    const src = read(`app/dashboard/[eventId]/launch/_components/${f}`).replace(/^import type [^;]*;$/gm, '').replace(/import\(\/\*[^*]*\*\/ '[^']*'\)/g, '');
    assert.doesNotMatch(src, /seat-plan-phone|seating-editor|drop-confirm-bubble|from '@\/app\/_components\/toast\/peek-toast'|from '@\/components\/action-button'|from '@\/app\/_components\/form-row'/, `${f} imports the seating chrome or a template statically`);
  }
});
