/**
 * studio-prints-six-are-the-templates.test.ts — STUDIO › PRINTS' SIX ARE ON THE TEMPLATES, AND SAVE WHAT THEY SAVED.
 *
 * Owner "approved" 2026-10-13 (DECISION_LOG "THE MAKER'S PRINTS SIX + THE SEAT COUNTER"; corpus `MAKER_PRINTS_SEAT_COUNTER_2026-10-13_fable.md`,
 * prototype `maker_prints_seat_counter_2026-10-13.html`) — "the six" that `72ce56e6b` ("Prints part one") named as not moved:
 *
 *   1 · Changed since you printed → status line (12, amber) + ONE quiet "Save again" — the piece's main file, through the one save
 *   2 · Parents' cards             → list rows (15) → the shipped guest card as a SHEET; ＋ Add a parent (9 quiet → 1 · 10 · 9); none → empty (16)
 *   3 · Kindly reply               → dropdown (2) + typed row (6) only for "Type it in…"; the SAME two fields, ONE field in TWO doors
 *   4 · Menu editor                → reorder (18/34) · open boxes (10) · chips (11) · quiet (9) · toast (12); SAVES AS YOU GO — same endpoint,
 *                                    the SAME `menu_json`, byte for byte (the builder note in the record), no Save button, no 303 reload
 *   5 · Pass card look             → style cards (5) — a pick still waits for Apply (the draft); ◆ on Free = the centred note (20), still the link
 *   6 · Poster photo               → two-way pill (1) · the upload square with the measured pie (21) · the plain-words problem + Change (12)
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the menu payload trimming differently from the old form · the menu given back a Save
 * button · the quiet save asking without `accept: application/json` · a kindly-reply carrier without `data-same-field` · the parent's sheet
 * drawing a name box instead of the card · the pass look saving live instead of to the draft · the Pro door losing its href · the poster's
 * small photo refused instead of warned · a static import of the six into a first-load Maker file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { menuPayload } from './studio-prints-six';

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
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const html = async (el: React.ReactElement) => (await import('react-dom/server')).renderToStaticMarkup(el);
const SIX = `${L}/studio-prints-six.tsx`;

const MENUS: Array<Array<{ title: string; dishes: string[] }>> = [
  [{ title: 'Cocktail hour', dishes: ['Lumpiang shanghai', 'Cheese & fruit'] }, { title: 'Reception & dinner', dishes: ['Lechon', 'Kare-kare'] }],
  [{ title: '  Dinner  ', dishes: ['  Lechon ', '', '   ', 'Pancit "Canton" \\ ñ — “quoted”'] }],
  [{ title: '', dishes: [''] }],
  [],
];

test('4a · the quiet save posts the SAME menu_json the old form did — the old editor’s own hidden input, byte for byte', async () => {
  const { PrintMenuEditor } = await import(`../${L}/print-menu-editor`);
  for (const m of MENUS) {
    if (!m.length) {
      assert.equal(menuPayload(m), '[]');
      continue;
    }
    const old = await html(React.createElement(PrintMenuEditor as never, { eventId: 'E1', initial: m, fromCaterer: false, suggestions: [], flash: null } as never));
    const v = old.match(/<input type="hidden" name="menu_json" value="([^"]*)"/)?.[1];
    assert.ok(v !== undefined, 'the old form no longer carries menu_json');
    const decoded = v.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    assert.equal(menuPayload(m), decoded, 'the new menu posts something else than the old form');
  }
});

test('4b · the menu saves as you go: no form, no Save, the same endpoint asked quietly, a toast on success, the red line with Try again on failure', async () => {
  const six = read(SIX);
  const menu = six.slice(six.indexOf('export function StudioMenuEditor('), six.indexOf('function BoxWithX('));
  assert.ok(menu.length > 3000, 'the menu editor moved — re-read this guard');
  assert.doesNotMatch(menu, /<form\b|type="submit"|Save menu/, 'the menu has a Save button or a native form again (a 303 page load)');
  assert.match(menu, /fetch\('\/api\/hub-print\/menu', \{ method: 'POST', body: fd, credentials: 'same-origin', headers: \{ accept: 'application\/json' \} \}\)/, 'the quiet save is not the same endpoint asked for { ok }');
  assert.match(menu, /fd\.set\('menu_json', payload\)/);
  assert.match(menu, /latest\.current = menuPayload\(v\)/, 'what is posted is not menuPayload');
  assert.match(menu, /<PeekToast\b/, 'a save is not the toast from the top');
  assert.match(menu, /<StatusLine tone="bad" data="menu-save" action=\{\{ label: 'Try again'/, 'a failure is not the red status line with Try again');
  assert.match(menu, /if \(n !== seq\.current\) return;/, 'an older save’s answer can speak over a newer one');
  /* Reorder: the dots (hold to lift), the arrows behind Arrange on a phone and shown on a computer (ruling 34). */
  assert.match(menu, /data-menu-grip=""[\s\S]{0,400}touch-none/, 'the dots do not hold the finger (the page would scroll)');
  assert.match(menu, /label=\{arrange \? 'Done' : 'Arrange'\}/);
  assert.match(menu, /\$\{arrange \? 'flex' : 'hidden'\} lg:flex/, 'the arrows are not behind Arrange on a phone / shown on a computer');
  assert.match(menu, /CHIP_CLASS\} \$\{CHIP_OFF_CLASS\}/, '"Add a moment" is not the chip');
  /* The route answers the quiet post in words, and still 303s the old form. */
  const route = read('app/api/hub-print/[piece]/route.ts');
  const branch = route.slice(route.indexOf("if (piece === 'menu') {"), route.indexOf('The reply line is a CHOICE'));
  assert.match(branch, /const quiet = \(req\.headers\.get\('accept'\) \?\? ''\)\.includes\('application\/json'\);/);
  assert.match(branch, /if \(quiet\) return NextResponse\.json\(\{ ok: !error \}, \{ status: error \? 500 : 200 \}\);/);
  assert.match(branch, /return NextResponse\.redirect\(back, 303\);\s*\}\s*$/m, 'the old form lost its 303');
  /* The shipped Details keeps its editor; only the Studio draws the new one. */
  const prints = read(`${L}/maker-prints.tsx`);
  assert.match(prints, /<StudioTool\s+part="menu"/);
  assert.match(prints, /<PrintMenuEditor\b/);
});

