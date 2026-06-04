import type { TasteChip } from '@/app/dashboard/[eventId]/_components/personalized-menu';

/**
 * Mapper for the couple's match-criteria surfaces.
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
 * (`buildServiceFeatures` / `buildWeddingDetailRows` fed the now-retired
 * PersonalizedMenu card — pending dead-code removal.)
 */

// Exported so the Personalization page (/dashboard/[eventId]/details) renders
// the SAME labels the Home block does — one source of truth (CLAUDE.md
// 2026-06-02 Phase B). "ceremony" suffix dropped on the bare type for the
// page's documentation rows; the chip-style suffix stays in buildTasteChips.
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
 * Wedding-date label for the Home card. The committed exact `event_date` is
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
  // flexible window until it settles on vendor availability. formatWeddingDateLabel
  // surfaces it so the Home card's date chip isn't blank.
  date_mode?: string | null;
  date_candidates?: string[] | null;
  date_window_start?: string | null;
  date_window_end?: string | null;
  // Display-only per-service style blob (migration 20260724000000) — feeds
  // buildServiceFeatures for the "What matters for your services" list. NOT
  // vendor matching (CLAUDE.md 2026-06-02 Phase A2).
  style_preferences?: Record<string, unknown> | null;
};

/**
 * A "what matters for your services" row on the Home Personalized card — built
 * from events.style_preferences (the onboarding style sub-stepper picks). One
 * row per non-empty preference dimension. Display only.
 */
export type ServiceFeature = {
  /** The pref key (reception/cuisine/pvLook/…) — stable for React keys. */
  dimension: string;
  /** Human label (e.g. "Reception look", "Photo & video style"). */
  label: string;
  /** Cleaned, joined value(s) (e.g. "Garden · Beach"). */
  values: string;
};

// Dimension → human label. Owner-specified map (2026-06-02). Unknown keys fall
// back to titleCase so a future onboarding dimension still renders.
const SERVICE_FEATURE_LABELS: Record<string, string> = {
  feel: 'Overall style',
  reception: 'Reception look',
  ceremony: 'Ceremony setting',
  cuisine: 'Cuisine',
  serviceStyle: 'Catering style',
  dietary: 'Dietary',
  pvLook: 'Photo & video style',
  pvNeed: 'Photo & video',
  pvIncluded: 'Coverage includes',
  music: 'Music vibe',
};

// Natural reading order — overall style leads, then service-by-service. Any
// key not listed here is appended (titleCased) so nothing is silently dropped.
const SERVICE_FEATURE_ORDER = [
  'feel',
  'reception',
  'ceremony',
  'cuisine',
  'serviceStyle',
  'dietary',
  'pvLook',
  'pvNeed',
  'pvIncluded',
  'music',
];

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

// Strip the onboarding key prefixes (setting_garden → Garden, feel_timeless →
// Timeless, cuisine_filipino → Filipino, pv_classic → Classic) then titleCase.
function cleanFeatureValue(raw: string): string {
  return titleCase(raw.replace(/^(setting_|feel_|cuisine_|pv_)/, ''));
}

// One pref value → a display string (or null to skip). Arrays join with " · ";
// the music seed (a list of "Title|Artist" picks, not a vibe descriptor) is
// summarized as a count rather than dumped. Anything that isn't a non-empty
// string / non-empty string-array is skipped.
function featureValueString(key: string, raw: unknown): string | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const vals = raw.filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
    if (vals.length === 0) return null;
    if (key === 'music') {
      return `${vals.length} song${vals.length === 1 ? '' : 's'} picked`;
    }
    return vals.map(cleanFeatureValue).join(' · ');
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return cleanFeatureValue(trimmed);
  }
  return null;
}

/**
 * Turns the onboarding style_preferences blob into "what matters for your
 * services" rows for the Home Personalized card (owner 2026-06-02: "the
 * features that matter for the different services"). One row per non-empty
 * dimension, known dimensions first in reading order, unknown keys appended
 * titleCased. Robust: missing/empty/non-string values are skipped, never thrown.
 */
export function buildServiceFeatures(
  stylePrefs: Record<string, unknown> | null | undefined,
): ServiceFeature[] {
  if (!stylePrefs || typeof stylePrefs !== 'object') return [];
  const rows: ServiceFeature[] = [];
  const seen = new Set<string>();

  for (const key of SERVICE_FEATURE_ORDER) {
    if (!(key in stylePrefs)) continue;
    const values = featureValueString(key, stylePrefs[key]);
    if (!values) continue;
    rows.push({
      dimension: key,
      label: SERVICE_FEATURE_LABELS[key] ?? titleCase(key),
      values,
    });
    seen.add(key);
  }

  for (const key of Object.keys(stylePrefs)) {
    if (seen.has(key)) continue;
    const values = featureValueString(key, stylePrefs[key]);
    if (!values) continue;
    rows.push({
      dimension: key,
      label: SERVICE_FEATURE_LABELS[key] ?? titleCase(key),
      values,
    });
  }

  return rows;
}

// ── Compact "Your wedding details" card (Home) ──────────────────────────────

export type WeddingDetailRow = { key: string; label: string; value: string };

// Budget as a bare "₱650,000" (no " budget" suffix) for the kv-card value cell.
function budgetValueBare(centavos: number | null | undefined): string | null {
  if (centavos == null || centavos <= 0) return null;
  const pesos = Math.round(centavos / 100);
  return `₱${pesos.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

// One style_preferences dimension → its cleaned display value (or null),
// reusing the same cleaning as the "what matters" list (cuisine_filipino →
// "Filipino", pv_editorial → "Editorial").
function stylePrefValue(
  stylePrefs: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!stylePrefs || typeof stylePrefs !== 'object') return null;
  return featureValueString(key, (stylePrefs as Record<string, unknown>)[key]);
}

/**
 * The compact "Your wedding details" rows for the Home card (owner 2026-06-03).
 * A keyed label→value list that MERGES the events-row basics (location · venue ·
 * guests · budget · style) with the two most service-defining onboarding style
 * picks (cuisine · photo & video). Date + ceremony are intentionally omitted —
 * the persistent top chrome (BudgetCountdownHeader) already shows them. Only
 * present fields render; nothing is fabricated, so the card never shows blanks.
 */
export function buildWeddingDetailRows(event: EventTasteSource): WeddingDetailRow[] {
  const rows: WeddingDetailRow[] = [];
  const push = (key: string, label: string, value: string | null | undefined) => {
    if (value && value.trim()) rows.push({ key, label, value: value.trim() });
  };

  const region = event.region ?? null;
  push('location', 'Location', region ? REGION_LABEL[region] ?? titleCase(region) : null);

  const venue = event.venue_setting ?? null;
  push('venue', 'Venue', venue ? VENUE_LABEL[venue] ?? titleCase(venue) : null);

  push(
    'guests',
    'Guests',
    event.estimated_pax != null && event.estimated_pax > 0 ? `${event.estimated_pax}` : null,
  );

  push('budget', 'Budget', budgetValueBare(event.estimated_budget_centavos ?? null));

  const feel = event.mood_feel_key ?? null;
  push('style', 'Style', feel ? titleCase(feel) : null);

  push('cuisine', 'Cuisine', stylePrefValue(event.style_preferences, 'cuisine'));
  push('photo', 'Photo & video', stylePrefValue(event.style_preferences, 'pvLook'));

  return rows;
}
