/**
 * 🔗 SHARE POSTS THE CARD INTO ONE CLIENT EVENT'S CHAT (owner 2026-11-11, verbatim: *"Share does not share to anyone.
 * It is share to an client event. To enter to a chat. That is notified so the client can see."*; approved prototype
 * frames G · H, `prototypes/service_card_row_2026-11-11/index.html`). And "Which services stay on" cannot turn off a
 * card with an open booking (*"You cannot turn off a service card until all booked completed."*).
 *
 * Fails if:
 *   • the Share icon is drawn waiting again, or opens anything but the "Share to a client event" sheet;
 *   • Share stops reusing the shipped `offerServiceCore` (a second card-in-chat post), or becomes a link / system share;
 *   • the server stops re-asking which chat it is (this shop's · accepted · not removed) before it posts;
 *   • the list of client events stops being the accepted, not-removed conversations, or an unread list reads as
 *     "no client events";
 *   • the toast says "notified" when nobody was;
 *   • the stay-on pick stops asking every card it leaves off for open bookings BEFORE it writes.
 * The email half (in the app only) is `lib/a-shared-card-never-emails.test.ts`.
 *
 * SABOTAGE (each seen red, restored): put `waiting` back on Share · drop the `isShareableThread` check from the core ·
 * read pending threads into the picker · move the stay-on refusal after `apply_service_plan_pick` · make `sharedToast`
 * always say "notified".
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path, { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { isShareableThread } from '@/lib/service-share-targets';
import { BOOKINGS_UNREAD, cardsLeftOffRefusal } from '@/lib/service-open-bookings';
import { SHARE_WORDS, shareRefusal, sharedToast } from './_components/service-card-share-sheet';

/* ── `server-only` shim (the shape of lib/a-locked-deal-reaches-the-budget.test.ts) — the reader is server-only. ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_card_share__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}
let readShareTargets: typeof import('@/lib/service-share-targets.server').readShareTargets;
before(async () => {
  ({ readShareTargets } = await import('@/lib/service-share-targets.server'));
});

const read = (...p: string[]) => stripComments(readFileSync(join(__dirname, ...p), 'utf8'));
const ROW = read('_components', 'service-card-menu-row.tsx');
const SHEET = read('_components', 'service-card-share-sheet.tsx');
const MANAGER = read('_components', 'services-manager.tsx');
const CORE = stripComments(readFileSync(join(process.cwd(), 'lib', 'offer-service-core.ts'), 'utf8'));
const STAY_ON = read('stay-on-actions.ts');

function body(src: string, sig: string): string {
  const at = src.indexOf(sig);
  assert.ok(at > 0, `${sig} was not found — re-anchor this guard`);
  const next = src.slice(at + sig.length).search(/\n(export )?(async )?function /);
  return src.slice(at, next < 0 ? undefined : at + sig.length + next);
}

test('the Share icon is live and opens the "Share to a client event" sheet', () => {
  const at = ROW.indexOf('name="Share to a client"');
  assert.ok(at > 0, 'the Share button moved — re-anchor this guard');
  const button = ROW.slice(at, ROW.indexOf('/>', at));
  // A SERVICE card's Share is live: the row draws it waiting ONLY when no `share` is handed in — the bundle card, which
  // wears this same row (bundle-cards-wear-the-card-row.test.ts) and cannot be posted yet. The manager always hands
  // a service card its share (next test), so a service card is never waiting.
  assert.match(button, /waiting=\{!share\}/, 'Share is drawn waiting for a card that has a share');
  assert.doesNotMatch(button, /waiting(?!=\{!share\})/, 'Share is drawn waiting again');
  assert.match(button, /onClick=\{share \? \(\) => setSharing\(true\) : undefined\}/, 'Share no longer opens the sheet');
  assert.match(ROW, /<ServiceCardShareSheet[\s\S]*open=\{sharing\}/, 'the row does not mount the share sheet');
  assert.equal(SHARE_WORDS.title, 'Share to a client event');
  assert.match(SHEET, /<Sheet open=\{open\}[^>]*title=\{SHARE_WORDS\.title\}/, 'the share sheet is not the house Sheet');
  assert.match(SHEET, /Posts “\$\{cardName\}” into their chat\. They get a notice\./, 'frame G’s line changed');
  assert.match(SHEET, /fd\.set\('via', 'share'\);/, 'the sheet does not ask for the share door (in-app-only notice)');
  assert.doesNotMatch(ROW + SHEET, /navigator\.share|clipboard|shareShopLink/, 'Share became a link / system share');
});

test('the manager hands every row the client events and the server action', () => {
  assert.match(MANAGER, /readShareTargets\(supabase, createAdminClient\(\), profile\.vendor_profile_id\)/);
  assert.match(MANAGER, /share: \{ targets: shareTargets, share: offerServiceInterest \}/, 'Share is not the shipped offer');
  assert.match(MANAGER, /shareRead\.status === 'ok' \? shareRead\.targets : null/, 'an unread list must reach the sheet as null');
});

test('the post re-asks which chat it is BEFORE it writes, in the SHIPPED offerServiceCore', () => {
  const check = CORE.indexOf("notice === 'shared' && !isShareableThread(");
  const owner = CORE.indexOf("return { status: 'not_owner' };");
  const write = CORE.indexOf(".from('chat_messages').insert(");
  assert.ok(owner > 0 && check > owner && write > check, 'the chat is not re-checked after ownership and before the card is posted');
  assert.doesNotMatch(SHEET + ROW, /from\('chat_messages'\)/, 'Share writes its own chat message beside the shipped post');
});

test('a client event = an accepted conversation the couple has not removed', () => {
  assert.equal(isShareableThread({ inquiry_status: 'accepted', archived_at: null }), true);
  for (const s of ['pending', 'declined', 'withdrawn', 'expired', 'displaced', null]) {
    assert.equal(isShareableThread({ inquiry_status: s, archived_at: null }), false, `${s} is not a chat to post into`);
  }
  assert.equal(isShareableThread({ inquiry_status: 'accepted', archived_at: '2026-11-01T00:00:00Z' }), false);
});

/** A tiny stand-in for the two reads `readShareTargets` makes. */
function fakes(threads: { data: unknown[] | null; error: unknown }, events: unknown[]) {
  const chain = (result: unknown) => {
    const q: Record<string, unknown> = {};
    for (const k of ['select', 'eq', 'is', 'order', 'in']) q[k] = () => q;
    q.limit = () => Promise.resolve(result);
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return q;
  };
  const supabase = { from: () => chain(threads) } as unknown as SupabaseClient;
  const admin = { from: () => chain({ data: events, error: null }) } as unknown as SupabaseClient;
  return { supabase, admin };
}

