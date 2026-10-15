/**
 * the-maker-maps-every-field.test.ts — NOTHING A CARD CAN HOLD IS LOST IN THE SIMPLER MAKER.
 *
 * Owner 2026-10-08 (the build requirement under the 92-field truth table, corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md`): *"retire old. but make sure it is mapped to the new service
 * card"* · *"we do not want the service card not to be mapped properly or it will be a dead end for us."* And for
 * step 3 of the simpler supplier dashboard (2026-10-14): "Nothing may be lost — list every field and where it lives."
 *
 * Two halves, each able to go red on its own:
 *   1 · EVERY NAME THE SAVE READS IS POSTED BY THE MAKER. The names are read out of `commitVendorService` and every
 *       parser it calls (the action file, lib/vendor-discount-rows.ts, lib/service-card-save-parts.ts,
 *       lib/vendor-service-refinements-write.ts) — not typed here — and each must be posted somewhere in the maker's
 *       tree (canvas-maker.tsx and the editors it mounts, plus the server-drawn details fields). A name the save
 *       reads and nothing posts is a field no supplier can fill in.
 *   2 · EVERY FIELD OF THE TRUTH TABLE HAS A ROW. `FIELD_MAP` below is the list the PR body prints: truth-table row →
 *       the maker's fold (its `data="…"`), and each fold must exist in the maker.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const COMPONENTS = join(WEB, 'app/vendor-dashboard/services/_components');
const MAKER = join(COMPONENTS, 'canvas-maker.tsx');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

/** The body of one function, so a name read by a DIFFERENT action in the same file cannot count. */
function body(src: string, signature: string): string {
  const at = src.indexOf(signature);
  assert.notEqual(at, -1, `${signature} not found — renamed?`);
  const rest = src.slice(at + signature.length);
  const end = rest.search(/\n(?:export )?(?:async )?function /);
  return end === -1 ? rest : rest.slice(0, end);
}

function namesRead(src: string): string[] {
  return [...src.matchAll(/\b(?:formData|fd)\.(?:get|getAll)\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1] ?? '');
}

