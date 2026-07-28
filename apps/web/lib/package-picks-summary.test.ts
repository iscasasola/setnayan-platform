/**
 * THE BUILD, AS A MESSAGE — tests.
 *
 * The property that matters most here is a NEGATIVE one: this module must never
 * produce a peso figure it was not handed. Every assertion below compares the
 * rendered figure against `formatCentavosPhp(<the exact input>)`, so a future
 * edit that starts summing deltas locally fails immediately rather than shipping
 * a message whose total disagrees with the couple's screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPackagePicksSummary,
  buildNotSentCopy,
  buildNotSentReasonFor,
  formatPackagePicksBlock,
  sanitizePackagePicks,
  PACKAGE_PICKS_ESTIMATE_NOTE,
} from './package-picks-summary';
import {
  formatCentavosPhp,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
} from './vendor-packages';
import type { ChoiceSelection } from './package-choice-tree';

/* ── fixtures ─────────────────────────────────────────────────────────── */

function option(
  over: Partial<VendorPackageItemOptionRow> & { option_id: string; option_label: string },
): VendorPackageItemOptionRow {
  return {
    item_id: 'i1',
    price_delta_centavos: 0,
    is_default: false,
    is_available: true,
    display_order: 0,
    ...over,
  };
}

function item(
  over: Partial<VendorPackageItemRow> & { item_id: string; service_description: string },
): VendorPackageItemRow {
  return {
    package_id: 'p1',
    canonical_service: 'catering',
    is_default_included: true,
    replacement_value_centavos: 0,
    display_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    options: [],
    ...over,
  } as VendorPackageItemRow;
}

const coverage = item({ item_id: 'i0', service_description: 'Full-day coverage' });

const mainCourse = item({
  item_id: 'i1',
  service_description: 'Main course',
  options: [
    option({ option_id: 'o-std', option_label: 'Chicken', is_default: true }),
    option({ option_id: 'o-lechon', option_label: 'Lechon belly', price_delta_centavos: 350000 }),
  ],
});

/** A follow-up: outside the chargeable region, so its picks are preferences. */
const lechonStyle = item({
  item_id: 'i2',
  service_description: 'Which lechon style?',
  parent_option_id: 'o-lechon',
  is_default_included: false,
  options: [option({ item_id: 'i2', option_id: 'o-cebu', option_label: 'Cebu style' })],
});

const hourly = item({
  item_id: 'i3',
  service_description: 'Photo booth',
  extra_hour_centavos: 150000,
  max_extra_hours: 3,
});

const photoBooth = item({ item_id: 'i9', service_description: 'Second shooter' });

/* ── the builder ──────────────────────────────────────────────────────── */

test('labels + deltas + totals come from the screen, not from arithmetic', () => {
  const selection: ChoiceSelection = {
    picks: { i1: ['o-lechon'], i2: ['o-cebu'] },
    extraHours: { i3: 2 },
  };
  const summary = buildPackagePicksSummary({
    packageName: 'Weekend Wedding Collection',
    lines: [
      { item: coverage, depth: 0 },
      { item: mainCourse, depth: 0 },
      { item: lechonStyle, depth: 1 },
      { item: hourly, depth: 0 },
    ],
    allItems: [],
    removedItemIds: [],
    selection,
    bookingTotalCentavos: 12500000,
    surchargeCentavos: 350000,
  });

  assert.equal(summary.packageName, 'Weekend Wedding Collection');
  assert.equal(summary.lines.length, 4);

  // A line with no choice contributes a label and nothing else.
  assert.deepEqual(summary.lines[0], {
    label: 'Full-day coverage',
    depth: 0,
    options: [],
    extraHours: 0,
  });

  // The priced pick carries the delta string the option row printed.
  assert.deepEqual(summary.lines[1]!.options, [
    {
      label: 'Lechon belly',
      deltaLabel: `+${formatCentavosPhp(350000)}`,
    },
  ]);

  // 🪞 The FREE preference carries no delta AND no annotation — the modal
  // renders a ₱0 pick with no note, so the message must not add one.
  assert.deepEqual(summary.lines[2]!.options, [
    { label: 'Cebu style', deltaLabel: null },
  ]);
  assert.equal(summary.lines[2]!.depth, 1);

  assert.equal(summary.lines[3]!.extraHours, 2);

  // The two footer figures are the two figures we were handed — formatted, not
  // recomputed.
  assert.equal(summary.totalLabel, formatCentavosPhp(12500000));
  assert.equal(summary.upgradesLabel, `+${formatCentavosPhp(350000)}`);
});

