import { createAdminClient } from '@/lib/supabase/admin';

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
  range,
  selectedVendorId,
}: {
  result: VendorPickerResult;
  range: string;
  selectedVendorId: string | null;
}) {
  if (result.error || result.options === null) {
    return (
      <p className="mb-4 text-sm text-ink/70">
        The vendor list could not be read, so there is nobody to choose from
        here — that is not the same as having no vendors.
        {result.error ? ` (${result.error.message})` : ''}
      </p>
    );
  }

  return (
    <>
      <form method="get" className="mb-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value="funnels" />
        {/* Preserve the current range when changing vendor. */}
        <input type="hidden" name="range" value={range} />
        <label
          htmlFor="vendor"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/70"
        >
          Vendor
        </label>
        <select
          id="vendor"
          name="vendor"
          defaultValue={selectedVendorId ?? ''}
          className="input-field h-9 max-w-[22rem] py-0 text-sm"
        >
          <option value="">Select a vendor…</option>
          {result.options.map((v) => (
            <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
              {v.business_name}
            </option>
          ))}
        </select>
        <button type="submit" className="button-secondary h-9 px-3 text-xs">
          Show funnel
        </button>
      </form>
      {result.truncated ? (
        <p className="mb-4 text-xs text-ink/70">
          Listing the first {VENDOR_PICKER_CAP.toLocaleString()} vendors by
          name. There are more — a vendor missing from this list has not been
          ruled out, it is past the end of it.
        </p>
      ) : null}
    </>
  );
}
