import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCustomerMenuTree, type CustomerMenu } from './customer-menu';
import { NAV_SLOT_DEFAULTS } from './nav-registry-defaults';
import { stripComments } from './strip-comments';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';
import { SIDEBAR_SLOT_KEYS } from '@/app/dashboard/[eventId]/_components/customer-nav-slot-keys';

/**
 * one-menu-word-in-all-three-phases.test.ts — the Event Hub has ONE name.
 *
 * ─── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * Measured on `origin/main` @ 1838a68c6, the couple's one public address wore a
 * DIFFERENT word in each lifecycle phase, and none of the three was the phrase
 * their own guests had taught them:
 *
 *   plan   "Launch"     → /website/editor        (the editor, not the address)
 *   dayof  "Services"   → /launch                (the controller, right place)
 *   after  "Editorial"  → /website/editorial     (one room of it)
 *
 * Three names, three destinations, one thing. The vocabulary is owner-locked
 * (2026-08-16: *Event Hub* = the one public address) and the ruling is one slot,
 * present in all three phases, labelled "Event Hub", pointing at the controller
 * EH1 shipped (`EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 1.2).
 *
 * ─── WHAT IS ASSERTED, AND WHY EACH ONE ───────────────────────────────────
 * 1. Every phase names the Hub the same, on BOTH rosters. A rename that reaches
 *    one surface is a diff, not a rename.
 * 2. Nothing anywhere still calls it Launch / Services / Editorial — the guard
 *    the retired words need, because deleting a label leaves nothing to fail.
 * 3. The KEY did not change. Three of its four consumers fail SILENTLY
 *    (`vendor-nav-destinations.ts` records the lesson): the registry slot, the
 *    localStorage section-open state and the badge map. Nothing throws when a
 *    key stops matching — the row just stops being renameable and remembered.
 * 4. The registry follows the code. A retired slot left in NAV_SLOT_DEFAULTS
 *    keeps /admin/menus offering a rename for a row that renders nowhere.
 * 5. The two destinations the Hub ABSORBED still have doors. The editorial
 *    maker was orphaned once already, and it went unnoticed.
 *
 * 🛡 Every assertion below was mutation-checked by occurrence count — the
 * sabotage applied, the count printed before → after, the test observed RED,
 * then restored. A green from a sabotage that did not land proves nothing.
 */

const EVENT_ID = 'S89E-TESTEVENT';
const BASE = `/dashboard/${EVENT_ID}`;
const HUB_HREF = `${BASE}/launch`;
const HUB_KEY = 'launch';
const HUB_LABEL = 'Event Hub';
const PHASES = ['plan', 'dayof', 'after'] as const;

/** Every menu word the phone shows in a phase — top-level tabs AND docked
 *  sub-nav children, because a second name one tap down is still a second
 *  name. `plan` is the DEFAULT (no phase argument), exactly as layout.tsx
 *  calls it for an event that has not happened. */
function phoneEntries(phase: (typeof PHASES)[number]) {
  const tree: CustomerMenu[] = buildCustomerMenuTree(EVENT_ID, {
    websiteEnabled: true,
    ...(phase === 'plan' ? {} : { phase }),
  });
  return [
    ...tree.map((m) => ({ key: m.key as string, label: m.label, href: m.href })),
    ...tree.flatMap((m) =>
      (m.children ?? []).map((c) => ({
        key: c.key,
        label: c.label,
        href: c.href ?? '',
      })),
    ),
  ];
}

/** Every row the desktop rail shows in a phase, across all its sections. */
function railEntries(phase: (typeof PHASES)[number]) {
  return buildCustomerNavGroups(EVENT_ID, {
    websiteEnabled: true,
    ...(phase === 'plan' ? {} : { phase }),
  })
    .flatMap((g) => g.items)
    .map((i) => ({ key: i.key, label: i.label, href: i.href }));
}

/* ══ 0 · THE PREMISE, MEASURED — otherwise every check below is vacuous ═══ */