test('a chargeable option worth nothing extra prints no delta (₱0 shows NOTHING)', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [{ item: mainCourse, depth: 0 }],
    allItems: [],
    removedItemIds: [],
    selection: { picks: { i1: ['o-std'] } },
    bookingTotalCentavos: 100000,
    surchargeCentavos: 0,
  });
  assert.deepEqual(summary.lines[0]!.options, [
    { label: 'Chicken', deltaLabel: null },
  ]);
  assert.equal(summary.upgradesLabel, null, 'no surcharge ⇒ no upgrades line');
});

test('EMPTY SELECTION — every visible line still lists, with no picks', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [
      { item: coverage, depth: 0 },
      { item: mainCourse, depth: 0 },
    ],
    allItems: [],
    removedItemIds: [],
    selection: { picks: {} },
    bookingTotalCentavos: 8000000,
    surchargeCentavos: 0,
  });
  assert.deepEqual(
    summary.lines.map((l) => l.options.length),
    [0, 0],
  );
  const block = formatPackagePicksBlock(summary);
  assert.match(block, /• Full-day coverage/);
  assert.doesNotMatch(block, /→/, 'nothing picked ⇒ no option arrows');
  assert.doesNotMatch(block, /Skipped:/);
});

test('REMOVED LINES are named as skipped, and are not lines', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [{ item: coverage, depth: 0 }],
    allItems: [coverage, photoBooth, hourly],
    removedItemIds: [photoBooth.item_id, hourly.item_id],
    selection: { picks: {} },
    bookingTotalCentavos: 5000000,
    surchargeCentavos: 0,
  });
  assert.deepEqual(summary.removed, ['Second shooter', 'Photo booth']);
  const block = formatPackagePicksBlock(summary);
  assert.match(block, /Skipped: Second shooter, Photo booth/);
});

test('a refused pricer omits the total but never the estimate note', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [{ item: coverage, depth: 0 }],
    allItems: [],
    removedItemIds: [],
    selection: { picks: {} },
    bookingTotalCentavos: null,
    surchargeCentavos: 0,
  });
  assert.equal(summary.totalLabel, null);
  const block = formatPackagePicksBlock(summary);
  assert.doesNotMatch(block, /Estimated total/);
  assert.match(block, new RegExp(escapeRe(PACKAGE_PICKS_ESTIMATE_NOTE)));
});

/* ── the block ────────────────────────────────────────────────────────── */

test('the block reads as one message and always closes with the estimate note', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'Weekend Wedding Collection',
    lines: [
      { item: mainCourse, depth: 0 },
      { item: lechonStyle, depth: 1 },
      { item: hourly, depth: 0 },
    ],
    allItems: [mainCourse, photoBooth],
    removedItemIds: [photoBooth.item_id],
    selection: { picks: { i1: ['o-lechon'], i2: ['o-cebu'] }, extraHours: { i3: 1 } },
    bookingTotalCentavos: 12500000,
    surchargeCentavos: 350000,
  });
  const block = formatPackagePicksBlock(summary);
  const lines = block.split('\n');

  assert.equal(lines[0], '', 'leading blank line, same as the requirements block');
  assert.equal(lines[1], '— The build we put together —');
  assert.equal(lines[2], 'Package: Weekend Wedding Collection');
  assert.equal(lines[3], '• Main course');
  assert.equal(lines[4], `  → Lechon belly (+${formatCentavosPhp(350000)})`);
  assert.equal(lines[5], '  • Which lechon style?', 'a follow-up is indented under its pick');
  assert.equal(lines[6], '    → Cebu style', 'a free pick is never annotated');
  assert.equal(lines[7], '• Photo booth');
  assert.equal(lines[8], '  → 1 extra hour (your vendor quotes these)');
  assert.equal(lines[9], 'Skipped: Second shooter');
  assert.equal(
    lines[10],
    `Estimated total: ${formatCentavosPhp(12500000)} (incl. +${formatCentavosPhp(350000)} upgrades)`,
  );
  assert.equal(lines[11], PACKAGE_PICKS_ESTIMATE_NOTE);
});

