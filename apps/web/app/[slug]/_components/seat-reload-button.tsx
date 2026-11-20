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
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink/80 underline decoration-ink/30 underline-offset-4 hover:text-ink"
    >
      Reload
    </button>
  );
}
