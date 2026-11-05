/**
 * setnayan-ai-needs-suppliers.test.ts — SETNAYAN AI SHOWS ONLY WHEN THE EVENT HAS SUPPLIERS ON.
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "SETNAYAN AI SHOWS ONLY WHEN THE EVENT HAS SUPPLIERS ON"), verbatim:
 * *"so when suppliers are deactivated on the event to be created, Setnayan AI does not need to show."*
 * — and, asked which switch decides: *"it is based on the onboarding"* (the "What do you need?"
 * Suppliers row, stored as `events.suppliers_on`).
 *
 * What this pins:
 *   1. THE RULE — one predicate, `setnayanAiOffered` (lib/setnayan-ai.ts), over the draft's needs and
 *      over the stored row read back (NULL = never asked = ON, so older events are unchanged).
 *   2. THE PIXELS — the onboarding's Setnayan AI card (and its line in the total) is drawn with
 *      Suppliers on and is gone with Suppliers off; the simple flow's card follows the needs screen live.
 *   3. THE BILL — both commit paths drop an AI pick made on a Suppliers-off draft.
 *   4. EVERY OFFER SITE CALLS THE ONE PREDICATE — a named list, plus a discovery sweep so a NEW offer site
 *      cannot appear without it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';

import { setnayanAiOffered } from './setnayan-ai';
import { readEventNeeds, needsForPreset } from './event-needs';
import { buildServicesStepView, type ServicesStepView } from './onboarding/services-step-data';
import { EMPTY_SERVICES_SELECTION, setAi } from './onboarding-services-selection';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

// ── 1 · the rule ───────────────────────────────────────────────────────────

test('the predicate: Suppliers off ⇒ not offered; on ⇒ offered; never asked ⇒ offered', () => {
  assert.equal(setnayanAiOffered({ suppliers: false }), false);
  assert.equal(setnayanAiOffered({ suppliers: true }), true);
  assert.equal(setnayanAiOffered(null), true, 'no needs read = no choice made = as before');
  assert.equal(setnayanAiOffered(undefined), true);
});

test('the stored row decides after creation — NULL is ON, only an explicit false hides it', () => {
  assert.equal(setnayanAiOffered(readEventNeeds({ suppliers_on: false })), false);
  assert.equal(setnayanAiOffered(readEventNeeds({ suppliers_on: true })), true);
  assert.equal(setnayanAiOffered(readEventNeeds({ suppliers_on: null })), true);
  assert.equal(setnayanAiOffered(readEventNeeds(null)), true, 'a failed read degrades to everything on');
});

test('the onboarding presets: "Simple" leaves Suppliers off, so it offers no Setnayan AI', () => {
  const scope = { marketplace: true };
  assert.equal(setnayanAiOffered(needsForPreset('simple', scope)), false);
  assert.equal(setnayanAiOffered(needsForPreset('open', scope)), true);
  assert.equal(setnayanAiOffered(needsForPreset('full', scope)), true);
});

// ── 2 · the pixels ─────────────────────────────────────────────────────────

const AI_HEAD = /A planner that already knows every supplier in the room/;

function view(): ServicesStepView {
  return buildServicesStepView({
    eventWord: 'birthday',
    poolTiers: [],
    oneTiers: [],
    pricePhpByCode: new Map(),
    freePoolPoints: 50,
    freeOnePoints: 0,
    aiPricePhp: 499,
    hubPro: null,
  });
}

async function mod(rel: string, name: string): Promise<React.ComponentType<Record<string, unknown>>> {
  const m = (await import(rel)) as Record<string, unknown>;
  // A 'use client' module can land under `.default` when imported by tsx.
  return (m[name] ?? (m.default as Record<string, unknown> | undefined)?.[name]) as React.ComponentType<Record<string, unknown>>;
}

async function paint(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const ServicesStep = await mod('../app/onboarding/_shared/services-step', 'ServicesStep');
  return renderToStaticMarkup(React.createElement(ServicesStep, { view: view(), ...props }));
}

test('the fixture really offers the card (so its absence below means something)', () => {
  assert.ok(view().ai, 'a priced view carries card 2');
});

test('Suppliers on (and absent — the wedding) ⇒ the Setnayan AI card and its price line are drawn', async () => {
  for (const extra of [{ suppliersOn: true }, {}]) {
    const html = await paint({ selection: setAi(EMPTY_SERVICES_SELECTION, true), onSelectionChange: () => {}, ...extra });
    assert.match(html, AI_HEAD);
    assert.match(html, /₱499/, 'its price is on screen');
  }
});

test('Suppliers off ⇒ no Setnayan AI card, toggle or price — even with the pick still ticked', async () => {
  const html = await paint({ selection: setAi(EMPTY_SERVICES_SELECTION, true), onSelectionChange: () => {}, suppliersOn: false });
  assert.doesNotMatch(html, AI_HEAD);
  assert.doesNotMatch(html, /₱499/, 'no price line anywhere, the total included');
  assert.doesNotMatch(html, /Setnayan AI|planner/i, 'not one line names it');
});

test('the simple flow: the needs screen’s Suppliers row reaches the card through its context, live', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const m = (await import('../app/onboarding/simple/_components/papic-step-fields')) as Record<string, unknown>;
  const pick = (k: string) => m[k] ?? (m.default as Record<string, unknown> | undefined)?.[k];
  const PapicStepFields = pick('PapicStepFields') as React.ComponentType<Record<string, unknown>>;
  const Ctx = pick('SimpleSuppliersOnContext') as React.Context<boolean>;
  const draw = (on: boolean | null) => {
    const inner = React.createElement(PapicStepFields, { view: view() });
    return renderToStaticMarkup(on === null ? inner : React.createElement(Ctx.Provider, { value: on }, inner));
  };
  assert.match(draw(true), AI_HEAD);
  assert.match(draw(null), AI_HEAD, 'no needs screen (engine off) ⇒ offered as before');
  assert.doesNotMatch(draw(false), AI_HEAD);
  // The provider is fed from the flow's own `needs` state — so a flip re-renders, no reload.
  assert.match(
    code('app/onboarding/simple/_components/simple-setup-flow.tsx'),
    /<SimpleSuppliersOnContext\.Provider value=\{needs\.suppliers\}>\{finish\}<\/SimpleSuppliersOnContext\.Provider>/,
  );
  // And the AI field posts the offered value, never the raw tick.
  assert.match(code('app/onboarding/simple/_components/papic-step-fields.tsx'), /name=\{AI_FIELD_SELECTED\} value=\{String\(aiPosted\)\}/);
});

test('the generic wizard hands its live needs to the card', () => {
  assert.match(
    code('app/onboarding/[type]/_components/generic-onboarding.tsx'),
    /suppliersOn=\{!engine \|\| setnayanAiOffered\(needs\)\}/,
  );
});

// ── 3 · the bill ───────────────────────────────────────────────────────────

test('both commit paths drop an AI pick made on a Suppliers-off draft', () => {
  assert.match(
    code('app/onboarding/simple/actions.ts'),
    /ai: needs && !setnayanAiOffered\(needs\) \? 'false' : formData\.get\(AI_FIELD_SELECTED\)/,
  );
  assert.match(code('app/onboarding/_shared/commit-event.ts'), /needs && !setnayanAiOffered\(needs\)[\s\S]{0,200}ai: false/);
});

// ── 4 · every offer site calls the one predicate ───────────────────────────

/** Every place Setnayan AI is offered to a host — each must ask `setnayanAiOffered`. */
const OFFER_SITES = [
  'app/onboarding/_shared/services-step.tsx', // the create flows' card + price line
  'app/onboarding/simple/_components/papic-step-fields.tsx', // the simple flow's posted pick
  'app/onboarding/[type]/_components/generic-onboarding.tsx', // the generic wizard's mount
  'app/onboarding/simple/actions.ts', // the simple commit
  'app/onboarding/_shared/commit-event.ts', // the generic commit
  'app/dashboard/[eventId]/page.tsx', // Home: comeback card · Next card · Your services row
  'app/dashboard/[eventId]/studio/setnayan-ai/page.tsx', // the Setnayan AI page's buy state
  'app/dashboard/[eventId]/vendors/page.tsx', // the Suppliers page's Unlock banner
  'app/dashboard/[eventId]/_components/event-dashboard.tsx', // the free venue-shortlist upsell
] as const;

