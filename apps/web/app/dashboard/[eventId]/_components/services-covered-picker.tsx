'use client';

/**
 * ServicesCoveredPicker — "what services does this cover" for a supplier the
 * couple added themselves. (owner 2026-09-20)
 *
 * Owner, verbatim: *"services covered initially places it to the category you
 * manually added then add more to search more service that might be included
 * on their package."*
 *
 * ── Why a dropdown and not a wall of chips ────────────────────────────────
 * An earlier pass rendered every plan group as a toggle chip. There are 30+,
 * so the couple got a paragraph of pills to hunt through for the two that
 * apply. Since 2026-10-12 it is the house dropdown with checkmarks (PickMenu
 * `picked`; INTERACTION_RULES § 9 — "any set of choices = ONE PickMenu") — it
 * was a hand-made search box with its own floating list. On a phone the list
 * rises as a sheet, so the 30+ groups scroll there, not on the page.
 *
 * ── The seeded chip is a FACT, not a choice ───────────────────────────────
 * The booking's own category is rendered on and un-togglable. It is covered by
 * construction — it is where the couple filed this supplier — so offering to
 * switch it off would offer them a lie. Guarded in the handler as well as by
 * `disabled`, because `aria-pressed` buttons stay keyboard-reachable in some
 * assistive setups.
 *
 * ⚖ AND IT IS NOT SUBMITTED. It is already implied by `event_vendors.category`,
 * and the column keeps meaning "ALSO covers". `bucketForVendor` never takes an
 * ALSO-covered group as the money's home (`isHomeGroupFor`, 2026-09-21 — it used
 * to read `[0]`, which filed a venue that also covers catering under Catering),
 * so dropping an own group a row happened to carry is harmless: the category
 * maps the same bucket.
 *
 * Motion: the dropdown's own (the template's 0.7 s family).
 */

import { useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export type CoverOption = { id: string; label: string };

export function ServicesCoveredPicker({
  options,
  ownGroupId,
  ownGroupLabel,
  initialSelected,
  disabled,
  onChange,
}: {
  /** Every plan group EXCEPT the booking's own — that one is passed separately. */
  options: readonly CoverOption[];
  ownGroupId: string | null;
  ownGroupLabel: string;
  initialSelected: readonly string[];
  disabled?: boolean;
  /** Fires with the ALSO-covers ids only; the own group is never included. */
  onChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(initialSelected.filter((id) => id !== ownGroupId)),
  );

  function commit(next: Set<string>) {
    setSelected(next);
    onChange?.([...next]);
  }

  /** A tick in the dropdown adds the group; a second tick takes it off again. */
  function toggle(id: string) {
    // The own group is never offered, so it can never reach this.
    if (id === ownGroupId) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commit(next);
  }

  const offered = useMemo(() => options.filter((o) => o.id !== ownGroupId), [options, ownGroupId]);
  const chosen = offered.filter((o) => selected.has(o.id));

  // ── THE CONTROLS (INTERACTION_RULES § 9, 2026-10-12) ─────────────────────
  // "Also covers" is ONE dropdown with checkmarks (the house PickMenu's
  // `picked` list — the build plan's "one dropdown → chips"), not a hand-made
  // search box and floating list. What is chosen reads as one line under it;
  // the booking's own category is said there, never offered (it cannot be
  // removed, so it is not a choice).
  return (
    <div className="space-y-2" data-services-covered="">
      {/* The submitted set. The own group is deliberately absent — see docblock. */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="covers" value={id} />
      ))}

      <PickMenu
        label="Services this supplier also covers"
        value={null}
        picked={[...selected]}
        buttonText={chosen.length > 0 ? `Also covers · ${chosen.length}` : 'Add another service they cover'}
        dataAttr="data-also-covers"
        stickyGroups
        options={offered.map((o) => ({ key: o.id, label: o.label }))}
        onPick={(k) => {
          if (!disabled) toggle(k);
        }}
        className="w-full border border-ink/15"
      />

      <p className="flex flex-wrap items-center gap-1 text-[12px] text-ink/60" data-covers-line="">
        {ownGroupId ? (
          <span className="inline-flex items-center gap-1 font-medium text-ink/75" title="This is the category you added them under">
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
            {ownGroupLabel}
          </span>
        ) : null}
        {chosen.length > 0 ? <span>· {chosen.map((o) => o.label).join(' · ')}</span> : null}
      </p>

      {chosen.length > 0 ? (
        <p className="flex items-center gap-1 text-[11.5px] text-ink/50">
          <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
          One booking, one price — counted once across all of these.
        </p>
      ) : null}
    </div>
  );
}
