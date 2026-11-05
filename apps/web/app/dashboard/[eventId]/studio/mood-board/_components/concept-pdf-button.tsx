'use client';

/**
 * "Download your concept book" — fetches the concept PDF route and triggers a
 * download, with a busy state so the couple gets feedback during the ~2s
 * server-side render (scene rasterization + inspiration fetches + pdf-lib).
 * Owner directive 2026-06-09 (concept PDF: Result + inspirations + template).
 */

import { useState } from 'react';
import { saveFileToDevice } from '@/lib/save-to-device';

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

  // 📥 The PDF is SAVED through the device, never a bare blob `<a download>` click: the app's web view has no
  // Downloads folder and saved nothing (owner 2026-10-27). `saveFileToDevice` = the share sheet on a phone, a download
  // on a computer. A PDF that outlives the tap ('expired') is kept and the button says "Tap to save"; a failed save
  // says so — never the look of success.
  const [held, setHeld] = useState<File | null>(null);

  async function hand(file: File) {
    const result = await saveFileToDevice(file);
    if (result === 'expired') {
      setHeld(file);
      return;
    }
    setHeld(null);
    if (result === 'failed') {
      setError('The PDF could not be saved — please try again.');
      return;
    }
    if (result === 'dismissed') return;
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }

  async function download() {
    if (busy) return;
    if (held) {
      setError(null);
      await hand(held);
      return;
    }
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
      await hand(new File([blob], safeFile(eventName), { type: blob.type || 'application/pdf' }));
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
        ) : held ? (
          <>Tap to save</>
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