test('nothing to say ⇒ empty string, so callers can concatenate unconditionally', () => {
  assert.equal(formatPackagePicksBlock(null), '');
  assert.equal(formatPackagePicksBlock(undefined), '');
  assert.equal(
    formatPackagePicksBlock({
      packageName: 'P',
      lines: [],
      removed: [],
      totalLabel: null,
      upgradesLabel: null,
    }),
    '',
  );
});

/* ── the sanitizer (this shape arrives from a browser) ────────────────── */

test('junk sanitizes to null rather than into a message', () => {
  assert.equal(sanitizePackagePicks(null), null);
  assert.equal(sanitizePackagePicks('nope'), null);
  assert.equal(sanitizePackagePicks(42), null);
  assert.equal(sanitizePackagePicks([]), null);
  assert.equal(sanitizePackagePicks({}), null);
  assert.equal(sanitizePackagePicks({ lines: [], removed: [] }), null);
  assert.equal(sanitizePackagePicks({ lines: [{ label: '' }], removed: [] }), null);
});

test('the sanitizer clamps, flattens and drops', () => {
  const clean = sanitizePackagePicks({
    packageName: '  Grand   Package \n Deluxe ',
    lines: [
      {
        label: 'A'.repeat(500),
        depth: 99,
        extraHours: -3,
        options: [
          { label: 'ok', deltaLabel: '+₱1,000' },
          { label: 42 },
          'nope',
        ],
      },
      { label: 'no depth' },
      null,
    ],
    removed: ['gone', '', 7, 'also gone'],
    totalLabel: '₱10,000',
    upgradesLabel: null,
  });
  assert.ok(clean);
  assert.equal(clean.packageName, 'Grand Package Deluxe', 'whitespace collapses to one line');
  assert.equal(clean.lines.length, 2, 'a null / unlabelled line is dropped');
  assert.equal(clean.lines[0]!.label.length, 200, 'labels are length-capped');
  assert.equal(clean.lines[0]!.depth, 5, 'depth is capped at the DB chain limit');
  assert.equal(clean.lines[0]!.extraHours, 0, 'a negative hour count is no hours');
  assert.deepEqual(clean.lines[0]!.options, [
    { label: 'ok', deltaLabel: '+₱1,000' },
  ]);
  assert.deepEqual(clean.removed, ['gone', 'also gone']);
  assert.equal(clean.totalLabel, '₱10,000');
  assert.equal(clean.upgradesLabel, null);
});

test('a built summary survives a JSON round trip (it crosses the action boundary)', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [{ item: mainCourse, depth: 0 }],
    allItems: [mainCourse, photoBooth],
    removedItemIds: [photoBooth.item_id],
    selection: { picks: { i1: ['o-lechon'] } },
    bookingTotalCentavos: 990000,
    surchargeCentavos: 350000,
  });
  const round = sanitizePackagePicks(JSON.parse(JSON.stringify(summary)));
  assert.deepEqual(round, summary);
  assert.equal(formatPackagePicksBlock(round), formatPackagePicksBlock(summary));
});

/* ── 🪞 annotation parity: the message may not say more than the screen ── */

/**
 * The modal's option row, as source (`lock-modal.tsx`):
 *
 *     {!selectable || opt.price_delta_centavos > 0 ? (
 *       <p>{!selectable ? 'Ask your vendor — not part of this total'
 *                       : `+${formatCentavosPhp(opt.price_delta_centavos)}`}</p>
 *     ) : null}
 *
 * `isOptionSelectable` returns true for anything already picked, so for a PICK
 * the `!selectable` branch is unreachable and the screen's note is exactly
 * "`+₱delta` when delta > 0, otherwise nothing". This replica encodes that, and
 * `service-details-dark.test.ts` pins the JSX it replicates so the two cannot
 * drift apart silently.
 */
