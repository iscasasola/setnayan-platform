'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, Music } from 'lucide-react';
import { adoptPakantaSongAsSiteMusic } from '../actions';
import { useSaveLoader } from '@/components/sd-loader';

/**
 * The one-tap "Use this song on my site" button on the DELIVERED Pakanta state.
 * Shown only when the song hasn't already been adopted (the music team's upload
 * auto-adopts unless the couple set their own song first). On success the page
 * revalidates so the button disappears and the "now playing" note appears.
 */
export function UseSongButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = useSaveLoader();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await save.run(() => adoptPakantaSongAsSiteMusic(eventId), {
        steps: ['Setting your song'],
        hint: 'Saving',
      });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-mulberry px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mulberry/90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <Music aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        Use this song on my site
      </button>
      {error ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-terracotta-700">
          {error}
        </p>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink/55">
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-ink/40" /> Guests will hear it as
          they browse your wedding page.
        </p>
      )}
    </div>
  );
}
