import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { AttributeFieldRenderer } from '@/app/vendor-dashboard/attributes/_components/attribute-field-renderer';
import type { CategoryRefinements } from '@/lib/vendor-service-attributes';
import { saveServiceRefinements } from '../refinement-actions';

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
}: {
  canonicalService: string;
  refinements: CategoryRefinements;
  initial: Record<string, unknown>;
  leafLabel: string;
}) {
  const keys = Object.keys(refinements.fields);
  if (keys.length === 0) return null;
  const facetSet = new Set(refinements.filter_facets);

  return (
    <form
      action={saveServiceRefinements}
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <input type="hidden" name="canonical_service" value={canonicalService} />
      <input type="hidden" name="refinement_keys" value={keys.join(',')} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--m-ink)' }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            Refinements
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
            Tag your {leafLabel} details — couples filter by these. Applies to
            all your {leafLabel} listings.
          </p>
        </div>
        <Link
          href={`/vendor-dashboard/attributes#${encodeURIComponent(canonicalService)}`}
          className="shrink-0 text-[11px] underline"
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
          className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-[11px] font-medium"
          pendingLabel="Saving…"
        >
          Save refinements
        </SubmitButton>
      </div>
    </form>
  );
}
