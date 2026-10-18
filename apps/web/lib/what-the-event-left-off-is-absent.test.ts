/**
 * 🚪 WHAT THE EVENT LEFT OFF IS ABSENT — NEVER GREYED (owner 2026-10-08, DECISION_LOG "ONBOARDING
 * FOLLOWS WHAT THE EVENT NEEDS"; matrix §2 "A need that is OFF is not greyed out; it is absent (bottom
 * bar, Home rows, Maker stages, Studio tiles). Home keeps one 'Switch on more' row").
 *
 * The rules are pure (`lib/event-needs.ts`, pinned in event-needs.test.ts); this file holds the FOUR
 * places that must obey them to actually obey them — a rule nobody reads renders exactly like no rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickHomeNext, type HomeNextInput } from './home-first-screen';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

const BASE: HomeNextInput = {
  guide: null,
  hasDate: true,
  guests: { total: 0, unsent: 0 },
  noun: 'event',
  papicReady: false,
  aiOffer: false,
};

test('Home’s Next card never asks for guests an event with no list will never have', () => {
  assert.equal(pickHomeNext(BASE).kind, 'guests');
  assert.notEqual(pickHomeNext({ ...BASE, needs: { guestList: false, hubDetails: true } }).kind, 'guests');
  assert.notEqual(pickHomeNext({ ...BASE, guests: { total: 4, unsent: 4 }, needs: { guestList: false, hubDetails: true } }).kind, 'invite');
  // …and an unread list is not that Home's to report.
  assert.notEqual(pickHomeNext({ ...BASE, guests: null, needs: { guestList: false, hubDetails: true } }).kind, 'unread');
  assert.equal(pickHomeNext({ ...BASE, guests: null }).kind, 'unread');
});

test('Home’s Next card never says "Finish your Event Hub" to cover + photos only', () => {
  const guide = { done: 1, total: 5, stageTitle: 'The Day', stageDone: 0, stageTotal: 2 } as unknown as HomeNextInput['guide'];
  assert.equal(pickHomeNext({ ...BASE, guide }).kind, 'guide');
  assert.notEqual(pickHomeNext({ ...BASE, guide, needs: { guestList: true, hubDetails: false } }).kind, 'guide');
});

test('the bottom bar drops what is off — the layout hands the needs to the ONE menu tree', () => {
  const layout = read('app/dashboard/[eventId]/layout.tsx');
  assert.match(layout, /\.\.\.needsHiddenNavKeys\(eventNeeds\)/, 'the layout no longer hides a switched-off tab');
  assert.match(layout, /readEventNeedsFor\(supabase, eventId, 'EventLayout'\)/);
});

test('Home drops the doors, the numbers and the money of what is off, and keeps ONE Switch on more', () => {
  const home = read('app/dashboard/[eventId]/_components/home-first-screen.tsx');
  assert.match(home, /hide=\{doorsHidden\}/, 'the doors no longer follow the needs');
  assert.match(home, /\{noList \? null : guestsUnread \?/, 'the guest numbers show without a guest list');
  assert.match(home, /money && !noSuppliers/, 'the money shows without suppliers');
  assert.match(home, /data-home-switch-on/, 'Switch on more is gone — what was left off is lost');
  assert.match(home, /data-home-one-qr/, 'an event with no list has no way in on Home');
  const page = read('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /needs=\{homeNeeds\}/);
  assert.match(page, /needs: eventNeeds,/, 'the Next card is not told what the event needs');
  const parts = read('app/dashboard/[eventId]/_components/home-parts.tsx');
  assert.match(parts, /\.filter\(\(d\) => !hide\.includes\(d\.key\)\)/);
});

test('the Maker drops the stages and Studio tiles of what is off, and never opens on one', () => {
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(page, /hiddenStages=\{hiddenStages\}/);
  assert.match(page, /\.filter\(\(t\) => !needsHidesStudioTile\(t\.key, eventNeeds\)\)/, 'Studio tiles ignore the needs');
  assert.match(page, /includes\(wantedStage\) \? 'event' : wantedStage/, 'the Maker can open on a stage this event does not have');
  const shell = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
  assert.match(shell, /!hiddenStages\.includes\(s\)\)/, 'the stage lists ignore the needs');
  assert.match(shell, /hiddenStages,\n\s*\}\);/, 'Page ▾ is not told what is hidden');
  const bar = read('app/dashboard/[eventId]/launch/_components/maker-bar.ts');
  assert.match(bar, /if \(input\.hiddenStages\?\.includes\(s\)\) continue;/);
  // …and the top bar's Stages ▾ sheet lists only the stages Page ▾ lists (walked 2026-10-18: it drew all five).
  const sheet = read('app/dashboard/[eventId]/launch/_components/stage-item-menu.tsx');
  assert.match(sheet, /if \(options\.length > 0 && !options\.some\(\(o\) => o\.key === s \|\| o\.key\.startsWith\(`\$\{s\}:`\)\)\) return null;/, 'the Stages sheet lists a stage this event does not have');
});
