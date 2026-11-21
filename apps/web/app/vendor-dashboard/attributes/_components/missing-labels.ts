/**
 * The visibility gate's missing fields, by their LABELS (controller 21 Nov 2026, the tool pages redraw v3 —
 * `supplier_tools_redraw_v3_fable.html` § 01): "Silhouettes, Fabric", never "silhouettes, fabric_type". The save names
 * the missing fields by key (`?missing=` — `saveVendorServiceAttribute`); the page says them as the form names them.
 * A key the schema no longer has falls back to the renderer's own spelling (underscores as spaces), never the raw key.
 * 🔒 attributes/the-missing-notice-names-labels.test.ts
 */
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';

export function missingLabels(fields: Readonly<Record<string, AttributeFieldDef>> | null | undefined, keys: readonly string[]): string[] {
  return keys.map((k) => {
    const label = fields?.[k]?.label?.trim();
    if (label) return label;
    const words = k.replaceAll('_', ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  });
}
