/**
 * the-maker-top-nav-and-ticket-style.test.ts — THE MAKER'S TOP NAV, THE TICKET
 * STYLE THAT WAITS FOR APPLY, AND FOUR OWNER FIXES (2026-10-05; design
 * `prototypes/maker_keynote_chrome_2026-10-05_fable.md`, the controller's
 * partial go: "build only the owner decisions and bug fixes").
 *
 *   1 · 🎫 THE TICKET STYLE GOES THROUGH THE HUB DRAFT (owner 2026-10-02 Q7,
 *       *"the pass look waits for Apply"*): the draft holds `pass_design` beside
 *       `name_style`, a pick never forgets the other, Apply merges only what it
 *       holds, the picker saves to the draft — and the old live door is gone.
 *   2 · 💊 THE TOP NAV: ✕ Exit red, its own pill · the screen you are on ·
 *       [ ↺ Undo | 👁 Preview ] one shared pill · ✓ Apply green, its own pill.
 *   3 · 🎨 LOOK OPENS THE LOOK TOOLS — never the guided flow's stage list.
 *   4 · 🚫 THE EVENT BAR HAS NO (i) NOTE floating over the scene tiles.
 *   5 · ✋ THE NAMES & DATE SHEET SENDS NOBODY ELSEWHERE — no "Open Hero editor",
 *       no "Hero" word; its parts are ONE dropdown.
 *   6 · 👁 PREVIEW IS SEEN ON A SETUP SCREEN — a view pick puts the stage back.
 *   7 · 🎫 THE GUEST'S TICKET SHEET: the real ticket + ONE Ticket style ▾,
 *       no sentence, no "Open your guest list →".
 *
 * Each was broken once by hand and seen RED before it was trusted (the PR body
 * lists the sabotages).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import {
  emptyHubDraft,
  eventColumnChange,
  mergeHubDraft,
  sanitizeHubDraft,
  type HubDraftItem,
} from './hub-draft';
import { hubDraftChangePlace } from './hub-draft-change-lines';
import { passDesignDraftPatch, makerTicketSrc } from './pass-design-save';
import { fixedScenePanel, MAKER_FIXED_TICKET } from './maker-selection';
import { MAKER_BAR_APPLY } from './maker-phone-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ══ 1 · THE TICKET STYLE WAITS FOR APPLY ══════════════════════════════════ */

test('1a · the draft holds the ticket style beside the name style — only a real look, never junk', () => {
  const d = sanitizeHubDraft({ v: 1, events: { print_details: { pass_design: 'ticket', opening_line: 'x', name_style: 'nope' } }, widgets: {}, history: [] });
  assert.deepEqual(d.events.print_details, { pass_design: 'ticket' }, 'the draft keeps the ticket style and drops every other key');
  const bad = sanitizeHubDraft({ v: 1, events: { print_details: { pass_design: 'neon' } }, widgets: {}, history: [] });
  assert.equal('print_details' in bad.events, false, 'an unknown look is dropped, never repaired');
  assert.deepEqual(passDesignDraftPatch('poster'), { events: { print_details: { pass_design: 'poster' } } });
});

test('1b · a ticket style pick never forgets a drafted name style (and back)', () => {
  let d = mergeHubDraft(emptyHubDraft(), { events: { print_details: { name_style: 'middle-initial' } } });
  d = mergeHubDraft(d, passDesignDraftPatch('ticket'));
  assert.deepEqual(d.events.print_details, { name_style: 'middle-initial', pass_design: 'ticket' });
  d = mergeHubDraft(d, { events: { print_details: { name_style: 'full' } } });
  assert.deepEqual(d.events.print_details, { name_style: 'full', pass_design: 'ticket' });
});

