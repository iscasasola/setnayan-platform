'use client';

/**
 * suppliers-settings-rows.tsx — SUPPLIERS ⚙'S SHEET (owner 2026-10-27, DECISION_LOG "SUPPLIERS GETS ITS ⚙ — THE
 * SUPPLIER SETTINGS MOVE THERE"; verbatim *"what are the settings for suppliers?"* · *"and move them to suppliers"* —
 * reverses owner call 3, which kept Suppliers `reserved`).
 *
 * The rows MOVED here from Event Details, one home each (`SETTINGS_ROWS`, `one-home-per-setting.test.ts`):
 *   · Costs    — How you see costs, ONE `PickMenu` (Realtime · Final only); the writer `updatePaxSettings`, which writes
 *                both of its columns, so the stored reply-by date rides along (`lib/pax-settings-form.ts`).
 *   · Payments — the next supplier payments, as Event Details drew them (a read), and Budget › (`?part=budget`).
 *   · Photos   — each booked supplier's photos in your Memories, the shipped switch's copy, saved in place
 *                (`setVendorCapturesHiddenHere`).
 * Every save answers here: the sheet stays open, the screen never resets (owner 2026-10-26).
 */
import { useState, useTransition } from 'react';
import { ChevronRight } from 'lucide-react';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { SwitchTrack } from '@/app/_components/switch-track';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { updatePaxSettings } from '../../actions';
import { setVendorCapturesHiddenHere } from '../../studio/papic/vendor-visibility-actions';
import { SUPPLIERS_SETTINGS_CLUSTERS, type SuppliersSettingsView } from '@/lib/suppliers-settings';

const COULD_NOT_READ = 'We couldn’t read it just now.';

const COSTS_OPTIONS = [
  { key: 'realtime', label: 'Realtime', hint: 'See supplier costs adapt as your confirmed count grows.' },
  { key: 'final_only', label: 'Final only', hint: 'Hold at the base; see the adjustment once at finalization.' },
] as const;

export function SuppliersSettingsRows({ eventId, view }: { eventId: string; view: SuppliersSettingsView }) {
  return (
    <div className="pb-6" data-suppliers-settings="">
      <FormRows data="suppliers-settings">
        <ClusterHead name={SUPPLIERS_SETTINGS_CLUSTERS[0]} first />
        <CostsRow eventId={eventId} costs={view.costs} />

        <ClusterHead name={SUPPLIERS_SETTINGS_CLUSTERS[1]} />
        {view.payments === null ? (
          <FormRow data="supplier-payments" name="Supplier payments" attrs={{ 'data-setup-row': 'supplier-payments' }} problem={COULD_NOT_READ} />
        ) : (
          <FormRow
            data="supplier-payments"
            name="Supplier payments"
            attrs={{ 'data-setup-row': 'supplier-payments' }}
            line={
              view.payments.length === 0
                ? 'None due.'
                : view.payments.map((p) => (
                    <span key={p.id} className="block">
                      {p.when} · {p.words}
                    </span>
                  ))
            }
          />
        )}
        <FormRow data="budget" name="Budget" attrs={{ 'data-setup-row': 'budget' }}>
          <ActionButton tone="neutral" icon={ChevronRight} label="Open" href={`/dashboard/${eventId}/vendors?part=budget`} />
        </FormRow>

        {view.photos === null && view.photosRead ? null : (
          <>
            <ClusterHead name={SUPPLIERS_SETTINGS_CLUSTERS[2]} />
            {view.photos === null ? (
              <FormRow data="supplier-photos" name="Their photos in your Memories" attrs={{ 'data-setup-row': 'supplier-photos' }} problem={COULD_NOT_READ} />
            ) : view.photos.length === 0 ? (
              <FormRow data="supplier-photos" name="Their photos in your Memories" attrs={{ 'data-setup-row': 'supplier-photos' }} line="No booked supplier has shot here yet." />
            ) : (
              view.photos.map((p, i) => <PhotosRow key={p.vendorRowId} eventId={eventId} supplier={p} first={i === 0} />)
            )}
          </>
        )}
      </FormRows>
    </div>
  );
}

/** A cluster's head — the same small mono label Guests ⚙ draws. Not pressable: no frame. */
function ClusterHead({ name, first = false }: { name: string; first?: boolean }) {
  return (
    <p
      data-settings-cluster={name}
      className={`${first ? 'pt-2' : 'pt-5'} pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 [&+*]:!border-t-0`}
    >
      {name}
    </p>
  );
}

function CostsRow({ eventId, costs }: { eventId: string; costs: SuppliersSettingsView['costs'] }) {
  const [mode, setMode] = useState(costs?.mode ?? 'realtime');
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  if (!costs) return <FormRow data="costs-view" name="How you see costs" attrs={{ 'data-setup-row': 'costs-view' }} problem={COULD_NOT_READ} />;
  const pick = (key: string) => {
    if (key !== 'realtime' && key !== 'final_only') return;
    const before = mode;
    setMode(key);
    setErr(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('adaptive_pricing_mode', key);
    // The stored date rides along unchanged — the writer saves both columns (`lib/pax-settings-form.ts`).
    fd.set('guest_list_edit_deadline', costs.deadline ?? '');
    start(async () => {
      const res = await updatePaxSettings(fd);
      if (!res.ok) {
        setMode(before);
        setErr(res.message);
      }
    });
  };
  return (
    <FormRow
      data="costs-view"
      name="How you see costs"
      attrs={{ 'data-setup-row': 'costs-view' }}
      line={COSTS_OPTIONS.find((o) => o.key === mode)?.hint}
      problem={err}
    >
      <PickMenu label="How you see costs" value={mode} options={COSTS_OPTIONS} onPick={pick} dataAttr="costs-view" />
    </FormRow>
  );
}

/** One row per booked supplier who shot here. The FIRST carries the row's `data-setup-row` hook (one per sheet — the
    port-control map counts the setting once, as Event Details' Dress code rows do). */
function PhotosRow({ eventId, supplier, first }: { eventId: string; supplier: { vendorRowId: string; name: string; hidden: boolean }; first: boolean }) {
  const [hidden, setHidden] = useState(supplier.hidden);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormRow
      data="supplier-photos"
      name={supplier.name}
      attrs={first ? { 'data-setup-row': 'supplier-photos', 'data-supplier-photos': hidden ? 'hidden' : 'shown' } : { 'data-supplier-photos': hidden ? 'hidden' : 'shown' }}
      line={hidden ? 'Their photos in your Memories · hidden, kept, not deleted' : 'Their photos in your Memories · shown'}
      problem={err}
    >
      <button
        type="button"
        role="switch"
        aria-checked={!hidden}
        aria-label={`${supplier.name}: their photos in your Memories`}
        disabled={pending}
        className="inline-flex min-h-11 flex-none items-center justify-center"
        onClick={() => {
          const next = !hidden;
          setHidden(next);
          setErr(null);
          start(async () => {
            const res = await setVendorCapturesHiddenHere(eventId, supplier.vendorRowId, next);
            if (!res.ok) {
              setHidden(!next);
              setErr(res.message);
            }
          });
        }}
      >
        <SwitchTrack on={!hidden} />
      </button>
    </FormRow>
  );
}
