/**
 * A SELF-ADDED SUPPLIER'S CARD: TAP FOR DETAILS, [Connect] FOR THEIR PORTAL.
 * (owner 2026-09-21)
 *
 *   "pressing on the card will open the details then. until there is a vendor"
 *   "since clicking a card will open the vendor-user connection"
 *   "create a way for the user to give the vendor a portal to connect this to
 *    their new account"
 *
 * The resolver's truth table is executed in `lib/bench-card-actions.test.ts`.
 * These are the halves a resolver test cannot see — that the answer actually
 * reaches the screen — and each is pinned because it has ALREADY failed once:
 *
 *  1. The rail decides whether to draw the action row by asking "any action?".
 *     That check predated `connect`, so a LOCKED self-added card (whose only
 *     action is Connect) was judged empty and drew nothing — while every
 *     resolver test passed.
 *  2. The tap override is keyed on `actions.connect`, so flag-OFF stays
 *     byte-identical and ONE value decides both the button and the tap.
 *  3. Opening [Connect] must only READ. Minting a claim link because a couple
 *     looked would put rows in `vendor_invites` nobody asked for.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAIL = stripComments(readFileSync(path.join(HERE, 'shortlist-categories.tsx'), 'utf8'));
const ACTIONS = stripComments(readFileSync(path.join(HERE, 'bench-vendor-actions.tsx'), 'utf8'));
const CONNECT_MODAL = stripComments(
  readFileSync(path.join(HERE, '..', '..', '_components', 'connect-supplier-modal.tsx'), 'utf8'),
);

describe('the self-added card', () => {
  it('found real source to read', () => {
    for (const [name, src] of [['rail', RAIL], ['actions', ACTIONS], ['connect modal', CONNECT_MODAL]] as const) {
      assert.ok(src.length > 500, `${name} source looks empty after stripping — re-point this guard`);
    }
  });

  it('counts [Connect] as an action, so a locked self-added card is not drawn bare', () => {
    // The "nothing to offer" test, isolated so a mention elsewhere cannot
    // satisfy it.
    const m = RAIL.match(/!actions\s*\|\|\s*\(([^)]*)\)/);
    assert.ok(m, 'could not find the "nothing to offer" condition in the rail');
    assert.match(
      m![1]!,
      /!actions\.connect/,
      'the rail\'s "any action?" check no longer includes connect — a LOCKED ' +
        'self-added card (whose only action is [Connect]) would render with no ' +
        'buttons at all, and every resolver test would still pass.',
    );
  });

  it('renders the [Connect] button from the resolved action', () => {
    assert.match(ACTIONS, /actions\.connect\s*\?/, 'BenchVendorActions no longer renders [Connect]');
    assert.match(ACTIONS, /<ConnectSupplierModal\b/, 'the Connect button opens nothing');
  });

  it('opens the details sheet on tap — keyed on the same value as [Connect]', () => {
    assert.match(RAIL, /const selfAdded = Boolean\(actions\?\.connect\)/);
    assert.match(
      RAIL,
      /selfAdded \? \{ onClick: openDetails/,
      'the card tap is no longer overridden for a self-added supplier',
    );
    assert.match(RAIL, /edit=\{details\}/, 'the details sheet is not mounted in edit mode');
    assert.match(RAIL, /loadSelfAddedSupplier\(eventId, v\.vendorId\)/);
  });

  it('keeps new-tab and modified clicks going to the full page', () => {
    // Replacing the trigger's click must not swallow ⌘/Ctrl-click or a middle
    // click — those still mean "open this somewhere else".
    assert.match(RAIL, /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey \|\| e\.button !== 0/);
  });

  it('opening [Connect] only reads — it never mints a link by itself', () => {
    assert.match(CONNECT_MODAL, /readSupplierInvite\(/, 'the Connect modal no longer reads the existing link');
    assert.doesNotMatch(
      CONNECT_MODAL,
      /createManualVendorInvite/,
      'the Connect modal calls the invite WRITER on its own — opening it to look ' +
        'would create a vendor_invites row. Only the panel\'s "Create their link" ' +
        'button may.',
    );
  });
});
