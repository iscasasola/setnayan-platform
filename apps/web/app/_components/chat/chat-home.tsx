'use client';

/**
 * 💬 THE CHAT THAT HOLDS EVERYTHING — what the page hands the chat it is home to (owner 19 Nov 2026, DECISION_LOG "THE
 * CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING": *"can you make it live just as a chat but everything is inside that
 * chat?"* · *"given that you can freely improve the chat"* · *"Yes, build it"*; drawing S9ScH2Ps v3).
 *
 * The chat is drawn by the thread page; the facts the strip, the suggested step and the inquiry card need were read by
 * the CLIENT page. They are two server trees, so the client page's shell provides them here and the chat's own parts
 * read them — no second request, no prop threaded through a 2,600-line page:
 *
 *   · `top`      the summary strip, drawn FIRST in the chat's one pinned stack (above the shipped pins);
 *   · `suggest`  the one suggested step inside the text box (`ChatSendForm`);
 *   · `inquiry`  the couple's first inquiry, as a card (`InquiryCard`, in the stream).
 *
 * Absent (the routed thread page, the host's side, a lab) every reader draws nothing: the chat is exactly as shipped.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { PlusCardKind } from '@/lib/chat-plus';

/** One suggested step — a chip in the text box that opens the same card its (+) row opens. */
export type SuggestedStep = { label: string; card: PlusCardKind };

/**
 * The facts of the first inquiry the PAGE knows (the event, as the supplier may see it). `null` = not given. The card
 * itself reads the service off the inquiry's own words and the sender off the chat (`InquiryCard`).
 */
export type InquiryFacts = {
  date: string | null;
  guests: string | null;
  venue: string | null;
  budget: string | null;
  /** A quote is already in this chat: the card stops offering "Reply with an offer". null = the quotes read failed —
   *  unknown, never said as "no quote" (the same rule as the strip's `suggestedStep`). */
  hasQuote: boolean | null;
};

export type ChatHome = {
  top: ReactNode;
  suggest: SuggestedStep | null;
  inquiry: InquiryFacts | null;
};

const ChatHomeContext = createContext<ChatHome | null>(null);

export function ChatHomeProvider({ value, children }: { value: ChatHome; children: ReactNode }) {
  return <ChatHomeContext.Provider value={value}>{children}</ChatHomeContext.Provider>;
}

export function useChatHome(): ChatHome | null {
  return useContext(ChatHomeContext);
}

/** The strip, where the chat's pinned stack (or a chat with no conversation yet) draws it. */
export function ChatHomeTop() {
  const home = useContext(ChatHomeContext);
  return home?.top ? <>{home.top}</> : null;
}
