/**
 * prints-carousel-follows-the-prototype.test.ts — STUDIO › PRINTS IS A SWIPE CAROUSEL (owner, verbatim, 2026-10-26: *"So we can make
 * like a swipe carousel type where they can see the preview larger then under is the toolbar to pick style? and download options?"* ·
 * *"Does it have print setting icon also"* · *"Ok build it"*; DECISION_LOG "APPROVED — PRINTS IS A SWIPE CAROUSEL"; prototype
 * `prototypes/prints_carousel_2026-10-26/index.html`, its per-print table of every slide's controls).
 *
 * THE CLAIMS, each read off what is DRAWN (every print's editor rendered as Studio draws it, then the carousel drawn from the slides
 * they registered) or the source that draws it:
 *   1 · every per-guest slide offers the SHARED Pick guests (Download ▾ → Pick guests…, the one `GuestManySheet` over the all-guests
 *       file) — and no other slide does: a print that is not per guest has a plain Download, one press, one file;
 *   2 · Download ▾'s items save the SAME files, from the SAME routes, as the rows did — This one (the guest View as ▾ shows, free),
 *       All guests (the all-guests file, or its ◆ door), Pick guests… (that file narrowed by `guests=`);
 *   3 · the count line under each slide is ITS file's own line — the pass list on the pass, the QR sheet's list on the QR codes, the
 *       seated list on the place cards (`guestPrintCountLine`) — never another print's number;
 *   4 · ⚙ Print settings is on EVERY slide (the phone's toolbar and the computer's right column) and opens the one sheet;
 *   5 · cheap to swipe: only the slide on screen and its two neighbours ask for their picture — every other slide is its paper's shape;
 *   6 · the long row list, the piece bar and the tap-to-enlarge sheet are DELETED, not hidden; the dev lab reaches this surface;
 *   7 · the Digital ticket's three looks are ON ITS SLIDE, not in ⚙ Print settings (owner 2026-10-26, verbatim: *"The 3 designs for
 *       the digital ticket should be on the carousel and not on settings."*): Classic ▾ beside View as ▾ (each look's picture in the
 *       list), a pick redraws the slide for the guest shown, and it waits for Apply through the ONE pick (`usePassLookPick` — the
 *       Maker's draft store and the draft save) — the sheet no longer draws it.
 *
 * SABOTAGE (seen RED, then restored — see the PR): Pick guests… dropped from Download ▾ (`guestDownloadOptions`) → (1) red ·
 * the Style ▾ dropped from the Digital ticket's toolbar (`choiceControls`) → (7) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { carouselAt, endSlides, slidesOf, type SlideItem } from './prints-slides.test-helper';
import { GUEST_PRINT_KEYS, GUEST_TOKEN, guestPrintCountLine, type PrintGuest } from './studio-prints-settings';
import { freePrints } from './free-prints';
import { PASS_CARD_ROUTE, PASS_CARDS_ZIP_ROUTE } from './pass-card';
import { pickedFile } from './print-picked-guests';

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
const g = (n: number, name: string, reply: PrintGuest['reply']): PrintGuest => ({ id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`, name, reply });
/* Three DIFFERENT lists — so a count line that reads another print's list is caught. */
const PASS = [g(1, 'Ana Reyes', 'attending'), g(2, 'Ben Cruz', 'pending'), g(3, 'Carla Dizon', 'maybe')];
const QR = [...PASS, g(4, 'Dante Lim', 'pending'), g(5, 'Elena Santos', 'attending')];
const SEATED = [g(1, 'Ana Reyes', 'attending')];

async function everySlide(ownsPro = false, storeShell = false) {
  const { formatFor } = await import('./print-pieces');
  const input = { eventId: 'E1', slug: 'rosa-ben', theme: 'house', ownsPro, storeShell, passGuests: PASS, qrGuests: QR, seatedGuests: SEATED, passCardsZip: 'rosa-ben-tickets.zip', formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! } };
  const { PrintPieceEditor, DigitalTicketEditor, PrintEverythingStudio, freePrintParts, printPlan } = await import(`../${L}/maker-prints`);
  const day = (freePrintParts as (...a: unknown[]) => Array<{ key: string; label: string; editor: React.ReactNode }>)('E1', 'rosa-ben', input, true);
  const set = ['invitation', 'entourage', 'details', 'menu', 'pass', 'poster', 'story-poster', 'card'] as const;
  const slides = await slidesOf([
    ...set.map((k) => React.createElement(PrintPieceEditor as never, { input, piece: k, studio: true } as never)),
    React.createElement(DigitalTicketEditor as never, { input } as never),
    ...day.map((f) => f.editor),
    React.createElement(PrintEverythingStudio as never, { input } as never),
  ]);
  const items: SlideItem[] = [
    ...set.map((k) => ({ key: k, label: k, group: 'set' as const })),
    { key: 'digital-ticket', label: 'Digital ticket', group: 'set' },
    ...day.map((f) => ({ key: f.key, label: f.label, group: 'day' as const })),
    { key: 'download', label: 'Everything', group: 'download' },
  ];
  return { slides, items, plan: (printPlan as (i: unknown) => { classic: (p: string) => string; q: (p: string, m: string) => string; themedReady: boolean })(input) };
}