/** Every `name="…"` the maker tree posts (the maker + the editors it imports, one level of relative imports). */
function namesPosted(): Set<string> {
  const out = new Set<string>();
  const seen = new Set<string>();
  const queue = [MAKER, join(COMPONENTS, 'refinements-editor.tsx')];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = read(file);
    for (const m of src.matchAll(/(?<![\w$.])name\s*=\s*"([^"]*)"/g)) out.add(m[1] ?? '');
    for (const m of src.matchAll(/(?<![\w$.])name\s*=\s*\{`([^`]*)`\}/g)) out.add((m[1] ?? '').replace(/\$\{[^}]*\}/g, '${}'));
    for (const m of src.matchAll(/from\s+'(\.[^']*)'/g)) {
      const f = resolve(dirname(file), `${m[1]}.tsx`);
      if (existsSync(f)) queue.push(f);
    }
  }
  if (/CUSTOMIZATION_FIELD_NAME/.test(read(join(COMPONENTS, 'customization-step.tsx')))) out.add('customization_draft');
  return out;
}

const ACTIONS = read(join(WEB, 'app/vendor-dashboard/services/actions.ts'));
const HELPERS = [
  'function parseCategory(',
  'function parseInclusionRows(',
  'function parseBracketRows(',
  'function parseSetnayanGift(',
  'function parsePrimaryPhoto(',
  'function parseShowcaseMedia(',
  'function parsePricingFields(',
];

/** Read by the save, posted by something other than the maker's own fields — each with its reason. */
const POSTED_ELSEWHERE: Record<string, string> = {
  claim_token: 'posted only on a couple-seeded card (`claimToken ? <input …>`) — a hidden input in the maker',
  customization_draft: 'CustomizationStep, under What’s included · details (create only; the flag is on in prod)',
  canonical_service: 'RefinementsEditor (bare), drawn on the server into the Details fold',
  refinement_keys: 'RefinementsEditor (bare), drawn on the server into the Details fold',
};

test('the maker reads back, and the save’s reads are found (an empty scan must not pass)', () => {
  assert.ok(read(MAKER).length > 20_000, 'the maker read back empty');
  const reads = namesRead(body(ACTIONS, 'export async function commitVendorService('));
  for (const canary of ['vendor_service_id', 'publish', 'claim_token', 'title', 'coverage_id', 'schedule_choice']) {
    assert.ok(reads.includes(canary), `the scan of commitVendorService lost "${canary}"`);
  }
});

test('1 · every field the one save reads is posted by the maker', () => {
  const reads = new Set<string>([
    ...namesRead(body(ACTIONS, 'export async function commitVendorService(')),
    ...HELPERS.flatMap((h) => namesRead(body(ACTIONS, h))),
    ...namesRead(read(join(WEB, 'lib/vendor-discount-rows.ts'))),
    ...namesRead(read(join(WEB, 'lib/service-card-save-parts.ts'))),
    ...namesRead(read(join(WEB, 'lib/vendor-service-refinements-write.ts'))),
  ]);
  assert.ok(reads.size >= 40, `only ${reads.size} names read — the scan stopped walking`);
  const posted = namesPosted();
  const missing = [...reads]
    .filter((n) => !posted.has(n) && !POSTED_ELSEWHERE[n])
    .sort();
  assert.deepEqual(missing, [], `the save reads these and nothing in the maker posts them: ${missing.join(', ')}`);
  // …and the refinement values (`field__<key>`) ride the server-drawn details.
  assert.match(read(join(WEB, 'lib/vendor-service-refinements-write.ts')), /ATTRIBUTE_FIELD_NAME_PREFIX/);
});

/**
 * THE MAP — every row of the 2026-10-08 truth table (92 fields + the two collected rows) → where it lives in the
 * simpler maker. The fold ids are the maker's `data="…"`. "row" = the first questions; "m-*" = under More settings;
 * "sheet:*" = a sheet with its own form; "list" = the Shop list row.
 */
export const FIELD_MAP: ReadonlyArray<readonly [string, string, string]> = [
  ['1', 'What you sell (kind)', 'kind'],
  ['2', 'Name', 'name'],
  ['3', 'Cover photo', 'photos'],
  ['4–5', 'Showcase photos (≤5) · clip (≤30 s)', 'photos'],
  ['6', 'Pricing basis', 'm-price'],
  ['7', 'Starting price / per-guest rate / hourly base', 'price'],
  ['8–13', 'Covers guests · each extra guest · minimum guests · minimum hours · each extra hour · size brackets', 'm-price'],
  ['14–19', 'Discounts: type · months ahead · amount · unit · expiry · conditions', 'm-disc'],
  ['20–21', "What's included: label · worth", 'included'],
  ['22–33', 'Customisation lines (always · included · optional · they pick · by the hour …)', 'm-inc'],
  ['34–35', 'Add-ons: label · from ₱ (≤12)', 'm-addons'],
  ['36', 'Setnayan gift', 'm-gift'],
  ['37–40', 'Crew size · crew meal · transport included · flat transport fee', 'm-crew'],
  ['41–43', 'Book ahead · last-minute ends · surcharge %', 'm-terms'],
  ['44', 'Bookings a day', 'm-terms'],
  ['45–48', 'Time slots: label · start · end · capacity (+ remove)', 'm-terms'],
  ['49–59', 'Payment schedule: label · % or ₱ · value · due · days · order · non-refundable · no-show · refund window · cancellation terms', 'm-pay'],
  ['60', 'Coverage this card sits in', 'm-who'],
  ['61–62', 'Event types · faiths', 'sheet:audience'],
  ['63', 'Branch', 'm-who'],
  ['64–66', 'Details (refinements)', 'm-details'],
  ['67', 'Comes with', 'm-comes'],
  ['68', 'Live / hidden', 'm-live'],
  ['69', 'Publish / save (one Create)', 'thumb'],
  ['70', 'Delete (hides if ever booked)', 'm-live'],
  ['71', 'Start a new card from this one', 'm-live'],
  ['72', 'Your old promise (read-only)', 'm-live'],
  ['73–75', 'Keep offer · claim token · collected search phrase', 'keep'],
  ['76–77', 'Request a category (Ask us)', 'sheet:kind'],
  ['78–80', 'Coverage add · edit · remove', 'list'],
  ['81–92', 'Package maker fields', 'list'],
  ['93', 'Record · collected', 'm-record'],
  ['94', 'Portfolio · collected', 'm-portfolio'],
  ['—', 'Schedule (its own / shares one) — NEW 2026-10-14', 'schedule'],
];

test('2 · every truth-table field has a home in the maker, and the home exists', () => {
  const src = read(MAKER);
  for (const [row, field, home] of FIELD_MAP) {
    if (home === 'list') continue; // lives on the Shop list (coverage panel · packages), unchanged by this step
    const anchor =
      home === 'thumb'
        ? /<SupplierThumbRow name="maker"/
        : home === 'keep'
          ? /Picked up where you left off\?/
          : home.startsWith('sheet:')
            ? new RegExp(`id="canvas-${home.slice(6)}"`)
            : new RegExp(`(?:data|data-maker-row)="${home}"|data-maker-row=\\{?"?${home}`);
    const found =
      anchor.test(src) || (home === 'name' && /data-maker-row="name"/.test(src)) || (home === 'kind' && /data="kind"/.test(src));
    assert.ok(found, `truth-table row ${row} (${field}) points at "${home}", which the maker no longer has`);
  }
  assert.ok(FIELD_MAP.length >= 34, 'the map lost rows');
});
