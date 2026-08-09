/**
 * Booth Studio feature flag.
 *
 * Booth Studio is the STRUCTURED, palette-harmonized poster a vendor composes
 * for one couple's event — headline / offer / price / logo / accent rendered at
 * runtime in the couple's Mood Board palette so it ENHANCES the venue instead of
 * reading as an ad breaking the fourth wall. It is a distinct render path from
 * the pre-existing raw-image booth poster (lib/booth-poster.ts).
 *
 * Unlike NEXT_PUBLIC_SEATING_3D (a kill-switch — ON unless the exact string
 * 'false'), this is a LAUNCH flag: OFF by default, ON for any of the spellings
 * lib/env-flag.ts accepts (`true` / `TRUE` / `1` / `yes` / `on`) and OFF for
 * everything else. Shipping DARK means: with the flag off, NOTHING about the 3D booth
 * changes — the structured poster never mounts, and the raw-poster path is
 * untouched.
 *
 * NEXT_PUBLIC_ so the client renderer (BoothMesh) and any server surface read
 * one value.
 */
import { envFlagEnabled } from '@/lib/env-flag';

export function boothStudioEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_BOOTH_STUDIO_ENABLED);
}
