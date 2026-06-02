import type { TasteChip } from '@/app/dashboard/[eventId]/_components/personalized-menu';

/**
 * Mapper for the PersonalizedMenu surface (home + /for-you).
 *
 * WHAT (owner correction 2026-06-02): turns the `events` row into the
 * couple's CURATED MATCH CRITERIA — the information they gave at
 * onboarding/event-creation that Setnayan filters + sorts the vendor
 * search by. NOT their shortlisted vendors (that's the Vendors tab).
 *
 * Kept in ONE place so the home block and the /for-you page render
 * identical criteria. Built only from production `events` columns; the
 * richer per-category onboarding preferences (cuisine / photo-video style /
 * music vibe / dietary detail) are V1.x — they feed in here when captured.
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

// region keys may be sparse in production until onboarding V2 ships fully;
// titleCase fallback keeps unknown keys readable (acronyms get a small map).
const REGION_LABEL: Record<string, string> = {
  ncr: 'Metro Manila',
  metro_manila: 'Metro Manila',
  calabarzon: 'CALABARZON',
  central_luzon: 'Central Luzon',
  central_visayas: 'Central Visayas',
  western_visayas: 'Western Visayas',
  eastern_visayas: 'Eastern Visayas',
  ilocos: 'Ilocos Region',
  cagayan_valley: 'Cagayan Valley',
  bicol: 'Bicol Region',
  mimaropa: 'MIMAROPA',
  zamboanga: 'Zamboanga Peninsula',
  northern_mindanao: 'Northern Mindanao',
  davao: 'Davao Region',
  soccsksargen: 'SOCCSKSARGEN',
  caraga: 'Caraga',
  barmm: 'BARMM',
  car: 'Cordillera (CAR)',
  cordillera: 'Cordillera (CAR)',
  outside_ph: 'Outside the Philippines',
};

function titleCase(raw: string): string {
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBudget(centavos: number | null | undefined): string | null {
  if (centavos == null || centavos <= 0) return null;
  const pesos = Math.round(centavos / 100);
  return `₱${pesos.toLocaleString('en-PH', { maximumFractionDigits: 0 })} budget`;
}

export type EventTasteSource = {
  event_date?: string | null;
  ceremony_type?: string | null;
  secondary_ceremony_type?: string | null;
  venue_setting?: string | null;
  estimated_pax?: number | null;
  estimated_budget_centavos?: number | null;
  region?: string | null;
  mood_feel_key?: string | null;
};

/**
 * Builds the curated match-criteria chips, in the order they read
 * naturally: date · region · ceremony (+ secondary) · venue · guests ·
 * style/feel · budget. Each chip is a real filter/sort axis on the vendor
 * search. Only present criteria render — no fabricated chips.
 */
export function buildTasteChips(
  event: EventTasteSource,
  formattedDate: string | null,
): TasteChip[] {
  const chips: TasteChip[] = [];

  if (formattedDate) chips.push({ label: formattedDate });

  const region = event.region ?? null;
  if (region) chips.push({ label: REGION_LABEL[region] ?? titleCase(region) });

  const ceremony = event.ceremony_type ?? null;
  if (ceremony) {
    chips.push({ label: CEREMONY_LABEL[ceremony] ?? `${titleCase(ceremony)} ceremony` });
  }

  const secondary = event.secondary_ceremony_type ?? null;
  if (secondary) {
    chips.push({ label: CEREMONY_LABEL[secondary] ?? `${titleCase(secondary)} ceremony` });
  }

  const venue = event.venue_setting ?? null;
  if (venue) chips.push({ label: VENUE_LABEL[venue] ?? titleCase(venue) });

  if (event.estimated_pax != null && event.estimated_pax > 0) {
    chips.push({ label: `${event.estimated_pax} guests` });
  }

  const feel = event.mood_feel_key ?? null;
  if (feel) chips.push({ label: `${titleCase(feel)} style` });

  const budget = formatBudget(event.estimated_budget_centavos ?? null);
  if (budget) chips.push({ label: budget });

  return chips;
}
