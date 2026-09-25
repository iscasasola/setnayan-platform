/**
 * the-maker-canvas-is-only-the-page.test.ts — "editing should only be the page"
 * (owner 2026-09-25), and "you embeded the editor inside the editor".
 *
 * The Maker's canvas is an iframe of `/<slug>?editor=1`. It drew the host's
 * chrome — the Host controls bar with "Edit this site", the bottom tab bar with
 * "Manage", the Live hub pill — and each is a link into the dashboard. A tap in
 * the canvas navigated the frame into the Maker, and the owner saw his editor
 * inside his editor.
 *
 * What this holds, and how:
 *   1. RENDERED — the page shell drops its site header when it is the canvas,
 *      and the Host controls bar renders nothing when it is handed no model.
 *   2. SOURCE, per component — every chrome mount in `site-body.tsx` and
 *      `page.tsx` is gated on `isEditorCanvas`. One anchor per component, and
 *      each count is printed, so a sabotage that ungates ONE of two mounts goes
 *      red instead of hiding behind a file-level match.
 *   3. The flag is a VERIFIED host, never the param alone.
 *   4. The Maker's own guards: a frame path off the couple's page is an escape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { asksForHostCanvas, asksForEditorBridge, EDITOR_CANVAS_HIDES_APP_CHROME } from './editor-canvas';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const BODY = read('../_components/site-body.tsx');
const PAGE = read('../page.tsx');

test('RENDERED: the page shell draws no site header in the canvas, and does everywhere else', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const mod = await import('../_components/invitation-shell');
  const InvitationShell = (mod as { InvitationShell?: typeof mod.InvitationShell; default?: { InvitationShell: typeof mod.InvitationShell } }).InvitationShell
    ?? (mod as unknown as { default: { InvitationShell: typeof mod.InvitationShell } }).default.InvitationShell;
  const page = React.createElement('p', null, 'THE-SECTIONS');
  const guest = renderToStaticMarkup(React.createElement(InvitationShell, null, page));
  // `children` travels as the third argument (react/no-children-prop); the cast
  // only tells the type that it is there.
  const canvasProps = { editorCanvas: true } as React.ComponentProps<typeof InvitationShell>;
  const canvas = renderToStaticMarkup(React.createElement(InvitationShell, canvasProps, page));
  assert.match(guest, /data-sticky-top/, 'a guest still gets the site header');
  assert.doesNotMatch(canvas, /data-sticky-top/, 'the canvas must not draw the site header');
  assert.match(canvas, /THE-SECTIONS/, 'the canvas still draws the page itself');
});

test('RENDERED: the Host controls bar renders nothing without a model', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { OwnerRibbon } = await import('../_components/owner-ribbon');
  assert.equal(renderToStaticMarkup(React.createElement(OwnerRibbon, { model: null })), '');
});

/* One row per piece of chrome: the anchor that finds its mount, and the gate
   that must sit in front of it. `count` is how many mounts exist — every one
   must be gated. */
