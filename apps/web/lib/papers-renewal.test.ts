import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { papersDueIn } from './papers-due';
import { hasVerifiedBadge } from './verified-badge';
import {
  FREE_UNVERIFIED,
  RENEWED_NEWS,
  RENEWING_COUPLE_LINE,
  RENEWING_COUPLE_MARK,
  adminPaperLines,
  adminPapersSummary,
  coupleShopRenewing,
  freeUnverifiedLines,
  lapsedDetail,
  nextRenewalLine,
  paperStanding,
  planBackAtRenewal,
  planHoldAtLapse,
  renewalBucket,
  renewalButtonLabel,
  renewalCountLine,
  renewalNotice,
  renewalPageCard,
  renewalReadyToSend,
  renewalStage,
  renewedNotice,
  seedRenewalDraft,
} from './papers-renewal';

/**
 * 📄 PAPERS RENEWAL — the approved design `Setnayan-specs/prototypes/supplier_papers_renewal_2026-11-14_fable.html`
 * and its four ruled picks (DECISION_LOG 2026-11-14 "the seven open questions ruled: Fable's picks taken"). One test
 * per rule; the wiring tests read the source the rule lives in.
 */

const WEB = join(new URL('.', import.meta.url).pathname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const DUE = papersDueIn(2027); // the END of 30 March 2027, Manila
const verified = { verified: true, dueAt: DUE, lapsedAt: null };
const at = (iso: string) => new Date(iso);

/* ── §1 · the reminders on Today ──────────────────────────────────────────── */

test('§1 · 60 and 30 days are a to-do (Not now); 7 days is a live band, warning, with no close word', () => {
  const sixty = renewalNotice(verified, at('2027-01-29T09:00:00+08:00'))!;
  assert.equal(sixty.kind, 'todo');
  assert.equal(sixty.closable, true);
  assert.equal(sixty.title, 'Your Verified badge is up for renewal on 30 March');
  assert.match(sixty.detail[0]!, /^In 60 days your Verified badge needs your current papers — including this year’s Mayor’s Permit\. Your shop stays listed and couples can still book you\.$/);
  assert.deepEqual(sixty.action, { label: 'Renew my papers', href: '/vendor-dashboard/profile#docs' });

  const thirty = renewalNotice(verified, at('2027-02-28T09:00:00+08:00'))!;
  assert.equal(thirty.kind, 'todo');
  assert.equal(thirty.title, '30 days left to renew your papers — due 30 March');

  const week = renewalNotice(verified, at('2027-03-23T09:00:00+08:00'))!;
  assert.equal(week.kind, 'live');
  assert.equal(week.tone, 'warning');
  assert.equal(week.closable, false, 'missing it affects couples, so it has no close word');
  assert.equal(week.title, '7 days left — renew your papers by 30 March');

  // A closer stage asks again: the key carries the stage.
  assert.notEqual(sixty.key, thirty.key);
  assert.equal(renewalNotice(verified, at('2027-01-28T09:00:00+08:00')), null, 'more than 60 days out: nothing');
  assert.equal(renewalNotice(verified, at('2027-03-30T20:00:00+08:00'))!.title, '1 day left — renew your papers by 30 March');
});

test('§1 · a shop never verified, or with no renewal day, has no reminder at all', () => {
  assert.equal(renewalNotice({ verified: false, dueAt: DUE, lapsedAt: null }, at('2027-03-24T00:00:00+08:00')), null);
  assert.equal(renewalNotice({ verified: true, dueAt: null, lapsedAt: null }, at('2027-03-24T00:00:00+08:00')), null);
});

/* ── §2 · the day after 30 March ──────────────────────────────────────────── */

test('§2 · the day after: a live band, problem tone, no close word, with this shop’s own numbers behind the ⓘ', () => {
  const band = renewalNotice({ ...verified, lapsedAt: '2027-03-31T00:05:00+08:00' }, at('2027-03-31T09:00:00+08:00'), { bookings: 4, asksBefore: 1 })!;
  assert.equal(band.kind, 'live');
  assert.equal(band.tone, 'problem');
  assert.equal(band.closable, false);
  assert.equal(band.title, 'New couples can’t find you — your papers weren’t renewed by 30 March');
  assert.deepEqual(band.detail, [
    'Since 31 March your shop is Free · Unverified. Your 4 bookings carry on as normal — chat, payments, schedule, the Event Hub.',
    'You can still answer the 1 ask that came in before 31 March.',
    'You’re out of Find and Discover, so new couples can’t find you.',
    'Send this year’s papers and it all comes back once they’re checked — usually on the spot.',
  ]);
});

test('§2 · an unread count is said without a number — never as zero', () => {
  const lines = lapsedDetail('31 March', { bookings: null, asksBefore: null });
  assert.match(lines[0]!, /Your bookings carry on as normal/);
  assert.ok(!lines.join(' ').match(/\b0 bookings\b/));
});

test('§2 · the words follow the date, not the job: past 30 March reads lapsed before the daily pass stamps it', () => {
  assert.equal(renewalStage(verified, at('2027-03-31T00:00:01+08:00'))?.stage, 'lapsed');
  assert.equal(renewalStage(verified, at('2027-03-30T23:59:00+08:00'))?.stage, 'week');
});

test('§2 · no renewal line says a lapsed shop “can’t be booked” — it can, through its own website (15 Nov ruling)', () => {
  const words = [
    ...(['2027-01-29', '2027-02-28', '2027-03-23'] as const).flatMap((d) => {
      const n = renewalNotice(verified, at(`${d}T00:00:00+08:00`))!;
      return [n.title, ...n.detail];
    }),
    ...renewalNotice({ ...verified, lapsedAt: '2027-03-31T00:00:00+08:00' }, at('2027-04-01T00:00:00+08:00'))!.detail,
    FREE_UNVERIFIED.title,
    FREE_UNVERIFIED.sub,
    ...freeUnverifiedLines(3).map((l) => l.text),
    RENEWING_COUPLE_LINE,
    RENEWING_COUPLE_MARK,
  ].join(' \n ');
  assert.doesNotMatch(words, /can[’']t (book|take new bookings)|bookings are paused|can[’']t send you a booking/i);
});

/* ── Ruling (1) · the badge stays until the END of 30 March ───────────────── */

test('ruling 1 · on 1 January (the permit’s printed end) the badge is on and nothing reads “lapsed”', () => {
  const jan1 = at('2027-01-01T00:00:01+08:00');
  assert.equal(hasVerifiedBadge({ verification_state: 'verified', next_renewal_due_at: DUE }, jan1), true);
  assert.equal(renewalStage(verified, jan1), null);
  assert.equal(renewalBucket({ verification_state: 'verified', next_renewal_due_at: DUE }, jan1), null);
});

/* ── Ruling (2) · a paid plan's unused days WAIT ─────────────────────────── */

test('ruling 2 · the lapse holds a paid plan with its days left; the free “verified” plan simply drops', () => {
  const now = at('2027-03-31T00:05:00+08:00');
  assert.deepEqual(planHoldAtLapse({ tier_state: 'verified' }, now), { kind: 'free_drop' });
  assert.deepEqual(planHoldAtLapse({ tier_state: 'free' }, now), { kind: 'none' });
  const pro = planHoldAtLapse({ tier_state: 'pro', tier_expires_at: '2027-04-10T00:05:00+08:00' }, now);
  assert.deepEqual(pro, { kind: 'hold', tier: 'pro', heldMs: 10 * 86_400_000 });
  assert.deepEqual(planHoldAtLapse({ tier_state: 'enterprise', tier_expires_at: null }, now), { kind: 'hold', tier: 'enterprise', heldMs: null });
  assert.deepEqual(planHoldAtLapse({ tier_state: 'pro', tier_expires_at: '2027-03-01T00:00:00Z' }, now), { kind: 'none' }, 'a plan already over has nothing to hold');
});

test('ruling 2 · on renewal the held plan comes back with the same days, counted from the approval', () => {
  const renewedAt = at('2027-05-01T10:00:00+08:00');
  assert.deepEqual(planBackAtRenewal({ tier: 'pro', held_ms: 10 * 86_400_000 }, renewedAt), {
    tier_state: 'pro',
    tier_expires_at: new Date(renewedAt.getTime() + 10 * 86_400_000).toISOString(),
  });
  assert.deepEqual(planBackAtRenewal({ tier: 'solo', held_ms: null }, renewedAt), { tier_state: 'solo', tier_expires_at: null });
  assert.equal(planBackAtRenewal({ tier: 'verified', held_ms: 5 }, renewedAt), null, 'only a paid plan is held');
  assert.equal(planBackAtRenewal(null, renewedAt), null);
});

test('ruling 2 · wiring: the lapse writes the hold into its audit row; the approval reads it back', () => {
  const lapse = code('lib/papers-lapse.server.ts');
  assert.match(lapse, /const plan = planHoldAtLapse\(row, now\)/);
  assert.match(lapse, /plan\.kind === 'hold' \? \{ tier_state: 'free', tier_expires_at: null \}/);
  assert.match(lapse, /held_tier: plan\.tier, held_ms: plan\.heldMs/);
  const engine = code('lib/verification-decision.server.ts');
  const approve = engine.slice(engine.indexOf("case 'approved':"), engine.indexOf("case 'rejected':"));
  assert.match(approve, /await heldPlanBack\(admin, vendor\.vendor_profile_id, new Date\(now\)\)/);
  assert.match(engine, /\.eq\('action', PAPERS_LAPSED_AUDIT_ACTION\)/);
});

/* ── Ruling (3) · couples who already booked are NOT told ────────────────── */

test('ruling 3 · the lapse tells the shop and nobody else — one notification, to the shop’s own account', () => {
  const lapse = code('lib/papers-lapse.server.ts');
  assert.equal((lapse.match(/emitNotification\(/g) ?? []).length, 1);
  assert.match(lapse, /emitNotification\(\{\s*userId: row\.user_id,/);
  assert.doesNotMatch(lapse, /event_vendors|event_members|couple/i, 'the lapse reads the couples who booked — it must not tell them');
});

/* ── Ruling (4) · the couple's reason line ────────────────────────────────── */

test('ruling 4 · a lapsed shop that WAS verified reads the renewing words; a never-verified shop keeps its own', () => {
  assert.equal(RENEWING_COUPLE_MARK, 'Renewing their papers with Setnayan');
  assert.match(RENEWING_COUPLE_LINE, /^This supplier is renewing their papers with Setnayan\./);
  assert.equal(coupleShopRenewing({ verification_state: 'verified', papers_current: false }), true);
  assert.equal(coupleShopRenewing({ verification_state: 'verified', papers_current: true }), false);
  assert.equal(coupleShopRenewing({ verification_state: 'unverified', papers_current: false }), false);
  assert.equal(coupleShopRenewing({ verification_state: 'verified' }), false, 'an unread column is not a lapse');
  const notice = code('app/v/[slug]/_components/not-yet-verified-notice.tsx');
  assert.match(notice, /renewing \? RENEWING_COUPLE_MARK : NOT_YET_VERIFIED_LINE/);
  const page = code('app/v/[slug]/page.tsx');
  assert.match(page, /const renewing = coupleShopRenewing\(vendor\);/);
  assert.match(page, /const cinematicHero = vendor\.verification_state === 'verified' && !renewing;/, '§4: the calm page, no hero');
  assert.match(page, /vendor\.verification_state === 'verified' && !renewing \? \(/, '§4: no badge on a lapsed shop');
  assert.match(page, /<NotYetVerifiedNotice renewing=\{renewing\} \/>/);
  assert.match(page, /papers_current,/, 'the page must select papers_current');
});

/* ── §3 · the renewal draft keeps what is still good ──────────────────────── */

const read = (registry: string, expirationDate: string | null, registrationNumber = 'X1') => ({
  r2_key: `k/${registry}`,
  attempts: 1,
  sig: 'sealed',
  evidence: { model: { registry, expirationDate, registrationNumber }, qrTexts: [], read_at: '2026-11-14T00:00:00Z' },
});

test('§3 · last year’s DTI and BIR are kept (sealed read and all); the ended permit leaves only its end date', () => {
  const seed = seedRenewalDraft(
    {
      dti_certificate: read('dti', '2031-03-04', '3456789'),
      bir_2303: read('bir', null, '123-456-789-000'),
      mayors_permit: read('lgu', '2026-12-31', '2026-04417'),
      social_media: { url: 'x' },
    },
    '2027-03-31',
    'app-1',
  );
  assert.deepEqual((seed.dti_certificate as { renewal: unknown }).renewal, { kept_from: 'app-1' });
  assert.equal((seed.dti_certificate as { sig: string }).sig, 'sealed', 'the seal travels with the read');
  assert.deepEqual((seed.bir_2303 as { renewal: unknown }).renewal, { kept_from: 'app-1' });
  assert.deepEqual(seed.mayors_permit, { attempts: 0, renewal: { ended_on: '2026-12-31' } });
  assert.deepEqual(seed.social_media, { url: 'x' });
});

test('§3 · a DTI that ran out, or a paper typed by hand, is asked for again', () => {
  const seed = seedRenewalDraft(
    { dti_certificate: read('dti', '2027-01-15'), bir_2303: { ...read('bir', null), manual: true } },
    '2027-03-31',
    'app-1',
  );
  assert.deepEqual(seed.dti_certificate, { attempts: 0, renewal: { ended_on: '2027-01-15' } });
  assert.equal((seed.bir_2303 as { r2_key?: string }).r2_key, undefined);
});

test('§3 · the rows, the count and the one-tap button say what the drawing says', () => {
  const seed = seedRenewalDraft(
    { dti_certificate: read('dti', '2031-03-04'), bir_2303: read('bir', null), mayors_permit: read('lgu', '2026-12-31') },
    '2027-03-31',
    'app-1',
  );
  const st = (['dti_certificate', 'bir_2303', 'mayors_permit'] as const).map((k) => paperStanding(k, seed[k], true));
  assert.deepEqual(st.map((s) => s?.line), ['Still good · valid until 4 Mar 2031', 'Still good · no end date', 'Ended 31 Dec 2026 — upload this year’s']);
  assert.equal(renewalCountLine(st), '2 of 3 still good');
  assert.equal(renewalButtonLabel(['mayors_permit']), 'Upload this year’s permit');
  // The new permit lands: read ✓ with its number.
  const fresh = { ...read('lgu', '2027-12-31', '2027-03158'), renewal: { ended_on: '2026-12-31' } };
  assert.equal(paperStanding('mayors_permit', fresh, true)?.line, 'Read ✓ · 2027-03158 · valid until 31 Dec 2027');
  assert.equal(renewalCountLine([st[0]!, st[1]!, paperStanding('mayors_permit', fresh, true)]), '3 of 3');
  assert.equal(paperStanding('mayors_permit', fresh, false), null, 'outside a renewal the row is drawn as it always was');
});

test('§3 → §6 · one tap: the page presses Submit itself only when all three are in and read clean', () => {
  const kept = { ...read('dti', '2031-03-04'), renewal: { kept_from: 'a' } };
  assert.equal(renewalReadyToSend([kept, read('bir', null), read('lgu', '2027-12-31')]), true);
  assert.equal(renewalReadyToSend([kept, read('bir', null), { attempts: 0, renewal: { ended_on: '2026-12-31' } }]), false);
  assert.equal(renewalReadyToSend([kept, read('bir', null), { ...read('lgu', '2027-12-31'), manual: true }]), false, 'a typed paper goes to a person');
  const place = code('app/vendor-dashboard/shop/_components/paper-upload-place.tsx');
  assert.match(place, /if \(!ready \|\| !uploadedHere\.current\) return;/, 'never on a page load — only after an upload made here');
  assert.match(place, /await submitInlineForReview\(null, new FormData\(\)\)/, 'the same Submit, never a second door');
});

test('§3 · wiring: an approved shop’s renewal draft is seeded from its approved papers', () => {
  const actions = code('app/vendor-dashboard/shop/inline-docs-actions.ts');
  assert.match(actions, /seedRenewalDraft\(app\.doc_uploads as Record<string, unknown> \| null, manilaDateKey\(new Date\(\)\), app\.application_id\)/);
});

/* ── §3 · §6 · the verification page's state card ─────────────────────────── */

test('§3 · §6 · the state card: Free · Unverified, then waiting on a person, then verified again', () => {
  const facts = { verified: true, dueAt: DUE, lapsedAt: '2027-03-31T00:00:00+08:00', lastVerifiedAt: '2026-11-14T00:00:00Z', renewed: false, bookings: 4 };
  const apr = at('2027-04-02T00:00:00+08:00');
  assert.equal(renewalPageCard(facts, false, apr), 'free_unverified');
  assert.equal(renewalPageCard(facts, true, apr), 'waiting');
  const back = { verified: true, dueAt: papersDueIn(2028), lapsedAt: null, lastVerifiedAt: '2027-04-03T00:00:00+08:00', renewed: true, bookings: null };
  assert.equal(renewalPageCard(back, false, at('2027-04-04T00:00:00+08:00')), 'verified_again');
  assert.equal(renewalPageCard(back, false, at('2027-05-04T00:00:00+08:00')), null, 'two weeks on, the page is as it always was');
  assert.equal(nextRenewalLine(papersDueIn(2028)), 'Next renewal: 30 March 2028.');
  assert.deepEqual(freeUnverifiedLines(4).map((l) => l.text), [
    'Your 4 bookings carry on',
    'Couples can still message you',
    'You’re out of Find and Discover for now',
    'Your plan is Free until you’re verified again',
  ]);
});

/* ── §6 · restored ────────────────────────────────────────────────────────── */

test('§6 · a clean renewal earns ONE news line (Got it), keyed by the new renewal day', () => {
  const n = renewedNotice({ renewedAt: '2027-04-03T00:00:00+08:00', nextDueAt: papersDueIn(2028), verified: true, lapsedAt: null }, at('2027-04-03T09:00:00+08:00'))!;
  assert.equal(n.kind, 'news');
  assert.equal(n.title, RENEWED_NEWS.title);
  assert.equal(n.key, `papers-renewed:${papersDueIn(2028)}`);
  assert.equal(renewedNotice({ renewedAt: '2027-04-03T00:00:00+08:00', nextDueAt: papersDueIn(2028), verified: true, lapsedAt: '2027-04-04T00:00:00Z' }, at('2027-04-05T00:00:00Z')), null);
});

/* ── Today wiring ─────────────────────────────────────────────────────────── */

test('Today: the renewal is the notice at the top — the old “Business permit expires” row is gone', () => {
  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /<PapersRenewalLine supabase=\{supabase\} vendorProfileId=\{vendorProfileId\} \/>/);
  const today = code('lib/supplier-today.ts') + code('lib/supplier-today-view.ts');
  assert.doesNotMatch(today, /permitNeed|Business permit expires/);
  const line = code('app/vendor-dashboard/_components/papers-renewal-line.tsx');
  assert.match(line, /<Notice/, 'the renewal goes through the one notice system');
});

/* ── §5 · the admin's view ────────────────────────────────────────────────── */

test('§5 · the Renewals chips: Free · Unverified, Due in 7 days, Renewed', () => {
  const now = at('2027-03-24T00:00:00+08:00');
  assert.equal(renewalBucket({ verification_state: 'verified', next_renewal_due_at: DUE, papers_lapsed_at: '2027-03-31T00:00:00Z' }, now), 'lapsed');
  assert.equal(renewalBucket({ verification_state: 'verified', next_renewal_due_at: DUE }, now), 'due_week');
  assert.equal(
    renewalBucket({ verification_state: 'verified', next_renewal_due_at: papersDueIn(2028), last_verified_at: '2027-03-02T00:00:00+08:00', renewed: true }, at('2027-03-10T00:00:00+08:00')),
    'renewed',
  );
  assert.equal(renewalBucket({ verification_state: 'unverified', next_renewal_due_at: DUE }, now), null);
  const lines = adminPaperLines(
    { dti_certificate: read('dti', '2031-03-04', '3456789'), bir_2303: read('bir', null, '123-456-789-000'), mayors_permit: read('lgu', '2026-12-31', '2026-04417') },
    '2027-03-31',
  );
  assert.deepEqual(lines.map((l) => `${l.tag} ${l.text}`), [
    'Read DTI 3456789 · valid until 4 Mar 2031',
    'Read BIR 2303 123-456-789-000 · no end date',
    'Ended Business Permit 2026-04417 · ended 31 Dec 2026',
  ]);
  assert.equal(adminPapersSummary(lines), 'DTI ✓ · BIR ✓ · Permit ended 31 Dec 2026');
});

test('§5 · nothing in the admin view changes a shop — no write, no “let it through” button', () => {
  const admin = code('lib/papers-renewal-admin.server.ts') + code('app/admin/accounts/_surfaces/renewals-list.tsx');
  assert.doesNotMatch(admin, /\.update\(|\.insert\(|\.upsert\(|\.delete\(|'use server'/);
});
