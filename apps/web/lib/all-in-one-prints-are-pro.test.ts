/**
 * all-in-one-prints-are-pro.test.ts — EVERY "DOWNLOAD ALL" IS EVENT HUB PRO; ONE AT A TIME IS FREE (owner 2026-10-16, DECISION_LOG
 * "PRINTS: ONE AT A TIME IS FREE — EVERY 'DOWNLOAD ALL' IS EVENT HUB PRO"; verbatim: *"Yes — Whole set (PDF) and Every guest's pass
 * (PDF) become Pro. Each piece's own PDF, and each guest's own pass one at a time, stay free."*).
 *
 *   1 · THE SERVER REFUSES: `/api/hub-print` is CALLED (its own GET, the I/O stood in for) — a free event asking for every guest's
 *       passes or the whole set gets 403 with the words, in Classic too, before anything is drawn; a Pro event (an internal host's
 *       counts — `printOwnsPro` is `eventSkuActive`) goes on to draw; ONE guest's pass and a piece's own PDF go on for a free event.
 *   2 · THE PAGE MARKS THEM: on Studio › Prints every all-in-one file is the zip's ◆ pattern — a free couple: the door to the one
 *       unlock page (never a page jump: the centred note); a Pro couple: the file, ◆ unlocked; the store shell without it: nothing —
 *       and the one-guest pass is a plain free Save.
 *
 * 🗂 2026-10-17 (DECISION_LOG "PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS, ALL GUESTS ◆,
 * EVERYTHING ◆"): the Guest QR sheet, the place-card pack and Everything are all-in-one files too; every guest print's "All guests"
 * wears the ◆ pattern, and its Download (one guest) is a plain free Save. "Pass for ▾" is retired — View as ▾ picks the guest.
 *
 * 🎟 2026-10-22 (owner, verbatim: *"the goal of the free is to keep everything minimum ready but no personalization."* · *"they pay to
 * customize it."*; DECISION_LOG "FREE IS READY, PRO IS PERSONAL — ALL TICKETS AND THE QR SHEET ARE FREE"): every guest's pass in one
 * file and the Guest QR sheet are FREE again — served to a free event, store shell included, as a plain Download (no ◆). The DESIGNED
 * set in one file stays Pro: the whole set, Everything, the place-card pack. The ticket zip (digital PNGs) kept its own ◆ (2026-09-29)…
 *
 * 🎟 …until later the same day (owner "yes", DECISION_LOG "THE DIGITAL TICKET ZIP IS FREE"; under his rule above): the DIGITAL TICKET
 * ZIP (`/api/guest/pass-card/all`, every guest's ticket picture, for sending by phone) is FREE — it is how couples hand out tickets.
 *   1d · its route is CALLED for a free event: no Pro question, straight to the guest list and on to the ONE kit (`loadPassCardKit`
 *        → `loadPrintSet`, whose door draws a free event plain white — #6744);
 *   2  · Studio › Prints' Digital ticket "All guests" and the shipped Details' "Download all tickets (.zip)" are a plain Download
 *        (no ◆, no door) for every event, store shell included.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the route's refusal removed · the refusal asking `printReady` (a theme rule)
 * instead of the event's Pro · the Event pass's all-guests file drawn as a plain save · one guest's pass treated as all-in-one.
 * The zip (2026-10-22): the route's Pro refusal put back · Studio's Digital ticket "All guests" back to the ◆ door · the shipped
 * Details' zip back to the ◆ door — each RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { endSlides, slidesOf } from './prints-slides.test-helper';
import { GUEST_WORD_TOKEN, guestFileWord } from './studio-prints-settings';
import { renderSettled } from './render-settled.test-helper';
import { isAllInOnePrint } from './print-pieces';

(globalThis as unknown as { React: unknown }).React = React;

/* ── The route's I/O, stood in for: who is asking, whether the event owns Pro, and a spy on the first drawing read. ── */
const state = { ownsPro: false, drew: 0, guestReads: 0, zipGuests: 0 };
/** Any admin read answers "nothing" — so a request that gets past the gate reaches its guest read (spied below), not a TypeError. */
const NOTHING: unknown = new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: null, error: null }) : NOTHING),
  apply: () => NOTHING,
});
{
  const Mod = require('node:module');
  const load = Mod._load;
  const stubs: Record<string, unknown> = {
    'server-only': {},
    'client-only': {},
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'host' } } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => NOTHING },
    '@/lib/host-gate': { getHostUserId: async () => 'host' },
    '@/lib/request-platform': { isStoreShellRequest: async () => false },
  };
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request in stubs) return stubs[request];
    if (request === '@/lib/print-set.server') {
      const real = load.call(this, request, ...rest) as Record<string, unknown>;
      return {
        ...real,
        printOwnsPro: async () => state.ownsPro,
        readPrintEvent: async () => ({ event_id: EVENT, slug: 'rosa-ben', invite_theme: 'house', print_details: null }),
        loadPrintSet: async () => {
          state.drew += 1;
          return null; // → 404 "Event not found." — proof the request got PAST the gate, without drawing anything.
        },
        printInputsVersion: async () => null,
        loadGuestPasses: async () => {
          state.guestReads += 1;
          return { passes: [], images: {}, measured: false }; // → 503 — proof the request got PAST the gate to the guest list.
        },
      };
    }
    if (request === '@/lib/pass-card.server') {
      const real = load.call(this, request, ...rest) as Record<string, unknown>;
      return {
        ...real,
        // The zip's guest read: one guest who HAS a ticket — so a request past the gate goes on to the kit (`loadPassCardKit`, real),
        // whose `loadPrintSet` is spied above (→ null → 404 "Event not found.").
        eligiblePassCardGuests: async () => {
          state.zipGuests += 1;
          return { guests: [{ guest_id: GUEST, first_name: 'Ana', last_name: 'Reyes' }], measured: true };
        },
      };
    }
    return load.call(this, request, ...rest);
  };
}
const EVENT = '11111111-2222-4333-8444-555555555555';
const GUEST = '00000000-0000-4000-8000-000000000101';

