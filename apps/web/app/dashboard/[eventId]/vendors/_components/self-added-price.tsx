'use client';

/**
 * SelfAddedPrice — "you agreed a price; type it" for a supplier the couple
 * added themselves. (owner 2026-09-20)
 *
 * ── What it replaces ──────────────────────────────────────────────────────
 * The bench card's `needs_price` note: *"Ask for a price to add this to your
 * build."* Correct for a marketplace supplier, who has an inbox. For an
 * off-platform one it names an action with no recipient — nobody is on the
 * other end, no quote can arrive, and the card sits in that state for good.
 * Owner, verbatim: "manual upload can have no requesting. it can be automatic
 * uploaded. these do not need approval. so they can just list manually."
 *
 * ── NOT A SECOND WRITER ───────────────────────────────────────────────────
 * It posts to `updateVendorCosts` — the SAME action the add modal's post-save
 * panel and the workspace Costing editor already use, so `total_cost_php` has
 * one writer and the budget cannot be told two different numbers. This form
 * carries only the price; transport, food allowance and crew live in the
 * workspace Costing editor, which shows all of them together, and the link
 * below points there rather than reproducing them on a 240px card.
 *
 * ⚠ IT POSTS `price_only`, AND THE HISTORY IS WHY. `updateVendorCosts`
 * rewrites every costing column on each call, reading an absent field as null
 * or false. This control first worked around that by echoing transport and
 * food back — and did not echo crew, so every save here silently reset
 * `crew_size` and `crew_meal_covered` (found 2026-09-21). Echoing columns from
 * a caller that does not own them is the bug; `price_only` is the fix.
 */

import Link from 'next/link';
import { useSaveLoader } from '@/components/sd-loader';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import type { KeepAnswer } from '@/lib/form-row';
import { updateVendorCosts } from '../actions';

/**
 * 2026-10-12 look sweep — the price is ONE Form row (`TypedRow`, `INTERACTION_RULES.md` § 9 kind 6): the answer is a
 * pill with a pencil; a tap opens the field across the row with ✕; tapping out or Enter keeps it, ✕ or Esc leaves
 * it. It replaces the hand-made "Add the price you agreed" ghost button and the inline field's ✓ Save price. The
 * row keeps its ₱ and its commas (`amount`), says a wrong number in plain words, and a save that did not land says
 * so with Try again — never a tick.
 */
export function SelfAddedPrice({
  eventId,
  vendorId,
}: {
  eventId: string;
  vendorId: string;
}) {
  const save = useSaveLoader();

  async function keep(digits: string): Promise<KeepAnswer> {
    const n = Number.parseInt(digits, 10);
    try {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      fd.set('total_cost_php', String(Math.round(n)));
      // PRICE ONLY. This control used to echo transport and food back so
      // updateVendorCosts would not blank them — and did NOT echo crew, so
      // every save reset crew_size and crew_meal_covered. The writer now has
      // a price-only mode, which leaves every other column alone.
      fd.set('price_only', '1');
      await save.run(() => updateVendorCosts(fd), {
        steps: ['Saving the price'],
        hint: 'Saving',
      });
      // The action revalidates /vendors, so the card re-renders with the
      // price and this control is replaced by "＋ Add to build".
      return { ok: true };
    } catch {
      return { ok: false, error: 'Try again, or add it from their page.' };
    }
  }

  return (
    <FormRows width="short" data="self-added-price">
      <TypedRow
        name="Price"
        placeholder="Price you agreed"
        value=""
        empty="Add"
        amount
        maxLength={12}
        check={(digits) =>
          Number.parseInt(digits, 10) > 0 ? null : 'Enter the price you agreed, in pesos.'
        }
        onKeep={keep}
        below={
          <Link
            href={`/dashboard/${eventId}/vendors/${vendorId}/workspace`}
            className="vact-inline-price-more block pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            Transport, food &amp; inclusions →
          </Link>
        }
      />
    </FormRows>
  );
}
