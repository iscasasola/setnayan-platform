/**
 * trade-data.test.ts — the five shared marketing widgets (/for-suppliers + /for-coordinators) say only what is
 * read from the product, and promise nothing that has not shipped.
 *
 *   (1) Every photo marked as landed is on disk; until then the widget draws a stand-in (owner 5 Nov).
 *   (2) Every limit on a plan card is TIER_CAPS / FREE_HELPER_SEATS — no number typed.
 *   (3) The QR jobs are SUPPLIER_QR_MODES (+ review); the medals and steps are badge-tiers' TIERS.
 *   (4) The widget copy types no price, says no "Event Hub" (owner: a couple-side word), links no demo / sample
 *       page (owner: "just do not add buttons"), and does not claim the two pieces still in unmerged PRs
 *       ("Send your own forms" for every supplier — #7248; the supplier's offline schedule — #7270).
 *
 * SABOTAGE (run 2026-11-05): set TRADE_PHOTOS['site-pro'] to a missing file → (1) RED · type '100 km' as Pro's
 * reach in planLimits → (2) RED · add "Event Hub" to the package line → (4) RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import { SUPPLIER_QR_MODES } from '@/lib/supplier-qr-codes';
import { TIERS } from '@/lib/badge-tiers';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import { LIMIT_LABELS, PLAN_KEYS, TRADE_PHOTOS, planCards, planLimits, qrJobs, rewardLadder } from './trade-data';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');

test('(1) a photo marked as landed is really on disk', () => {
  const keys = Object.keys(TRADE_PHOTOS);
  assert.ok(keys.length >= 10, `only ${keys.length} photo slots`);
  for (const [key, src] of Object.entries(TRADE_PHOTOS)) {
    if (src === null) continue;
    assert.ok(src.startsWith('/'), `${key}: a public path starts with /`);
    assert.ok(existsSync(join(WEB, 'public', src)), `${key} points at ${src}, which is not in public/`);
  }
  for (const k of ['site-free', 'site-verified', 'site-solo', 'site-pro', 'site-ultra']) assert.ok(k in TRADE_PHOTOS, `${k} slot missing`);
});

test('(2) every limit on a plan card is read from TIER_CAPS', () => {
  assert.equal(LIMIT_LABELS.length, 7);
  for (const k of PLAN_KEYS) {
    const c = TIER_CAPS[k];
    const [reach, cats, cards, seats, branches, waitlist, address] = planLimits(k);
    if (k === 'free') assert.equal(reach, 'Not in search');
    else assert.equal(reach, Number.isFinite(c.serviceRadiusKm) ? `${c.serviceRadiusKm.toLocaleString('en-US')} km` : 'Nationwide');
    if (Number.isFinite(c.parentCategories)) assert.equal(cats, c.parentCategories.toLocaleString('en-US'));
    if (Number.isFinite(c.servicesPerLeaf)) assert.equal(cards, c.servicesPerLeaf.toLocaleString('en-US'));
    assert.ok(seats!.includes(`${FREE_HELPER_SEATS} free Helper`), `${k}: the free Helper is not said`);
    if (c.agentAccounts > 0 && Number.isFinite(c.agentAccounts)) assert.ok(seats!.startsWith(`${c.agentAccounts} + `), `${k}: seats`);
    assert.equal(branches === null, c.branchesIncluded === 0, `${k}: branches`);
    assert.equal(waitlist === null, c.waitlistAcceptances === 0, `${k}: waitlist`);
    assert.equal(address === 'Yes', c.customWebsiteName, `${k}: own web address`);
  }
  // A typed number that happens to equal today's cap still rots: no reach, seat or branch count in the source.
  const src = stripComments(readFileSync(join(HERE, 'trade-data.ts'), 'utf8'));
  assert.doesNotMatch(src, /['"`]\d+\s*km|\d+ team seats?['"`]|\d+ branch(es)?['"`]/, 'an allowance is typed into trade-data.ts');
  const cards = planCards({ soloMonthly: 'S', proMonthly: 'P', enterpriseMonthly: null });
  assert.deepEqual(cards.map((c) => c.price), ['₱0', '₱0', 'S', 'P', null], 'paid prices are passed in, never typed');
  for (const c of cards) {
    for (const s of [c.rest, ...c.facts, ...c.limits.filter(Boolean)]) assert.doesNotMatch(String(s), /Infinity|NaN|undefined/, `${c.key}: "${s}"`);
    assert.ok(c.groups.length > 0, `${c.key} lists no tools`);
  }
});

test('(3) QR jobs are the shipped QR modes (+ review); the medals are badge-tiers', () => {
  const jobs = qrJobs();
  assert.equal(jobs.length, SUPPLIER_QR_MODES.length + 1, 'a QR mode was added or removed — say it on the page');
  assert.equal(jobs.at(-1)!.tile, 'Review');
  const ladder = rewardLadder();
  for (const r of ladder) {
    const t = TIERS.find((x) => x.name === r.medal);
    assert.ok(t, `${r.medal} is not a medal in lib/badge-tiers.ts`);
    assert.equal(r.step, t!.step.toLocaleString('en-US'));
  }
  assert.ok(ladder.length >= 5, `only ${ladder.length} ladder steps`);
});

test('(4) the widgets type no price, say no "Event Hub", link no demo, and claim nothing unmerged', () => {
  for (const f of ['trade-widgets.tsx', 'trade-data.ts', 'trade-client.tsx']) {
    const src = stripComments(readFileSync(join(HERE, f), 'utf8'));
    assert.doesNotMatch(src, /₱\s*[1-9]/, `${f}: a peso figure is typed`);
    assert.doesNotMatch(src, /Event Hub/, `${f}: "Event Hub" is a couple-side word (owner, 5 Nov)`);
    assert.doesNotMatch(src, /['"`]\/sample\b|demo shop/i, `${f}: a demo / sample link (owner: "just do not add buttons")`);
    assert.doesNotMatch(src, /Send your own forms/, `${f}: "Send your own forms" for every supplier is PR #7248, not merged`);
    assert.doesNotMatch(src, /no signal|offline/i, `${f}: the supplier's offline schedule is PR #7270, not merged`);
    assert.doesNotMatch(src, /12-doc|in-app (video|audio)|e-sign/i, `${f}: a claim the true-claims check removed`);
  }
});
