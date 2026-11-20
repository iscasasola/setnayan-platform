'use client';

/**
 * 🗂 THE PICKED CLIENT (THE ONE BUILD, 8 Nov 2026 · prototype v113, B1 step 5). OWNER: L2.
 *
 * 💬 ONE CHAT THAT HOLDS EVERYTHING (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS
 * EVERYTHING"; drawing S9ScH2Ps v3). One screen over the still-mounted Clients list (or the envelope's Chats): the pinned
 * row (the client's name — the door to Details · ⋯ · ⚙ · ✕) and the CHAT. The seven-tab row is gone on a phone: the
 * summary strip on top of the chat (`ClientChatStrip`) raises Book & Budget · Schedule · Details at Forms · Details at
 * Decisions full screen over it, the name raises Details, and ⋯ holds Files · Hub · Report (`chatHome`). No page body
 * was redrawn — only the way in changed, and every `?tab=` door opens the chat with that page risen.
 * 🖥 On a computer (≥ 1024) Chat keeps its own right column and the other pages switch the work column beside it
 * (`sideChat`, owner 18 Nov) — the tab row stays there. It replaces the flag-ON `RelationshipTabShell` branch of
 * `clients/[eventId]/page.tsx`; the flag-off card is untouched.
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
import { useMemo, type ReactNode } from 'react';
import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { ChatHomeProvider, type ChatHome, type InquiryFacts, type SuggestedStep } from '@/app/_components/chat/chat-home';
import { TOPIC_ICON } from '@/lib/topic-icons';
import { PickedShell } from '@/app/_components/picked/picked-shell';
import { SUPPLIER_PICKED_LISTS } from '@/app/_components/picked/picked-motion';
import { CLIENTS_LIST_HREF } from '@/lib/picked-client-close';
import type { PickedClientPage } from './picked-client-menu';
import { pickedAnchorOf, pickedPageNamed } from './picked-client-menu';
import { warmPickedPages } from '../_pages/lazy';
import { warmThreadParts } from '../../../messages/[threadId]/_components/on-demand';
import { warmHubParts } from '../../../on-the-day/_components/on-demand';

/** Every non-Details page's code (Chat · Quotation · the thread's parts, Hub, Forms · Files · Payment · Report). */
function warmEveryPage(): void {
  warmPickedPages();
  warmThreadParts();
  warmHubParts();
}

// 🔣 One icon per topic (Build 3 · lane B): the tab wears the same glyph as its pins, cards and Details rows.
const PAGE_ICON: Record<PickedClientPage, LucideIcon> = {
  details: TOPIC_ICON.details,
  chat: TOPIC_ICON.chat,
  schedule: TOPIC_ICON.schedule,
  quote: TOPIC_ICON.quote,
  payments: TOPIC_ICON.payment,
  forms: TOPIC_ICON.forms,
  files: TOPIC_ICON.files,
  hub: TOPIC_ICON.hub,
  report: TOPIC_ICON.report,
};


/** ‹ The named way back (drawing `supplier_clients_clean_2026-11-16`: "‹ Calendar"). */
const CLOSE_TO_CALENDAR = { label: 'Calendar', icon: ChevronLeft } as const;

/**
 * 🔦 The supplier tour's two stops inside a client (owner 12 Nov 2026): where the chat is, and where the quotation is.
 * With the chat as the page they left the tab row: the chat's stop is the client's name in the head (`titleTour: 'client-chat'`, written literally so the spotlight guard can see it), and
 * the quotation's is the strip's money box (`ClientChatStrip` wears `client-quote`).
 */

/** 💬 What sits behind the head's ⋯ — the pages with no box in the strip, in the old menu's order (Hub once booked). */
const MORE_PAGES: readonly PickedClientPage[] = ['files', 'hub', 'report'];

export function PickedClientShell({
  eventId,
  eventName,
  menu,
  initialPage,
  bodies,
  landAt = null,
  workDefault = 'details',
  strip = null,
  suggest = null,
  inquiry = null,
  settingsLine,
  settings,
  chatUnread = null,
  closeHref = CLIENTS_LIST_HREF,
}: {
  eventId: string;
  eventName: string;
  /** The menu this client's stage shows, in order (`pickedMenuFor`). */
  menu: { id: PickedClientPage; label: string }[];
  /** The page the URL names, resolved on the server (`visiblePickedPage`) so the first paint is the right page. */
  initialPage: PickedClientPage;
  bodies: Record<PickedClientPage, ReactNode>;
  /** The part of the first page to land on (`?tab=script` → `script`, `?tab=payments` → `payments`), or null. */
  landAt?: string | null;
  /** 🖥 What the work column opens on, on a computer, when no `?tab=` names a page (`workColumnDefault`). */
  workDefault?: PickedClientPage;
  /** 💬 The summary strip, first in the chat's pinned stack (`ClientChatStrip` — Paid / Deal · Next · Forms · Decisions). */
  strip?: ReactNode;
  /** 💬 The one suggested step inside the text box, by stage (`suggestedStep`); null = none (or an unread stage). */
  suggest?: SuggestedStep | null;
  /** 💬 The couple's first inquiry, as a card in the chat; null = no inquiry to draw. */
  inquiry?: InquiryFacts | null;
  /** The ⚙ sheet's one line. */
  settingsLine: { line: string; tip: string };
  /** The ⚙ sheet's rows (shipped facts only). */
  settings: ReactNode;
  /** 🔴 The Chat tab's unread count (`readThreadUnreadCount`); null = unmeasured or no chat — no badge. */
  chatUnread?: number | null;
  /** Where ✕ goes when the card was not opened over a list (`pickedClientCloseHref`) — Today when it came from Today. */
  closeHref?: string;
}) {
  const home = useMemo<ChatHome>(() => ({ top: strip, suggest, inquiry }), [strip, suggest, inquiry]);
  const chatHome = useMemo(
    () => ({ page: 'chat' as const, line: `${eventName} · back to chat`, titleOpens: 'details' as const, more: MORE_PAGES, titleTour: 'client-chat' }),
    [eventName],
  );
  return (
    <ChatHomeProvider value={home}>
    <PickedShell<PickedClientPage>
      // 📌 Chat fills the body and scrolls inside itself — the shell's pinned row and menu stay put above it.
      fillPages={['chat']}
      badges={{ chat: chatUnread }}
      chatHome={chatHome}
      pickedId={eventId}
      title={eventName}
      menu={menu}
      icons={PAGE_ICON}
      initialPage={initialPage}
      bodies={bodies}
      pagePath={`/vendor-dashboard/clients/${eventId}`}
      originFrom={SUPPLIER_PICKED_LISTS}
      closeHref={closeHref}
      warm={warmEveryPage}
      scrollTo={landAt ? { page: initialPage, id: landAt } : null}
      pageOf={pickedPageNamed}
      anchorOf={pickedAnchorOf}
      sideChat={{ page: 'chat', workDefault }}
      gear={{ menu: 'client', line: settingsLine, node: settings }}
      // ‹ Over the Clients month on a computer the event spans columns 2 + 3, and its way back is "‹ Calendar" (owner,
      // 17 Nov). Drawn always, SHOWN only there (`supplier-frame.css`); everywhere else it stays today's ✕.
      closeAs={CLOSE_TO_CALENDAR}
    />
    </ChatHomeProvider>
  );
}
