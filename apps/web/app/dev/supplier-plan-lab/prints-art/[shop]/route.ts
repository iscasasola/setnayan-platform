import { NextResponse, type NextRequest } from 'next/server';
import { renderPrint } from '@/lib/supplier-prints-svg';
import { printMemberFrom, printQr, printShopFrom } from '@/lib/supplier-prints-shop';
import { DEFAULT_PRINT_DESIGN, PRINT_ALL, PRINT_PIECES, printAllFilename, printDesign, printFilename, printHidden, printPiece, printQrMode } from '@/lib/supplier-prints';
import { zipFiles } from '@/lib/supplier-prints-zip';

export const dynamic = 'force-dynamic';

/**
 * /dev/supplier-plan-lab/prints-art/<plain|long> — the lab's twin of `/api/vendor/prints`: the SAME renderer and the same facts
 * builder, on a fixture shop (no sign-in, no database). DEV-ONLY: production answers 404 before reading anything.
 *   long — the prototype's long-name sample with a seal, a rating and badges (the busiest a print gets)
 */
const LABEL: Record<string, string> = { catering: 'Catering', photo_video: 'Photo & video', host: 'Host', sound: 'Sound', lights: 'Lights' };

export async function GET(request: NextRequest, { params }: { params: Promise<{ shop: string }> }): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') return new NextResponse('Not found', { status: 404 });
  const sp = request.nextUrl.searchParams;
  const all = sp.get('piece') === PRINT_ALL;
  const piece = all ? PRINT_PIECES[0]! : printPiece(sp.get('piece'));
  if (!piece) return NextResponse.json({ error: 'That print isn’t one of the seven.' }, { status: 400 });
  const design = printDesign(sp.get('design')) ?? printDesign(DEFAULT_PRINT_DESIGN)!;
  const long = (await params).shop === 'long';
  const slug = long ? 'casa-buenaventura' : 'setnaprod';
  const origin = 'https://www.setnayan.com';
  const shop = printShopFrom({
    name: long ? 'Casa Buenaventura Catering & Events Services' : 'Setnayan Productions',
    slug,
    services: long ? ['catering'] : [],
    tagline: long ? null : 'Weddings & Events',
    facts: long
      ? { verified: true, completedEvents: 100, trusted: { trusted_avg_rating: 4.9, trusted_review_count: 32 }, inBusinessSinceYear: 2014, awards: [], nowYear: 2026 }
      : { verified: false, completedEvents: 0, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 },
    kindLabel: (k) => LABEL[k] ?? k,
    origin,
  });
  const save = sp.get('save') === '1';
  // PRINTS BY PURPOSE AND SIZE: the fixture's text facts (no pictures — the lab reads no storage), the sheet's
  // `On your prints ▾` (`hide`) and the member's own card (`who=me`) — the same opts the real route hands the renderer.
  const full = {
    ...shop,
    services: long ? ['Grazing tables', 'Plated dinner', 'Buffet for 200'] : ['Same-day edit film', 'Wedding photo + video', 'Live stream'],
    since: long ? 'In business since 2014' : null,
    area: long ? 'Serves up to 100 km around Tagaytay' : 'Tagaytay',
    ownDomain: long ? 'casabuenaventura.ph' : null,
  };
  const member = piece.id === 'card' && sp.get('who') === 'me' ? printMemberFrom('Juan dela Cruz', long ? 'Head chef' : null) : null;
  if (all) {
    // Save all — the same seven files the real route zips (`/api/vendor/prints?piece=all`).
    const qrAll = printQr(printQrMode(sp.get('qr')), origin, slug);
    const zip = await zipFiles(PRINT_PIECES.map((p) => ({ name: printFilename(p, design), body: renderPrint({ piece: p, design, shop: full, qr: qrAll, for: 'print', hide: printHidden(sp.get('hide')) }) })));
    return new NextResponse(new Uint8Array(zip), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${printAllFilename(design)}"` } });
  }
  const svg = renderPrint({ piece, design, shop: full, qr: printQr(printQrMode(sp.get('qr')), origin, slug), side: sp.get('side') === 'b' ? 'b' : 'f', for: save ? 'print' : 'screen', hide: printHidden(sp.get('hide')), member });
  return new NextResponse(svg, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', ...(save ? { 'content-disposition': `attachment; filename="${printFilename(piece, design, member?.name)}"` } : {}) },
  });
}
