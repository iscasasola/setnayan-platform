'use client';

/**
 * The shipped filter drawer, opened from Discover — loaded only on the first press of "Filters"
 * (`discover-supplier-controls.tsx`), and drawn on `document.body`.
 *
 * 🪤 WHY ON <body> (RiseScreen's portal). Discover's content column is `.sn-vt-page`, which carries a `view-transition-name` while the
 * account slide runs — and a named element is the containing block for every `position: fixed` descendant
 * (globals.css, ".sn-vt-page[data-sn-slide='while-sliding']"). The drawer is `fixed inset-0`; from `body` no
 * ancestor can capture it.
 */
import { FilterDrawerForm, type FilterDrawerProps } from '@/app/(shell)/explore/_components/filter-drawer';
import { RiseScreen, useRiseClose } from '@/app/_components/rise/rise-screen';

export function DiscoverFilterSheet({
  drawer,
  onClose,
}: {
  drawer: Omit<FilterDrawerProps, 'open' | 'onClose'>;
  onClose: () => void;
}) {
  // ⤴ RISE FULL SCREEN (owner 2026-11-10 "fullscreen everything"; #7595's one screen): Filters rises out of the button you
  // tapped and falls back into it. RiseScreen already draws on <body> (its portal), so the `.sn-vt-page` trap above cannot
  // capture it. The form is the drawer's own (`FilterDrawerForm`) — one set of fields, two frames.
  return (
    <RiseScreen title="Filters" fill onClose={onClose} data="discover-filters">
      <RisenFilterForm drawer={drawer} onClose={onClose} />
    </RiseScreen>
  );
}

/** Apply submits the GET form and steps out the same way ✕ does (`useRiseClose`) — never an unmount that skips the fall. */
function RisenFilterForm({ drawer, onClose }: { drawer: Omit<FilterDrawerProps, 'open' | 'onClose'>; onClose: () => void }) {
  const fall = useRiseClose();
  return <FilterDrawerForm {...drawer} onClose={fall ?? onClose} />;
}
