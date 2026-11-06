'use client';

import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { ReviewerDisplay } from '@/lib/reviews';

/**
 * 🪪 "SHOWN AS" — prototype 6 Nov § 2, the one dropdown above Submit. The couple's full name (`events.display_name`,
 * what every review shows today) or their initials. No anonymous option (owner, 6 Nov). The ✓ Verified booking chip is
 * the platform's and stays either way, so initials still read as real. Posts `reviewer_display`.
 */
export function ShownAsRow({ names, initials }: { names: string; initials: string }) {
  const [display, setDisplay] = useState<ReviewerDisplay>('names');
  return (
    <div className="flex items-center justify-between gap-2.5 border-t border-ink/10 pt-4" data-review-shown-as="">
      <input type="hidden" name="reviewer_display" value={display} />
      <div className="min-w-0 flex-1 text-[15px]">
        Shown as
        <small className="block text-xs text-ink/65">On the card and their page, with ✓ Verified booking</small>
      </div>
      <PickMenu
        label="Shown as"
        value={display}
        options={[
          { key: 'names', label: names },
          { key: 'initials', label: initials },
        ]}
        onPick={(k) => setDisplay(k === 'initials' ? 'initials' : 'names')}
        dataAttr="data-review-shown-as-pick"
        className="shrink-0"
      />
    </div>
  );
}
