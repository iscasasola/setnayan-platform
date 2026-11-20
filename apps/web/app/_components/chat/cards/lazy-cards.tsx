'use client';

/**
 * ⚡ EVERY LANE-C CARD IS A LAZY CHUNK (Supplier Build 3 · lane C).
 *
 * The shared client bundle has almost no headroom, so nothing a card needs is in any page's first load. Every chunk id
 * is an entry in the webpack runtime's chunk map, which IS in the shared bundle (the same fix as `picked-pages`,
 * e95da7ee91) — so the cards add NO chunk of their own: they ride `thread-parts`, the chunk the conversation's own
 * stream and send box already load on demand (`vendor-dashboard/messages/[threadId]/_components/on-demand.tsx`).
 * Two named chunks of their own measured over the 202.3KB budget on CI once lane B's round 3 was in. The chat files
 * import from HERE only — never a card module directly. Guard: `lane-c-cards.test.ts`.
 */
import dynamic from 'next/dynamic';

const wait = () => null;

export const QuoteStepCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './quote-step-card').then((m) => m.QuoteStepCard), { ssr: false, loading: wait });
export const PaymentStepCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './payment-step-card').then((m) => m.PaymentStepCard), { ssr: false, loading: wait });
export const LogPaymentCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './log-payment-card').then((m) => m.LogPaymentCard), { ssr: false, loading: wait });
export const FormStepCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './form-step-card').then((m) => m.FormStepCard), { ssr: false, loading: wait });
export const FormAnswerCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './form-step-card').then((m) => m.FormAnswerCard), { ssr: false, loading: wait });
export const FilesStepCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './files-step-card').then((m) => m.FilesStepCard), { ssr: false, loading: wait });
export const AccessStepCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './access-step-card').then((m) => m.AccessStepCard), { ssr: false, loading: wait });
export const PollStepCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './poll-card').then((m) => m.PollStepCard), { ssr: false, loading: wait });
export const DecisionStepCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './decision-step-card').then((m) => m.DecisionStepCard), { ssr: false, loading: wait });
export const AskChangeDoor = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './ask-change-card').then((m) => m.AskChangeDoor), { ssr: false, loading: wait });
export const StreamLineCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './stream-line-card').then((m) => m.StreamLineCard), { ssr: false, loading: wait });
export const NegotiateDraft = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './negotiate-cards').then((m) => m.NegotiateDraft), { ssr: false, loading: wait });
// 🏷 The offer card (PR-4, owner 2026-11-12) — reachable since 19 Nov 2026: the (+)'s "Drop an offer" row and the card a drop draws in the stream.
export const OfferDropCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './offer-card').then((m) => m.OfferDropCard), { ssr: false, loading: wait });
export const DroppedOfferCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './offer-card').then((m) => m.DroppedOfferCard), { ssr: false, loading: wait });
// 💬 One chat that holds everything (19 Nov 2026): the first inquiry as a card, and Every version with their ask beside it.
export const InquiryCard = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './inquiry-card').then((m) => m.InquiryCard), { ssr: false, loading: wait });
export const DealSheet = dynamic(() => import(/* webpackChunkName: "thread-parts" */ './deal-sheet').then((m) => m.DealSheet), { ssr: false, loading: wait });
