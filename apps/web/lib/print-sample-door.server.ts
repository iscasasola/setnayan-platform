import 'server-only';
import { NextResponse } from 'next/server';
import { findSampleEventId } from '@/app/tour/_lib/sample-event';
import { normalizeThemeId } from '@/lib/invite-themes';
import { loadPrintSet } from '@/lib/print-set.server';
import { layoutPieceView } from '@/lib/print-layout';
import { renderPrintSvg } from '@/lib/print-render-svg';
import { spotLayersFor } from '@/lib/print-pieces';
import { samplePreviewCacheControl } from '@/lib/print-preview-cache';

/**
 * 🖼 THE SAMPLE DOOR — `/api/hub-print/<piece>?sample=1&theme=<id>&mode=screen`,
 * asked by the print route BEFORE its host gate (`app/api/hub-print/[piece]/route.ts`)
 * (owner 2026-09-28, "THE THEME GALLERY SHOWS A CLEAN SAMPLE EVENT HUB"). The Details gallery shows
 * the curated sample event's prints in each theme, the same for every couple.
 *
 * ⛔ IT CAN ONLY EVER DRAW THE SAMPLE. The event is found by the tour's one
 * pinned read (`findSampleEventId`: `is_sample = TRUE` + the hardcoded slug),
 * never from the request — an `event=` beside `sample=1` is IGNORED. So no
 * sign-in is asked: there is nothing here but the public sample page's own
 * content. Only the on-screen pictures of the gallery's three pieces; never a
 * PDF, a pass batch, the whole set or any free-group document — no PDF
 * renderer is even imported here.
 *
 * Its own module, so the route's own guards (`print-pieces.test.ts`: `?theme=`
 * is read ONCE on the couple's path, every renderer inside the Pro-checked
 * block) keep describing the couple's path exactly; this door is held by
 * `theme-print-previews-wear-the-theme.test.ts`.
 */
export const SAMPLE_PIECES = ['invitation', 'details', 'pass'] as const;

export async function sampleView(rawPiece: string, url: URL): Promise<NextResponse> {
  const piece = (SAMPLE_PIECES as readonly string[]).includes(rawPiece) ? (rawPiece as (typeof SAMPLE_PIECES)[number]) : null;
  if (!piece || url.searchParams.get('mode') !== 'screen') {
    return new NextResponse('The sample shows its invitation, details and pass on screen only.', { status: 404 });
  }
  const sampleId = await findSampleEventId();
  if (!sampleId) return new NextResponse('No sample.', { status: 404 });
  const theme = normalizeThemeId(url.searchParams.get('theme')) ?? 'house';
  const set = await loadPrintSet(sampleId, { mode: 'screen', previewTheme: theme });
  if (!set) return new NextResponse('No sample.', { status: 404 });
  const spot = spotLayersFor(set.theme);
  const svg = renderPrintSvg(
    layoutPieceView(piece, { look: set.look, data: set.data, mode: 'screen', foil: spot.foil, whiteInk: spot.whiteInk, format: null }),
    set.images,
    { compact: true },
  );
  return new NextResponse(svg, {
    status: 200,
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': samplePreviewCacheControl(url.searchParams.get('v')) },
  });
}