function screenNoteForPickedOption(deltaCentavos: number): string | null {
  return deltaCentavos > 0 ? `+${formatCentavosPhp(deltaCentavos)}` : null;
}

test('PARITY — the message never annotates an option the modal renders bare', () => {
  const deltas = [0, 1, 100, 50000, 350000];
  for (const delta of deltas) {
    const line = item({
      item_id: 'p1',
      service_description: 'Line',
      options: [
        option({ item_id: 'p1', option_id: 'p-opt', option_label: 'Pick', price_delta_centavos: delta }),
      ],
    });
    const summary = buildPackagePicksSummary({
      packageName: 'P',
      lines: [{ item: line, depth: 0 }],
      allItems: [line],
      removedItemIds: [],
      selection: { picks: { p1: ['p-opt'] } },
      bookingTotalCentavos: 1,
      surchargeCentavos: 0,
    });
    const onScreen = screenNoteForPickedOption(delta);
    const inMessage = summary.lines[0]!.options[0]!.deltaLabel;
    assert.equal(
      inMessage,
      onScreen,
      `delta ${delta}: the message annotation must equal the screen's note`,
    );
    const rendered = formatPackagePicksBlock(summary);
    if (onScreen === null) {
      assert.equal(
        rendered.includes('→ Pick\n') || rendered.endsWith('→ Pick'),
        true,
        'a ₱0 pick must render bare in the message',
      );
      assert.doesNotMatch(
        rendered,
        /your vendor quotes this\)/,
        'a free preference must never invite a quote — the screen presents it as free',
      );
    } else {
      assert.match(rendered, new RegExp(`→ Pick \\(${escapeRe(onScreen)}\\)`));
    }
  }
});

test('PARITY — a FREE pick in the non-chargeable region is rendered bare', () => {
  // The exact shape that used to say "(your vendor quotes this)": a follow-up
  // line whose picked option is ₱0. `isOptionSelectable` guarantees only a
  // zero-delta option can be picked there, so it IS free — and the modal shows
  // no note for it.
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [
      { item: mainCourse, depth: 0 },
      { item: lechonStyle, depth: 1 },
    ],
    allItems: [mainCourse, lechonStyle],
    removedItemIds: [],
    selection: { picks: { i1: ['o-lechon'], i2: ['o-cebu'] } },
    bookingTotalCentavos: 100000,
    surchargeCentavos: 350000,
  });
  assert.deepEqual(summary.lines[1]!.options, [{ label: 'Cebu style', deltaLabel: null }]);
  assert.doesNotMatch(formatPackagePicksBlock(summary), /Cebu style \(/);
});

test('the only surviving "vendor quotes" note is the extra-hours caveat', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [{ item: hourly, depth: 0 }],
    allItems: [hourly],
    removedItemIds: [],
    selection: { picks: {}, extraHours: { i3: 2 } },
    bookingTotalCentavos: 1,
    surchargeCentavos: 0,
  });
  const block = formatPackagePicksBlock(summary);
  assert.match(block, /→ 2 extra hours \(your vendor quotes these\)/);
  // …and that phrasing matches the modal's own hourly caveat ("your vendor
  // quotes these"), which is the only place the screen says it.
});

/* ── the block budget (the 4,000-char chat cap) ───────────────────────── */

