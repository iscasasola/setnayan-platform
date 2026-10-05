/**
 * THE GUEST QR CODES SHEET FOLLOWS THE DRAFTED QR LOOK — ON THE MAKER'S PREVIEW
 * ONLY (owner 2026-10-06, desktop Maker, Details › For the Day › Guest QR
 * codes: "i changed the QR Code style, why did the QR codes not change?").
 *
 * The style is picked in Details › Your Event Hub › QR code and DRAFTED
 * (`updateQrStyle` → `style_preferences.qr`). The event QR beside the address
 * already drew the draft (`/api/website/qr/[slug]?draft=1`); the Guest QR codes
 * sheet (`/api/hub-print/qr-codes`) drew the LIVE row only, so every guest's
 * code in the Maker ignored the pick. Held here:
 *
 *   1 · THE ROUTE, RUN: on a fixture shaped like a real event (maria-and-jose,
 *       a free event with a live square · classic code), `mode=screen&draft=…`
 *       draws every guest's code in the drafted shape · pattern · ink;
 *       `mode=print` and the plain saved PDF are drawn from what is live; a
 *       screen preview whose address names no draft is live too;
 *   2 · ONE RULE (`qrLookForHostDraft`) for every Maker preview of a code — the
 *       event QR, the sheet, every set piece's corner QR and pass;
 *   3 · THE THUMBNAIL REFRESHES: the drafted QR look is one of the keys the
 *       Maker hashes into the preview's address (`PRINT_DRAFTED_KEYS`), and the
 *       sheet's and the event QR's previews carry it — their saves never do.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';
import { FREE_QR_LOOK, type QrLook } from '@/lib/qr-look';
import { qrLookForHostDraft } from '@/lib/qr-look.server';
import { PRINT_DRAFTED_KEYS, printDraftOf } from '@/lib/ceremony-time';
import { freePrints } from '@/lib/free-prints';
import { emptyHubDraft, mergeHubDraft } from '@/lib/hub-draft';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── The fixture — shaped like a real event row (`readPrintEvent`'s columns) ──
const EVENT_ID = '7c1e9a52-3b6d-4f0e-9a1c-2d5e8f4b6a10';
const MULBERRY = '#6B2D5C';
const LIVE_EVENT = {
  event_id: EVENT_ID,
  slug: 'maria-and-jose',
  display_name: 'Maria & Jose',
  event_type: 'wedding',
  event_date: '2026-12-12',
  invite_theme: 'house',
  role_palette: { reception: [MULBERRY, '#E8D9C5'] },
  monogram_text: 'M&J',
  monogram_color: null,
  monogram_font_key: null,
  monogram_style: null,
  monogram_frame_key: null,
  monogram_custom_svg: null,
  monogram_uploaded_svg: null,
  // Onboarding's answers share the blob — the drafted QR look is laid INTO it.
  style_preferences: { interested_categories: ['photo'], qr: { shape: 'square', pattern: 'classic' } },
  print_details: null,
};
/** What `updateQrStyle` drafts — through the draft's own sanitizer. */
const HOST_DRAFT = mergeHubDraft(emptyHubDraft(), {
  events: { style_preferences: { qr: { shape: 'circle', pattern: 'dots', ink: MULBERRY } } },
});

