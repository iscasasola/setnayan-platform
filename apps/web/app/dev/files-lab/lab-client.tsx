'use client';

import { useEffect } from 'react';
import { EventFilesBoard } from '@/app/vendor-dashboard/clients/[eventId]/_components/event-files-board';
import { CouplePhotoApprovalsSheet } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/couple-photo-approvals-sheet';
import { shopStateOf } from '@/lib/supplier-files';
import { FilesFinder } from '@/app/vendor-dashboard/clients/[eventId]/_pages/files-finder';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import type { EventFile } from '@/lib/supplier-files.server';
import type { FileTag, OfferedPart } from '@/lib/inspiration-tags';
import { GalleryPicker } from '@/app/dashboard/[eventId]/studio/mood-board/_components/gallery-picker';
import { ShopInspirationSection } from '@/app/v/[slug]/_components/shop-inspiration-section';
import type { GalleryAsset } from '@/lib/moodboard-gallery';

const EV = '00000000-0000-4000-8000-0000000000e1';
const SHOP = '00000000-0000-4000-8000-0000000000cc';
const DAY = '2027-03-15';
const BUFFET = 's-buffet';
const COCKTAIL = 's-cocktail';
const DESSERT = 's-dessert';
const TITLES = { [BUFFET]: 'Garden buffet', [COCKTAIL]: 'Cocktail hour', [DESSERT]: 'Dessert bar' };

/** A plain coloured tile — the lab draws no real photo (a 1×1 PNG of one colour, stretched by the grid). */
const PNG_1PX = [
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4O60CAAQPAdy1nYx1AAAAAElFTkSuQmCC',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOYtmUaAAPEAeHRNcKBAAAAAElFTkSuQmCC',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNYteAEAAQKAhN69yOUAAAAAElFTkSuQmCC',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4s68HAASgAidHIvDFAAAAAElFTkSuQmCC',
];
function tile(hue: number): string {
  return `data:image/png;base64,${PNG_1PX[Math.abs(hue) % PNG_1PX.length]}`;
}

let n = 0;
function f(part: Partial<EventFile> & Pick<EventFile, 'grp' | 'kind' | 'name'>): EventFile {
  n++;
  const row: EventFile = {
    fileId: `f${n}`,
    serviceId: null,
    sizeBytes: 1_400_000 + n * 1000,
    takenAt: null,
    createdAt: `2027-03-1${n % 9}T02:00:00Z`,
    decision: 'waiting',
    decidedAt: null,
    counts: part.grp === 'service',
    state: null,
    url: part.kind === 'photo' ? tile(20 + n * 23) : null,
    ...part,
  };
  return { ...row, state: shopStateOf({ grp: row.grp, counts: row.counts, couple_decision: row.decision, taken_at: row.takenAt }, DAY) };
}

const FILES: EventFile[] = [
  f({ grp: 'booking', kind: 'document', name: 'Catering contract · signed.pdf' }),
  f({ grp: 'booking', kind: 'document', name: 'Menu · Garden buffet 150.pdf' }),
  // 📥 Piece 3c — collected from the chat, sorted by kind.
  f({ grp: 'booking', kind: 'document', name: 'Payment receipt.pdf', fromChat: { messageId: 'm0', bySupplier: false } }),
  f({ grp: 'unfiled', kind: 'photo', name: 'IMG_2201.jpg', fromChat: { messageId: 'm1', bySupplier: true } }),
  f({ grp: 'unfiled', kind: 'video', name: 'Walkthrough.mp4', fromChat: { messageId: 'm2', bySupplier: true } }),
  f({ grp: 'links', kind: 'link', name: 'YouTube · youtube.com', url: 'https://youtube.com/watch?v=x', isVideoLink: true }),
  f({ grp: 'links', kind: 'link', name: 'rosa.ph', url: 'https://rosa.ph/menu' }),
  f({ grp: 'service', kind: 'photo', name: 'Buffet line.jpg', serviceId: BUFFET, takenAt: '2027-03-15T11:00:00+08:00', decision: 'shown' }),
  f({ grp: 'service', kind: 'photo', name: 'Carving station.jpg', serviceId: BUFFET, takenAt: '2027-03-15T12:00:00+08:00' }),
  f({ grp: 'service', kind: 'photo', name: 'Setup.jpg', serviceId: BUFFET, takenAt: '2027-03-14T16:00:00+08:00' }),
  f({ grp: 'service', kind: 'photo', name: 'Old wedding.jpg', serviceId: BUFFET, takenAt: '2026-11-02T12:00:00+08:00' }),
  f({ grp: 'linked', kind: 'photo', name: 'portfolio-buffet.jpg', serviceId: BUFFET, counts: false }),
  f({ grp: 'service', kind: 'photo', name: 'Dessert table.jpg', serviceId: BUFFET, takenAt: '2027-03-15T20:00:00+08:00', decision: 'hidden' }),
  f({ grp: 'service', kind: 'photo', name: 'Napkins.jpg', serviceId: BUFFET }),
  f({ grp: 'service', kind: 'video', name: 'Toast.mp4', serviceId: COCKTAIL, takenAt: '2027-03-15T18:00:00+08:00' }),
  f({ grp: 'service', kind: 'photo', name: 'Canapés.jpg', serviceId: COCKTAIL, counts: false }),
  f({ grp: 'linked', kind: 'photo', name: 'dessert-bar.jpg', serviceId: DESSERT, counts: false }),
];

