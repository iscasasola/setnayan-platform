/**
 * SHOP › DETAILS, AS APPROVED (Supplier dashboard v13, owner 2026-10-29 "Approved.") — the four notes stay true.
 *
 *   1 · WHERE YOU WORK never goes silent: an unverified shop's 0 km is ONE locked row, "Coverage reach · Get verified to
 *       be found" (it used to `return null`; until 2026-11-19 it was a greyed map), the distances are −/＋ that save in
 *       place (no "Save distances" button), and there is NO plan upsell — reach is not a plan allowance (owner
 *       2026-11-19, "unlock the range. not plan dependend anymore");
 *   2 · GET VERIFIED is one component, and [Get verified] lands on the papers with the FIRST missing one marked;
 *   3 · "SINCE" IS TWO LINES — "In business since" (their year) and "On Setnayan since" (read-only);
 *   4 · DEEP SEARCH is explained by the five findings the result and its PDF carry, priced from the one source the run
 *       charges from (never a typed ₱), offered by the SAME resolver as the Deep Search page, absent in the store shell —
 *       and every kept search has a PDF drawn on the shared engine, behind its own shop's gate, never past 180 days.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { stripComments } from '@/lib/strip-comments';
import { BUSINESS_PROFILE_LABELS } from '@/lib/vendor-profile';
import { inBusinessSinceLine, onSetnayanSinceLine } from '@/lib/in-business-since';
import { COVERAGE_REACH_LOCKED_LINE, COVERAGE_REACH_TITLE } from '@/app/vendor-dashboard/_components/get-verified-line';
import {
  DEEP_SEARCH_FINDINGS,
  DEEP_SEARCH_KEEP_DAYS,
  deepSearchBandWords,
  deepSearchStillKept,
} from '@/lib/deep-search-findings';
import { deepSearchPdf } from '@/lib/deep-search-pdf';
import type { VendorDossier } from '@/lib/vendor-deep-search';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const RADIUS = 'app/vendor-dashboard/shop/_components/service-radius-fields.tsx';
const LINE = 'app/vendor-dashboard/_components/get-verified-line.tsx';
const CARD = 'app/vendor-dashboard/profile/_components/deep-search-card.tsx';
const SCREEN = 'app/vendor-dashboard/profile/_components/details-screen.tsx';
const DATA = 'app/vendor-dashboard/profile/details-data.ts';
const ROUTE = 'app/api/vendor/deep-search-pdf/route.ts';

test('1 · Where you work: an unverified shop gets ONE locked row; a verified one saves in place, with no plan upsell', () => {
  const s = src(RADIUS);
  assert.doesNotMatch(s, /if \(!hasCap\) return null/, 'Where you work went silent again for an unverified shop (the old `return null`)');
  // 🔒 Unverified: the one locked row, and it returns BEFORE the map, rings and steppers are drawn.
  assert.match(
    s,
    /if \(!isVerified\) \{\s*return \(\s*<div[^>]*>\s*<GetVerifiedLine title=\{COVERAGE_REACH_TITLE\} line=\{COVERAGE_REACH_LOCKED_LINE\}/,
    'an unverified shop does not get the ONE locked "Coverage reach" row',
  );
  assert.equal(COVERAGE_REACH_TITLE, 'Coverage reach');
  assert.equal(COVERAGE_REACH_LOCKED_LINE, 'Get verified to be found');
  const at = s.indexOf('if (!isVerified) {');
  const unverifiedBranch = s.slice(at, s.indexOf('\n  }\n', at));
  assert.doesNotMatch(unverifiedBranch, /<ReachMap|<KmStepper/, 'the unverified row still draws a map or a stepper');
  // 🔓 No plan upsell, no plan ladder (owner 2026-11-19).
  assert.doesNotMatch(s, /nextReach|ladder|planName|reaches \$\{/, 'the card names a plan’s reach again');
  assert.doesNotMatch(s, /Save distances/, 'the distances grew a Save button — they save in place');
  assert.equal((s.match(/<KmStepper\b/g) ?? []).length, 2, 'both distances are −/＋ steppers');
  assert.match(s, /await updateServiceRadius\(null, fd\)/, 'the steppers left the shipped save (`updateServiceRadius`)');
  // An unread shop is said, never drawn as an unverified 0 km.
  assert.match(s, /if \(!measured\) \{/, 'an unread shop is not told apart from an unverified one');
  assert.doesNotMatch(s, /\b(20|30|50|100) km\b/, 'a reach is typed into the component');
});

test('2 · Get verified is ONE line, used wherever being unverified holds something back, and lands on the first missing paper', () => {
  for (const f of [RADIUS, CARD]) assert.match(src(f), /from '\.\.\/\.\.\/_components\/get-verified-line'/, `${f} draws its own Get-verified line`);
  const line = src(LINE);
  assert.match(line, /label="Get verified"/);
  assert.match(line, /UNVERIFIED_LINE = 'You show up once you’re verified'/, 'the owner’s line moved');
  assert.match(src('app/vendor-dashboard/shop/_components/verify-section.tsx'), /window\.location\.hash === `#\$\{VERIFY_DOCS_ANCHOR\}`\) setOpen\(true\)/, '#docs no longer opens the papers step');
  // Since design v10 (2026-11-14) the papers are the one upload place; the first missing paper is marked there.
  const pairs = src('app/vendor-dashboard/shop/_components/paper-upload-place.tsx');
  assert.match(pairs, /const firstMissing = isVerified \|\| locked \? null : \(ROWS\.find\(\(r\) => !slots\[r\.slot\]\?\.r2_key\)/, 'the first missing paper is not the one marked');
  assert.match(pairs, /data-first-missing=/);
});

test('3 · "Since" is two lines — their own year, and the month they joined Setnayan (read-only)', () => {
  assert.equal(BUSINESS_PROFILE_LABELS.in_business_since_year, 'In business since', 'the year row is labelled something a supplier cannot read ("EST")');
  assert.equal(inBusinessSinceLine(2023, 2026), '2023 · 3 years');
  assert.equal(inBusinessSinceLine('2026', 2026), '2026 · this year');
  assert.equal(inBusinessSinceLine(null, 2026), null, 'a missing year was given one');
  assert.equal(onSetnayanSinceLine('2026-10-03T02:00:00Z'), 'Oct 2026');
  assert.equal(onSetnayanSinceLine(null), null);
  const s = src(SCREEN);
  assert.match(s, /title=\{ON_SETNAYAN_SINCE_LABEL\}/, 'On Setnayan since is not on Your details');
  assert.match(s, /onSetnayanSinceLine\(d\.onSetnayanSince\) \?\? 'Couldn’t be read just now'/, 'an unread join date is not said');
  assert.match(src(DATA), /onSetnayanSince: profile\.created_at \?\? null/, 'On Setnayan since is not the shop row’s own created_at');
});

test('4a · Deep Search is priced from the run’s own source — never a typed ₱, and never "1 free on Solo"', () => {
  for (const f of [CARD, 'lib/deep-search-findings.ts']) {
    assert.doesNotMatch(src(f), /₱\s?\d/, `${f} types a price`);
  }
  // 2026-11-04: both sides of the band are catalogue rows, read by the offer — never a typed matrix.
  assert.match(src('lib/vendor-deep-search-offer.ts'), /fetchVendorAddonBandPrices\(supabase, 'deep_search_about_you'\)/, 'the band is not read from the catalogue');
  const words = deepSearchBandWords({ entryPhp: 777, growthPhp: 333 });
  assert.equal(words, '₱777 a search on Free, Verified and Plus · ₱333 on Pro and Ultra, one search per purchase.');
  // 2026-11-09 (DECISION_LOG 🔎💳): no free search on any plan — the words never promise one.
  assert.equal(deepSearchBandWords({ entryPhp: 499, growthPhp: 499 }), '₱499 a search on every plan, one search per purchase.');
  for (const w of [words, deepSearchBandWords({ entryPhp: 499, growthPhp: 499 })]) {
    assert.doesNotMatch(w, /\b\d+ free\b|free (search|every)/i, 'the words promise a free search again');
  }
  // One resolver for the page and the card.
  assert.match(src('app/vendor-dashboard/deep-search/page.tsx'), /await loadDeepSearchOffer\(/, 'the Deep Search page prices itself again');
  assert.doesNotMatch(src('app/vendor-dashboard/deep-search/page.tsx'), /resolveVendorAddonPricePhp|fetchVendorDeepSearchPricePhp/, 'a second price path is back on the page');
  assert.match(src(DATA), /loadDeepSearchOffer\(supabase, createAdminClient\(\)/, 'the card is not offered by the page’s resolver');
  // The store shell refuses Deep Search — Your details draws no card there and reads nothing for it.
  assert.match(src(DATA), /if \(storeShell \|\| !withDeepSearch\) return null;/, 'the store shell is offered Deep Search');
  assert.match(src(SCREEN), /\{d\.deepSearch \? \(/, 'the card is drawn without an offer');
  // The card names the five findings from the one list.
  assert.match(src(CARD), /DEEP_SEARCH_FINDINGS\.map\(/);
  assert.deepEqual(DEEP_SEARCH_FINDINGS.map((f) => f.title), ['Business summary', 'Services we found', 'Prices we found', 'Where you show up', 'Things to double-check']);
});

/** The words the file carries (the invisible layer), page by page. */
async function words(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of doc.getPages()) {
    const contents = page.node.get(PDFName.of('Contents'));
    const refs = contents && 'asArray' in contents ? (contents as unknown as { asArray(): unknown[] }).asArray() : [contents];
    for (const ref of refs) {
      const stream = doc.context.lookup(ref as never);
      if (!(stream instanceof PDFRawStream)) continue;
      const raw = Buffer.from(stream.contents);
      const text = (stream.dict.get(PDFName.of('Filter')) ? inflateSync(raw) : raw).toString('latin1');
      for (const m of text.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(Buffer.from(m[1]!, 'hex').toString('latin1').replace(/\x97/g, '—'));
    }
  }
  return out.join(' ');
}

