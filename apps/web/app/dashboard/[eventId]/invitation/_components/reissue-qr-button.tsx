'use client';

import { useRef, useState, useTransition } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

/**
 * Host/coordinator "Re-issue QR" with a real confirm dialog (build ④ —
 * replaces the bare one-click form that rotated a guest's token with zero
 * warning). The dialog states plainly what dies and what survives, and:
 *
 *   • guest HAS an email  → informs the host a no-token heads-up email goes out;
 *   • guest has NO email  → forces an explicit "I'll hand them the new QR"
 *     acknowledgment before the confirm button arms (most guest rows have no
 *     email — without a reshare the guest is stranded);
 *   • event is LIVE (T-1h..T+8h) → additionally requires typing ROTATE — the
 *     check-in desk + printed place cards stop scanning this guest immediately
 *     (the owner's lost-phone-at-the-venue case is allowed, but never by
 *     accident).
 *
 * The heavy lifting (authz, audit, durable rate limit) lives in the
 * rotate_guest_qr_token RPC — this component only gates the click.
 */
export function ReissueQrButton({
  action,
  guestName,
  hasEmail,
  dayOfLive,
  rotatedAt,
}: {
  /** Server action bound to (eventId, guestId) by the page. */
  action: (formData: FormData) => Promise<void>;
  guestName: string;
  hasEmail: boolean;
  /** Event is inside the live day-of window (T-1h..T+8h). */
  dayOfLive: boolean;
  /** guests.qr_token_rotated_at — shown as a "recently rotated" hint. */
  rotatedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [acked, setAcked] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef });

  const needsAck = !hasEmail;
  const needsTyped = dayOfLive;
  const armed = (!needsAck || acked) && (!needsTyped || typed.trim().toUpperCase() === 'ROTATE');

  const rotatedLabel = rotatedAt
    ? new Date(rotatedAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <>
      <div className="inline-flex flex-col items-end gap-0.5">
        <button
          type="button"
          onClick={() => {
            setAcked(false);
            setTyped('');
            setOpen(true);
          }}
          className="inline-flex items-center gap-1 text-sm text-terracotta-700 underline-offset-4 hover:underline"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Re-issue
        </button>
        {rotatedLabel ? (
          <span className="text-[10px] text-ink/45" title={`QR last rotated ${rotatedLabel}`}>
            rotated {rotatedLabel}
          </span>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reissue-qr-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-cream p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>

            <h2 id="reissue-qr-title" className="text-lg font-semibold tracking-tight text-ink">
              Replace {guestName}&rsquo;s QR?
            </h2>
            <p className="mt-2 text-sm text-ink/70">
              Their printed QR card, printed place card, and every previously shared link stop
              working <span className="font-semibold text-ink">immediately</span>. Their RSVP,
              seat, and photos stay exactly as they are.
            </p>

            {hasEmail ? (
              <p className="mt-3 rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 text-xs text-ink/65">
                We&rsquo;ll email {guestName} a heads-up that their QR changed. For security the
                email never contains the new QR — you still need to share it with them.
              </p>
            ) : (
              <label className="mt-3 flex items-start gap-2 rounded-md border border-warn-300 bg-warn-50 px-3 py-2 text-xs text-warn-900">
                <input
                  type="checkbox"
                  checked={acked}
                  onChange={(e) => setAcked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-terracotta"
                />
                <span>
                  This guest has no email on file — after replacing, only YOU can get them back
                  in. <span className="font-semibold">I&rsquo;ll hand them their new QR</span> (or
                  re-send their new link) myself.
                </span>
              </label>
            )}

            {dayOfLive ? (
              <div className="mt-3 rounded-md border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700">
                <p className="flex items-start gap-1.5 font-semibold">
                  <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  Your event is live right now.
                </p>
                <p className="mt-1">
                  The check-in desk and this guest&rsquo;s printed place card stop scanning the
                  moment you confirm — use manual name search at the door. Type{' '}
                  <span className="font-mono font-semibold">ROTATE</span> to confirm.
                </p>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="ROTATE"
                  aria-label="Type ROTATE to confirm"
                  className="mt-2 w-full rounded-md border border-terracotta/40 bg-white px-2 py-1.5 font-mono text-sm text-ink placeholder:text-ink/30"
                />
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!armed || pending}
                onClick={() =>
                  startTransition(async () => {
                    await action(new FormData());
                    setOpen(false);
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream shadow-sm transition hover:bg-terracotta-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={2} />
                {pending ? 'Replacing…' : 'Replace QR'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