test('both rosters are real in all three phases', () => {
  for (const phase of PHASES) {
    assert.ok(
      phoneEntries(phase).length >= 4,
      `the phone roster for "${phase}" returned a stub — nothing below would mean anything`,
    );
    assert.ok(
      railEntries(phase).length >= 5,
      `the rail roster for "${phase}" returned a stub`,
    );
  }
});

/* ══ 1 · ONE KEY, ONE WORD, ONE ADDRESS — IN ALL THREE PHASES ════════════ */

test('the Event Hub is the same key, label and href in every phase, on both rosters', () => {
  for (const phase of PHASES) {
    for (const [surface, entries] of [
      ['phone', phoneEntries(phase)],
      ['rail', railEntries(phase)],
    ] as const) {
      const hits = entries.filter((e) => e.key === HUB_KEY);
      assert.equal(
        hits.length,
        1,
        `the ${surface} roster for "${phase}" has ${hits.length} rows keyed ` +
          `"${HUB_KEY}" — expected exactly one. Two is the double-name this ` +
          'change removes; zero is the Hub missing from a phase entirely.',
      );
      assert.equal(
        hits[0]!.label,
        HUB_LABEL,
        `the ${surface} roster for "${phase}" calls the Event Hub ` +
          `"${hits[0]!.label}". A rename that reaches two phases and not the ` +
          'third is exactly the defect this file was written for.',
      );
      assert.equal(
        hits[0]!.href,
        HUB_HREF,
        `the ${surface} roster for "${phase}" points the Event Hub at ` +
          `${hits[0]!.href}, not the controller at ${HUB_HREF}.`,
      );
    }
  }
});

test('no roster offers a SECOND name for the Hub', () => {
  /* The three retired words, asserted as absent rather than trusted to have
     been deleted. Note "Editorial" is checked only as a name for THE HUB'S
     ADDRESS — the desktop rail's after-phase row pointing at the editorial
     MAKER is a different destination and must survive (test 5 below). */
  const RETIRED = ['Launch', 'Services', 'Editorial'];
  for (const phase of PHASES) {
    for (const [surface, entries] of [
      ['phone', phoneEntries(phase)],
      ['rail', railEntries(phase)],
    ] as const) {
      const names = entries.filter((e) => e.href === HUB_HREF).map((e) => e.label);
      assert.deepEqual(
        [...new Set(names)],
        [HUB_LABEL],
        `${surface}/${phase}: ${HUB_HREF} is offered under ${names.length} ` +
          `name(s) — ${names.join(' · ')}. One address, one word.`,
      );
      const retired = entries.filter((e) => RETIRED.includes(e.label) && e.href === HUB_HREF);
      assert.deepEqual(
        retired.map((e) => e.label),
        [],
        `${surface}/${phase} still calls the Event Hub by a retired word`,
      );
    }
  }
});

test('"Launch" has retired as a menu word on both rosters, in every phase', () => {
  for (const phase of PHASES) {
    for (const [surface, entries] of [
      ['phone', phoneEntries(phase)],
      ['rail', railEntries(phase)],
    ] as const) {
      const stragglers = entries.filter((e) => e.label === 'Launch');
      assert.deepEqual(
        stragglers.map((e) => `${e.key} → ${e.href}`),
        [],
        `${surface}/${phase} still shows a menu word "Launch". It meant four ` +
          'different things across this codebase; as a MENU word it is retired.',
      );
    }
  }
});

/* ══ 2 · THE KEY DID NOT CHANGE — the half that fails silently ═══════════ */

test("the Hub's key is 'launch' everywhere, and its registry slots key off it", () => {
  assert.equal(
    SIDEBAR_SLOT_KEYS[HUB_KEY],
    'customer.sidebar.launch',
    'SIDEBAR_SLOT_KEYS no longer maps the Hub row to its registry slot — the ' +
      'row silently stops being renameable and hideable from /admin/menus.',
  );
  const keys = new Set(NAV_SLOT_DEFAULTS.map((s) => s.key));
  for (const slot of ['customer.sidebar.launch', 'customer.bottom-nav.launch']) {
    assert.ok(keys.has(slot), `${slot} is missing from NAV_SLOT_DEFAULTS`);
  }
});

/* ══ 3 · THE REGISTRY FOLLOWS THE CODE ══════════════════════════════════ */

