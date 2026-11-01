import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { badgesForPrint } from '@/lib/shop-badges';
import { badgePrintSvg, type PrintGround } from '@/lib/shop-badge-print';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/badges?badge=<key|all>&ground=light|white|dark|colour&colour=#RRGGBB
 *
 * 🖨 A supplier's badges as a print-ready vector (the pill, type outlined — `lib/shop-badge-print.ts`), for their
 * calling card and tarps (owner 2026-10-28). The facts are READ NOW (`readShopBadgeFacts`) and passed through
 * `badgesForPrint` — never a value saved when a design was made — so a file carries the badges the shop wears on the
 * day it is saved. Saved through the shipped `SaveFileLink` (`usePrintSave`): share sheet on a phone, a download on a
 * computer.
 *
 * `?view=facts` answers the badges' facts as JSON instead — what the Today line (`badge-earned-line.tsx`) compares
 * with the badges the supplier last dismissed, after the page has drawn (Today's own reads never grow for it).
 *
 * Own shop only: the signed-in user's shop (`fetchOwnVendorProfile`). A badge the shop does not wear today is refused
 * in words (404), never drawn.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to save your badges.' }, { status: 401 });
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return NextResponse.json({ error: 'Your shop could not be found.' }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const want = sp.get('badge') ?? 'all';
  const g = sp.get('ground');
  const ground: PrintGround = g === 'white' || g === 'dark' || g === 'colour' ? g : 'light';

  const facts = await readShopBadgeFacts(createAdminClient(), profile.vendor_profile_id);
  if (sp.get('view') === 'facts') {
    return NextResponse.json({ vendorId: profile.vendor_profile_id, facts }, { headers: { 'cache-control': 'private, no-store' } });
  }
  const all = badgesForPrint(facts);
  const picked = want === 'all' ? all : all.filter((b) => b.key === want);
  if (picked.length === 0) {
    return NextResponse.json(
      { error: want === 'all' ? 'Your shop has no badges to print yet.' : 'That badge isn’t on your shop today.' },
      { status: 404 },
    );
  }
  const svg = badgePrintSvg(picked, { ground, colour: sp.get('colour') ?? undefined });
  const name = want === 'all' ? 'setnayan-badges' : `setnayan-${want.replace(/[^a-z0-9]+/gi, '-')}`;
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'content-disposition': `attachment; filename="${name}.svg"`,
      'cache-control': 'private, no-store',
    },
  });
}
