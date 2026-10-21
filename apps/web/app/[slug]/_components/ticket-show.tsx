'use client';

import { useId, useState } from 'react';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { PASS_CARD_WORDS } from '@/lib/pass-card';
import { GuestSheet } from './guest-sheet';

/**
 * 🎫 THE TICKET IS THE "SHOW" (owner 2026-10-21, "Yes to all" on
 * `Setnayan/prototypes/guest_page_fixes_2_4_2026-10-21.html`, fix 4). A
 * plus-one's small ticket on Me is pressable: it opens the guest page's one
 * sheet (`GuestSheet`, the "My QR" pop-up) with the SAME picture drawn big —
 * scannable at the door for a child or an elder with no phone (#6151 frame E's
 * "Show pass") — and "Save <name>’s ticket" inside it. It replaced the row's
 * "Show <name>’s ticket" (a second drawing of the QR the ticket already
 * carries) and its "Save" line: two doors to one thing.
 *
 * 🔑 Both pictures are the route's own PNG (`href`), the file Save hands over.
 */
export function TicketShow({
  href,
  alt,
  eyebrow,
  saveLabel,
}: {
  href: string;
  alt: string;
  /** "Pamela’s ticket". */
  eyebrow: string;
  /** "Save Pamela’s ticket". */
  saveLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${eyebrow} — ${PASS_CARD_WORDS.showAtDoor}`}
        aria-haspopup="dialog"
        data-ticket-show=""
        className="shrink-0 rounded-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the route's own PNG, cookie-authenticated; next/image would proxy it without the cookie */}
        <img
          src={href}
          alt={alt}
          width={96}
          height={128}
          loading="lazy"
          className="block h-32 w-24 rounded-md bg-ink/[0.04] object-cover shadow-sm"
        />
      </button>
      {open ? (
        <GuestSheet titleId={titleId} eyebrow={eyebrow} title={PASS_CARD_WORDS.showAtDoor} onClose={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the same PNG, drawn big */}
          <img
            src={href}
            alt={alt}
            width={216}
            height={288}
            data-ticket-shown=""
            className="mx-auto mt-5 block aspect-[3/4] h-auto w-[min(216px,100%)] rounded-xl bg-white shadow-xl"
          />
          <div className="mt-5 flex justify-center">
            <SavePassCardButton hrefs={[href]} label={saveLabel} />
          </div>
        </GuestSheet>
      ) : null}
    </>
  );
}
