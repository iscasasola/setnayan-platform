/**
 * 🎟 PICK GUESTS — THE ROUTE DRAWS ONLY THE PICKED GUESTS (owner 2026-10-25, on the guest pass / QR print: *"instead of just making
 * me select all, allow me to pick multiple guests to compile together as well."*).
 *
 *   1 · the rule (`lib/print-picked-guests.ts`), executed: no list → every guest; a list → exactly those, in the file's order; one
 *       unknown id → refused, never dropped and never included; an empty / malformed / oversized list → refused, never "everyone";
 *   2 · `/api/hub-print/qr-codes` is CALLED with the REAL loader (`loadGuestPasses`), only the database stood in for: the sheet
 *       draws only the picked guests; another event's guest is refused (403) with nothing drawn; no list still draws every guest;
 *   3 · `/api/hub-print/passes` hands the picked list to the loader and refuses on its answer — after the SAME print gate as before.
 *
 * SABOTAGE (each seen RED, then restored): `pickGuestRows` returning `all` for a pick · dropping the unknown ids instead of refusing ·
 * the route not passing `onlyGuests` to the QR sheet's loader · the passes branch ignoring `refused`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PICKED_GUESTS, PICKED_GUEST_REFUSAL, filterPickGuests, parsePickedGuests, pickGuestRows, pickedGuestsHref } from './print-picked-guests';

const EVENT = '11111111-2222-4333-8444-555555555555';
const ANA = '00000000-0000-4000-8000-000000000101';
const BEN = '00000000-0000-4000-8000-000000000102';
const CORA = '00000000-0000-4000-8000-000000000103';
const FOREIGN = '99999999-0000-4000-8000-000000000999';

const row = (guest_id: string, first_name: string, last_name: string) => ({
  guest_id,
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
  rsvp_status: 'attending',
  plus_one_of_guest_id: null,
  plus_one_name_confirmed_at: null,
  entry_source: 'host_seeded',
  passed_away: false,
  deleted_at: null,
  side: 'bride',
  group_category: 'family',
});
const ROWS = [row(ANA, 'Ana', 'Abad'), row(BEN, 'Ben', 'Bautista'), row(CORA, 'Cora', 'Cruz')];

/* ── 1 · the rule ── */
test('1 · no list prints every guest; a list prints exactly those; one unknown id refuses the file', () => {
  assert.deepEqual(parsePickedGuests(null), { ok: true, ids: null });
  const all = pickGuestRows(ROWS, null);
  assert.ok(all.ok && all.rows.length === 3, 'no list no longer prints every guest');

  const p = parsePickedGuests(`${CORA},${ANA}`);
  assert.ok(p.ok && p.ids);
  const picked = pickGuestRows(ROWS, p.ids);
  assert.ok(picked.ok, 'a valid pick was refused');
  assert.deepEqual(picked.rows.map((r) => r.guest_id), [ANA, CORA], 'the pick is not exactly those guests, in the file’s order');

  const foreign = parsePickedGuests(`${ANA},${FOREIGN}`);
  assert.ok(foreign.ok && foreign.ids);
  const refused = pickGuestRows(ROWS, foreign.ids);
  assert.equal(refused.ok, false, 'another event’s guest was silently dropped or included');
  assert.ok(!refused.ok && refused.unknown.includes(FOREIGN));

  for (const bad of ['', ' , ', 'not-a-uuid', `${ANA},x`, Array.from({ length: MAX_PICKED_GUESTS + 1 }, () => ANA).join(',')]) {
    assert.equal(parsePickedGuests(bad).ok, false, `"${bad.slice(0, 40)}…" was read as a pick (or as everyone)`);
  }
  assert.equal(pickedGuestsHref('/api/hub-print/passes?event=e', [ANA, BEN]), `/api/hub-print/passes?event=e&guests=${ANA},${BEN}`);
  assert.deepEqual(
    filterPickGuests([{ name: 'Ána Abad', side: 'Bride’s side', group: 'Family' }, { name: 'Ben', side: 'Groom’s side', group: 'Friends' }], { query: 'ana', side: '', group: '' }).map((g) => g.name),
    ['Ána Abad'],
  );
});

/* ── 2/3 · the route, called ── */
const state = { loaderOpts: [] as Array<Record<string, unknown>>, drawnNames: [] as string[][], passesRefused: false };
const NOTHING: unknown = new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: null, error: null }) : NOTHING),
  apply: () => NOTHING,
});
/** A read chain that answers `rows` however it is narrowed (the loader's `.select().eq().is().neq().eq().order()`). */
const answers = (rows: unknown): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: rows, error: null }) : answers(rows)),
    apply: () => answers(rows),
  });
