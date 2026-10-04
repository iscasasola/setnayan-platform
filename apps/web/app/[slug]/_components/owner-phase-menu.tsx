'use client';

import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { OwnerRibbonPhaseLink, OwnerRibbonSeeAsLink } from '@/lib/owner-ribbon';

/**
 * THE HOST'S "PREVIEW ▾" — ONE dropdown, not a row of four pills (owner
 * 2026-10-03, on the live Event Hub: "too many buttons. too much going on";
 * BUILD_PROMPTS rule: 3+ choices are ONE PickMenu, never a pill row).
 *
 * 👁 …AND IT IS THE MAKER'S PREVIEW (PR-10, coordinator 2026-10-04: "one
 * preview mechanism"): the stages, then See as — the SAME states as the
 * Maker's 👁 Preview (`SEE_AS`, lib/see-as.ts), each a `?as=` address the guest
 * page draws for a sample viewer. Both groups in this one list.
 *
 * It draws the links `buildOwnerRibbon` already decided (lib/owner-ribbon.ts)
 * and settles nothing: picking one opens that address. Host-only — the ribbon
 * renders for a verified host of THIS event and nobody else.
 */
const STAGE = 'stage:';
const AS = 'as:';

export function OwnerPhaseMenu({
  links,
  seeAs,
}: {
  links: readonly OwnerRibbonPhaseLink[];
  seeAs: readonly OwnerRibbonSeeAsLink[];
}) {
  const router = useRouter();
  const active = links.find((l) => l.active) ?? null;
  const viewer = seeAs.find((l) => l.active && l.key !== 'you') ?? null;
  const words = [active ? active.label : null, viewer ? viewer.label : null].filter(Boolean).join(' · ');
  return (
    <PickMenu
      label="Preview"
      value={active ? `${STAGE}${active.phase}` : null}
      buttonText={words ? `Preview: ${words}` : 'Preview'}
      options={[
        ...links.map((l) => ({ key: `${STAGE}${l.phase}`, label: l.label, group: 'Stage' })),
        ...seeAs.map((l) => ({
          key: `${AS}${l.key}`,
          label: l.label,
          group: 'See as',
          ...(l.active ? { trail: { text: '✓', tone: 'ok' as const, label: 'shown now' } } : {}),
        })),
      ]}
      onPick={(key) => {
        const to = key.startsWith(STAGE)
          ? links.find((l) => `${STAGE}${l.phase}` === key)
          : seeAs.find((l) => `${AS}${l.key}` === key);
        if (to && !to.active) router.push(to.href);
      }}
      dataAttr="data-owner-phase-menu"
      compact
      className="border border-ink/15 bg-cream text-xs text-ink/75"
    />
  );
}
