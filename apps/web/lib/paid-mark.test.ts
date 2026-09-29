/**
 * paid-mark.test.ts — the mark FOLLOWS THE ENTITLEMENT, and the store shell
 * rule holds.
 *
 * Owner (2026-09-25): padlock while a paid part is locked, diamond once it is
 * unlocked. The failure this guards is the one `lib/event-hub-pro.ts` warns
 * about: a mark that can only ever answer one way renders exactly like a mark
 * that works. So every case below is asserted in BOTH directions — an owning
 * couple must get the diamond, not merely a non-owning couple the padlock —
 * and the real Maker surfaces are PAINTED, not grepped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import path from 'node:path';
import { makerProMark, makerProUsable, paidMarkLabel, paidMarkState } from './paid-mark';

(globalThis as unknown as { React: unknown }).React = React;

/* ── `server-only` shim (same as money-reads-are-honest.test.ts) — the editor's
   panels import a server action whose store is `server-only`, which this
   runner cannot resolve. Rendering them needs the import to succeed, nothing
   more. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
{
  const nodeRequire = createRequire(import.meta.url);
  const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
  const STUB = path.join(process.cwd(), '__server_only_stub_paid_mark__.js');
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

test('paidMarkState: owned is a diamond everywhere; not-owned is a padlock, absent in the store shell', () => {
  assert.equal(paidMarkState({ owns: true }), 'unlocked');
  assert.equal(paidMarkState({ owns: true, storeShell: true }), 'unlocked', 'an owned mark is not a purchase hint');
  assert.equal(paidMarkState({ owns: false }), 'locked');
  assert.equal(paidMarkState({ owns: false, storeShell: true }), null, 'no padlock in the app-store shell');
});

test('💎 ◆ PRO: a Maker control a couple may TRY — owned is still the diamond, the shell still shows nothing', () => {
  // Owner 2026-09-28: *"they can edit it with pro features. but need to upgrade
  // to pro when clicked on apply"* — the Maker's Pro controls work before
  // paying, so they wear information (◆ PRO), never a padlock.
  assert.equal(makerProMark({ owns: false, storeShell: false }), 'try');
  assert.equal(makerProMark({ owns: true, storeShell: false }), 'unlocked');
  assert.equal(makerProMark({ owns: true, storeShell: true }), 'unlocked');
  assert.equal(makerProMark({ owns: false, storeShell: true }), null, 'a Pro hint in the app-store shell');
  assert.equal(makerProUsable({ owns: false, storeShell: false }), true, 'a free couple cannot try Pro on the web');
  assert.equal(makerProUsable({ owns: false, storeShell: true }), false, 'the shell shows a free couple a Pro control');
  assert.equal(makerProUsable({ owns: true, storeShell: true }), true);
  // The padlock rule everywhere else is untouched.
  assert.equal(paidMarkState({ owns: false }), 'locked');
  assert.match(paidMarkLabel('try', 'Event Hub Pro'), /Event Hub Pro — try it here; Apply asks for it/);
});

test('paidMarkLabel names the state for a screen reader', () => {
  assert.match(paidMarkLabel('locked', 'Event Hub Pro'), /^Locked .*Event Hub Pro/);
  assert.match(paidMarkLabel('unlocked', 'Event Hub Pro'), /^Unlocked .*Event Hub Pro/);
});

test('PaidMark draws a padlock when locked and a diamond when unlocked', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaidMark } = await import('../app/_components/paid-mark');
  const locked = renderToStaticMarkup(React.createElement(PaidMark, { state: 'locked', label: 'L' }));
  const unlocked = renderToStaticMarkup(React.createElement(PaidMark, { state: 'unlocked', label: 'U', text: 'Pro' }));
  console.log(`[paid-mark] locked=${locked.length}b unlocked=${unlocked.length}b`);
  assert.match(locked, /data-paid-mark="locked"/);
  assert.match(locked, /lucide-lock/);
  assert.doesNotMatch(locked, /lucide-gem/);
  assert.match(locked, /aria-label="L"/);
  assert.match(unlocked, /data-paid-mark="unlocked"/);
  assert.match(unlocked, /lucide-gem/);
  assert.doesNotMatch(unlocked, /lucide-lock/);
  assert.match(unlocked, />Pro</, 'the optional word sits beside the mark');
});

async function paintPrints(ownsPro: boolean, storeShell: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerPrints } = await import('../app/dashboard/[eventId]/launch/_components/maker-prints');
  const { PRINT_FORMATS } = await import('./print-pieces');
  const { INVITE_THEME_IDS } = await import('./invite-themes');
  const first = (f: string) => Object.values(PRINT_FORMATS).find((x) => x.for === f)!;
  // A THEMED set (not Classic): since the free-prints rework, Classic prints carry no Pro line at all.
  const theme = INVITE_THEME_IDS.find((id) => id !== 'house')!;
  return renderToStaticMarkup(
    React.createElement(MakerPrints, {
      eventId: 'E1',
      slug: 'ana-ben',
      theme,
      savedTheme: theme,
      ownsPro,
      storeShell,
      flash: null,
      formats: { pass: first('pass'), invitation: first('invitation'), card: first('card') } as never,
    }),
  );
}

test('the themed prints wear the mark their owner has earned — both directions', async () => {
  const owned = await paintPrints(true, false);
  const free = await paintPrints(false, false);
  const shellFree = await paintPrints(false, true);
  const marks = (h: string) =>
    `locked=${count(h, 'data-paid-mark="locked"')} try=${count(h, 'data-paid-mark="try"')} unlocked=${count(h, 'data-paid-mark="unlocked"')}`;
  console.log(`[paid-mark] prints owned{${marks(owned)}} free{${marks(free)}} shell-free{${marks(shellFree)}}`);
  // 💎 Owner 2026-09-28: "let us remove padlock and just show that these tools
  // are for pro with the diamond icon" — no padlock anywhere in the Maker.
  // The themed prints' mark + the pass cards' "Download all passes (.zip)"
  // (Event Hub Pro, 2026-09-29) — ◆ for both, never a padlock.
  assert.equal(count(owned, 'data-paid-mark="unlocked"'), 2);
  assert.equal(count(owned, 'data-paid-mark="locked"'), 0);
  assert.equal(count(free, 'data-paid-mark="try"'), 2, 'a free couple is not shown ◆ PRO on the themed prints and the zip');
  assert.match(free, /data-pass-cards-zip-pro=""/, 'a free couple’s zip is a door to the Pro unlock');
  assert.equal(count(free, 'data-paid-mark="locked"'), 0, 'a padlock in the Maker');
  assert.equal(count(free, 'data-paid-mark="unlocked"'), 0);
  assert.equal(count(shellFree, 'data-paid-mark='), 0, 'no padlock and no purchase hint in the store shell');
});

async function paintEditorial(ownsPro: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EditorialPanel } = await import('../app/dashboard/[eventId]/website/editor/_components/authoring-panels');
  return renderToStaticMarkup(
    React.createElement(EditorialPanel, { eventId: 'E1', ownsPro, unlockHref: '/buy', priceLabel: null }),
  );
}

test('the editor’s desk heading follows ownsPro — ◆ PRO free (never a padlock), diamond owned', async () => {
  const owned = await paintEditorial(true);
  const free = await paintEditorial(false);
  assert.match(owned, /data-paid-mark="unlocked"/);
  assert.doesNotMatch(owned, /data-paid-mark="locked"/);
  assert.match(free, /data-paid-mark="try"/);
  assert.doesNotMatch(free, /data-paid-mark="locked"/, 'a padlock in the Maker');
  assert.doesNotMatch(free, /data-paid-mark="unlocked"/);
});

test('💎 no padlock on any Maker Pro control — the diamond is the only Pro sign (owner 2026-09-28)', async () => {
  // Owner: "let us remove padlock and just show that these tools are for pro
  // with the diamond icon". Every Maker file that draws a Pro mark is read
  // whole; a literal padlock state, or the padlock-by-default reader, is a fail.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { stripComments } = await import('./strip-comments');
  const WEB = join(__dirname, '..');
  const MAKER = [
    'app/dashboard/[eventId]/launch/_components/maker-details.tsx',
    'app/dashboard/[eventId]/launch/_components/qr-look-controls.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-prints.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-shell.tsx',
    'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx',
    'app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx',
    'app/dashboard/[eventId]/website/editor/_components/authoring-panels.tsx',
    'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx',
    'app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx',
    'app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx',
    'app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-inspector.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-slots-panel.tsx',
    'app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx',
  ];
  const offenders: string[] = [];
  for (const rel of MAKER) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    if (/state="locked"|state=\{'locked'\}|\?\s*'unlocked'\s*:\s*'locked'|paidMarkState\(/.test(src)) offenders.push(rel);
  }
  console.log(`[paid-mark] Maker files checked for a padlock: ${MAKER.length} · offenders ${offenders.length}`);
  assert.deepEqual(offenders, [], 'a Maker Pro control still wears a padlock');
});
