'use client';

/**
 * /admin/vendor-recommendations client islands.
 *
 * Each component is a thin client wrapper around a server-action <form> so the
 * inputs post like plain form fields. No bespoke styling — these reuse the same
 * primitives the rest of the admin surface uses (input-field, the Clean
 * Editorial palette tokens, ConfirmForm / SubmitButton).
 *
 *   RecommendationRow — one map row: editable priority + rationale, opt-in +
 *                       active toggles, Save, and a Delete (confirm-guarded).
 *   AddRecommendation — leaf select + SKU select + opt-in + priority + rationale.
 *   FeedbackCard      — one pending vendor flag with Accept / Decline buttons.
 */

import { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  addRecommendation,
  updateRecommendation,
  deleteRecommendation,
  resolveFeedback,
} from './actions';

const labelCls = 'mb-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55';

export type LeafOption = { id: string; label: string };
export type SkuOption = { service_code: string; title: string };

export type MapRow = {
  id: number;
  tile_id: string;
  service_code: string;
  sku_title: string;
  is_opt_in: boolean;
  priority: number;
  rationale: string | null;
  is_active: boolean;
};

export type FeedbackRow = {
  id: number;
  tile_id: string;
  leaf_label: string;
  vendor_name: string;
  feedback_type: 'not_a_fit' | 'suggest_add';
  service_code: string | null;
  sku_title: string | null;
  note: string | null;
  created_at: string;
};

