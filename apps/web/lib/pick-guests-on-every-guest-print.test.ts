/**
 * 🎟 PICK GUESTS ON EVERY GUEST PRINT, AND A COUNT LINE THAT IS THE FILE (owner 2026-10-26, on Studio › Prints' Digital ticket:
 * *"Why cant i pick specific guests to download and compile?"* → *"And this should apply to all guest related prints."*).
 *
 *   1 · the sheet's ONE file rule (`pickedFile`), executed: the all-guests address narrowed to exactly the ticked ids, a .zip kept a
 *       .zip, "Download 3 tickets" — and every per-guest row hands the shared sheet a `pickNoun` (pass · ticket · QR code · place
 *       card), the sheet saves through `pickedFile`, and it opens ABOVE the Maker (its layer's z over the Maker's z-[80]);
 *   2 · `/api/guest/pass-card/all` is CALLED (the real eligibility read over a stand-in database): `guests=` zips exactly those
 *       guests' PNGs; another event's guest, or one who declined, refuses the whole zip (403) with nothing drawn; no list = everyone;
 *   3 · the Digital ticket's count line, built from the REAL `loadPassGuestNames` over the SAME rows, says the number of PNGs the
 *       zip really holds — and names coming / not replied, never "who is coming" for a list that includes the not-replied;
 *   4 · `/dashboard/<id>/seating/print` is CALLED: `guests=` draws only those guests' place cards (no directory, no signs); a
 *       guest of another event or one not seated refuses the file (403); without Event Hub Pro a picked file is refused like the
 *       whole pack.
 *
 * SABOTAGE (seen RED, then restored): the zip route zipping `read.guests` instead of `pick.rows` (test 2 fails: 4 PNGs for a pick
 * of 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PICKED_GUEST_REFUSAL, pickedFile, pickedGuestsHref } from './print-picked-guests';
import { guestPrintCountLine } from './studio-prints-settings';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const LAUNCH = join(APP, 'dashboard', '[eventId]', 'launch', '_components');
const read = (p: string) => readFileSync(p, 'utf8');

const EVENT = '11111111-2222-4333-8444-555555555555';
const ANA = '00000000-0000-4000-8000-000000000101';
const BEN = '00000000-0000-4000-8000-000000000102';
const CORA = '00000000-0000-4000-8000-000000000103';
const DAN = '00000000-0000-4000-8000-000000000104';
const TBA = '00000000-0000-4000-8000-000000000105';
const FOREIGN = '99999999-0000-4000-8000-000000000999';

const row = (guest_id: string, first_name: string, last_name: string, rsvp_status: string, extra: Record<string, unknown> = {}) => ({
  guest_id,
  public_id: `S89G-${guest_id.slice(-4)}`,
  first_name,
  last_name,
  middle_name: null,
  display_name: null,
  name_prefix: null,
  name_suffix: null,
  role: 'guest',
  extra_roles: [],
  march: [],
  qr_token: `tok-${guest_id.slice(-3)}`,
  event_id: EVENT,
  rsvp_status,
  plus_one_of_guest_id: null,
  plus_one_name_confirmed_at: null,
  entry_source: 'host_seeded',
  passed_away: false,
  deleted_at: null,
  side: 'bride',
  group_category: 'family',
  ...extra,
});
/** Coming · not replied · maybe · can't come · an unnamed +1 seat of Ana's: a ticket for the first three only. */
const ROWS = [
  row(ANA, 'Ana', 'Abad', 'attending'),
  row(BEN, 'Ben', 'Bautista', 'pending'),
  row(CORA, 'Cora', 'Cruz', 'maybe'),
  row(DAN, 'Dan', 'Dizon', 'declined'),
  row(TBA, 'TBA', '+1', 'pending', { plus_one_of_guest_id: ANA }),
];

