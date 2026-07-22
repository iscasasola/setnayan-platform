/**
 * 3D Plan / seating-lab feature flag.
 *
 * The 3D seating lab — and the branded vendor booths that render inside a
 * couple's 3D Plan — are ON by DEFAULT. `NEXT_PUBLIC_SEATING_3D` is a
 * KILL-SWITCH, not a launch flag: only the exact string 'false' disables it
 * (mirrors the lab route gate in app/dashboard/[eventId]/seating/lab/page.tsx
 * and the Studio-hub gate in lib/add-ons-catalog.ts). Centralised here so the
 * 3D Booth add-on — which is worthless if the 3D Plan is switched off — can gate
 * its BUY on the exact value the render honours (never sell a booth with nowhere
 * to appear).
 *
 * NEXT_PUBLIC_ so server surfaces (the subscription page, the booth add-on
 * action) and any client reader agree on one value.
 */
export function seating3dEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEATING_3D !== 'false';
}
