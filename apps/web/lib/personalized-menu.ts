import type {
  TasteChip,
  ServiceRow,
  ServiceTone,
} from '@/app/dashboard/[eventId]/_components/personalized-menu';

/**
 * Mappers for the PersonalizedMenu surface (home preview + /for-you).
 *
 * WHY: keeps the event-row → taste-chips and event_vendors → service-rows
 * mapping in ONE place so the lean home preview and the full /for-you page
 * render identical data (no drift). Built only from production data
 * (events + event_vendors); the onboarding "taste" (feel/dietary/style)
 * is not captured in production yet and is intentionally absent.
 */

const CEREMONY_LABEL: Record<string, string> = {
  catholic: 'Catholic ceremony',
  civil: 'Civil ceremony',
  inc: 'INC ceremony',
  christian: 'Christian ceremony',
  muslim: 'Muslim ceremony',
  cultural: 'Cultural ceremony',
  mixed: 'Mixed ceremony',
};

const VENUE_LABEL: Record<string, string> = {
  banquet_hall: 'Banquet hall',
  hotel_ballroom: 'Hotel ballroom',
  garden: 'Garden',
  garden_estate: 'Garden estate',
  beach: 'Beach',
  beach_resort: 'Beach resort',
  destination: 'Destination',
  destination_resort: 'Destination resort',
  heritage: 'Heritage venue',
  heritage_hacienda: 'Heritage hacienda',
  outdoor_tent: 'Outdoor / tent',
  civil_registrar: 'Civil registrar',
  restaurant: 'Restaurant',
  multi_purpose_hall: 'Function hall',
};

function titleCase(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBudget(centavos: number | null | undefined): string | null {
  if (centavos == null || centavos <= 0) return null;
  const pesos = Math.round(centavos / 100);
  return `₱${pesos.toLocaleString('en-PH', { maximumFractionDigits: 0 })} budget`;
}

export type EventTasteSource = {
  event_date?: string | null;
  ceremony_type?: string | null;
  venue_setting?: string | null;
  estimated_pax?: number | null;
  estimated_budget_centavos?: number | null;
};

export function buildTasteChips(
  event: EventTasteSource,
  formattedDate: string | null,
): TasteChip[] {
  const chips: TasteChip[] = [];

  if (formattedDate) chips.push({ label: formattedDate });

  const ceremony = event.ceremony_type ?? null;
  if (ceremony) {
    chips.push({ label: CEREMONY_LABEL[ceremony] ?? `${titleCase(ceremony)} ceremony` });
  }

  const venue = event.venue_setting ?? null;
  if (venue) {
    chips.push({ label: VENUE_LABEL[venue] ?? titleCase(venue) });
  }

  if (event.estimated_pax != null && event.estimated_pax > 0) {
    chips.push({ label: `${event.estimated_pax} guests` });
  }

  const budget = formatBudget(event.estimated_budget_centavos ?? null);
  if (budget) chips.push({ label: budget });

  return chips;
}

type VendorStatusInfo = { label: string; tone: ServiceTone };

const VENDOR_STATUS: Record<string, VendorStatusInfo> = {
  considering: { label: 'Shortlisted', tone: 'shortlisted' },
  contracted: { label: 'Booked', tone: 'locked' },
  deposit_paid: { label: 'Deposit paid', tone: 'locked' },
  delivered: { label: 'Delivered', tone: 'locked' },
  complete: { label: 'Complete', tone: 'locked' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  declined: { label: 'Declined', tone: 'neutral' },
};

export type VendorRowSource = {
  vendor_id: string;
  vendor_name: string | null;
  category: string | null;
  status: string | null;
};

export function mapServices(
  eventId: string,
  rows: VendorRowSource[],
): ServiceRow[] {
  return rows.map((v) => {
    const status = (v.status ?? '').toLowerCase();
    const info = VENDOR_STATUS[status] ?? {
      label: status ? titleCase(status) : 'Added',
      tone: 'neutral' as ServiceTone,
    };
    return {
      id: v.vendor_id,
      name: v.vendor_name?.trim() || 'Vendor',
      category: v.category ? titleCase(v.category) : 'Service',
      statusLabel: info.label,
      tone: info.tone,
      href: `/dashboard/${eventId}/vendors`,
    };
  });
}
