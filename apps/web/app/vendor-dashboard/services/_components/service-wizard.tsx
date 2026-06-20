'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Lock } from 'lucide-react';
import { Field } from '@/app/_components/forms/field';
import { SubmitButton } from '@/app/_components/submit-button';
import { commitVendorService } from '../actions';

/**
 * ServiceWizard — the guided "create a service" flow (vendor Services builder
 * redesign, owner 2026-06-20). One <form> posting to commitVendorService (the
 * single atomic save). All step sections live in the DOM (so every field
 * submits); only the active one is shown. 3 answers publish (category · price ·
 * perk); links / availability / payment are optional steps. Time-slots stay on
 * the legacy card (Enterprise + booking-lock) — this flow sets daily_capacity.
 */

type OtherCategory = { value: string; label: string };
type Branch = { branch_id: string; label: string };

type ScheduleRow = {
  label: string;
  kind: 'percent' | 'fixed';
  value: string;
  anchor: '' | 'on_lock' | 'before_event';
  offset: string;
};

export function ServiceWizard({
  categoryValue,
  categoryLabel,
  otherCategories,
  branches,
  slotsPerDay,
}: {
  categoryValue: string;
  categoryLabel: string;
  otherCategories: OtherCategory[];
  branches: Branch[];
  slotsPerDay: number;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [perk, setPerk] = useState('');
  const [linkCount, setLinkCount] = useState(0);
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  // Step sequence — optional steps prune out when they don't apply.
  const steps = useMemo(() => {
    const s: { id: string; label: string }[] = [
      { id: 'what', label: 'What you offer' },
      { id: 'price', label: 'Pricing' },
      { id: 'perk', label: 'Setnayan Exclusive' },
    ];
    if (otherCategories.length > 0) s.push({ id: 'links', label: "What's included" });
    s.push({ id: 'when', label: 'Availability' });
    s.push({ id: 'pay', label: 'Payment plan' });
    s.push({ id: 'review', label: 'Review & publish' });
    return s;
  }, [otherCategories.length]);

  const clamped = Math.min(step, steps.length - 1);
  const activeId = steps[clamped]?.id ?? 'what';
  const isLast = clamped === steps.length - 1;
  const canPublish = perk.trim().length > 0;

  const show = (id: string) => (activeId === id ? {} : { hidden: true });

  return (
    <form action={commitVendorService} className="space-y-5">
      <input type="hidden" name="category" value={categoryValue} />

      {/* Progress */}
      <ol className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              i === clamped
                ? 'bg-ink text-cream'
                : i < clamped
                  ? 'bg-ink/10 text-ink/70'
                  : 'bg-ink/[0.04] text-ink/45'
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {/* 1 · What you offer */}
      <section {...show('what')} className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink/45">Category</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-medium text-ink">
            <Lock aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
            {categoryLabel}
          </p>
          <p className="mt-1 text-sm text-ink/55">This is what you&rsquo;re listing. Pick a different one from the Services page if it&rsquo;s wrong.</p>
        </div>
        <Field label="Listing title (optional)" htmlFor="title">
          <input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={`e.g. "${categoryLabel} — Full Day"`}
            className="input-field"
          />
        </Field>
      </section>

      {/* 2 · Pricing */}
      <section {...show('price')} className="space-y-3">
        <Field label="Starting price (₱)" htmlFor="starting_price_php">
          <input
            id="starting_price_php"
            name="starting_price_php"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            step={1}
            placeholder="Leave blank for quote-on-request"
            className="input-field"
          />
        </Field>
        <Field label="Crew size (optional)" htmlFor="crew_size">
          <input id="crew_size" name="crew_size" type="number" min={0} step={1} className="input-field" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink/75">
          <input type="checkbox" name="crew_meal_required" className="h-4 w-4 accent-terracotta" />
          Crew meal required
        </label>
        <details className="rounded-lg border border-ink/10 p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink/75">Pricing rules (advanced) — optional</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-ink/55">
              Starting points the platform uses — the real numbers are set in each couple&rsquo;s inquiry. Skip these and you can still publish.
            </p>
            <Field label="Per extra guest (₱)" htmlFor="added_pax_price_php">
              <input id="added_pax_price_php" name="added_pax_price_php" type="number" min={0} step={1} className="input-field" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Recommended lead (months)" htmlFor="recommended_lead_time_months">
                <input id="recommended_lead_time_months" name="recommended_lead_time_months" type="number" min={0} step="0.5" className="input-field" />
              </Field>
              <Field label="Last-minute ends (months)" htmlFor="last_minute_end_months">
                <input id="last_minute_end_months" name="last_minute_end_months" type="number" min={0} step={1} className="input-field" />
              </Field>
              <Field label="Last-minute surcharge (%)" htmlFor="last_minute_surcharge_pct">
                <input id="last_minute_surcharge_pct" name="last_minute_surcharge_pct" type="number" min={0} max={100} step={1} className="input-field" />
              </Field>
            </div>
          </div>
        </details>
      </section>

      {/* 3 · Setnayan Exclusive perk */}
      <section {...show('perk')} className="space-y-2">
        <Field label="Your Setnayan Exclusive" htmlFor="exclusive_perk_text">
          <input
            id="exclusive_perk_text"
            name="exclusive_perk_text"
            value={perk}
            onChange={(e) => setPerk(e.target.value)}
            maxLength={500}
            placeholder="e.g. Free engagement mini-shoot for Setnayan couples"
            className="input-field"
          />
        </Field>
        <p className="text-sm text-ink/55">
          One thing couples only get by booking you through Setnayan. This is required to <span className="font-medium text-ink">publish</span> — you can save a draft without it.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['Free add-on', 'Priority date hold', 'Setnayan-only rate', 'Complimentary upgrade'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPerk(c)}
              className="rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs text-ink/70 hover:bg-ink/5"
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* 4 · What's included (links) — only when the vendor offers other categories */}
      {otherCategories.length > 0 ? (
        <section {...show('links')} className="space-y-2">
          <p className="text-sm font-medium text-ink">What&rsquo;s included with this service?</p>
          <p className="text-sm text-ink/55">Pick other things you offer that come bundled — couples see &ldquo;comes with&rdquo; on your card. Up to 6.</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {otherCategories.map((c) => (
              <label key={c.value} className="flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  name="linked"
                  value={c.value}
                  onChange={(e) => setLinkCount((n) => n + (e.target.checked ? 1 : -1))}
                  className="h-4 w-4 accent-terracotta"
                />
                {c.label}
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5 · Availability (capacity + branch) */}
      <section {...show('when')} className="space-y-3">
        {slotsPerDay > 0 ? (
          <Field label="Bookings you can take per day" htmlFor="daily_capacity">
            <input id="daily_capacity" name="daily_capacity" type="number" min={1} max={slotsPerDay} step={1} placeholder="Leave blank for no limit" className="input-field" />
          </Field>
        ) : (
          <p className="rounded-lg border border-ink/10 bg-cream px-3 py-2 text-sm text-ink/55">
            Daily booking limits are a paid-plan feature. You can still publish — couples just won&rsquo;t see a per-day cap.
          </p>
        )}
        {branches.length > 0 ? (
          <Field label="Branch (optional)" htmlFor="branch_id">
            <select id="branch_id" name="branch_id" defaultValue="" className="input-field">
              <option value="">Main / unassigned</option>
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>{b.label}</option>
              ))}
            </select>
          </Field>
        ) : null}
      </section>

      {/* 6 · Payment plan (installments) */}
      <section {...show('pay')} className="space-y-2">
        <p className="text-sm font-medium text-ink">Payment plan (optional)</p>
        <p className="text-sm text-ink/55">Set a downpayment + installments couples will see. Skip it to keep things simple.</p>
        <ScheduleEditor rows={rows} setRows={setRows} />
      </section>

      {/* 7 · Review & publish */}
      <section {...show('review')} className="space-y-3">
        <p className="text-sm font-medium text-ink">Review</p>
        <dl className="space-y-1.5 rounded-lg border border-ink/10 bg-cream p-4 text-sm">
          <Recap k="Category" v={categoryLabel} />
          {title ? <Recap k="Title" v={title} /> : null}
          <Recap k="Price" v={price ? `₱${price}` : 'Quote on request'} />
          <Recap k="Setnayan Exclusive" v={perk || '— not set (required to publish)'} />
          {linkCount > 0 ? <Recap k="Comes with" v={`${linkCount} service${linkCount === 1 ? '' : 's'}`} /> : null}
          {rows.length > 0 ? <Recap k="Payment plan" v={`${rows.length} installment${rows.length === 1 ? '' : 's'}`} /> : null}
        </dl>
        {!canPublish ? (
          <p className="rounded-md bg-warn-50 px-3 py-2 text-xs text-warn-900">
            Add a Setnayan Exclusive perk (step 3) to publish — or save as a draft for now.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton
            name="publish"
            value="true"
            disabled={!canPublish}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream hover:bg-terracotta-600 disabled:opacity-50"
            pendingLabel="Publishing…"
          >
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Publish service
          </SubmitButton>
          <SubmitButton
            name="publish"
            value="false"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink/20 px-5 py-2.5 text-sm font-medium text-ink/75 hover:bg-ink/5"
            pendingLabel="Saving…"
          >
            Save as draft
          </SubmitButton>
        </div>
      </section>

      {/* Nav chrome (hidden on the final step, which has its own submit buttons) */}
      {!isLast ? (
        <div className="flex items-center justify-between border-t border-ink/10 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={clamped === 0}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5 disabled:opacity-40"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
          >
            Continue
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </form>
  );
}

function Recap({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink/55">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}

/** Lightweight installment editor — emits the same item_* field names the
 *  legacy payment-schedule action + commitVendorService's parser read. */
function ScheduleEditor({
  rows,
  setRows,
}: {
  rows: ScheduleRow[];
  setRows: Dispatch<SetStateAction<ScheduleRow[]>>;
}) {
  const update = (i: number, patch: Partial<ScheduleRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-ink/10 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            name="item_label"
            value={r.label}
            onChange={(e) => update(i, { label: e.target.value })}
            maxLength={80}
            placeholder={i === 0 ? 'Downpayment' : `Payment ${i}`}
            className="input-field"
          />
          <select name="item_amount_kind" value={r.kind} onChange={(e) => update(i, { kind: e.target.value as ScheduleRow['kind'] })} className="input-field">
            <option value="percent">%</option>
            <option value="fixed">₱</option>
          </select>
          <input name="item_value" value={r.value} onChange={(e) => update(i, { value: e.target.value })} type="number" min={0} step={1} placeholder="0" className="input-field w-24" />
          <select name="item_due_anchor" value={r.anchor} onChange={(e) => update(i, { anchor: e.target.value as ScheduleRow['anchor'] })} className="input-field">
            <option value="">No due date</option>
            <option value="on_lock">After booking</option>
            <option value="before_event">Before event</option>
          </select>
          <div className="flex items-center gap-1">
            <input name="item_due_offset_days" value={r.offset} onChange={(e) => update(i, { offset: e.target.value })} type="number" min={0} step={1} placeholder="days" className="input-field w-20" aria-label="Days" />
            <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove installment" className="rounded-md p-2 text-ink/45 hover:bg-ink/5">
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { label: '', kind: 'percent', value: '', anchor: '', offset: '' }])}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
      >
        <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Add an installment
      </button>
    </div>
  );
}
