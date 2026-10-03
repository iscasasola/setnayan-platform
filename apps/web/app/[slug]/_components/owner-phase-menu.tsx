'use client';

import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { OwnerRibbonPhaseLink } from '@/lib/owner-ribbon';

/**
 * THE HOST'S "PREVIEW ▾" — ONE dropdown, not a row of four pills (owner
 * 2026-10-03, on the live Event Hub: "too many buttons. too much going on";
 * BUILD_PROMPTS rule: 3+ choices are ONE PickMenu, never a pill row).
 *
 * It draws the links `buildOwnerRibbon` already decided (lib/owner-ribbon.ts)
 * and settles nothing: picking one opens that phase's `?phase=` address, the
 * same URL each pill linked to. Host-only — the ribbon renders for a verified
 * host of THIS event and nobody else, so a guest never loads this.
 */
export function OwnerPhaseMenu({ links }: { links: readonly OwnerRibbonPhaseLink[] }) {
  const router = useRouter();
  const active = links.find((l) => l.active) ?? null;
  return (
    <PickMenu
      label="Preview a stage"
      value={active?.phase ?? null}
      buttonText={active ? `Preview: ${active.label}` : 'Preview'}
      options={links.map((l) => ({ key: l.phase, label: l.label }))}
      onPick={(key) => {
        const to = links.find((l) => l.phase === key);
        if (to && !to.active) router.push(to.href);
      }}
      dataAttr="data-owner-phase-menu"
      compact
      className="border border-ink/15 bg-cream text-xs text-ink/75"
    />
  );
}
