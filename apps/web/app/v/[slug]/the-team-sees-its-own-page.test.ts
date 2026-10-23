/**
 * A shop's OWNER and HELPERS see its page before couples can — with a banner — and a stranger still gets the
 * not-found page (owner, 23 Oct 2026: "why can't i see setnaprod's website?").
 *
 * The rule itself is proven corner by corner in `lib/own-shop-preview.test.ts`. This file proves the RENDERER asks
 * that rule and nothing else — the failure that shipped was not a wrong rule but a right carve-out sitting under two
 * earlier 404s that never reached it — and that what it draws for the team is the banner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { TEAM_PREVIEW_COPY, TEAM_PREVIEW_HEAD, type ShopPreviewReason } from '@/lib/own-shop-preview';
import { TeamPreviewBanner } from './_components/team-preview-banner';

const PAGE = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));

function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `anchor not found: ${start}`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b > a, `end anchor not found: ${end}`);
  return src.slice(a, b);
}

const RENDER = between(PAGE, 'export async function renderVendorBySlug(', 'export default async function PublicVendorPage');

test('the renderer\'s only refusals are "no such shop" and the one rule saying nobody', () => {
  const refusals = RENDER.match(/[^\n]*notFound\(\)[^\n]*/g) ?? [];
  assert.deepEqual(
    refusals.map((l) => l.trim()),
    ['if (!vendor) notFound();', "if (gate.open === 'nobody') notFound();"],
    'a second 404 placed ahead of the gate is exactly how the owner lost his own page',
  );
  assert.match(RENDER, /shopPageGate\(vendor, \{ isTeam: false, adminDemoMode: inDemoMode \}\)/);
  assert.match(RENDER, /shopPageGate\(vendor, \{ isTeam: await viewerIsShopTeam\(vendor\), adminDemoMode: inDemoMode \}\)/);
  // The visibility rule is asked, never re-typed here.
  assert.doesNotMatch(RENDER, /isPubliclyVisible\(/);
});

test('the gate runs before anything about the shop is read or drawn', () => {
  const gateAt = RENDER.indexOf("if (gate.open === 'nobody') notFound();");
  for (const read of ['resolveDisplayUrl(vendor.logo_url)', 'fetchVendorPackages', "from('vendor_service_offerings')"]) {
    const at = RENDER.indexOf(read);
    if (at >= 0) assert.ok(at > gateAt, `${read} runs after the gate`);
  }
});

test('membership is the owner OR a helper seat, read with the viewer\'s own session', () => {
  const fn = between(PAGE, 'async function viewerIsShopTeam(', '\n}\n');
  assert.match(fn, /vendor\.user_id === user\.id/, 'the owner');
  assert.match(fn, /from\('vendor_team_members'\)/, 'a helper');
  assert.match(fn, /\.eq\('vendor_profile_id', vendor\.vendor_profile_id\)/);
  assert.match(fn, /\.eq\('user_id', user\.id\)/);
  assert.match(fn, /if \(!user\) return false;/, 'signed out is a stranger');
  assert.match(fn, /if \(error\) \{[\s\S]*?return false;/, 'a refused read is a stranger — here an absence denies');
  assert.doesNotMatch(fn, /createAdminClient/, 'the seat read goes through RLS, never the service role');
});

test('the team sees the banner; a team look is not a couple\'s visit; the demo-admin banner stays the admin\'s', () => {
  assert.match(RENDER, /\{teamPreview \? <TeamPreviewBanner reason=\{teamPreview\} \/> : null\}/);
  assert.match(RENDER, /if \(!isDemoVendor && teamPreview === null\) \{[\s\S]{0,1200}recordVendorProfileView/);
  assert.match(RENDER, /\{isDemoVendor && teamPreview === null \? <DemoVendorBanner \/> : null\}/);
});

test('a page a stranger cannot open is never indexed and never names the shop in its metadata', () => {
  const meta = between(PAGE, 'export async function vendorMetadataBySlug(', 'const displayLabel');
  assert.match(
    meta,
    /if \(!vendor \|\| shopPageGate\(vendor, \{ isTeam: false, adminDemoMode: false \}\)\.open !== 'public'\) \{\s*return \{ title: 'Setnayan supplier', robots: \{ index: false, follow: false \} \};/,
  );
});

test('the banner, rendered: the owner\'s line, what couples wait on, and one 44 px button to the next step', () => {
  for (const reason of Object.keys(TEAM_PREVIEW_COPY) as ShopPreviewReason[]) {
    const html = renderToStaticMarkup(React.createElement(TeamPreviewBanner, { reason }));
    const copy = TEAM_PREVIEW_COPY[reason];
    assert.ok(html.includes(TEAM_PREVIEW_HEAD), reason);
    assert.ok(html.includes(copy.line.replace(/'/g, '&#x27;')), `${reason}: ${html}`);
    assert.match(html, new RegExp(`<a[^>]*href="${copy.action.href.replace(/[#/]/g, '\\$&')}"[^>]*class="[^"]*min-h-11`), reason);
    assert.ok(html.includes(`data-team-preview="${reason}"`), reason);
    assert.equal((html.match(/<a\b/g) ?? []).length, 1, 'one next step, not a menu');
  }
});
