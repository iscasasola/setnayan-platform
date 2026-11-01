'use client';

/**
 * PayWaysEditor — "HOW TO PAY THEM" on the record of a supplier the couple added. (2026-10-29)
 *
 * Owner, verbatim: *"also manually add payment method/s"* · *"via QR or text details"* (Booked prototype v4, approved).
 * Several ways; each is the method (the one dropdown, `PickMenu`), a photo of their QR and/or the details as text, and
 * ✕. The record card's ONE Save posts them (`pay_way_method` / `pay_way_details` / `pay_way_qr`, one each per way, in
 * order, plus `pay_ways_present`) through `updateSelfAddedSupplier` → `saveSelfAddedServiceCard`.
 *
 * 📷 The QR uploads like every other private picture (`FileUpload`, compressed on the phone) into the event's own
 * PRIVATE payment folder — a QR Ph code encodes the account, so the picture is the identifier.
 *
 * 🔒 Inert: words and a picture for the couple to read on the day. Nothing here creates a payment.
 *
 * ⚖ A REFUSED READ IS SAID, AND NOTHING IS POSTED (`initial === null`): with no `pay_ways_present` the save leaves
 * the stored ways exactly as they are — never an empty editor that a Save would write over real ways with.
 */

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FileUpload } from '@/app/_components/file-upload';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  PAY_WAYS_MAX,
  PAY_WAYS_PRESENT_FIELD,
  PAY_WAY_DETAILS_MAX,
  PAY_WAY_METHODS,
  payWayQrPrefix,
  payWaysSummary,
  type PayWayMethod,
  type PayWayView,
} from '@/lib/self-added-pay-ways';

type Way = { key: number; method: PayWayMethod; details: string; qr: string | null; qrUrl: string | null };

const BOX =
  'w-full rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60';

export function PayWaysEditor({
  eventId,
  initial,
  disabled,
  onSummary,
}: {
  eventId: string;
  /** The stored ways; `null` = the read was refused. */
  initial: ReadonlyArray<PayWayView> | null;
  disabled?: boolean;
  /** The closed fold's one line follows what is here. */
  onSummary?: (line: string | null) => void;
}) {
  const [ways, setWays] = useState<Way[]>(() =>
    (initial ?? []).map((w, i) => ({ key: i, method: w.method, details: w.details ?? '', qr: w.qr, qrUrl: w.qrUrl })),
  );
  const [nextKey, setNextKey] = useState(ways.length);
  useEffect(() => {
    onSummary?.(payWaysSummary(ways));
  }, [ways, onSummary]);

  if (initial === null) {
    return (
      <p role="alert" data-pay-ways-unreadable="" className="text-[12.5px] text-danger-800 dark:text-danger-200">
        We couldn&apos;t load how to pay them just now — close this and open it again. Saving leaves them as they are.
      </p>
    );
  }

  function patch(key: number, p: Partial<Way>) {
    setWays((cur) => cur.map((w) => (w.key === key ? { ...w, ...p } : w)));
  }

  return (
    <div className="space-y-2" data-pay-ways="">
      <input type="hidden" name={PAY_WAYS_PRESENT_FIELD} value="1" />
      {ways.length === 0 ? (
        <p className="text-[12.5px] text-ink/55">Add how they want to be paid — a photo of their QR, the account details, or both.</p>
      ) : null}
      <ul className="space-y-1.5">
        {ways.map((w, i) => (
          <li key={w.key} data-pay-way="" className="border-t border-ink/10 py-2 first:border-t-0">
            <input type="hidden" name="pay_way_method" value={w.method} />
            <input type="hidden" name="pay_way_qr" value={w.qr ?? ''} />
            <div className="flex items-center gap-1.5">
              <span inert={disabled || undefined} className="min-w-0 flex-1">
                <PickMenu
                  label={`Way ${i + 1} — how they are paid`}
                  value={w.method}
                  options={PAY_WAY_METHODS}
                  compact
                  dataAttr="data-pay-way-method"
                  onPick={(k) => patch(w.key, { method: (PAY_WAY_METHODS.find((m) => m.key === k)?.key ?? 'other') as PayWayMethod })}
                />
              </span>
              <ActionButton
                tone="neutral"
                iconOnly
                icon={X}
                label={`Remove way ${i + 1}`}
                disabled={disabled}
                onClick={() => setWays((cur) => cur.filter((x) => x.key !== w.key))}
              />
            </div>
            <div className="mt-1.5 space-y-1.5">
              <textarea
                name="pay_way_details"
                value={w.details}
                rows={2}
                maxLength={PAY_WAY_DETAILS_MAX}
                disabled={disabled}
                aria-label={`Way ${i + 1} details`}
                placeholder="Account name · number (or anything they told you)"
                onChange={(e) => patch(w.key, { details: e.target.value })}
                className={BOX}
              />
              {/* Their QR — a wide slot under the words (a QR is never cropped round), shown at its own size once added. */}
              <FileUpload
                bucket="thread-files"
                pathPrefix={payWayQrPrefix(eventId)}
                acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                maxSizeMB={5}
                compressImage
                variant="wide"
                bigPreview
                label="Their QR (optional)"
                currentValue={w.qr}
                initialDisplayUrls={w.qr && w.qrUrl ? { [w.qr]: w.qrUrl } : undefined}
                disabled={disabled}
                onChange={(v) => patch(w.key, { qr: typeof v === 'string' && v ? v : null })}
              />
            </div>
          </li>
        ))}
      </ul>
      {ways.length < PAY_WAYS_MAX ? (
        <ActionButton
          tone="neutral"
          icon={Plus}
          label="Add a way to pay"
          disabled={disabled}
          onClick={() => {
            setWays((cur) => [...cur, { key: nextKey, method: 'gcash', details: '', qr: null, qrUrl: null }]);
            setNextKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}
