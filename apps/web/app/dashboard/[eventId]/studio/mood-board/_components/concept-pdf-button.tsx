'use client';

/**
 * "Download your concept book" — fetches the concept PDF route and triggers a
 * download, with a busy state so the couple gets feedback during the ~2s
 * server-side render (scene rasterization + inspiration fetches + pdf-lib).
 * Owner directive 2026-06-09 (concept PDF: Result + inspirations + template).
 */

import { useState } from 'react';

function safeFile(name: string): string {
  const base = (name || 'Wedding').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `Concept-${base || 'Wedding'}.pdf`;
}

export function ConceptPdfButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
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
      const res = await fetch(`/dashboard/${eventId}/studio/mood-board/concept-pdf`);
      if (res.status === 401) {
        setError('Your session expired — please refresh and sign in again.');
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFile(eventName);
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
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <>
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream/40 border-t-cream"
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
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Download concept book (PDF)
          </>
        )}
      </button>
      <p aria-live="polite" className="sr-only">
        {busy ? 'Preparing your PDF' : done ? 'Your concept book was saved to your downloads' : ''}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
