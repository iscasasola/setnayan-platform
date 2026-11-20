'use client';

import { useRouter } from 'next/navigation';

/**
 * "Reload" for a seat that could not be read (SeatDoorLine's unreadable line).
 * `router.refresh()` re-runs the page's reads on the server and keeps the guest
 * where they are — the tab they are on, their scroll — which a link back to
 * `/<slug>` would not.
 */
export function SeatReloadButton() {
  const router = useRouter();
  const reload = () => {
    // one-render: keep (retry) — the guest’s Reload on a seat that could not be read; no write came before it.
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={reload}
      className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink/80 underline decoration-ink/30 underline-offset-4 hover:text-ink"
    >
      Reload
    </button>
  );
}
