'use client';

/**
 * "Read it again" — read the buyer's screenshot ON THE ADMIN'S PHONE.
 *
 * Owner 17 Nov 2026: *"can we create our own in app reader so we do not need ai
 * to run?"* → *"Yes, swap it in"*. The picture is the one this screen already
 * shows (a short-lived signed link, `paymentProofPolicy` in page.tsx); the
 * shared in-app reader (lib/on-phone-reader.ts) reads it here and only the TEXT
 * goes to `rereadPaymentReceipt`. No outside AI. ⛔ It writes one advisory row
 * and moves nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { rereadPaymentReceipt } from '../actions';
import { RECEIPT_FIELDS } from '@/lib/receipt-fields';

type Read = { status: 'ok' | 'failed'; text: string };

export function RereadOnThisPhone({
  paymentId,
  imageUrl,
  label,
}: {
  paymentId: string;
  /** The signed link this screen already holds, or null when it could not be signed. */
  imageUrl: string | null;
  label: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);

  // Once the phone has read it, the form posts the text — a real form post, so
  // the action's redirect re-renders the page as every admin form does.
  useEffect(() => {
    if (read) form.current?.requestSubmit();
  }, [read]);

  async function readHere() {
    if (!imageUrl) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(String(res.status));
      const picture = await res.blob();
      const { readOnePictureOnThisPhone } = await import('@/lib/on-phone-reader');
      const got = await readOnePictureOnThisPhone(picture);
      setRead({ status: got.status, text: got.text });
    } catch {
      setBusy(false);
      setError('This picture could not be opened on this phone. Open it yourself.');
    }
  }

  return (
    <form ref={form} action={rereadPaymentReceipt} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="payment_id" value={paymentId} />
      {read ? <input type="hidden" name={RECEIPT_FIELDS.status} value={read.status} /> : null}
      {read?.status === 'ok' ? <input type="hidden" name={RECEIPT_FIELDS.text} value={read.text} /> : null}
      <button
        type="button"
        className="ab ab-neutral"
        disabled={busy || !imageUrl}
        aria-busy={busy}
        onClick={() => void readHere()}
      >
        {busy ? 'Reading…' : label}
      </button>
      {error ? (
        <span role="alert" className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
          {error}
        </span>
      ) : null}
    </form>
  );
}
