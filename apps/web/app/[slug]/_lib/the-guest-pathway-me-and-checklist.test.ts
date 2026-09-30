/**
 * THE GUEST PATHWAY — guest side, part 2: ME and "YOUR CHECKLIST"
 * (owner 2026-09-26/27, DECISION_LOG "THE LAST 30 DAYS: EACH GUEST GETS YOUR
 * CHECKLIST", "THE GUEST CHECKLIST IS INTERACTIVE", "ON THE DAY TOO", "A NAME
 * MAKES A QR — FOR EVERY PLUS-ONE"; build brief items 4 and 6).
 *
 *   4 · ME — name + "Not you? Switch", their plus-ones ("Send their invite",
 *       "Show <name>'s pass", "Add their name"), "Save to my account" any time.
 *   6 · THE CHECKLIST — the last 30 days; items only where there is something
 *       true to say; ticks saved to the GUEST through their own reply action
 *       (+0 routes), private to them; "3 of 5 ready" → "You're all set ✓".
 *
 * Pure decisions are executed; wiring is read from comment-stripped source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  applyTick,
  buildChecklist,
  checklistProgress,
  checklistShows,
  daysUntil,
  sanitizeTicks,
} from '@/lib/guest-checklist';
import { anyoneMayAskToJoin } from '@/lib/rsvp-ask';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = join(process.cwd());
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const PAGE = read('app/[slug]/page.tsx');
const BODY = read('app/[slug]/_components/site-body.tsx');
const ACTIONS = read('app/[slug]/actions.ts');
const HUBBAR = read('app/[slug]/_components/guest-hub-bar.tsx');
const MIGRATION = readFileSync(
  join(ROOT, '..', '..', 'supabase', 'migrations', '20271249784825_a_guests_checklist_is_their_own.sql'),
  'utf8',
);

// ═══ 6 · THE CHECKLIST — pure ═════════════════════════════════════════════

test('6 · shown only in the 30 days before the day — never on the day, never earlier', () => {
  const E = '2026-12-18';
  assert.equal(checklistShows({ eventDate: E, today: '2026-11-18' }), true, '30 days out');
  assert.equal(checklistShows({ eventDate: E, today: '2026-11-17' }), false, '31 days out');
  assert.equal(checklistShows({ eventDate: E, today: '2026-12-17' }), true, 'the day before');
  assert.equal(checklistShows({ eventDate: E, today: '2026-12-18' }), false, 'the day itself has its own page');
  assert.equal(checklistShows({ eventDate: null, today: '2026-12-01' }), false);
  assert.equal(daysUntil({ eventDate: E, today: '2026-11-27' }), 21);
});

test('6 · an item with nothing true to say is not drawn; the pass always is', () => {
  const bare = buildChecklist({
    wear: null, wearNote: null, motif: [], arriveBy: null, venueName: null, mapsHref: null, tableLabel: null,
    passHref: '/api/guest/qr',
  });
  assert.deepEqual(bare.map((i) => i.key), ['pass']);
  const full = buildChecklist({
    wear: 'Filipiniana formal', wearNote: 'Guests, in the motif', motif: ['#F4EFE6', '#C9A15A', 'nope'],
    arriveBy: '2:30 PM', venueName: 'San Agustin Church', mapsHref: 'https://maps', tableLabel: 'Table 7',
    passHref: '/api/guest/qr',
  });
  assert.deepEqual(full.map((i) => i.key), ['wear', 'motif', 'arrive', 'table', 'pass']);
  assert.deepEqual(full.find((i) => i.key === 'motif')?.swatches, ['#F4EFE6', '#C9A15A'], 'a non-hex swatch was drawn');
  assert.equal(full.find((i) => i.key === 'arrive')?.title, 'Arrive by 2:30 PM');
  assert.equal(full.find((i) => i.key === 'arrive')?.link?.label, 'Open in Maps');
  // No maps link where the venue is withheld (they have not replied).
  const withheld = buildChecklist({
    wear: null, wearNote: null, motif: [], arriveBy: '2:30 PM', venueName: 'San Agustin Church', mapsHref: null,
    tableLabel: null, passHref: '/api/guest/qr',
  });
  assert.equal(withheld.find((i) => i.key === 'arrive')?.link ?? null, null);
});

test('6 · "3 of 5 ready" → all set; only drawn items count; stored ticks are sanitised', () => {
  const items = buildChecklist({
    wear: 'Formal', wearNote: null, motif: ['#111111'], arriveBy: '3 PM', venueName: null, mapsHref: null,
    tableLabel: 'Table 7', passHref: '/api/guest/qr',
  });
  assert.deepEqual(checklistProgress(items, ['wear', 'motif', 'table']), { ready: 3, total: 5, allSet: false });
  assert.deepEqual(checklistProgress(items, ['wear', 'motif', 'arrive', 'table', 'pass']), { ready: 5, total: 5, allSet: true });
  assert.deepEqual(sanitizeTicks(['wear', 'wear', 'hack', 7, 'pass']), ['wear', 'pass']);
  assert.deepEqual(applyTick(['wear'], 'pass', true), ['wear', 'pass']);
  assert.deepEqual(applyTick(['wear', 'pass'], 'wear', false), ['pass']);
});

// ═══ 6 · THE CHECKLIST — wiring ═══════════════════════════════════════════

test('6 · 🔒 the ticks live in a table NO browser role can read — private to the guest', () => {
  assert.match(MIGRATION, /CREATE TABLE IF NOT EXISTS public\.guest_checklist_ticks/);
  assert.match(MIGRATION, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(MIGRATION.replace(/--.*$/gm, ''), /CREATE POLICY/, 'a policy would let a browser role read the ticks');
  assert.match(MIGRATION, /REVOKE ALL ON TABLE public\.guest_checklist_ticks FROM anon;/);
  assert.match(MIGRATION, /REVOKE ALL ON TABLE public\.guest_checklist_ticks FROM authenticated;/);
});

test('6 · the save is the guest\'s OWN reply action (+0 routes), after the key check, touching nothing of the reply', () => {
  const start = ACTIONS.indexOf('export async function submitRsvp(');
  const keyCheck = ACTIONS.indexOf('const session = await readGuestSessionForEvent(eventId);', start);
  const branch = ACTIONS.indexOf("const checklistItem = clean(formData.get('checklist_item'));", start);
  const replyRead = ACTIONS.indexOf("const status = clean(formData.get('rsvp_status'))", start);
  assert.ok(start > -1 && keyCheck > start, 'submitRsvp no longer checks the key first');
  assert.ok(branch > keyCheck, 'the checklist branch runs BEFORE the key check — anyone could tick for anyone');
  assert.ok(branch < replyRead, 'the checklist branch runs after the reply is read — a tick could rewrite the reply');
  const block = ACTIONS.slice(branch, replyRead);
  assert.match(block, /if \(!isChecklistKey\(checklistItem\)\) throw/);
  assert.match(block, /\.from\('guest_checklist_ticks'\)\.upsert\(/);
  assert.match(block, /guest_id: guestId,\s*event_id: eventId,/);
  assert.match(block, /if \(tickErr\) throw/, 'a failed save must be said, not swallowed');
  assert.match(block, /return;\s*\}\s*$/, 'the branch must return before the reply write');
  assert.doesNotMatch(block, /\.from\('guests'\)/, 'the checklist branch touches the guest row');
});

test('6 · the page reads THIS guest\'s ticks only inside the window, and says so when the read fails', () => {
  assert.match(PAGE, /if \(checklistShows\(\{ eventDate: event\.event_date, today: manilaToday\(\) \}\)\) \{/);
  assert.match(PAGE, /\.from\('guest_checklist_ticks'\)\s*\.select\('ticks'\)\s*\.eq\('guest_id', guest\.guest_id\)/);
  assert.match(PAGE, /readFailed: Boolean\(tickErr\)/);
  assert.match(BODY, /\{g\.checklist && plan\.body === 'normal' && !isMakerCanvas && !isLive && !isPost \? \(\s*<GuestChecklist\b/);
  assert.match(BODY, /save=\{submitRsvp\.bind\(null, event\.event_id, guest\.guest_id\)\}/);
});

test('6 · the checklist renders the count and ticks as checkboxes', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestChecklist } = await import('../_components/guest-checklist');
  const items = buildChecklist({
    wear: 'Formal', wearNote: null, motif: ['#111111'], arriveBy: '3 PM', venueName: null, mapsHref: null,
    tableLabel: 'Table 7', passHref: '/api/guest/qr',
  });
  const html = renderToStaticMarkup(
    React.createElement(GuestChecklist, {
      items, initialTicks: ['wear', 'motif', 'table'], save: async () => {}, daysLeft: 21, dateLabel: '18 December',
    }),
  );
  assert.match(html, /3 of 5 ready/);
  assert.equal((html.match(/role="checkbox"/g) ?? []).length, 5);
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 3);
  assert.match(html, /href="\/api\/guest\/qr"[^>]*download/);
  const failed = renderToStaticMarkup(
    React.createElement(GuestChecklist, { items, initialTicks: [], save: async () => {}, daysLeft: null, dateLabel: null, readFailed: true }),
  );
  assert.match(failed, /could not load your ticks/, 'a failed read looks like "nothing ticked"');
});

// ═══ 4 · ME ═══════════════════════════════════════════════════════════════

test('4 · Me holds name + Switch, the plus-ones, and Save — mounted INTO the one #site-me', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMe } = await import('../_components/guest-me');
  const html = renderToStaticMarkup(
    React.createElement(GuestMe, {
      name: 'Ana Reyes',
      slug: 'ana',
      eventId: 'e-1',
      guestId: 'g-ana',
      askMeal: true,
      askDietary: true,
      askPlusOnes: true,
      eventName: 'Indalecio & Claire',
      guests: [
        { guestId: 'p1', name: 'Lola Nena', inviteUrl: 'https://x/ana?invite=t1' },
        { guestId: 'p2', name: null, inviteUrl: null },
      ],
      passes: { p1: '<svg data-pass="lola"></svg>' },
      account: { kind: 'linked', accountEmail: 'ana@example.com' },
      personalLink: 'https://x/ana?invite=t0',
      userAgent: null,
      termsCarried: true,
    }),
  );
  assert.match(html, /Ana Reyes/);
  assert.match(html, /action="\/ana\/sign-out"/);
  assert.match(html, /Send their invite/);
  assert.match(html, /Show Lola’s ticket/);
  assert.match(html, /data-pass="lola"/);
  // A TBA seat is named IN PLACE on Me (owner 2026-09-29, frame E) — no link back to the reply.
  assert.match(html, /data-add-name-in-place/);
  assert.ok(!html.includes('/invite/reply'), 'Me links a TBA seat back to the reply');
  assert.match(html, /Saved to your account/);
  // One #site-me: Me is a SLOT in GuestHubBar's section, never a second one.
  assert.match(HUBBAR, /<section id="site-me" className="mt-12 scroll-mt-6">\s*\{meSlot \?/);
  assert.match(PAGE, /meSlot=\{meSlot\}/);
  assert.match(PAGE, /yourGuestsFor\(admin, \{ event_id: event\.event_id, slug: event\.slug \}, guest\.guest_id,/);
});

test('4 · a plus-one\'s pass is only built for a NAMED seat of THIS guest', () => {
  const SEATS = read('app/[slug]/_lib/plus-one-seats.server.ts');
  assert.match(SEATS, /\.eq\('plus_one_of_guest_id', bringerGuestId\)/, 'seats are not scoped to the bringer');
  assert.match(SEATS, /qrToken: name \? \(\(r\.qr_token as string \| null\) \?\? null\) : null/, 'a TBA seat carries a key');
  assert.match(SEATS, /if \(!s\.qrToken\) return \{ guestId: s\.guest_id, name: s\.name, inviteUrl: null \};/);
});

// ═══ 5 (follow-up) · "Ask to join" honours "Who can RSVP?" ═════════════════

test('5 · "Ask to join" shows only when the couple chose "Anyone, I approve"', async () => {
  assert.equal(anyoneMayAskToJoin(null), false);
  assert.equal(anyoneMayAskToJoin({ whoCanRsvp: 'anyone' }), true);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GetInside } = await import('../_components/get-inside');
  const closed = renderToStaticMarkup(
    React.createElement(GetInside, { slug: 'ana', eventId: 'e-1', signedInNotListed: true, theOrganizer: 'the couple', mayAskToJoin: false }),
  );
  assert.match(closed, /not on the guest list for this event yet/);
  assert.doesNotMatch(closed, /Ask to join/, 'a door that turns them away is offered');
  assert.match(BODY, /mayAskToJoin=\{anyoneMayAskToJoin\(event\.rsvp_ask_config\)\}/);
});

test('🧭 the guest first-visit tour never mounts in the Maker canvas or its stage preview', () => {
  // Live 2026-09-27: "You're invited · STEP 1 OF 3" covered the Maker's RSVP preview.
  const mounts = BODY.match(/<GuestGuidedTour\b/g)?.length ?? 0;
  const gated = BODY.match(/\{isEditorCanvas \? null : <GuestGuidedTour\b/g)?.length ?? 0;
  assert.ok(mounts > 0, 'the guest tour is gone from the page entirely — read this test');
  assert.equal(gated, mounts, `${gated} of ${mounts} guest-tour mounts are gated on isEditorCanvas`);
  // `isEditorCanvas` is true for BOTH the canvas (?editor=1) and the preview (?preview=draft).
  assert.match(BODY, /const isStagePreview = isEditorCanvas && !editorBridge;/);
});

test('5 · ☝ ONE door for a stranger — no "Find your invitation" card, no "Open my invitation" before the day', () => {
  const anon = BODY.slice(BODY.indexOf('const anonymousTree = '), BODY.indexOf('const guestTree = '));
  assert.match(anon, /plan\.spotlight && plan\.spotlight\.kind !== 'find_invite' \? \(/, 'the "Find your invitation" card is back beside Get inside');
  assert.match(anon, /\) : plan\.openBrowse && archiveTense \? \(/, '"Open my invitation" is offered before the day again');
});