// ── 1 · the route, run ───────────────────────────────────────────────────────
/* Module stubs at the I/O seams only (sessions, the admin client, the draft
   read, the guest list) — the branch's own decision runs for real, through the
   real `qrLookForHostDraft`, `resolveEventQrLook` and `printDraftOf`. Same
   CJS-cache technique as lib/guest-pass-hop.test.ts. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(__filename);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;

let draftOnFile: typeof HOST_DRAFT | null = HOST_DRAFT;
let drawnWith: QrLook | null = null;
let draftReads = 0;
let isHost = true;

const STUBS: Record<string, unknown> = {
  'server-only': {},
  '@/lib/supabase/server': {
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'host-user' } } }) } }),
  },
  '@/lib/supabase/admin': { createAdminClient: () => ({ stub: 'admin' }) },
  '@/lib/host-gate': { getHostUserId: async () => (isHost ? 'host-user' : null) },
  '@/lib/hub-draft-store': {
    readHubDraft: async () => {
      draftReads += 1;
      return draftOnFile;
    },
  },
  '@/lib/public-event-url': { resolveEventOwnerSlug: async () => null },
  // A FREE event: the live code is the Setnayan look; only the draft can change it.
  '@/lib/couple-website-pro': { eventCoupleWebsiteProActive: async () => false },
  '@/lib/view-as-free.server': { asViewed: async <T,>(p: Promise<T>) => p },
  '@/lib/print-set.server': {
    readPrintEvent: async () => LIVE_EVENT,
    loadGuestPasses: async (set: { qrLook: QrLook }) => {
      drawnWith = set.qrLook;
      return {
        measured: true,
        passes: [
          { name: 'Lola Remedios', seat: 'Table 1', qrRef: 'g-1' },
          { name: 'Tito Ben', seat: 'Table 2', qrRef: 'g-2' },
        ],
        images: {},
      };
    },
    loadPrintSet: async () => null,
    printInputsVersion: async () => null,
    printOwnsPro: async () => false,
    printThemeFor: () => 'house',
  },
};
{
  const ids = new Map<string, string>();
  for (const [request, exports] of Object.entries(STUBS)) {
    const id = join(process.cwd(), `__qr_sheet_stub_${request.replace(/[^a-z0-9]+/gi, '_')}__.js`);
    const m = new CjsModule(id);
    m.filename = id;
    m.loaded = true;
    m.exports = exports;
    m.paths = [];
    CjsModule._cache[id] = m;
    ids.set(request, id);
  }
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    return ids.get(request) ?? original.call(this, request, ...rest);
  };
}
const { GET } = nodeRequire('@/app/api/hub-print/[piece]/route') as typeof import('@/app/api/hub-print/[piece]/route');

async function sheet(query: string): Promise<{ status: number; look: QrLook | null; draftReads: number }> {
  drawnWith = null;
  draftReads = 0;
  const res = await GET(new Request(`https://setnayan.test/api/hub-print/qr-codes?event=${EVENT_ID}&${query}`), {
    params: Promise.resolve({ piece: 'qr-codes' }),
  });
  return { status: res.status, look: drawnWith, draftReads };
}

test('1 · the Maker’s thumbnail of the Guest QR codes draws every code in the DRAFTED look', async () => {
  draftOnFile = HOST_DRAFT;
  const r = await sheet('mode=screen&v=live1&draft=d4f7');
  assert.equal(r.status, 200);
  assert.ok(r.look, 'the sheet drew no codes');
  assert.equal(r.look!.shape, 'circle', 'the drafted shape is not on the guests’ codes');
  assert.equal(r.look!.pattern, 'dots', 'the drafted pattern is not on the guests’ codes');
  assert.equal(r.look!.dark, MULBERRY, 'the drafted ink is not on the guests’ codes');
  assert.notEqual(r.look!.centre.kind, 'setnayan', 'the draft is worn as Pro would wear it (Pro decides at Apply)');
});

test('1 · the saved and printed sheet is drawn from what is LIVE — never from the draft', async () => {
  draftOnFile = HOST_DRAFT;
  for (const q of ['mode=print&draft=d4f7', 'draft=d4f7', 'mode=sample&draft=d4f7']) {
    const r = await sheet(q);
    assert.equal(r.status, 200, `${q} did not answer the file`);
    assert.deepEqual(r.look, FREE_QR_LOOK, `${q}: a file was drawn from the host’s draft`);
    assert.equal(r.draftReads, 0, `${q}: a file read the draft at all`);
  }
});

test('1 · a thumbnail whose address names no draft — or a draft with no QR look — is live', async () => {
  draftOnFile = HOST_DRAFT;
  assert.deepEqual((await sheet('mode=screen&v=live1')).look, FREE_QR_LOOK, 'an address without draft= drew the draft');
  draftOnFile = mergeHubDraft(emptyHubDraft(), { events: { display_name: 'Maria & Jose Santos' } });
  assert.deepEqual((await sheet('mode=screen&draft=a1')).look, FREE_QR_LOOK, 'a draft without a QR look changed the codes');
  draftOnFile = null;
  assert.deepEqual((await sheet('mode=screen&draft=a1')).look, FREE_QR_LOOK);
});

test('1 · someone who is not a host of the event never reaches the draft', async () => {
  draftOnFile = HOST_DRAFT;
  isHost = false;
  try {
    const r = await sheet('mode=screen&draft=d4f7');
    assert.equal(r.status, 403);
    assert.equal(r.draftReads, 0, 'the draft was read before the host gate');
    assert.equal(r.look, null);
  } finally {
    isHost = true;
  }
});

// ── 2 · one rule for every preview of a code ────────────────────────────────

test('2 · qrLookForHostDraft — the drafted look over live, worn as Pro; null without a drafted QR look', () => {
  const look = qrLookForHostDraft(LIVE_EVENT, HOST_DRAFT.events)!;
  assert.equal(look.shape, 'circle');
  assert.equal(look.pattern, 'dots');
  assert.equal(qrLookForHostDraft(LIVE_EVENT, { display_name: 'x' }), null);
  assert.equal(qrLookForHostDraft(LIVE_EVENT, null), null);
  assert.equal(qrLookForHostDraft(null, HOST_DRAFT.events), null);
});

test('2 · the event QR, the sheet and every set piece share that rule', () => {
  assert.match(code('app/api/website/qr/[slug]/route.ts'), /look = draft \? qrLookForHostDraft\(event, draft\.events\) : null;/);
  const route = code('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /thumb && url\.searchParams\.get\('draft'\)/, 'the sheet reads the draft for a file, or never');
  assert.match(route, /qrLook: qrLookForHostDraft\(event, sheetDraft\) \?\? \(await resolveEventQrLook\(admin, eventId, event\)\)/);
  // The set pieces (corner QR, the pass) — `loadPrintSet` is handed a draft only for `mode=screen`.
  assert.match(code('lib/print-set.server.ts'), /const qrLook = qrLookForHostDraft\(liveEvent, draft\) \?\? \(await resolveEventQrLook\(admin, eventId, event\)\);/);
  assert.match(route, /mode !== 'print' && piece !== 'passes' && url\.searchParams\.get\('draft'\)/);
});

// ── 3 · the thumbnail refreshes ─────────────────────────────────────────────

test('3 · the drafted QR look is named in every preview’s draft address', () => {
  assert.ok((PRINT_DRAFTED_KEYS as readonly string[]).includes('style_preferences'));
  assert.deepEqual(printDraftOf(HOST_DRAFT.events as Record<string, unknown>), { style_preferences: { qr: { shape: 'circle', pattern: 'dots', ink: MULBERRY } } });
});

test('3 · the sheet’s and the event QR’s previews carry the stamps; their saves never do', () => {
  const all = freePrints(EVENT_ID, 'maria-and-jose', { version: 'live1', draft: 'd4f7' });
  const sheetPrint = all.find((p) => p.key === 'qr-codes')!;
  assert.match(sheetPrint.preview, /[?&]mode=screen&v=live1&draft=d4f7$/);
  const eventQr = all.find((p) => p.key === 'event-qr')!;
  assert.equal(eventQr.preview, '/api/website/qr/maria-and-jose?draft=1&v=live1.d4f7');
  for (const fp of all) for (const s of fp.saves) assert.doesNotMatch(s.href, /draft=/, `${fp.key}: a save names the draft`);
  // No draft: the sheet's address names none (the route then draws live).
  assert.doesNotMatch(freePrints(EVENT_ID, 'maria-and-jose', { version: 'live1' }).find((p) => p.key === 'qr-codes')!.preview, /draft=/);
  // …and the Maker hands the stamps it already computes for the set pieces.
  assert.match(code('app/dashboard/[eventId]/launch/_components/maker-details.tsx'), /const free = freePrintParts\(eventId, slug, prints\);/);
});
