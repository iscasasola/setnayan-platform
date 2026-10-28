/**
 * setup-is-done-in-place.test.ts — 🧰 A NEW SHOP'S SIX STEPS ARE DONE IN PLACE ON TODAY.
 *
 * Owner 2026-10-28 (corpus DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE", TODAY;
 * prototype `prototypes/supplier_in_place_2026-10-28/interactive.html` v8): "new-shop setup = 6 folds done in place
 * (Save → ✓, the bar grows, the next opens; big tools such as the service maker as a SHEET over Today); step 4 counts
 * Good · Better · Best (≥ 3 cards per Service, 'N to go'); step 5 documents in place (Approved · Checking · Needs a
 * fix + the admin's reason · re-upload drop); step 6 opens the shop's Anyone-QR fold."
 *
 * Held as properties:
 *   1 · the six steps, in the prototype's order and words, each ✓ read off the SAVED fact (the rail / the checklist) —
 *       never off a press;
 *   2 · Good · Better · Best: three cards per service, "N to go", lowest price first; an unread card list is never
 *       "0 of 3" and never ticks the step; the rail's own "What you offer" agrees (one rule, not two);
 *   3 · a save that ticks the OPEN step opens the NEXT one (`nextOpenAfter`); any other ✓ leaves the open one alone;
 *   4 · drawn: "N of 6 done", the bar at N, the first step not done open, ⚙ at the end of the first row, every body a
 *       SHIPPED editor (no link away), an empty Good/Better/Best slot opens the maker as a SHEET, the papers say
 *       Checking / Needs a fix + the admin's reason, step 6 holds the shop's QR and the days-off row;
 *   5 · the days-off row saves through the shipped `addManualBlock`, asked to answer IN PLACE — which never redirects.
 *
 * Sabotage (2026-10-28, each run and reverted — see the PR body): the docs ✓ read off the badge instead of the rail ·
 * `CARDS_PER_SERVICE` 3 → 1 · `nextOpenAfter` returning the open key · the slot's `aria-haspopup` dropped · the
 * in-place branch's `return` removed (falls through to the redirect) — each RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

const CHECKLIST = (ok: (k: string) => boolean) =>
  ['logo', 'business_name', 'business_owner_name', 'in_business_since_year', 'services', 'maps_pin', 'contact_phone', 'contact_email'].map(
    (key) => ({ key, label: key, surface: 'profile' as const, ok: ok(key) }),
  );

async function rail(o: { cards?: number; details?: boolean; logo?: boolean; docs?: 'none' | 'pending_review' | 'rejected' | 'approved'; daysOff?: number; offerRead?: boolean }) {
  const { buildFirstStepsRail } = await import('@/lib/vendor-first-steps');
  const { offerProgress } = await import('@/lib/supplier-setup');
  const cards = Array.from({ length: o.cards ?? 0 }, (_, i) => ({ id: `c${i}`, service: 'catering', title: `Card ${i}`, pricePhp: [650, 450, 950][i] ?? null }));
  return buildFirstStepsRail({
    verified: false,
    profileDone: o.details ? 6 : 2,
    profileTotal: 6,
    hasLogo: o.logo ?? false,
    serviceCount: cards.length,
    docsStatus: o.docs ?? 'none',
    docsIn: 0,
    docsTotal: 4,
    submitMissing: [],
    customerCount: 0,
    notAvailableCount: o.daysOff ?? 0,
    offer: o.offerRead === false ? null : offerProgress(['catering'], cards),
  });
}

test('1 · the six steps, in order and in the prototype’s words — each ✓ the saved fact', async () => {
  const { assembleSetup, setupHeadline } = await import('@/lib/supplier-setup');
  const r = await rail({});
  const v = assembleSetup({ checklist: CHECKLIST((k) => k === 'business_name' || k === 'business_owner_name' || k === 'in_business_since_year'), rail: r, offer: r.offer, docs: { status: null, docsIn: 0, docsTotal: 4 }, shopName: 'Tita Nena’s Catering' });
  assert.deepEqual(
    v.folds.map((f) => f.title),
    ['Name your shop', 'Your details', 'Add your logo', 'What you offer', 'Send your documents', 'Your QR + days off'],
  );
  assert.deepEqual(v.folds.map((f) => f.done), [true, false, false, false, false, false], 'a ✓ that is not the saved fact');
  assert.equal(v.firstOpen, 'details', 'the first step not done is not the one that opens');
  assert.equal(setupHeadline(v), '1 of 6 done');

  const all = await rail({ cards: 3, details: true, logo: true, docs: 'pending_review', daysOff: 1 });
  const done = assembleSetup({ checklist: CHECKLIST(() => true), rail: all, offer: all.offer, docs: { status: 'pending_review', docsIn: 4, docsTotal: 4 }, shopName: 'x' });
  assert.equal(done.done, 6, 'six saved facts do not make six ✓');
  assert.equal(done.firstOpen, null);
  assert.equal(setupHeadline(done), 'All done — Setnayan checks you next');
  // Sent papers are the supplier's part done (the next move is Setnayan's) — said as Checking, never as Approved.
  assert.deepEqual(done.folds.find((f) => f.key === 'docs')?.badge, { word: 'Checking', tone: 'wait' });
});

test('2 · Good · Better · Best — three cards per service, "N to go", lowest price first; the rail agrees', async () => {
  const { offerProgress, CARDS_PER_SERVICE, SERVICE_TIERS } = await import('@/lib/supplier-setup');
  assert.equal(CARDS_PER_SERVICE, 3);
  assert.deepEqual([...SERVICE_TIERS], ['Good', 'Better', 'Best']);
  const p = offerProgress(['catering', 'grazing_table'], [
    { id: 'a', service: 'catering', title: 'Premium', pricePhp: 650 },
    { id: 'b', service: 'catering', title: 'Classic', pricePhp: 450 },
    { id: 'c', service: 'catering', title: 'Unpriced', pricePhp: null },
  ]);
  assert.deepEqual(p.services.map((s) => [s.service, s.cards.length, s.toGo]), [['catering', 3, 0], ['grazing_table', 0, 3]]);
  assert.deepEqual(p.services[0]!.cards.map((c) => c.title), ['Classic', 'Premium', 'Unpriced'], 'Good is not the lowest price');
  assert.equal(p.toGo, 3);
  assert.equal(offerProgress([], []).toGo, 3, 'a shop with no service at all has nothing to go');

  const { assembleSetup } = await import('@/lib/supplier-setup');
  for (const [cards, done, word] of [[1, false, '2 to go'], [2, false, '1 to go'], [3, true, null]] as const) {
    const r = await rail({ cards });
    const step = r.steps.find((s) => s.key === 'service_card')!;
    assert.equal(step.state === 'done', done, `${cards} card(s): the rail's "What you offer" disagrees with Good · Better · Best`);
    const fold = assembleSetup({ checklist: CHECKLIST(() => false), rail: r, offer: r.offer, docs: { status: null, docsIn: 0, docsTotal: 4 }, shopName: null }).folds.find((f) => f.key === 'offer')!;
    assert.equal(fold.done, done);
    assert.equal(fold.badge?.word ?? null, word);
  }
  // Unread cards: never "0 of 3", never ticked.
  const unread = await rail({ cards: 3, offerRead: false });
  const fold = assembleSetup({ checklist: CHECKLIST(() => false), rail: unread, offer: null, docs: { status: null, docsIn: 0, docsTotal: 4 }, shopName: null }).folds.find((f) => f.key === 'offer')!;
  assert.equal(fold.badge?.word, 'Couldn’t load');
});

test('3 · a save that ticks the open step opens the next one — any other ✓ leaves it alone', async () => {
  const { nextOpenAfter } = await import('@/lib/supplier-setup');
  const folds = (done: string[]) => (['name', 'details', 'logo', 'offer', 'docs', 'qr'] as const).map((key) => ({ key, done: done.includes(key) }));
  assert.equal(nextOpenAfter(folds(['name', 'details']), 'details', new Set(['name'])), 'logo', 'Save → ✓ did not open the next step');
  assert.equal(nextOpenAfter(folds(['name', 'details', 'docs']), 'details', new Set(['name'])), 'logo');
  assert.equal(nextOpenAfter(folds(['name', 'details', 'logo']), 'logo', new Set(['name', 'details'])), 'offer');
  // The ✓ is somewhere else — the open step stays open (no jumping).
  assert.equal(nextOpenAfter(folds(['name', 'docs']), 'details', new Set(['name'])), 'details');
  // Already done before (a re-save) — stays.
  assert.equal(nextOpenAfter(folds(['name', 'details']), 'details', new Set(['name', 'details'])), 'details');
  // The last one left: skips back to the first still open.
  assert.equal(nextOpenAfter(folds(['details', 'logo', 'offer', 'docs', 'qr']), 'qr', new Set(['details', 'logo', 'offer', 'docs'])), 'name');
  // The client follows it: the open step is moved by this function, never by a reload.
  const client = code('app/vendor-dashboard/_components/supplier-setup-folds.tsx');
  assert.match(client, /setOpen\(\(o\) => nextOpenAfter\(view\.folds, o, was\)\)/, 'the folds no longer open the next step after a save');
  assert.doesNotMatch(client, /router\.(push|replace|refresh)|window\.location/, 'a setup save moves the page');
});

async function drawLab(q: { docs?: 'none' | 'checking' | 'fix'; gbb?: number } = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TodayEasyLab } = await import('@/app/dev/supplier-lab/today-easy-lab');
  const noop = async () => {};
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  return renderToStaticMarkup(
    React.createElement(ToastProvider, null, React.createElement(TodayEasyLab, { sup: 'caterer', moment: 'setup', actions, docs: q.docs ?? 'none', gbb: q.gbb ?? 2 })),
  );
}

test('4 · drawn: N of 6 · the bar · the first open · ⚙ in the first row · shipped editors · the maker as a sheet · the papers · the QR', async () => {
  const html = await drawLab({ gbb: 2 });
  const setup = html.slice(html.indexOf('data-today-setup'));
  assert.ok(setup.length > 0, 'the setup block is not drawn on a new shop');
  assert.equal((setup.match(/data-fold="setup-(name|details|logo|offer|docs|qr)"/g) ?? []).length, 6, 'not six steps');
  const headline = setup.match(/data-setup-headline=""[^>]*>([^<]+)</)?.[1];
  const n = Number(headline?.match(/^(\d) of 6 done$/)?.[1]);
  assert.ok(Number.isInteger(n), `the headline is not "N of 6 done": ${headline}`);
  assert.match(setup, new RegExp(`role="meter"[^>]*aria-valuenow="${n}"`), 'the bar is not at N');
  assert.equal((setup.match(/data-fold-open=""/g) ?? []).length, 1, 'not exactly one step open');
  // ⚙ ends the first row.
  const first = setup.slice(setup.indexOf('data-first-row'), setup.indexOf('data-setup-headline'));
  assert.match(first, /data-menu-settings="today"/, 'Today’s ⚙ is not in the first row of a new shop');
  // The Next card does not repeat the step.
  assert.doesNotMatch(html, /data-today-next="setup"/, 'the setup Next card is drawn over the six steps');
  // Good · Better · Best: two made, the third slot opens the maker as a sheet.
  const offer = setup.slice(setup.indexOf('data-setup-body="offer"'), setup.indexOf('data-setup-body="docs"'));
  assert.equal((offer.match(/data-setup-card="(Good|Better)"/g) ?? []).length, 2);
  assert.match(offer, /<button[^>]*aria-haspopup="dialog"[^>]*data-setup-add-card="Best"/, 'the empty Best slot does not open a sheet');
  assert.match(text(offer), /1 to go/);
  // Every step's body is an editor in place — no link that sends the supplier away to do the step.
  for (const k of ['name', 'details', 'logo', 'offer']) {
    const body = setup.slice(setup.indexOf(`data-setup-body="${k}"`));
    const end = body.indexOf('data-setup-body=', 20);
    // ⚠ ONE KNOWN DOOR, SAID: the shipped "Services covered" row (`EditableRow`, the same on Your details) still picks
    // what you do in Coverage (`/vendor-dashboard/services`). It is the shipped editor, mounted as is — not a new link.
    const own = body.slice(0, end > 0 ? end : undefined).replace(/<a [^>]*href="\/vendor-dashboard\/services"[^>]*>/g, '');
    assert.doesNotMatch(own, /<a [^>]*href="\/vendor-dashboard\/(profile|services|shop)/, `step ${k} links away instead of doing it here`);
  }
  // Step 6: the shop's QR (Share · Save) and the days-off row.
  const qr = setup.slice(setup.indexOf('data-setup-body="qr"'));
  assert.match(qr, /data-qr-card="setup-shop"/, 'step 6 lost the shop’s QR');
  assert.match(qr, /data-form-row="setup-days-off"/, 'step 6 lost the days-off row');
});

test('4b · the papers: Checking while Setnayan looks; Needs a fix — and the admin’s reason — when they came back', async () => {
  const checking = await drawLab({ docs: 'checking' });
  assert.match(checking, /data-badge-for="setup-docs"[^>]*>Checking</);
  const fix = await drawLab({ docs: 'fix' });
  assert.match(fix, /data-badge-for="setup-docs"[^>]*>Needs a fix</);
  const docs = fix.slice(fix.indexOf('data-setup-body="docs"'), fix.indexOf('data-setup-body="qr"'));
  assert.match(text(docs), /The BIR 2303 photo is cut off at the bottom/, 'the admin’s reason is not said on the step');
});

test('5 · the days-off row saves through the shipped addManualBlock, in place — and in place never redirects', () => {
  const row = code('app/vendor-dashboard/_components/setup-days-off-row.tsx');
  assert.match(row, /import \{ addManualBlock \} from '\.\.\/calendar\/actions';/);
  assert.match(row, /fd\.set\('return_to', 'inplace'\);/);
  const actions = code('app/vendor-dashboard/calendar/actions.ts');
  const fn = actions.slice(actions.indexOf('export async function addManualBlock('), actions.indexOf('\nexport async function', actions.indexOf('export async function addManualBlock(') + 10));
  assert.match(fn, /const inPlace = str\(formData, 'return_to'\) === 'inplace';/);
  assert.match(fn, /if \(inPlace\) throw new Error\(notice\);/, 'an in-place refusal redirects instead of answering');
  assert.match(fn, /if \(inPlace\) \{\s*revalidatePath\('\/vendor-dashboard'\);\s*return;\s*\}\s*backToCalendar\(formData, 'block_added'\);/, 'an in-place save falls through to the redirect');
  assert.doesNotMatch(fn, /backToCalendar\(formData, '(bad_dates|bad_pool|save_failed)'\)/, 'a refusal skips the in-place answer');
});