const CHROME: Array<{ name: string; file: 'body' | 'page'; mount: RegExp; gated: RegExp; count: number }> = [
  { name: 'Host controls bar', file: 'body', mount: /<OwnerRibbon\b/g, gated: /<OwnerRibbon model=\{isEditorCanvas \? null : ownerRibbon\}/g, count: 1 },
  { name: 'bottom tab bar (Home · Details · … · Manage)', file: 'body', mount: /<SiteMenuBar\b/g, gated: /\{menuOn && showGuestBars \? \(\s*<SiteMenuBar\b/g, count: 2 },
  { name: 'Live hub pill / event-day bar', file: 'body', mount: /<PublicEventDayBar\b/g, gated: /\{isEditorCanvas \? null : \(\s*<PublicEventDayBar\b/g, count: 1 },
  { name: 'floating music button', file: 'body', mount: /<BackgroundMusic\b/g, gated: /&& !isEditorCanvas \? <BackgroundMusic\b/g, count: 1 },
  { name: 'guest doorway strip', file: 'body', mount: /<GuestDoorwayStrip\b/g, gated: /\{plan\.fullBleed \|\| isEditorCanvas \? null : \(\s*<GuestDoorwayStrip\b/g, count: 1 },
  { name: 'everything-else sheet', file: 'body', mount: /<EverythingElseSheet\b/g, gated: /\{plan\.fullBleed \|\| isEditorCanvas \? null : \(\s*<EverythingElseSheet\b/g, count: 1 },
  { name: 'supplier doorway', file: 'body', mount: /<VendorDoorway\b/g, gated: /\{vendorCapability && !isEditorCanvas \? \(\s*<VendorDoorway\b/g, count: 1 },
  { name: 'site header', file: 'body', mount: /<InvitationShell\b/g, gated: /editorCanvas=\{!showGuestBars\}/g, count: 1 },
  { name: 'guest hub bar', file: 'page', mount: /<GuestHubBar\b/g, gated: /\{isEditorCanvas \? null : \(\s*<GuestHubBar\b/g, count: 1 },
  { name: 'Share / Report footer', file: 'page', mount: /<PublicPageActions\b/g, gated: /visibility !== 'private' && !isEditorCanvas \? \(\s*<PublicPageActions\b/g, count: 1 },
];

for (const c of CHROME) {
  test(`SOURCE: ${c.name} — every mount is gated on isEditorCanvas`, () => {
    const src = c.file === 'body' ? BODY : PAGE;
    const mounts = src.match(c.mount)?.length ?? 0;
    const gated = src.match(c.gated)?.length ?? 0;
    console.log(`  ${c.name}: ${gated}/${mounts} gated`);
    assert.equal(mounts, c.count, `expected ${c.count} mount(s) of the ${c.name}, found ${mounts} — a new mount needs a gate too`);
    assert.equal(gated, mounts, `${gated} of ${mounts} ${c.name} mount(s) are gated on isEditorCanvas`);
  });
}

test('the "Guest bars" switch brings back only the GUEST bars, never the host\'s', () => {
  // The one switch: guest bars everywhere but the canvas, and in the canvas only on request.
  assert.match(BODY, /const showGuestBars = !isEditorCanvas \|\| canvasGuestBars;/);
  // In the canvas the tab bar is drawn for a guest — no host "Manage" slot.
  assert.match(BODY, /viewer: ownerCapability && !isEditorCanvas \? \{ kind: 'couple' \} : \{ kind: 'public' \}/);
  // The request is canvas-only.
  assert.match(PAGE, /canvasGuestBars: isEditorCanvas && search\.bars === '1'/);
  // Host chrome ignores the switch entirely.
  const hostChrome = BODY.match(/<OwnerRibbon model=\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(hostChrome, /showGuestBars|canvasGuestBars/, 'the Host controls bar must never follow the Guest bars switch');
});

test('SOURCE: the root layout notices are hidden in the canvas by their one attribute', () => {
  assert.match(BODY, /isEditorCanvas \? <style>\{EDITOR_CANVAS_HIDES_APP_CHROME\}<\/style> : null/);
  assert.match(EDITOR_CANVAS_HIDES_APP_CHROME, /\[data-app-chrome\]\{display:none!important\}/);
  for (const rel of ['../../_components/cookie-consent-banner.tsx', '../../_components/stale-tab-notice.tsx']) {
    assert.match(read(rel), /data-app-chrome=""/, `${rel} must carry data-app-chrome`);
  }
});

test('the flag is a VERIFIED host — the param only asks', () => {
  assert.match(PAGE, /let isEditorCanvas = false;\s*if \(asksForHostCanvas\(search\)\) \{/);
  assert.match(PAGE, /isEditorCanvas = await loadHostMembership\(admin, event\.event_id, user\.id\);/);
  assert.equal(asksForHostCanvas({ editor: '1' }), true);
  assert.equal(asksForHostCanvas({ preview: 'draft' }), true);
  assert.equal(asksForHostCanvas({ editor: 'yes', preview: 'live' }), false);
  assert.equal(asksForHostCanvas(undefined), false);
  // The click-to-edit bridge is the Maker's iframe only, never the preview tab.
  assert.equal(asksForEditorBridge({ preview: 'draft' }), false);
  assert.equal(asksForEditorBridge({ editor: '1' }), true);
  assert.match(BODY, /\{isEditorCanvas && editorBridge \? <EditorBridge \/> : null\}/);
});

test('the guest page never redirects a host into the dashboard', () => {
  const targets = [...PAGE.matchAll(/redirect\(\s*([^)]*)\)/g)].map((m) => m[1] ?? '');
  console.log(`  page.tsx redirect targets: ${targets.length}`);
  assert.ok(targets.length > 0, 'the scan found no redirect() calls — it is blind, not clean');
  for (const t of targets) {
    assert.doesNotMatch(t, /dashboard|launch|\/login/, `page.tsx redirects to ${t} — the Maker's canvas would follow it`);
  }
});

test("the Maker's canvas treats any path off the couple's page as an escape", async () => {
  const { framePathIsThePage } = await import(
    '../../dashboard/[eventId]/website/editor/_components/maker-canvas-guard'
  ).then((m) => (m as { framePathIsThePage?: unknown }).framePathIsThePage ? m : (m as unknown as { default: typeof m }).default);
  assert.equal(framePathIsThePage('/cale-ice', '/cale-ice'), true);
  assert.equal(framePathIsThePage('/cale-ice/everyone', '/cale-ice'), true);
  assert.equal(framePathIsThePage('/dashboard/044f/launch', '/cale-ice'), false);
  assert.equal(framePathIsThePage('/cale-ice-2', '/cale-ice'), false);
  assert.equal(framePathIsThePage('/login', '/cale-ice'), false);
  const SHELL = read('../../dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(SHELL, /<MakerRefusesToBeFramed \/>/, 'the Maker must refuse to draw inside a frame of itself');
  assert.match(SHELL, /<CanvasStaysOnThePage\b/, 'the canvas must cover any escape from the page');
});
