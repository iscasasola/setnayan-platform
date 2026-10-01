import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { isStoreShellRequest } from '@/lib/request-platform';
import { getNavSlotMap } from '@/lib/nav-registry';
import { vendorMoreRows } from '@/lib/vendor-more-rows';

export const metadata = { title: 'More · Setnayan' };

/**
 * /vendor-dashboard/more — the supplier's "More", as a page.
 *
 * ⏮ RETIRED 2026-07-16, BACK 2026-10-01. It was retired as a 1:1 duplicate of
 * the five tabs then on screen. The supplier phone app (owner-APPROVED
 * 2026-10-01, DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE
 * RECOMMENDED ANSWERS") cut the bar to Today · Customers · Shop · More, so More
 * now holds rows that are on NO tab — Messages, Insights, the Event Hub — and is
 * not a duplicate of anything.
 *
 * On a phone the More TAB opens a sheet (the host's shipped one) and this page is
 * where its href lands before the sheet has loaded; on a laptop the rail's More
 * row opens it. Both draw `vendorMoreRows` — the ONE list.
 *
 * Owner and admin only: a scoped teammate's bar has no More (the staff filter),
 * and most rows behind it are owner rooms.
 */
export default async function VendorMorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const role = await resolveVendorRole(supabase, user.id);
  if (role && !canManageVendor(role)) redirect('/vendor-dashboard');

  const [storeShell, navSlots] = await Promise.all([
    isStoreShellRequest(),
    getNavSlotMap().catch(() => undefined),
  ]);
  const rows = vendorMoreRows({ storeShell, navSlots });

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-4 space-y-1">
        <h1 className="sn-h1">More</h1>
        <p className="text-sm text-ink/60">Everything that is not on the bar.</p>
      </header>
      <ul className="sn-glass-bare grid gap-1 rounded-2xl p-2">
        {rows.map((row) => {
          const Icon = row.Icon;
          return (
            <li key={row.key}>
              <Link
                href={row.href}
                className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 py-2 text-[15px] text-ink hover:bg-ink/5"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink/70">
                  <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{row.label}</span>
                  <span className="block text-[12.5px] text-ink/55">{row.sub}</span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
