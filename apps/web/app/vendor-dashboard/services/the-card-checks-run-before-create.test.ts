/**
 * 🃏 THE CARD CHECKS RUN BEFORE CREATE — the wiring (owner 2026-10-26, "fix before Create").
 *
 * `lib/service-card-checks.test.ts` proves the rules. This proves they are ASKED where the owner put them:
 *   · in the SHIPPED maker (`canvas-maker.tsx`), each check drawn on its own row, and Create / Save waiting on them;
 *   · by every door that draws the maker (new · new/[category] · the edit sheet · the sheet over Today);
 *   · again by the save (`commitVendorService`), BEFORE the card is written — so nothing is created and then held;
 *   · and never by email, and never naming the other shop.
 * A rule nobody asks is the same as no rule, and its own unit tests stay green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const MAKER = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
const ACTIONS = read('app/vendor-dashboard/services/actions.ts');
const CHECK_ACTIONS = read('app/vendor-dashboard/services/card-check-actions.ts');
const CHECKS_UI = read('app/vendor-dashboard/services/_components/card-checks.tsx');

test('Create / Save waits while a check is open', () => {
  const m = MAKER.match(/const saveBlocked = ([^;]+);/);
  assert.ok(m, 'saveBlocked is gone from the maker');
  assert.match(m[1]!, /checks\.open > 0/, 'Create no longer waits for the card checks');
  assert.match(MAKER, /waiting=\{pending \|\| saveBlocked\}/, 'the Create button no longer reads saveBlocked');
});

test('each check is drawn on its own row of the maker', () => {
  const rows: [string, RegExp][] = [
    // 🚫 The claim words now ride the fair-presentation note (owner 2026-11-08) — one note per row for every check.
    ['name', /data-maker-row="name"[\s\S]*?<FairNote hits=\{checks\.fair\} field="card_name" \/>[\s\S]*?<ServiceMismatchNote/],
    ['included', /data-maker-row="included"[\s\S]*?<FairNote hits=\{checks\.fair\} field="included" \/>/],
    ['extras', /data-maker-row="extras"[\s\S]*?<FairNote hits=\{checks\.fair\} field="extras" \/>/],
    ['photos', /data-maker-row="photos"[\s\S]*?<PhotoCheckNotes /],
  ];
  for (const [row, re] of rows) assert.match(MAKER, re, `the ${row} row no longer shows its check`);
});

test('every door that draws the maker hands it the rules', () => {
  const doors = [
    'app/vendor-dashboard/services/new/_components/new-service-maker.tsx',
    'app/vendor-dashboard/services/new/[category]/page.tsx',
    'app/vendor-dashboard/services/[serviceId]/page.tsx',
  ];
  for (const d of doors) {
    const src = read(d);
    assert.match(src, /<CanvasMaker/, `${d} no longer draws the maker — update this list`);
    assert.match(src, /checkRules=\{ctx\.checkRules\}/, `${d} draws the maker without the card checks`);
  }
  assert.match(read('lib/service-card-maker.server.ts'), /loadCardCheckRules\(vendorProfileId\)/, 'loadMakerContext no longer reads the rules');
});

test('the save asks the same checks again, before the card is written', () => {
  const start = ACTIONS.indexOf('export async function commitVendorService');
  assert.ok(start > 0);
  const body = ACTIONS.slice(start);
  const ask = body.indexOf('await cardCheckRefusal(');
  const write = body.indexOf("rpc('save_vendor_service'");
  assert.ok(ask > 0, 'commitVendorService no longer asks the card checks');
  assert.ok(write > 0);
  assert.ok(ask < write, 'the checks run AFTER the card is written — a card would be created and then held');
  assert.match(body.slice(ask, ask + 900), /if \(refusal\) return back\(refusal\)/, 'a refusal no longer stops the save');
});

test('the photo check the supplier reads never names the other shop', () => {
  const fn = CHECK_ACTIONS.slice(CHECK_ACTIONS.indexOf('async function checkCardPhotosAction'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /return checkCardPhotos\(/, 'the maker’s photo call must return the verdicts alone');
  assert.doesNotMatch(body, /matchCardPhotos|source/, 'the maker’s photo call can reach the other shop');
  assert.doesNotMatch(CHECKS_UI, /business_name|vendorProfileId|source\./, 'the maker’s rows can name the other shop');
});

test('notices are in-app only — no email from the card checks', () => {
  for (const [name, src] of [
    ['card-check-actions.ts', CHECK_ACTIONS],
    ['card-checks.tsx', CHECKS_UI],
    ['service-card-checks.server.ts', read('lib/service-card-checks.server.ts')],
    ['card-photo-check.server.ts', read('lib/card-photo-check.server.ts')],
  ] as const) {
    assert.doesNotMatch(src, /resend|sendEmail|send-email|emitNotification/i, `${name} sends a notice`);
  }
});
