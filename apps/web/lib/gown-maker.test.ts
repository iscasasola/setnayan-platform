/**
 * 🔒 THE GOWN MAKER SHARE (owner, 26 Nov 2026) — lib/gown-maker.ts and the wiring around it.
 *
 *   1. The handoff: `parseGownExport` takes exactly the v1 `.gown.json` and refuses each wrong field by name.
 *   2. The message: the head words are ONE string in both files, and the ref round-trips.
 *   3. Which shops: the one taxonomy's attire categories, from any leaf.
 *   4. The wiring: the card never reads the tool's `state`; a scan posts the card on both doors (Shortlist, Booked);
 *      the share rides existing actions (no new route); the table is the server's to write.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  GOWN_DESIGN_HEAD,
  GOWN_THUMB_MAX_BYTES,
  formatGownDesignBlock,
  gownDesignRefOf,
  gownShareCategory,
  gownShareCodeOf,
  isGownKind,
  parseGownExport,
} from './gown-maker';
import { GOWN_DESIGN_HEAD_WORDS, isGownDesign } from './chat-card-lines';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const good = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    v: 1,
    which: 'female',
    summary: ['Mermaid silhouette', 'Ivory mikado, 2 m train', 'Sweetheart neckline'],
    priceShown: 85000,
    currency: 'PHP',
    thumb: PNG,
    state: { silhouette: 'mermaid', fabric: 'mikado' },
    ...over,
  });

test('the v1 export is taken as it is: summary, the price shown in centavos, the picture and the opaque state', () => {
  const r = parseGownExport(good());
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.design.which, 'female');
  assert.deepEqual(r.design.summary, ['Mermaid silhouette', 'Ivory mikado, 2 m train', 'Sweetheart neckline']);
  assert.equal(r.design.priceShownCentavos, 8_500_000);
  assert.equal(r.design.thumbDataUrl, PNG);
  assert.deepEqual(r.design.state, { silhouette: 'mermaid', fabric: 'mikado' });
  const none = parseGownExport(good({ priceShown: null }));
  assert.ok(none.ok && none.design.priceShownCentavos === null, 'no price shown → the shop quotes it');
});

test('each wrong field is refused by name — never guessed', () => {
  const refused = (over: Record<string, unknown>) => {
    const r = parseGownExport(good(over));
    assert.equal(r.ok, false, JSON.stringify(over).slice(0, 60));
  };
  refused({ v: 2 });
  refused({ which: 'unisex' });
  refused({ currency: 'USD' });
  refused({ summary: [] });
  refused({ summary: 'Mermaid' });
  refused({ priceShown: -1 });
  refused({ priceShown: '85000' });
  refused({ thumb: 'data:image/jpeg;base64,AAAA' });
  refused({ thumb: 'data:image/png;base64,not base64!' });
  refused({ thumb: `data:image/png;base64,${'A'.repeat(Math.ceil((GOWN_THUMB_MAX_BYTES + 3) / 3) * 4)}` });
  refused({ state: [] });
  refused({ state: null });
  assert.equal(parseGownExport('not json').ok, false);
  assert.equal(parseGownExport('').ok, false);
  assert.equal(parseGownExport(42).ok, false);
  // Bounded: control characters out, at most 12 lines.
  const r = parseGownExport(good({ summary: ['a\u0000b', ...Array.from({ length: 20 }, (_, i) => `line ${i}`)] }));
  assert.ok(r.ok && r.design.summary.length === 12 && r.design.summary[0] === 'a b');
});

test('the message head is ONE string in both files, and the design ref round-trips', () => {
  assert.equal(GOWN_DESIGN_HEAD, GOWN_DESIGN_HEAD_WORDS);
  const id = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b';
  const body = formatGownDesignBlock({ which: 'male', summary: ['Piña barong', 'Hand embroidery'], priceShownCentavos: 1_500_000 }, id);
  assert.ok(isGownDesign(body));
  assert.equal(gownDesignRefOf(body), id);
  assert.match(body, /For him/);
  assert.match(body, /Price shown: ₱15,000/);
  assert.equal(gownDesignRefOf('Gown design ref: not-a-uuid'), null);
  assert.equal(gownShareCodeOf('0123456789abcdef01234567'), '0123456789abcdef01234567');
  assert.equal(gownShareCodeOf('../../etc'), null);
});

test('which shops: the attire categories of the one taxonomy, from any leaf', () => {
  assert.ok(isGownKind('gown_designer'));
  assert.ok(isGownKind('suit_designer'));
  assert.ok(isGownKind('bridal_gown'), 'a gown leaf resolves to its branch');
  assert.ok(isGownKind('groom_suit'));
  assert.ok(!isGownKind('catering'));
  assert.ok(!isGownKind(null));
  assert.equal(gownShareCategory('male', ['bridal_gown', 'groom_suit']), 'suit_designer');
  assert.equal(gownShareCategory('female', ['groom_suit']), 'suit_designer', 'else its first attire category');
  assert.equal(gownShareCategory('female', ['catering']), null, 'not an attire shop → the writer’s own coercion');
});

test('🔒 the card never reads the tool’s state — only its picture, lines and the price shown', () => {
  const server = read('lib/gown-maker.server.ts');
  const cols = /const CARD_COLUMNS = '([^']+)'/.exec(server)?.[1] ?? '';
  assert.ok(cols.includes('thumb_data_url') && cols.includes('summary') && cols.includes('price_shown_centavos'));
  assert.doesNotMatch(cols, /\bstate\b/, 'the card columns must never include the tool’s state (the shop’s setup)');
  // Every read in the server file selects the card columns or a single id — never `*` and never `state`.
  for (const m of server.matchAll(/\.select\('([^']*)'\)/g)) assert.doesNotMatch(m[1]!, /\*|\bstate\b/);
  // The chat card's read checks the chat under the reader's OWN session before the service read.
  const action = read('app/_components/gown-maker/gown-actions.ts');
  assert.ok(action.indexOf('createClient()') < action.indexOf('createAdminClient()'));
  assert.match(action, /sender_role !== 'vendor'/, 'only the shop’s own message names a design');
});

test('🔒 a scan posts the card on both doors, and only a design of that shop', () => {
  const booked = read('app/vendor/lock/[token]/actions.ts');
  assert.match(booked, /gownDesignOfLockedQr\(/);
  assert.match(booked, /postGownDesignCard\(/);
  // The card is posted after the claim succeeded (inside the ok branch), never instead of it.
  assert.ok(booked.indexOf("vendor_claim_locked_qr") < booked.indexOf('postGownDesignCard('));
  const shortlist = read('app/vendor-invite/[slug]/actions.ts');
  assert.match(shortlist, /share\.vendorProfileId === vendor!\.vendor_profile_id/);
  assert.ok(shortlist.indexOf('importVendorToEventShortlist(') < shortlist.indexOf('postGownDesignCard('));
  const landing = read('app/vendor-invite/[slug]/page.tsx');
  assert.match(landing, /gownRead\.vendorProfileId === vendor\.vendor_profile_id/);
  // The stream draws the card for the shop's message.
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /m\.sender_role === 'vendor' && isGownDesign\(m\.body\)/);
  assert.match(stream, /<GownDesignCard\b/);
});

test('🔒 no new route: the share rides issueLockedQr, the card read rides supplierScan', () => {
  const issue = read('app/vendor-dashboard/invite/actions.ts');
  assert.match(issue, /formData\.get\('gown_share'\)[\s\S]*?return shareGownDesign\(formData\)/);
  // Booked shares keep the Booked QR's own doors: bookings closed and an unverified shop are refused first.
  const share = issue.slice(issue.indexOf('async function shareGownDesign'), issue.indexOf('export async function issueLockedQr'));
  assert.match(share, /areBookingsOpen\(\)/);
  assert.match(share, /isMarketplaceVendorBookable\(/);
  // A code that cannot carry its design is withdrawn.
  assert.match(issue, /linkGownDesignToLockedQr\([\s\S]*?vendor_void_locked_qr/);
  const scan = read('app/_actions/supplier-scan-actions.ts');
  assert.match(scan, /case 'gown_tool':\s*return \{ op: 'gown_tool', result: await runGownAction\(req\.input\) \}/);
  // No 'use server' file was added for the Gown Maker.
  for (const f of readdirSync(join(WEB, 'app/_components/gown-maker'))) {
    assert.doesNotMatch(readFileSync(join(WEB, 'app/_components/gown-maker', f), 'utf8'), /^'use server'/m, f);
  }
});

test('🔒 the table: RLS on at create, the shop reads its own, nobody but the server writes', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_gown_maker_designs_shared_by_qr.sql'));
  assert.ok(file, 'the migration is missing');
  const sql = readFileSync(join(dir, file!), 'utf8');
  assert.match(sql, /ALTER TABLE public\.gown_designs ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.gown_designs FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.gown_designs TO authenticated/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*gown_designs/);
  assert.match(sql, /current_vendor_profile_ids\(\)/);
});
