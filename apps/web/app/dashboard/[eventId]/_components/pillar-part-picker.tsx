'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PillarPart } from '@/lib/pillar-parts';

/**
 * PillarPartPicker — the ONE control that moves between a pillar page's parts
 * ("Guests ▾" → Hosts · Check-in, "Your team ▾" → Budget).
 *
 * ⚖ Owner 2026-09-29: the event menu becomes four pillars and "each pillar's
 * page shows its parts"; the menu rows stay plain, so the parts live HERE, in
 * the page, never as a submenu. Which parts exist, and when, is
 * `lib/pillar-parts.ts` — this component decides nothing.
 *
 * It is the shared PickMenu, not a pill row (owner 2026-09-28: "if there are
 * choices, again. us drop down menu"). Picking a part is a navigation to that
 * part's URL, so a refresh, the back button and a shared link all land on the
 * same part.
 */
export function PillarPartPicker({
  label,
  parts,
  current,
}: {
  /** What the control is, for a screen reader ("Guest list part"). */
  label: string;
  parts: readonly PillarPart[];
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2" data-pillar-parts={current} aria-busy={pending || undefined}>
      <PickMenu
        label={label}
        value={current}
        options={parts.map((p) => ({ key: p.key, label: p.label }))}
        onPick={(key) => {
          const next = parts.find((p) => p.key === key);
          if (!next || key === current) return;
          startTransition(() => router.push(next.href));
        }}
        dataAttr="data-pillar-part-pick"
        className="border border-ink/10 text-sm"
      />
      {pending ? (
        <span className="text-xs text-ink/55" aria-live="polite">
          Opening…
        </span>
      ) : null}
    </div>
  );
}
