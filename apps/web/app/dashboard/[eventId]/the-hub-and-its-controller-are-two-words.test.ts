import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { buildCustomerMenuTree, type CustomerMenu } from '@/lib/customer-menu';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { RETAIL } from '@/lib/llms-txt-guard-input';

/**
 * the-hub-and-its-controller-are-two-words.test.ts — LS8, 2026-09-03.
 *
 * ─── THE TWO RULINGS THIS HOLDS ─────────────────────────────────────────────
 * Owner, 2026-09-03 (`DECISION_LOG` row of that date, corpus commit b3c435b):
 *
 *   ① `LIVE_STUDIO_HOSTED_CHANNEL` comes back on sale at **₱3,000 PER DAY**,
 *      per-day beside a one-time base ON PURPOSE.
 *   ② **Event Hub** = the GUEST-FACING SITE.
 *      **Event Hub Controller** = the dashboard where the couple controls what
 *      the Event Hub contains.
 *
 * ─── WHY EITHER NEEDS A GUARD ───────────────────────────────────────────────
 * Both regressions are INVISIBLE. Nothing throws when a rail row goes back to
 * saying "Event Hub": the row renders, the href still resolves, the page still
 * loads, and what a couple meets is one word for two different screens — which
 * is the state PR #5108 shipped and flagged as unresolved rather than a bug.
 * And nothing throws when the per-day figure gets "reconciled" with the
 * one-time base either; the catalog simply starts charging a different amount.
 *
 * 🔑 THE HALF THAT IS EASIEST TO GET WRONG IS THE HALF THAT MUST **NOT** CHANGE.
 * A rename like this invites a bulk replace, and a bulk replace would silently
 * destroy the guest sense — `/llms.txt` calling the guest site "the 4-in-1
 * couple website", the Live Studio FAQ's "They open your Event Hub and press
 * play", the `landing-page` product card. Those surfaces are ALREADY RIGHT under
 * the ruling. So this guard asserts in both directions: the dashboard rows do
 * not say the bare word, and the guest surfaces still do. A one-directional
 * check would call a completed bulk replace a pass.
 *
 * 🛡 Every assertion below was mutation-tested by occurrence count, before and
 * after, and each count is recorded in the PR body.
 */

const EVENT_ID = 'S89E-TESTEVENT';
const BASE = `/dashboard/${EVENT_ID}`;
const HUB_HREF = `${BASE}/launch`;
const CONTROLLER = 'Event Hub Controller';
const GUEST_WORD = 'Event Hub';
const PHASES = ['plan', 'dayof', 'after'] as const;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..', '..', '..');

/** Read a file that must exist, so a moved file fails loudly, not silently. */
function read(rel: string): string {
  const full = path.join(WEB, rel);
  assert.ok(fs.existsSync(full), `${rel} is gone — this guard would pass on nothing`);
  const src = fs.readFileSync(full, 'utf8');
  assert.ok(src.length > 500, `${rel} is ${src.length} bytes — too small to be the real file`);
  return src;
}

/**
 * ⚠ COMMENTS COME OUT FIRST, VIA THE CANONICAL LEXER. Several of the files
 * scanned here EXPLAIN this rename in prose and quote the retired bare word
 * while doing it — a raw scan would fail on the sentence describing the fix.
 * `lib/strip-comments.ts` exists because the three hand-rolled regex strippers
 * that came before it deleted 5,104 lines of real code via `accept="image/*"`.
 */
const code = (rel: string) => stripComments(read(rel));

/** Every row the phone shows in a phase — top-level tabs AND docked sub-nav
 *  children, because a second name one tap down is still a second name.
 *  `plan` is the DEFAULT (no `phase` argument), exactly as layout.tsx calls it
 *  for an event that has not happened yet. */
function phoneRows(phase: (typeof PHASES)[number]) {
  const tree: CustomerMenu[] = buildCustomerMenuTree(EVENT_ID, {
    websiteEnabled: true,
    ...(phase === 'plan' ? {} : { phase }),
  });
  return [
    ...tree.map((m) => ({ label: m.label, href: m.href })),
    ...tree.flatMap((m) => (m.children ?? []).map((c) => ({ label: c.label, href: c.href ?? '' }))),
  ];
}

