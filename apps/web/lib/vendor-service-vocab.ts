import { createAdminClient } from '@/lib/supabase/admin';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { labelForVendorCategory } from '@/lib/vendor-category-taxonomy';

/**
 * The display vocabulary the vendor Services picker (`<ServicesPicker>`) needs:
 * live admin-taxonomy labels for the 30 coarse `VENDOR_CATEGORIES` plus the
 * tradition / specialty canonical leaves offered as extra checkboxes.
 *
 * Extracted 2026-07-02 from `app/vendor-dashboard/profile/page.tsx` so the full
 * profile form AND the new inline My-Shop Business-Profile editor build the SAME
 * picker vocabulary from one place — they used to be one 75-line block that only
 * the /profile form ran, so any drift would let the two surfaces offer different
 * services. Degrade-to-safe internally: any taxonomy/DB hiccup returns
 * `{ serviceLabels: undefined, extraServiceLeaves: [] }`, which renders the
 * picker with the in-code `VENDOR_CATEGORY_LABEL` and no extra leaves — exactly
 * as the surface behaved before this vocabulary existed.
 */
export type VendorServicePickerVocab = {
  serviceLabels: Record<string, string> | undefined;
  extraServiceLeaves: { key: string; label: string }[];
};

export async function fetchVendorServicePickerVocab(): Promise<VendorServicePickerVocab> {
  let serviceLabels: Record<string, string> | undefined;
  let extraServiceLeaves: { key: string; label: string }[] = [];
  try {
    const tax = await getTaxonomy();
    serviceLabels = Object.fromEntries(
      VENDOR_CATEGORIES.map((c) => [c, labelForVendorCategory(c, tax)]),
    );

    // Tradition / specialty leaves (e.g. the Chinese specialist set —
    // date_fengshui_consultant, chinese_lauriat_caterer, tea_set_styling,
    // angpao_betrothal_supplier, lion_dance_troupe) are real marketplace tiles
    // that NO vendor could self-list under: the profile picker only ever
    // offered the 30 coarse VENDOR_CATEGORIES, so a leaf could never reach
    // vendor_profiles.services[]. We surface them as additional canonical
    // checkboxes. The SET is DB-driven: every marketplace-VISIBLE `tradition`
    // leaf that carries a faith tag (the genuine cultural specialists) PLUS the
    // de-faith'd Chinese banquet caterer (food rows are never faith-tagged per
    // the 2026-06-11 de-faith lock, so it's selected by an explicit allowlist).
    const FOOD_TRADITION_LEAVES: ReadonlySet<string> = new Set([
      'chinese_lauriat_caterer',
    ]);
    const extraLeafKeys = Object.entries(tax.map)
      .filter(([key, meta]) => {
        if (meta.tradition !== true) return false;
        if (meta.marketplaceHidden) return false;
        if (!meta.tile) return false; // must roll up into a real tile
        return meta.faith != null || FOOD_TRADITION_LEAVES.has(key);
      })
      .map(([key]) => key);

    if (extraLeafKeys.length > 0) {
      // Public marketplace display copy — the SAME source /explore reads
      // (canonical_service_schemas.display_name_en). Admin-scoped because RLS
      // gates the table for non-admin users; falls back to a title-cased key if
      // the read misses so a leaf never renders blank.
      const titleCase = (key: string) =>
        key
          .split('_')
          .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
          .join(' ');
      let nameByKey: Record<string, string> = {};
      try {
        const admin = createAdminClient();
        const { data: schemaRows } = await admin
          .from('canonical_service_schemas')
          .select('canonical_service, display_name_en')
          .in('canonical_service', extraLeafKeys);
        nameByKey = Object.fromEntries(
          ((schemaRows ?? []) as { canonical_service: string; display_name_en: string | null }[])
            .filter((r) => r.display_name_en && r.display_name_en.length > 0)
            .map((r) => [r.canonical_service, r.display_name_en as string]),
        );
      } catch (nameErr) {
        // eslint-disable-next-line no-console
        console.error('[vendor-service-vocab] tradition-leaf display names failed', nameErr);
      }
      extraServiceLeaves = extraLeafKeys
        .map((key) => ({ key, label: nameByKey[key] ?? titleCase(key) }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[vendor-service-vocab] taxonomy label lookup failed', err);
    serviceLabels = undefined;
    extraServiceLeaves = [];
  }

  return { serviceLabels, extraServiceLeaves };
}
