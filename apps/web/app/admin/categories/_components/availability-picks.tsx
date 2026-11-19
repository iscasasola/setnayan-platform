'use client';

/**
 * availability-picks.tsx — "Availability ▾" on Admin › Categories (Availability plan, step 2; the seven owner-ruled
 * 2026-11-17, lib/availability-styles.ts). Admin-only: nothing a supplier or a couple sees reads it yet.
 *
 *   ServiceAvailabilityPick    a service's one value — saves in place with "Saved — Availability · Undo"
 *   CategoryAvailabilityPick   "Set Availability for all N services" — one pick writes every service of the category
 *
 * Both answer through the drawer's in-place door (`mapWriteForm`, `four-level-actions.ts`); the screen never resets.
 */
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { formatCount } from '@/lib/format-number';
import { availabilityName, type AvailabilityStyle } from '@/lib/availability-styles';
import { mapWriteForm } from '../four-level-actions';
import { AVAILABILITY_CHOICES, AVAILABILITY_SEVEN as SEVEN } from './availability-choices';
import { useInPlace, type WriteResult } from './drawer-kit';
import { SavePick } from './pickers';

export function ServiceAvailabilityPick({ canonical, value }: { canonical: string; value: AvailabilityStyle | null }) {
  return (
    <SavePick
      label="Availability"
      value={value ?? ''}
      buttonText={availabilityName(value)}
      choices={AVAILABILITY_CHOICES}
      action={mapWriteForm.bind(null, 'availability')}
      field="availability_style"
      hidden={{ canonical_service: canonical }}
      what="Availability"
    />
  );
}

export function CategoryAvailabilityPick({ categoryId, count }: { categoryId: string; count: number }) {
  const { pending, run } = useInPlace();
  return (
    <span className={pending ? 'opacity-60' : undefined} data-category-availability={categoryId}>
      <PickMenu
        label={`Set Availability for all ${formatCount(count)} services`}
        value=""
        options={SEVEN.map((c) => ({ key: c.key, label: c.label, hint: c.hint }))}
        buttonText={pending ? 'Saving…' : `Set Availability for all ${formatCount(count)} ${count === 1 ? 'service' : 'services'}`}
        compact
        className="border border-ink/15"
        onPick={(key) => {
          const fd = new FormData();
          fd.set('category_id', categoryId);
          fd.set('availability_style', key);
          run(async () => (await mapWriteForm('category-availability', fd)) as WriteResult, { what: 'Availability', said: (m) => m });
        }}
      />
    </span>
  );
}