/** Every row the desktop rail shows in a phase, across all its sections. */
function railRows(phase: (typeof PHASES)[number]) {
  return buildCustomerNavGroups(EVENT_ID, {
    websiteEnabled: true,
    ...(phase === 'plan' ? {} : { phase }),
  })
    .flatMap((g) => g.items)
    .map((i) => ({ label: i.label, href: i.href }));
}

/* ══ 1 · THE DASHBOARD SAYS "CONTROLLER", ON BOTH SURFACES, IN EVERY PHASE ══ */

test('every dashboard row that opens the controller is called "Event Hub Controller"', () => {
  let checked = 0;
  for (const phase of PHASES) {
    for (const [surface, rows] of [
      ['phone', phoneRows(phase)],
      ['rail', railRows(phase)],
    ] as const) {
      const hits = (rows as Array<{ href?: string; label?: string }>).filter(
        (r) => r.href === HUB_HREF,
      );
      assert.equal(
        hits.length,
        1,
        `${surface}/${phase} has ${hits.length} rows pointing at ${HUB_HREF} — ` +
          'the ruling is ONE row per surface per phase.',
      );
      assert.equal(
        hits[0]!.label,
        CONTROLLER,
        `${surface}/${phase} calls the controller "${hits[0]!.label}". ` +
          `The dashboard row is the CONTROLLER; "${GUEST_WORD}" is what a guest opens.`,
      );
      checked += 1;
    }
  }
  // Six windows (2 surfaces × 3 phases). A builder that quietly stopped
  // returning rows would otherwise leave every assertion above unexecuted.
  assert.equal(checked, 6, `only ${checked} of 6 surface/phase pairs were reached`);
});

