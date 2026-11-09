'use client';

/**
 * ⚡ EVERY LANE-C CARD IS ITS OWN LAZY CHUNK (Supplier Build 3 · lane C).
 *
 * The shared client bundle has almost no headroom, so nothing a card needs is in the chat's first load: each card
 * is fetched when it is first drawn (a (+) pick, or a line in the stream that is one of its lines). The chat files
 * import from HERE only — never a card module directly. Guard: `lane-c-cards.test.ts`.
 */
import dynamic from 'next/dynamic';

const wait = () => null;

export const QuoteStepCard = dynamic(() => import('./quote-step-card').then((m) => m.QuoteStepCard), { ssr: false, loading: wait });
export const PaymentStepCard = dynamic(() => import('./payment-step-card').then((m) => m.PaymentStepCard), { ssr: false, loading: wait });
export const LogPaymentCard = dynamic(() => import('./log-payment-card').then((m) => m.LogPaymentCard), { ssr: false, loading: wait });
export const FormStepCard = dynamic(() => import('./form-step-card').then((m) => m.FormStepCard), { ssr: false, loading: wait });
export const FormAnswerCard = dynamic(() => import('./form-step-card').then((m) => m.FormAnswerCard), { ssr: false, loading: wait });
export const FilesStepCard = dynamic(() => import('./files-step-card').then((m) => m.FilesStepCard), { ssr: false, loading: wait });
export const DecisionStepCard = dynamic(() => import('./decision-step-card').then((m) => m.DecisionStepCard), { ssr: false, loading: wait });
export const AskChangeDoor = dynamic(() => import('./ask-change-card').then((m) => m.AskChangeDoor), { ssr: false, loading: wait });
export const StreamLineCard = dynamic(() => import('./stream-line-card').then((m) => m.StreamLineCard), { ssr: false, loading: wait });
