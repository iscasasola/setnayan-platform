import { redirect } from 'next/navigation';

/**
 * 📣 FORWARDS TO SHOP › PROMOTE › SHARE YOUR WORK (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL":
 * *"Make the pages live there and not jump to another menu."*). The recaps of events you worked now live in Promote's row 4, with the same
 * share and story-card buttons (`shop/promote/_components/share-your-work.tsx`). A bookmark or an old link lands there.
 */
export default function VendorRecapsForward() {
  redirect('/vendor-dashboard/shop/promote#share');
}
