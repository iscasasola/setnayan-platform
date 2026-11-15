'use client';

import { useId, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { FormRow, FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { formatPhp } from '@/lib/php';
import { refundDayWords, type ClientRefund } from '@/lib/client-refunds';
import { recordClientRefund } from '../../../messages/[threadId]/pay-confirm-actions';
import { DatesRow } from '../../../customers/_components/dates-row';

/** A refund row as the Payment page draws it — the record plus its proof's display link (null when none / not servable). */
export type ClientRefundView = ClientRefund & { proofUrl: string | null };

const H = 'text-xs font-semibold uppercase tracking-[0.12em] text-ink/70';

/** Today in Manila, 'YYYY-MM-DD' — the date field's default and its upper bound. */
function manilaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/** Presign + PUT a proof photo through the Booked QR's own uploader prefix (`locked-qr-proof/`). */
async function uploadProof(file: File): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bucket: 'media', pathPrefix: 'locked-qr-proof', filename: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  if (!res.ok) throw new Error('presign failed');
  const { uploadUrl, r2Ref } = (await res.json()) as { uploadUrl: string; r2Ref: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
  if (!put.ok) throw new Error('upload failed');
  return r2Ref;
}

/**
 * 💸 REFUNDS — the picked client's Payment page (Supplier Build 2 lane E, controller pick; owner rules "Rows: tap opens,
 * swipe left removes + Undo" and "every money action is confirmed").
 *
 *   · each refund is a row: amount · day · reason. TAP opens it (the record, with its proof); SWIPE LEFT removes it, with
 *     Undo — the shipped `SwipeToDelete` + `deleteWithUndo` (the remove is written when the Undo window closes; a
 *     refusal brings the row back and says so). Removed rows are kept by the database, never hard-deleted;
 *   · "Record a refund" opens a sheet: amount · the day · why · an optional proof photo. Saving asks once more —
 *     "Record ₱X refunded to <client>?" — and only then writes (`recordClientRefund` → `vendor_record_client_refund`).
 *     NO MONEY MOVES: it is a record, like a logged payment; the sheet says so.
 * A refused read is said ("couldn't load"), never an empty list.
 */
export function ClientRefunds({
  eventId,
  eventVendorId,
  clientName,
  refunds,
  measured,
}: {
  eventId: string;
  eventVendorId: string;
  clientName: string;
  refunds: readonly ClientRefundView[];
  measured: boolean;
}) {
  const { confirm, dialog } = useConfirm();
  const headId = useId();
  const viewId = useId();
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<ClientRefundView | null>(null);
  const [amount, setAmount] = useState('');
  const [on, setOn] = useState(manilaToday);
  const [reason, setReason] = useState('');
  const [proof, setProof] = useState<{ ref: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');
  const rowsRef = useRef<HTMLDivElement>(null);
  const back = `/vendor-dashboard/clients/${eventId}`;

  const hide = (id: string, on: boolean) =>
    setGone((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function start() {
    setAmount('');
    setOn(manilaToday());
    setReason('');
    setProof(null);
    setError('');
    // One id per sheet: a double tap of the final confirm records ONE refund (`request_id` UNIQUE).
    setRequestId(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '');
    setOpen(true);
  }

  async function onProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      setProof({ ref: await uploadProof(file), name: file.name });
    } catch {
      setProof(null);
      setError('The photo didn’t upload — try again, or record without it.');
    } finally {
      setUploading(false);
    }
  }

  const peso = Number(amount.replace(/[^\d.]/g, ''));
  const ready = Number.isFinite(peso) && peso > 0 && reason.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(on) && !uploading;

  async function save() {
    if (saving) return;
    // An unfinished answer shakes and the sheet moves to it — never a silent refusal (the shared form-row rule).
    if (!ready) {
      if (rowsRef.current) nudgeFormRows(rowsRef.current);
      return;
    }
    const yes = await confirm({
      title: `Record ${formatPhp(peso)} refunded to ${clientName}?`,
      body: `On ${refundDayWords(on)} · “${reason.trim()}”. No money moves — this is your record. It lowers what they have paid you, and ${clientName} sees it with your payments.`,
      confirmLabel: 'Record refund',
    });
    if (!yes) return;
    setSaving(true);
    setError('');
    const fd = new FormData();
    fd.set('event_vendor_id', eventVendorId);
    fd.set('amount_php', String(peso));
    fd.set('refunded_on', on);
    fd.set('reason', reason.trim());
    if (proof) fd.set('proof_r2_ref', proof.ref);
    if (requestId) fd.set('request_id', requestId);
    fd.set('return_to', back);
    try {
      const answer = await recordClientRefund(fd);
      if (!answer.ok) {
        setError(answer.message);
        return;
      }
      // No router.refresh(): recordClientRefund revalidates this page, so its answer already carries the new render.
      setOpen(false);
    } catch {
      setError('That did not go through. Nothing was recorded — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function remove(r: ClientRefundView) {
    deleteWithUndo({
      label: `${formatPhp(r.amountPhp)} refund removed.`,
      hide: () => hide(r.refundId, true),
      restore: () => hide(r.refundId, false),
      commit: async () => {
        const fd = new FormData();
        fd.set('remove_refund_id', r.refundId);
        fd.set('return_to', back);
        await recordClientRefund(fd);
      },
      failed: 'Couldn’t remove that refund. It’s back — try again.',
    });
  }

  const shown = refunds.filter((r) => !gone.has(r.refundId));

  return (
    <section id="payment-refunds" aria-label="Refunds" data-client-payment-refunds={shown.length}>
      <UndoToastHost />
      {dialog}
      <p className={H}>Refunds you gave</p>
      {!measured ? (
        <p role="status" className="py-2 text-[13px] text-ink/70" data-client-refunds-unread="">
          Your refunds couldn&rsquo;t load just now — nothing was lost. Refresh to try again.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-2 text-[13px] text-ink/70" data-client-refunds-empty="">
          None recorded.
        </p>
      ) : (
        <div role="list">
          {shown.map((r) => (
            <div role="listitem" key={r.refundId}>
              <SwipeToDelete label={`Remove the ${formatPhp(r.amountPhp)} refund`} onDelete={() => remove(r)}>
                <button type="button" className="block w-full text-left" onClick={() => setViewing(r)} data-client-refund={r.refundId}>
                  <DatesRow data="client-refund" title={`${formatPhp(r.amountPhp)} · ${refundDayWords(r.refundedOn)}`} line={r.reason} />
                </button>
              </SwipeToDelete>
            </div>
          ))}
        </div>
      )}
      <div className="pt-2">
        <ActionButton tone="neutral" icon={Undo2} label="Record a refund" onClick={start} aria-haspopup="dialog" data-testid="client-refund-record" />
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headId} title="Record a refund">
        <div className="space-y-4 p-4" data-client-refund-sheet="">
          <h2 id={headId} className="sr-only">
            Record a refund to {clientName}
          </h2>
          <p className="text-[13px] text-ink/65">Money you gave back to {clientName}. No money moves here — it is your record.</p>
          <div ref={rowsRef}>
            <FormRows width="wide">
              <TypedRow name="Amount" value={amount} amount required empty="How much" fieldName="amount_php" data="client-refund-amount" onKeep={(t) => setAmount(t)} />
              <DateRow name="The day" value={on} today={manilaToday()} max={manilaToday()} empty="Pick the day" data="client-refund-day" onKeep={(d) => setOn(d)} />
              <TypedRow
                name="Why"
                value={reason}
                required
                maxLength={240}
                empty="Say why"
                placeholder="e.g. Drone coverage dropped from the package"
                fieldName="reason"
                data="client-refund-reason"
                note={`${clientName} sees this.`}
                onKeep={(t) => setReason(t)}
              />
              <FormRow name="Proof photo" data="client-refund-proof">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/15 px-4 text-sm text-ink/75 hover:border-terracotta">
                  <input type="file" accept="image/*" className="sr-only" onChange={onProof} />
                  {uploading ? 'Uploading…' : proof ? `Change · ${proof.name}` : 'Optional · add'}
                </label>
              </FormRow>
            </FormRows>
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-danger-700" data-client-refund-error="">
              {error}
            </p>
          ) : null}
          <ActionButton tone="brand" main icon={Undo2} label="Record refund" onClick={save} disabled={uploading} waiting={saving} className="w-full" />
        </div>
      </Sheet>

      <Sheet open={viewing !== null} onClose={() => setViewing(null)} labelledById={viewId} title="Refund">
        {viewing ? (
          <div className="space-y-2 p-4" data-client-refund-open={viewing.refundId}>
            <h2 id={viewId} className="font-display text-[22px] font-medium tabular-nums text-ink">
              {formatPhp(viewing.amountPhp)}
            </h2>
            <p className="text-sm text-ink/70">
              Given back to {clientName} on {refundDayWords(viewing.refundedOn)}
            </p>
            <p className="text-sm text-ink">{viewing.reason}</p>
            {viewing.proofUrl ? (
              <a href={viewing.proofUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent underline-offset-2 hover:underline">
                The proof photo
              </a>
            ) : viewing.proofRef ? (
              <p className="text-[13px] text-ink/70">A proof photo is kept with it.</p>
            ) : null}
            <p className="pt-2 text-xs text-ink/70">To take it back, swipe the row left.</p>
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
