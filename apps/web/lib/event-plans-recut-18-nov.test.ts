import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AI_PLAN_SKUS,
  AI_PLAN_SKUS_BEFORE_RECUT,
  EVENT_PLANS_RECUT_AT,
  eventMediaPlanFrom,
  placedBeforeRecut,
  planOrderCarriesSetnayanAi,
} from '@/lib/event-plans';
import { coupleMediaCapBytes, formatMakerMediaMB } from '@/lib/maker-media-limits';
import { coupleMediaFullMessage } from '@/lib/couple-media-allowance';

/**
 * 🎟 THE 18 NOV 2026 EVENT PLAN RE-CUT (owner, PLAN_RULINGS_2026-11-18 rulings 20 · 34 · 36 · 38).
 *
 *   · Setnayan AI is Event Pro's and Ultra's, NOT Event Plus's — for NEW purchases only: a Plus order placed before
 *     `EVENT_PLANS_RECUT_AT` keeps the AI it was sold with (activation turns it on; a refund re-derive keeps it).
 *   · Uploads per event: Free 10 MB · Plus 500 MB · Pro 1 GB · Ultra 2 GB.
 *
 * SABOTAGE (each turns this red): put 'EVENT_PLUS' back into AI_INCLUDED_PLAN_SKUS · set the AI flag before asking the
 * order's date · move the re-cut line earlier · let a bad date strip a past buyer · drop a plan's upload number.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, '..', rel), 'utf8');

test('the re-cut line is the end of the ruling day, Manila — never earlier', () => {
  assert.equal(EVENT_PLANS_RECUT_AT, '2026-11-19T00:00:00+08:00');
  assert.ok(Date.parse(EVENT_PLANS_RECUT_AT) >= Date.parse('2026-11-18T16:00:00Z'));
});

test('Event Pro and Ultra carry Setnayan AI for every buyer; Event Plus only before the re-cut', () => {
  assert.deepEqual([...AI_PLAN_SKUS].sort(), ['COUPLE_WEBSITE_PRO', 'EVENT_ULTRA']);
  assert.deepEqual([...AI_PLAN_SKUS_BEFORE_RECUT], ['EVENT_PLUS']);
  assert.equal(planOrderCarriesSetnayanAi('COUPLE_WEBSITE_PRO', '2026-12-01T00:00:00Z'), true);
  assert.equal(planOrderCarriesSetnayanAi('EVENT_ULTRA', '2026-12-01T00:00:00Z'), true);
  assert.equal(planOrderCarriesSetnayanAi('EVENT_PLUS', '2026-11-10T09:00:00+08:00'), true, 'a past Plus buyer keeps the AI');
  assert.equal(planOrderCarriesSetnayanAi('EVENT_PLUS', '2026-11-18T23:59:59+08:00'), true, 'the ruling day itself is grandfathered');
  assert.equal(planOrderCarriesSetnayanAi('EVENT_PLUS', '2026-11-19T00:00:00+08:00'), false, 'a new Plus buyer gets no AI');
  assert.equal(planOrderCarriesSetnayanAi('EVENT_PLUS', '2027-01-01T00:00:00Z'), false);
  assert.equal(planOrderCarriesSetnayanAi('PAPIC_GUEST_1K', '2026-11-10T00:00:00Z'), false);
  assert.equal(planOrderCarriesSetnayanAi(null, null), false);
});

test('an unreadable order date never strips a past buyer', () => {
  assert.equal(placedBeforeRecut(null), true);
  assert.equal(placedBeforeRecut('not a date'), true);
  assert.equal(placedBeforeRecut('2026-12-01T00:00:00Z', 'garbage'), true);
  assert.equal(planOrderCarriesSetnayanAi('EVENT_PLUS', null), true);
});

test('sku-activation: EVENT_PLUS left AI_INCLUDED_PLAN_SKUS and the hook asks the order before turning the AI on', () => {
  const src = read('lib/sku-activation.ts');
  const list = src.match(/export const AI_INCLUDED_PLAN_SKUS[^=]*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  assert.ok(list, 'AI_INCLUDED_PLAN_SKUS moved — re-point this guard');
  assert.doesNotMatch(list, /EVENT_PLUS/, 'Event Plus carries Setnayan AI for new buyers again');
  const hook = src.slice(src.indexOf('async function activateEventPlan'), src.indexOf('const EXACT_HOOKS'));
  assert.ok(hook.length > 0, 'activateEventPlan moved — re-point this guard');
  const ask = hook.indexOf('eventPlanOrderCarriesAi(ctx)');
  const write = hook.indexOf('setnayan_ai_active: true');
  assert.ok(ask >= 0 && write > ask, 'the AI flag is written before the order is asked whether it carries the AI');
  assert.match(hook, /if \(carriesAi\) \{/, 'the AI flag is no longer conditional on the order carrying it');
  // The refund re-derive still sees a grandfathered Plus — it must never strip a past buyer's AI.
  const rederive = src.slice(src.indexOf('async function deactivateSetnayanAiIfUnowned'), src.indexOf('async function planHeldFromBeforeRecut'));
  assert.match(rederive, /AI_PLAN_SKUS_BEFORE_RECUT/, 'the refund re-derive forgot the grandfathered Event Plus');
  assert.match(src, /mayCarryAi\(ctx\.serviceKey\)/, 'reversing a Plus order no longer re-derives the AI flag');
});

test('uploads per event follow the plan: Free 10 MB · Plus 500 MB · Pro 1 GB · Ultra 2 GB', () => {
  const MB = 1024 * 1024;
  assert.equal(coupleMediaCapBytes('free'), 10 * MB);
  assert.equal(coupleMediaCapBytes('plus'), 500 * MB);
  assert.equal(coupleMediaCapBytes('pro'), 1024 * MB);
  assert.equal(coupleMediaCapBytes('ultra'), 2048 * MB);
  // The older boolean (the Background part) reads exactly what it read before.
  assert.equal(coupleMediaCapBytes(true), 500 * MB);
  assert.equal(coupleMediaCapBytes(false), 10 * MB);
  assert.equal(formatMakerMediaMB(coupleMediaCapBytes('pro')), '1 GB');
  assert.equal(formatMakerMediaMB(coupleMediaCapBytes('ultra')), '2 GB');
  assert.equal(formatMakerMediaMB(coupleMediaCapBytes('plus')), '500 MB');
});

test('the largest held plan names the allowance — a higher plan only ever widens it', () => {
  const none = { ultra: false, pro: false, plus: false, backgroundPart: false };
  assert.equal(eventMediaPlanFrom(none), 'free');
  assert.equal(eventMediaPlanFrom({ ...none, backgroundPart: true }), 'plus');
  assert.equal(eventMediaPlanFrom({ ...none, plus: true }), 'plus');
  assert.equal(eventMediaPlanFrom({ ...none, plus: true, pro: true }), 'pro');
  assert.equal(eventMediaPlanFrom({ ...none, pro: true, ultra: true }), 'ultra');
});

test('only a FREE event reads the Event Pro mention in a refusal — and it names Pro’s 1 GB', () => {
  const MB = 1024 * 1024;
  assert.match(coupleMediaFullMessage(10 * MB, 2 * MB, 'free'), /◆ Event Pro gives you 1 GB of uploads\.$/);
  assert.match(coupleMediaFullMessage(10 * MB, 2 * MB, false), /◆ Event Pro gives you 1 GB of uploads\.$/);
  for (const plan of ['plus', 'pro', 'ultra'] as const) {
    assert.doesNotMatch(coupleMediaFullMessage(coupleMediaCapBytes(plan), 2 * MB, plan), /Event Pro gives you/, plan);
  }
  assert.match(coupleMediaFullMessage(2048 * MB, 2 * MB, 'ultra'), /used its 2 GB of uploads/);
});

test('the upload reservation enforces the PLAN, read by the same helper the meters draw', () => {
  const server = read('lib/couple-media-allowance.server.ts');
  assert.match(server, /const plan = await eventCoupleMediaPlan\(admin, eventId\);\s*const capBytes = coupleMediaCapBytes\(plan\);/);
  const editor = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(editor, /eventCoupleMediaPlan\(/, 'the Maker meter no longer reads the plan the upload enforces');
});