test('a huge build is bounded and SAYS it was shortened', () => {
  const many = Array.from({ length: 60 }, (_, i) =>
    item({ item_id: `b${i}`, service_description: `Inclusion number ${i} `.repeat(6).trim() }),
  );
  const summary = buildPackagePicksSummary({
    packageName: 'Enormous Package',
    lines: many.map((m) => ({ item: m, depth: 0 })),
    allItems: many,
    removedItemIds: [],
    selection: { picks: {} },
    bookingTotalCentavos: 99900000,
    surchargeCentavos: 0,
  });
  const block = formatPackagePicksBlock(summary);
  assert.ok(
    block.length < 4000,
    `the block must stay inside the chat body cap — was ${block.length}`,
  );
  assert.match(block, /…and \d+ more lines? — ask us for the full list\./);
  // Truncation never costs the couple the total or the estimate disclaimer.
  assert.match(block, /Estimated total: /);
  assert.match(block, new RegExp(escapeRe(PACKAGE_PICKS_ESTIMATE_NOTE)));
});

test('a normal build is not truncated', () => {
  const summary = buildPackagePicksSummary({
    packageName: 'P',
    lines: [
      { item: coverage, depth: 0 },
      { item: mainCourse, depth: 0 },
    ],
    allItems: [coverage, mainCourse],
    removedItemIds: [],
    selection: { picks: { i1: ['o-lechon'] } },
    bookingTotalCentavos: 100000,
    surchargeCentavos: 350000,
  });
  assert.doesNotMatch(formatPackagePicksBlock(summary), /ask us for the full list/);
});

/* ── 🚨 delivery truth ─────────────────────────────────────────────────── */

test('every core rejection maps to a reason — an unknown code is never success', () => {
  assert.equal(buildNotSentReasonFor('followup_used'), 'followup_used');
  assert.equal(buildNotSentReasonFor('declined'), 'declined');
  assert.equal(buildNotSentReasonFor('contact_blocked'), 'contact_blocked');
  // Everything else — including a code that does not exist yet — degrades to a
  // plain failure rather than silently reading as delivered.
  assert.equal(buildNotSentReasonFor('insert_failed'), 'failed');
  assert.equal(buildNotSentReasonFor('too_long'), 'failed');
  assert.equal(buildNotSentReasonFor('not_member'), 'failed');
  assert.equal(buildNotSentReasonFor('some_future_code'), 'failed');
  assert.equal(buildNotSentReasonFor(''), 'failed');
});

test('no not-sent copy ever claims delivery', () => {
  const reasons = ['followup_used', 'declined', 'contact_blocked', 'failed'] as const;
  for (const reason of reasons) {
    const copy = buildNotSentCopy(reason, 'Acme Studios', 'SERVER TEACHING COPY');
    assert.ok(copy.length > 0, `${reason}: must say something`);
    assert.doesNotMatch(
      copy,
      /\bis in the message\b|\bsent to\b/i,
      `${reason}: must not claim the build reached the vendor`,
    );
  }
});

test('the follow-up-gate copy explains the gate without offering a way round it', () => {
  const copy = buildNotSentCopy('followup_used', 'Acme Studios');
  assert.match(copy, /Acme Studios/);
  assert.match(copy, /hasn’t accepted/);
  assert.match(copy, /follow-up/);
  assert.match(copy, /wasn’t sent/);
  // The gate is deliberate anti-spam — the copy must not hint at a bypass.
  assert.doesNotMatch(copy, /try again|send anyway|resend/i);
});

test('a declined thread is named as closed', () => {
  const copy = buildNotSentCopy('declined', 'Acme Studios');
  assert.match(copy, /declined/);
  assert.match(copy, /closed/);
  assert.match(copy, /wasn’t sent/);
});

test('a contact block surfaces the SERVER’s own teaching copy, verbatim', () => {
  const server =
    'For your safety, phone numbers, emails, and outside-app contacts are not allowed in chat.';
  assert.equal(buildNotSentCopy('contact_blocked', 'Acme Studios', server), server);
  // …and still says something useful if the server sent nothing.
  assert.match(buildNotSentCopy('contact_blocked', 'Acme Studios', ''), /wasn’t sent/);
  assert.match(buildNotSentCopy('contact_blocked', 'Acme Studios', null), /wasn’t sent/);
});

test('a missing vendor label degrades to a sentence that still reads', () => {
  const copy = buildNotSentCopy('failed', '   ');
  assert.match(copy, /This vendor/);
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