test('every named offer site calls setnayanAiOffered( — in code, not a comment', () => {
  for (const f of OFFER_SITES) {
    assert.match(code(f), /\bsetnayanAiOffered\(/, `${f} offers Setnayan AI without asking setnayanAiOffered`);
  }
});

/**
 * The shapes an offer takes in code. A file holding one of them outside OFFER_SITES is a NEW offer site.
 * The wedding flow mounts the card with no Suppliers choice to read (it has no "What do you need?" — its
 * row is never written, so it reads ON); it is the one reasoned exception.
 */
const OFFER_SHAPES = [
  /\bshouldOfferSetnayanAiPurchase(?:ForEvent)?\(/,
  /<SetnayanAiComebackOffer\b/,
  /\bresolveSetnayanAiOfferForEvent\(/,
  /<ServicesStep\b/,
  /\baiSellable:/,
  /<FreeVenueShortlistOffer\b/,
];
const EXEMPT: Record<string, string> = {
  'app/onboarding/wedding/_components/onboarding-shell.tsx':
    'the wedding has no Suppliers choice (no needs screen; suppliers_on is never written ⇒ ON)',
  'app/dev/home-lab/page.tsx': 'a dev lab fixture, not a host surface',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules' && name !== '.next') walk(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(web, p));
  }
  return out;
}

test('discovery: no host-facing file holds an offer shape without being a named offer site', () => {
  const files = [...walk(join(web, 'app')), ...walk(join(web, 'lib'))];
  assert.ok(files.length > 500, `the sweep read the tree (${files.length} files)`);
  // Raw text first (cheap), then the comment-stripped code — a shape named only in a comment is no offer.
  const holders = files.filter((f) => {
    const raw = read(f);
    return OFFER_SHAPES.some((re) => re.test(raw)) && OFFER_SHAPES.some((re) => re.test(stripComments(raw)));
  });
  assert.ok(holders.length >= 5, `the sweep found the offer sites it guards (${holders.length})`);
  const named = new Set<string>(OFFER_SITES);
  const strays = holders.filter(
    (f) =>
      !named.has(f) &&
      !(f in EXEMPT) &&
      // The definitions themselves, not offers.
      !/^lib\/(setnayan-ai(-server)?|our-services|home-paid-services)\.ts$/.test(f) &&
      !/^app\/dashboard\/\[eventId\]\/_components\/setnayan-ai-comeback-offer\.tsx$/.test(f) &&
      !/^app\/onboarding\/_shared\/services-step\.tsx$/.test(f) &&
      !/^app\/dashboard\/\[eventId\]\/progress\/_components\/free-venue-shortlist-offer\.tsx$/.test(f),
  );
  assert.deepEqual(strays, [], `new Setnayan AI offer site(s) — call setnayanAiOffered there and name it in OFFER_SITES: ${strays.join(', ')}`);
});
