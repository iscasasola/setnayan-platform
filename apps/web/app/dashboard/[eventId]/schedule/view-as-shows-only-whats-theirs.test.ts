/**
 * view-as-shows-only-whats-theirs.test.ts — 👁 the Schedule's View as ▾ (Step 3c; owner 2026-11-01, corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN §3, §3b, §4, §12 Step 3) shows each person ONLY what is theirs, and is Pro.
 *
 * Held here, as properties over the REAL pure half (`lib/schedule-view-as.ts`) and the REAL menu:
 *   1 · a GUEST view never shows a private moment — not one hidden from guests, not one for a role, not a coordinator's
 *       staged prep (even marked shown), and never a chapter that is off the invitation, and never a task;
 *   2 · a SUPPLIER view shows only their tasks (and moments they are tagged on) — never another supplier's task, never
 *       a guest's or a role's; a CREW view narrows to that crew;
 *   3 · on a FREE event the menu still opens with Everyone · SUPPLIERS BY TIME (FREE — owner 2026-11-02, DECISION_LOG
 *       "TEN OWNER YESES" item 3) and one ◆ PRO row that opens the upgrade; no guest, role or supplier view is ever
 *       pickable or drawn there, and a supplier line is not pressable; Pro gets every view; a store shell that sells
 *       no Pro keeps the free views without the door;
 *   4 · a Time TBA chapter reads "Time TBA" in every view — never the 12:00 AM its day is stored at — and Suppliers by
 *       time lists its suppliers "Time TBA", never hidden (item 4);
 *   5 · Suppliers by time groups overlapping supplier work and counts SUPPLIERS at once (not crews);
 *   6 · a refused task read is SAID, never drawn as an empty day;
 *   7 · it is a VIEW: the files never call a write.
 *
 * Sabotage (recorded in the PR): drop `guestSeesMoment` from `guestDay` → (1) red; drop the `t.vendor_id === vendorId`
 * test in `supplierDay` → (2) red; put back the Free menu's old early return (a lone ◆ PRO link, no menu) → (3) red; drop `tba` from
 * `suppliersByTime` → (4) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { LAB_SCHEDULE_CHAPTERS, LAB_TBA_CHAPTER } from '@/app/dev/chapters-lab/lab-chapters';
import { labViewAs } from '@/app/dev/chapters-lab/lab-view-as';
import type { Chapter, TaskRow } from '@/lib/schedule-chapters';
import { guestDay, lensAllowed, lensFromKey, lensKey, roleDay, supplierDay, suppliersByTime, viewAsMenuOptions, viewAsOptions, type ViewAsData, type ViewMoment } from '@/lib/schedule-view-as';
import { ViewAsBody, ViewAsMenu } from './_components/schedule-view-as';

(globalThis as unknown as { React: unknown }).React = React;

const DATA: ViewAsData = labViewAs(true).data;
const CHAPTERS: Chapter[] = LAB_SCHEDULE_CHAPTERS;
const rowsOf = (d: { chapters: { rows: { id: string }[] }[] }) => d.chapters.flatMap((c) => c.rows.map((r) => r.id));
const momentById = new Map(DATA.moments.map((m) => [m.block_id, m]));
const taskById = new Map((DATA.tasks ?? []).map((t) => [t.task_id, t]));

test('1 · a guest view never shows a private moment, an uninvited chapter, or a task', () => {
  const day = guestDay(CHAPTERS, DATA);
  const ids = rowsOf(day);
  console.log(`[view-as] guest rows: ${ids.length} in ${day.chapters.length} chapters`);
  assert.ok(ids.length >= 3, 'the lab day shows guests nothing — this guard is pointed at nothing');
  for (const id of ids) {
    const m = momentById.get(id);
    assert.ok(m, `a guest row is not a moment (a task reached a guest?): ${id}`);
    assert.equal(m!.is_public, true, `${m!.label} is hidden from guests and was shown`);
    assert.equal(m!.staged, false, `${m!.label} is a coordinator's staged prep and was shown`);
    assert.equal(m!.audience, null, `${m!.label} is for a role and was shown to every guest`);
  }
  for (const c of day.chapters) assert.equal(c.chapter.on_invitation, true, `${c.chapter.label} is off the invitation`);
  // The lab carries a staged moment MARKED shown to guests: the trap a plain is_public filter falls into.
  const staged = DATA.moments.find((m) => m.staged && m.is_public);
  assert.ok(staged, 'the lab lost its staged-but-shown moment — the trap this guards');
  assert.ok(!ids.includes(staged!.block_id));

  // And on a made-up day with EVERY kind of private moment in an invited chapter, none gets through.
  const inv: Chapter = { ...CHAPTERS[3]!, block_id: 'inv', on_invitation: true };
  const off: Chapter = { ...CHAPTERS[3]!, block_id: 'off', on_invitation: false };
  const mk = (id: string, parent: string, over: Partial<ViewMoment>): ViewMoment => ({
    block_id: id, parent_block_id: parent, label: id, start_at: inv.start_at, end_at: null, is_public: true, staged: false,
    audience: null, responsible_vendor_ids: [], location: null, spot: null, travel_from: null, travel_to: null, ...over,
  });
  const made = guestDay([inv, off], {
    ...DATA,
    moments: [
      mk('ok', 'inv', {}),
      mk('hidden', 'inv', { is_public: false }),
      mk('staged', 'inv', { staged: true }),
      mk('for-entourage', 'inv', { audience: 'entourage' }),
      mk('in-a-private-chapter', 'off', {}),
    ],
  });
  assert.deepEqual(rowsOf(made), ['ok']);
});

test('2 · a supplier view shows only their tasks; a crew view only that crew', () => {
  const sups = new Set((DATA.tasks ?? []).map((t) => t.vendor_id).filter(Boolean) as string[]);
  assert.ok(sups.size >= 3, 'the lab has too few suppliers on tasks to prove anything');
  for (const v of sups) {
    const day = supplierDay(CHAPTERS, DATA, v, null);
    const ids = rowsOf(day);
    assert.ok(ids.length > 0, `${v} has tasks and its view is empty`);
    for (const id of ids) {
      const t = taskById.get(id);
      if (t) assert.equal(t.vendor_id, v, `${v}'s view shows another's task: ${t.what}`);
      else assert.ok(momentById.get(id)?.responsible_vendor_ids.includes(v), `${v}'s view shows a moment they are not on: ${id}`);
    }
    // Every task of theirs is there.
    for (const t of DATA.tasks ?? []) if (t.vendor_id === v) assert.ok(ids.includes(t.task_id), `${v}'s task is missing: ${t.what}`);
  }
  const crew = supplierDay(CHAPTERS, DATA, 'v-hmua', 'Team B');
  const crewIds = rowsOf(crew);
  assert.ok(crewIds.length > 0);
  for (const id of crewIds) assert.equal(taskById.get(id)?.crew, 'Team B', `the Team B view shows ${id}`);
  // A role task is never on a supplier's day, and a supplier's never on a role's.
  const role = rowsOf(roleDay(CHAPTERS, DATA, 'role:bridesmaid'));
  assert.ok(role.length > 0);
  for (const id of role) assert.equal(taskById.get(id)?.role, 'bridesmaid');
  // The call time is their first line.
  assert.equal(supplierDay(CHAPTERS, DATA, 'v-hmua', null).call?.time, '6:15 AM');
});

test('3 · Free opens Everyone · Suppliers by time and a ◆ PRO door; never a per-person view; Pro gets every view', () => {
  const draw = (pro: boolean, proHref: string | null) =>
    renderToStaticMarkup(
      React.createElement(ViewAsMenu, { input: { ...labViewAs(pro), proHref }, lens: { kind: 'everyone' }, onLens: () => undefined }),
    );
  const free = draw(false, '/dashboard/e/studio/website-pro');
  console.log('[view-as] free:', free);
  assert.match(free, /data-schedule-lens=""/, 'a Free event got no View as menu — Suppliers by time is Free');
  assert.doesNotMatch(free, /<a [^>]*href=/, 'a Free event’s View as is a lone upgrade link again');
  // The list a Free event is shown: the free views, then the one door.
  const keys = viewAsMenuOptions(DATA, false, true).map((o) => o.key);
  assert.deepEqual(keys, ['everyone', 'suptime', 'pro']);
  assert.deepEqual(viewAsMenuOptions(DATA, false, false).map((o) => o.key), ['everyone', 'suptime'], 'a store shell with no Pro got a door');
  assert.notEqual(draw(false, null), '', 'a store shell lost the free views');
  // Pro: every view, no door.
  const proKeys = viewAsMenuOptions(DATA, true, true).map((o) => o.key);
  assert.ok(proKeys.includes('guest') && proKeys.some((k) => k.startsWith('sup=')) && proKeys.some((k) => k.startsWith('role=')));
  assert.ok(!proKeys.includes('pro'));
  assert.doesNotMatch(draw(true, '/dashboard/e/studio/website-pro'), /data-paid-mark/);
  // The fence: a Free event draws only the free views, whatever asks.
  assert.equal(lensAllowed(false, { kind: 'suptime' }), true);
  for (const l of [{ kind: 'guest' }, { kind: 'role', key: 'role:bridesmaid' }, { kind: 'supplier', vendorId: 'v-hmua', crew: null }] as const) {
    assert.equal(lensAllowed(false, l), false, `a Free event may draw ${l.kind}`);
    const body = renderToStaticMarkup(React.createElement(ViewAsBody, { input: labViewAs(false), chapters: CHAPTERS, lens: l, onLens: () => undefined }));
    assert.equal(body, '', `a Free event drew the ${l.kind} view`);
  }
  // Suppliers by time draws on Free — its lines are read, not pressed (tapping one opens a supplier's day: Pro).
  const byTime = (pro: boolean) =>
    renderToStaticMarkup(React.createElement(ViewAsBody, { input: labViewAs(pro), chapters: CHAPTERS, lens: { kind: 'suptime' }, onLens: () => undefined }));
  const freeBody = byTime(false);
  // 🧭 Slice 9: Suppliers by time is now Side by side (one view, renamed) — a column per supplier; a column head opens
  // that supplier's day on Pro only.
  assert.match(freeBody, /data-side-by-side="person"/, 'Side by side drew nothing on a Free event');
  assert.match(freeBody, /data-sbs-column="sup:/, 'Side by side has no supplier column on a Free event');
  assert.doesNotMatch(freeBody, /<button type="button" data-sbs-head="sup:[^"]*" class/, 'a Free supplier column opens a Pro view');
  assert.match(byTime(true), /<button type="button" data-sbs-head="sup:[^"]*" class/, 'a Pro supplier column no longer opens their day');
});

test('4 · a Time TBA chapter reads "Time TBA" in a view, never 12:00 AM', () => {
  const tba: Chapter = { ...LAB_TBA_CHAPTER, on_invitation: true };
  const m: ViewMoment = {
    block_id: 'tba-m', parent_block_id: tba.block_id, label: 'Send-off sparklers', start_at: tba.start_at, end_at: null,
    is_public: true, staged: false, audience: null, responsible_vendor_ids: ['v-x'], location: null, spot: null, travel_from: null, travel_to: null,
  };
  const data = { ...DATA, moments: [m], tasks: [] as TaskRow[] };
  for (const day of [guestDay([tba], data), supplierDay([tba], data, 'v-x', null)]) {
    const rows = day.chapters.flatMap((c) => c.rows);
    assert.ok(rows.length > 0);
    for (const r of rows) assert.equal(r.time, 'Time TBA');
  }
  assert.equal(supplierDay([tba], data, 'v-x', null).call, null, 'a TBA chapter gave a call time');
  const byTime = suppliersByTime([tba], data);
  assert.equal(byTime.stretches.length, 0, 'a TBA chapter has no time to overlap');
  // …but its suppliers are listed "Time TBA", never hidden (owner 2026-11-02).
  assert.deepEqual(byTime.tba.flatMap((g) => g.items.map((i) => [i.vendorId, i.time])), [['v-x', 'Time TBA']], 'a TBA chapter’s supplier was hidden');
  const lab = renderToStaticMarkup(React.createElement(ViewAsBody, { input: labViewAs(false), chapters: CHAPTERS, lens: { kind: 'suptime' }, onLens: () => undefined }));
  assert.match(lab, /data-view-as-stretch="tba"/, 'the lab’s Send-off (Time TBA) is not drawn in Suppliers by time');
  assert.doesNotMatch(lab, /12:00 AM/);
});

test('5 · Suppliers by time groups overlapping work and counts suppliers, not crews', () => {
  const { stretches } = suppliersByTime(CHAPTERS, DATA);
  console.log('[view-as] stretches:', stretches.map((g) => `${g.from}–${g.to} ×${g.suppliers}`).join(' | '));
  assert.ok(stretches.some((g) => g.suppliers > 1), 'no stretch has suppliers at once');
  for (const g of stretches) assert.equal(g.suppliers, new Set(g.items.map((i) => i.vendorId)).size);
  // Glow HMUA's two crews at once are ONE supplier.
  const morning = stretches.find((g) => g.items.some((i) => i.id === 'lab-t1'))!;
  assert.ok(morning.items.some((i) => i.id === 'lab-t2'), 'Team A and Team B overlap and were split');
  // No guest's or role's task is ever on it.
  for (const g of stretches) for (const i of g.items) assert.ok(i.vendorId, 'a line with no supplier');
  assert.ok(!stretches.some((g) => g.items.some((i) => i.id === 'lab-t3')), 'the bridesmaids’ task reached Suppliers by time');
});

test('6 · a refused task read is said, never an empty day', () => {
  const unread = { ...DATA, tasks: null };
  assert.equal(supplierDay(CHAPTERS, unread, 'v-hmua', null).tasksUnread, true);
  assert.equal(roleDay(CHAPTERS, unread, 'role:bridesmaid').tasksUnread, true);
  assert.equal(suppliersByTime(CHAPTERS, unread).tasksUnread, true);
  const body = stripComments(readFileSync(join(import.meta.dirname, '_components', 'schedule-view-as.tsx'), 'utf8'));
  assert.match(body, /tasksUnread \?/, 'the screen no longer says a refused read');
});

test('7 · View as is a view: no write anywhere in it, and every option round-trips', () => {
  for (const rel of ['_components/schedule-view-as.tsx', '../../../../lib/schedule-view-as.ts', '../../../../lib/schedule-view-as.server.ts']) {
    const src = stripComments(readFileSync(join(import.meta.dirname, rel), 'utf8'));
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(|\.rpc\(|from '\.\.\/actions'|useDayActions/, `${rel} writes`);
  }
  for (const o of viewAsOptions(DATA)) assert.equal(lensKey(lensFromKey(o.key)), o.key, `option ${o.key} does not round-trip`);
});
