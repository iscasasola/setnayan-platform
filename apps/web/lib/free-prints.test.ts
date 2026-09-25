/**
 * GUARD — PRINTS & TICKETS HOLDS EVERY FREE PRINT, AND NONE OF THEM IS PRO.
 *
 * Owner 2026-09-25 (DECISION_LOG "PRINTS & TICKETS HOLDS EVERY PRINT"): the
 * Maker's Prints & Tickets lists every free print, open to every event and
 * visible in the app-store shell. What goes red here:
 *   · a free print that stops being reachable from Prints & Tickets;
 *   · a free print whose button or thumbnail sits behind a Pro / store-shell
 *     condition on the page, or whose route asks the Pro question;
 *   · a free print whose URL the store shell's link guard would hide;
 *   · a button that opens a page instead of saving a file;
 *   · a file name that breaks the owner's `<event slug>-<print>` rule;
 *   · the crew-pairing QR (the event's master token) printed as the guest QR.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { freePrints } from './free-prints';
import { storeShellHidesHref } from './store-shell';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EVENT = '11111111-2222-4333-8444-555555555555';
const WORKSPACE = 'app/dashboard/[eventId]/launch/_components/maker-prints.tsx';

/** The route file that answers a same-origin href. */
function routeFileFor(href: string): string {
  const path = href.split('?')[0]!;
  if (path.startsWith('/api/hub-print/')) return 'app/api/hub-print/[piece]/route.ts';
  if (path.startsWith('/api/website/qr/')) return 'app/api/website/qr/[slug]/route.ts';
  const m = path.match(/^\/dashboard\/[^/]+\/(.+)$/);
  assert.ok(m, `unexpected href ${href}`);
  return `app/dashboard/[eventId]/${m![1]}/route.ts`;
}

test('the free group names every print the owner and the controller listed', () => {
  const keys = freePrints(EVENT, 'cale-ice').map((p) => p.key);
  assert.deepEqual(keys, ['guest-registry', 'qr-codes', 'seat-plan', 'seating-pack', 'caterer', 'event-qr']);
  // The event QR needs an address; without one it is left out rather than broken.
  assert.ok(!freePrints(EVENT, null).some((p) => p.key === 'event-qr'));
});