async function ask(path: string, ownsPro: boolean): Promise<{ status: number; text: string; drew: boolean; readGuests: boolean }> {
  const { GET } = await import('../app/api/hub-print/[piece]/route');
  state.ownsPro = ownsPro;
  state.drew = 0;
  state.guestReads = 0;
  const piece = path.split('?')[0]!;
  const res = await GET(new Request(`https://x.test/api/hub-print/${path}`), { params: Promise.resolve({ piece }) });
  return { status: res.status, text: await res.text(), drew: state.drew > 0, readGuests: state.guestReads > 0 };
}

test('the rule: the whole set, Everything and the place-card pack are all-in-one; every guest’s pass, the QR sheet, a piece, one pass and the set’s sample are not', () => {
  /* 2026-10-22: every guest's pass in one file and the Guest QR sheet are FREE — in every mode. */
  for (const m of ['screen', 'sample', 'print'] as const) {
    assert.equal(isAllInOnePrint('passes', m), false, `every guest’s pass in one file (${m}) is Pro again`);
    assert.equal(isAllInOnePrint('qr-codes', m), false, `the Guest QR sheet (${m}) is Pro again`);
  }
  assert.equal(isAllInOnePrint('set', 'print'), true);
  assert.equal(isAllInOnePrint('set', 'sample'), false, 'the whole set’s watermarked sample sheet stays free');
  assert.equal(isAllInOnePrint('pass', 'print'), false, 'one guest’s pass is the Event pass piece — free');
  for (const k of ['invitation', 'entourage', 'details', 'menu', 'poster', 'story-poster', 'card']) assert.equal(isAllInOnePrint(k, 'print'), false);
  /* 2026-10-17: every place card and Everything (the QR sheet left on 2026-10-22). */
  assert.equal(isAllInOnePrint('seating-pack', 'print'), true);
  assert.equal(isAllInOnePrint('everything', 'print'), true);
  assert.equal(isAllInOnePrint('guest-registry', 'print'), false, 'the registry is not a guest’s file — it stays free');
});

test('1 · the server refuses the designed set in one file to a free event — Classic too — and serves it to a Pro event', async () => {
  for (const path of [
    `set?event=${EVENT}&mode=print&theme=house`,
    `everything?event=${EVENT}&mode=print&theme=house`,
  ]) {
    const free = await ask(path, false);
    assert.equal(free.status, 403, `${path}: a free event is not refused`);
    assert.match(free.text, /Event Hub Pro/, `${path}: the refusal does not say why`);
    assert.doesNotMatch(free.text, /₱|PHP\s?\d/, 'a price in the refusal');
    assert.equal(free.drew, false, `${path}: something was drawn before the refusal`);
    const pro = await ask(path, true);
    assert.notEqual(pro.status, 403, `${path}: a Pro event is refused`);
    assert.equal(pro.drew, true, `${path}: a Pro event does not reach the drawing`);
  }
});

