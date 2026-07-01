'use client';

import { useState } from 'react';
import { Plus, Trash2, Upload, Check, Loader2 } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  DUE_ANCHOR_LABELS,
  MAX_SCHEDULE_ITEMS,
  type AmountKind,
  type DueAnchor,
} from '@/lib/vendor-service-payment-schedules';
import type { LockScheduleRow } from '@/lib/vendor-locked-qr';
import { issueLockedQr } from '../actions';

type Opt = { value: string; label: string };
type Row = {
  label: string;
  amount_kind: AmountKind;
  amount_value: string;
  due_anchor: DueAnchor;
  due_offset_days: string;
};

const blankRow = (n: number): Row => ({
  label: n === 0 ? 'Downpayment' : `Payment ${n}`,
  amount_kind: 'percent',
  amount_value: '',
  due_anchor: n === 0 ? 'on_lock' : 'before_event',
  due_offset_days: '0',
});

/**
 * Locked QR generator form. The vendor sets the deal (event-type + service +
 * total + downpayment + a payment schedule + proof of the received downpayment),
 * and on submit `issueLockedQr` mints a single-use token which the page renders
 * as a QR. Serializes the schedule + the uploaded proof ref into hidden fields.
 */
export function LockedQrGenerator({
  eventTypes,
  coverage,
}: {
  eventTypes: Opt[];
  coverage: Opt[];
}) {
  const [rows, setRows] = useState<Row[]>([blankRow(0)]);
  const [proofRef, setProofRef] = useState('');
  const [proofName, setProofName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const scheduleJson: LockScheduleRow[] = rows.map((r, i) => ({
    seq: i + 1,
    label: r.label.trim() || `Payment ${i + 1}`,
    amount_kind: r.amount_kind,
    amount_value: Number(r.amount_value) || 0,
    due_anchor: r.due_anchor,
    due_offset_days: Number(r.due_offset_days) || 0,
  }));

  function patch(i: number, p: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  }

  async function onProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr('');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'media',
          pathPrefix: 'locked-qr-proof',
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!res.ok) throw new Error('presign failed');
      const { uploadUrl, r2Ref } = (await res.json()) as { uploadUrl: string; r2Ref: string };
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('upload failed');
      setProofRef(r2Ref);
      setProofName(file.name);
    } catch {
      setUploadErr('Upload failed — try again.');
      setProofRef('');
      setProofName('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={issueLockedQr} className="mt-6 space-y-5">
      <input type="hidden" name="schedule_json" value={JSON.stringify(scheduleJson)} />
      <input type="hidden" name="proof_r2_ref" value={proofRef} />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-ink/10 bg-white/60 p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="event_type" className="block text-sm font-medium text-ink/80">
            Event
          </label>
          <select id="event_type" name="event_type" className="input-field w-full" defaultValue="">
            <option value="">Any event type</option>
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="category" className="block text-sm font-medium text-ink/80">
            Service <span className="text-terracotta">*</span>
          </label>
          <select id="category" name="category" required className="input-field w-full" defaultValue="">
            <option value="" disabled>Pick a service</option>
            {coverage.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="total_php" className="block text-sm font-medium text-ink/80">
            Total value (₱)
          </label>
          <input id="total_php" name="total_php" type="number" min="0" step="0.01" inputMode="decimal" className="input-field w-full" placeholder="e.g. 50000" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="initial_paid_php" className="block text-sm font-medium text-ink/80">
            Initial paid / downpayment (₱)
          </label>
          <input id="initial_paid_php" name="initial_paid_php" type="number" min="0" step="0.01" inputMode="decimal" className="input-field w-full" placeholder="e.g. 15000" />
        </div>
      </div>

      {/* Payment schedule */}
      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Payment schedule</h2>
          <span className="text-xs text-ink/45">Frozen onto the couple&apos;s plan at scan</span>
        </div>
        <div className="mt-3 space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-ink/10 p-3">
              <div className="flex items-center gap-2">
                <input
                  aria-label="Installment label"
                  className="input-field min-w-0 flex-1"
                  value={r.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                  placeholder="Label"
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded-lg p-2 text-ink/40 hover:bg-ink/5 hover:text-terracotta"
                    aria-label="Remove installment"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select
                  aria-label="Amount kind"
                  className="input-field"
                  value={r.amount_kind}
                  onChange={(e) => patch(i, { amount_kind: e.target.value as AmountKind })}
                >
                  <option value="percent">% of total</option>
                  <option value="fixed">₱ fixed</option>
                </select>
                <input
                  aria-label="Amount"
                  className="input-field"
                  type="number"
                  min="0"
                  step={r.amount_kind === 'percent' ? '1' : '0.01'}
                  value={r.amount_value}
                  onChange={(e) => patch(i, { amount_value: e.target.value })}
                  placeholder={r.amount_kind === 'percent' ? '%' : '₱'}
                />
                <select
                  aria-label="Due anchor"
                  className="input-field"
                  value={r.due_anchor}
                  onChange={(e) => patch(i, { due_anchor: e.target.value as DueAnchor })}
                >
                  <option value="on_lock">{DUE_ANCHOR_LABELS.on_lock}</option>
                  <option value="before_event">{DUE_ANCHOR_LABELS.before_event}</option>
                </select>
                <input
                  aria-label="Days offset"
                  className="input-field"
                  type="number"
                  min="0"
                  value={r.due_offset_days}
                  onChange={(e) => patch(i, { due_offset_days: e.target.value })}
                  placeholder="days"
                />
              </div>
            </div>
          ))}
        </div>
        {rows.length < MAX_SCHEDULE_ITEMS && (
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, blankRow(prev.length)])}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} /> Add an installment
          </button>
        )}
      </div>

      {/* Proof of downpayment */}
      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
        <h2 className="text-sm font-semibold text-ink">Downpayment proof</h2>
        <p className="mt-1 text-xs text-ink/50">
          Upload the receipt/screenshot of the downpayment you received.
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink/75 hover:border-terracotta">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : proofRef ? (
            <Check className="h-4 w-4 text-emerald-600" strokeWidth={2} />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={1.75} />
          )}
          {proofRef ? proofName : uploading ? 'Uploading…' : 'Choose file'}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onProof} disabled={uploading} />
        </label>
        {uploadErr && <p className="mt-2 text-xs text-terracotta">{uploadErr}</p>}
      </div>

      <SubmitButton
        pendingLabel="Generating…"
        disabled={uploading}
        className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-60"
      >
        Generate Locked QR
      </SubmitButton>
    </form>
  );
}