const toolsOf = (html: string) => html.slice(html.indexOf('data-prints-tools="phone"'), html.indexOf('data-prints-tools="desk"'));
const deskOf = (html: string) => html.slice(html.indexOf('data-prints-tools="desk"'));

test('1 · every per-guest slide offers the shared Pick guests — and no other slide does', async () => {
  const { guestDownloadOptions } = await import(`../${L}/studio-prints-carousel`);
  const options = guestDownloadOptions as (s: unknown, guest: PrintGuest | null) => Array<{ key: string; label: string }>;
  /* A Pro event: all four per-guest prints offer it. A free one: wherever All guests itself saves — the place cards' whole pack is the ◆
     door for a free couple, and a pick never reaches past the all-guests file's own gate (the row's own ruling, 2026-10-26). */
  for (const pro of [true, false]) try {
    const { slides, items } = await everySlide(pro);
    for (const it of items) {
      const s = slides.get(it.key);
      assert.ok(s, `${it.key}: no slide registered`);
      const html = await carouselAt(items, it.key);
      const tools = toolsOf(html);
      const perGuest = (GUEST_PRINT_KEYS as readonly string[]).includes(it.key);
      const keys = options(s, PASS[0]!).map((o) => o.key);
      if (perGuest && s!.guest!.all?.kind !== 'save') {
        assert.ok(!pro && it.key === 'seating-pack', `${it.key}: All guests is the ◆ door for ${pro ? 'a Pro' : 'a free'} event`);
        assert.deepEqual(keys, ['one', 'all'], `${it.key}: Pick guests… reaches past the ◆ door`);
      } else if (perGuest) {
        assert.ok(keys.includes('pick'), `${it.key}: Download ▾ does not offer Pick guests…`);
        assert.equal(options(s, PASS[0]!).find((o) => o.key === 'pick')!.label, 'Pick guests…');
        assert.ok(s!.guest!.pickNoun, `${it.key}: no noun for the shared Pick guests sheet`);
        assert.match(tools, /data-prints-download=""[^>]*aria-haspopup="listbox"|aria-haspopup="listbox"[^>]*data-prints-download=""/, `${it.key}: Download is not one dropdown with its options`);
      } else {
        assert.deepEqual(keys, [], `${it.key}: a print that is not per guest offers guest options`);
        assert.equal(s!.guest, undefined, `${it.key}: a print that is not per guest carries guests`);
        assert.doesNotMatch(tools, /data-prints-download=""|Pick guests/, `${it.key}: a plain print draws Download ▾ or Pick guests`);
      }
    }
  } finally {
    await endSlides();
  }
  /* The ONE shared sheet (rd/pick-guests-for-tickets' `GuestManySheet`), over the slide's all-guests file — no second picker. */
  const carousel = read(`${L}/studio-prints-carousel.tsx`);
  assert.match(carousel, /<GuestManySheet guests=\{list\} href=\{g\.all\.href\} file=\{g\.all\.file\} noun=\{g\.pickNoun\}/, 'Pick guests… is not the shared sheet over the all-guests file');
  assert.equal((carousel.match(/<GuestManySheet\b/g) ?? []).length, 1, 'a second Pick guests sheet');
  assert.doesNotMatch(carousel, /function GuestManySheet|aria-multiselectable/, 'the carousel draws a picker of its own');
});

