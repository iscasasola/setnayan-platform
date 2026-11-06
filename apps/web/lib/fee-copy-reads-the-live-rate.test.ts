/**
 * fee-copy-reads-the-live-rate.test.ts — every page that QUOTES the supplier
 * booking-fee rate quotes the one the owner set, never the code default.
 *
 * ⚖ Audit `BOOKING_FEE_RULES_AUDIT_2026-10-12.md` A3 / build item 5, approved
 * by the owner 2026-10-12. The rate lives on `platform_settings` row 1 and is
 * edited at /admin/pricing ("prices from the admin page"; "never type the rate
 * — derive it"). `bookingFeeScheduleSummary()` with NO argument prints the
 * code constant `BOOKING_FEE`. Five public and supplier surfaces called it that
 * way, so the day the owner edits the rate they advertise one nobody is billed.
 *
 * WHAT THIS HOLDS
 *   1. No non-test file outside `lib/booking-fee.ts` calls
 *      `bookingFeeScheduleSummary()` with no argument.
 *   2. The commission promise takes the schedule — no default argument, so a
 *      caller cannot forget it — and a NULL schedule names the fee with NO rate
 *      (never the default dressed as today's figure).
 *   3. The pages that read the live schedule actually read it.
 *
 * SABOTAGE (run 2026-10-12): put `bookingFeeScheduleSummary()` back into the
 * front-door card → test 1 RED, naming the file; give
 * `supplierCommissionShort` a `= BOOKING_FEE` default → test 2 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { BOOKING_FEE, bookingFeeScheduleSummary } from './booking-fee';
import { supplierCommissionPromise, supplierCommissionShort } from './commission-promise';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = ['app', 'lib'].flatMap((r) => walk(resolve(WEB, r)));
const src = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));

test('no page quotes the CODE DEFAULT rate — every summary is handed a schedule', () => {
  assert.ok(FILES.length > 500, `only ${FILES.length} files walked — the roots are wrong`);
  const offenders = FILES.map((f) => relative(WEB, f))
    .filter((rel) => rel !== 'lib/booking-fee.ts')
    .filter((rel) => /bookingFeeScheduleSummary\(\s*\)/.test(src(rel)));
  assert.deepEqual(
    offenders,
    [],
    `These print the code default \`BOOKING_FEE\`, not the owner's live rate: ${offenders.join(', ')}. ` +
      'Pass the schedule the page read (`getLiveBookingFeeSchedule()`), or name the fee without a rate.',
  );
});

test('the commission promise has no default schedule, and NULL prints no rate', () => {
  const promise = src('lib/commission-promise.ts');
  assert.match(promise, /export function supplierCommissionPromise\(schedule: BookingFeeSchedule \| null\)/);
  assert.match(promise, /export function supplierCommissionShort\(schedule: BookingFeeSchedule \| null\)/);

  const rate = bookingFeeScheduleSummary(BOOKING_FEE);
  // Only meaningful while the fee is on; with it off neither prints a rate.
  if (process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED === 'true') {
    assert.ok(supplierCommissionShort(BOOKING_FEE).includes(rate));
    assert.ok(supplierCommissionPromise(BOOKING_FEE).includes(rate));
  }
  for (const s of [supplierCommissionShort(null), supplierCommissionPromise(null)]) {
    assert.ok(!s.includes(rate), `a null schedule printed the code default: ${s}`);
    assert.doesNotMatch(s, /\d+(\.\d+)?%(?! commission)/, `a null schedule printed a rate: ${s}`);
  }
  // A live schedule the owner changed is the one that prints.
  const edited = { ...BOOKING_FEE, rate: 0.04 };
  const editedRate = bookingFeeScheduleSummary(edited);
  assert.notEqual(editedRate, rate, 'fixture: the edited schedule must read differently');
});

test('the pages that quote the rate read the live schedule', () => {
  const READERS: Record<string, RegExp> = {
    'app/for-suppliers/page.tsx': /getLiveBookingFeeSchedule\(\)/,
    'app/_components/frontdoor/data.ts': /getLiveBookingFeeSchedule\(\)/,
    'app/_components/home/pricing-data.ts': /getLiveBookingFeeSchedule\(\)/,
    // S-PR4 (batch 5 join): the old Earnings blurb is Customers › Money's locked-year line.
    'app/vendor-dashboard/customers/_components/money-segment.tsx': /getLiveBookingFeeSchedule\(\)/,
    'app/vendor/claim/[token]/page.tsx': /getBookingFeeSchedule\(admin\)/,
    'app/llms.txt/route.ts': /bookingFee:\s*await getBookingFeeSchedule\(admin\)/,
  };
  for (const [rel, re] of Object.entries(READERS)) {
    assert.match(src(rel), re, `${rel} no longer reads the live booking-fee schedule`);
  }
});

test('/pricing share lines: the supplier claim carries the fee, the couple zero stands alone', () => {
  // Audit 2026-10-12 E4 · build item 6. SABOTAGE: restore "Suppliers keep 100%"
  // in the metadata → RED.
  const page = src('app/(shell)/pricing/page.tsx');
  const meta = page.slice(page.indexOf('export const metadata'), page.indexOf('};', page.indexOf('export const metadata')));
  assert.ok(meta.length > 200, `metadata slice floor: ${meta.length}`);
  assert.doesNotMatch(meta, /keep 100%/i, 'a supplier is told they keep 100% with no fee beside it');
  assert.doesNotMatch(meta, /Setnayan takes \$\{COMMISSION_PCT\}%/, 'a supplier is told Setnayan takes nothing');
  const feeLines = meta.match(/booking fee/gi) ?? [];
  assert.equal(feeLines.length, 3, `description, openGraph and twitter must each name the fee (found ${feeLines.length})`);
  assert.doesNotMatch(page, /supplier subscription \$\{cadence\.shortLabel\}\. 0% commission on bookings\./);
  assert.match(page, /supplierCommissionShort\(feeSchedule\)/, 'the supplier-plan JSON-LD lost its fee sentence');
});
