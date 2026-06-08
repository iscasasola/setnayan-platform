/**
 * /admin/money — legacy redirect → /admin/more.
 *
 * WHY: the ops-shaped nav redesign (Admin_Console_Nav_Redesign_2026-06-08.md)
 * dissolved the "Money" group. Money config (Pricing · Add-ons · Discount
 * codes · Token bands · Budget Planner · Receipts · Payment methods) now
 * lives under More → Money & Catalog; money queues (Payments · Payouts ·
 * Token sales) moved to Work. The dedicated Money mobile tab is gone, so this
 * route redirects to /admin/more for bookmark continuity.
 */

import { redirect } from 'next/navigation';

export default function AdminMoneyLegacyRedirect() {
  redirect('/admin/more');
}