test('2 · Download ▾ saves the same files, from the same routes, as the rows did', async () => {
  try {
    const { slides, plan } = await everySlide();
    const day = freePrints('E1', 'rosa-ben');
    const pass = slides.get('pass')!.guest!;
    const passOne = plan.themedReady ? plan.q('pass', 'print') : plan.classic('pass');
    assert.equal(pass.one.href, `${passOne}&pass_guest=${GUEST_TOKEN}`, 'This pass is not the row’s own file for the guest picked');
    assert.equal(pass.all?.kind === 'save' && pass.all.href, plan.themedReady ? plan.q('passes', 'print') : plan.classic('passes'), 'All guests is not every guest’s pass');
    const ticket = slides.get('digital-ticket')!.guest!;
    assert.equal(ticket.one.href, `${PASS_CARD_ROUTE}?guest=${GUEST_TOKEN}`, 'This ticket is not the Guest list’s own per-guest PNG');
    assert.equal(ticket.all?.kind === 'save' && ticket.all.href, `${PASS_CARDS_ZIP_ROUTE}?event=E1`, 'All guests is not the zip of every ticket');
    const qr = slides.get('qr-codes')!.guest!;
    assert.equal(qr.one.href, `/api/website/qr/guest/${GUEST_TOKEN}`, 'This QR code is not that guest’s own QR');
    assert.equal(qr.all?.kind === 'save' && qr.all.href, day.find((f) => f.key === 'qr-codes')!.saves[0]!.href, 'All guests is not the QR sheet');
    const cards = slides.get('seating-pack')!.guest!;
    assert.equal(cards.one.href, `/dashboard/E1/seating/print?format=pdf&guest=${GUEST_TOKEN}`, 'This place card is not that guest’s card alone');
    /* The pack (Pro) — a free couple's All guests is the ◆ door to the one unlock page, never a file; Pick guests then is not offered. */
    assert.equal(cards.all?.kind, 'door');
    for (const [k, s] of [['pass', pass], ['digital-ticket', ticket], ['qr-codes', qr]] as const) {
      /* Pick guests… is the all-guests file narrowed to the guests ticked — the one rule (`pickedFile`). */
      const all = s.all as { href: string; file: string };
      const out = pickedFile({ href: all.href, file: all.file }, [PASS[0]!.id], s.pickNoun!);
      assert.ok(out.href.startsWith(all.href.split('?')[0]!), `${k}: Pick guests… saves from another route than All guests`);
      assert.match(out.href, /[?&]guests=/, `${k}: Pick guests… does not narrow the all-guests file`);
    }
    /* The plain prints' one file is the file the row always saved. */
    assert.equal(slides.get('invitation')!.download!.href, plan.themedReady ? plan.q('invitation', 'print') : plan.classic('invitation'));
    assert.equal(slides.get('guest-registry')!.download!.href, day.find((f) => f.key === 'guest-registry')!.saves[0]!.href);
    assert.deepEqual(slides.get('seat-plan')!.choice!.options.map((o) => o.href), day.find((f) => f.key === 'seat-plan')!.saves.map((sv) => sv.href), 'Colours ▾ picks other files than the seat plan saves');
  } finally {
    await endSlides();
  }
  /* The picks run the ONE save (`usePrintSave`, the same fetch → share / download as every Download), with the guest swapped in. */
  const carousel = read(`${L}/studio-prints-carousel.tsx`);
  assert.match(carousel, /if \(k === 'one' && guest\) run\(swap\(g\.one\.href, guest\), swap\(g\.one\.file, guest\)\);/);
  assert.match(carousel, /else if \(k === 'all' && g\.all\?\.kind === 'save'\) run\(g\.all\.href, g\.all\.file\);/);
  assert.match(carousel, /else if \(k === 'all' && g\.all\?\.kind === 'door'\) setDoor\(g\.all\);/, 'a ◆ All guests does not open the Pro note');
  assert.match(carousel, /const save = usePrintSave\(\);/);
  assert.match(read(`${L}/print-save-button.tsx`), /const \{ state, save \} = usePrintSave\(\);\s*const run = \(\) => save\(href, fileName\);/, 'the Download button and the carousel do not share one save');
});

