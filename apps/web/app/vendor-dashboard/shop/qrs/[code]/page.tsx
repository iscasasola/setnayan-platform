import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { MY_QRS_HREF, MY_QR_WORDS, myQrCodeOf, myQrHref } from '@/lib/supplier-qr-codes';
import { ToolFail, ToolPage, ToolPin } from '../../../_components/tool-page';
import { MyQrCode } from '../_components/my-qr-code';
import { loadMyQrCode, type MyQrCodeData } from '../_components/my-qrs-data';

export const metadata = { title: 'My QRs · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/** The address a code opens, as a person reads it: no `https://`, no tag (the drawing's line under the title). */
function shownAddress(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, '')}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * 🔳 SHOP › MY QRs › ONE CODE (drawing frame "One QR, opened", v18): `/vendor-dashboard/shop/qrs/<code>` for the shop's
 * four codes — page · reviews · shortlist · dates. Anything else is 404. Shortlist's picks ride the address (`?et=` ·
 * `?cat=`), as they did on Promote. The ‹ goes back to My QRs.
 */
export default async function MyQrCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ et?: string; cat?: string }>;
}) {
  const [{ code: raw }, search] = await Promise.all([params, searchParams]);
  const code = myQrCodeOf(raw);
  if (!code) notFound();

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  const profile = await fetchOwnVendorProfile(supabase, user.id).catch(() => 'unread' as const);
  if (profile === null) redirect('/vendor-dashboard');

  const w = MY_QR_WORDS[code];
  const here = myQrHref(code, search);
  const slug = profile === 'unread' ? null : ((profile as { business_slug?: string | null }).business_slug ?? null);
  // No web address yet: every code is built on it — My QRs says "Name your shop first".
  if (profile !== 'unread' && !slug) redirect(MY_QRS_HREF);

  let d: MyQrCodeData | 'unread' = 'unread';
  if (profile !== 'unread' && slug) {
    d = await loadMyQrCode(
      supabase,
      {
        vendorProfileId: profile.vendor_profile_id,
        slug,
        shopName: (profile as { business_name?: string | null }).business_name?.trim() || 'Your shop',
        services: ((profile as { services?: string[] | null }).services ?? []) as string[],
      },
      code,
      search,
    ).catch(() => 'unread' as const);
  }

  return (
    <ToolPage name="my-qr">
      <ToolPin route={`${MY_QRS_HREF}/[code]`} title={w.name} sub={d === 'unread' ? w.line : <span className="truncate" data-my-qr-address="">{shownAddress(d.url)}</span>} />
      {d === 'unread' ? (
        <ToolFail title={`Couldn’t load your ${w.name} code`} line="Any copy you printed or shared still works." retryHref={here} data="my-qr" />
      ) : (
        <MyQrCode d={d} />
      )}
    </ToolPage>
  );
}