// 🏷 Inspiration tags (DECISION_LOG 2026-11-14) — the parts the Garden buffet card offers, and three tags.
const OFFERED: Record<string, OfferedPart[]> = {
  [BUFFET]: [
    { slotKey: 'table', label: 'Tables' },
    { slotKey: 'cake', label: 'Cake & desserts' },
    { slotKey: 'cocktail', label: 'Cocktail & bar' },
  ],
  [COCKTAIL]: [{ slotKey: 'cocktail', label: 'Cocktail & bar' }],
};
const byName = (name: string) => FILES.find((x) => x.name === name)!.fileId;
const TAGS: FileTag[] = [
  { assetId: 't1', fileId: byName('Buffet line.jpg'), slotKey: 'table', label: 'Tables', state: 'shown', reason: null },
  { assetId: 't2', fileId: byName('Buffet line.jpg'), slotKey: 'cake', label: 'Cake & desserts', state: 'checking', reason: null },
  { assetId: 't3', fileId: byName('Carving station.jpg'), slotKey: 'table', label: 'Tables', state: 'waiting', reason: null },
];
const click = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.click();
/** Opens a tile by its name — after "+N" shows the rest of its group. */
const openTile = (name: string) => {
  for (const b of document.querySelectorAll('[data-files-grid] li:last-child button')) if (b.textContent?.startsWith('+')) (b as HTMLElement).click();
  setTimeout(() => click(`[data-files-grid] button[aria-label^="${name}"]`), 150);
};

// 🏷 The couple's side (frames 8 · 9 · 11) and the shop page (frame 10) — fixture photos, no database.
const LINE = 'Wedding · Makati Shangri-La · Sep 2026';
const LIB: GalleryAsset[] = [
  { assetId: 'a1', imageUrl: tile(3), label: '', credit: 'Rosa Mendoza Catering · Caterer', vendorProfileId: SHOP, shopSlug: 'rosa', swatches: ['#c8907a', '#e9d8c4'], isEventLinked: true, eventLine: LINE, alsoIn: [{ slotKey: 'cake', label: 'Cake & desserts' }] },
  { assetId: 'a2', imageUrl: tile(1), label: '', credit: 'Rosa Mendoza Catering · Caterer', vendorProfileId: SHOP, shopSlug: 'rosa', swatches: ['#a99fc8'], isEventLinked: true, eventLine: 'Debut · Tagaytay Highlands · Aug 2026', alsoIn: [] },
  { assetId: 'a3', imageUrl: tile(2), label: 'Grazing table', credit: 'Rosa Mendoza Catering · Caterer', vendorProfileId: SHOP, shopSlug: 'rosa', swatches: ['#d9c08a'], isEventLinked: false },
  { assetId: 'a4', imageUrl: tile(0), label: 'Long table', credit: 'Casa Verde Styling · Stylist', vendorProfileId: SHOP, shopSlug: null, swatches: ['#9bb894'], isEventLinked: false },
];
const libPage = (assets: GalleryAsset[]) => async () => ({ assets, total: assets.length, withheld: 0, offset: 0, limit: 24, hasMore: false });

