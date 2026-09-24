/**
 * Event Hub Pro includes the logo animation (owner ruling 2026-09-24, "A then").
 *
 * The alias in lib/entitlements.ts makes a Pro couple OWN ANIMATED_MONOGRAM, so
 * the Monogram Maker hides its ₱500 "Unlock Animation & Apply" button. This
 * suite holds the other half: the owned state SAYS why ("Included with Event
 * Hub Pro"), and only to a couple for whom it is true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  animatedMonogramIncludedNote,
  eventGetsAnimatedMonogramFromHubPro,
  eventOwnsAnimatedMonogram,
  INCLUDED_WITH_HUB_PRO,
} from '@/lib/animated-monogram';

/** Orders stub: an ownership query "hits" when any queried service_key is owned. */
function ordersOwning(owned: Set<string>, status = 'submitted'): SupabaseClient {
  let keys: string[] | null = null;
  const b: Record<string, unknown> = {
    from: () => b,
    select: () => b,
    eq: () => b,
    not: () => b,
    in(col: string, vals: unknown) {
      if (col === 'service_key' && Array.isArray(vals)) keys = vals as string[];
      return b;
    },
    then(resolve: (v: unknown) => unknown) {
      const data = keys && keys.some((k) => owned.has(k)) ? [{ status }] : [];
      keys = null;
      return Promise.resolve({ data, error: null }).then(resolve);
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return b as unknown as SupabaseClient;
}

test('the owned note says "Included with Event Hub Pro" only when owned AND Pro', () => {
  assert.equal(INCLUDED_WITH_HUB_PRO, 'Included with Event Hub Pro');
  assert.equal(animatedMonogramIncludedNote(true, true), INCLUDED_WITH_HUB_PRO);
  // Bought the ₱500 standalone — must not be told it came with Pro.
  assert.equal(animatedMonogramIncludedNote(true, false), null);
  // Not owned — the buy button is showing; no note.
  assert.equal(animatedMonogramIncludedNote(false, false), null);
  assert.equal(animatedMonogramIncludedNote(false, true), null);
});

test('a Pro couple resolves as owning the animation, and as getting it from Pro', async () => {
  const pro = ordersOwning(new Set(['COUPLE_WEBSITE_PRO']));
  const owned = await eventOwnsAnimatedMonogram(pro, 'evt_1');
  assert.equal(owned, true);
  const viaPro = await eventGetsAnimatedMonogramFromHubPro(pro, 'evt_1');
  assert.equal(animatedMonogramIncludedNote(owned, viaPro), INCLUDED_WITH_HUB_PRO);
});

test('a ₱500-only couple owns the animation but is not told it came with Pro', async () => {
  const solo = ordersOwning(new Set(['ANIMATED_MONOGRAM']));
  const owned = await eventOwnsAnimatedMonogram(solo, 'evt_1');
  assert.equal(owned, true);
  assert.equal(
    animatedMonogramIncludedNote(owned, await eventGetsAnimatedMonogramFromHubPro(solo, 'evt_1')),
    null,
  );
});

test('a couple with neither is still offered the ₱500 animation', async () => {
  const none = ordersOwning(new Set());
  assert.equal(await eventOwnsAnimatedMonogram(none, 'evt_1'), false);
});

test('the maker threads the note to the owned state (and only there)', () => {
  const dir = join(process.cwd(), 'app/dashboard/[eventId]/monogram');
  const page = readFileSync(join(dir, 'page.tsx'), 'utf8');
  const rows = readFileSync(join(dir, 'animate-rows.tsx'), 'utf8');
  // The page computes the note from the same ownership that hides the buy.
  assert.match(page, /animatedMonogramIncludedNote\(\s*ownsAnimated,/);
  assert.match(page, /includedNote=\{includedNote\}/);
  // The row renders it gated on `owned`, so an unowned couple never sees it
  // beside a buy button.
  assert.match(rows, /\{owned && includedNote \? \(/);
});
