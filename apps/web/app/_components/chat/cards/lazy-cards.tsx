'use client';

/**
 * ⚡ EVERY LANE-C CARD IS A LAZY CHUNK (Supplier Build 3 · lane C).
 *
 * The shared client bundle has almost no headroom, so nothing a card needs is in the chat's first load: the cards are
 * fetched when one is first drawn. They are TWO NAMED chunks, not nine — every chunk id is an entry in the webpack
 * runtime's chunk map, which IS in the shared bundle (the same fix as `picked-pages`, e95da7ee91):
 *   chat-cards-plus    the (+) cards, fetched on a pick;
 *   chat-cards-stream  the cards a line in the stream draws (Ask for a change, a form to answer, a system line). The chat files
 * import from HERE only — never a card module directly. Guard: `lane-c-cards.test.ts`.
 */
import dynamic from 'next/dynamic';

const wait = () => null;

export const QuoteStepCard = dynamic(() => import(/* webpackChunkName: "chat-cards-plus" */ './quote-step-card').then((m) => m.QuoteStepCard), { ssr: false, loading: wait });
export const PaymentStepCard = dynamic(() => import(/* webpackChunkName: "chat-cards-plus" */ './payment-step-card').then((m) => m.PaymentStepCard), { ssr: false, loading: wait });
export const LogPaymentCard = dynamic(() => import(/* webpackChunkName: "chat-cards-plus" */ './log-payment-card').then((m) => m.LogPaymentCard), { ssr: false, loading: wait });
export const FormStepCard = dynamic(() => import(/* webpackChunkName: "chat-cards-plus" */ './form-step-card').then((m) => m.FormStepCard), { ssr: false, loading: wait });
export const FormAnswerCard = dynamic(() => import(/* webpackChunkName: "chat-cards-stream" */ './form-step-card').then((m) => m.FormAnswerCard), { ssr: false, loading: wait });
export const FilesStepCard = dynamic(() => import(/* webpackChunkName: "chat-cards-plus" */ './files-step-card').then((m) => m.FilesStepCard), { ssr: false, loading: wait });
export const DecisionStepCard = dynamic(() => import(/* webpackChunkName: "chat-cards-plus" */ './decision-step-card').then((m) => m.DecisionStepCard), { ssr: false, loading: wait });
export const AskChangeDoor = dynamic(() => import(/* webpackChunkName: "chat-cards-stream" */ './ask-change-card').then((m) => m.AskChangeDoor), { ssr: false, loading: wait });
export const StreamLineCard = dynamic(() => import(/* webpackChunkName: "chat-cards-stream" */ './stream-line-card').then((m) => m.StreamLineCard), { ssr: false, loading: wait });
