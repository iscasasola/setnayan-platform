'use client';

/**
 * The shipped filter drawer, opened from Discover — loaded only on the first press of "Filters"
 * (`discover-supplier-controls.tsx`), and drawn on `document.body`.
 *
 * 🪤 WHY THE PORTAL. Discover's content column is `.sn-vt-page`, which carries a `view-transition-name` while the
 * account slide runs — and a named element is the containing block for every `position: fixed` descendant
 * (globals.css, ".sn-vt-page[data-sn-slide='while-sliding']"). The drawer is `fixed inset-0`; from `body` no
 * ancestor can capture it.
 */
import { createPortal } from 'react-dom';

import { FilterDrawer, type FilterDrawerProps } from '@/app/(shell)/explore/_components/filter-drawer';

export function DiscoverFilterSheet({
  drawer,
  onClose,
}: {
  drawer: Omit<FilterDrawerProps, 'open' | 'onClose'>;
  onClose: () => void;
}) {
  return createPortal(<FilterDrawer {...drawer} open onClose={onClose} />, document.body);
}
