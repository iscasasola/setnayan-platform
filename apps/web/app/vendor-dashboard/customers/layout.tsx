/**
 * 🗂 THE CLIENTS LIST + THE PICKED CLIENT OVER IT (THE ONE BUILD, 8 Nov 2026 · B1 step 5).
 *
 * `children` is the Clients list. `client` is the picked client, drawn OVER the still-mounted list when it is opened
 * from it by a soft tap: `@client/(..)clients/[eventId]` intercepts `/vendor-dashboard/clients/<id>` and renders the
 * SAME page (it re-exports the default — there is no second page body). The list never unmounts, so closing the
 * client is the exact reverse of opening it and the list keeps its scroll. A hard load of the client's URL (Today,
 * a notification, a typed link) is not intercepted and renders the full route.
 */
import type { ReactNode } from 'react';

export default function ClientsLayout({ children, client }: { children: ReactNode; client: ReactNode }) {
  return (
    <>
      {children}
      {client}
    </>
  );
}