test('1c · Apply counts only what the draft HOLDS — a ticket pick is not a name-style change', () => {
  const live = { name_style: 'middle-initial', pass_design: 'classic', opening_line: 'Together with their families' };
  assert.equal(eventColumnChange('print_details', live, { pass_design: 'classic' }), 'none', 'the same look is no change');
  assert.notEqual(eventColumnChange('print_details', live, { pass_design: 'ticket' }), 'none', 'a new look is a change');
  const item: HubDraftItem = { kind: 'event', column: 'print_details', value: { pass_design: 'ticket' }, change: 'change', pro: false };
  assert.deepEqual(hubDraftChangePlace(item, { events: { print_details: live }, widgets: [] }), { place: "Guest's ticket", what: 'Ticket style' }, 'the Apply sheet names the ticket style');
});

test('1d · Apply merges each held key into the live blob — and nothing writes the look live any more', () => {
  const action = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /const passDesignWrite = draftedPrint && 'pass_design' in draftedPrint \? passCardDesignFrom\(draftedPrint\.pass_design\) : undefined;/);
  assert.match(action, /\.\.\.\(passDesignWrite !== undefined \? \{ passDesign: passDesignWrite \} : \{\}\)/, 'Apply does not write the drafted ticket style');
  const picker = read(`${L}/pass-card-design-picker.tsx`);
  assert.match(picker, /fd\.set\('patch', JSON\.stringify\(passDesignDraftPatch\(design\)\)\);[\s\S]*?hubDraftAction\(eventId, fd\)/, 'the Ticket style ▾ does not save to the draft');
  assert.doesNotMatch(picker, /fetch\(/, 'the Ticket style ▾ writes somewhere other than the draft');
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.doesNotMatch(route, /piece === 'pass-design'/, 'the live pass-design door is back');
  assert.doesNotMatch(route, /serializePrintDetails\(\{ \.\.\.stored, passDesign/, 'the print route writes the ticket style live again');
  // The guest's own card reads LIVE only (no draft): `pass-card.server.ts` draws from `loadPrintSet` without one.
  assert.doesNotMatch(read('lib/pass-card.server.ts'), /readHubDraft|hub-draft-store/, 'a guest’s card reads the couple’s draft');
});

/* ══ 2 · THE TOP NAV ════════════════════════════════════════════════════════ */

async function shell(): Promise<string> {
  const { MakerShell } = await import(`../${L}/maker-shell`);
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        MakerShell,
        {
          eventId: 'e1',
          slug: 'maria-and-jose',
          liveStage: null,
          initialStage: 'rsvp',
          storeShell: false,
          tourSlides: [],
          firstVisit: false,
          completeTourAction: async () => {},
          renderStamp: '1',
          more: null,
          hasWork: true,
        },
        React.createElement('i'),
      ),
    ),
  );
}

