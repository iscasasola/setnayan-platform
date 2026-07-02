'use client';

import { useEffect, useState } from 'react';
import { Trash2, Upload, Check, Loader2, AlertTriangle } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { MAX_SCHEDULE_ITEMS } from '@/lib/vendor-service-payment-schedules';
import type { LockScheduleRow } from '@/lib/vendor-locked-qr';
import { issueLockedQr, checkVendorDateConflict } from '../actions';

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

/** Presign + PUT a file to R2; resolves the r2 ref. Throws on failure. */
async function presignAndUpload(file: File): Promise<string> {
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
  return r2Ref;
}

/** One image upload slot (presign → PUT → ref), with its own busy/error state. */
function useUploadSlot() {
  const [ref, setRef] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const r2Ref = await presignAndUpload(file);
      setRef(r2Ref);
      setName(file.name);
    } catch {
      setErr('Upload failed — try again.');
      setRef('');
      setName('');
    } finally {
      setBusy(false);
    }
  }
  return { ref, name, busy, err, onChange };
}

/**
 * Locked QR generator form. The vendor sets the deal (event-type + one or more
 * services + agreed event date + scope + total + downpayment + a
 * "Name · Date · Amount" payment schedule + a contract + a payment proof), and on
 * submit `issueLockedQr` mints a single-use token which the page renders as a QR.
 *
 * "Generate" unlocks only when the deal is COMPLETE: a service, a valid event
 * date, scope, total, a downpayment ≤ the total, every schedule row (each dated
 * between today and the event), the balance fully scheduled (₱0 remaining), a
 * chosen contract, and the payment proof uploaded.
 */
