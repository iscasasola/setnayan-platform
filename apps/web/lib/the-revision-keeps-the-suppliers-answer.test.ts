import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { openingGiftSwitch, defaultQuoteSwitch } from '@/lib/papic-on-a-quote';
import {
  seedQuoteRevision,
  QUOTE_REVISION_SELECT,
  type QuoteRevisionSource,
} from '@/lib/quote-revision-seed';

/**
 * "UPDATE THIS QUOTE" MUST NOT THROW AWAY THE SUPPLIER'S OWN GIFT ANSWER.
 *
 * The answer was written on send (`vendor_proposals.includes_setnayan_gift`)
 * and then never asked for again, so a revision silently reopened at the
 * CARD's answer. Same disease as the send-path defect: a decision is made, the
 * product discards it, nothing errors.
 *
 * It was discarded at three layers, and only the deepest one decides the shape
 * of the fix:
 *   1. the query never selected the column  ← a UI-only fix cannot reach this
 *   2. the seed had nowhere to put it
 *   3. the builder never read it
 *
 * Layer 1 lives in a server component, which a unit test can never import. So
 * the column list is a CONSTANT in the pure module and this file EXECUTES it —
 * the thing that can be got wrong was moved somewhere it can be run.
 */

const ROW: QuoteRevisionSource = {
  public_id: 'S89Q-0000000001',
  title: 'Coverage',
  total_centavos: 4_500_00,
  status: 'sent',
  sent_at: '2026-09-01T00:00:00Z',
  rendered_body: 'note',
  valid_until: '2026-10-01',
  line_items: [{ label: 'Coverage', amount_centavos: 4_500_00 }],
  payment_method_ids: ['pm_1'],
  payment_schedule: null,
  includes_setnayan_gift: null,
};

test('1 · the current booking decides IF there is a switch — the old quote only decides its VALUE', () => {
  // THE DEFECT, stated as a case: the supplier turned the gift OFF on the quote
  // they sent; their cards say ON. Reopening must respect the supplier.
  assert.equal(
    openingGiftSwitch({ revisionAnswer: false, cardsAnswer: true }),
    false,
    'a revision reopened at the CARD answer and discarded the supplier\'s own OFF',
  );
  assert.equal(openingGiftSwitch({ revisionAnswer: true, cardsAnswer: false }), true);

  // NULL is a real answer meaning "that quote said nothing" — fall through.
  assert.equal(openingGiftSwitch({ revisionAnswer: null, cardsAnswer: true }), true);
  assert.equal(openingGiftSwitch({ revisionAnswer: null, cardsAnswer: false }), false);

  // Not a revision at all: identical to the behaviour before this existed.
  assert.equal(openingGiftSwitch({ revisionAnswer: undefined, cardsAnswer: true }), true);
  assert.equal(openingGiftSwitch({ revisionAnswer: undefined, cardsAnswer: false }), false);
});

test('2 · a booking that offers no switch cannot have one resurrected by an old quote', () => {
  // Waived fee, imported client, dark fee system, unreadable ladder — all of
  // these make `defaultQuoteSwitch` answer null, and a gift cannot be conjured
  // out of them. Answering the old quote FIRST would fail in the direction
  // that costs the supplier money.
  for (const revisionAnswer of [true, false, null, undefined] as const) {
    assert.equal(
      openingGiftSwitch({ revisionAnswer, cardsAnswer: null }),
      null,
      `an old answer of ${String(revisionAnswer)} resurrected a switch on a booking that offers none`,
    );
  }

  // and that null is the one the live resolver really produces
  assert.equal(defaultQuoteSwitch({ kind: 'silent' }), null);
});

test('3 · the seed carries the supplier\'s answer, not the card\'s', () => {
  assert.equal(seedQuoteRevision({ ...ROW, includes_setnayan_gift: false }).giftSwitch, false);
  assert.equal(seedQuoteRevision({ ...ROW, includes_setnayan_gift: true }).giftSwitch, true);
  assert.equal(seedQuoteRevision({ ...ROW, includes_setnayan_gift: null }).giftSwitch, null);
  // a row that never selected the column at all must read as "nothing said",
  // never as a confident false
  const { includes_setnayan_gift: _drop, ...without } = ROW;
  assert.equal(seedQuoteRevision(without as QuoteRevisionSource).giftSwitch, null);
});

test('4 · the SELECT asks for every column the seed reads — measured, not re-listed', () => {
  // A second hand-written list of columns would rot against the first. Instead
  // we RECORD what `seedQuoteRevision` actually touches and require the select
  // to cover it, so a future field cannot be added to the seed and forgotten
  // in the query — which is exactly how the gift answer was lost.
  const touched = new Set<string>();
  const spy = new Proxy(ROW as Record<string, unknown>, {
    get(target, key) {
      if (typeof key === 'string') touched.add(key);
      return Reflect.get(target, key);
    },
    has: (t, k) => Reflect.has(t, k),
  }) as unknown as QuoteRevisionSource;
  seedQuoteRevision(spy);

  assert.ok(touched.size >= 8, `the spy recorded only ${touched.size} reads — it did not run`);
  const selected = QUOTE_REVISION_SELECT.split(',').map((c) => c.trim());
  for (const col of touched) {
    assert.ok(
      selected.includes(col),
      `seedQuoteRevision reads "${col}" but QUOTE_REVISION_SELECT never asks for it — ` +
        'the value arrives undefined and the builder silently falls back',
    );
  }
  // the column this whole file exists for
  assert.ok(selected.includes('includes_setnayan_gift'));
});

test('5 · the page selects with the shared constant, not a private column list', () => {
  // Layer 1 is in a server component; this is the one assertion that can only
  // be made by reading source. It asserts the MECHANISM is used, rather than
  // banning any particular spelling of a literal.
  const page = readFileSync(
    join(process.cwd(), 'app/vendor-dashboard/messages/[threadId]/page.tsx'),
    'utf8',
  );
  assert.match(
    page,
    /\.select\(QUOTE_REVISION_SELECT\)/,
    'the live-quote read stopped using the shared column list — a column can now be ' +
      'dropped there without any test noticing',
  );
  assert.match(page, /QUOTE_REVISION_SELECT,?\s*$/m, 'and it must import the constant');
});

test('6 · the builder opens the switch through the revision, not the card alone', () => {
  // Layer 3. `proposal-maker.tsx` is a client component, so this is source
  // again — but the window is pinned to the giftSwitch initializer itself, not
  // to the file, so a mention of the symbol elsewhere cannot satisfy it.
  const src = readFileSync(join(process.cwd(), 'app/_components/proposal-maker.tsx'), 'utf8');
  const start = src.indexOf('const [giftSwitch, setGiftSwitch]');
  assert.ok(start > 0, 'the giftSwitch state moved or was renamed — re-point this guard');
  const end = src.indexOf('\n  );', start);
  assert.ok(end > start, 'could not find the end of the initializer');
  const init = src.slice(start, end);

  assert.match(
    init,
    /openingGiftSwitch\(/,
    'the switch went back to opening at the cards alone — a revision now discards the ' +
      "supplier's own answer again",
  );
  assert.match(
    init,
    /revisionAnswer:\s*revision\?\.giftSwitch/,
    'the initializer calls openingGiftSwitch but never hands it the replaced quote\'s answer, ' +
      'so the revision is still thrown away',
  );
  assert.match(init, /cardsAnswer:\s*defaultQuoteSwitch\(/, 'and the cards must still be asked');
});