test('no dashboard row anywhere is labelled with the bare guest word', () => {
  const offenders: string[] = [];
  for (const phase of PHASES) {
    for (const [surface, rows] of [
      ['phone', phoneRows(phase)],
      ['rail', railRows(phase)],
    ] as const) {
      for (const row of rows as Array<{ label?: string; href?: string }>) {
        if (row.label === GUEST_WORD) offenders.push(`${surface}/${phase}: ${row.href}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a dashboard row is labelled "${GUEST_WORD}", which names the GUEST SITE:\n  ` +
      `${offenders.join('\n  ')}\n` +
      'This renders, routes and reviews perfectly — it is only wrong to the couple ' +
      'reading two screens with one name, which is why it is asserted.',
  );
});

test('both live registry slots default to the controller name', () => {
  const bySlot = new Map(NAV_SLOT_DEFAULTS.map((s) => [s.key, s]));
  for (const key of ['customer.sidebar.launch', 'customer.bottom-nav.launch']) {
    const slot = bySlot.get(key);
    assert.ok(slot, `${key} is missing from NAV_SLOT_DEFAULTS`);
    assert.equal(
      slot!.label,
      CONTROLLER,
      `${key} defaults to "${slot!.label}" — /admin/menus would offer the couple's ` +
        'controller under the guest site\'s name.',
    );
    assert.equal(slot!.route, '/dashboard/[eventId]/launch', `${key} was repointed`);
  }
});

test('the controller page declares the controller name, in metadata and on the masthead', () => {
  const src = code(path.join('app', 'dashboard', '[eventId]', 'launch', 'page.tsx'));
  assert.match(
    src,
    /export const metadata = \{ title: 'Event Hub Controller' \}/,
    'the controller page no longer declares its own name',
  );
  /*
    THE MASTHEAD IS THE HALF A METADATA CHECK CANNOT SEE. `metadata.title` is the
    browser tab; `phaseTitle` is the sentence at the top of the page, and the two
    are set 500 lines apart. All three phases are counted rather than spot-checked
    — the day-of arm is the one a reviewer never opens.
  */
  const mastheads = src.match(/'Your Event Hub Controller[^']*'/g) ?? [];
  assert.equal(
    mastheads.length,
    3,
    `the masthead names the controller in ${mastheads.length} of 3 phases: ` +
      `${mastheads.join(' · ')}`,
  );
  assert.doesNotMatch(
    src,
    /'Your Event Hub(?: — today)?'/,
    'a phase arm reverted to the bare guest word',
  );
});

/* ══ 2 · THE GUEST SENSE SURVIVED — A BULK REPLACE WOULD FAIL HERE ══════════ */

test('the guest-facing surfaces still say "Event Hub", unqualified', () => {
  /*
    ⛔ THESE ARE NOT OVERSIGHTS TO TIDY UP LATER. Each names the page a GUEST
    opens, which is precisely what the ruling says "Event Hub" means. They are
    listed by file so that a future bulk replace fails HERE, loudly, instead of
    quietly deleting the distinction this whole change exists to draw.
  */
  const GUEST_SITE_SURFACES: Array<[string, RegExp]> = [
    ['lib/llms-txt.ts', /\*\*Event Hub\*\* — free\. The 4-in-1 couple website/],
    ['lib/studio-apps.ts', /Your Event Hub is one beautiful home for your whole event/],
    ['app/(shell)/panood/page.tsx', /They open your Event Hub and press play/],
  ];
  for (const [rel, pattern] of GUEST_SITE_SURFACES) {
    assert.match(
      code(rel),
      pattern,
      `${rel} lost the guest sense of "Event Hub". It describes what a GUEST ` +
        'opens, so the bare word is correct there and must not be "corrected".',
    );
  }
});

test('the product card keeps the guest word and the Pro SKU keeps its name', () => {
  const card = ADD_ONS.find((a) => a.key === 'landing-page');
  assert.ok(card, 'the landing-page card was deleted');
  assert.equal(
    card!.label,
    GUEST_WORD,
    `the product card reads "${card!.label}". It names the guest site a couple buys; ` +
      'that it opens the controller is the papic shape the 2026-09-02 ruling asked for.',
  );

  const pro = ADD_ONS.find((a) => a.label === 'Event Hub PRO');
  assert.ok(pro, '"Event Hub PRO" lost its name — it upgrades the GUEST SITE, so it keeps the word');
});

/* ══ 3 · THE HOSTED CHANNEL IS ON SALE, PER DAY ═════════════════════════════ */

test('LIVE_STUDIO_HOSTED_CHANNEL is active at ₱3,000, and the fixture says so too', () => {
  /*
    The fixture is the reference reality for both llms.txt guards and is a
    hand-typed second copy of the catalog — the class of defect that has drifted
    three times in this repo. Pinning it here means a future reprice that misses
    this file fails in the unit suite, not only in the ~25-minute db suite.
  */
  const row = RETAIL.find((r) => r.service_code === 'LIVE_STUDIO_HOSTED_CHANNEL');
  assert.ok(row, 'the hosted-channel fixture row is gone');
  assert.equal(row!.is_active, true, 'the fixture still calls the hosted channel retired');
  assert.equal(row!.retail_price_php, 3000, `the fixture prices it ₱${row!.retail_price_php}`);
});

test('the migration sets per_day, and says why that is not an inconsistency', () => {
  /*
    🔑 THE ASYMMETRY IS THE THING THAT GETS "FIXED". LIVE_STUDIO is one_time and
    this is per_day, side by side in one table, and the reasoning lives only in
    the migration comment — so the comment is asserted, not just the value. A
    reviewer who sees the two periods and no explanation reconciles them.
  */
  const dir = path.join(WEB, '..', '..', 'supabase', 'migrations');
  const file = fs
    .readdirSync(dir)
    .find((f) => f.endsWith('_live_studio_hosted_channel_is_3000_per_day.sql'));
  assert.ok(file, 'the LS8 hosted-channel migration is missing');

  const sql = fs.readFileSync(path.join(dir, file!), 'utf8');
  const stmt = sql.slice(sql.indexOf('UPDATE public.platform_retail_catalog_v2'));
  assert.match(stmt, /retail_price_php = 3000/, 'the migration does not set ₱3,000');
  assert.match(stmt, /billing_period\s+= 'per_day'/, 'the migration does not set per_day');
  assert.match(stmt, /is_active\s+= TRUE/, 'the migration does not put the SKU back on sale');
  assert.match(
    stmt,
    /WHERE service_code = 'LIVE_STUDIO_HOSTED_CHANNEL'/,
    'the migration targets the wrong SKU',
  );

  // The reasoning, in the comment above the statement — not the statement.
  const preamble = sql.slice(0, sql.indexOf('UPDATE public.platform_retail_catalog_v2'));
  for (const [what, pattern] of [
    ['that per-day is deliberate', /PER-DAY IS CORRECT EVEN THOUGH/i],
    ['that channels are scarce', /THREE Setnayan channels|three Setnayan channels/i],
    ['that the price is a safety price', /never be bundled|never bundled/i],
  ] as const) {
    assert.match(
      preamble,
      pattern,
      `the migration no longer records ${what} — without it the next reader ` +
        'reconciles per_day with the one-time base and reprices the product.',
    );
  }
});
