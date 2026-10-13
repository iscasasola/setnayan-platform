'use client';

/**
 * The add-your-own lab's two client mounts: the REAL card maker opened the way
 * a claim opens it (a claim token + the couple's seed), and the REAL record
 * sheet in edit mode. Neither is given a session, so nothing can be saved.
 */
import { NewManualVendorModal } from '@/app/dashboard/[eventId]/_components/new-manual-vendor-modal';
import { CanvasMaker } from '@/app/vendor-dashboard/services/_components/canvas-maker';
import type { CanvasInitial } from '@/lib/canvas-initial';
import type { SelfAddedSupplierPrefill } from '@/app/dashboard/[eventId]/vendors/actions';

export function LabCard({ initial }: { initial: CanvasInitial | null }) {
  return (
    <CanvasMaker
      categoryValue="catering"
      categoryLabel="Catering"
      otherCategories={[]}
      vendorProfileId="00000000-0000-4000-8000-0000000000bb"
      claimToken="lab-sample-token"
      initial={initial}
      shopName="Tita Baby's Catering"
    />
  );
}

export function LabRecord({ eventId, edit }: { eventId: string; edit: SelfAddedSupplierPrefill }) {
  return (
    <NewManualVendorModal
      eventId={eventId}
      category={edit.category}
      categoryLabel="Catering"
      edit={edit}
      onClose={() => {}}
      onCreated={() => {}}
    />
  );
}
