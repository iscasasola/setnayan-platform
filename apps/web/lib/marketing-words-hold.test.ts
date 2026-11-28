/**
 * Final check, area 1, batch a1-a8-words: marketing copy that claimed rank, speed, a forever promise, a retired product
 * or a stale fact. Every source check strips comments first, so a docblock that names the old words cannot satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { SUPPLIER_PLANS, FEATURE_ROWS } from './features-page';
import { TIER_CAPS } from './vendor-tier-caps';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ABOUT = ['app/(shell)/about/_about-motion.tsx', 'app/(shell)/about/page.tsx', 'app/(shell)/tl/about/page.tsx'];

test('A1-159 · A1-105 · /about and /features make no rank claim and no comparison', () => {
  for (const f of [...ABOUT, 'app/features/_sections/_WhySetnayan.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /Philippines-first|the first built here|ang una ditong gawa|foreign directory/i, `${f}: a rank claim`);
    assert.doesNotMatch(s, /other wedding apps|ibang wedding apps|elsewhere|wala sa iba|what the others|otherwise juggle|rarely 0%|bihirang 0%/i, `${f}: a comparison`);
    // Owner 28 Nov 2026: hosts own the event, so these host pages say no "0% commission" at all.
    assert.doesNotMatch(s, /0% commission|zero commission/i, `${f}: a host is told "0% commission"`);
  }
});

test('A1-111 · /about states current facts', () => {
  const motion = src('app/(shell)/about/_about-motion.tsx');
  assert.doesNotMatch(motion, /that&rsquo;s\s+all set/);
  assert.match(motion, /let&rsquo;s\s+get that set/);
  for (const f of ABOUT) assert.doesNotMatch(src(f), /\(Live Watch\)/, `${f}: the free one-camera stream is not Live Watch`);
  const tl = src('app/(shell)/tl/about/page.tsx');
  assert.doesNotMatch(tl, /Bayad ang premium tools tulad ng Setnayan AI, Event Hub, at premium RSVP/);
  assert.doesNotMatch(tl, /isang Papic camera sa bawat event/);
  assert.doesNotMatch(src('lib/help/topics-existing.ts'), /RA 10173 \(Data Privacy Act of the Philippines\) compliant\./);
});

test('A1-110 · /features supplier plans say what TIER_CAPS says', () => {
  const lines = Object.fromEntries(SUPPLIER_PLANS.map((p) => [p.name, p.lines.join(' | ')]));
  assert.match(lines.Verified!, new RegExp(`\\b${TIER_CAPS.verified.serviceCardsTotal} live cards`));
  assert.doesNotMatch(lines.Verified!, /Unlimited live cards/);
  assert.match(lines.Plus!, new RegExp(`You plus ${TIER_CAPS.solo.agentAccounts} people`));
  assert.match(lines.Pro!, /No limit on people/);
  assert.match(lines.Pro!, /Branches, no limit/);
  assert.doesNotMatch(lines.Ultra!, /bigger team/);
  assert.doesNotMatch(src('lib/feature-pages/suppliers-b.ts'), /bawat apat na linggo/);
});

test('A1-109 (part) · no row on /features is named after an internal shop', () => {
  // The Coming chips and the ⓘ plan line are the owner-approved v3 design (lib/features-page-rows-keep-their-status
  // test 4); whether they stay is the owner's call (brand.md #9). Only the internal shop name is fixed here.
  for (const [id, f] of Object.entries(FEATURE_ROWS)) assert.doesNotMatch(f.name, /SetnaProd|Build \d|Lane [A-Z]/, `${id}: ${f.name}`);
});

test('A1-106 · A1-025 · A1-049 · no retired product is sold', () => {
  for (const f of [
    'app/features/_sections/_WhySetnayan.tsx',
    'app/(shell)/our-story/page.tsx',
    'app/_components/marketing/OurStory.tsx',
    'lib/studio-apps.ts',
  ]) {
    assert.doesNotMatch(src(f), /personal (video |highlight )?reel|souvenir reel|personal na video reels/i, `${f}: reels are retired`);
  }
  const palogo = src('app/(shell)/palogo/page.tsx');
  assert.doesNotMatch(palogo, /Logo & QR/, 'the Logo & QR part is off sale');
  assert.doesNotMatch(palogo, /Animated Wedding Monogram/i);
  const creators = src('app/creators/_components/creator-story-sections.tsx');
  assert.doesNotMatch(creators, /Stories page|Featured on Stories|Stories showcase|nothing else on the internet/);
});

test('A1-024 · A1-030 · A1-029 · no forever promise and no speed claim', () => {
  for (const f of [
    'app/(shell)/papic/_papic-sections.tsx',
    'app/(shell)/papic/page.tsx',
    'app/(shell)/papic/try/page.tsx',
    'app/(shell)/mood-board/page.tsx',
  ]) {
    assert.doesNotMatch(src(f), /nothing (here |that )?expires|never expires/i, `${f}: a forever promise`);
  }
  assert.doesNotMatch(src('app/(shell)/papic/page.tsx'), /original file is replaced/, 'no typed keep time for the originals');
  for (const f of ['app/(shell)/pawebsite/page.tsx', 'app/(shell)/papic/_papic-dial.tsx', 'app/(shell)/papic/try/page.tsx']) {
    assert.doesNotMatch(src(f), /in seconds|one minute|about a minute/i, `${f}: a speed claim`);
  }
});

test('A1-026 · A1-055 · the Budget and Marketplace descriptions say what ships, for every event', () => {
  const apps = src('lib/studio-apps.ts');
  assert.doesNotMatch(apps, /suggested split/);
  assert.doesNotMatch(apps, /Browse verified Filipino wedding suppliers/);
  const market = src('app/(shell)/marketplace/page.tsx');
  assert.doesNotMatch(market, /tied to your wedding|added your wedding|start your wedding on Setnayan|fits your wedding/);
  const compare = src('app/(shell)/explore/compare/page.tsx');
  assert.doesNotMatch(compare, /wedding suppliers|wedding shortlist/);
});

test('A1-067 · A1-068 · /download says no "Trusted" and tells one story: it is the Live Watch app', () => {
  const s = src('app/(shell)/download/page.tsx');
  assert.doesNotMatch(s, /Trusted/);
  assert.doesNotMatch(s, /one launch away|in their own window/);
  assert.match(s, /streams your event with Live Watch/);
  assert.match(s, /Only for streaming with Live Watch\. Planning needs no install\./);
});