export function LockedQrGenerator({
  eventTypes,
  services,
  contracts,
}: {
  eventTypes: Opt[];
  /** The vendor's own leaf offerings (vendor_services), DB-driven — value is a
   *  vendor_service_id, or a VendorCategory key for the no-published-services
   *  fallback. issueLockedQr resolves either back to a category. Multi-select. */
  services: Opt[];
  /** The vendor's saved contracts (value = contract_id). Chosen one is copied
   *  onto the couple's booking at scan. */
  contracts: Opt[];
}) {
  const today = todayIso();
  const [rows, setRows] = useState<Row[]>(() => [downpaymentRow()]);
  const [eventType, setEventType] = useState('');
  const [serviceRefs, setServiceRefs] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [contractId, setContractId] = useState('');
  // Clean numeric strings (no separators) — displayed with thousands commas.
  const [total, setTotal] = useState('');
  const [initialPaid, setInitialPaid] = useState('');
  const proof = useUploadSlot();
  const remembrance = useUploadSlot();
  // Date-collision advisory for the entered event date (soft — never blocks).
  const [conflict, setConflict] = useState<{ loading: boolean; labels: string[] } | null>(null);

  // Event-type-aware date label (there are many event types, not just weddings).
  const eventTypeLabel = eventTypes.find((t) => t.value === eventType)?.label ?? null;
  const eventDateLabel = eventTypeLabel ? `${eventTypeLabel} date` : 'Event date';

  // Notify the vendor if they already have a calendar block / booking on the
  // chosen event date. Advisory only.
  useEffect(() => {
    if (!ISO_DATE_RE.test(eventDate)) {
      setConflict(null);
      return;
    }
    let cancelled = false;
    setConflict({ loading: true, labels: [] });
    checkVendorDateConflict(eventDate)
      .then((res) => {
        if (!cancelled) setConflict({ loading: false, labels: res.labels });
      })
      .catch(() => {
        if (!cancelled) setConflict(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eventDate]);

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
  const overpaid = paidNum > totalNum && totalNum > 0;
  const futureRows = rows.slice(1);
  const sumFuture = round2(futureRows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const remaining = round2(totalNum - paidNum - sumFuture);

  // Auto-grow the schedule: keep exactly ONE open (empty-amount) installment row
  // whenever a balance is left to schedule, and NONE once it reaches ₱0 — so the
  // vendor never presses an "add" button. Keyed on the money inputs only (not
  // names/dates), so editing a row's name/date never disturbs it; only ADDS when
  // there is no open row, so a half-typed open row is preserved.
  const futureAmountsKey = futureRows.map((r) => r.amount).join('|');
  useEffect(() => {
    setRows((prev) => {
      const sumF = round2(prev.slice(1).reduce((s, r) => s + (Number(r.amount) || 0), 0));
      const rem = round2(totalNum - paidNum - sumF);
      let trailingEmpty = 0;
      for (let i = prev.length - 1; i > 0; i--) {
        const row = prev[i];
        if (row && String(row.amount).trim() === '') trailingEmpty++;
        else break;
      }
      if (rem > 0) {
        if (trailingEmpty === 0 && prev.length < MAX_SCHEDULE_ITEMS) {
          return [...prev, blankRow(prev.length)];
        }
        if (trailingEmpty > 1) {
          return prev.slice(0, prev.length - (trailingEmpty - 1));
        }
        return prev;
      }
      // Balance settled (or over-scheduled) — drop any leftover open rows.
      return trailingEmpty > 0 ? prev.slice(0, prev.length - trailingEmpty) : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalNum, paidNum, futureAmountsKey]);

  // Each payment date must sit between today and the event date (inclusive).
  const dateInRange = (d: string) =>
    ISO_DATE_RE.test(d) && d >= today && (ISO_DATE_RE.test(eventDate) ? d <= eventDate : true);

  const labelsOk = rows.every((r) => r.label.trim() !== '');
  const datesOk = rows.every((r) => dateInRange(r.date));
  const futureAmountsOk = futureRows.every((r) => (Number(r.amount) || 0) > 0);
  const canGenerate =
    serviceRefs.length > 0 &&
    ISO_DATE_RE.test(eventDate) &&
    eventDate >= today &&
    serviceDescription.trim() !== '' &&
    // Contract is required only when the vendor has saved contracts to pick from.
    (contracts.length === 0 || contractId !== '') &&
    totalNum > 0 &&
    paidNum > 0 &&
    paidNum <= totalNum &&
    labelsOk &&
    datesOk &&
    futureAmountsOk &&
    remaining === 0 &&
    proof.ref !== '' &&
    !proof.busy &&
    !remembrance.busy;

  function patch(i: number, p: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  }

  function toggleService(value: string) {
    setServiceRefs((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  const remainingLabel = `₱${withThousands(String(Math.abs(remaining)))}`;

  return (
    <form action={issueLockedQr} className="mt-6 space-y-5">
      <input type="hidden" name="schedule_json" value={JSON.stringify(scheduleJson)} />
      <input type="hidden" name="service_refs" value={JSON.stringify(serviceRefs)} />
      <input type="hidden" name="proof_r2_ref" value={proof.ref} />
      <input type="hidden" name="remembrance_r2_ref" value={remembrance.ref} />
      <input type="hidden" name="source_contract_id" value={contractId} />
      {/* Comma-formatted fields display with separators but submit clean numbers. */}
      <input type="hidden" name="total_php" value={total} />
      <input type="hidden" name="initial_paid_php" value={initialPaid} />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-ink/10 bg-white/60 p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="event_type" className="block text-sm font-medium text-ink/80">
            Event
          </label>
          <select
            id="event_type"
            name="event_type"
            className="input-field w-full"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="">Any event type</option>
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="event_date" className="block text-sm font-medium text-ink/80">
            {eventDateLabel} <span className="text-terracotta">*</span>
          </label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            required
            min={today}
            className="input-field w-full"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <p className="text-xs text-ink/50">A Locked QR means you&apos;ve agreed on a date.</p>
          {conflict && !conflict.loading && conflict.labels.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span>
                You already have {conflict.labels.length} booking/block on this date:{' '}
                {conflict.labels.join(' · ')}. Double-check before locking.
              </span>
            </p>
          )}
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
            className={`input-field w-full ${overpaid ? 'border-terracotta' : ''}`}
            placeholder="e.g. 15,000"
            value={withThousands(initialPaid)}
            onChange={(e) => setInitialPaid(cleanNumeric(e.target.value))}
          />
          {overpaid && (
            <p className="text-xs text-terracotta">
              Downpayment can&apos;t be more than the total value.
            </p>
          )}
        </div>
      </div>

      {/* Services — one or more of the vendor's own offerings (multi-select). */}
      <div className="space-y-2 rounded-2xl border border-ink/10 bg-white/60 p-5">
        <p className="text-sm font-medium text-ink/80">
          Service(s) <span className="text-terracotta">*</span>
          <span className="ml-1 font-normal text-ink/45">— pick every service this deal covers</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
            const on = serviceRefs.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleService(s.value)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  on
                    ? 'border-terracotta bg-terracotta/10 text-terracotta'
                    : 'border-ink/15 bg-white text-ink/70 hover:border-ink/30'
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                {s.label}
              </button>
            );
          })}
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
            const badDate = r.date !== '' && !dateInRange(r.date);
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
                      className={`input-field w-full ${badDate ? 'border-terracotta' : ''}`}
                      type="date"
                      min={today}
                      max={ISO_DATE_RE.test(eventDate) ? eventDate : undefined}
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
                {isDownpayment ? (
                  <p className="mt-2 text-xs text-ink/45">
                    Auto-filled from “Initial paid / downpayment” above.
                  </p>
                ) : badDate ? (
                  <p className="mt-2 text-xs text-terracotta">
                    Date must be between today and the event date.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {rows.length >= MAX_SCHEDULE_ITEMS && remaining > 0 && (
          <p className="mt-3 text-xs text-ink/45">
            Maximum installments reached — adjust the amounts so the balance reaches ₱0.
          </p>
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

      {/* Contract — pick one of the vendor's saved contracts to attach. */}
      <div className="space-y-1.5 rounded-2xl border border-ink/10 bg-white/60 p-5">
        <label htmlFor="source_contract_id" className="block text-sm font-medium text-ink/80">
          Contract {contracts.length > 0 && <span className="text-terracotta">*</span>}
        </label>
        {contracts.length > 0 ? (
          <>
            <select
              id="source_contract_id"
              className="input-field w-full"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            >
              <option value="" disabled>Pick a contract</option>
              {contracts.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-ink/50">
              A copy is attached to the couple&apos;s booking for e-signature when they scan.
            </p>
          </>
        ) : (
          <p className="rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
            No saved contracts yet — you can generate without one, or add a contract under{' '}
            <span className="font-medium">Contracts</span> to attach it here.
          </p>
        )}
      </div>

      {/* Proof of payment (required) + optional remembrance photo */}
      <div className="space-y-4 rounded-2xl border border-ink/10 bg-white/60 p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Proof of payment <span className="text-terracotta">*</span>
          </h2>
          <p className="mt-1 text-xs text-ink/50">
            Upload the receipt/screenshot of the downpayment you received.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink/75 hover:border-terracotta">
            {proof.busy ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : proof.ref ? (
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={2} />
            ) : (
              <Upload className="h-4 w-4" strokeWidth={1.75} />
            )}
            {proof.ref ? proof.name : proof.busy ? 'Uploading…' : 'Choose file'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={proof.onChange}
              disabled={proof.busy}
            />
          </label>
          {proof.err && <p className="mt-2 text-xs text-terracotta">{proof.err}</p>}
        </div>
        <div className="border-t border-ink/10 pt-4">
          <h2 className="text-sm font-semibold text-ink">
            Remembrance photo <span className="font-normal text-ink/45">(optional)</span>
          </h2>
          <p className="mt-1 text-xs text-ink/50">
            A keepsake photo saved with this booking.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink/75 hover:border-terracotta">
            {remembrance.busy ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : remembrance.ref ? (
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={2} />
            ) : (
              <Upload className="h-4 w-4" strokeWidth={1.75} />
            )}
            {remembrance.ref ? remembrance.name : remembrance.busy ? 'Uploading…' : 'Choose file'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={remembrance.onChange}
              disabled={remembrance.busy}
            />
          </label>
          {remembrance.err && <p className="mt-2 text-xs text-terracotta">{remembrance.err}</p>}
        </div>
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
          Complete every field — service(s), event date, scope, total, downpayment, the full payment
          schedule (balance at ₱0), a contract, and the payment proof — to generate the QR.
        </p>
      )}
    </form>
  );
}
