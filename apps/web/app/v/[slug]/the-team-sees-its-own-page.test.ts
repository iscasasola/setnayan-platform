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
import {
  TEAM_PREVIEW_COPY,
  TEAM_PREVIEW_HEAD,
  TODAY_DOCUMENTS_STEP_HREF,
  type ShopPreviewReason,
} from '@/lib/own-shop-preview';
import { TeamPreviewBanner } from './_components/team-preview-banner';

// tsx compiles the component's JSX to `React.createElement` (classic runtime) — give it the global it expects.
(globalThis as unknown as { React: unknown }).React = React;

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
  assert.match(RENDER, /shopPageGate\(vendor, \{ isTeam: false, adminDemoMode: inDemoMode(, bookingsOpen: gateBookingsOpen)? \}\)/);
  assert.match(RENDER, /shopPageGate\(vendor, \{ isTeam: await viewerIsShopTeam\(vendor\), adminDemoMode: inDemoMode(, bookingsOpen: gateBookingsOpen)? \}\)/);
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
    /if \(!vendor \|\| shopPageGate\(vendor, \{ isTeam: false, adminDemoMode: false(, bookingsOpen: await areBookingsOpen\(\))? \}\)\.open !== 'public'\) \{\s*return \{ title: 'Setnayan supplier', robots: \{ index: false, follow: false \} \};/,
  );
});

test('the banner, rendered: the owner\'s line, what couples wait on, and one 44 px button to the next step', () => {
  for (const reason of Object.keys(TEAM_PREVIEW_COPY) as ShopPreviewReason[]) {
    const html = renderToStaticMarkup(React.createElement(TeamPreviewBanner, { reason }));
    const copy = TEAM_PREVIEW_COPY[reason];
    assert.ok(html.includes(TEAM_PREVIEW_HEAD), reason);
    assert.ok(html.includes(copy.line.replace(/'/g, '&#x27;')), `${reason}: ${html}`);
    const anchor = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/);
    assert.ok(anchor, `${reason}: the button`);
    const open = anchor[0].match(/^<a\b[^>]*>/)![0];
    assert.ok(open.includes(`href="${copy.action.href.replace(/&/g, '&amp;')}"`), `${reason}: the next step's address`);
    assert.match(open, /class="[^"]*\bmin-h-11\b/, `${reason}: 44 px`);
    // 🧡 The house forward step — BUTTON_RULE's terracotta main pill, never the old black ink block (owner 2026-11-07).
    assert.match(open, /class="[^"]*\bab ab-brand ab-main\b/, `${reason}: ActionButton tone="brand" main`);
    assert.doesNotMatch(open, /\bbg-ink\b/, `${reason}: not the black button`);
    assert.match(anchor[0], new RegExp(`<span class="lbl">${copy.action.label}</span>`), `${reason}: the button's words`);
    assert.ok(html.includes(`data-team-preview="${reason}"`), reason);
    assert.equal((html.match(/<a\b/g) ?? []).length, 1, 'one next step, not a menu');
  }
});

test('"Send your documents" opens Today\'s documents step — not Shop ⚙ › Verification (owner 2026-11-07)', () => {
  assert.equal(TEAM_PREVIEW_COPY.documents.action.label, 'Send your documents');
  assert.equal(TEAM_PREVIEW_COPY.documents.action.href, '/vendor-dashboard#setup-docs');
  assert.equal(TEAM_PREVIEW_COPY.documents.action.href, TODAY_DOCUMENTS_STEP_HREF);
  // The anchor is the fold Today actually draws: `anchor={`setup-${f.key}`}` over the step keyed 'docs'.
  const folds = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/supplier-setup-folds.tsx'), 'utf8'));
  assert.match(folds, /anchor=\{`setup-\$\{f\.key\}`\}/, 'Today\'s folds carry anchor setup-<key>');
  const setup = stripComments(readFileSync(join(process.cwd(), 'lib/supplier-setup.ts'), 'utf8'));
  assert.match(setup, /key: 'docs',\s*n: 5,\s*title: 'Send your documents'/, 'step 5 is keyed docs');
  // The banner is a server component and ActionButton a client one: its icon must cross as an element, never a
  // component (a function) — that 500'd the page in the lab before this line existed.
  const banner = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/_components/team-preview-banner.tsx'), 'utf8'));
  assert.doesNotMatch(banner, /^'use client'/m, 'still a server component');
  assert.doesNotMatch(banner, /icon=\{[A-Z]\w*\}/, 'icon passed as a component across the client boundary');
  // …and the rendered banner carries it.
  const html = renderToStaticMarkup(React.createElement(TeamPreviewBanner, { reason: 'documents' }));
  assert.match(html, /<a\b[^>]*href="\/vendor-dashboard#setup-docs"/);
});
