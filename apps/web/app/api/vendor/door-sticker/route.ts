import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { badgesForPrint } from '@/lib/shop-badges';
import { siteOrigin } from '@/lib/site-origin';
import { ownDatesUrl, ownPageUrl } from '@/lib/supplier-qr-codes';
import { doorStickerCodeOf, doorStickerFileName, doorStickerFormatOf, doorStickerSizeOf } from '@/lib/door-sticker';
import { doorStickerPdf, doorStickerSvg } from '@/lib/door-sticker-print';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/door-sticker?code=page|dates&size=door|window&format=svg|pdf
 *
 * 🚪 "We are part of SETNAYAN" — the shop's door or window sticker as a print-ready vector (owner 2026-11-05, *"add
 * them to the marketing tools"*; `lib/door-sticker-print.ts`). Download only — Setnayan neither orders nor prints it.
 *
 *   · The code is the shop's OWN permanent code — My page (`/v/<slug>`) or Check a date (`/v/<slug>/dates`), the SAME
 *     addresses the QR card shows. A scan opens a page that already exists; there is no sticker page.
 *   · The badges are READ NOW (`readShopBadgeFacts` → `badgesForPrint`), exactly as `/api/vendor/badges` reads them, so
 *     the file carries the badges the shop wears on the day it is saved. A shop with none prints without the row.
 *
 * Own shop only: the signed-in user's shop (`fetchOwnVendorProfile`). A shop without a web address yet is refused in
 * words — every code is built from it.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to save your door sticker.' }, { status: 401 });
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: 'Your shop could not be found.' }, { status: 404 });
  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  if (!slug) return NextResponse.json({ error: 'Name your shop first — the sticker’s code is built from its web address.' }, { status: 409 });

  const sp = request.nextUrl.searchParams;
  const code = doorStickerCodeOf(sp.get('code'));
  const size = doorStickerSizeOf(sp.get('size'));
  const format = doorStickerFormatOf(sp.get('format'));
  const url = code === 'dates' ? ownDatesUrl(siteOrigin(), slug) : ownPageUrl(siteOrigin(), slug); // 💳 ?src=own
  const shopName = (profile as { business_name?: string | null }).business_name?.trim() || 'Our shop';

  const facts = await readShopBadgeFacts(createAdminClient(), (profile as { vendor_profile_id: string }).vendor_profile_id);
  const input = { shopName, url, code, size, badges: badgesForPrint(facts) };
  const filename = doorStickerFileName(code, size, format);
  const headers = { 'content-disposition': `attachment; filename="${filename}"`, 'cache-control': 'private, no-store' };

  if (format === 'pdf') {
    const pdf = await doorStickerPdf(input);
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: { ...headers, 'content-type': 'application/pdf' } });
  }
  return new NextResponse(doorStickerSvg(input), { status: 200, headers: { ...headers, 'content-type': 'image/svg+xml; charset=utf-8' } });
}
