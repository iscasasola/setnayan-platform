import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { MY_QRS_HREF } from '@/lib/supplier-qr-codes';
import { ToolFail, ToolPage, ToolPin } from '../../_components/tool-page';
import { MyQrsList } from './_components/my-qrs-list';

export const metadata = { title: 'My QRs · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * 🔳 SHOP › MY QRs — every QR code the shop has (owner 23 Nov 2026, verbatim: *"this also means we have to get cloud
 * create a QR Page that will replace our current QR page."*; DECISION_LOG "STORE DRAWING v13→v18 RULINGS" (1); drawing
 * `Setnayan-specs/prototypes/supplier_store_graphs_badges_2026-11-23/`, frame "My QRs", v18).
 *
 * It replaces Promote's QR part: the cover's QR sheet and the Promote page draw this same list (`MyQrsList`), and every
 * old `?mode=` link (Promote, Customers › QR codes, Today) lands on the code's own page here (`myQrHref`). Booked ·
 * one-use and Crew stay per event on Customers › QR codes.
 *
 * One read: the shop (its web address and name). A refused read is said, with Try again — never an empty list.
 */
export default async function MyQrsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // 🔑 A refused read throws (`fetchOwnVendorProfile`); only a proven "no shop" is null.
  const profile = await fetchOwnVendorProfile(supabase, user.id).catch(() => 'unread' as const);
  if (profile === null) redirect('/vendor-dashboard');

  return (
    <ToolPage name="my-qrs">
      <ToolPin route={MY_QRS_HREF} title="My QRs" sub="Every QR code your shop has" />
      {profile === 'unread' ? (
        <ToolFail title="Couldn’t load your QR codes" line="Every code you printed or shared still works." retryHref={MY_QRS_HREF} data="my-qrs" />
      ) : (
        <MyQrsList canShare={Boolean((profile as { business_slug?: string | null }).business_slug)} setupHref="/vendor-dashboard/shop" />
      )}
    </ToolPage>
  );
}
