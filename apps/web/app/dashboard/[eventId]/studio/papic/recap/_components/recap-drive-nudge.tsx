'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudUpload, Heart, X } from 'lucide-react';
import { DriveSafetyPanel } from '@/app/_components/drive-connect-card';

/**
 * Recap "save the originals" nudge (0012). The emotional point of need — a
 * couple finishing/publishing their recap is in "keep this forever" mode. A
 * calm, dismissible champagne-gold card (gold, not mulberry — aspirational,
 * not urgent) offering to also drop the full-resolution originals into a Drive
 * folder they own. Never blocks the recap; the recap always lives in Setnayan.
 *
 * Rendered by the server only when the recap has real content AND no live Drive
 * grant exists AND Drive OAuth is configured — so connecting here also lights up
 * Photo Delivery + the Papic storage copy (one per-event grant).
 *
 * Dismiss is event-scoped + persisted in localStorage: one dismissal hides it
 * for this event (a clean opt-out, never a re-show-every-visit nag). A mounted
 * gate avoids a flash before we can read the dismissal.
 */
export function RecapDriveNudge({
  eventId,
  connectHref,
}: {
  eventId: string;
  connectHref: string;
}) {
  const storageKey = `sn-drive-recap-nudge-dismissed:${eventId}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== '1') setVisible(true);
    } catch {
      // localStorage unavailable (private mode etc.) — show by default.
      setVisible(true);
    }
  }, [storageKey]);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore — worst case the nudge reappears next visit
    }
    setVisible(false);
  }

  return (
    <aside
      aria-label="Save your recap originals to Google Drive"
      className="relative space-y-3 rounded-2xl border border-gold/30 bg-gold/5 p-5 sm:p-6"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/70"
      >
        <X aria-hidden className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
          <Heart aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">
            Love this? Save the originals to your Drive
          </h2>
          <p className="max-w-prose text-sm text-ink/70">
            Your recap lives beautifully here in Setnayan and stays for years.
            If you&rsquo;d also like the full-resolution photos and clips in a
            folder you own, connect your Google Drive and we&rsquo;ll tuck them
            away for keeps.
          </p>
        </div>
      </div>

      <DriveSafetyPanel variant="condensed" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={connectHref}
          className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          <CloudUpload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Save originals to my Drive
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="text-sm font-medium text-ink/55 underline-offset-2 hover:text-ink/80 hover:underline"
        >
          Maybe later
        </button>
      </div>
    </aside>
  );
}
