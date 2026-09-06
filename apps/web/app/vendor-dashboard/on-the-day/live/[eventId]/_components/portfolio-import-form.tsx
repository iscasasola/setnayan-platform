'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UploadCloud } from 'lucide-react';

/**
 * Import ONE finished photo into the private portfolio album, spending one
 * Papic credit. Posts straight to /api/vendor/papic-portfolio-import (its own
 * ingest lane, not the generic /api/upload presign route) because the credit
 * check + the DB row insert + the NSFW screen all happen server-side, in one
 * request, the same way every other Papic ingest surface works.
 *
 * Deliberately a plain file input rather than the shared <FileUpload> widget:
 * that widget presigns straight to R2 and hands back a ref with no server hop
 * in between, which is exactly the hop this feature needs (credit debit
 * before the object exists).
 */
export function PortfolioImportForm({
  eventId,
  canImport,
}: {
  eventId: string;
  canImport: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set('event_id', eventId);
      form.set('file', file);
      const res = await fetch('/api/vendor/papic-portfolio-import', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          body?.error === 'out_of_credits'
            ? 'Out of Papic credits for this event.'
            : 'Could not import that photo. Please try again.',
        );
      } else {
        router.refresh();
      }
    } catch {
      setError('Could not import that photo — check your connection and retry.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (!canImport) {
    return (
      <p className="mt-3 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Out of Papic credits for this event — buy more above to keep importing.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <label
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-1)' }}
      >
        {busy ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <UploadCloud aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        {busy ? 'Importing…' : 'Import a photo · 1 credit'}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={onPick}
        />
      </label>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
