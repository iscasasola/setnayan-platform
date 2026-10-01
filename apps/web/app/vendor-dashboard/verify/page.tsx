import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/verify — RETIRED as a standalone destination. The old
 * 701-line "12-document … unlock Pro Vendor" checklist page is superseded by
 * the current papers flow on My Shop (#5395): /vendor-dashboard/shop#get-verified
 * (see shop/_components/verify-section.tsx). This route now only redirects
 * there, preserving any deep-link query params (error / slot_saved / submitted
 * / withdrawn) the old page's own actions.ts still sets via redirect(), so an
 * in-flight bookmark or an old notification link still lands somewhere true.
 *
 * The old actions.ts (ensureDraftApplication / updateDocUpload /
 * submitApplication / withdrawApplication) was deleted 2026-10-02 (cleanup
 * slice B) — nothing called it; the papers flow's twins live in
 * shop/inline-docs-actions.ts.
 */
type Props = {
  searchParams: Promise<{
    error?: string;
    slot_saved?: string;
    submitted?: string;
    withdrawn?: string;
  }>;
};

export default async function VendorVerifyRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string' && value.length > 0) qs.set(key, value);
  }
  const query = qs.toString();
  redirect(`/vendor-dashboard/shop${query ? `?${query}` : ''}#get-verified`);
}
