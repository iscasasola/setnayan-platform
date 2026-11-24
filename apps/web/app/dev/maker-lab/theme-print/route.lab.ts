import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INVITE_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { layoutPieceView, layoutTableSign, type PrintImages, type PrintSetData } from '@/lib/print-layout';
import { printLookFor, spotLayersFor } from '@/lib/print-pieces';
import { renderPrintSvg } from '@/lib/print-render-svg';

/**
 * 🧪 THE MAKER LAB'S PRINT DOOR FOR THE THEME SET (`maker-theme-set.tsx`, 23 Nov 2026) — the lab has no sample event and no
 * database, so the set's ticket, invitation and table sign are drawn HERE by the REAL print engine (`layoutPieceView`,
 * `layoutTableSign`, `renderPrintSvg`) on Maria & Jose's lab facts, in the theme asked. `?piece=art` answers the theme's
 * own picture (the theme card's picture). DEV-ONLY: production 404s it, and `.lab.ts` is never compiled into a build.
 *
 * The pictures are the corpus's own files (`SETNAYAN_SPECS_DIR`, the specs checkout: `assets/theme-art-2026-11-23/`,
 * `assets/theme-backgrounds-2026-09-24/`) — the same files the admin uploads to the media bucket. Without that folder a
 * piece is drawn on its paper colour, as production draws a theme whose picture is not uploaded yet.
 */
const PIECES = ['pass', 'invitation', 'table-sign', 'art'] as const;

async function themeArt(theme: keyof typeof INVITE_THEMES): Promise<Uint8Array | null> {
  const poster = INVITE_THEMES[theme].media?.poster;
  const dir = process.env.SETNAYAN_SPECS_DIR;
  if (!poster || !dir) return null;
  // r2://setnayan-media/theme-art/2026-11-23/perlas.webp → assets/theme-art-2026-11-23/perlas.webp
  const m = /^r2:\/\/[^/]+\/([^/]+)\/([^/]+)\/(.+)$/.exec(poster);
  if (!m) return null;
  return readFile(join(dir, 'assets', `${m[1]}-${m[2]}`, m[3]!)).then((b) => new Uint8Array(b)).catch(() => null);
}

export async function GET(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const url = new URL(req.url);
  const piece = (PIECES as readonly string[]).includes(url.searchParams.get('piece') ?? '') ? (url.searchParams.get('piece') as (typeof PIECES)[number]) : null;
  const theme = normalizeThemeId(url.searchParams.get('theme')) ?? 'house';
  if (!piece) return new Response('No such piece.', { status: 404 });
  const raw = await themeArt(theme);
  const sharp = (await import('sharp')).default;
  if (piece === 'art') {
    if (!raw) return new Response('No picture.', { status: 404 });
    const jpg = await sharp(raw).resize({ width: 360 }).jpeg({ quality: 72 }).toBuffer();
    return new Response(new Uint8Array(jpg), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
  }
  const still = raw ? new Uint8Array(await sharp(raw).resize({ width: 900 }).jpeg({ quality: 78 }).toBuffer()) : null;
  const data: PrintSetData = {
    names: { first: 'Maria', second: 'Jose' },
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    dateLabel: 'Saturday · December 12, 2026',
    ceremonyTime: '2:00 PM',
    ceremonyVenue: 'Seda Vertis North',
    receptionTime: null,
    receptionVenue: null,
    monogram: null,
    initials: 'M & J',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], setnayanMark: true },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: null,
    hasStill: Boolean(still),
    hasEventQr: false,
  };
  const spot = spotLayersFor(theme);
  const input = { look: printLookFor(theme), data, mode: 'screen' as const, foil: spot.foil, whiteInk: spot.whiteInk, format: null };
  const images: PrintImages = still ? { still: { bytes: still, mime: 'image/jpeg' } } : {};
  const doc = piece === 'table-sign' ? layoutTableSign(input, { label: 'Table 4', line: '', qrRef: null }) : layoutPieceView(piece, input);
  return new Response(renderPrintSvg(doc, images, { compact: true }), { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' } });
}
