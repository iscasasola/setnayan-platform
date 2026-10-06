/**
 * the-rsvp-row-opens-its-editor.test.ts — THE MAKER'S RSVP ROW IS A CONTROL,
 * AND PICKING IT SHOWS THE RSVP EDITOR.
 *
 * Why it exists: `app_fault_issues` holds ONE DEAD_TAP on
 * "/dashboard/[id]/launch · RSVPQuestions · who can reply · reply by" — the
 * RSVP row of Maker › Event Details — last seen on build 5666406 (2026-10-02),
 * before the phone rebuild (#6297, frames G/I). The audit
 * (corpus `INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md` § B2) asked: does
 * that tap reach the RSVP editor TODAY?
 *
 * Traced from the code (2026-10-04), it does:
 *   · the row is built from `wordsAndPlansItem('rsvp', …)` (label "RSVP", sub
 *     "Questions · who can reply · reply by") and is present whenever the launch
 *     page hands `rsvp={rsvpItem}` to `MakerDetails`;
 *   · DESK — the navigator draws it as `<button data-details-nav-item="rsvp">`
 *     whose tap is `select(i.key)`;
 *   · PHONE — the strip is `max-lg:hidden`; every row is a `menuitemradio` in
 *     the editor sheet's ONE dropdown (`SheetSections`), whose tap is
 *     `onPick(i.key)`, and the workspace passes `onPick={select}`;
 *   · `select` sets the picked item; the picked item's editor is the one not
 *     `hidden` (`data-details-editor="rsvp"`), and the RSVP item's editor is
 *     `rsvp.settings` = `<MakerRsvpSettings …>` (lazy, `maker-rsvp-ask.tsx`).
 * The old DEAD_TAP's most likely cause was a re-tap of the row already picked
 * on the old phone strip (`select` of the current item changes nothing, so the
 * observer saw no answer) — that strip no longer exists on a phone.
 *
 * So this file holds the chain, end to end, half RENDERED and half read from
 * source (there is no DOM in the unit suite to fire a tap): if any link breaks
 * — the row stops being a button, a tap stops reaching `select`, the editor
 * stops following the pick, or the RSVP editor stops being `MakerRsvpSettings`
 * — it goes red.
 *
 * 🪤 `globalThis.React` is set BEFORE the dynamic imports (classic JSX runtime
 * under tsx; precedent `hub-stage-renders.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { wordsAndPlansItem, type DetailsItemKey } from '@/lib/maker-details-items';

(globalThis as unknown as { React: unknown }).React = React;

const read = (f: string) => stripComments(readFileSync(join(__dirname, f), 'utf8'));
const LAUNCH_PAGE = stripComments(readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8'));

/* The RSVP row exactly as `MakerDetails` builds it (ONE builder: `wordsAndPlansItem`). */
const NONE = { specialMessage: false, thankYou: false, openingLine: false, rsvp: false, loveStory: false, schedule: false };
const rsvpRow = wordsAndPlansItem('rsvp', {
  specialMessage: null,
  thankYou: null,
  openingLine: null,
  kindlyReply: false,
  include: NONE,
  loveStoryMoments: 0,
  scheduleMoments: 0,
});

async function paint(initial: DetailsItemKey) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DetailsWorkspace } = await import('./details-workspace');
  return renderToStaticMarkup(
    React.createElement(DetailsWorkspace, {
      groups: [
        {
          key: 'story',
          label: 'Story & plans',
          items: [
            { key: 'schedule', group: 'story', label: 'Schedule', icon: null },
            { key: 'rsvp', group: 'story', ...rsvpRow, icon: null },
          ],
        },
      ],
      bodies: { schedule: 'THE-SCHEDULE', rsvp: 'THE-GUEST-RSVP' },
      editors: { schedule: 'SCHEDULE-EDITOR', rsvp: React.createElement('i', { 'data-stub': 'maker-rsvp-settings' }) },
      initial,
    }),
  );
}

