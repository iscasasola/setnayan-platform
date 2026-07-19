import { redirect } from 'next/navigation';

/**
 * Legacy /admin/referrals → Studio Studio redirect (Studio Studio slice 3).
 *
 * The couple referral rewards monitor now lives at /admin/studio?tab=referrals;
 * its body was re-homed byte-identical into
 * app/admin/studio/_surfaces/referrals-surface.tsx. This stub forwards the
 * incoming saved / error search params onto the studio route so the
 * setReferralProgramEnabled redirect (which still returns to
 * /admin/referrals?saved=1 / ?error=…) lands back on the Referrals tab. (The
 * referrals surface never rendered those banners — the redirect preserves that
 * behaviour; forwarding the params keeps deep links intact.)
 *
 * NOTE: actions.ts is intentionally NOT moved — the re-homed surface imports
 * setReferralProgramEnabled from here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminReferralsRedirect({ searchParams }: Props) {
  const search = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'referrals');
  for (const key of ['saved', 'error']) {
    const val = first(search[key]);
    if (val !== undefined) params.set(key, val);
  }
  redirect(`/admin/studio?${params.toString()}`);
}