test('3 · the count line under each slide is its own file’s line', async () => {
  try {
    const { items } = await everySlide();
    const lists: Record<string, readonly PrintGuest[]> = { pass: PASS, 'digital-ticket': PASS, 'qr-codes': QR, 'seating-pack': SEATED };
    for (const k of GUEST_PRINT_KEYS) {
      const html = await carouselAt(items, k);
      const said = toolsOf(html).match(new RegExp(`data-prints-count="${k}"[^>]*>([^<]*)<`))?.[1];
      assert.equal(said, guestPrintCountLine(k, lists[k]!), `${k}: the count line is not its own file’s`);
      assert.equal(deskOf(html).match(new RegExp(`data-prints-count="${k}"[^>]*>([^<]*)<`))?.[1], said, `${k}: the computer says another count`);
    }
    /* A plain print says its file — its kind (and, once the route has said, its pages). */
    const poster = await carouselAt(items, 'poster');
    assert.match(toolsOf(poster), /data-prints-count="poster"[^>]*>PDF</);
  } finally {
    await endSlides();
  }
});

test('4 · ⚙ Print settings is on every slide — and opens the one sheet', async () => {
  try {
    const { items } = await everySlide();
    for (const it of items) {
      const html = await carouselAt(items, it.key);
      assert.match(toolsOf(html), /data-prints-settings=""[\s\S]*?aria-label="Print settings"/, `${it.key}: no ⚙ on the phone’s toolbar`);
      assert.match(deskOf(html), /data-prints-settings-row=""[\s\S]*?Print settings/, `${it.key}: no Print settings row on the computer`);
    }
  } finally {
    await endSlides();
  }
  const carousel = read(`${L}/studio-prints-carousel.tsx`);
  assert.equal((carousel.match(/onClick=\{\(\) => setPrintSettingsOpen\(true\)\}/g) ?? []).length, 2, '⚙ does not open the one sheet (phone and computer)');
  assert.match(read(`${L}/studio-prints-settings.tsx`), /const open = usePrintSettingsOpen\(\);/);
});

