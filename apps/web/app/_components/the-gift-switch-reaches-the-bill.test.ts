/**
 * the-gift-switch-reaches-the-bill.test.ts — the switch the supplier flips in
 * the composer is the one the database reads, and every surface between them
 * carries it.
 *
 * ⚖ OWNER, 2026-09-22, clicking the control drawn DISABLED in the approved
 * prototype: **"We want this working."**
 *
 * The RULE (which arm a switch leaves behind, what it opens at) is executed in
 * `lib/the-exclusive-papic-on-a-quote.test.ts`; the DATABASE half (the accepted
 * quote beating the card, a stranger's quote refused, the bill sized from the
 * same answer) in `tests/db/the-gift-switch-is-on-the-quote.db.test.ts`. This
 * file pins the CHAIN — the part neither can see: composer → payload → action →
 * send core → column.
 *
 * 🔑 A break anywhere in that chain is silent. The switch would render, flip,
 * and change nothing — which is exactly the state the owner asked to end.
 *
 * 🛡 Sabotages watched red: the payload dropping `includesSetnayanGift`; the
 * action defaulting a missing value to `false` instead of null; the composer
 * pricing the gift block from the unswitched standing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const maker = readFileSync(join(ROOT, 'app/_components/proposal-maker.tsx'), 'utf8');
const action = readFileSync(join(ROOT, 'app/vendor-dashboard/messages/[threadId]/proposal-actions.ts'), 'utf8');
const send = readFileSync(join(ROOT, 'lib/proposal-send.ts'), 'utf8');
const migration = readFileSync(
  join(ROOT, '..', '..', 'supabase/migrations/20271240324859_the_gift_switch_is_on_the_quote.sql'),
  'utf8',
);
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

test('the composer mounts ONE switch, and only where there is a question to answer', () => {
  assert.equal(count(maker, /data-testid="quote-setnayan-gift-switch"/g), 1);
  const at = maker.indexOf('data-testid="quote-setnayan-gift-switch"');
  const gate = maker.slice(Math.max(0, at - 300), at);
  assert.match(gate, /giftSwitch !== null \?/, 'no switch on a booking that cannot carry a gift');
  assert.match(maker, /useState<boolean \| null>\(\(\) =>\s*defaultQuoteSwitch\(/, 'it opens at what the booking says');
  // the Papic line's own "switch it on" link lands ON that control
  assert.match(maker, /id="quote-setnayan-gift-switch"/);
});

test('the gift block and the Papic line are priced from the SWITCHED standing — not the card\'s', () => {
  assert.match(maker, /standingForQuoteSwitch\(papicStanding, giftSwitch\)/);
  assert.match(
    maker,
    /papicTopUpForQuote\(switchedStanding, netPayable\)/,
    'the Papic line follows the switch',
  );
  const giftBlock = maker.slice(maker.indexOf('const gift = useMemo('), maker.indexOf('const giftCopy ='));
  assert.match(giftBlock, /switchedStanding/, 'the photo count follows the switch too');
  assert.doesNotMatch(
    giftBlock,
    /previewGiftForTotal\(netPayable, giftBasis\)\s*,/,
    'the unswitched basis is no longer what the couple is promised from',
  );
  // sabotage: revert either to `papicStanding` / `giftBasis` → RED
});

test('the payload carries the switch, the action reads it, and the send core writes the column', () => {
  assert.match(maker, /includesSetnayanGift: giftSwitch,/, 'the composer sends it');
  assert.match(action, /includesSetnayanGift\?: boolean \| null;/, 'the action\'s payload shape admits it');
  assert.match(
    action,
    /typeof parsed\.includesSetnayanGift === 'boolean' \? parsed\.includesSetnayanGift : null/,
    'anything that is not a real boolean leaves the CARD deciding — never a silent "off"',
  );
  assert.match(action, /\n\s+includesSetnayanGift,\n/, 'and it reaches sendCustomProposalCore');
  assert.match(send, /includesSetnayanGift\?: boolean \| null;/, 'the core accepts it');
  assert.match(
    send,
    /includes_setnayan_gift: input\.includesSetnayanGift \?\? null,/,
    'and persists it, with null meaning "the quote says nothing"',
  );
  // sabotage: `?? false` in the send core → RED (it would retract the card's gift)
});

test('the migration is the source of truth: nullable, no default, quote before card, same-supplier on BOTH arms', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS includes_setnayan_gift BOOLEAN;/);
  assert.doesNotMatch(migration, /includes_setnayan_gift BOOLEAN NOT NULL/, 'a NOT NULL DEFAULT records a decision nobody made');
  const fn = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.setnayan_gift_offered_on'));
  // the quote arm is FIRST inside the COALESCE, the card second
  assert.ok(
    fn.indexOf('public.vendor_proposals vp') < fn.indexOf('public.vendor_services vs'),
    'the accepted quote is read BEFORE the card',
  );
  assert.match(fn, /vp\.vendor_profile_id = ev\.marketplace_vendor_id/, 'a stranger\'s quote cannot switch this booking');
  assert.match(fn, /vs\.vendor_profile_id = ev\.marketplace_vendor_id/, 'the card arm keeps its own guard');
  assert.match(fn, /vp\.status = 'accepted'/, 'only what the couple accepted decides the bill');
  assert.match(fn, /vp\.includes_setnayan_gift IS NOT NULL/, 'NULL means the quote says nothing');
});

test('the "does not govern your bill" copy is GONE — copy that outlives its condition teaches something false', () => {
  const papic = readFileSync(join(ROOT, 'lib/papic-on-a-quote.ts'), 'utf8');
  for (const src of [maker, papic]) {
    assert.doesNotMatch(src, /does not yet govern/i);
    assert.doesNotMatch(src, /later wave/i);
  }
  assert.doesNotMatch(papic, /This service card does not offer it yet/, 'the card is no longer the thing to change');
  assert.match(papic, /The switch above is (on|off)/, 'the copy names the control the supplier actually has');
});
