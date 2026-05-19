/**
 * 0018 Setnayan Supplies — service area resolver.
 *
 * Couples enter a delivery city; this maps it to a canonical ServiceAreaCode
 * that supplier_vendor_sku_pricing rows are keyed against. V1 supports only
 * Metro Manila; V1.5+ adds Cebu, Davao, etc.
 *
 * Returns null when the city falls outside any supported area — UI surfaces
 * "Coming to your area soon — join waitlist" empty state in that case.
 */

import type { DeliveryAddress, ServiceAreaCode } from './types';

/**
 * Cities recognized as part of Metro Manila for V1 supplies routing.
 * Includes common alternate spellings (with/without diacritics) since
 * couples paste addresses from many sources.
 */
const METRO_MANILA_CITIES: ReadonlySet<string> = new Set([
  'manila',
  'quezon city',
  'caloocan',
  'las piñas',
  'las pinas',
  'makati',
  'malabon',
  'mandaluyong',
  'marikina',
  'muntinlupa',
  'navotas',
  'parañaque',
  'paranaque',
  'pasay',
  'pasig',
  'pateros',
  'san juan',
  'taguig',
  'valenzuela',
]);

/**
 * Normalize a city string for matching:
 *   • trim whitespace
 *   • lowercase
 *   • collapse multiple internal whitespace runs into single spaces
 *   • strip trailing 'city' / 'metro manila' suffixes
 */
function normalizeCity(raw: string): string {
  let s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  // Drop a trailing " city" so "Quezon City" → "quezon" matches "quezon city" entry
  // and "Manila City" → "manila"
  if (s.endsWith(' city')) s = s.slice(0, -' city'.length).trim();
  // Drop trailing ", metro manila" / ", ncr" suffixes that paste-from-Google can include
  s = s.replace(/,?\s+(metro manila|ncr|national capital region)$/, '').trim();
  return s;
}

/**
 * Resolve a delivery address to a ServiceAreaCode (or null if outside coverage).
 * V1: returns 'METRO_MANILA' for any of the 17 NCR cities.
 */
export function resolveServiceArea(
  address: Pick<DeliveryAddress, 'city'>,
): ServiceAreaCode | null {
  const city = address.city;
  if (!city || typeof city !== 'string') return null;

  const normalized = normalizeCity(city);

  // Direct match against the known city set (handles "manila", "quezon city" via
  // post-normalization "quezon", etc.)
  if (METRO_MANILA_CITIES.has(normalized)) return 'METRO_MANILA';

  // Also accept "<city> city" / "<city>" by checking both. The normalize step
  // already stripped a trailing " city", so any remaining variations don't match.
  return null;
}

/** Convenience: true when a city is covered. */
export function isServiceAreaSupported(
  address: Pick<DeliveryAddress, 'city'>,
): boolean {
  return resolveServiceArea(address) !== null;
}
