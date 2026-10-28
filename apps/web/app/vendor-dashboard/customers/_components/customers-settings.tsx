'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';

/**
 * ⚙ CUSTOMERS SETTINGS (owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER
 * PAGE": "Customers ⚙ = getting paid + booking terms + teams/days"; prototype `custSettings()`). The house ⚙
 * (`MenuSettingsButton`, menu `customers`), mounted ONCE here, at the right end of Customers' pinned row on all three
 * views.
 *
 * 🔑 THE SHEET IS READ ONLY WHEN IT IS OPEN. Its rows are the SHIPPED editors (How clients pay you, How many a day, the
 * halls, Exact time slots, Phone calendar), and they need reads the page itself does not (payment methods, every
 * schedule's services). Reading them on every Customers visit would pay for a sheet nobody opened, so the ⚙ writes
 * `?gear=1` into the address (no scroll, no reload of what is on screen) and the server draws the rows for that
 * address; until they arrive the sheet says so. A save inside comes back to the same address — `gear=1` — so the
 * sheet is still open on what was just saved ("a save never resets the screen").
 *
 * WHAT IS IN IT IS WHAT EXISTS. "Booking terms" (shop-default downpayment % or ₱, refund window, wording) has no
 * column to save to yet — each service card carries its own schedule — so it is not drawn as a row that saves
 * nothing; it waits on its own build (see the AS-BUILT row).
 */
export function CustomersSettings({ body }: { body: ReactNode | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inUrl = params.get('gear') === '1';
  const [open, setOpen] = useState(inUrl);
  // Back/forward and a save's return keep the sheet in step with the address.
  useEffect(() => setOpen(inUrl), [inUrl]);

  const go = (next: boolean) => {
    setOpen(next);
    const q = new URLSearchParams(params.toString());
    if (next) q.set('gear', '1');
    else {
      q.delete('gear');
      q.delete('gnotice');
    }
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <MenuSettingsButton menu="customers" open={open} onOpenChange={go} tour="customers-gear">
      <div className="px-4 pb-6 pt-2" data-customers-settings="">
        {body ?? (
          <p role="status" className="py-4 text-[13.5px] text-ink/60" data-customers-settings-loading="">
            Opening your settings…
          </p>
        )}
      </div>
    </MenuSettingsButton>
  );
}
