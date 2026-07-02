'use client';

import { useState } from 'react';
import { Plus, Trash2, Upload, Check, Loader2 } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { MAX_SCHEDULE_ITEMS } from '@/lib/vendor-service-payment-schedules';
import type { LockScheduleRow } from '@/lib/vendor-locked-qr';
import { issueLockedQr } from '../actions';

type Opt = { value: string; label: string };
type Row = {
  /** Payment name / label. */
  label: string;
  /** Clean numeric string (no separators) — whole pesos. */
  amount: string;
  /** Absolute due date, ISO YYYY-MM-DD. */
  date: string;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local-timezone today as YYYY-MM-DD (en-CA renders ISO order). */
function todayIso(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Strip everything but digits + a single decimal point → a clean numeric string. */
function cleanNumeric(raw: string): string {
  const stripped = raw.replace(/[^\d.]/g, '');
  const dot = stripped.indexOf('.');
  if (dot === -1) return stripped;
  return stripped.slice(0, dot + 1) + stripped.slice(dot + 1).replace(/\./g, '');
}

/** Format a clean numeric string with thousands separators (keeps any decimal). */
function withThousands(clean: string): string {
  if (!clean) return '';
  const [intPart = '', fracPart] = clean.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart !== undefined ? `${grouped}.${fracPart}` : grouped;
}

/** Round to 2 decimals, killing binary-float dust before comparisons/display. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const downpaymentRow = (): Row => ({ label: 'Downpayment', amount: '', date: todayIso() });
const blankRow = (n: number): Row => ({ label: `Payment ${n}`, amount: '', date: '' });

/**
 * Locked QR generator form. The vendor sets the deal (event-type + service +
 * agreed wedding date + scope + total + downpayment + a "Name · Date · Amount"
 * payment schedule + proof of the received downpayment), and on submit
 * `issueLockedQr` mints a single-use token which the page renders as a QR.
 *
 * The schedule must fully account for the balance before it can be issued: row 1
 * is the downpayment (auto-filled from "Initial paid"), and the remaining rows
 * must sum with it to the total. The amount placeholder shows the outstanding
 * balance so the vendor is guided to zero it out; "Generate" unlocks only when
 * every required field is filled and nothing is left to schedule.
 */
export function LockedQrGenerator({
  eventTypes,
  services,
}: {
  eventTypes: Opt[];
  /** The vendor's own leaf offerings (vendor_services), DB-driven — value is a
   *  vendor_service_id, or a VendorCategory key for the no-published-services
   *  fallback. issueLockedQr resolves either back to a category. */
  services: Opt[];
}) {
  const [rows, setRows] = useState<Row[]>(() => [downpaymentRow()]);
  const [serviceRef, setServiceRef] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  // Clean numeric strings (no separators) — displayed with thousands commas.
  const [total, setTotal] = useState('');
  const [initialPaid, setInitialPaid] = useState('');
  const [proofRef, setProofRef] = useState('');
  const [proofName, setProofName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  // Row 1 (index 0) is the Downpayment: its amount is the "Initial paid /
  // downpayment" figure above (single source of truth) — the vendor never
  // re-types it. Rows 2..N are the remaining installments.
  const scheduleJson: LockScheduleRow[] = rows.map((r, i) => {
    const isDownpayment = i === 0;
    return {
      seq: i + 1,
      label: r.label.trim() || (isDownpayment ? 'Downpayment' : `Payment ${i + 1}`),
      amount_value: Number(isDownpayment ? initialPaid : r.amount) || 0,
      due_date: ISO_DATE_RE.test(r.date) ? r.date : null,
    };
  });

  // Balance math — the schedule must add up to the total before issuing.
  const totalNum = round2(Number(total) || 0);
  const paidNum = round2(Number(initialPaid) || 0);
  const futureRows = rows.slice(1);
  const sumFuture = round2(futureRows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const remaining = round2(totalNum - paidNum - sumFuture);

  const labelsOk = rows.every((r) => r.label.trim() !== '');
  const datesOk = rows.every((r) => ISO_DATE_RE.test(r.date));
  const futureAmountsOk = futureRows.every((r) => (Number(r.amount) || 0) > 0);
  const canGenerate =
    serviceRef !== '' &&
    ISO_DATE_RE.test(eventDate) &&
    serviceDescription.trim() !== '' &&
    totalNum > 0 &&
    paidNum > 0 &&
    paidNum <= totalNum &&
    labelsOk &&
    datesOk &&
    futureAmountsOk &&
    remaining === 0 &&
    !uploading;

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

  const remainingLabel = `₱${withThousands(String(Math.abs(remaining)))}`;

  return (
    <form action={issueLockedQr} className="mt-6 space-y-5">
      <input type="hidden" name="schedule_json" value={JSON.stringify(scheduleJson)} />
      <input type="hidden" name="proof_r2_ref" value={proofRef} />
      {/* Comma-formatted fields display with separators but submit clean numbers. */}
      <input type="hidden" name="total_php" value={total} />
      <input type="hidden" name="initial_paid_php" value={initialPaid} />

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
          <label htmlFor="service_ref" className="block text-sm font-medium text-ink/80">
            Service <span className="text-terracotta">*</span>
          </label>
          <select
            id="service_ref"
            name="service_ref"
            required
            className="input-field w-full"
            value={serviceRef}
            onChange={(e) => setServiceRef(e.target.value)}
          >
            <option value="" disabled>Pick a service</option>
            {services.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="total_php" className="block text-sm font-medium text-ink/80">
            Total value (₱)
          </label>
          <input
            id="total_php"
            type="text"
            inputMode="decimal"
            className="input-field w-full"
            placeholder="e.g. 50,000"
            value={withThousands(total)}
            onChange={(e) => setTotal(cleanNumeric(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="initial_paid_php" className="block text-sm font-medium text-ink/80">
            Initial paid / downpayment (₱)
          </label>
          <input
            id="initial_paid_php"
            type="text"
            inputMode="decimal"
            className="input-field w-full"
            placeholder="e.g. 15,000"
            value={withThousands(initialPaid)}
            onChange={(e) => setInitialPaid(cleanNumeric(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="event_date" className="block text-sm font-medium text-ink/80">
            Wedding date <span className="text-terracotta">*</span>
          </label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            required
            className="input-field w-full"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <p className="text-xs text-ink/50">A Locked QR means you&apos;ve agreed on a date.</p>
        </div>
      </div>

      {/* What the couple availed — the scope of work frozen onto the couple's plan. */}
      <div className="space-y-1.5 rounded-2xl border border-ink/10 bg-white/60 p-5">
        <label htmlFor="service_description" className="block text-sm font-medium text-ink/80">
          What the couple availed <span className="text-terracotta">*</span>
        </label>
        <textarea
          id="service_description"
          name="service_description"
          required
          rows={3}
          maxLength={2000}
          className="input-field w-full"
          placeholder="e.g. 8 hours coverage · 2 photographers · 300+ edited photos · online gallery · 1 layflat album"
          value={serviceDescription}
          onChange={(e) => setServiceDescription(e.target.value)}
        />
        <p className="text-xs text-ink/50">
          Frozen onto their plan — the couple sees this as their scope of work.
        </p>
      </div>

      {/* Payment schedule */}
      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Payment schedule</h2>
          <span className="text-xs text-ink/45">Frozen onto the couple&apos;s plan at scan</span>
        </div>
        <div className="mt-3 space-y-3">
          {rows.map((r, i) => {
            const isDownpayment = i === 0;
            return (
              <div key={i} className="rounded-xl border border-ink/10 p-3">
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Payment name"
                    className="input-field min-w-0 flex-1"
                    value={r.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    placeholder="Payment name"
                  />
                  {!isDownpayment && (
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
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium uppercase tracking-wide text-ink/45">
                      Date
                    </label>
                    <input
                      aria-label="Payment date"
                      className="input-field w-full"
                      type="date"
                      value={r.date}
                      onChange={(e) => patch(i, { date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium uppercase tracking-wide text-ink/45">
                      Amount (₱)
                    </label>
                    <input
                      aria-label="Payment amount"
                      className="input-field w-full disabled:bg-ink/[0.03] disabled:text-ink/60"
                      type="text"
                      inputMode="decimal"
                      value={isDownpayment ? withThousands(initialPaid) : withThousands(r.amount)}
                      disabled={isDownpayment}
                      onChange={(e) => patch(i, { amount: cleanNumeric(e.target.value) })}
                      placeholder={remaining > 0 ? withThousands(String(remaining)) : '0'}
                    />
                  </div>
                </div>
                {isDownpayment && (
                  <p className="mt-2 text-xs text-ink/45">
                    Auto-filled from “Initial paid / downpayment” above.
                  </p>
                )}
              </div>
            );
          })}
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

        {/* Balance guide — must reach ₱0 before the QR can be issued. */}
        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3 text-sm">
          <span className="text-ink/60">
            {remaining < 0 ? 'Over-scheduled by' : 'Remaining to schedule'}
          </span>
          <span
            className={
              remaining === 0 && totalNum > 0
                ? 'font-semibold text-emerald-700'
                : 'font-semibold text-terracotta'
            }
          >
            {remaining === 0 && totalNum > 0 ? 'Fully scheduled ✓' : remainingLabel}
          </span>
        </div>
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
        disabled={!canGenerate}
        className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-60"
      >
        Generate Locked QR
      </SubmitButton>
      {!canGenerate && (
        <p className="-mt-2 text-center text-xs text-ink/45">
          Fill in the service, wedding date, scope, total, downpayment, and every payment date and
          amount until the balance is fully scheduled to generate the QR.
        </p>
      )}
    </form>
  );
}
