/**
 * home-ai-card-reads-honestly.test.ts — SETNAYAN AI'S OWN CARD SAYS WHAT SAI IS WATCHING, AND NEVER "ALL QUIET" OVER A
 * REFUSAL (owner-approved 2026-10-24, `home_control_center_2026-10-24_fable.html`: Setnayan AI as its own service card —
 * "Sai on watch · 1 alert", the alert as its line; not added: "Try it", no price).
 *
 *   1 · The alerts are the guard notifications Setnayan AI already raises — `ai_guard_alert` · `ai_payment_due`, unread,
 *       THIS event's (by the link the guard wrote) — read through the couple's own session; a refused read is 'unread'.
 *   2 · The card draws "Couldn't load" when either read was refused — the alerts or the planner model (`measured`).
 *   3 · It grows in place: Sai on watch · Your picks · the door last; and the phone tile counts the alerts.
 *   4 · Not added: "Try it", with no price — on the slim line and on the phone's tile.
 *
 * SABOTAGE (seen red): `readSaiOnWatch` returning [] on an error (1 red) · the event filter dropped (1 red) · the card
 * drawing the quiet line over 'unread' (2 red) · the AI slim line carrying the catalogue price again (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { HOME_PAID_SKU, homeServices, paidSlimWords } from '@/lib/home-first-screen';
import { homePaidFacts } from '@/lib/home-paid-services';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { drawHome, loadHome } from './home-render.harness';

// `server-only` is shimmed by the harness (imported above), so the read can be loaded here.
test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));

/** A recording stand-in for the Supabase query builder: every call is kept; the await answers `result`. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'is', 'like', 'order', 'limit']) {
    chain[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return chain;
    };
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { client: chain as never, calls };
}

test('1 · Sai on watch is the guard’s own unread alerts for THIS event; a refusal is "unread"', async () => {
  const { readSaiOnWatch, SAI_WATCH_TYPES } = await import('@/lib/home-ai-card.server');
  const ok = fakeClient({ data: [{ notification_id: 'n1', title: 'Lumière Catering has not replied in 9 days', body: 'Your quote is with them', related_url: '/dashboard/e1/messages/t1' }], error: null });
  const rows = await readSaiOnWatch(ok.client, 'u1', 'e1');
  assert.deepEqual(rows, [{ id: 'n1', title: 'Lumière Catering has not replied in 9 days', body: 'Your quote is with them', href: '/dashboard/e1/messages/t1' }]);
  const called = (m: string) => ok.calls.filter(([n]) => n === m).map(([, a]) => a);
  assert.deepEqual(called('from'), [['notifications']]);
  assert.deepEqual(called('eq'), [['user_id', 'u1']], 'the alerts are not the viewer’s own');
  assert.deepEqual(called('in'), [['type', [...SAI_WATCH_TYPES]]]);
  assert.deepEqual([...SAI_WATCH_TYPES], ['ai_guard_alert', 'ai_payment_due'], 'not the two types the AI guard emits');
  assert.deepEqual(called('is'), [['read_at', null]], 'a read alert is still "on watch"');
  assert.deepEqual(called('like'), [['related_url', '/dashboard/e1/%']], 'another event’s alerts would show here');
  const refused = fakeClient({ data: null, error: { message: 'refused', code: '42501' } });
  assert.equal(await readSaiOnWatch(refused.client, 'u1', 'e1'), 'unread', 'a refused read reads as all quiet');
  // The guard emits exactly those types (the planner of what notifies).
  assert.match(stripComments(readFileSync(join(HERE, '..', '..', '..', 'lib', 'setnayan-ai-guard-plan.ts'), 'utf8')), /'ai_payment_due' : 'ai_guard_alert'/);
});

test('2 · either refusal draws "Couldn’t load" — never the quiet line', () => {
  const card = src('_components/home-cards/home-planner-card.tsx');
  assert.match(card, /if \(!activity \|\| !activity\.measured\) return <HomeServiceCard [^>]*\bfailed\b/);
  assert.match(card, /if \(watch === 'unread'\) return <HomeServiceCard [^>]*\bfailed\b/);
  assert.match(card, /readSaiOnWatch\(supabase, user\.id, eventId\)\.catch\(\(\): 'unread' => 'unread'\)/, 'a thrown alert read is not "unread"');
});

test('3 · it grows in place — Sai on watch, Your picks, the door last — and the tile counts the alerts', () => {
  const card = src('_components/home-cards/home-planner-card.tsx');
  const at = (s: string) => card.indexOf(s);
  assert.ok(at('data-home-ai-section="watch"') > 0 && at('data-home-ai-section="watch"') < at('data-home-ai-section="picks"'), 'Sai on watch does not come before the picks');
  assert.match(card, /settings=\{/, 'the card has nothing to grow — it would be a door');
  assert.match(card, /door=\{door\}/);
  assert.match(card, /const door = \{ label: 'Open Setnayan AI', href: `\/dashboard\/\$\{eventId\}\/studio\/setnayan-ai` \};/);
  assert.match(card, /tile=\{\{ label: brand, big: formatCount\(n\), unit: n === 1 \? 'alert' : 'alerts'/);
  assert.match(card, /activity\.cockpit\.decisions\.slice\(0, 3\)/, 'the picks are not the planner’s own ranked decisions');
});

test('4 · not added: "Try it", with no price — slim line and phone tile', () => {
  assert.equal(paidSlimWords('ai', '₱1,499'), 'Try it');
  assert.equal(paidSlimWords('ai', '₱1,499', 19), 'Comeback price · 19h left', 'the comeback line still says its hours');
  assert.equal(paidSlimWords('music', '₱2,500'), '₱2,500', 'only Setnayan AI drops its price on Home');
  const E = 'e1';
  const OFF = { active: false, pending: false };
  const paid = homePaidFacts({
    eventId: E,
    catalogue: ADD_ONS,
    reads: { [HOME_PAID_SKU.ai]: OFF },
    prices: new Map([[HOME_PAID_SKU.ai, '₱1,499']]),
    offered: () => true,
    sellableNow: () => true,
    aiSellable: true,
    refusesPath: () => false,
  });
  const services = homeServices({ next: 'plan', storeShell: false, papic: 'x', ai: 'y', eventId: E, paid });
  const ai = services.find((s) => s.key === 'ai');
  assert.equal(ai?.paid?.state, 'add', 'premise: Setnayan AI is not added');
  const html = drawHome({ services: [ai!], serviceCards: true });
  const at = html.indexOf('data-home-service-tile="ai"');
  assert.ok(at > 0, 'no phone tile for Setnayan AI not added');
  assert.doesNotMatch(html.slice(html.indexOf('data-home-services')), /₱/, 'a price on Home for Setnayan AI');
  assert.match(html, /Not added<\/small>[\s\S]{0,80}Try it/, 'the tile does not say "Not added · Try it"');
  assert.match(html, /aria-label="Try it"/);
});
