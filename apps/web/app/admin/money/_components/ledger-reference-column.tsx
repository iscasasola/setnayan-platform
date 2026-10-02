/**
 * The ledger's Reference column — the ONE way from a transaction row to the
 * payments desk, where "Record a payment received" lives.
 *
 * 🔑 NEVER `hideBelow`. It carried `hideBelow: 'md'` (the idiom for "drop the
 * decorative columns on a phone") and that made recording a payment impossible
 * on a phone: the reference is the only link in the row, and on a phone the
 * row's other columns open nothing. The admin app is used from a phone (admin
 * bottom nav, mobile landing grid), and money arriving that nobody logged is
 * exactly the thing found while away from the desk (owner 2026-10-01). The
 * column is narrow and is the row's identity — it stays at every width.
 * `ledger-reference-reaches-the-phone.test.ts` renders it and fails if it
 * ever grows a `hidden` breakpoint again.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';

// Structurally a ConsoleColumn. It does not import the table (or its type) on
// purpose: the admin archetype guard counts every file that imports
// ConsoleTable, and this file renders no table.
export const LEDGER_REFERENCE_COLUMN: {
  header: string;
  mono: boolean;
  /** NEVER set — a hidden breakpoint here is the phone bug (see above). */
  hideBelow?: never;
  cell: (r: { public_id: string; reference_code: string }) => ReactNode;
} = {
  header: 'Reference',
  mono: true,
  // The row opens the payments desk ON this order — where a payment can be
  // found, approved, or recorded (owner 2026-10-01).
  cell: (r) => (
    <Link
      href={`/admin/payments?filter=all&q=${encodeURIComponent(r.public_id)}`}
      className="text-link hover:underline"
    >
      {r.reference_code}
    </Link>
  ),
};
