'use client';

/**
 * THE (+) CARD BEING FILLED — at the foot of the conversation, its opener's own until Send ("not sent yet").
 *
 * Meeting is the first real card on the shared frame (`meeting-step-card.tsx`). The other cards are lane C's
 * (`cards/`), each its own LAZY chunk (`cards/lazy-cards.tsx`) so the chat's first load carries none of them. A kind
 * with no card yet still draws the honest stub that opens the shipped full page — the card's other face.
 */
import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PLUS_CARD_TITLE, PLUS_CARD_TOPIC, hostPlusRows, supplierPlusRows, type PlusCardKind } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
import { openPlusDoor, plusDoor } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { ChatCardShell } from './chat-step-card';
import { MeetingStepCard } from './meeting-step-card';
import { AccessStepCard, DecisionStepCard, FilesStepCard, FormStepCard, LogPaymentCard, NegotiateDraft, PaymentStepCard, PollStepCard, QuoteStepCard } from './cards/lazy-cards';

export function PlusDraft({
  threadId,
  side,
  eventId,
  eventDate,
  returnPath,
}: {
  threadId: string;
  side: 'vendor' | 'couple';
  eventId: string;
  eventDate: string | null;
  returnPath: string;
}) {
  const { draft, toast } = usePlus(threadId);
  const close = () => patchPlus(threadId, { draft: null, toast: null });
  const sent = () => patchPlus(threadId, { draft: null, toast: null });
  // 🗳 A new draft is SEEN: its card is a lazy chunk, so the opener's one jump (60 ms after the pick) can land before the
  // card has a height — or before the anchor exists — and the card sat below the fold (Poll, 11 Nov review). For the
  // first moments of a draft, every growth of the anchor brings it back into view; after that the person scrolls.
  const startedAt = draft?.startedAt ?? null;
  useEffect(() => {
    if (startedAt == null || typeof ResizeObserver === 'undefined') return;
    const el = document.getElementById(PLUS_DRAFT_ANCHOR);
    if (!el) return;
    jumpTo(PLUS_DRAFT_ANCHOR);
    const ro = new ResizeObserver(() => jumpTo(PLUS_DRAFT_ANCHOR));
    ro.observe(el);
    const stop = window.setTimeout(() => ro.disconnect(), 1500);
    return () => {
      window.clearTimeout(stop);
      ro.disconnect();
    };
  }, [startedAt]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => patchPlus(threadId, { toast: null }), 3200);
    return () => window.clearTimeout(id);
  }, [toast, threadId]);
  return (
    <>
      {toast ? (
        <p role="status" className="mx-auto my-2 w-fit rounded-full bg-ink px-4 py-2 text-[13px] text-cream" data-plus-toast="">
          {toast.text}
        </p>
      ) : null}
      {draft ? (
        <div id={PLUS_DRAFT_ANCHOR} data-plus-draft={draft.kind} className="scroll-mt-3">
          {draft.kind === 'meeting' ? (
            <MeetingStepCard threadId={threadId} returnPath={returnPath} eventDate={eventDate} onClose={close} onSent={sent} />
          ) : draft.kind === 'quote' && side === 'vendor' ? (
            <QuoteStepCard threadId={threadId} eventDate={eventDate} onClose={close} onSent={sent} />
          ) : draft.kind === 'payment' && side === 'vendor' ? (
            <PaymentStepCard threadId={threadId} eventId={eventId} eventDate={eventDate} returnPath={returnPath} onClose={close} onSent={sent} />
          ) : draft.kind === 'logpay' && side === 'couple' ? (
            <LogPaymentCard threadId={threadId} onClose={close} onSent={sent} />
          ) : draft.kind === 'form' && side === 'vendor' ? (
            <FormStepCard threadId={threadId} eventId={eventId} returnPath={returnPath} onClose={close} onSent={sent} />
          ) : draft.kind === 'photos' || draft.kind === 'file' ? (
            <FilesStepCard side={side} onClose={close} />
          ) : draft.kind === 'access' && side === 'vendor' ? (
            <AccessStepCard eventId={eventId} onClose={close} onSent={sent} />
          ) : draft.kind === 'decision' ? (
            <DecisionStepCard threadId={threadId} onClose={close} onSent={sent} />
          ) : draft.kind === 'counter' || draft.kind === 'plan' || (draft.kind === 'ask' && side === 'couple') ? (
            <NegotiateDraft threadId={threadId} kind={draft.kind} viewer={side} supplierName="The supplier" returnPath={returnPath} onClose={close} onSent={sent} />
          ) : draft.kind === 'poll' ? (
            <PollStepCard threadId={threadId} onClose={close} onSent={sent} />
          ) : (
            <StubCard kind={draft.kind} side={side} eventId={eventId} onClose={close} />
          )}
        </div>
      ) : null}
    </>
  );
}

function StubCard({ kind, side, eventId, onClose }: { kind: PlusCardKind; side: 'vendor' | 'couple'; eventId: string; onClose: () => void }) {
  const rows = side === 'vendor' ? supplierPlusRows({ paid: false }) : hostPlusRows({ canLogPayment: true });
  const row = rows.find((r) => r.card === kind);
  const door = plusDoor(side, row?.door ?? null, eventId);
  const title = PLUS_CARD_TITLE[kind];
  return (
    <ChatCardShell topic={PLUS_CARD_TOPIC[kind]} kicker="You · not sent yet" title={title} onClose={onClose}>
      <div className="grid gap-3" data-plus-stub={kind}>
        <p className="text-[15px] text-ink/75">Open the full page to do this.</p>
        {door ? (
          <div className="flex items-center gap-2 border-t border-ink/10 pt-3">
            <span className="mr-auto text-[13px] text-ink/55">1 of 1</span>
            {door.href ? (
              <ActionButton tone="brand" main icon={ExternalLink} label="Use the full page" href={door.href} onClick={onClose} />
            ) : (
              <ActionButton
                tone="brand"
                main
                icon={ExternalLink}
                label="Use the full page"
                onClick={() => {
                  onClose();
                  window.setTimeout(() => openPlusDoor(door), 0);
                }}
              />
            )}
          </div>
        ) : null}
      </div>
    </ChatCardShell>
  );
}