/* ── 1 · the sheet's file, and every guest print offers it ── */
test('1 · the picked file is the all-guests file narrowed to exactly the ticked ids; every guest row offers the shared sheet, above the Maker', () => {
  const zip = pickedFile({ href: `/api/guest/pass-card/all?event=${EVENT}`, file: 'Ana-Ben-passes.zip' }, [ANA, CORA, BEN], { one: 'ticket', many: 'tickets', verb: 'Download' });
  assert.equal(zip.href, `/api/guest/pass-card/all?event=${EVENT}&guests=${ANA},${CORA},${BEN}`, 'the zip is not narrowed to exactly the ticked guests');
  assert.equal(zip.file, 'Ana-Ben-passes-3-picked.zip', 'a picked .zip is not named as a .zip');
  assert.equal(zip.label, 'Download 3 tickets');
  const pdf = pickedFile({ href: '/api/hub-print/passes?event=e&mode=print', file: 'x-passes.pdf' }, [ANA], { one: 'pass', many: 'passes' });
  assert.deepEqual(pdf, { href: pickedGuestsHref('/api/hub-print/passes?event=e&mode=print', [ANA]), file: 'x-passes-1-picked.pdf', label: 'Print 1 pass' });

  const sheet = read(join(LAUNCH, 'print-guest-sheet.tsx'));
  const many = sheet.slice(sheet.indexOf('export function GuestManySheet('));
  assert.match(many, /const out = pickedFile\(\{ href, file \}, ids, noun\);[\s\S]*<PrintSaveButton href=\{out\.href\} file=\{out\.file\}/, 'the sheet saves by its own rule, not `pickedFile`');
  /* Above the Maker: the shared Sheet is z-50 and the Maker a fixed z-[40] (z-[80] until it kept the app's nav, 2026-10-30) — the pick sheet's own layer must sit over it. */
  const layer = /data-print-pick-sheet-layer="" className="relative z-\[(\d+)\]"/.exec(many);
  const maker = /className="fixed z-\[(\d+)\]/.exec(read(join(LAUNCH, 'maker-shell.tsx')));
  assert.ok(layer && maker, 'the pick sheet’s layer or the Maker’s z moved — re-point this guard');
  assert.ok(Number(layer[1]) > Number(maker[1]), `the Pick guests sheet (z-${layer[1]}) opens BEHIND the Maker (z-${maker[1]})`);

  /* Every per-guest row, anchored per component (a file-level match cannot say which row lost it). */
  const prints = read(join(LAUNCH, 'maker-prints.tsx'));
  const between = (a: string, b: string) => prints.slice(prints.indexOf(a), prints.indexOf(b, prints.indexOf(a)));
  assert.match(between("if (k === 'pass' && fam) {", 'return ('.concat('\n      <div data-print-editor={k} data-print-studio=""')), /pickNoun=\{\{ one: 'pass', many: 'passes' \}\}/, 'the Event pass lost Pick guests');
  assert.match(between('export function DigitalTicketEditor(', 'export function PrintEverythingStudio('), /all=\{zip\}[\s\S]*pickNoun=\{\{ one: 'ticket', many: 'tickets', verb: 'Download' \}\}/, 'the Digital ticket has no Pick guests over its zip');
  assert.match(
    between("if (fp.key === 'qr-codes' || fp.key === 'seating-pack') {", "if ((fp.key === 'seat-plan'"),
    /pickNoun=\{qr \? \{ one: 'QR code', many: 'QR codes' \} : \{ one: 'place card', many: 'place cards' \}\}/,
    'the QR sheet or the place cards lost Pick guests',
  );
});

/* ── stand-ins: the database and the session, nothing else ── */
const answers = (rows: unknown): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: rows, error: null }) : answers(rows)),
    apply: () => answers(rows),
  });
const ADMIN = { from: (table: string) => (table === 'guests' ? answers(ROWS) : answers(null)) };