test('1c · the Guest QR sheet — the PDF and its picture — is served to a free event (2026-10-22): no Pro question, straight to the guest list', async () => {
  for (const path of [`qr-codes?event=${EVENT}`, `qr-codes?event=${EVENT}&mode=print`, `qr-codes?event=${EVENT}&mode=screen`]) {
    const free = await ask(path, false);
    assert.notEqual(free.status, 403, `${path}: a free event is refused every guest’s QR`);
    assert.doesNotMatch(free.text, /Event Hub Pro/, `${path}: the answer still says the QR sheet is Pro`);
    assert.equal(free.readGuests, true, `${path}: a free event does not reach the guest list`);
  }
});

test('1b · …and EVERY guest’s pass in one file (2026-10-22), ONE guest’s pass, a piece’s own PDF and the set’s sample are free', async () => {
  for (const path of [
    `passes?event=${EVENT}&mode=print&theme=house&pass_format=calling-card`,
    `passes?event=${EVENT}&mode=print&theme=house&pass_format=phone-card`,
    `pass?event=${EVENT}&mode=print&theme=house&pass_format=train&pass_guest=${GUEST}`,
    `invitation?event=${EVENT}&mode=print&theme=house`,
    `set?event=${EVENT}&mode=sample&theme=house`,
  ]) {
    const free = await ask(path, false);
    assert.notEqual(free.status, 403, `${path}: a free event is refused a free file`);
    assert.equal(free.drew, true, `${path}: a free event does not reach the drawing`);
  }
});

test('1d · the DIGITAL TICKET ZIP is served to a free event (2026-10-22): no Pro question — the guest list, then the one kit', async () => {
  const { GET } = await import('../app/api/guest/pass-card/all/route');
  for (const ownsPro of [false, true]) {
    state.ownsPro = ownsPro;
    state.drew = 0;
    state.zipGuests = 0;
    const res = await GET(new Request(`https://x.test/api/guest/pass-card/all?event=${EVENT}`));
    const text = await res.text();
    const who = ownsPro ? 'a Pro event' : 'a free event';
    assert.notEqual(res.status, 403, `${who} is refused the ticket zip: ${text}`);
    assert.doesNotMatch(text, /Event Hub Pro/, `${who}: the zip's answer still says it is Pro`);
    assert.equal(state.zipGuests, 1, `${who} does not reach the guest list`);
    /* …and the cards are drawn from the ONE kit — `loadPrintSet`, whose look door (`printLookForEvent`) makes a free event's
       tickets plain white and a Pro event's its Hub look (held in the-pro-list-names-only-real-gates § 5b). */
    assert.equal(state.drew > 0, true, `${who}: the zip does not draw from the print set (its look)`);
    assert.equal(res.status, 404, `${who}: expected the stubbed print set's "Event not found." — got ${res.status} ${text}`);
  }
});

/** A slide's files as a press saves them: the ◆ door (and its mark), or the file (named for the first guest on a guest print). */
function filesOf(slide: { guest?: { one: { file: string }; all: unknown; guests: ReadonlyArray<{ name: string }> | null }; everything?: { all: unknown }; download?: { file: string } | null } | undefined): string {
  if (!slide) return '';
  const all = (f: unknown) => {
    const x = f as { kind: 'save'; file: string; icon?: { props: { state: string } } } | { kind: 'door'; icon: { props: { state: string } } } | null;
    if (!x) return '';
    if (x.kind === 'door') return ` data-print-all-in-one-pro="" data-paid-mark="${x.icon.props.state}"`;
    return ` data-print-save="${x.file}"${x.icon ? ` data-paid-mark="${x.icon.props.state}"` : ''}`;
  };
  const first = slide.guest?.guests?.[0];
  const one = slide.guest && first ? ` data-print-save="${slide.guest.one.file.split(GUEST_WORD_TOKEN).join(guestFileWord(first.name))}"` : '';
  return `${one}${slide.guest ? all(slide.guest.all) : ''}${slide.everything ? all(slide.everything.all) : ''}${slide.download ? ` data-print-save="${slide.download.file}"` : ''}`;
}