// ─── Map row ────────────────────────────────────────────────────────────
export function RecommendationRow({ row }: { row: MapRow }) {
  return (
    <div
      className={`rounded-2xl border border-ink/10 p-4 ${row.is_active ? 'bg-paper' : 'bg-ink/3'}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          {row.service_code}
        </code>
        <span className="text-sm font-medium text-ink">{row.sku_title}</span>
        {row.is_opt_in && (
          <span className="rounded bg-warn-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-warn-900">
            Opt-in
          </span>
        )}
        {!row.is_active && (
          <span className="rounded bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Inactive
          </span>
        )}
      </div>

      <form action={updateRecommendation} className="space-y-3">
        <input type="hidden" name="id" value={row.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <label className="block">
            <span className={labelCls}>Priority</span>
            <input
              name="priority"
              type="number"
              min="0"
              step="1"
              defaultValue={row.priority}
              aria-label={`Priority for ${row.service_code}`}
              className="input-field h-10 w-full tabular-nums"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Rationale</span>
            <input
              name="rationale"
              type="text"
              defaultValue={row.rationale ?? ''}
              placeholder="Why this amplifies their own deliverable"
              aria-label={`Rationale for ${row.service_code}`}
              className="input-field h-10 w-full"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_opt_in"
              defaultChecked={row.is_opt_in}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-sm text-ink/70">Opt-in (cannibalization risk)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={row.is_active}
              className="h-4 w-4 rounded border-ink/30"
            />
            <span className="text-sm text-ink/70">Active</span>
          </label>
          <div className="ml-auto">
            <SubmitButton
              className="rounded-md bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta/90"
              pendingLabel="Saving…"
            >
              Save
            </SubmitButton>
          </div>
        </div>
      </form>

      <ConfirmForm
        action={deleteRecommendation}
        title="Remove this recommendation?"
        confirmLabel="Remove"
        destructive
        message="This deletes the leaf → SKU pairing from the map. Vendors on this leaf will no longer see this recommendation. To hide it temporarily instead, untick Active and Save."
        className="mt-3 border-t border-ink/5 pt-3"
      >
        <input type="hidden" name="id" value={row.id} />
        <SubmitButton
          className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-700 transition hover:text-danger-900"
          pendingLabel="Removing…"
        >
          <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Remove from map
        </SubmitButton>
      </ConfirmForm>
    </div>
  );
}

// ─── Add recommendation ─────────────────────────────────────────────────
export function AddRecommendation({
  leaves,
  skus,
}: {
  leaves: LeafOption[];
  skus: SkuOption[];
}) {
  return (
    <ConfirmForm
      action={addRecommendation}
      title="Add this recommendation?"
      confirmLabel="Add to map"
      destructive={false}
      message="This adds a leaf → SKU pairing to the recommendation map. Keep the map sparse: a SKU should appear for a leaf only when it amplifies that vendor's own deliverable."
      className="rounded-2xl border border-ink/10 bg-paper p-4 sm:p-5"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Vendor leaf</span>
          <select name="tile_id" required defaultValue="" className="input-field h-10 w-full">
            <option value="" disabled>
              Pick a leaf…
            </option>
            {leaves.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Recommended SKU</span>
          <select name="service_code" required defaultValue="" className="input-field h-10 w-full">
            <option value="" disabled>
              Pick a SKU…
            </option>
            {skus.map((s) => (
              <option key={s.service_code} value={s.service_code}>
                {s.title} ({s.service_code})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <label className="block">
          <span className={labelCls}>Priority</span>
          <input
            name="priority"
            type="number"
            min="0"
            step="1"
            defaultValue={100}
            className="input-field h-10 w-full tabular-nums"
          />
        </label>
        <label className="block">
          <span className={labelCls}>Rationale (optional)</span>
          <input
            name="rationale"
            type="text"
            placeholder="Why this amplifies their own deliverable"
            className="input-field h-10 w-full"
          />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2">
        <input type="checkbox" name="is_opt_in" className="h-4 w-4 rounded border-ink/30" />
        <span className="text-sm text-ink/70">
          Opt-in — could compete with the vendor&apos;s own service (off by default; vendor must
          turn it on)
        </span>
      </label>
      <div className="mt-4">
        <SubmitButton
          className="inline-flex items-center gap-2 rounded-md bg-terracotta px-5 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta/90"
          pendingLabel="Adding…"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add recommendation
        </SubmitButton>
      </div>
    </ConfirmForm>
  );
}

// ─── Feedback card ──────────────────────────────────────────────────────
export function FeedbackCard({ row }: { row: FeedbackRow }) {
  const [decision, setDecision] = useState<'accepted' | 'declined'>('accepted');
  const isNotAFit = row.feedback_type === 'not_a_fit';

  const acceptHint = isNotAFit
    ? 'Accepting deactivates this recommendation on the leaf.'
    : 'Accepting adds the proposed SKU to the leaf (priority 100).';

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
            isNotAFit ? 'bg-danger-50 text-danger-900' : 'bg-success-50 text-success-900'
          }`}
        >
          {isNotAFit ? 'Not a fit' : 'Suggest add'}
        </span>
        <span className="text-sm font-medium text-ink">{row.vendor_name}</span>
        <span className="text-sm text-ink/55">·</span>
        <span className="text-sm text-ink/70">{row.leaf_label}</span>
      </div>

      <p className="text-sm text-ink/70">
        {row.sku_title ? (
          <>
            SKU: <span className="font-medium text-ink">{row.sku_title}</span>{' '}
            <code className="font-mono text-[11px] text-ink/50">({row.service_code})</code>
          </>
        ) : (
          <span className="italic text-ink/50">No SKU specified</span>
        )}
      </p>
      {row.note && <p className="mt-1.5 text-sm italic text-ink/60">“{row.note}”</p>}

      <ConfirmForm
        action={resolveFeedback}
        title={decision === 'accepted' ? 'Accept this flag?' : 'Decline this flag?'}
        confirmLabel={decision === 'accepted' ? 'Accept' : 'Decline'}
        destructive={decision === 'declined'}
        message={
          decision === 'accepted'
            ? acceptHint
            : 'Declining marks the flag resolved without changing the map.'
        }
        className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/5 pt-3"
      >
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="decision" value={decision} />
        <SubmitButton
          onClick={() => setDecision('accepted')}
          className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta/90"
          pendingLabel="Resolving…"
        >
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Accept
        </SubmitButton>
        <SubmitButton
          onClick={() => setDecision('declined')}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-ink/5"
          pendingLabel="Resolving…"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} /> Decline
        </SubmitButton>
        <span className="text-[11px] text-ink/45">{acceptHint}</span>
      </ConfirmForm>
    </div>
  );
}
