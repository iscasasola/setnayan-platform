'use client';

import { Download } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { PASS_CARD_ROUTE, PASS_CARD_WORDS } from '@/lib/pass-card';

/**
 * guest-save-links.tsx — the guest list's "save this file" button, as
 * CLIENT components.
 *
 * 🔑 WHY THIS FILE EXISTS. `SaveFileLink` takes its children as a FUNCTION of
 * its saving state (`(state) => …`). A function cannot cross from a server
 * component to a client component — React refuses to serialise it — so when
 * `roster-tabs.tsx` and `guest-detail-body.tsx` (both server components) wrote
 * `<SaveFileLink>{() => …}</SaveFileLink>` directly, the whole guest list
 * failed with "Functions cannot be passed directly to Client Components"
 * (production, digest 3329950423, 2026-09-27) whenever the QR-sheet door or a
 * branded guest QR was on screen. Every prop below is a plain string, so a
 * server component can render these safely; the render function lives here,
 * on the client side of the line.
 */

const DOOR =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink';

/** One guest's branded QR PNG — the drawer's "Download QR". */
export function GuestQrDownloadLink({ href, filename }: { href: string; filename: string }) {
  return (
    <SaveFileLink
      href={href}
      filename={filename}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/80 underline-offset-4 hover:text-terracotta-700 hover:underline"
    >
      {(state) => (
        <>
          <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {state === 'saving' ? 'Saving…' : 'Download QR'}
        </>
      )}
    </SaveFileLink>
  );
}

/**
 * 🎫 One guest's PASS CARD — the 1080 × 1440 PNG they save themselves, named
 * after them (lib/pass-card.ts). FREE, one at a time (owner 2026-09-29:
 * "downloading them individually is free") — only the couple's zip of every
 * card is Event Hub Pro, and that lives on Prints & Tickets. The route decides
 * who has a card (accepted, coming) and says so when this guest has none.
 */
export function GuestPassCardLink({ guestId }: { guestId: string }) {
  return (
    <SavePassCardButton
      hrefs={[`${PASS_CARD_ROUTE}?guest=${encodeURIComponent(guestId)}`]}
      label={PASS_CARD_WORDS.downloadOne}
      variant="link"
      className="!min-h-0 text-[13px] text-ink/80 no-underline hover:text-terracotta-700 hover:underline"
    />
  );
}
