import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/payment-options — forwards to Your details › How clients pay you (step 5, 2026-10-14; it was
 * My Shop's `?tab=payments` fold from 2026-07-12). The surface lives on in ./surface.tsx, embedded in that fold. This
 * stub keeps every old deep-link working — including the surface's own actions, which still redirect here with
 * `?msg=` / `?error=` — and forwards those params so the flash shows on the open fold.
 */
export default async function RedirectPaymentOptions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v.length > 0 && k !== 'tab') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/vendor-dashboard/profile${query ? `?${query}` : ''}#pay`);
}
