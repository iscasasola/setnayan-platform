'use client';

/**
 * "Download printable" — fetches the one-page printable Mood Board PDF and
 * triggers a download, with a busy state for feedback during the ~1s server
 * render (2026-06-28). Mirrors concept-pdf-button's download mechanics, but
 * points at the lighter print-pdf route (palette + reception summary only).
 */

import { useState } from 'react';
import { Printer } from 'lucide-react';

function safeFile(name: string): string {
  const base = (name || 'Wedding').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `Mood-Board-${base || 'Wedding'}.pdf`;
}

export function PrintablePdfButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/dashboard/${eventId}/studio/mood-board/print-pdf`);
      if (res.status === 401) {
        setError('Your session expired — please refresh and sign in again.');
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFile(eventName ?? '');
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Defer the revoke: iOS Safari and some in-app webviews read the blob
      // asynchronously, so revoking on the next tick silently aborts the save.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      setError('Could not generate the PDF — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white px-5 py-2.5 text-sm font-medium text-ink transition hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <>
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/30 border-t-ink"
            />
            Preparing your PDF…
          </>
        ) : done ? (
          <>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
            Saved to your downloads
          </>
        ) : (
          <>
            <Printer className="h-4 w-4" aria-hidden />
            Download printable (PDF)
          </>
        )}
      </button>
      <p aria-live="polite" className="sr-only">
        {busy
          ? 'Preparing your PDF'
          : done
            ? 'Your printable mood board was saved to your downloads'
            : ''}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