test('every free print is REACHABLE from Prints & Tickets, outside any Pro or store-shell condition', () => {
  const ws = read(WORKSPACE);
  const start = ws.indexOf('data-prints-free-group');
  const end = ws.indexOf('data-prints-set', start);
  assert.ok(start > 0 && end > start, 'the free group is its own section, before the invitation set');
  const group = ws.slice(start, end);
  assert.match(group, /freePrints\(eventId, slug\)\.map\(/, 'the section renders the whole list — no entry is picked out');
  assert.match(group, /fp\.saves\.map\(/, 'every save of every entry gets a button');
  assert.match(group, /src=\{fp\.preview\}/, 'every entry shows its real preview');
  assert.doesNotMatch(group, /access\.|ownsPro|storeShell|offerPro|printReady/, 'nothing in the free group asks about Pro or the store shell');
  // …and the section itself is not wrapped in one: nothing between the return and the section tests access.
  const before = ws.slice(ws.indexOf('return ('), start);
  assert.doesNotMatch(before, /\{\s*(access\.|ownsPro|storeShell|!storeShell)[^}]*&&\s*\(/, 'the free group is not rendered conditionally');
});

test('no free print’s route asks the Pro question', () => {
  for (const fp of freePrints(EVENT, 'cale-ice')) {
    for (const href of [fp.preview, ...fp.saves.map((s) => s.href)]) {
      const file = routeFileFor(href);
      assert.ok(existsSync(join(WEB, file)), `${fp.key}: ${href} → ${file} does not exist`);
      const src = read(file);
      if (file.includes('hub-print')) {
        // The shared route: the free branch returns BEFORE the Pro read.
        const piece = href.split('/api/hub-print/')[1]!.split('?')[0]!;
        assert.ok(src.indexOf(`piece === '${piece}'`) > 0, `hub-print has no free branch for ${piece}`);
        assert.ok(src.indexOf(`piece === '${piece}'`) < src.indexOf('printOwnsPro('), `${piece} is answered before the Pro question`);
      } else {
        assert.doesNotMatch(src, /printOwnsPro|eventCoupleWebsiteProActive|isStoreShellRequest|printAccess/, `${file} must not gate a free print`);
      }
    }
  }
});

test('the store shell shows every free print — its link guard hides none of them', () => {
  const here = 'https://setnayan.com/dashboard/x/launch?tool=prints';
  for (const fp of freePrints(EVENT, 'cale-ice')) {
    for (const href of [fp.preview, ...fp.saves.map((s) => s.href)]) {
      assert.equal(storeShellHidesHref(href, here), false, `${fp.key}: the store shell would hide ${href}`);
    }
  }
});

test('file names follow the owner’s rule: <event slug>-<print>', () => {
  const byKey = Object.fromEntries(freePrints(EVENT, 'cale-ice').map((p) => [p.key, p.saves.map((s) => s.file)]));
  assert.deepEqual(byKey['guest-registry'], ['cale-ice-guest-registry.pdf']);
  assert.deepEqual(byKey['seat-plan'], ['cale-ice-seat-plan.pdf', 'cale-ice-seat-plan-blueprint.pdf']);
  assert.deepEqual(byKey['qr-codes'], ['cale-ice-qr-codes.pdf']);
  assert.deepEqual(byKey['event-qr'], ['cale-ice-event-qr.png']);
  // …and the routes name the file the same way when saved without the button.
  assert.match(read('app/dashboard/[eventId]/seating/export/route.ts'), /printFileName\(event\.slug, mode === 'blueprint' \? 'seat-plan-blueprint' : 'seat-plan'\)/);
  assert.match(read('app/dashboard/[eventId]/seating/print/route.ts'), /printFileName\(event\.slug, 'seating-pack'\)/);
  assert.match(read('app/dashboard/[eventId]/seating/caterer/route.ts'), /printFileName\(event\.slug, 'caterer-meal-counts'\)/);
});

test('every print button SAVES — it never opens a page or a tab', () => {
  const ws = read(WORKSPACE);
  assert.doesNotMatch(ws, /target=["{]_blank|window\.open|<a\s[^>]*download/, 'no raw links to files — every file goes through PrintSaveButton');
  assert.ok((ws.match(/<PrintSaveButton\b/g) ?? []).length >= 6);
  const btn = read('app/dashboard/[eventId]/launch/_components/print-save-button.tsx');
  assert.match(btn, /ev\.preventDefault\(\)/, 'the click never navigates');
  assert.match(btn, /navigator\.share\(\{ files: \[file\] \}\)/, 'the phone path is the share sheet (Save to Files / the App Store app)');
  assert.match(btn, /a\.download = file\.name/, 'the desktop path is a real download');
  assert.match(btn, /NotAllowedError/, 'an expired tap keeps the file and asks for one more tap');
  assert.match(btn, /role="alert"/, 'a failure says so');
  // Every file-producing free route answers with an attachment, so even a click before hydration saves.
  for (const f of ['app/dashboard/[eventId]/seating/print/route.ts', 'app/dashboard/[eventId]/seating/caterer/route.ts', 'app/dashboard/[eventId]/seating/export/route.ts']) {
    assert.match(read(f), /attachment; filename=/, `${f} must send the PDF as an attachment`);
  }
});

test('the event QR is the GUEST code, never the crew-pairing code', () => {
  const qr = freePrints(EVENT, 'cale-ice').find((p) => p.key === 'event-qr')!;
  for (const href of [qr.preview, ...qr.saves.map((s) => s.href)]) {
    assert.doesNotMatch(href, /event-qr/, 'the /event-qr page carries the master pairing token — not for guests');
    assert.match(href, /^\/api\/website\/qr\//);
  }
});