test('the retired slots are gone from NAV_SLOT_DEFAULTS, and the live ones read "Event Hub"', () => {
  const bySlot = new Map(NAV_SLOT_DEFAULTS.map((s) => [s.key, s]));
  for (const dead of [
    'customer.bottom-nav.services',
    'customer.bottom-nav.editorial',
    'customer.studio-subnav.launch',
  ]) {
    assert.equal(
      bySlot.has(dead),
      false,
      `${dead} governs a row that no longer renders. /admin/menus would keep ` +
        'offering a rename, an icon and a hide that reach no screen — an admin ' +
        'edit that appears to save and changes nothing.',
    );
  }
  for (const live of ['customer.sidebar.launch', 'customer.bottom-nav.launch']) {
    const slot = bySlot.get(live)!;
    assert.equal(slot.label, HUB_LABEL, `${live} still defaults to "${slot.label}"`);
    assert.equal(
      slot.route,
      '/dashboard/[eventId]/launch',
      `${live} still points at ${slot.route}`,
    );
  }
});

/* ══ 4 · THE PHONE AND THE RAIL AGREE, PHASE BY PHASE ═══════════════════ */

test('the rail and the phone send the Event Hub to the same address in every phase', () => {
  for (const phase of PHASES) {
    const phone = phoneEntries(phase).find((e) => e.key === HUB_KEY)!;
    const rail = railEntries(phase).find((e) => e.key === HUB_KEY)!;
    assert.equal(
      phone.href,
      rail.href,
      `in "${phase}" the phone opens ${phone.href} and the rail opens ` +
        `${rail.href}. Two rosters naming one place and pointing at two is the ` +
        'drift that costs a person a dead end.',
    );
    assert.equal(phone.label, rail.label, `in "${phase}" the two surfaces disagree on the word`);
  }
});

/* ══ 5 · WHAT THE HUB ABSORBED STILL HAS A DOOR ═════════════════════════ */

const HERE = dirname(fileURLToPath(import.meta.url));
const HUB_PAGE = join(HERE, '..', 'app', 'dashboard', '[eventId]', 'launch', 'page.tsx');

test('the editor and the editorial maker are still reachable', () => {
  /* The controller is the door for both — its S5 "set once" rows. Read from
     the page's real source, with comments stripped: this change QUOTES both
     addresses in its own prose, and a raw-source grep would find its needle
     inside the sentence explaining the needle and pass forever.

     🔒 `stripComments` FROM `lib/strip-comments.ts` — THE ONE STRIPPER, not a
     two-replace regex of this file's own. A hand-rolled one strips BLOCK
     comments first, so a LINE comment that happens to contain a block-comment
     OPENER opens a comment which then runs to the next real CLOSER, blanking
     everything between; the guard afterwards asserts against a blank and
     passes. CI's `lint one comment stripper` blocks a second implementation,
     and it caught exactly this file on its first run.

     🪤 AND THE FIRST DRAFT OF THIS VERY PARAGRAPH SPELLED THE CLOSER OUT AND
     ENDED THE COMMENT ON ITSELF — esbuild refused to parse the file. The
     hazard is not hypothetical even in prose about the hazard. */
  const src = stripComments(readFileSync(HUB_PAGE, 'utf8'));
  assert.ok(src.length > 2000, 'the Event Hub controller source shrank to a stub — re-anchor this guard');
  for (const room of ['website/editor', 'website/editorial']) {
    assert.ok(
      src.includes(`/${room}\``),
      `the Event Hub controller no longer links /${room}. It was the ONLY door ` +
        'left for it on the phone once the Hub absorbed its menu word, and the ' +
        'editorial maker has been orphaned once already — it "appeared in no ' +
        'menu at all" and nobody noticed.',
    );
  }

  /* And on the desktop, the after-phase rail keeps its own row straight to the
     maker (added 2026-08-21 after the owner asked "how do i see the editorial
     maker?"). The Hub taking the phone's tab must not undo that. */
  assert.ok(
    railEntries('after').some((e) => e.href === `${BASE}/website/editorial`),
    'the After rail lost its row for the editorial maker',
  );
});
