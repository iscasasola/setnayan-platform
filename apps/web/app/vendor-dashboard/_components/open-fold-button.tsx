'use client';

import { Images, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * A THUMB-ROW BUTTON THAT OPENS A FOLD ON THIS PAGE ("Add what is left" on Your details). It moves the address to
 * `#<anchor>`; the `Fold` with that anchor opens and comes into view — no request, no reload. Pressed again on the
 * same address (the supplier closed the fold meanwhile), the address does not change and the browser sends no
 * `hashchange`, so the button sends one itself.
 */
export function OpenFoldButton({
  anchor,
  label,
  icon = 'plus',
}: {
  anchor: string;
  label: string;
  icon?: 'plus' | 'photo';
}) {
  return (
    <ActionButton
      tone="brand"
      main
      icon={icon === 'photo' ? Images : Plus}
      label={label}
      onClick={() => {
        const target = `#${anchor}`;
        if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
        else window.location.hash = target;
      }}
    />
  );
}