test('5 · cheap to swipe — only the slide on screen and its neighbours ask for their picture', async () => {
  try {
    const { items } = await everySlide();
    const at = items.findIndex((x) => x.key === 'poster');
    const html = await carouselAt(items, 'poster');
    const phone = html.slice(html.indexOf('data-prints-track="phone"'), html.indexOf('data-prints-track="desk"'));
    const states = [...phone.matchAll(/data-prints-paper="([^"]+)" data-prints-paper-state="([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const);
    assert.equal(states.length, items.length, 'not one paper per slide');
    states.forEach(([key, state], j) => {
      if (Math.abs(j - at) <= 1) assert.notEqual(state, 'far', `${key}: a neighbour of the slide on screen does not ask for its picture`);
      else assert.equal(state, 'far', `${key}: a slide far from the screen asks for its picture`);
    });
  } finally {
    await endSlides();
  }
  assert.match(read(`${L}/studio-prints-carousel.tsx`), /const \[first, retryFirst\] = usePaper\(src, near, current\);/, 'a picture is asked whether or not its slide is near');
});

test('6 · the long list, the piece bar and the tap-to-enlarge sheet are deleted — and the dev lab reaches this surface', () => {
  assert.equal(existsSync(join(WEB, `${L}/studio-prints-bar.tsx`)), false, 'the piece bar is back');
  const paper = read(`${L}/print-paper.tsx`);
  assert.doesNotMatch(paper, /function (?:PrintPaperSheet|PrintPaperHead|PrintThumb)\b/, 'the row thumbnail or the tap-to-enlarge sheet is back');
  const settings = read(`${L}/studio-prints-settings.tsx`);
  assert.doesNotMatch(settings, /function (?:StudioPrintsDownloadSheet|ViewAsRow|AllInOneButton|StudioEditInPlace)\b/, 'a control of the long list is back');
  for (const part of ['StudioGuestPiece', 'StudioPieceDownload', 'StudioFileChoice', 'StudioEverything']) {
    const body = settings.slice(settings.indexOf(`export function ${part}(`));
    assert.match(body.slice(0, body.indexOf('\n}\n')), /useRegisterSlide\([\s\S]*\);\s*return null;\s*$/, `${part} draws a row again instead of registering its slide`);
  }
  /* The lab's Details is the real Maker's — its Studio (the owner's phone), never Details' retired one-piece view. */
  assert.match(read('app/dev/maker-lab/page.tsx'), /detailsLabNode\(\{ \.\.\.sp, studio: '1', /, 'the lab reaches another Prints view than the owner’s');
});

test('7 · the Digital ticket’s three looks are on its slide — Classic ▾ beside View as ▾ — and not in Print settings', async () => {
  const { withTicketLook } = await import(`../${L}/studio-prints-carousel`);
  const ticketLook = withTicketLook as (src: string, d: string) => string;
  try {
    const { slides, items } = await everySlide();
    const ticket = slides.get('digital-ticket')!;
    assert.ok(ticket.ticketStyle, 'the Digital ticket carries no look to pick');
    assert.deepEqual(Object.keys(ticket.ticketStyle!.previews).sort(), ['classic', 'poster', 'ticket'], 'not the three looks, each with its picture');
    for (const it of items) {
      const html = await carouselAt(items, it.key);
      const tools = toolsOf(html);
      const desk = deskOf(html);
      if (it.key !== 'digital-ticket') {
        assert.doesNotMatch(tools + desk, /data-prints-ticket-style/, `${it.key}: the ticket look is offered on another print`);
        continue;
      }
      const row1 = tools.slice(tools.indexOf('data-prints-row="choose"'), tools.indexOf('data-prints-row="act"'));
      assert.match(row1, /aria-haspopup="listbox"[^>]*data-prints-ticket-style=""|data-prints-ticket-style=""[^>]*aria-haspopup="listbox"/, 'the look is not one house dropdown in the toolbar’s first row');
      assert.match(row1, /data-prints-ticket-style=""[^>]*>[\s\S]*?Classic</, 'Style ▾ does not name the look being edited');
      assert.ok(row1.indexOf('data-prints-ticket-style') < row1.indexOf('data-prints-view-as'), 'Style ▾ is not beside View as ▾, before it');
      assert.match(desk, /data-form-row="prints-style"[\s\S]*?data-prints-ticket-style=""/, 'on a computer the look is not a Form row of the right column');
      /* The big preview is the guest's own ticket in the look being edited. */
      assert.match(html, /data-prints-paper="digital-ticket"/);
    }
  } finally {
    await endSlides();
  }
  /* A pick redraws the slide: its address carries the look picked — the route draws the look asked for. */
  assert.equal(ticketLook('/api/guest/pass-card?guest=g1&design=classic', 'poster'), '/api/guest/pass-card?guest=g1&design=poster');
  assert.equal(ticketLook('/api/guest/pass-card?guest=g1', 'ticket'), '/api/guest/pass-card?guest=g1&design=ticket');
  const carousel = read(`${L}/studio-prints-carousel.tsx`);
  assert.match(carousel, /return \{ src: slide\.ticketStyle && ticketLook \? withTicketLook\(drawn, ticketLook\) : drawn, aspect: paper\.aspect \};/, 'the slide does not redraw in the look picked');
  /* ONE state, ONE save: the slide and the dropdown read the same pick, which is the picker's own (the draft — waits for Apply). */
  assert.match(carousel, /const look = usePassLookPick\(ticket\?\.guest\?\.eventId \?\? '', ticket\?\.ticketStyle\?\.saved \?\? DEFAULT_PASS_CARD_DESIGN\);/);
  assert.match(carousel, /onPick=\{look\.pick\}/);
  assert.match(carousel, /What each guest saves · waits for Apply/, 'the open list does not say the pick waits for Apply');
  assert.doesNotMatch(carousel, /passDesignDraftPatch|noteDraftedPassLook|hubDraftAction/, 'the carousel saves the look a way of its own — a fork of the state');
  const picker = read(`${L}/pass-card-design-picker.tsx`);
  const hook = picker.slice(picker.indexOf('export function usePassLookPick('), picker.indexOf('export function PassCardDesignPicker('));
  assert.match(hook, /const read = draftedPassLookOr\(saved\);/);
  assert.match(hook, /fd\.set\('patch', JSON\.stringify\(passDesignDraftPatch\(design\)\)\);/, 'the pick no longer goes to the draft (Apply)');
  assert.match(picker, /const \{ shown, pick, pending, error \} = usePassLookPick\(eventId, saved\);/, 'the picker keeps a second copy of the pick');
  /* …and the sheet no longer draws it (no duplicate). */
  const details = read(`${L}/maker-details.tsx`);
  const sheet = details.slice(details.indexOf('editors[EVERY_PRINT_ITEM] = ('), details.indexOf('editors[DIGITAL_TICKET_ITEM]'));
  assert.doesNotMatch(sheet, /TicketStyle|PassCardDesignPicker/, 'Ticket style is still in Print settings');
  assert.doesNotMatch(read(`${L}/maker-prints.tsx`), /export function TicketStyle\b/, 'the settings strip is back');
  assert.doesNotMatch(picker, /studio\?: boolean|data-pass-card-design-studio/, 'the settings strip is back');
});
