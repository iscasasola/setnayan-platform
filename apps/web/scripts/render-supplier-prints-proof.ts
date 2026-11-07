/**
 * 🖨 PROOF — PRINTS BY PURPOSE AND SIZE (owner 2026-11-06, "Yes ship it"). Draws every piece with THE ONE renderer
 * (`renderPrint`) for the prototype's own sample shop — Setnayan Productions, the facts the approved prototype drew —
 * and writes one PNG per piece (and the personal card, and the "missing data" cases) to the folder given:
 *
 *   pnpm tsx scripts/render-supplier-prints-proof.ts <out-dir> [<logo-file> <photo-file>]
 *
 * No database, no env: the facts are inline (the prototype's seed), the pictures are files handed in. A dev tool —
 * nothing here ships to a page.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderPrint, type PrintImage, type PrintShop } from '@/lib/supplier-prints-svg';
import { printQr, printShopFrom } from '@/lib/supplier-prints-shop';
import { PRINT_DESIGNS, PRINT_PIECES, type PrintBlock } from '@/lib/supplier-prints';

async function image(file: string | undefined, mime: 'image/png' | 'image/jpeg'): Promise<PrintImage | null> {
  if (!file) return null;
  const src = readFileSync(file);
  const out = mime === 'image/png' ? await sharp(src, { density: 300 }).resize({ width: 800 }).png().toBuffer() : await sharp(src).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const meta = await sharp(out).metadata();
  return { href: `data:${mime};base64,${out.toString('base64')}`, w: meta.width ?? 1, h: meta.height ?? 1 };
}

async function main() {
  const [out, logoFile, photoFile] = process.argv.slice(2);
  if (!out) throw new Error('usage: render-supplier-prints-proof.ts <out-dir> [<logo> <photo>]');
  mkdirSync(out, { recursive: true });
  const origin = 'https://www.setnayan.com';
  const slug = 'setnayan-productions';
  const base = printShopFrom({
    name: 'Setnayan Productions',
    slug,
    services: [],
    tagline: 'Photo, video, live stream, lights and sound',
    facts: { verified: true, completedEvents: 0, trusted: { trusted_avg_rating: 4.7, trusted_review_count: 3 }, inBusinessSinceYear: 2016, awards: [], nowYear: 2026 },
    kindLabel: (k) => k,
    origin,
  });
  const shop: PrintShop = {
    ...base,
    line: 'Same Day Edit · Photography · AV / Production',
    logo: await image(logoFile, 'image/png'),
    services: ['Same-day edit film', 'Wedding photo + video', 'Live stream', 'Lights and sound', 'Drone coverage'],
    since: 'In business since 2016',
    area: 'Tagaytay · serves nationwide',
    photo: await image(photoFile, 'image/jpeg'),
    about:
      'We are a Tagaytay crew of photographers, filmmakers and technicians. One team covers the whole day — the photos, the film you watch at the reception, the live stream for family abroad, and the lights and sound in the hall. We serve Metro Manila, Cavite and Laguna.',
    ownDomain: 'setnayanproductions.com',
  };
  const qr = printQr('dates', origin, slug);
  const design = PRINT_DESIGNS[0]!;
  const png = async (svg: string, name: string, width = 1000) => {
    writeFileSync(path.join(out, `${name}.svg`), svg);
    await sharp(Buffer.from(svg), { density: 144 }).resize({ width }).png().toFile(path.join(out, `${name}.png`));
  };
  const cases: Array<{ tag: string; shop: PrintShop; hide?: PrintBlock[] }> = [
    { tag: 'built', shop },
    { tag: 'no-reviews-no-photo-one-service-no-logo', shop: { ...shop, rating: null, badges: shop.badges.filter((b) => b.kind !== 'rating'), photo: null, logo: null, services: shop.services!.slice(0, 1), about: null, ownDomain: null } },
    { tag: 'blocks-off', shop, hide: ['services', 'stars', 'photo'] },
  ];
  for (const k of cases) {
    for (const p of PRINT_PIECES) {
      for (const s of p.sides === 2 ? (['f', 'b'] as const) : (['f'] as const)) {
        await png(renderPrint({ piece: p, design, shop: k.shop, qr, side: s, hide: k.hide }), `${k.tag}-${p.id}${p.sides === 2 ? `-${s}` : ''}`);
      }
    }
  }
  const card = PRINT_PIECES.find((p) => p.id === 'card')!;
  await png(renderPrint({ piece: card, design, shop, qr, side: 'f', member: { name: 'Juan dela Cruz', role: 'Owner · Director' } }), 'built-personal-f');
  await png(renderPrint({ piece: card, design, shop, qr, side: 'f', member: { name: 'Juan dela Cruz', role: null } }), 'built-personal-f-no-role');
  console.log(`wrote ${out}`);
}

void main();
