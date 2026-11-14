import { createAdminClient } from '@/lib/supabase/admin';
import { InsightsParamPick } from './insights-param-pick';

/**
 * The vendor picker for the Funnels drill-down.
 *
 * ── Why this is its own file ───────────────────────────────────────────────
 * It owns a READ, and that read is CAPPED. Everywhere else in the admin
 * console a capped read is disclosed by <ConsoleTable>'s `cap`, but this list
 * is rendered as a <select> — there is no table to hang the disclosure on. So
 * the cap, the query and the sentence that discloses it live together in one
 * short file, where they cannot drift apart, instead of sitting in a 400-line
 * surface whose other reads have nothing to do with them.
 *
 * ⚠ IT ALSO USED TO SWALLOW ITS OWN ERROR. The call site was
 * `const { data: vendorPickRows } = await admin…` — the error was destructured
 * away and never bound, so a refused read produced a picker containing nothing
 * but "Select a vendor…". An admin reads that as "we have no vendors", which
 * is a statement about the business, made by a query that failed.
 *
 * (Measured in production 2026-08-17: 2 vendor profiles exist, so the 500-row
 * cap truncates nothing today. The disclosure only appears when it bites.)
 *
 * Re-drawn 2026-11-14 onto the approved drawing (`admin_pub/insights.html` ›
 * Funnels): the native <select> + "Show funnel" GET form became the one
 * dropdown row (`InsightsParamPick`, moves `?vendor=` and keeps `?range=`). The
 * cap disclosure is now the list's own last, greyed line — its sentence in that
 * line's ⓘ — exactly where a missing supplier would be looked for. Same read,
 * same cap, same honest failure sentence.
 */

const VENDOR_PICKER_CAP = 500;

type VendorPickRow = {
  vendor_profile_id: string;
  business_name: string;
  business_slug: string | null;
};

export type VendorPickerResult = {
  options: VendorPickRow[] | null;
  error: { message: string } | null;
  truncated: boolean;
};

/** Read the vendors offered in the drill-down picker, newest failure included. */
export async function fetchVendorPickerOptions(): Promise<VendorPickerResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug')
    .order('business_name', { ascending: true })
    .limit(VENDOR_PICKER_CAP);

  const options = data as VendorPickRow[] | null;
  return {
    options,
    error: error ? { message: error.message } : null,
    truncated: (options?.length ?? 0) >= VENDOR_PICKER_CAP,
  };
}

export function VendorPicker({
  result,
  selectedVendorId,
}: {
  result: VendorPickerResult;
  /** The current range. The pick keeps `?range=` on its own (it moves only `?vendor=`), so nothing reads this now. */
  range: string;
  selectedVendorId: string | null;
}) {
  if (result.error || result.options === null) {
    return (
      <p role="alert" className="my-2 rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
        The supplier list could not be read, so there is nobody to choose from
        here — that is not the same as having no suppliers.
        {result.error ? ` (${result.error.message})` : ''}
      </p>
    );
  }

  const options = [
    { key: '', label: 'Select a supplier…' },
    ...result.options.map((v) => ({ key: v.vendor_profile_id, label: v.business_name })),
    ...(result.truncated
      ? [
          {
            key: '__past-the-cap',
            label: `Listing the first ${VENDOR_PICKER_CAP.toLocaleString()} suppliers by name`,
            disabledNote:
              'There are more — a supplier missing from this list has not been ruled out, it is past the end of it.',
          },
        ]
      : []),
  ];

  return (
    <InsightsParamPick
      name="Supplier"
      param="vendor"
      value={selectedVendorId ?? ''}
      options={options}
      about="Their views → inquiries → quotes → booked funnel, for the range above."
    />
  );
}