test('2a · ✕ Exit is red, an X, its own pill — "‹" never again', async () => {
  const header = (await shell()).split('<header')[1]!.split('</header>')[0]!;
  const exit = /<span data-icon-pill="exit"[^>]*><a\b[^>]*data-maker-tool="exit"[^>]*>([\s\S]*?)<\/a><\/span>/.exec(header);
  assert.ok(exit, 'Exit is not its own pill');
  assert.match(exit[0], /\bmax-lg:bg-\[#B3261E\]/, 'Exit is not red on a phone');
  assert.doesNotMatch(exit[0], /(?:^|\s)bg-\[#B3261E\]/, 'the red leaks onto a desktop');
  assert.match(exit[1]!, /lucide-x\b/, 'Exit is not an X');
  // 🖥 A desktop keeps its ‹ this round — shown only from lg, the X only under it.
  assert.match(exit[1]!, /lucide-x h-5 w-5 lg:hidden/, 'the X shows on a desktop');
  assert.match(exit[1]!, /lucide-chevron-left hidden h-6 w-6 lg:block/, 'the desktop lost its ‹');
});

test('2b · the bar names the screen you are on — "Invitation · Welcome", never "as a guest sees it"', async () => {
  const header = (await shell()).split('<header')[1]!.split('</header>')[0]!;
  assert.match(header, /data-maker-screen-label=""[^>]*class="[^"]*\btruncate\b[^"]*"[^>]*>Invitation · Welcome</);
  assert.doesNotMatch(header, /as a guest sees it/);
});

test('2c · [ ↺ Undo | 👁 Preview ] share ONE pill; ✓ Apply is its own GREEN pill', async () => {
  const bar = read('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /<IconPill label="Undo and preview">\s*<DraftButton\s+label="Undo"[\s\S]*?\{maker\?\.previewMenu \?\? null\}\s*<\/IconPill>/, 'Undo and Preview are not one shared pill');
  assert.match(bar, /<IconPill tone="apply">\s*<span className="relative inline-flex" data-maker-apply="">/, 'Apply is not its own pill');
  assert.match(MAKER_BAR_APPLY, /\bmax-lg:bg-success-600\b/, 'Apply is not green on a phone');
  assert.match(MAKER_BAR_APPLY, /(?:^|\s)bg-mulberry(?:\s|$)/, 'the desktop’s Apply is no longer the wine circle');
  // With no draft bar (a viewer with nothing to draft) Preview still sits in a pill.
  const header = (await shell()).split('<header')[1]!.split('</header>')[0]!;
  assert.match(header, /<span role="group" aria-label="Preview" data-icon-pill="shared" class="[^"]*max-lg:bg-ink\/\[0\.06\][^"]*"><span class="relative inline-flex shrink-0"><button[^>]*data-maker-tool="preview"/, 'the pill grounds the desktop’s bar');
});

/* ══ 3 · LOOK OPENS THE LOOK TOOLS ══════════════════════════════════════════ */

test('3 · each opening of Look is answered ONCE — a later mount of Details never replays it (behaviour)', async () => {
  const { lookVisitTaker } = await import(`../${L}/maker-bar`);
  const take = lookVisitTaker();
  assert.equal(take(0), false, 'no Look visit yet, but Details left the flow');
  assert.equal(take(1), true, 'a Look press was not answered');
  assert.equal(take(1), false, 'a remount of Details (the Details door, a jump) replayed the old Look visit');
  assert.equal(take(2), true, 'the next Look press was not answered');
  // The Maker counts a press (desktop) and Theme (the lower third); Details asks the taker, then leaves the flow.
  const shellSrc = read(`${L}/maker-shell.tsx`);
  assert.match(shellSrc, /const takeLookVisit = useMemo\(\(\) => lookVisitTaker\(\), \[\]\);/);
  // A Look press (the tour's last slide) and the lower third's Look part (2026-10-06: `openSection('look')`).
  assert.equal((shellSrc.match(/if \(key === 'look'\) setLookVisit\(\(n\) => n \+ 1\);/g) ?? []).length, 1, 'a Look door does not count its visit');
  assert.equal((shellSrc.match(/if \(sec === 'look'\) setLookVisit\(\(n\) => n \+ 1\);/g) ?? []).length, 1, 'the lower third’s Look does not count its visit');
  const ws = read(`${L}/details-workspace.tsx`);
  const effect = /useEffect\(\(\) => \{\s*if \(!lookVisit \|\| !takeLookVisit\?\.\(lookVisit\)\) return;([\s\S]*?)\}, \[lookVisit, takeLookVisit\]\);/.exec(ws);
  assert.ok(effect, 'Details does not ask the taker before leaving the flow');
  assert.match(effect[1]!, /setMode\('all'\);/, 'a Look visit stays in the guided flow');
  assert.match(effect[1]!, /setPane\(null\);/, 'a Look visit lands on the stage list');
});

/* ══ 4 · THE EVENT BAR HAS NO NOTE OVER THE TILES ═══════════════════════════ */

test('4 · the Event Bar switch says its word — no (i) note to float over the tiles', () => {
  const src = read(`${E}/editor-shell.tsx`);
  const at = src.indexOf('data-maker-guest-bars=');
  assert.ok(at > 0, 'the Event Bar switch is gone — re-read this guard');
  const row = src.slice(src.lastIndexOf('<div', at), src.indexOf('</div>', at));
  assert.doesNotMatch(row, /<InfoTip\b/, 'the Event Bar’s (i) note is back');
  assert.match(row, /data-maker-guest-bars-label=""[^>]*>\s*Event Bar\s*</, 'the switch lost its word');
});

/* ══ 5 · NO GO-ELSEWHERE FROM THE NAMES & DATE ══════════════════════════════ */

test('5 · the names & date sheet has no "Open Hero editor", no "Hero" word, and ONE part dropdown', () => {
  const hero = fixedScenePanel('hero');
  assert.equal('button' in hero, false, 'the names & date sheet sends the couple to the Hero editor again');
  assert.doesNotMatch(hero.line, /hero/i, 'the "Hero" word is back on its sheet');
  const src = read(`${E}/editor-shell.tsx`);
  assert.doesNotMatch(src, /onOpenHero=\{/, 'a part sheet offers "Open the Hero editor" again');
  const parts = /function ElementButtons\([\s\S]*?\n\}\n/.exec(src)?.[0] ?? '';
  assert.match(parts, /<PickMenu\b/, 'the parts are not one dropdown');
  assert.doesNotMatch(parts, /keys\.map\(\(k\) => \(\s*<button/, 'the parts are a row of pills again');
});

/* ══ 6 · PREVIEW IS SEEN ON A SETUP SCREEN ══════════════════════════════════ */

test('6 · on a setup screen a view pick (See as · Phone/Desktop · Both) puts the stage back on screen', () => {
  const src = read(`${L}/maker-shell.tsx`);
  assert.match(src, /const coveringPage = selection\?\.kind === 'tool' && isMakerShellPage\(selection\.key\);\s*const seeTheStage = \(\) => \{\s*if \(coveringPage\) select\(null\);\s*\};/);
  const rows = src.slice(src.indexOf('const previewRows'), src.indexOf('/* ▶ PLAY'));
  for (const pick of ['setSeeAs(null)', 'setSeeAs(s.key)', 'setDevice(makerViewToggle(shownDevice))', "setDevice(device === 'both' ? 'desktop' : 'both')"]) {
    const at = rows.indexOf(pick);
    assert.ok(at > 0, `the ${pick} row is gone — re-read this guard`);
    assert.match(rows.slice(at, at + 120), /seeTheStage\(\)/, `${pick} changes a page nobody can see on a setup screen`);
  }
});

/* ══ 7 · THE GUEST'S TICKET SHEET ═══════════════════════════════════════════ */

test('7 · the Guest’s ticket: the real ticket on the page + ONE Ticket style ▾ — no sentence, no link out', () => {
  assert.equal(MAKER_FIXED_TICKET, 'pass');
  assert.match(makerTicketSrc('e1', 'ticket'), /\/api\/hub-print\/pass\?event=e1&mode=screen&pass_format=phone-card&pass_design=ticket&pass_guest=first$/);
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /url\.searchParams\.get\('pass_guest'\) === 'first'\s*\? await loadGuestPasses\(set, \{ width: 360, limit: 1, ticketsOnly: true \}\)/, 'the preview no longer draws a real guest');
  const src = read(`${E}/editor-shell.tsx`);
  // The sheet: the picker, and the line and the "Open your guest list →" both stand aside for it.
  assert.match(src, /\{fixed === MAKER_FIXED_TICKET && ticketPanel \? ticketPanel : null\}/);
  assert.match(src, /\{fixedFact \|\| toolHere \|\| !f\.line \|\| \(fixed === MAKER_FIXED_TICKET && ticketPanel\) \? null :/, 'the ticket’s sentence is back');
  assert.match(src, /\{f\.source && !\(fixed === MAKER_FIXED_TICKET && ticketPanel\) \? \(/, 'the ticket’s "Open your guest list →" is back');
  assert.match(src, /<PassCardDesignPicker\s+key=\{ticketSaved\}[\s\S]*?preview=\{false\}\s*onShown=\{setTicketShown\}/, 'the sheet does not carry the one Ticket style ▾');
  // The page: the real ticket, in the look on screen.
  assert.match(src, /\{ticketOn && canvasSrc \? \([\s\S]*?data-maker-ticket-view=\{ticketDesign\}[\s\S]*?src=\{makerTicketSrc\(eventId, ticketDesign\)\}/, 'the page does not draw the real ticket');
});
