/**
 * Mapper for the couple's match-criteria surface.
 *
 * WHAT (owner correction 2026-06-02): turns the `events` row into the
 * couple's CURATED MATCH CRITERIA — the information they gave at
 * onboarding/event-creation that Setnayan filters + sorts the vendor
 * search by. NOT their shortlisted vendors (that's the Vendors tab).
 *
 * `buildTasteChips` is the live consumer: it feeds the "Matching you on"
 * strip at the top of the Vendors/Services tab (match-criteria-strip.tsx,
 * owner 2026-06-04). Built only from production `events` columns; the richer
 * per-category onboarding preferences (cuisine / photo-video style / music
 * vibe / dietary detail) are V1.x — they feed in here when captured.
 */

/** A single match-criteria chip on the "Matching you on" strip. */
export type TasteChip = { label: string };

// Exported so the Personalization page (/dashboard/[eventId]/details) renders
// the SAME labels the chips do — one source of truth (CLAUDE.md 2026-06-02
// Phase B). "ceremony" suffix dropped on the bare type for the page's
// documentation rows; the chip-style suffix stays in buildTasteChips.
export const CEREMONY_LABEL: Record<string, string> = {
  catholic: 'Catholic ceremony',
  civil: 'Civil ceremony',
  inc: 'INC ceremony',
  christian: 'Christian ceremony',
  muslim: 'Muslim ceremony',
  cultural: 'Cultural ceremony',
  mixed: 'Mixed ceremony',
};

export const VENUE_LABEL: Record<string, string> = {
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
export const REGION_LABEL: Record<string, string> = {
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

export function titleCase(raw: string): string {
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBudget(centavos: number | null | undefined): string | null {
  if (centavos == null || centavos <= 0) return null;
  const pesos = Math.round(centavos / 100);
  return `₱${pesos.toLocaleString('en-PH', { maximumFractionDigits: 0 })} budget`;
}

// Format an ISO yyyy-mm-dd as "Aug 15, 2026" (or "Aug 15" without year).
// Parts are parsed manually (not `new Date(iso)`) to avoid the UTC-midnight
// off-by-one a timezone shift would cause.
function fmtISODate(iso: string | null | undefined, withYear = true): string | null {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  });
}

/**
 * Wedding-date label for the date chip. The committed exact `event_date` is
 * handled by the caller's `formattedDate` arg; THIS covers onboarding events
 * (event_date is null — the date lives in date_mode/candidates/window):
 *   - flexible window → "Aug 1 – Aug 30, 2026"
 *   - single candidate → "Aug 15, 2026"
 *   - multiple candidates → "3 possible dates"
 * Returns null when there's nothing to show.
 */
export function formatWeddingDateLabel(event: EventTasteSource): string | null {
  if (
    event.date_mode === 'window' &&
    event.date_window_start &&
    event.date_window_end
  ) {
    const start = fmtISODate(event.date_window_start, false);
    const end = fmtISODate(event.date_window_end, true);
    if (start && end) return `${start} – ${end}`;
    return end ?? start;
  }
  const candidates = (event.date_candidates ?? []).filter(Boolean);
  if (candidates.length === 1) {
    const single = fmtISODate(candidates[0], true);
    if (single) return single;
  }
  if (candidates.length > 1) {
    return `${candidates.length} possible dates`;
  }
  return null;
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
  // Onboarding-v2 date capture (migration 20260719000000). Onboarding events
  // have a null event_date — the date lives here as candidate date(s) or a
  // flexible window until it settles on vendor availability.
  // formatWeddingDateLabel surfaces it so the date chip isn't blank.
  date_mode?: string | null;
  date_candidates?: string[] | null;
  date_window_start?: string | null;
  date_window_end?: string | null;
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

  // Committed exact date wins; else fall back to the onboarding candidate/window
  // capture so the date chip isn't blank for onboarding events (null event_date).
  const dateLabel = formattedDate ?? formatWeddingDateLabel(event);
  if (dateLabel) chips.push({ label: dateLabel });

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
