import ManpowerSurface from './surface';

/**
 * /vendor-dashboard/manpower — Manpower gigs, kept and reachable by its address, with NO door (Build 3 Lane E, owner
 * 9 Nov: *"Remove manpower gigs lets not deal with this first"* — no Shop fold, no Settings row, nothing on Today).
 *
 * It used to forward to the Shop hub's `?tab=manpower` fold. That fold left Shop with the ruling, so the page now draws
 * its own shipped surface (`./surface.tsx`, unchanged) instead of forwarding to a fold that no longer exists — the page
 * and its data are untouched, only where they are drawn moved. Revisit later (owner).
 */
export default async function VendorManpowerPage() {
  return (
    <div data-manpower-page="">
      <ManpowerSurface />
    </div>
  );
}
