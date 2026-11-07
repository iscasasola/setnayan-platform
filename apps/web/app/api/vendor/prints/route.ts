import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { siteOrigin } from '@/lib/site-origin';
import { renderPrint } from '@/lib/supplier-prints-svg';
import { printShopFrom, printQr } from '@/lib/supplier-prints-shop';
import { readPrintMember, readPrintShopExtras } from '@/lib/supplier-prints.server';
import { DEFAULT_PRINT_DESIGN, PRINT_ALL, PRINT_PIECES, printAllFilename, printDesign, printFilename, printHidden, printPiece, printQrMode } from '@/lib/supplier-prints';
import { zipFiles } from '@/lib/supplier-prints-zip';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/prints?piece=<card|standee|door|backdrop|tarp|rollup|table>&design=<look>&qr=<dates|shortlist|page|reviews>
 *                       [&side=b][&save=1][&hide=<blocks>][&who=me]
 *
 * PRINTS BY PURPOSE AND SIZE (owner 2026-11-06, "Yes ship it"): each piece carries what its size and reading distance
 * allow, read at print time by `readPrintShopExtras` (`lib/supplier-prints.server.ts`); `hide` = the blocks the sheet's
 * `On your prints ▾` switched off (the picture AND the Save file leave them out); `who=me` = the signed-in member's own
 * calling card (`readPrintMember`). No price, no phone, no email reaches a print.
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
  // 🗂 SAVE ALL (the prints prototype's head button): the seven print-ready files in one zip — each drawn exactly as its
  // own Save draws it (same look, code and `hide`), so the zip and the single saves can never differ.
  if (sp.get('piece') === PRINT_ALL) {
    const design = printDesign(sp.get('design')) ?? printDesign(DEFAULT_PRINT_DESIGN)!;
    const admin = createAdminClient();
    const own = profile as { vendor_profile_id: string; tagline?: string | null; logo_url?: string | null; portfolio_r2_keys?: string[] | null; location_city?: string | null; in_business_since_year?: number | null };
    const origin = siteOrigin();
    const [facts, kindLabel, extras] = await Promise.all([
      readShopBadgeFacts(admin, profile.vendor_profile_id),
      cardKindLabeller(),
      Promise.all(PRINT_PIECES.map((p) => readPrintShopExtras(admin, own, { piece: p.id, mode: 'print' }))),
    ]);
    const base = printShopFrom({
      name: (profile as { business_name?: string | null }).business_name ?? '',
      slug,
      services: ((profile as { services?: string[] | null }).services ?? []) as string[],
      tagline: (profile as { tagline?: string | null }).tagline ?? null,
      facts,
      kindLabel,
      origin,
    });
    const qr = printQr(printQrMode(sp.get('qr')), origin, slug);
    const hide = printHidden(sp.get('hide'));
    const zip = await zipFiles(
      PRINT_PIECES.map((p, i) => ({ name: printFilename(p, design), body: renderPrint({ piece: p, design, shop: { ...base, ...extras[i]! }, qr, for: 'print', hide }) })),
    );
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${printAllFilename(design)}"`, 'cache-control': 'private, no-store' },
    });
  }
  const piece = printPiece(sp.get('piece'));
  if (!piece) return NextResponse.json({ error: 'That print isn’t one of the seven.' }, { status: 400 });
  const design = printDesign(sp.get('design')) ?? printDesign(DEFAULT_PRINT_DESIGN)!;
  const mode = printQrMode(sp.get('qr'));
  const save = sp.get('save') === '1';

  const side = sp.get('side') === 'b' ? 'b' : 'f';
  // The member's own card (owner 2026-11-06, "Yes"): only the signed-in member's, only on the card — its front names
  // them; its back is the shop's, so the back needs no read of them.
  const asMember = piece.id === 'card' && sp.get('who') === 'me';
  const admin = createAdminClient();
  const own = profile as { vendor_profile_id: string; tagline?: string | null; logo_url?: string | null; portfolio_r2_keys?: string[] | null; location_city?: string | null; in_business_since_year?: number | null };
  const [facts, kindLabel, extras, member] = await Promise.all([
    readShopBadgeFacts(admin, profile.vendor_profile_id),
    cardKindLabeller(),
    readPrintShopExtras(admin, own, { piece: piece.id, mode: save ? 'print' : 'screen' }),
    asMember && (save || side === 'f') ? readPrintMember(admin, profile.vendor_profile_id, user.id) : Promise.resolve(null),
  ]);
  if (asMember && (save || side === 'f') && !member) {
    return NextResponse.json({ error: 'Add your name to your account first — your own card prints it.' }, { status: 409 });
  }
  const origin = siteOrigin();
  const shop = {
    ...printShopFrom({
      name: (profile as { business_name?: string | null }).business_name ?? '',
      slug,
      services: ((profile as { services?: string[] | null }).services ?? []) as string[],
      tagline: (profile as { tagline?: string | null }).tagline ?? null,
      facts,
      kindLabel,
      origin,
    }),
    ...extras,
  };
  const svg = renderPrint({ piece, design, shop, qr: printQr(mode, origin, slug), side, for: save ? 'print' : 'screen', hide: printHidden(sp.get('hide')), member });
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      ...(save ? { 'content-disposition': `attachment; filename="${printFilename(piece, design, member?.name)}"` } : {}),
      // A preview may be reused for a few minutes (switching back to a look is instant); a Save is always drawn fresh.
      'cache-control': save ? 'private, no-store' : 'private, max-age=300',
    },
  });
}
