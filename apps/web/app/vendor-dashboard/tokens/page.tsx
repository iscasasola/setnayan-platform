import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/tokens — RETIRED as a standalone page (owner 2026-07-01
 * "keep subscription and tokens in one place"). The token wallet now lives on
 * the unified Plan & tokens hub at /vendor-dashboard/subscription
 * (TokenWalletSection). This route permanently redirects there, forwarding the
 * apply-then-pay ?ordered / ?error flags so any in-flight links keep working.
 */

export const metadata = { title: 'Plan · Vendor' };

type Props = {
  searchParams: Promise<{ ordered?: string; error?: string }>;
};

export default async function VendorTokensRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  if (search.ordered) params.set('ordered', search.ordered);
  if (search.error) params.set('error', search.error);
  const qs = params.toString();
  redirect('/vendor-dashboard/subscription' + (qs ? `?${qs}` : ''));
}
