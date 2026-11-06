'use client';

/**
 * "Download printable" — fetches the one-page printable Mood Board PDF and
 * triggers a download, with a busy state for feedback during the ~1s server
 * render (2026-06-28). Mirrors concept-pdf-button's download mechanics, but
 * points at the lighter print-pdf route (palette + reception summary only).
 */

import { useState } from 'react';
import { saveFileToDevice } from '@/lib/save-to-device';
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
      const res = await fetch(`/dashboard/${eventId}/studio/mood-board/print-pdf`);
      if (res.status === 401) {
        setError('Your session expired — please refresh and sign in again.');
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      await hand(new File([blob], safeFile(eventName ?? ''), { type: blob.type || 'application/pdf' }));
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
