'use client';

/**
 * 🧪 /dev/supplier-lab?s=suggest — THE REAL SUPPLIER SUGGESTION BOARD on a lab florist, booked on a lab couple's event
 * (DEV-ONLY). Its writes are stand-ins that answer in this tab and reach no database: a sent photo is the file itself
 * (an object URL) or the picked shop photo; Undo / a tap takes it back. `&sent=1` opens with one photo already waiting
 * on Bridal bouquet (prototype frame 2's board). The board is built by the SAME `buildSupplierBoard` the page uses.
 */
import { useMemo } from 'react';
import { SupplierSuggestBoard, type SuggestBoardActions } from '@/app/vendor-dashboard/clients/[eventId]/_components/supplier-suggest-board';
import type { SupplierBoard } from '@/lib/supplier-suggest-board';
import type { SupplierSuggestion } from '@/lib/inspiration-suggestions';
import type { CardChoice } from '@/lib/inspiration-card-link';
import { LAB_SUGGEST_PHOTO, LAB_SUGGEST_SHOP_PHOTOS as LAB_SHOP_PHOTOS } from './suggestion-lab-fixture';

const EVENT = '00000000-0000-4000-8000-000000000000';

export function SuggestLab({ board, couple, eventLine, roleLine, sent, cardsByPart }: { board: SupplierBoard; couple: string; eventLine: string; roleLine: string; sent: boolean; cardsByPart?: Record<string, CardChoice[]> | null }) {
  const actions = useMemo<SuggestBoardActions>(
    () => ({
      suggest: async (fd) => {
        const file = fd.get('file');
        const ref = String(fd.get('shopPhotoRef') ?? '');
        const url = file instanceof Blob ? URL.createObjectURL(file) : LAB_SHOP_PHOTOS.find((p) => p.ref === ref)?.url ?? LAB_SUGGEST_PHOTO.bqS;
        /* 🔗 The lab answers the pool half the way the server does: ticked → pending, else not offered. */
        const pool = fd.get('rightsWarranted') === '1' ? ({ status: 'pending' } as const) : ({ status: 'not_offered' } as const);
        return { status: 'ok', suggestion: { id: `lab-${Date.now()}`, slotKey: String(fd.get('slotKey')), url }, pool };
      },
      withdraw: async () => ({ status: 'ok' }),
      listShopPhotos: async () => ({ photos: LAB_SHOP_PHOTOS.map((p) => ({ ref: p.ref, url: p.url })), failed: false }),
    }),
    [],
  );
  const mine: SupplierSuggestion[] = sent ? [{ id: 'lab-sent-1', slotKey: 'bridal_bouquet', url: LAB_SUGGEST_PHOTO.bqS, state: 'waiting' }] : [];
  return (
    <div className="min-h-screen bg-paper px-4 pb-24 pt-4 text-ink" data-suggest-lab="">
      <SupplierSuggestBoard eventId={EVENT} couple={couple} eventLine={eventLine} roleLine={roleLine} board={board} mine={mine} actions={actions} cardsByPart={cardsByPart} />
    </div>
  );
}
