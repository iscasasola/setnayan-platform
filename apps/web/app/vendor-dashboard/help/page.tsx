import { redirect } from 'next/navigation';

export const metadata = { title: 'Help · Supplier' };

/**
 * /vendor-dashboard/help — FORWARDS to Settings with the Help sheet open (final check B6 · A5-G2-14, drawing
 * `final-check-area-5_2026-11-25.html` § B6, approved 25 Nov). Help is no longer a page: Settings › Help opens the
 * shared Sheet with the same five doors (`SUPPLIER_HELP_ROWS`, `settings/_components/help-sheet.tsx`). The avatar's
 * Help tile and any bookmark keep this address and land on the sheet.
 * 🔒 app/vendor-dashboard/settings/help-opens-as-a-sheet.test.ts
 */
export default function VendorHelpForward() {
  redirect('/vendor-dashboard/settings?help=1');
}
