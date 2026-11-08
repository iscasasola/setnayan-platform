/**
 * ✉️ THE SUPPLIER'S CHATS + THE PICKED CLIENT OVER IT (Supplier Build 3 · Lane A, 9 Nov 2026).
 *
 * `children` is the Chats list (or a full-screen thread). `client` is the picked client, drawn OVER the still-mounted
 * list when a Chats row is tapped: `@client/(..)clients/[eventId]` intercepts `/vendor-dashboard/clients/<id>` and
 * renders the SAME page (it re-exports the default — there is no second page body), exactly as `customers/layout.tsx`
 * does for the Clients list. A hard load of the client's URL is not intercepted and renders the full route.
 */
import type { ReactNode } from 'react';

export default function ChatsLayout({ children, client }: { children: ReactNode; client: ReactNode }) {
  return (
    <>
      {children}
      {client}
    </>
  );
}