const TABLE = (table_id: string, label: string, sort_order: number) => ({ table_id, public_id: `S89T-${table_id}`, event_id: EVENT, table_label: label, table_type: 'round', capacity: 8, sort_order, removed_seats: [], qr_token: `t-${table_id}`, link_group_id: null, link_group_label: null });
const SEAT = { tables: [TABLE('tA', '1', 1), TABLE('tB', '2', 2)], assignments: [{ assignment_id: 'a1', table_id: 'tA', guest_id: ANA, seat_number: 1, locked: false }, { assignment_id: 'a2', table_id: 'tB', guest_id: CORA, seat_number: 1, locked: false }] };
const USER_DB = {
  auth: { getUser: async () => ({ data: { user: { id: 'host' } } }) },
  from: (table: string) =>
    answers(
      table === 'events'
        ? { display_name: 'Ana & Ben', slug: 'ana-ben', event_date: '2026-12-12', event_type: 'wedding', monogram_text: null }
        : table === 'event_tables'
          ? SEAT.tables
          : table === 'event_seat_assignments'
            ? SEAT.assignments
            : table === 'guests'
              ? ROWS
              : null,
    ),
};
const state = { ownsPro: true, drawnCards: [] as string[], drawnDocs: 0 };
{
  const Mod = require('node:module');
  const load = Mod._load;
  const stubs: Record<string, unknown> = {
    'server-only': {},
    'client-only': {},
    '@/lib/supabase/server': { createClient: async () => USER_DB },
    '@/lib/supabase/admin': { createAdminClient: () => ADMIN },
    '@/lib/host-gate': { getHostUserId: async () => 'host' },
    '@/lib/request-platform': { isStoreShellRequest: async () => false },
    '@/lib/qr': { renderStyledUrlQrPng: async () => Buffer.from('png'), renderStyledUrlQrSvg: async () => '<svg/>' },
    '@/lib/qr-look.server': { QR_LOOK_COLUMNS: 'qr_style', resolveEventQrLook: async () => ({ shape: 'square' }) },
    '@/lib/public-event-url': { publicEventUrl: () => 'https://x.test/ana-ben', resolveEventOwnerSlug: async () => null },
    '@/app/[slug]/_lib/event-words': { eventWordsForEvent: async () => null },
    '@/lib/print-render-pdf': {
      renderPrintPdf: async (docs: unknown[]) => {
        state.drawnDocs = docs.length;
        state.drawnCards = [...JSON.stringify(docs).matchAll(/"(Ana Abad|Ben Bautista|Cora Cruz|Dan Dizon)"/g)].map((m) => m[1]!);
        return new Uint8Array([37, 80, 68, 70]);
      },
    },
  };
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request in stubs) return stubs[request];
    if (request === '@/lib/print-set.server') {
      const real = load.call(this, request, ...rest) as Record<string, unknown>;
      return { ...real, printOwnsPro: async () => state.ownsPro };
    }
    if (request === '@/lib/pass-card.server') {
      /* The REAL eligibility read (`eligiblePassCardGuests` over the stand-in database); only the drawing is stood in for. */
      const real = load.call(this, request, ...rest) as Record<string, unknown>;
      return {
        ...real,
        loadPassCardKit: async () => ({ set: { event: { slug: 'ana-ben', display_name: 'Ana & Ben', event_date: '2026-12-12' } } }),
        passCardDesignFor: () => 'classic',
        passCardFileNameFor: (_k: unknown, g: { first_name: string }) => `${g.first_name}.png`,
        renderPassCardFor: async (_k: unknown, g: { guest_id: string }) => new Uint8Array(Buffer.from(`card:${g.guest_id}`)),
      };
    }
    return load.call(this, request, ...rest);
  };
}

/** The file names inside a stored (uncompressed) zip — its local file headers. */
function zipNames(buf: Buffer): string[] {
  const out: string[] = [];
  for (let i = 0; i + 30 <= buf.length; ) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    out.push(buf.subarray(i + 30, i + 30 + nameLen).toString('utf8'));
    const flags = buf.readUInt16LE(i + 6);
    let next = i + 30 + nameLen + extraLen + size;
    /* A streamed entry carries its size in a data descriptor after the bytes — find the next header instead. */
    if (flags & 0x08) {
      const at = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i + 30 + nameLen + extraLen);
      next = at === -1 ? buf.length : at;
    }
    i = next;
  }
  return out;
}

async function zip(query: string): Promise<{ status: number; names: string[]; text: string }> {
  const { GET } = await import('../app/api/guest/pass-card/all/route');
  const res = await GET(new Request(`https://x.test/api/guest/pass-card/all?event=${EVENT}${query}`));
  if (!res.headers.get('content-type')?.includes('zip')) return { status: res.status, names: [], text: await res.text() };
  return { status: res.status, names: zipNames(Buffer.from(await res.arrayBuffer())), text: '' };
}