test('readShareTargets: one row per event, soonest first, named and dated; a refused read is unreadable', async () => {
  const { supabase, admin } = fakes(
    {
      data: [
        { thread_id: 't2', event_id: 'e2', inquiry_status: 'accepted', archived_at: null },
        { thread_id: 't1', event_id: 'e1', inquiry_status: 'accepted', archived_at: null },
        { thread_id: 't1b', event_id: 'e1', inquiry_status: 'accepted', archived_at: null },
      ],
      error: null,
    },
    [
      { event_id: 'e1', display_name: 'Reyes–Santos Wedding', event_date: '2026-12-14', event_type: 'wedding', region: null },
      { event_id: 'e2', display_name: null, event_date: '2027-01-09', event_type: 'debut', region: null },
    ],
  );
  const r = await readShareTargets(supabase, admin, 'shop');
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') return;
  assert.deepEqual(
    r.targets.map((t) => [t.threadId, t.name, t.dateLabel, t.initials]),
    [
      ['t1', 'Reyes–Santos Wedding', '14 Dec 2026', 'RW'],
      ['t2', 'A Setnayan event', '9 Jan 2027', 'AS'],
    ],
  );
  const refused = fakes({ data: null, error: { message: 'permission denied' } }, []);
  assert.deepEqual(await readShareTargets(refused.supabase, refused.admin, 'shop'), { status: 'unreadable' });
});

test('an Offline card says so before any pick (the server refuses it the same)', () => {
  assert.match(SHEET, /\{!isActive \? \([\s\S]{0,200}SHARE_WORDS\.offline/, 'an Offline card is offered a list it cannot post to');
  assert.match(ROW, /isActive=\{isActive\}/, 'the row does not tell the sheet whether the card is Online');
  assert.equal(shareRefusal({ status: 'invalid_service' }), SHARE_WORDS.offline, 'the server’s refusal and the sheet’s line differ');
});

test('the toast says "notified" only when somebody was', () => {
  assert.equal(sharedToast('Reyes–Santos Wedding', 2), 'Reyes–Santos Wedding notified');
  assert.equal(sharedToast('Lim Debut', 0), 'Posted in Lim Debut’s chat');
  assert.match(SHEET, /targets === null \?[\s\S]*SHARE_WORDS\.unread/, 'an unread list no longer says so');
});

test('"Which services stay on" asks every card it leaves off for open bookings, BEFORE it writes', () => {
  const b = body(STAY_ON, 'export async function pickServicesThatStayOn(');
  const ask = b.indexOf('cardsLeftOffRefusal(admin, leftOff)');
  const write = b.indexOf("admin.rpc('apply_service_plan_pick'");
  assert.ok(ask > 0 && write > ask, 'the open-bookings check is missing or comes after the write');
  assert.match(b, /cards\.filter\(\(c\) => c\.live && !keepIds\.includes\(c\.id\)\)/, 'leftOff is not every live card left out');
  assert.match(b, /if \(stillOpen\) back\(stillOpen\);/, 'the refusal does not stop the pick');
});

test('cardsLeftOffRefusal: names each card with an open booking, each booking on its own line; unread refuses', async () => {
  const admin = (picks: unknown[] | null, events: unknown[] = []) =>
    ({
      from: (table: string) => ({
        select: () => ({
          in: () =>
            Promise.resolve(
              table === 'event_vendors'
                ? picks === null
                  ? { data: null, error: { message: 'refused' } }
                  : { data: picks, error: null }
                : { data: events, error: null },
            ),
        }),
      }),
    }) as unknown as SupabaseClient;
  const cards = [
    { id: 's1', name: 'Garden Wedding Live Band' },
    { id: 's2', name: 'Acoustic Duo' },
  ];
  assert.equal(await cardsLeftOffRefusal(admin([]), []), null, 'nothing left off → nothing to refuse');
  assert.equal(
    await cardsLeftOffRefusal(admin([{ service_id: 's2', status: 'complete', event_id: 'e9' }]), cards),
    null,
    'a complete booking is not open',
  );
  const words = await cardsLeftOffRefusal(
    admin([{ service_id: 's1', status: 'contracted', event_id: 'e1' }], [{ event_id: 'e1', display_name: 'Maria & Juan’s Wedding', event_date: '2026-12-12' }]),
    cards,
  );
  assert.equal(words, '“Garden Wedding Live Band” can’t go off yet: 1 booking still open — finish it first\nMaria & Juan’s Wedding · 12 Dec 2026');
  assert.equal(await cardsLeftOffRefusal(admin(null), cards), BOOKINGS_UNREAD, 'an unread read must refuse');
});
