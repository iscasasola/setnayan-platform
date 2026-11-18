import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { BADGE_ART_H, BADGE_ART_W, badgeArtSrc } from '@/lib/shop-badge-shelf';
import { sealPrintSvg, SEAL_ART_H, SEAL_ART_W } from '@/lib/print-seal-art';
import { VERIFIED_V84_SIDE, verifiedV84Svg } from '@/lib/verified-v84-art';
import type { PrintBadge, PrintBadgeArt } from '@/lib/print-badges-v84';

/**
 * 🖨 EACH PRINT BADGE'S v84 ART, RESOLVED (node only: the files and `sharp`) — what the print renderers place:
 *   Verified  the v84 blue check, vector (the small look: no letters);
 *   a tier    the v84 tier picture (`public/badges/v84/<family>-<tier>.webp`), as PNG (a PDF and a print shop's
 *             software take PNG; WebP they may not);
 *   a seal    the v84 seal with its award year, every letter outlined (`lib/print-seal-art.ts`), plus a PNG of it for
 *             the PDF backend.
 * 🔒 lib/print-badges-v84.test.ts
 */

/** The tier pictures, decoded once per instance (35 files of ~15 KB). */
const tierPng = new Map<string, Promise<Uint8Array>>();
function tierPicture(src: string): Promise<Uint8Array> {
  let p = tierPng.get(src);
  if (!p) {
    // `public/badges/v84/*.webp` is traced into the print routes (next.config.ts outputFileTracingIncludes)
    p = readFile(join(process.cwd(), 'public', src.replace(/^\//, ''))).then((b) => sharp(b).png().toBuffer()).then((b) => new Uint8Array(b));
    p.catch(() => tierPng.delete(src));
    tierPng.set(src, p);
  }
  return p;
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

/** Each badge's v84 art, ready to place. `uid` keeps each copy's def ids apart on one print. */
export async function resolvePrintBadgeArt(badges: readonly PrintBadge[], uid = 'pb'): Promise<PrintBadgeArt[]> {
  return Promise.all(
    badges.map(async (badge, i): Promise<PrintBadgeArt> => {
      const id = `${uid}${i}`;
      if (badge.kind === 'verified') {
        const S = VERIFIED_V84_SIDE;
        return { badge, w: S, h: S, svg: verifiedV84Svg({ uid: id, size: S, word: false }), png: null };
      }
      if (badge.kind === 'tier') {
        const png = await tierPicture(badgeArtSrc(badge.family, badge.tier));
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_ART_W}" height="${BADGE_ART_H}" viewBox="0 0 ${BADGE_ART_W} ${BADGE_ART_H}" role="img" aria-label="${badge.label}">` +
          `<image href="data:image/png;base64,${b64(png)}" width="${BADGE_ART_W}" height="${BADGE_ART_H}"/></svg>`;
        return { badge, w: BADGE_ART_W, h: BADGE_ART_H, svg, png };
      }
      const svg = await sealPrintSvg(badge.key, badge.year, id);
      // the PDF backend draws pictures only: the seal rasterised at 4× its box (1280 px wide) for that file
      const png = new Uint8Array(await sharp(Buffer.from(svg), { density: 288 }).png().toBuffer());
      return { badge, w: SEAL_ART_W, h: SEAL_ART_H, svg, png };
    }),
  );
}