export function FilesLabClient({ mode }: { mode: string }) {
  useEffect(() => {
    if (mode === 'library-open') {
      const t = setTimeout(() => click('[data-gallery-open]'), 1200);
      return () => clearTimeout(t);
    }
    if (mode.startsWith('tag-')) {
      const steps: (() => void)[] =
        mode === 'tag-open'
          ? [() => openTile('Setup.jpg')]
          : mode === 'tag-pick'
            ? [
                () => openTile('Setup.jpg'),
                () => {},
                () => click('[data-files-tag-picker] > button'),
                () => {
                  const boxes = [...document.querySelectorAll('[data-files-tag-picker] input[type="checkbox"]')] as HTMLElement[];
                  boxes[0]?.click();
                  boxes[1]?.click();
                },
                () => click('[data-files-tag-rights]'),
              ]
            : mode === 'tag-after'
              ? [() => openTile('Buffet line.jpg')]
              : mode === 'tag-select'
                ? [
                    () => click(`[data-files-select="${BUFFET}"]`),
                    () => {
                      const tiles = [...document.querySelectorAll(`[data-files-group="${BUFFET}"] [data-files-grid] button[aria-pressed]`)] as HTMLElement[];
                      [0, 1, 3].forEach((i) => tiles[i]?.click());
                    },
                  ]
                : [];
      const timers = steps.map((fn, i) => setTimeout(fn, 600 + i * 450));
      return () => timers.forEach(clearTimeout);
    }
    if (mode === 'filechat') {
      const t2 = setTimeout(() => (document.querySelector('[data-files-group="unfiled"] li button') as HTMLElement | null)?.click(), 600);
      return () => clearTimeout(t2);
    }
    const sel =
      mode === 'plus' ? '[data-files-plus]' : mode === 'upload' || mode === 'portfolio' ? '[data-files-plus]' : mode === 'couple' ? '[data-couple-approvals-line]' : null;
    if (!sel) return;
    const t = setTimeout(() => {
      (document.querySelector(sel) as HTMLElement | null)?.click();
      if (mode === 'upload' || mode === 'portfolio') {
        setTimeout(() => {
          const doors = [...document.querySelectorAll('[data-files-plus-sheet] button')] as HTMLElement[];
          const want = mode === 'upload' ? 'Upload new' : 'From your portfolio';
          doors.find((d) => d.textContent?.includes(want))?.click();
        }, 400);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [mode]);

  if (mode === 'library' || mode === 'library-open' || mode === 'library-waiting') {
    return (
      <GalleryPicker
        eventId={EV}
        slotKey="table"
        slotLabel="Tables"
        emptyPositions={[0, 1]}
        fetchAction={libPage(mode === 'library-waiting' ? LIB.filter((a) => !a.eventLine) : LIB)}
        applyAction={async () => ({ status: 'ok', imageUrl: LIB[0]!.imageUrl })}
        onSaved={() => {}}
        onClose={() => {}}
      />
    );
  }
  if (mode === 'shop') {
    return (
      <ShopInspirationSection
        shopName="Rosa Mendoza Catering"
        tiles={[
          { id: 'a1', url: tile(3), part: 'Tables', card: { label: 'Garden buffet', priceLabel: 'Price on request', anchorId: 'card-a' }, eventLine: LINE },
          { id: 'a1b', url: tile(3), part: 'Cake & desserts', card: { label: 'Garden buffet', priceLabel: 'Price on request', anchorId: 'card-a' }, eventLine: LINE },
          { id: 'a3', url: tile(2), part: 'Tables', card: { label: 'Garden buffet', priceLabel: 'Price on request', anchorId: 'card-a' } },
          { id: 'a5', url: tile(1), part: 'Cocktail & bar', card: null },
        ]}
      />
    );
  }
  // ?m=now — the SHIPPED Files page body, unchanged (the "Now" beside the board).
  if (mode === 'now') {
    const row = (k: string, kind: SharedFileEntry['kind'], name: string, typeLabel: string, isImage: boolean): SharedFileEntry => ({
      key: k,
      kind,
      name,
      origin: 'You shared',
      sizeLabel: '1.4 MB',
      typeLabel,
      at: '2027-03-10T02:00:00Z',
      href: null,
      isImage,
    });
    return (
      <FilesFinder
        files={[
          row('a', 'contract', 'Catering contract · signed.pdf', 'PDF', false),
          row('b', 'chat', 'IMG_2201.jpg', 'Image', true),
          row('c', 'chat', 'Menu · Garden buffet 150.pdf', 'PDF', false),
          row('d', 'handover', 'Tasting photos', 'Link', false),
        ]}
      />
    );
  }
  if (mode === 'couple') {
    return (
      <CouplePhotoApprovalsSheet
        eventId={EV}
        shopName="Rosa Mendoza Catering"
        coupleName="Ana & Miguel"
        returnPath="/dev/files-lab"
        rows={FILES.filter((x) => x.grp === 'service' && x.counts).map((x) => ({
          fileId: x.fileId,
          name: x.name,
          url: x.url,
          kind: x.kind,
          service: TITLES[x.serviceId as keyof typeof TITLES] ?? 'Service',
          takenAt: x.takenAt,
          decision: x.decision,
        }))}
      />
    );
  }
  return (
    <EventFilesBoard
      mode={mode.startsWith('hub') ? 'hub' : 'files'}
      eventId={EV}
      shopId={SHOP}
      coupleName="Ana & Miguel"
      eventDate={DAY}
      quoted={[
        { id: BUFFET, title: 'Garden buffet' },
        { id: COCKTAIL, title: 'Cocktail hour' },
      ]}
      serviceTitles={TITLES}
      files={FILES}
      picks={[1, 2, 3, 4, 5, 6, 7].map((i) => ({
        ref: `r2://setnayan-media/vendors/${SHOP}/portfolio/${i}.jpg`,
        url: tile(i * 40),
        serviceId: i < 4 ? BUFFET : i < 6 ? COCKTAIL : null,
        serviceTitle: i < 4 ? 'Garden buffet' : i < 6 ? 'Cocktail hour' : null,
      }))}
      feeUnlocked={mode !== 'hub-fee'}
      returnPath="/dev/files-lab"
      tags={mode.startsWith('hub') ? undefined : TAGS}
      offered={OFFERED}
    />
  );
}
