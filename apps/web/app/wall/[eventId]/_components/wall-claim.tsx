'use client';

/**
 * Salamisim claim screen — the venue AV person types the 6-char display code
 * the couple generated. Built for a TV/projector context: huge type, one
 * field, one button, zero chrome. On success the display-session cookie is
 * set and the page reloads into the projection.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MonitorPlay } from 'lucide-react';
import { DISPLAY_CODE_LENGTH } from '@/lib/live-wall-logic';

export function WallClaim({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = useCallback(async () => {
    if (busy || code.trim().length < DISPLAY_CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/wall/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, code: code.trim() }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setError(
        res.status === 401
          ? "That code didn't match — codes are single-use; ask the couple to generate a fresh one."
          : 'Something hiccuped — try again.',
      );
    } catch {
      setError('No connection — check the venue network and try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, code, eventId, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-cream">
      <div className="w-full max-w-lg text-center">
        <MonitorPlay aria-hidden className="mx-auto h-10 w-10 text-cream/60" strokeWidth={1.5} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Light up the photo wall</h1>
        <p className="mt-2 text-sm text-cream/60">
          Enter the screen code from the couple&rsquo;s Setnayan dashboard.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void claim();
          }}
          className="mt-6"
        >
          <label htmlFor="wall-code" className="sr-only">
            Screen code
          </label>
          <input
            id="wall-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
            maxLength={DISPLAY_CODE_LENGTH}
            placeholder="ABC234"
            autoComplete="off"
            className="w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-4 text-center font-mono text-4xl tracking-[0.5em] text-cream placeholder:text-cream/20 focus:border-cream/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.length < DISPLAY_CODE_LENGTH}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-mulberry px-6 py-3.5 text-base font-medium text-cream hover:bg-mulberry-600 disabled:opacity-50"
          >
            {busy ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" strokeWidth={2} /> : null}
            Start the wall
          </button>
        </form>
        {error ? <p className="mt-4 text-sm text-terracotta">{error}</p> : null}
      </div>
    </main>
  );
}
