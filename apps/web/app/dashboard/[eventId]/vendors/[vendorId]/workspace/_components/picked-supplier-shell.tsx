'use client';

/**
 * 🪞 THE HOST'S PICKED SUPPLIER (Supplier Build 3 · Lane A, 9 Nov 2026 — DECISION_LOG 🪞 + owner 8 Nov *"and will it take
 * up the same full screen effect"*: yes).
 *
 * The SAME screen as the supplier's picked client — it IS the one picked shell (`app/_components/picked/picked-shell.tsx`):
 * the same pop-up layer (`--sn-z-pop`), the same `pickedMotion` open and its exact reverse on ✕ / Esc, the same tab switch
 * by `history.replaceState(?tab=)` (never a router push). This file only hands it the supplier's menu, icons and doors.
 * No ⚙: the host has no per-supplier settings rows today, and a ⚙ that opens nothing is a dead control.
 *
 * Opened from the host's Chats (the top-right chat icon) it rises over the still-mounted list
 * (`messages/@supplier/(..)vendors/[vendorId]/workspace`) on Chat; from the Suppliers list (a hard load) it is simply
 * there, on Details, and ✕ goes back to Suppliers.
 */
import type { ReactNode } from 'react';
import {
  CalendarDays,
  ClipboardList,
  FolderOpen,
  Heart,
  Info,
  MessageSquare,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { PickedShell } from '@/app/_components/picked/picked-shell';
import { pickedSupplierLists, type PickedSupplierMenuEntry, type PickedSupplierPage } from './picked-supplier-menu';

const PAGE_ICON: Record<PickedSupplierPage, LucideIcon> = {
  details: Info,
  chat: MessageSquare,
  schedule: CalendarDays,
  quote: ReceiptText,
  payments: Wallet,
  forms: ClipboardList,
  files: FolderOpen,
  inspiration: Heart,
};

export function PickedSupplierShell({
  eventId,
  eventVendorId,
  supplierName,
  menu,
  initialPage,
  bodies,
}: {
  eventId: string;
  /** `event_vendors.vendor_id` — the workspace's route key. */
  eventVendorId: string;
  supplierName: string;
  menu: PickedSupplierMenuEntry[];
  initialPage: PickedSupplierPage;
  bodies: Record<PickedSupplierPage, ReactNode>;
}) {
  return (
    <PickedShell<PickedSupplierPage>
      // 📌 Chat fills the body and scrolls inside itself — the shell's pinned row and menu stay put above it.
      fillPages={['chat']}
      pickedId={eventVendorId}
      title={supplierName}
      menu={menu}
      icons={PAGE_ICON}
      initialPage={initialPage}
      bodies={bodies}
      pagePath={`/dashboard/${eventId}/vendors/${eventVendorId}/workspace`}
      originFrom={pickedSupplierLists(eventId)}
      closeHref={`/dashboard/${eventId}/vendors`}
      gear={null}
    />
  );
}
