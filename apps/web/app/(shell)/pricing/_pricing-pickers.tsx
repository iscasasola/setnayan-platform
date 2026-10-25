'use client';

import { useState, type ReactNode } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * /pricing's two dropdowns (owner 2026-10-25, approved prototype `pricing_free_plus_addons_2026-10-25`, revision 4).
 * A set of choices is ONE dropdown — the house `PickMenu`, never a pill row. Every figure arrives as a label the
 * server formatted from `platform_retail_catalog_v2`; nothing here knows a price.
 */

/** The pill's own hairline (prototype `.pick`): the house PickMenu fills `bg-white/70`, which on this page's white
 *  ground would draw a pressable thing with no edge at all. */
const PICK_FRAME = 'border border-ink/10';

/**
 * EVENT HUB PRO · "Get it as ▾ Everything · ₱… / Just the parts you need · from ₱…" — the two bodies are drawn on the
 * server (what Everything gives · the eleven `COUPLE_HUB_PART_*` rows) and this only shows the one picked.
 */
export function HubProWays({
  everythingLabel,
  partsLabel,
  everything,
  parts,
}: {
  everythingLabel: string;
  /** Null when no part could be read — then there is no second way to offer. */
  partsLabel: string | null;
  everything: ReactNode;
  parts: ReactNode;
}) {
  const [way, setWay] = useState<'all' | 'parts'>('all');
  const options = [
    { key: 'all', label: everythingLabel },
    ...(partsLabel ? [{ key: 'parts', label: partsLabel }] : []),
  ];
  return (
    <div className="mt-3" data-hub-ways={way}>
      <p className="mb-1.5 text-[12.5px] text-ink/65">Get it as</p>
      <PickMenu
        label="Everything, or just the parts you need"
        value={way}
        options={options}
        onPick={(k) => setWay(k === 'parts' ? 'parts' : 'all')}
        dataAttr="data-hub-pick"
        className={PICK_FRAME}
      />
      <div className="mt-1">{way === 'parts' && partsLabel ? parts : everything}</div>
    </div>
  );
}

export type AiTypeOption = {
  key: string;
  /** "wedding" · "debut, corporate or gala" … */
  label: string;
  /** The row's regular price, formatted ("₱2,499"). */
  regular: string;
  /** Its sign-up price when the row carries a lower one, else null. */
  signup: string | null;
};

/**
 * SETNAYAN AI · priced by event type — the item whose figure follows the "For a ▾ wedding" dropdown. Each option is
 * one catalogue row (`AI_TIER_SKU`: SETNAYAN_AI · _B · _C · _D) read through the shared two-price resolver.
 */
export function AiTypeItem({
  name,
  tip,
  what,
  bill,
  options,
}: {
  name: string;
  tip: ReactNode;
  what: string;
  bill: string;
  options: readonly AiTypeOption[];
}) {
  const [key, setKey] = useState(options[0]?.key ?? '');
  const picked = options.find((o) => o.key === key) ?? options[0];
  if (!picked) return null;
  return (
    <li className="border-t border-ink/10 pb-[15px] pt-4" data-pricing-item="SETNAYAN_AI">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <InfoTip label={name} labelClassName="text-[17px] font-semibold leading-tight tracking-[-0.01em]" align="start">
            {tip}
          </InfoTip>
          <p className="mt-[3px] text-[13.5px] leading-snug text-ink/65">{what}</p>
          {options.length > 1 ? (
            <div className="mt-2">
              <PickMenu
                label="Event type"
                value={picked.key}
                options={options.map((o) => ({ key: o.key, label: o.label }))}
                onPick={setKey}
                dataAttr="data-ai-pick"
                className={PICK_FRAME}
                buttonText={`For a ${picked.label}`}
              />
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <span className="block whitespace-nowrap text-[19px] font-bold leading-none tracking-[-0.02em]" data-ai-php="">
            {picked.regular}
          </span>
          <span className="mt-1 block whitespace-nowrap text-[11px] text-ink/65">{bill}</span>
        </div>
      </div>
      {picked.signup ? (
        <p className="mt-[9px] text-[13px] leading-snug text-ink" data-ai-launch="">
          <b className="font-bold text-mulberry">{picked.signup} while you set up your event</b> — {picked.regular} after.
        </p>
      ) : null}
    </li>
  );
}