test('4b · a search’s PDF carries the five findings in order, its dates, and says what the web gave nothing for', async () => {
  const dossier: VendorDossier = {
    business_summary: 'Documentary wedding films from Makati.',
    detected_services: ['Wedding film', 'Same-day edit'],
    price_signals: [{ label: 'Full-day film', price: '85000 pesos', source_url: null }],
    web_presence: [],
    ads_findings: null,
    consistency_flags: ['An old phone number'],
    category_match: 'match',
    confidence: 'high',
  };
  const text = await words(
    await deepSearchPdf({ businessName: 'Lumina Studio', dossier, searchedAt: '2026-10-20T03:00:00Z', generatedAt: new Date('2026-10-29T03:00:00Z') }),
  );
  let at = -1;
  for (const f of DEEP_SEARCH_FINDINGS) {
    const i = text.indexOf(f.title);
    assert.ok(i > at, `"${f.title}" is missing from the file or out of order`);
    at = i;
  }
  for (const w of ['Lumina Studio', 'Wedding film', 'Same-day edit', '85000 pesos', 'An old phone number', 'Searched October 20, 2026', 'Nothing found for this.']) {
    assert.ok(text.includes(w), `the file does not carry "${w}"`);
  }
  assert.ok(text.includes(`Kept ${DEEP_SEARCH_KEEP_DAYS} days`), 'the file does not say how long it is kept');
});

