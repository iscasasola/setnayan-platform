/**
 * 🪞 THE HOST'S CHATS + THE PICKED SUPPLIER OVER IT (Supplier Build 3 · Lane A, 9 Nov 2026 — DECISION_LOG 🪞, and owner
 * 8 Nov *"and will it take up the same full screen effect"*: yes).
 *
 * `children` is the Chats list (or a full-screen thread). `supplier` is the picked supplier, drawn OVER the still-mounted
 * list when a row is tapped: `@supplier/(..)vendors/[vendorId]/workspace` intercepts the supplier's workspace URL and
 * renders the SAME page (it re-exports the default — there is no second page body), the way the supplier's Clients and
 * Chats draw their picked client (`vendor-dashboard/customers/layout.tsx`). A hard load of the workspace URL (the
 * Suppliers list, a notification) is not intercepted and renders the full route.
 */
import type { ReactNode } from 'react';
// 🖥 The system's two columns (`.sn-cols`) — the Chats list beside the open thread from 701 (`_components/chat-panes.tsx`).
// The supplier tree loads this file in its own layout; the couple's Chats is the one couple page that uses the columns.
import '@/app/vendor-dashboard/_components/supplier-frame.css';

export default function HostChatsLayout({ children, supplier }: { children: ReactNode; supplier: ReactNode }) {
  return (
    <>
      {children}
      {supplier}
    </>
  );
}
