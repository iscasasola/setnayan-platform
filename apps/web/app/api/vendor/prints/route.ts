import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { siteOrigin } from '@/lib/site-origin';
import { renderPrint } from '@/lib/supplier-prints-svg';
import { printShopFrom, printQr } from '@/lib/supplier-prints-shop';
import { DEFAULT_PRINT_DESIGN, printDesign, printFilename, printPiece, printQrMode } from '@/lib/supplier-prints';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/prints?piece=<card|standee|door|backdrop|tarp|rollup|table>&design=<look>&qr=<dates|shortlist|page>
 *                       [&side=b][&save=1]
 *
 * 🖨 A supplier's print (Shop › Promote › Prints, owner-approved 5 Nov 2026) drawn by THE ONE renderer
 * (`renderPrint`, `lib/supplier-prints-svg.ts`):
 *   · without `save` — one side in piece units: what the sheet's gallery shows and what "See it in use" warps onto
 *     the photos;
 *   · `save=1`       — the print-ready file: exact size in millimetres, 3 mm bleed, type outlined, the card's front
 *                      AND back — saved through the shipped `SaveFileLink` (share sheet on a phone, a download on a
 *                      computer), the badge print's own pattern (`/api/vendor/badges`).
 *
 * Nothing is stored: every file is drawn on request from facts READ NOW (the shop's name, services and badges), so
 * there is no export to sweep. Own shop only (`fetchOwnVendorProfile`); a shop with no address yet is refused in words —
 * every printed code is built from it.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to save your prints.' }, { status: 401 });
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: 'Your shop could not be found.' }, { status: 404 });
  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  if (!slug) return NextResponse.json({ error: 'Name your shop first — your prints are built from its web address.' }, { status: 409 });

  const sp = request.nextUrl.searchParams;
  const piece = printPiece(sp.get('piece'));
  if (!piece) return NextResponse.json({ error: 'That print isn’t one of the seven.' }, { status: 400 });
  const design = printDesign(sp.get('design')) ?? printDesign(DEFAULT_PRINT_DESIGN)!;
  const mode = printQrMode(sp.get('qr'));
  const save = sp.get('save') === '1';

  const [facts, kindLabel] = await Promise.all([readShopBadgeFacts(createAdminClient(), profile.vendor_profile_id), cardKindLabeller()]);
  const origin = siteOrigin();
  const shop = printShopFrom({
    name: (profile as { business_name?: string | null }).business_name ?? '',
    slug,
    services: ((profile as { services?: string[] | null }).services ?? []) as string[],
    tagline: (profile as { tagline?: string | null }).tagline ?? null,
    facts,
    kindLabel,
    origin,
  });
  const svg = renderPrint({ piece, design, shop, qr: printQr(mode, origin, slug), side: sp.get('side') === 'b' ? 'b' : 'f', for: save ? 'print' : 'screen' });
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      ...(save ? { 'content-disposition': `attachment; filename="${printFilename(piece, design)}"` } : {}),
      // A preview may be reused for a few minutes (switching back to a look is instant); a Save is always drawn fresh.
      'cache-control': save ? 'private, no-store' : 'private, max-age=300',
    },
  });
}