const ADMIN = new Proxy(
  {},
  { get: (_t, k) => (k === 'from' ? (table: string) => (table === 'guests' ? answers(ROWS) : NOTHING) : NOTHING) },
);
{
  const Mod = require('node:module');
  const load = Mod._load;
  const stubs: Record<string, unknown> = {
    'server-only': {},
    'client-only': {},
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'host' } } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ADMIN },
    '@/lib/host-gate': { getHostUserId: async () => 'host' },
    '@/lib/request-platform': { isStoreShellRequest: async () => false },
  };
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request in stubs) return stubs[request];
    if (request === '@/lib/print-set.server') {
      const real = load.call(this, request, ...rest) as Record<string, (...a: unknown[]) => Promise<unknown>>;
      return {
        ...real,
        printOwnsPro: async () => false,
        readPrintEvent: async () => ({ event_id: EVENT, slug: 'rosa-ben', invite_theme: 'house', print_details: null, display_name: 'Rosa & Ben' }),
        loadPrintSet: async () => ({ event: { event_id: EVENT, slug: 'rosa-ben', display_name: 'Rosa & Ben' }, theme: 'house', look: {}, data: {}, images: {}, appUrl: 'https://x.test', ownerSlug: null, qrLook: { shape: 'square' } }),
        printInputsVersion: async () => null,
        /* The REAL loader for the QR sheet (only the database stood in for); the passes branch answers from the spy below. */
        loadGuestPasses: async (set: unknown, opts: Record<string, unknown>) => {
          state.loaderOpts.push(opts);
          if (opts.ticketsOnly) {
            const picked = opts.onlyGuests as ReadonlySet<string> | null | undefined;
            if (picked && picked.has(FOREIGN)) return { passes: [], images: {}, measured: true, refused: [FOREIGN] };
            return { passes: [], images: {}, measured: true };
          }
          const r = (await real.loadGuestPasses!(set, opts)) as { passes: Array<{ name: string }> };
          state.drawnNames.push(r.passes.map((p) => p.name));
          return r;
        },
      };
    }
    return load.call(this, request, ...rest);
  };
}

async function ask(path: string): Promise<{ status: number; text: string }> {
  const { GET } = await import('../app/api/hub-print/[piece]/route');
  const piece = path.split('?')[0]!;
  const res = await GET(new Request(`https://x.test/api/hub-print/${path}`), { params: Promise.resolve({ piece }) });
  return { status: res.status, text: res.headers.get('content-type')?.includes('pdf') ? '' : await res.text() };
}

test('2 · the QR sheet draws ONLY the picked guests; another event’s guest is refused; no list still draws every guest', async () => {
  state.drawnNames = [];
  const picked = await ask(`qr-codes?event=${EVENT}&mode=print&guests=${ANA},${CORA}`);
  assert.equal(picked.status, 200, `the picked QR sheet was not drawn: ${picked.text}`);
  assert.deepEqual(state.drawnNames.at(-1)?.map((n) => n.split(' ')[0]), ['Ana', 'Cora'], 'the sheet drew guests nobody picked');

  const foreign = await ask(`qr-codes?event=${EVENT}&mode=print&guests=${ANA},${FOREIGN}`);
  assert.equal(foreign.status, 403, 'another event’s guest was not refused');
  assert.equal(foreign.text, PICKED_GUEST_REFUSAL);
  assert.deepEqual(state.drawnNames.at(-1), [], 'something was drawn for a refused pick');

  const malformed = await ask(`qr-codes?event=${EVENT}&mode=print&guests=`);
  assert.equal(malformed.status, 400, 'an empty pick was read as everyone');

  const all = await ask(`qr-codes?event=${EVENT}&mode=print`);
  assert.equal(all.status, 200, `All guests stopped printing: ${all.text}`);
  assert.equal(state.drawnNames.at(-1)?.length, 3, 'no list no longer prints every guest');
});

test('3 · every guest’s pass hands the pick to the loader and refuses an unknown id — the print gate unchanged', async () => {
  state.loaderOpts = [];
  const foreign = await ask(`passes?event=${EVENT}&mode=print&theme=house&guests=${ANA},${FOREIGN}`);
  assert.equal(foreign.status, 403, 'a foreign id on the passes file was not refused');
  assert.equal(foreign.text, PICKED_GUEST_REFUSAL);
  const opts = state.loaderOpts.at(-1)!;
  assert.equal(opts.ticketsOnly, true, 'the picked passes skipped the ticket rule');
  assert.deepEqual([...((opts.onlyGuests as Set<string>) ?? [])], [ANA, FOREIGN], 'the route did not hand the pick to the loader');

  const all = await ask(`passes?event=${EVENT}&mode=print&theme=house`);
  assert.notEqual(all.status, 403, 'All guests’ passes is refused to a free event — the gate moved');
  assert.equal(state.loaderOpts.at(-1)!.onlyGuests, null, 'no list is no longer every guest');
});
