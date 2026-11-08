/**
 * THE CLIENT'S QUOTATION · CHAT · HUB PAGES ARE THE SHIPPED BODIES (THE ONE BUILD, lane C2, 8 Nov 2026).
 *
 * "We do not want to make a second app. We just want to improve what we have now." (owner, spec header). Each of the
 * three picked-client pages renders the shipped page itself through its internal embed view — never a copy:
 *   · Quotation + Chat → `SupplierThreadBody` → the supplier thread page (`__embed` chat | quotation);
 *   · Hub → the on-the-day page (`__embed=hub`) for THIS event, its doors first.
 * And the embed views draw what the contract (v113) says and nothing invented: the Hub page leads with Open Hub +
 * Launch Hub, refuses to show another event's Hub, and carries no "Session" scan mode.
 * Sabotage (2026-11-08): drop the "not this event" check from the Hub embed → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGES = 'app/vendor-dashboard/clients/[eventId]/_pages';

test('Hub renders the on-the-day page for THIS event, embedded', () => {
  const hub = read(`${PAGES}/hub.tsx`);
  assert.match(hub, /import VendorOnTheDayPage from '@\/app\/vendor-dashboard\/on-the-day\/page';/);
  assert.match(hub, /<VendorOnTheDayPage searchParams=\{Promise\.resolve\(\{ event: eventId, __embed: 'hub' \}\)\} \/>/);
});

test('the Hub embed: one event only, the two doors first, Set up · Crew · pages, no Session mode', () => {
  const page = read('app/vendor-dashboard/on-the-day/page.tsx');
  assert.match(page, /const embedHub = sp\.__embed === 'hub' && configureId != null;/);
  assert.match(page, /if \(embedHub && \(!selected \|\| selected\.eventId !== configureId\)\) \{/, 'the client page could draw ANOTHER event’s Hub');
  const at = page.indexOf('if (embedHub && selected) {');
  assert.ok(at > 0);
  const body = page.slice(at, page.indexOf('let body: ReactNode;', at));
  const open = body.indexOf('label="Open Hub"');
  const launch = body.indexOf('label="Launch Hub"');
  const setup = body.indexOf('{setup}');
  assert.ok(open > 0 && launch > open && setup > launch, 'the doors do not lead');
  assert.match(body, /href=\{`\/vendor-dashboard\/on-the-day\?event=\$\{selected\.eventId\}`\}/);
  assert.match(body, /href=\{`\/vendor-dashboard\/on-the-day\/live\/\$\{selected\.eventId\}`\}/);
  assert.ok(body.indexOf('{crew}') > setup && body.indexOf('{pages}') > body.indexOf('{crew}'));
  assert.doesNotMatch(page, /['"]Session['"]/, 'an INVENTED "Session" scan mode appeared');
});

test('Quotation and Chat render the one thread body; a client with no thread is told so, never handed an empty box', () => {
  for (const [file, view] of [
    ['quotation.tsx', 'quotation'],
    ['chat.tsx', 'chat'],
  ] as const) {
    const src = read(`${PAGES}/${file}`);
    assert.match(src, new RegExp(`<SupplierThreadBody threadId=\\{threadId\\} view="${view}" />`));
    assert.match(src, /if \(!threadId\) \{/, `${file}: a threadless client gets an empty box`);
    assert.match(src, /href=\{SUPPLIER_CHATS_HREF\}/);
  }
});
