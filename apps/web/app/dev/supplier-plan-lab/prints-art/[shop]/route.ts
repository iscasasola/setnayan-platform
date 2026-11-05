import { NextResponse, type NextRequest } from 'next/server';
import { renderPrint } from '@/lib/supplier-prints-svg';
import { printQr, printShopFrom } from '@/lib/supplier-prints-shop';
import { DEFAULT_PRINT_DESIGN, printDesign, printFilename, printPiece, printQrMode } from '@/lib/supplier-prints';

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
  const piece = printPiece(sp.get('piece'));
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
  const svg = renderPrint({ piece, design, shop, qr: printQr(printQrMode(sp.get('qr')), origin, slug), side: sp.get('side') === 'b' ? 'b' : 'f', for: save ? 'print' : 'screen' });
  return new NextResponse(svg, {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', ...(save ? { 'content-disposition': `attachment; filename="${printFilename(piece, design)}"` } : {}) },
  });
}