test('2 · Studio › Prints marks every all-in-one file with the zip’s ◆ pattern; one guest’s file is a plain free Download', async () => {
  const L = '../app/dashboard/[eventId]/launch/_components';
  const { PrintPieceEditor, PrintEverythingStudio, DigitalTicketEditor, PrintSetDownloads, PassCardsPanel, freePrintParts } = await import(`${L}/maker-prints`);
  const { formatFor } = await import('./print-pieces');
  const draw = async (ownsPro: boolean, storeShell: boolean) => {
    const input = {
      eventId: 'E1', slug: 'rosa-ben', theme: 'house', ownsPro, storeShell,
      formats: { pass: formatFor('pass', 'train')!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
      passGuests: [{ id: GUEST, name: 'Ana Reyes', reply: 'attending' as const }, { id: '00000000-0000-4000-8000-000000000102', name: 'Ben Cruz', reply: 'pending' as const }],
      passCardsZip: 'rosa-ben-tickets.zip',
    };
    /* 🎠 Studio › Prints is one slide per print (2026-10-26): each print REGISTERS its files, the carousel's Download ▾ saves them.
       Read them as the files a press saves — the ◆ door and its mark, or the file and its name (the guest's file named for Ana). */
    const free = (freePrintParts as (...a: unknown[]) => Array<{ key: string; editor: React.ReactNode }>)('E1', 'rosa-ben', input, true);
    const slides = await slidesOf([
      React.createElement(PrintPieceEditor as never, { input, piece: 'pass', studio: true } as never),
      React.createElement(PrintEverythingStudio as never, { input } as never),
      React.createElement(DigitalTicketEditor as never, { input } as never),
      ...free.filter((f) => f.key === 'qr-codes' || f.key === 'seating-pack').map((f) => f.editor),
    ]);
    await endSlides();
    const pass = filesOf(slides.get('pass'));
    const everything = filesOf(slides.get('download'));
    const ticket = filesOf(slides.get('digital-ticket'));
    const day = filesOf(slides.get('qr-codes')) + filesOf(slides.get('seating-pack'));
    /* The shipped Details (the flag off) — its own all-in-one buttons, the same ◆ pattern. */
    const set = await renderSettled(React.createElement(PrintSetDownloads as never, { input } as never));
    const cards = await renderSettled(React.createElement(PassCardsPanel as never, { input } as never));
    const shippedDay = await renderSettled(React.createElement(React.Fragment, null, ...(freePrintParts as (...a: unknown[]) => Array<{ key: string; editor: React.ReactNode }>)('E1', 'rosa-ben', input).filter((f) => f.key === 'qr-codes' || f.key === 'seating-pack').map((f) => React.createElement(React.Fragment, { key: f.key }, f.editor))));
    return { pass, everything, ticket, day, set, cards, shippedDay };
  };
  const free = await draw(false, false);
  /* A free couple: Everything is the ◆ door… */
  for (const [k, h] of Object.entries({ everything: free.everything })) {
    assert.match(h, /data-print-all-in-one-pro=""/, `${k}: a free couple is handed the all-in-one file`);
    assert.match(h, /data-paid-mark="try"/, `${k}: a free couple is not shown ◆ PRO`);
    assert.doesNotMatch(h, /data-paid-mark="locked"/, 'a padlock');
  }
  /* …every guest's pass and the Guest QR sheet are a plain free Download (2026-10-22) — no door, no ◆; the place-card pack stays ◆. */
  assert.doesNotMatch(free.pass, /data-print-all-in-one-pro=""/, 'every guest’s pass in one file is still the ◆ door');
  assert.match(free.pass, /data-print-save="rosa-ben-passes\.pdf"/, 'a free couple cannot save every guest’s pass');
  assert.match(free.day, /data-print-save="rosa-ben-qr-codes\.pdf"/, 'a free couple cannot save the Guest QR sheet');
  assert.equal((free.day.match(/data-print-all-in-one-pro=""/g) ?? []).length, 1, 'the place-card pack is not the ◆ door (or the QR sheet still is)');
  assert.doesNotMatch(free.everything + free.day, /data-print-save="rosa-ben-(?:everything|seating-pack)\.pdf"/, 'a free couple can save a designed all-in-one file');
  /* …and the digital ticket zip is a plain free Download (2026-10-22) — no door, no ◆ — on Studio and on the shipped Details. */
  assert.match(free.ticket, /data-print-save="rosa-ben-tickets\.zip"/, 'a free couple cannot save the digital ticket zip');
  assert.doesNotMatch(free.ticket, /data-print-all-in-one-pro=""|data-paid-mark=/, 'the digital ticket zip is still the ◆ door');
  assert.match(free.cards, /data-pass-cards-digital=""[\s\S]*?data-print-save="rosa-ben-tickets\.zip"/, 'shipped: the ticket zip is not a free save');
  assert.doesNotMatch(free.cards, /data-pass-cards-zip-pro=""/, 'shipped: the ticket zip is still the ◆ door');
  assert.equal((free.set.match(/data-print-all-in-one-pro=""/g) ?? []).length, 1, 'shipped: the whole set is not the ◆ door (or every ticket still is)');
  assert.match(free.set, /data-print-save="rosa-ben-passes\.pdf"/, 'shipped: every guest’s ticket is not a free save');
  assert.match(free.cards, /data-pass-cards-print=""[\s\S]*?data-print-save="rosa-ben-passes\.pdf"/, 'shipped: the printed ticket batch is not a free save');
  assert.doesNotMatch(free.cards, /data-pass-cards-print=""[\s\S]*?data-print-all-in-one-pro=""/, 'shipped: the printed ticket batch is still the ◆ door');
  assert.equal((free.shippedDay.match(/data-print-all-in-one-pro=""/g) ?? []).length, 1, 'shipped: the pack is not the ◆ door (or the QR sheet still is)');
  assert.match(free.shippedDay, /data-print-save="rosa-ben-qr-codes\.pdf"/, 'shipped: the Guest QR sheet is not a free save');
  /* …one guest's file is a plain Download — free — named for the guest, in the size picked. */
  assert.match(free.pass, /data-print-save="rosa-ben-pass-ana-reyes\.pdf"/, 'one guest’s pass is not a free Download');
  assert.match(free.ticket, /data-print-save="rosa-ben-ticket-ana-reyes\.png"/, 'one guest’s ticket is not a free Download');
  assert.match(free.day, /data-print-save="rosa-ben-qr-ana-reyes\.png"/, 'one guest’s QR is not a free Download');
  assert.match(free.day, /data-print-save="rosa-ben-place-card-ana-reyes\.pdf"/, 'one guest’s place card is not a free Download');
  /* A Pro couple (an internal host's event reads as owned): the files themselves; the Pro ones ◆ unlocked. */
  const pro = await draw(true, false);
  assert.match(pro.pass, /data-print-save="rosa-ben-passes\.pdf"/, 'a Pro couple cannot save every guest’s pass');
  assert.match(pro.everything, /data-print-save="rosa-ben-everything\.pdf"/, 'a Pro couple cannot save everything');
  assert.match(pro.everything, /data-paid-mark="unlocked"/);
  assert.match(pro.ticket, /data-print-save="rosa-ben-tickets\.zip"/);
  assert.match(pro.day, /data-print-save="rosa-ben-qr-codes\.pdf"[\s\S]*data-print-save="rosa-ben-seating-pack\.pdf"/);
  assert.doesNotMatch(Object.values(pro).join(''), /data-print-all-in-one-pro/, 'a Pro couple is sent to the unlock page');
  /* The store shell without Pro: no door, no Pro file, no purchase hint — but the FREE all-guests files are there (a free file is not a purchase). */
  const shell = await draw(false, true);
  assert.doesNotMatch(Object.values(shell).join(''), /data-print-all-in-one-pro|rosa-ben-(?:set|everything|seating-pack)\.pdf|data-paid-mark/);
  assert.match(shell.pass, /data-print-save="rosa-ben-pass-ana-reyes\.pdf"/, 'one guest’s pass is gone from the store shell too');
  assert.match(shell.pass, /data-print-save="rosa-ben-passes\.pdf"/, 'every guest’s pass (free) is gone from the store shell');
  assert.match(shell.day, /data-print-save="rosa-ben-qr-codes\.pdf"/, 'the Guest QR sheet (free) is gone from the store shell');
  assert.match(shell.ticket, /data-print-save="rosa-ben-tickets\.zip"/, 'the digital ticket zip (free) is gone from the store shell');
  assert.match(shell.cards, /data-print-save="rosa-ben-tickets\.zip"/, 'shipped: the digital ticket zip (free) is gone from the store shell');
});
