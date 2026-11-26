/**
 * supplier-reads-say-couldnt-load.test.ts — area 5's failed reads are SAID, never drawn as empty, gone or fine.
 *
 * Final check 25 Nov 2026, area 5 batch 2: A5-G6-01 (albums) · A5-G6-05/06 (partnerships) · A5-G6-11 (repertoire) ·
 * A5-G6-10 (recommendations) · A5-G5-08 (who gets inquiries) · A5-G5-06 (track record) · A5-G1-09 (the couple's QR
 * landing) · A5-G1-13 (claim finalize) · A5-G1-14 (fit check) · A5-G2-06 (Today) · A5-G1-11 (claim dead ends).
 *
 * The rule (CLAUDE.md § 5.4): a refused read never renders as zero, empty, "not found" or success. Readers that gate an
 * ACTION keep failing closed (`listHostEvents` → [] owns no event); the screen reads the honest twin.
 * Behaviour on a stubbed client; the wiring by source, comments stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listHostEvents, readHostEvents } from '@/lib/vendor-couple-invite';
import { computeVendorFit } from '@/lib/vendor-fit-qr';
import { stripComments } from '@/lib/strip-comments';

function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'neq', 'is', 'not', 'in', 'ilike', 'order', 'limit']) builder[m] = () => builder;
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}
const REFUSED = { data: null, error: { code: '42501', message: 'permission denied' } };

test('host events: the screen reader says null on a refusal; the action reader fails closed (A5-G1-09)', async () => {
  assert.equal(await readHostEvents(stubClient(REFUSED), 'user-1'), null);
  assert.deepEqual(await listHostEvents(stubClient(REFUSED), 'user-1'), []);
  assert.deepEqual(await readHostEvents(stubClient({ data: [], error: null }), 'user-1'), []);
});

test('fit check: a date with an unread calendar is "couldn\'t check", never free (A5-G1-14)', () => {
  const v = computeVendorFit({
    eventDate: '2027-06-13',
    vendorAvailableOnDate: null,
    distanceKm: null,
    serviceRadiusKm: null,
    startingPricePhp: null,
    remainingBudgetPhp: null,
  });
  assert.equal(v.checks[0]!.ok, null);
  assert.equal(v.checks[0]!.label, 'Couldn’t check your date');
  assert.equal(v.fits, false, 'an unread calendar is never "Fits"');
  const noDate = computeVendorFit({
    eventDate: null,
    vendorAvailableOnDate: null,
    distanceKm: null,
    serviceRadiusKm: null,
    startingPricePhp: null,
    remainingBudgetPhp: null,
  });
  assert.equal(noDate.checks[0]!.label, 'Set your date to check');
  assert.equal(noDate.fits, true, 'no date set stays warn-only (owner-locked)');
});

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

test('fit page: a refused calendar read is null, never `true` (A5-G1-14)', () => {
  const fit = src('app/vendor/fit/[ref]/page.tsx');
  assert.doesNotMatch(fit, /\.catch\(\(\) => true\)/);
  assert.match(fit, /\.catch\(\(\) => null\)/);
});

test('albums, partnerships, inquiries: no empty claim or raw id on a failed read (A5-G6-01/05/06, A5-G5-08)', () => {
  assert.match(src('app/vendor-dashboard/collections/albums/page.tsx'), /upcoming\.length \+ past\.length === 0 && !room\.complete \?/);
  const p = src('app/vendor-dashboard/partnerships/page.tsx');
  assert.doesNotMatch(p, /nameMap\.get\(id\) \?\? id;/);
  assert.match(p, /Incoming requests\{partnershipsMeasured \?/);
  assert.match(src('app/vendor-dashboard/team/roles/inquiries/page.tsx'), /sections\.length === 0 && !readFailed \?/);
});

test('repertoire and recommendations say "couldn\'t load" (A5-G6-11, A5-G6-10)', () => {
  const rep = src('app/vendor-dashboard/repertoire/page.tsx');
  assert.match(rep, /readVendorSongs\(supabase, profile\.vendor_profile_id\)/);
  assert.match(rep, /if \(setList\.failed \|\| results === null\) return <RepertoireUnread \/>;/);
  const songs = src('lib/songs.ts');
  // Each refused read is logged, then returns null — never an empty list (#8314, ugat-both-ends).
  for (const name of ['searchSongs', 'fetchCuratedSongs']) {
    assert.match(songs, new RegExp(`if \\(error\\) \\{\\s*logQueryError\\('${name}', error[^;]*;\\s*return null;\\s*\\}`), `${name}: a refused read is not null`);
  }

  const rec = src('app/vendor-dashboard/recommendations/page.tsx');
  assert.match(rec, /readFailed=\{firstReadFailed\}/);
  assert.match(rec, /readFailed=\{cardsReadFailed\}/);
  assert.match(rec, /recError \|\| optinRes\.error \|\| feedbackRes\.error \|\| catalogRes\.error \|\| leafRes\.error/);
  assert.match(src('app/vendor-dashboard/recommendations/_panel.tsx'), /readFailed \? \(\s*<ToolFail/);
});

test('track record, Today, finalize and the QR landing never turn a failure into a wrong state (A5-G5-06, A5-G2-06, A5-G1-13, A5-G1-09)', () => {
  const tr = src('app/vendor-dashboard/track-record/page.tsx');
  assert.doesNotMatch(tr, /Set up your supplier profile first/);
  assert.match(tr, /<ToolFail/);
  const today = src('app/vendor-dashboard/page.tsx');
  assert.match(today, /<ErrorState\s+title="This page is temporarily unavailable\."/);
  assert.match(today, /label="Try again" href="\/vendor-dashboard"/);
  assert.match(src('app/vendor/claim/[token]/finalize/page.tsx'), /if \(!countError && \(count \?\? 0\) === 0\)/);
  const invite = src('app/vendor-invite/[slug]/page.tsx');
  assert.match(invite, /if \(vendorError\) \{/);
  assert.match(invite, /hostEvents === null \?/);
  assert.match(invite, /readHostEvents\(admin, user\.id\)/);
});

test('claim dead ends carry a real door, never "contact support" alone (A5-G1-11)', () => {
  const claim = src('app/vendor/claim/[token]/page.tsx');
  assert.doesNotMatch(claim, /please contact support/);
  assert.equal((claim.match(/^\s+help$/gm) ?? []).length, 2, 'both dead ends ask for the help door');
  assert.match(claim, /href=\{`\$\{routes\.help\.index\(\)\}\?for=shop#contact`\}/);
});