test('the RSVP row is drawn as a button, with the words the dead tap recorded', async () => {
  assert.equal(rsvpRow.label, 'RSVP');
  assert.equal(rsvpRow.sub, 'Questions · who can reply · reply by');
  const html = await paint('schedule');
  const row = html.match(/<button[^>]*data-details-nav-item="rsvp"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.ok(row, 'the RSVP row is not a <button> in the navigator');
  assert.match(row, /^<button type="button"/, 'the RSVP row is not a type="button" control');
  assert.match(row, /aria-pressed="false"/, 'the RSVP row does not say it is unpicked');
  assert.match(row, />RSVP</);
  assert.match(row, /Questions · who can reply · reply by/);
  // 📱 On a phone the rows live in the editor sheet's ONE dropdown — its trigger is drawn.
  const head = html.slice(html.indexOf('data-details-sheet-head=""'), html.indexOf('</div>', html.indexOf('data-sheet-sections=""')));
  assert.match(head, /data-sheet-sections=""[\s\S]*aria-haspopup="menu"/, 'a phone has no way to the other rows (the sheet’s dropdown is gone)');
});

test('the picked item’s editor is the one showing — picked RSVP shows the RSVP editor, unpicked hides it', async () => {
  const editor = (html: string, k: string) => html.match(new RegExp(`<div[^>]*data-details-editor="${k}"[^>]*>`))?.[0] ?? '';
  const off = await paint('schedule');
  assert.match(editor(off, 'rsvp'), /hidden=""/, 'the RSVP editor shows while another item is picked');
  assert.doesNotMatch(editor(off, 'schedule'), /hidden=""/);
  const on = await paint('rsvp');
  assert.ok(editor(on, 'rsvp'), 'the RSVP item has no editor slot');
  assert.doesNotMatch(editor(on, 'rsvp'), /hidden=""/, 'picking RSVP does not show its editor');
  assert.match(on, /data-details-editor="rsvp"[^>]*><i data-stub="maker-rsvp-settings">/, 'the RSVP editor slot does not hold its editor');
  assert.match(on, /aria-pressed="true"[^>]*data-details-nav-item="rsvp"/, 'picking RSVP does not mark its row');
  assert.match(on, /data-details-body-item="rsvp"[^>]*>[\s\S]*THE-GUEST-RSVP/, 'picking RSVP does not show the guest’s RSVP');
});

test('a tap on the row reaches `select` — on a desk (the navigator) and on a phone (the sheet’s dropdown)', () => {
  const ws = read('details-workspace.tsx');
  const sel = ws.slice(ws.indexOf('const select = useCallback('), ws.indexOf('[tellMaker]', ws.indexOf('const select = useCallback(')));
  assert.match(sel, /\(key: DetailsItemKey\) => \{\s*setOwn\(key\);/, '`select` no longer picks the item');
  assert.match(ws, /const selected = asked \?\? own;/, 'the picked item is no longer what `select` set');
  const navButton = ws.slice(ws.indexOf('<button', ws.indexOf('aria-label="Details — what to edit"')), ws.indexOf('data-details-nav-item={i.key}'));
  assert.match(navButton, /onClick=\{\(\) => select\(i\.key\)\}/, 'the navigator row’s tap no longer picks it');
  assert.match(ws, /<SheetSections\s+items=\{navGroups\.flatMap\(\(g\) => g\.items\)\}\s+selected=\{selected\}\s+onPick=\{select\}/, 'the phone sheet’s dropdown no longer picks the row tapped');
  const sheet = read('sheet-sections.tsx');
  const row = sheet.slice(sheet.indexOf('role="menuitemradio"') - 200, sheet.indexOf('role="menuitemradio"') + 200);
  assert.match(row, /onClick=\{\(\) => onPick\(i\.key\)\}/, 'a row in the phone dropdown no longer picks its item');
  // 🗂 2026-10-06: the editor follows the pick — or, in the Your event form, every field of it shows (`showsEditor`).
  assert.match(ws, /const showsEditor = \(k: DetailsItemKey\) => k === selected \|\| formKeys\.has\(k\);/, 'the editor no longer follows the pick');
  assert.match(ws, /data-details-editor=\{i\.key\}[\s\S]{0,200}className=\{!showsEditor\(i\.key\) \? 'hidden'/, 'the editor no longer follows the pick');
});

test('the RSVP item’s editor IS `MakerRsvpSettings` (maker-rsvp-ask.tsx), and the launch page always hands it in', () => {
  const details = read('maker-details.tsx');
  assert.match(details, /\.\.\.\(rsvp \? \(\['rsvp'\] as const\) : \[\]\)/, 'the RSVP row is no longer offered when RSVP is read');
  assert.match(details, /\.\.\.\(rsvp \? \{ rsvp: rsvp\.settings \} : \{\}\)/, 'the RSVP row’s editor is no longer its settings');
  assert.match(LAUNCH_PAGE, /const rsvpItem = \{[\s\S]{0,1200}?settings: \(\s*<MakerRsvpSettings/, 'the RSVP item’s settings are no longer MakerRsvpSettings');
  assert.match(LAUNCH_PAGE, /rsvp=\{rsvpItem\}/, 'the launch page no longer hands the RSVP item to Details');
  const lazy = read('details-lazy.tsx');
  assert.match(lazy, /export const MakerRsvpSettings = dynamic\(\(\) => import\([^)]*'\.\/maker-rsvp-ask'\)\.then\(\(m\) => m\.MakerRsvpSettings\)/, 'MakerRsvpSettings no longer loads maker-rsvp-ask');
});
