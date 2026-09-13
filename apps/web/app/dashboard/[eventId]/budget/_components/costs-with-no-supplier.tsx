'use client';

// ============================================================================
// CostsWithNoSupplier — the couple writes down a cost, and only names a
// supplier if there is one. (BA7, 2026-09-03.)
//
// ── What this replaces ─────────────────────────────────────────────────────
// The page's own empty state used to read, in full: *"No vendors yet. Add a
// vendor first, then come back here to itemize costs."* It was accurate. It
// was also the defect — a couple who had bought their rings was told to invent
// a supplier before their own budget would accept the number.
//
// ── The fork is ONE optional field ─────────────────────────────────────────
// Owner, 2026-09-02: *"if they add a budget it means it is automatically
// locked. and it will automatically be on the marketplace as well. then they
// also get a QR Code to add that vendor to the app."* So the supplier input is
// last and optional, its helper text says exactly what filling it in DOES, and
// leaving it blank is a first-class outcome rather than a fallback.
//
// ⚖ THE COPY MUST NOT PROMISE WHAT THE PAGE DOES NOT DO. A supplier named here
// is LOCKED and OFF-PLATFORM, which are two different facts (owner: *"Adding
// them to their shortlist does not mean it is final, it just means they are
// not on the app."*). The confirmation says both, separately.
//
// Voice: no exclamation marks, no all-caps urgency, nothing a couple has to
// decode — the standing rule for post-launch copy on this project.
// ============================================================================

import { useActionState, useState } from 'react';
import { CheckCircle2, Plus, QrCode, ReceiptText, Trash2 } from 'lucide-react';

import { formatPhp } from '@/lib/budget';
import {
  EVENT_COST_LABEL_MAX,
  EVENT_COST_NOTE_MAX,
  type CostCategoryOption,
} from '@/lib/event-costs';
import {
  deleteEventCost,
  recordEventCost,
  type DeleteCostResult,
  type RecordCostResult,
} from '../cost-actions';

/** One already-recorded supplier-less cost, as the page reads it back. */
export type RecordedCost = {
  costId: string;
  label: string;
  categoryLabel: string;
  amountPhp: number;
  paidPhp: number;
  dueDate: string | null;
};

const INITIAL: RecordCostResult | null = null;

