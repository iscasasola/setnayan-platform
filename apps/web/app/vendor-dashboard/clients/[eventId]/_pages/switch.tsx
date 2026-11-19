/**
 * 🗂 THE PAGE-ID SWITCH — one place that turns a picked client's facts into its nine page bodies
 * (THE ONE BUILD, 8 Nov 2026). OWNER: **L2**.
 *
 * `clients/[eventId]/page.tsx` resolves the context once and calls `pickedPageBodies`; `PickedClientShell` then
 * shows ONE body at a time and switches with `history.replaceState(?tab=)` — no request per switch. Every body is
 * a component in its own `_pages/<page>.tsx` file, so a lane filling its page edits only that file.
 *
 * A body a client's menu does not show (Hub before booking) is not built at all — `null`, never an empty page that
 * reads as "nothing here".
 *
 * 🗂 SEVEN TABS (owner 18 Nov 2026): Payment and Forms are no longer tabs — their bodies are PARTS of two tabs, moved
 * whole, never redrawn:
 *   · **Book & Budget** (`quote`) — booked: "Paid N of M" · the Payment body (`#payments`) · the Quotation body
 *     (`#quote`, the locked quote); before booking: the Quotation body only (no payments exist yet).
 *   · **Details** — their info · the Forms body (`#forms`, the two groups + Send again) · Decisions (`#decisions`).
 * `payments` and `forms` stay `null` here: a door that names them lands on their part (`pickedAnchorOf`).
 */
import type { ReactNode } from 'react';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import type { PickedClientPage } from '../_components/picked-client-menu';
import { pickedMenuFor } from '../_components/picked-client-menu';
import type { PickedPageContext } from './context';
import type { PaymentMoney, PaymentPageProps } from './payment';
import { DetailsPage } from './details';
import { ChatPage } from './chat';
import { SchedulePage } from './schedule';
import { QuotationPage } from './quotation';
import { PaymentPage } from './payment';
import { FormsPage } from './forms';
import { FilesPage } from './files';
import { EventFilesSection } from './event-files';
import { HubPage } from './hub';
import { ReportPage } from './report';

export type PickedPageInputs = {
  ctx: PickedPageContext;
  /** The section each page drew before this build — relocated, never redrawn. */
  shipped: Partial<Record<PickedClientPage, ReactNode>>;
  files: { files: SharedFileEntry[]; chatFilesMeasured: boolean };
  /** C1's Payment page inputs — all already read by the client page (integration, 8 Nov: `money` + `asks` handed in). */
  payment: { reservationAcknowledgedAt: string | null; money?: PaymentMoney; asks?: ReactNode; refunds?: PaymentPageProps['refunds'] };
  /** 🧾 Owner 18 Nov 2026: "Paid N of M · Next due ›" and "Who it counts" on top of Book & Budget (booked only). */
  quoteTop?: ReactNode;
  /** 📋 Decisions — the list in place, from the thread's one draw (`DetailsDecisions`); drawn after Forms on Details. */
  decisions?: ReactNode;
};

/** A part of a tab a door can land on — `scroll-mt` keeps it clear of the pinned row. */
function Part({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section id={id} aria-label={label} className="mt-6 scroll-mt-4 first:mt-0" data-picked-part={id}>
      {children}
    </section>
  );
}

export function pickedPageBodies(i: PickedPageInputs): Record<PickedClientPage, ReactNode> {
  const { ctx, shipped } = i;
  const shown = new Set(pickedMenuFor(ctx.isBooked).map((e) => e.id));
  const only = (id: PickedClientPage, node: ReactNode): ReactNode => (shown.has(id) ? node : null);
  const quotation = <QuotationPage ctx={ctx} shipped={shipped.quote} />;
  return {
    details: only(
      'details',
      <>
        <DetailsPage ctx={ctx} shipped={shipped.details} />
        <Part id="forms" label="Forms">
          <FormsPage ctx={ctx} shipped={shipped.forms} />
        </Part>
        {i.decisions ? (
          <Part id="decisions" label="Decisions">
            {i.decisions}
          </Part>
        ) : null}
      </>,
    ),
    chat: only('chat', <ChatPage ctx={ctx} shipped={shipped.chat} />),
    schedule: only('schedule', <SchedulePage ctx={ctx} shipped={shipped.schedule} />),
    // 💰 BOOK & BUDGET — booked: what is paid, then the payments, then the locked quote; before booking the quote only.
    quote: only(
      'quote',
      ctx.isBooked ? (
        <>
          {i.quoteTop}
          <Part id="payments" label="Payments">
            <PaymentPage
              ctx={ctx}
              shipped={shipped.payments}
              reservationAcknowledgedAt={i.payment.reservationAcknowledgedAt}
              money={i.payment.money}
              asks={i.payment.asks}
              refunds={i.payment.refunds}
            />
          </Part>
          <Part id="quote" label="Quotation">
            <p className="home-k2 mb-2">Quotation</p>
            {quotation}
          </Part>
        </>
      ) : (
        quotation
      ),
    ),
    payments: null,
    forms: null,
    // Fee-gated as before: while the fee withholds the event, `shipped.files` is the one lock panel.
    files: only(
      'files',
      shipped.files !== undefined ? shipped.files : <FilesPage
        ctx={ctx}
        shipped={shipped.files}
        files={i.files.files}
        chatFilesMeasured={i.files.chatFilesMeasured}
        threadId={ctx.threadId}
        isBooked={ctx.isBooked}
        // 📁🏷 The board (Piece 3b) — the quoted-service groups, Select and the photo sheet's "Tag to inspiration"
        // (#7622). Without it the live Files page drew only the shared-files list (CHAT-03).
        board={<EventFilesSection ctx={ctx} mode="files" />}
      />,
    ),
    hub: only('hub', <HubPage ctx={ctx} shipped={shipped.hub} />),
    report: only('report', <ReportPage ctx={ctx} shipped={shipped.report} />),
  };
}
