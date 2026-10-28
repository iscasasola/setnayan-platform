/**
 * 💡 The Inspiration box on fixtures — `/dev/suppliers-lab` only (no session, no database). Catering and Photo &
 * Video carry parts; Catering has 100 supplier photos (the owner's "100 inspirations in one category" case), drawn as
 * small inline SVGs so the lab asks the network for nothing.
 *
 *   &inspo=fail    the photo read fails (the box says so, with Try again)
 *   &inspo=none    no supplier has added photos yet
 *   &inspo=slow    each page takes 2.5 s
 */
import type { FindInspirationPart } from '@/lib/find-inspiration';
import type { GalleryAsset, GalleryPage } from '@/lib/moodboard-gallery';

export const LAB_INSPIRATION_PARTS: Record<string, FindInspirationPart[]> = {
  catering: [
    { slotKey: 'lab_buffet', label: 'Buffet table styling' },
    { slotKey: 'lab_grazing', label: 'Grazing board' },
    { slotKey: 'lab_dessert', label: 'Dessert wall' },
    { slotKey: 'lab_plated', label: 'Plated course' },
  ],
  photo_video: [{ slotKey: 'lab_portrait', label: 'Portrait style' }],
};

const SHOPS = ['Tita Nena’s Catering', 'Seda Kitchen', 'Lola Rosa Lechon', 'Kusina ni Ate', 'Casa Luisa Events'];
const PAL = [['#E9C9B8', '#C24E25'], ['#DCE5D2', '#6B8F5E'], ['#F3E3C3', '#C98A2E'], ['#D9DEE8', '#5B6B8C'], ['#EAD5DC', '#9B4F6D']];
const RATIOS = [[3, 4], [1, 1], [4, 5], [2, 3]] as const;

function svg(i: number): string {
  const [a, b] = PAL[i % PAL.length]!;
  const [w, h] = RATIOS[i % RATIOS.length]!;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * 100} ${h * 100}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 50}" cy="${h * 50}" r="${Math.min(w, h) * 28}" fill="#fff" opacity=".55"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
}

function photos(keys: readonly string[]): GalleryAsset[] {
  const all: GalleryAsset[] = [];
  const parts = Object.values(LAB_INSPIRATION_PARTS).flat();
  for (let i = 0; i < 100; i += 1) {
    const part = parts[i % 4]!;
    const shop = SHOPS[i % SHOPS.length]!;
    all.push({
      assetId: `lab-asset-${i}`,
      imageUrl: svg(i),
      label: i % 3 ? '' : 'Garden reception',
      credit: `${shop} · Caterer`,
      shopName: shop,
      vendorProfileId: `lab-shop-${i % SHOPS.length}`,
      shopSlug: null,
      swatches: [],
      isEventLinked: i % 4 === 0,
      partKey: part.slotKey,
    });
  }
  return all.filter((a) => keys.includes(a.partKey));
}

export function labInspirationRead(mode: string | null) {
  return async (input: { slotKeys: string[]; limit: number; offset: number }): Promise<GalleryPage> => {
    await new Promise((r) => setTimeout(r, mode === 'slow' ? 2500 : 200));
    if (mode === 'fail') throw new Error('lab: the photo read failed');
    const all = mode === 'none' ? [] : photos(input.slotKeys);
    return {
      assets: all.slice(input.offset, input.offset + input.limit),
      total: all.length,
      withheld: 0,
      offset: input.offset,
      limit: input.limit,
      hasMore: input.offset + input.limit < all.length,
    };
  };
}
