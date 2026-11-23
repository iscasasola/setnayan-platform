'use client';
import { FieldPick } from '@/app/admin/_components/field-pick';

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
import { actionButtonClass } from '@/components/action-button-class';
import {
  addRecommendation,
  updateRecommendation,
  deleteRecommendation,
  resolveFeedback,
} from './actions';

const labelCls = 'mb-1 block text-[13px] text-[color:var(--m-slate-2)]';

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
      className={`py-4 ${row.is_active ? '' : 'opacity-70'}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <code className="text-[13px] text-[color:var(--m-slate-2)]">
          {row.service_code}
        </code>
        <span className="text-sm font-medium text-ink">{row.sku_title}</span>
        {row.is_opt_in && (
          <span className="text-[13px] font-semibold text-warn-800">
            Opt-in
          </span>
        )}
        {!row.is_active && (
          <span className="text-[13px] font-semibold text-ink/55">
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
              className={actionButtonClass('brand')}
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
        message="This deletes the leaf → SKU pairing from the map. Suppliers on this leaf will no longer see this recommendation. To hide it temporarily instead, untick Active and Save."
        className="mt-2"
      >
        <input type="hidden" name="id" value={row.id} />
        <SubmitButton
          className={actionButtonClass('danger', { quiet: true })}
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
      message="This adds a leaf → SKU pairing to the recommendation map. Keep the map sparse: a SKU should appear for a leaf only when it amplifies that supplier's own deliverable."
      className="sn-frame px-4 py-4 sm:py-5"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Supplier leaf</span>
          <FieldPick name="tile_id" label="Supplier leaf" placeholder="Pick a leaf…" required className="min-h-11 w-full" options={leaves.map((l) => ({ key: l.id, label: l.label }))} />
        </label>
        <label className="block">
          <span className={labelCls}>Recommended SKU</span>
          <FieldPick name="service_code" label="Recommended SKU" placeholder="Pick a SKU…" required className="min-h-11 w-full" options={skus.map((s) => ({ key: s.service_code, label: `${s.title} (${s.service_code})` }))} />
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
          Opt-in — could compete with the supplier&apos;s own service (off by default; supplier must
          turn it on)
        </span>
      </label>
      <div className="mt-4">
        <SubmitButton
          className={actionButtonClass('brand', { main: true })}
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
    <div className="py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`text-[13px] font-semibold ${isNotAFit ? 'text-danger-700' : 'text-success-700'}`}
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
            <code className="text-[12px] text-ink/50 tabular-nums">({row.service_code})</code>
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
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="decision" value={decision} />
        <SubmitButton
          onClick={() => setDecision('accepted')}
          className={actionButtonClass('ok')}
          pendingLabel="Resolving…"
        >
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Accept
        </SubmitButton>
        <SubmitButton
          onClick={() => setDecision('declined')}
          className={actionButtonClass('neutral')}
          pendingLabel="Resolving…"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} /> Decline
        </SubmitButton>
        <span className="text-[13px] text-[color:var(--m-slate-2)]">{acceptHint}</span>
      </ConfirmForm>
    </div>
  );
}
