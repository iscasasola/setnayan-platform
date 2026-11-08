'use client';

/**
 * THE (+) CARD BEING FILLED — at the foot of the conversation, its opener's own until Send ("not sent yet").
 *
 * Meeting is the first real card on the shared frame (`meeting-step-card.tsx`). The other cards are lane C's: until it
 * lands, each draws the same frame with one honest step that says so and opens the shipped full page — the card's
 * other face — so nothing a supplier could do yesterday is lost today.
 */
import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PLUS_CARD_TITLE, PLUS_CARD_TOPIC, hostPlusRows, supplierPlusRows, type PlusCardKind } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, patchPlus, usePlus } from '@/lib/chat-plus-store';
import { openPlusDoor, plusDoor } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { ChatCardShell } from './chat-step-card';
import { MeetingStepCard } from './meeting-step-card';

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
            <MeetingStepCard
              threadId={threadId}
              returnPath={returnPath}
              eventDate={eventDate}
              onClose={close}
              onSent={() => patchPlus(threadId, { draft: null, toast: null })}
            />
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
        <p className="text-[15px] text-ink/75">The step-by-step {title.toLowerCase()} card comes in Lane C.</p>
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
