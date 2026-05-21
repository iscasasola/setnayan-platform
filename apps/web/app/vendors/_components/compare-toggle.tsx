'use client';

import { Check, GitCompare } from 'lucide-react';
import { useCompare } from './compare-provider';

/**
 * Per-card "Compare" toggle. Adds / removes the vendor from the
 * marketplace compare basket (max 3, backed by localStorage).
 *
 * Surfaces in the same row as `SaveVendorButton` on each marketplace
 * card. Unlike Save, this works for anonymous browsers too — the
 * compare page renders public vendor info without an auth check.
 */
export function CompareToggle({
  vendorProfileId,
}: {
  vendorProfileId: string;
}) {
  const { isSelected, isFull, toggle, hydrated } = useCompare();
  const selected = isSelected(vendorProfileId);
  // Disable when the basket is full AND this row isn't already in it.
  // Pre-hydration we render as "Compare" idle to keep server + client
  // markup identical and avoid a hydration warning; the click handler
  // still works because state populates before user interaction.
  const disabled = hydrated && !selected && isFull;

  return (
    <button
      type="button"
      onClick={() => toggle(vendorProfileId)}
      disabled={disabled}
      aria-pressed={selected}
      title={
        selected
          ? 'Remove from compare'
          : disabled
            ? 'Compare basket is full (3 max) — clear one first'
            : 'Add to compare'
      }
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-60 ${
        selected
          ? 'border-terracotta/60 bg-terracotta/15 text-terracotta-700 hover:bg-terracotta/20'
          : 'border-ink/15 bg-cream text-ink/80 hover:border-terracotta/50 hover:text-terracotta'
      }`}
    >
      {selected ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          In compare
        </>
      ) : (
        <>
          <GitCompare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Compare
        </>
      )}
    </button>
  );
}