export function CostsWithNoSupplier({
  eventId,
  categories,
  costs,
  canEdit,
}: {
  eventId: string;
  categories: CostCategoryOption[];
  costs: RecordedCost[];
  /**
   * 🔒 A delegate who may READ the money still never moves it — the same rule
   * that decides whether `BudgetSetter` renders at all. The form is absent,
   * not rendered-and-refused; the recorded list stays, because reading is what
   * their access is for.
   */
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(costs.length === 0);

  const [state, formAction, isPending] = useActionState<RecordCostResult | null, FormData>(
    async (_prev, formData) => {
      const result = await recordEventCost(formData);
      // Only a clean save clears the fields. A failed one keeps every value
      // the couple typed — re-entering an amount because a due date was
      // malformed is the kind of small punishment that makes people give up.
      if (result.ok) setFormKey((k) => k + 1);
      return result;
    },
    INITIAL,
  );
  const [formKey, setFormKey] = useState(0);

  return (
    <section
      aria-labelledby="costs-no-supplier-heading"
      id="budget-own-costs"
      className="scroll-mt-24 space-y-4"
    >
      <div className="space-y-2">
        <h2 id="costs-no-supplier-heading" className="sn-sec text-2xl sm:text-3xl">
          Costs you pay yourself
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          The rings, the marriage licence, tips on the day, ang pao — money that
          has no supplier to bill you for it. Record it here and it counts in
          your totals and in the category table above, the same as anything else
          you have signed for.
        </p>
      </div>

      {costs.length > 0 ? (
        <ul className="space-y-2">
          {costs.map((c) => (
            <RecordedCostRow key={c.costId} eventId={eventId} cost={c} canEdit={canEdit} />
          ))}
        </ul>
      ) : null}

      {canEdit ? (
        <>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-ink/15 bg-white/60 px-4 py-2 text-sm font-medium text-ink transition hover:border-terracotta/50 hover:text-terracotta-700"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Record a cost
            </button>
          ) : (
            <form key={formKey} action={formAction} className="sn-tile space-y-4 sm:p-6">
              <input type="hidden" name="event_id" value={eventId} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What was it for?" htmlFor="cost_label">
                  <input
                    id="cost_label"
                    name="label"
                    type="text"
                    required
                    maxLength={EVENT_COST_LABEL_MAX}
                    placeholder="Wedding rings"
                    disabled={isPending}
                    className="input-field disabled:opacity-60"
                  />
                </Field>

                <Field label="Category" htmlFor="cost_category">
                  <select
                    id="cost_category"
                    name="plan_group_id"
                    required
                    defaultValue=""
                    disabled={isPending}
                    className="input-field disabled:opacity-60"
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="What it cost (PHP)" htmlFor="cost_amount">
                  <input
                    id="cost_amount"
                    name="amount_php"
                    type="text"
                    inputMode="decimal"
                    required
                    autoComplete="off"
                    placeholder="₱ 40,000"
                    disabled={isPending}
                    className="input-field font-mono tabular-nums disabled:opacity-60"
                  />
                </Field>

                <Field
                  label="Paid so far (PHP)"
                  htmlFor="cost_paid"
                  hint="Leave blank if you have not paid any of it yet."
                >
                  <input
                    id="cost_paid"
                    name="paid_php"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="₱ 0"
                    disabled={isPending}
                    className="input-field font-mono tabular-nums disabled:opacity-60"
                  />
                </Field>

                <Field label="Due date" htmlFor="cost_due" hint="Optional.">
                  <input
                    id="cost_due"
                    name="due_date"
                    type="date"
                    disabled={isPending}
                    className="input-field disabled:opacity-60"
                  />
                </Field>

                <Field label="Note" htmlFor="cost_note" hint="Optional.">
                  <input
                    id="cost_note"
                    name="note"
                    type="text"
                    maxLength={EVENT_COST_NOTE_MAX}
                    disabled={isPending}
                    className="input-field disabled:opacity-60"
                  />
                </Field>
              </div>

              {/* The fork. Last, optional, and its helper text says exactly what
                  filling it in does — a couple should never discover after the
                  fact that typing a name published something. */}
              <div className="rounded-lg border border-dashed border-ink/15 bg-cream/40 p-4">
                <Field
                  label="Who supplied it? (optional)"
                  htmlFor="cost_supplier"
                  hint="Leave blank for costs nobody supplies — a licence fee, tips, ang pao."
                >
                  <input
                    id="cost_supplier"
                    name="supplier_name"
                    type="text"
                    autoComplete="off"
                    placeholder="Name the shop or person"
                    disabled={isPending}
                    className="input-field disabled:opacity-60"
                  />
                </Field>
                <p className="mt-2 text-xs text-ink/60">
                  Name one and we save them to your suppliers as already booked,
                  with this cost on their card — and hand you a QR code so they
                  can claim a free Setnayan account.
                </p>
              </div>

              {state?.ok === false ? (
                <p
                  role="alert"
                  className="inline-flex items-center gap-2 rounded-full bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-800"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="button-primary px-5 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Saving…' : 'Record this cost'}
                </button>
                {costs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="text-sm text-ink/60 underline underline-offset-2 hover:text-ink"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </>
      ) : null}

      {/* Saved, with a supplier — the QR the owner asked for. Rendered from the
          existing /vendor/claim/[token] link, not a new one. */}
      {state?.ok === true && state.supplier ? (
        <SupplierInvite supplier={state.supplier} />
      ) : null}

      {state?.ok === true && !state.supplier ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1.5 text-xs font-medium text-success-800"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Recorded. It is in your totals above.
        </p>
      ) : null}

      {state?.ok === true && state.inviteUnavailable ? (
        <p
          role="status"
          className="text-xs text-ink/65"
        >
          The supplier is saved and the cost is counted. We could not make their
          invite code just now — open their card from your suppliers page to
          create it.
        </p>
      ) : null}
    </section>
  );
}

function SupplierInvite({
  supplier,
}: {
  supplier: NonNullable<Extract<RecordCostResult, { ok: true }>['supplier']>;
}) {
  return (
    <section
      aria-labelledby="supplier-invite-heading"
      className="rounded-2xl border border-success-200/80 bg-success-50/60 p-5"
    >
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success-100 text-success-800">
          <QrCode aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 space-y-1">
          <p
            id="supplier-invite-heading"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-success-800"
          >
            {supplier.name} is booked
          </p>
          <p className="text-sm text-ink/75">
            They are on your suppliers page as booked, and this cost sits on
            their card. They do not have a Setnayan account yet — show them this
            code and they can claim a free one.
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* Server-rendered SVG from lib/qr's renderUrlQrSvg — the same level-H,
            ink-on-cream code every other Setnayan QR uses. dangerouslySetInnerHTML
            is the shipped pattern for these (see print-sheet.tsx): the string is
            generated by the `qrcode` library on our own server from a URL we
            built, never from user input. */}
        <div
          aria-hidden
          className="shrink-0 rounded-xl border border-success-200 bg-white p-2"
          dangerouslySetInnerHTML={{ __html: supplier.qrSvg }}
        />
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
            Or send them the link
          </p>
          <code className="block break-all rounded-md border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70">
            {supplier.claimUrl}
          </code>
          <p className="text-[11px] text-ink/55">
            Free vendor account · link expires in 90 days · you can find this
            code again on their card in your suppliers page.
          </p>
        </div>
      </div>
    </section>
  );
}

function RecordedCostRow({
  eventId,
  cost,
  canEdit,
}: {
  eventId: string;
  cost: RecordedCost;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState<DeleteCostResult | null, FormData>(
    async (_prev, formData) => deleteEventCost(formData),
    null,
  );
  const owed = Math.max(0, cost.amountPhp - cost.paidPhp);

  return (
    <li className="sn-row flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <ReceiptText aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
          <span className="truncate">{cost.label}</span>
        </p>
        <p className="mt-1 text-xs text-ink/60">
          {cost.categoryLabel}
          {cost.dueDate ? ` · due ${cost.dueDate}` : ''}
        </p>
        {state?.ok === false ? (
          <p role="alert" className="mt-1 text-xs text-danger-800">
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-mono text-sm tabular-nums text-ink">{formatPhp(cost.amountPhp)}</p>
          <p className="font-mono text-[11px] tabular-nums text-ink/55">
            {/* Paid and owed, spelled the way the four locked ledger columns
                spell them, so one page uses one vocabulary. */}
            {formatPhp(cost.paidPhp)} paid · {formatPhp(owed)} owed
          </p>
        </div>
        {canEdit ? (
          <form action={formAction}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="cost_id" value={cost.costId} />
            <button
              type="submit"
              disabled={isPending}
              aria-label={`Delete ${cost.label}`}
              className="grid h-11 w-11 place-items-center rounded-md text-ink/40 transition hover:bg-danger-50 hover:text-danger-700 disabled:opacity-50"
            >
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink/55">{hint}</p> : null}
    </div>
  );
}
