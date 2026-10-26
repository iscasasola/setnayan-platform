'use client';

import { useState, type ReactNode } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * /pricing's client pieces (owner 2026-10-25, prototype `pricing_ours_only_2026-10-25` revision 5): Event Hub Pro's
 * "Everything / Just the parts you need" dropdown, and the "Included with every event" group whose last rows open with
 * "See all included ↓" on a phone (on a wide screen every row shows). A set of choices is ONE dropdown — the house
 * `PickMenu`, never a pill row. Every figure arrives as a label the server formatted from `platform_retail_catalog_v2`;
 * nothing here knows a price.
 */

/** The pill's own hairline (prototype `.pick`): the house PickMenu fills `bg-white/70`, which on this page's white
 *  ground would draw a pressable thing with no edge at all. */
const PICK_FRAME = 'border border-ink/10';

/**
 * EVENT HUB PRO · "Everything ▾" — Everything · ₱… / Just the parts you need · from ₱…. Everything shows nothing more
 * (the item's line already says it); the parts body (the eleven `COUPLE_HUB_PART_*` rows, drawn on the server) shows
 * only when picked.
 */
export function HubProWays({
  everythingLabel,
  partsLabel,
  parts,
}: {
  everythingLabel: string;
  /** Null when no part is on sale (or none could be read) — then there is no second way, and no dropdown at all. */
  partsLabel: string | null;
  parts: ReactNode;
}) {
  const [way, setWay] = useState<'all' | 'parts'>('all');
  /* ⛔ Sold whole (owner 2026-10-26, "no more by part as well on the website"): with no part on sale there is ONE way,
     and a dropdown of one is not a choice — the row's own price already says it. */
  if (!partsLabel) return null;
  const options = [
    { key: 'all', label: everythingLabel },
    ...(partsLabel ? [{ key: 'parts', label: partsLabel }] : []),
  ];
  return (
    <div className="col-span-2 mt-2.5" data-hub-ways={way}>
      <PickMenu
        label="Everything, or just the parts you need"
        value={way}
        options={options}
        onPick={(k) => setWay(k === 'parts' ? 'parts' : 'all')}
        dataAttr="data-hub-pick"
        className={PICK_FRAME}
        buttonText={way === 'parts' ? 'Just the parts you need' : 'Everything'}
      />
      {way === 'parts' && partsLabel ? parts : null}
    </div>
  );
}

export type IncludedRow = { name: string; tip: string; what: string };

/** One row of the price list — name with its ⓘ, the figure (or "Included"), the one line under it. */
export function PriceRowShell({
  name,
  tip,
  what,
  figure,
  included = false,
  hiddenUntilOpen = false,
}: {
  name: string;
  tip: string;
  what: string;
  figure: ReactNode;
  included?: boolean;
  hiddenUntilOpen?: boolean;
}) {
  return (
    <li
      className={`${hiddenUntilOpen ? 'hidden lg:grid' : 'grid'} grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 border-t border-ink/10 first-of-type:border-t-0 ${included ? 'py-[11px]' : 'py-[13px]'}`}
      data-included-row={included ? '' : undefined}
    >
      <InfoTip label={name} labelClassName="text-[16.5px] font-semibold tracking-[-0.005em]" align="start">
        {tip}
      </InfoTip>
      <span className={`whitespace-nowrap font-pahina text-terracotta-700 ${included ? 'text-[17px]' : 'text-xl'}`}>{figure}</span>
      <p className="col-start-1 m-0 text-[13.5px] leading-snug text-ink/65">{what}</p>
    </li>
  );
}

/**
 * INCLUDED WITH EVERY EVENT (owner 2026-10-25: "the paid parts look like event hub does not have a free version").
 * The first `shown` rows, then "See all included ↓" opens the rest in place — on a phone only; ≥1024 px draws them all.
 * The word in the price column is "Included", in the same gold serif.
 */
export function IncludedGroup({ rows, shown = 6 }: { rows: readonly IncludedRow[]; shown?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-pricing-included="">
      <p className="m-0 pb-1 pt-5 font-mono text-[10.5px] uppercase leading-none tracking-[0.16em] text-terracotta-700">
        Included with every event
      </p>
      <ul className="m-0 list-none p-0">
        {rows.map((r, i) => (
          <PriceRowShell
            key={r.name}
            name={r.name}
            tip={r.tip}
            what={r.what}
            figure="Included"
            included
            hiddenUntilOpen={!open && i >= shown}
          />
        ))}
      </ul>
      {!open && rows.length > shown ? (
        <button
          type="button"
          className="mt-1 min-h-[44px] bg-transparent p-0 text-sm font-semibold text-terracotta-700 lg:hidden"
          onClick={() => setOpen(true)}
          data-see-all-included=""
        >
          See all included ↓
        </button>
      ) : null}
    </div>
  );
}
