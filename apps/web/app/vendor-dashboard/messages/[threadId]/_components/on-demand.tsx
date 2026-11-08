'use client';

/**
 * ⚡ THE THREAD PAGE'S HEAVY PARTS LOAD ON DEMAND (release blocker, 8 Nov 2026).
 *
 * The thread page (`../page.tsx`) is drawn in THREE places: full screen, and — through `SupplierThreadBody` — inside
 * the picked client as Chat, Quotation and Details' Decisions. Because Details' Decisions renders this page, every
 * client component it imports (the message stream, the quote builder, the send row, the tools sheet …) was bundled
 * into the picked client's FIRST load, though Details draws only the Decisions list: First Load JS of
 * `/vendor-dashboard/clients/[eventId]` measured 510 kB (312 before the nine-page build).
 *
 * Each part below is the SAME component under the SAME name, its code moved to its own chunk with `next/dynamic`
 * (`ssr` on — the server still renders it in full, and the chunk is preloaded with the HTML, so the full-screen thread
 * paints and hydrates as before). Where the part is not on screen at first paint — Chat / Quotation behind Details in
 * the picked client — its chunk is fetched when that page is first shown (or earlier, when the picked client warms it
 * at idle: `warmThreadParts`), with the house's quiet loading line in between.
 *
 * Stays EAGER in `../page.tsx` (not here): the Decisions list (Details draws it at first paint), the read marker
 * (`MarkReadWhenShown`, tiny), and anything the client page imports itself (`VendorPaymentLive`).
 *
 * 🔒 app/vendor-dashboard/clients/[eventId]/_pages/the-picked-pages-load-their-code-on-demand.test.ts
 */
import dynamic from 'next/dynamic';

/** The house's quiet loading line (the picked client's bodies use the same words and look). */
function Quiet({ what }: { what: string }) {
  return (
    <p className="px-4 py-6 text-sm text-ink/55" role="status" data-picked-page-loading="">
      Loading {what}&hellip;
    </p>
  );
}

// ── The conversation ─────────────────────────────────────────────────────────────────────────────────────────────
export const ChatMessageStream = dynamic(
  () => import('@/app/_components/chat-message-stream').then((m) => m.ChatMessageStream),
  { loading: () => <Quiet what="the chat" /> },
);
export const ChatSendForm = dynamic(() => import('@/app/_components/chat-send-form').then((m) => m.ChatSendForm), {
  loading: () => null,
});
export const ThreadToolsSheet = dynamic(() => import('./thread-tools-sheet').then((m) => m.ThreadToolsSheet), {
  loading: () => null,
});
export const NegotiationComposerMenu = dynamic(
  () => import('@/app/_components/negotiation-composer-menu').then((m) => m.NegotiationComposerMenu),
  { loading: () => null },
);
export const ChatPrivacyNotice = dynamic(
  () => import('@/app/_components/chat-privacy-notice').then((m) => m.ChatPrivacyNotice),
  { loading: () => null },
);
export const ChatThreadMenu = dynamic(() => import('@/app/_components/chat-thread-menu').then((m) => m.ChatThreadMenu), {
  loading: () => null,
});
export const ChatInfoRailTrigger = dynamic(() => import('./chat-info-rail').then((m) => m.ChatInfoRailTrigger), {
  loading: () => null,
});
export const ConversationColumn = dynamic(
  () => import('@/app/_components/chat/conversation-column').then((m) => m.ConversationColumn),
  { loading: () => null },
);
export const VendorEventDayPrepCta = dynamic(
  () => import('@/app/_components/vendor-event-day-prep-cta').then((m) => m.VendorEventDayPrepCta),
  { loading: () => null },
);
export const InquiryOutcomeCapture = dynamic(
  () => import('./inquiry-outcome-capture').then((m) => m.InquiryOutcomeCapture),
  { loading: () => null },
);

// ── The quote ────────────────────────────────────────────────────────────────────────────────────────────────────
export const ProposalMaker = dynamic(() => import('@/app/_components/proposal-maker').then((m) => m.ProposalMaker), {
  loading: () => <Quiet what="the quote" />,
});
export const SendProposalCard = dynamic(() => import('./send-proposal-card').then((m) => m.SendProposalCard), {
  loading: () => null,
});
export const QuoteVersionLine = dynamic(() => import('@/app/_components/quote-version-line').then((m) => m.QuoteVersionLine), {
  loading: () => null,
});
export const VendorOfferService = dynamic(() => import('./vendor-offer-service').then((m) => m.VendorOfferService), {
  loading: () => null,
});

/** Warm every chunk above (code only — no render, no data). The picked client calls it once its first paint settles. */
export function warmThreadParts(): void {
  const warm = [
    () => import('@/app/_components/chat-message-stream'),
    () => import('@/app/_components/chat-send-form'),
    () => import('./thread-tools-sheet'),
    () => import('@/app/_components/negotiation-composer-menu'),
    () => import('@/app/_components/chat-privacy-notice'),
    () => import('@/app/_components/chat-thread-menu'),
    () => import('./chat-info-rail'),
    () => import('@/app/_components/chat/conversation-column'),
    () => import('@/app/_components/vendor-event-day-prep-cta'),
    () => import('./inquiry-outcome-capture'),
    () => import('@/app/_components/proposal-maker'),
    () => import('./send-proposal-card'),
    () => import('@/app/_components/quote-version-line'),
    () => import('./vendor-offer-service'),
  ];
  for (const w of warm) w().catch(() => undefined);
}
