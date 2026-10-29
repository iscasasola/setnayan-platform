'use client';

/**
 * The add-your-own lab's two client mounts: the REAL card maker opened the way
 * a claim opens it (a claim token + the couple's seed), and the REAL record
 * sheet in edit mode. Neither is given a session, so nothing can be saved.
 */
import { NewManualVendorModal } from '@/app/dashboard/[eventId]/_components/new-manual-vendor-modal';
import { CanvasMaker } from '@/app/vendor-dashboard/services/_components/canvas-maker';
import type { CanvasInitial } from '@/lib/canvas-initial';
import type { SelfAddedSupplierPrefill, UpdateSelfAddedSupplierResult } from '@/app/dashboard/[eventId]/vendors/actions';
import { PLAN_PRESENT_FIELD, buildCouplePaymentPlan, partialSaveSentence, planSaveStep, type CouplePlanRowInput } from '@/lib/self-added-payment-plan';
import type { CoverCatalogFolder } from '@/lib/shortlist-taxonomy';

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

export function LabRecord({
  eventId,
  edit,
  categoryLabel = 'Catering',
  coverCatalog,
}: {
  eventId: string;
  edit: SelfAddedSupplierPrefill;
  categoryLabel?: string;
  /** The Suppliers page's rows for a wedding, built by the page's own call (no database here). */
  coverCatalog: readonly CoverCatalogFolder[];
}) {
  return (
    <NewManualVendorModal
      eventId={eventId}
      category={edit.category}
      categoryLabel={categoryLabel}
      coverCatalog={coverCatalog}
      edit={edit}
      saveRecord={labSaveRecord}
      onClose={() => {}}
      onCreated={() => {}}
    />
  );
}

/**
 * The record sheet's save, with no session: the PLAN half of
 * `updateSelfAddedSupplier`, run through the same pure functions the server
 * runs (`planSaveStep` → `buildCouplePaymentPlan` → `partialSaveSentence`), so
 * the lab shows the couple the same answer. Nothing is written anywhere.
 * The lab's event is dated 2026-12-18 and "locks" on the day it is opened.
 */
async function labSaveRecord(fd: FormData): Promise<UpdateSelfAddedSupplierResult> {
  const labels = fd.getAll('plan_label');
  const step = planSaveStep({
    editorPresent: fd.get(PLAN_PRESENT_FIELD) === '1',
    postedLabels: labels,
    postedValues: fd.getAll('plan_value'),
  });
  if (step !== 'save') return { status: 'ok' };
  const rows: CouplePlanRowInput[] = labels.map((l, i) => ({
    label: String(l ?? ''),
    amount_kind: String(fd.getAll('plan_kind')[i] ?? '') === 'fixed' ? 'fixed' : 'percent',
    value: String(fd.getAll('plan_value')[i] ?? ''),
    due_anchor: ((a) => (a === 'on_lock' || a === 'before_event' ? a : ''))(String(fd.getAll('plan_anchor')[i] ?? '')),
    due_offset_days: String(fd.getAll('plan_days')[i] ?? '0'),
  }));
  const price = Number(String(fd.get('total_cost_php') ?? '').replace(/,/g, ''));
  const built = buildCouplePaymentPlan({
    rows,
    totalPhp: Number.isFinite(price) && price > 0 ? price : null,
    lockDateIso: new Date().toISOString().slice(0, 10),
    eventDateIso: '2026-12-18',
  });
  if (built.ok) return { status: 'ok' };
  const warning = partialSaveSentence([{ what: 'the payment plan', why: built.message }]);
  return warning ? { status: 'ok', warning } : { status: 'ok' };
}
