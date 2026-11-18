import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { AttributeFieldRenderer } from '@/app/vendor-dashboard/attributes/_components/attribute-field-renderer';
import type { CategoryRefinements } from '@/lib/vendor-service-attributes';
import { saveServiceRefinements } from '../refinement-actions';
import { StayForm } from '@/app/_components/stay-form';

/**
 * Inline "refinement chips" on the fast service-card form (v20 gap closer).
 *
 * Surfaces the leaf's CHIP-shaped, category-specific refinements
 * (multi_select / enum / boolean) right on the card so a vendor can tag facets
 * without detouring to the full /vendor-dashboard/attributes tool. Reuses the
 * same AttributeFieldRenderer the full tool uses (identical look + `field__`
 * names), inside its own sibling form — mirroring the "Comes with" / payment
 * schedule pattern (each edits one concern, saves on its own).
 *
 * Refinements are keyed by canonical_service (= the service's category), so a
 * single row backs every listing under the leaf — the copy says so, and the
 * save action MERGES (never wipes the heavier fields set in the full tool).
 * Renders nothing when the category has no chip-shaped refinements.
 */
export function RefinementsEditor({
  canonicalService,
  refinements,
  initial,
  leafLabel,
  bare = false,
}: {
  canonicalService: string;
  refinements: CategoryRefinements;
  initial: Record<string, unknown>;
  leafLabel: string;
  /**
   * The fields only, posting with the card's ONE save (the simpler maker's "Details" fold, 2026-10-14): no `<form>`,
   * no "Save refinements". `commitVendorService` merges them through the same body as `saveServiceRefinements`
   * (`mergeServiceRefinements`) — chip fields only, never a wipe of the heavier ones.
   */
  bare?: boolean;
}) {
  const keys = Object.keys(refinements.fields);
  if (keys.length === 0) return null;
  const facetSet = new Set(refinements.filter_facets);
  if (bare) {
    return (
      <div className="space-y-4" data-refinements-bare="">
        <input type="hidden" name="canonical_service" value={canonicalService} />
        <input type="hidden" name="refinement_keys" value={keys.join(',')} />
        <p className="text-[13px] text-[color:var(--m-slate-2)]">Shared by every {leafLabel} card · couples filter by these.</p>
        {Object.entries(refinements.fields).map(([k, def]) => (
          <AttributeFieldRenderer key={k} fieldKey={k} def={def} initial={initial[k]} isFacet={facetSet.has(k)} />
        ))}
        <Link
          href={`/vendor-dashboard/attributes#${encodeURIComponent(canonicalService)}`}
          className="sn-press inline-flex min-h-11 items-center text-sm font-semibold text-sn-accent"
        >
          More details ›
        </Link>
      </div>
    );
  }

  return (
    <StayForm
      door="svServices.saveServiceRefinements"
      action={saveServiceRefinements}
      // Rule 2 · a section between hairlines, not a box.
      className="border-y py-3"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <input type="hidden" name="canonical_service" value={canonicalService} />
      <input type="hidden" name="refinement_keys" value={keys.join(',')} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: 'var(--m-ink)' }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            Refinements
          </p>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--m-slate-2)' }}>
            Tag your {leafLabel} details — couples filter by these. Applies to
            all your {leafLabel} listings.
          </p>
        </div>
        <Link
          href={`/vendor-dashboard/attributes#${encodeURIComponent(canonicalService)}`}
          className="inline-flex min-h-11 shrink-0 items-center text-[13px] underline"
          style={{ color: 'var(--m-slate-2)' }}
        >
          More details →
        </Link>
      </div>
      <div className="mt-3 space-y-4">
        {Object.entries(refinements.fields).map(([k, def]) => (
          <AttributeFieldRenderer
            key={k}
            fieldKey={k}
            def={def}
            initial={initial[k]}
            isFacet={facetSet.has(k)}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <SubmitButton
          // Rule 3 · the green button piece (it saves), 44 high.
          className="ab ab-ok !min-h-11"
          pendingLabel="Saving…"
        >
          <span className="lbl">Save refinements</span>
        </SubmitButton>
      </div>
    </StayForm>
  );
}
