'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { DatesRow } from './dates-row';

/**
 * LOG A PAYMENT — Money's thumb row (S-PR4; frame 05: "thumb row = Log a payment"; plan § 10 "Money › row › Log a
 * payment = 3").
 *
 * 🔑 THE SHIPPED DOOR, NOT A SECOND FORM. A supplier logs a couple's payment in the conversation's payment band —
 * the customer card's own "Log payment" opens `/vendor-dashboard/messages/<thread>#pending-payments`, where the
 * shipped confirm / not-received answers live (`confirmVendorPayment`). This sheet asks only WHOSE payment, then
 * opens that same place. A booking with no conversation opens its card, whose Payments section holds the rest.
 *
 * The ONE main on the Money screen (owner 2026-10-12/13: one terracotta main per screen). Portalled: the thumb row
 * is `position: fixed` with its own layer, and a dialog drawn inside it would sit under the bars.
 */
export type MoneyLogCustomer = { eventId: string; name: string; line: string; href: string };

export function MoneyLog({ customers, startOpen = false }: { customers: readonly MoneyLogCustomer[]; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-5 pt-5" data-money-log="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Log a payment
        </h2>
        <p className="mt-1 text-[13.5px] text-ink/60">Whose payment?</p>
        <div className="mt-2">
          {customers.length === 0 ? (
            <p className="py-3 text-[14px] text-ink/70" data-money-log-none="">
              No booked customer yet. A payment is logged on a booking — once a couple books you, they are listed here.
            </p>
          ) : (
            customers.map((c) => <DatesRow key={c.eventId} data="money-log-row" title={c.name} line={c.line} href={c.href} />)
          )}
        </div>
      </div>
    </Sheet>
  );

  return (
    <>
      <ActionButton
        tone="brand"
        main
        icon={Check}
        label="Log a payment"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        data-testid="money-log"
        className="flex-1"
      />
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}
