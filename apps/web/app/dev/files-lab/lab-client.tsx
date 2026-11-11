'use client';

import { useEffect } from 'react';
import { EventFilesBoard } from '@/app/vendor-dashboard/clients/[eventId]/_components/event-files-board';
import { CouplePhotoApprovalsSheet } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/couple-photo-approvals-sheet';
import { shopStateOf } from '@/lib/supplier-files';
import { FilesFinder } from '@/app/vendor-dashboard/clients/[eventId]/_pages/files-finder';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import type { EventFile } from '@/lib/supplier-files.server';

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
  f({ grp: 'unfiled', kind: 'photo', name: 'IMG_2201.jpg' }),
  f({ grp: 'links', kind: 'link', name: 'Tasting video · youtube.com', url: 'https://youtube.com/watch?v=x' }),
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

export function FilesLabClient({ mode }: { mode: string }) {
  useEffect(() => {
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
          row('d', 'handover', 'Tasting gallery', 'Gallery link', false),
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
    />
  );
}
