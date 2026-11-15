'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';

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
          className="inline-flex min-h-11 items-center gap-1 text-sm text-terracotta-700 underline-offset-4 hover:underline"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Re-issue
        </button>
        {rotatedLabel ? (
          <span className="text-[12px] text-ink/75" title={`QR last rotated ${rotatedLabel}`}>
            rotated {rotatedLabel}
          </span>
        ) : null}
      </div>

      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 3 · 9 · 13 · 14): the house Sheet (✕, Esc, the phone's Back) — this is
          the "are you sure?" the sheet keeps for a step that cannot be undone; buttons at the foot, equal widths: grey
          Cancel, red Replace QR (it stops other people's codes). Warnings are plain amber lines, no boxes. */}
      <Sheet open={open} onClose={() => setOpen(false)} labelledById="reissue-qr-title" rise>
        <div className="space-y-3 px-4 pb-4 pt-3.5">
          <h2 id="reissue-qr-title" className="pr-12 text-lg font-bold tracking-tight text-ink">
            Replace {guestName}&rsquo;s QR?
          </h2>
          <p className="text-sm text-ink/75">
            Their printed QR card, printed place card, and every previously shared link stop
            working <span className="font-semibold text-ink">immediately</span>. Their RSVP,
            seat, and photos stay exactly as they are.
          </p>

          {hasEmail ? (
            <p className="text-[13px] text-ink/75">
              We&rsquo;ll email {guestName} a heads-up that their QR changed. For security the
              email never contains the new QR — you still need to share it with them.
            </p>
          ) : (
            <label className="flex min-h-11 cursor-pointer items-start gap-2 text-[13px] text-warn-800">
              <input
                type="checkbox"
                checked={acked}
                onChange={(e) => setAcked(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-terracotta"
              />
              <span>
                This guest has no email on file — after replacing, only YOU can get them back
                in. <span className="font-semibold">I&rsquo;ll hand them their new QR</span> (or
                re-send their new link) myself.
              </span>
            </label>
          )}

          {dayOfLive ? (
            <div className="space-y-1 border-l-2 border-danger-700 pl-3 text-[13px] text-danger-700">
              <p className="flex items-start gap-1.5 font-semibold">
                <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Your event is live right now.
              </p>
              <p>
                The check-in desk and this guest&rsquo;s printed place card stop scanning the
                moment you confirm — use manual name search at the door. Type{' '}
                <span className="font-semibold">ROTATE</span> to confirm.
              </p>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="ROTATE"
                aria-label="Type ROTATE to confirm"
                className="input-field mt-2 w-full text-sm"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setOpen(false)} className="w-full" />
            <ActionButton
              tone="danger"
              icon={RefreshCw}
              label={pending ? 'Replacing…' : 'Replace QR'}
              disabled={!armed}
              waiting={pending}
              onClick={() =>
                startTransition(async () => {
                  await action(new FormData());
                  setOpen(false);
                })
              }
              className="w-full"
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}
