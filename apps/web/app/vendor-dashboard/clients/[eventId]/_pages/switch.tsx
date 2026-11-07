/**
 * 🗂 THE PAGE-ID SWITCH — one place that turns a picked client's facts into its nine page bodies
 * (THE ONE BUILD, 8 Nov 2026). OWNER: **L2**.
 *
 * `clients/[eventId]/page.tsx` resolves the context once and calls `pickedPageBodies`; `PickedClientShell` then
 * shows ONE body at a time and switches with `history.replaceState(?tab=)` — no request per switch. Every body is
 * a component in its own `_pages/<page>.tsx` file, so a lane filling its page edits only that file.
 *
 * A body a client's menu does not show (Payment / Hub before booking) is not built at all — `null`, never an empty
 * page that reads as "nothing here".
 */
import type { ReactNode } from 'react';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import type { PickedClientPage } from '../_components/picked-client-menu';
import { pickedMenuFor } from '../_components/picked-client-menu';
import type { PickedPageContext } from './context';
import { DetailsPage } from './details';
import { ChatPage } from './chat';
import { SchedulePage } from './schedule';
import { QuotationPage } from './quotation';
import { PaymentPage } from './payment';
import { FormsPage } from './forms';
import { FilesPage } from './files';
import { HubPage } from './hub';
import { ReportPage } from './report';

export type PickedPageInputs = {
  ctx: PickedPageContext;
  /** The section each page drew before this build — relocated, never redrawn. */
  shipped: Partial<Record<PickedClientPage, ReactNode>>;
  files: { files: SharedFileEntry[]; chatFilesMeasured: boolean };
  payment: { reservationAcknowledgedAt: string | null };
};

export function pickedPageBodies(i: PickedPageInputs): Record<PickedClientPage, ReactNode> {
  const { ctx, shipped } = i;
  const shown = new Set(pickedMenuFor(ctx.isBooked).map((e) => e.id));
  const only = (id: PickedClientPage, node: ReactNode): ReactNode => (shown.has(id) ? node : null);
  return {
    details: only('details', <DetailsPage ctx={ctx} shipped={shipped.details} />),
    chat: only('chat', <ChatPage ctx={ctx} shipped={shipped.chat} />),
    schedule: only('schedule', <SchedulePage ctx={ctx} shipped={shipped.schedule} />),
    quote: only('quote', <QuotationPage ctx={ctx} shipped={shipped.quote} />),
    payments: only(
      'payments',
      <PaymentPage
        ctx={ctx}
        shipped={shipped.payments}
        reservationAcknowledgedAt={i.payment.reservationAcknowledgedAt}
      />,
    ),
    forms: only('forms', <FormsPage ctx={ctx} shipped={shipped.forms} />),
    files: only(
      'files',
      <FilesPage
        ctx={ctx}
        shipped={shipped.files}
        files={i.files.files}
        chatFilesMeasured={i.files.chatFilesMeasured}
        threadId={ctx.threadId}
        isBooked={ctx.isBooked}
      />,
    ),
    hub: only('hub', <HubPage ctx={ctx} shipped={shipped.hub} />),
    report: only('report', <ReportPage ctx={ctx} shipped={shipped.report} />),
  };
}
