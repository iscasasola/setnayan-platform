'use client';

// Invited-to chip group · client island.
//
// Why this exists:
// The new + edit guest forms are server-rendered with native HTML form
// actions (no client state lift). Until 2026-05-23, the chip defaults
// were a hardcoded `defaultChecked={block === 'ceremony' || block ===
// 'reception'}` — every guest landed on 2 chips regardless of role, so
// hosts had to click into After-party + Rehearsal dinner manually for
// every parent, every bridesmaid, every principal sponsor. With 50-300
// guests on a typical Filipino wedding that's 50-300 wasted clicks per
// event.
//
// Smart-default rule (locked 2026-05-23 PM · `defaultInvitedToForRole`
// in lib/guests.ts): inner-circle roles default to all 5 blocks; rest
// default to ceremony + reception + cocktails. Host can still toggle
// any chip manually.
//
// Implementation:
// - On mount, populate chips from initialBlocks (edit form · existing
//   guest's saved value) OR from defaultInvitedToForRole(initialRole)
//   (new form · no saved value yet).
// - Listen to the role <select> on the same page via document.getElementById
//   + change event. When role changes after mount, snap the chips to
//   the new role's defaults. Host's prior manual toggles on the OLD
//   role get reset — acceptable trade-off because the whole point is
//   the smart default, and host can re-toggle after the snap if they
//   want.
// - Tailwind has-[:checked]: selectors still apply because the
//   underlying DOM input's checked property reflects React's controlled
//   state, so the chip background flips correctly.

import { useEffect, useState } from 'react';
import {
  INVITED_TO_BLOCKS,
  INVITED_TO_LABELS,
  defaultInvitedToForRole,
  type GuestRole,
  type InvitedToBlock,
} from '@/lib/guests';

export function InvitedToChips({
  roleSelectId,
  initialRole,
  initialBlocks,
}: {
  /** DOM id of the role <select> on the same page. Used to wire change events. */
  roleSelectId: string;
  /** Role to compute initial defaults from when initialBlocks is undefined. */
  initialRole: GuestRole;
  /**
   * Existing guest's saved blocks (edit form). Undefined on the new
   * form — chips populate from defaultInvitedToForRole(initialRole)
   * instead.
   */
  initialBlocks?: InvitedToBlock[];
}) {
  const [blocks, setBlocks] = useState<Set<InvitedToBlock>>(
    () => new Set(initialBlocks ?? defaultInvitedToForRole(initialRole)),
  );

  useEffect(() => {
    const select = document.getElementById(roleSelectId) as HTMLSelectElement | null;
    if (!select) return;

    const handler = () => {
      const newRole = select.value as GuestRole;
      setBlocks(new Set(defaultInvitedToForRole(newRole)));
    };

    select.addEventListener('change', handler);
    return () => {
      select.removeEventListener('change', handler);
    };
  }, [roleSelectId]);

  const toggle = (block: InvitedToBlock) => {
    setBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(block)) next.delete(block);
      else next.add(block);
      return next;
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {INVITED_TO_BLOCKS.map((block) => (
        <label
          key={block}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700"
        >
          <input
            type="checkbox"
            name={`invited_${block}`}
            checked={blocks.has(block)}
            onChange={() => toggle(block)}
            className="sr-only"
          />
          {INVITED_TO_LABELS[block]}
        </label>
      ))}
    </div>
  );
}