test('4c · the PDF route gates on THIS shop before it reads a result, and never draws one past its keep window', () => {
  const s = src(ROUTE);
  const order = ['supabase.auth.getUser()', 'fetchOwnVendorProfile(', ".from('vendor_deep_search_uses')", ".from('vendor_web_dossiers')", 'deepSearchStillKept(', 'deepSearchPdf('];
  let last = -1;
  for (const o of order) {
    const i = s.indexOf(o);
    assert.ok(i > last, `${o} is missing or runs out of order in the PDF route`);
    last = i;
  }
  assert.match(s, /\.eq\('vendor_profile_id', vendorProfileId\)\s*\.eq\('dossier_id', dossierId\)/, 'the use row is not scoped to the shop');
  assert.match(s, /r\.vendor_profile_id !== vendorProfileId/, 'the result is not re-checked against the shop');
  assert.match(s, /'Content-Type': 'application\/pdf'/);
  assert.match(s, /sharePdfPaper\(/, 'Paper ▾ does not reach the file');
  const now = Date.parse('2026-10-29T00:00:00Z');
  assert.equal(deepSearchStillKept('2026-10-01T00:00:00Z', now), true);
  assert.equal(deepSearchStillKept('2026-04-01T00:00:00Z', now), false, 'a result older than 180 days still makes a file');
  assert.equal(deepSearchStillKept('not a date', now), false, 'a result of unknown age makes a file');
  // One keep window: the sweep deletes at the same age the card and the route use.
  assert.match(src('lib/vendor-dossier-retention.ts'), /const DOSSIER_RETENTION_DAYS = DEEP_SEARCH_KEEP_DAYS;/);
});
