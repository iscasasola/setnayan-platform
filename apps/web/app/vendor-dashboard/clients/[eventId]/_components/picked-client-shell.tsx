'use client';

/**
 * 🗂 THE PICKED CLIENT (THE ONE BUILD, 8 Nov 2026 · prototype v113, B1 step 5). OWNER: L2.
 *
 * One screen over the still-mounted Clients list (or the envelope's Chats, Supplier Build 3 ✉️): the pinned row (the
 * client's name · ⚙ · ✕), the nine-page menu (Details · Chat · Schedule · Quotation · Payment · Forms · Files · Hub ·
 * Report — Payment and Hub once booked) and ONE page body at a time. It replaces the flag-ON `RelationshipTabShell`
 * branch of `clients/[eventId]/page.tsx`; the flag-off card is untouched.
 *
 * 🪞 THE SCREEN ITSELF IS THE ONE PICKED SHELL (`app/_components/picked/picked-shell.tsx`, Supplier Build 3 · Lane A,
 * 9 Nov 2026) — the host's picked supplier opens through the SAME component (owner 8 Nov: *"and will it take up the same
 * full screen effect"*). This file only hands it the client's menu, icons, doors and ⚙: how it opens, closes, layers
 * and switches pages lives there, once.
 *
 * ⚡ The other pages' code loads on demand (`_pages/lazy.tsx`); the shell warms it at idle once the open has settled
 * (`warmEveryPage` below — `warmPickedPages(); warmThreadParts(); warmHubParts();`, called through `requestIdleCallback`
 * in the shell). Code only — no data, no request to our server.
 */
import type { ReactNode } from 'react';
import {
  CalendarDays,
  ClipboardList,
  Flag,
  FolderOpen,
  Info,
  LayoutDashboard,
  MessageSquare,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { PickedShell } from '@/app/_components/picked/picked-shell';
import { SUPPLIER_PICKED_LISTS } from '@/app/_components/picked/picked-motion';
import type { PickedClientPage } from './picked-client-menu';
import { SCRIPT_FOLD_ID } from './picked-client-menu';
import { warmPickedPages } from '../_pages/lazy';
import { warmThreadParts } from '../../../messages/[threadId]/_components/on-demand';
import { warmHubParts } from '../../../on-the-day/_components/on-demand';

/** Every non-Details page's code (Chat · Quotation · the thread's parts, Hub, Forms · Files · Payment · Report). */
function warmEveryPage(): void {
  warmPickedPages();
  warmThreadParts();
  warmHubParts();
}

const PAGE_ICON: Record<PickedClientPage, LucideIcon> = {
  details: Info,
  chat: MessageSquare,
  schedule: CalendarDays,
  quote: ReceiptText,
  payments: Wallet,
  forms: ClipboardList,
  files: FolderOpen,
  hub: LayoutDashboard,
  report: Flag,
};

export const CLIENTS_LIST_HREF = '/vendor-dashboard/customers';

export function PickedClientShell({
  eventId,
  eventName,
  menu,
  initialPage,
  bodies,
  scrollToScript = false,
  settingsLine,
  settings,
  chatUnread = null,
}: {
  eventId: string;
  eventName: string;
  /** The menu this client's stage shows, in order (`pickedMenuFor`). */
  menu: { id: PickedClientPage; label: string }[];
  /** The page the URL names, resolved on the server (`visiblePickedPage`) so the first paint is the right page. */
  initialPage: PickedClientPage;
  bodies: Record<PickedClientPage, ReactNode>;
  /** `?tab=script` — land on Schedule scrolled to the Script fold. */
  scrollToScript?: boolean;
  /** The ⚙ sheet's one line. */
  settingsLine: { line: string; tip: string };
  /** The ⚙ sheet's rows (shipped facts only). */
  settings: ReactNode;
  /** 🔴 The Chat tab's unread count (`readThreadUnreadCount`); null = unmeasured or no chat — no badge. */
  chatUnread?: number | null;
}) {
  return (
    <PickedShell<PickedClientPage>
      // 📌 Chat fills the body and scrolls inside itself — the shell's pinned row and menu stay put above it.
      fillPages={['chat']}
      badges={{ chat: chatUnread }}
      pickedId={eventId}
      title={eventName}
      menu={menu}
      icons={PAGE_ICON}
      initialPage={initialPage}
      bodies={bodies}
      pagePath={`/vendor-dashboard/clients/${eventId}`}
      originFrom={SUPPLIER_PICKED_LISTS}
      closeHref={CLIENTS_LIST_HREF}
      warm={warmEveryPage}
      scrollTo={scrollToScript ? { page: 'schedule', id: SCRIPT_FOLD_ID } : null}
      gear={{ menu: 'client', line: settingsLine, node: settings }}
    />
  );
}