test('2 · parents: one row each → the card as a sheet (never a name box); ＋ Add a parent; none → the empty state', async () => {
  const { StudioParents, parentLineWords } = await import(`../${SIX.replace(/\.tsx$/, '')}`);
  const m = await html(
    React.createElement(StudioParents as never, {
      eventId: 'E1',
      parents: [
        { guestId: 'g1', name: 'Maria Santos', side: 'bride', card: React.createElement('p', null, 'card') },
        { guestId: null, name: 'Jose Santos', side: 'bride', card: null },
      ],
    } as never),
  );
  assert.match(m, /data-parent-open="g1"[\s\S]*?>MS<[\s\S]*?Maria Santos[\s\S]*?Bride’s parent · on your guest list[\s\S]*?text-sn-accent/, 'a parent is not the list row with the accent arrow');
  assert.match(m, />JS<[\s\S]*?Jose Santos/, 'a parent with no card is not still listed');
  assert.doesNotMatch(m, /<input\b/, 'a name box is drawn for a parent');
  assert.match(m, /class="ab ab-brand quiet[^"]*"[\s\S]*?Add a parent/, '＋ Add a parent is not the quiet action');
  assert.equal(parentLineWords('groom'), 'Groom’s parent · on your guest list');
  const none = await html(React.createElement(StudioParents as never, { eventId: 'E1', parents: [] } as never));
  assert.match(none, /data-parent-empty=""[\s\S]*?No parents on your guest list yet[\s\S]*?Add a parent/);
  const six = read(SIX);
  assert.match(six, /<Sheet open onClose=\{\(\) => setOpen\(null\)\} labelledById=\{headId\} rise>[\s\S]{0,400}\{openParent\.card\}/, 'the card does not open as the sheet');
  assert.match(six, /createPortal\(\s*<Sheet/, 'the sheet is not drawn on <body>');
  assert.match(six, /addSingleGuest\(eventId, draft\)/, 'adding a parent is not the Guest list’s own add');
  assert.match(six, /<PillSelector\s+label="Whose parent"/, 'the side is not the two-way pill');
});

test('3 · kindly reply: the dropdown, the typed row only for "Type it in…", the SAME two fields — each carrier a door of the one field', async () => {
  const { StudioKindlyReply, kindlyReplyOptions } = await import(`../${SIX.replace(/\.tsx$/, '')}`);
  const hosts = [
    { moderatorId: 'm1', label: 'Claire', contact: '0917 555 0142' },
    { moderatorId: 'm2', label: 'Marco', contact: null },
  ];
  assert.deepEqual(
    kindlyReplyOptions(hosts).map((o: { key: string; label: string; hint?: string }) => [o.key, o.label, o.hint ?? null]),
    [
      ['host:m1', 'Claire · 0917 555 0142', null],
      ['host:m2', 'Marco', 'no number on their account'],
      ['manual', 'Type it in…', null],
    ],
  );
  const host = await html(React.createElement(StudioKindlyReply as never, { form: 'details-print-words', hosts, choice: 'host:m1', manual: '' } as never));
  assert.match(host, /data-form-row-kind="chosen"[\s\S]*?Who guests reply to[\s\S]*?aria-haspopup="listbox"/);
  assert.doesNotMatch(host, /Reply line/, 'the typed row shows for a host');
  assert.doesNotMatch(host, /<select\b/, 'a bare select is back');
  for (const [name, value] of [['rsvp_choice', 'host:m1'], ['rsvp_manual', '']]) {
    const carrier = host.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? '';
    assert.match(carrier, /type="hidden"/);
    assert.match(carrier, /form="details-print-words"/, `${name} does not post through the print words form`);
    assert.match(carrier, new RegExp(`data-same-field="${name}"`), `${name} is not a door of the one field`);
    assert.match(carrier, new RegExp(`value="${value}"`));
  }
  const typed = await html(React.createElement(StudioKindlyReply as never, { form: 'details-print-words', hosts, choice: 'manual', manual: 'Reply by Nov 18' } as never));
  assert.match(typed, /Reply line[\s\S]*?Reply by Nov 18/, '"Type it in…" does not show the typed row');
  assert.match(typed, /name="rsvp_manual"[^>]*value="Reply by Nov 18"|value="Reply by Nov 18"[^>]*name="rsvp_manual"/);
  /* BOTH doors are the new one in the Studio — the shipped Maker keeps its select. */
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /const kindlyReply = props\.studio \? \(\s*<StudioTool part="kindly-reply" form=\{WORDS_FORM\}/);
  assert.match(details, /label="Kindly reply" on=\{inc\.rsvp\} tip=\{props\.studio \? PRINT_KINDLY_REPLY_TIP/);
});

test('1 · changed since you printed: the amber status line with ONE quiet "Save again" — the piece’s main file, through the one save', () => {
  const btn = read(`${L}/print-save-button.tsx`);
  const changed = btn.slice(btn.indexOf('export function ChangedSincePrinted('));
  assert.match(changed, /<StatusLine tone="warn" data="changed-since-printed" action=\{<PrintSaveButton href=\{again\.href\} file=\{again\.file\} variant="action" quiet label="Save again" \/>\}>/);
  assert.doesNotMatch(changed.slice(changed.indexOf('if (again) {'), changed.indexOf('return (\n    <p')), /border-l-2/, 'the Studio’s line is the bare bordered note');
  const prints = read(`${L}/maker-prints.tsx`);
  assert.match(prints, /again=\{themedReady \? \(\{ href: q\(k, 'print'\), file: file\.themed\(k\) \}\) : \{ href: classic\(k\), file: file\.classic\(k\) \}\}/, 'Save again is not the piece’s main file');
});

test('5 · the pass look is the style-card strip, a pick still waits for Apply; ◆ on Free is the centred note over the SAME link', async () => {
  const { PassCardDesignPicker } = await import(`../${L}/pass-card-design-picker`);
  const m = await html(
    React.createElement(PassCardDesignPicker as never, { eventId: 'E1', saved: 'ticket', studio: true, previews: { classic: '/c.png', ticket: '/t.png', poster: '/p.png' } } as never),
  );
  assert.equal((m.match(/data-bg-card="/g) ?? []).length, 3, 'the three looks are not the style cards');
  assert.match(m, /aria-pressed="true"[^>]*data-bg-card="ticket"/, 'the picked look is not the ringed card');
  assert.match(m, /Ticket style[\s\S]*?What each guest saves · waits for Apply/);
  assert.match(m, /class="sn-phone-card/, 'a card is not the one phone-shaped size');
  const src = read(`${L}/pass-card-design-picker.tsx`);
  assert.match(src, /fd\.set\('patch', JSON\.stringify\(passDesignDraftPatch\(design\)\)\);/, 'the pick no longer goes to the draft (Apply)');
  const { StudioProDoor } = await import(`../${SIX.replace(/\.tsx$/, '')}`);
  const door = await html(React.createElement(StudioProDoor as never, { href: '/dashboard/E1/studio/website-pro', label: 'Download all tickets (.zip)', icon: React.createElement('i'), note: { title: 't', body: 'b' } } as never));
  assert.match(door, /<a[^>]*href="\/dashboard\/E1\/studio\/website-pro"/, 'the ◆ door lost its link');
  const six = read(SIX);
  const pro = six.slice(six.indexOf('export function StudioProDoor('), six.indexOf('/* ── 6 · THE POSTER'));
  assert.match(pro, /e\.preventDefault\(\);\s*setOpen\(true\);/, 'a tap jumps to the page instead of opening the note');
  assert.match(pro, /confirmLabel="See Pro"\s*cancelLabel="Keep it"/);
});

test('6 · the poster photo: the two-way pill, the upload square with the measured pie, a small photo ALLOWED and warned with Change', async () => {
  const { StudioPosterPhoto } = await import(`../${SIX.replace(/\.tsx$/, '')}`);
  const small = await html(React.createElement(StudioPosterPhoto as never, { eventId: 'E1', saved: { ref: 'r2://media/events/E1/poster/a.jpg', w: 1200, h: 1600 }, thumb: '/poster.svg' } as never));
  assert.match(small, /data-pill-selector="poster-photo"[\s\S]*?Theme’s picture[\s\S]*?My photo/);
  assert.match(small, /data-poster-photo-square="has"/);
  assert.match(small, /role="alert" data-status-line="poster-photo-small" data-status-tone="bad"[\s\S]*?1200 × 1600 pixels — small for A3, so it may print soft[\s\S]*?>Change<\/button>/);
  const theme = await html(React.createElement(StudioPosterPhoto as never, { eventId: 'E1', saved: null, thumb: null } as never));
  assert.doesNotMatch(theme, /data-poster-photo-square/, 'the upload square shows with the theme’s picture');
  const six = read(SIX);
  assert.match(six, /onProgress=\{setPct\}/, 'the pie is not the upload’s own measured figure');
  assert.match(six, /fetch\('\/api\/hub-print\/poster-photo'/);
});

test('7 · no bare select, no colour of its own, and nothing of the six in the Maker’s first load', () => {
  const six = read(SIX);
  assert.doesNotMatch(six, /<select\b|<textarea\b|type="checkbox"|type="radio"|<PickMenu\b/, 'the six draw a bare control');
  assert.doesNotMatch(six, /\bbg-(?:terracotta|mulberry|gild|gold|amber|red)|\btext-(?:terracotta|mulberry)|\bborder-(?:terracotta|mulberry)|#[0-9a-fA-F]{3,8}\b/, 'the six write a colour of their own');
  for (const f of ['maker-prints.tsx', 'maker-details.tsx', 'details-lazy.tsx', 'maker-shell.tsx', 'details-workspace.tsx']) {
    const src = read(`${L}/${f}`).replace(/^import type [^;]*;$/gm, '').replace(/import\(\/\*[^*]*\*\/ '[^']*'\)/g, '');
    assert.doesNotMatch(src, /from '\.\/studio-prints-six'|from '@\/app\/_components\/(?:status-line|counter)'/, `${f} imports the six or a template statically`);
  }
  assert.match(read(`${L}/studio-tools.tsx`), /import \{ StudioKindlyReply, StudioMenuEditor, StudioParents, StudioPosterPhoto, StudioProDoor \} from '\.\/studio-prints-six';/);
});