/* ── 2 · the zip route ── */
test('2 · the ticket zip holds ONLY the picked guests; another event’s guest or one who declined refuses it; no list is everyone', async () => {
  const picked = await zip(`&guests=${CORA},${ANA}`);
  assert.equal(picked.status, 200, picked.text);
  assert.deepEqual(picked.names.sort(), ['Ana.png', 'Cora.png'], 'the zip does not hold exactly the picked guests');

  for (const bad of [FOREIGN, DAN]) {
    const refused = await zip(`&guests=${ANA},${bad}`);
    assert.equal(refused.status, 403, `a pick with ${bad === DAN ? 'a guest who declined' : 'another event’s guest'} was not refused`);
    assert.equal(refused.text, PICKED_GUEST_REFUSAL);
  }
  assert.equal((await zip('&guests=')).status, 400, 'an empty pick was read as everyone');

  const all = await zip('');
  assert.deepEqual(all.names.sort(), ['Ana.png', 'Ben.png', 'Cora.png'], 'All guests is no longer every guest with a ticket');
});

/* ── 3 · the count line is the zip ── */
test('3 · the Digital ticket’s count line is the number of PNGs the zip holds, said as coming / not replied / maybe', async () => {
  const { loadPassGuestNames } = await import('./print-set.server');
  const list = await loadPassGuestNames(EVENT, Promise.resolve(null));
  assert.ok(list, 'the list could not be read');
  const line = guestPrintCountLine('digital-ticket', list);
  const all = await zip('');
  assert.equal(Number(/^(\d+) tickets?/.exec(line)?.[1]), all.names.length, `"${line}" — but the zip holds ${all.names.length}`);
  assert.equal(line, '3 tickets · 1 coming, 1 not replied yet, 1 maybe · one PNG each · .zip');
  assert.doesNotMatch(line, /who is coming/, 'the line still says "who is coming" over a zip that holds the not-replied');
  /* …and the Event pass's line counts the same list (one source for both rows). */
  assert.match(guestPrintCountLine('pass', list), /^3 passes · 1 coming, 1 not replied yet, 1 maybe/);
});

/* ── 4 · the place cards' route ── */
async function cards(query: string): Promise<{ status: number; text: string }> {
  const { GET } = await import('../app/dashboard/[eventId]/seating/print/route');
  state.drawnCards = [];
  state.drawnDocs = 0;
  const res = await GET(new Request(`https://x.test/dashboard/${EVENT}/seating/print?format=pdf${query}`), { params: Promise.resolve({ eventId: EVENT }) });
  return { status: res.status, text: res.headers.get('content-type')?.includes('pdf') ? '' : await res.text() };
}

test('4 · picked place cards are those guests’ cards only; an unseated or foreign guest refuses the file; Pro gates it like the pack', async () => {
  state.ownsPro = true;
  const one = await cards(`&guests=${CORA}`);
  assert.equal(one.status, 200, one.text);
  assert.deepEqual(state.drawnCards, ['Cora Cruz'], 'the picked file holds cards other than the picked guest’s');

  for (const bad of [FOREIGN, BEN]) {
    const refused = await cards(`&guests=${ANA},${bad}`);
    assert.equal(refused.status, 403, `a pick with ${bad === BEN ? 'an unseated guest' : 'another event’s guest'} was not refused`);
    assert.equal(refused.text, PICKED_GUEST_REFUSAL);
    assert.equal(state.drawnDocs, 0, 'a refused pick still drew a file');
  }
  assert.equal((await cards(`&guest=${ANA}&guests=${ANA}`)).status, 400, 'one guest and a pick at once was not refused');

  state.ownsPro = false;
  assert.equal((await cards(`&guests=${ANA}`)).status, 403, 'a picked file of place cards skipped the pack’s Event Hub Pro question');
  assert.equal((await cards(`&guest=${ANA}`)).status, 200, 'one guest’s own card is no longer free');
  state.ownsPro = true;
});
