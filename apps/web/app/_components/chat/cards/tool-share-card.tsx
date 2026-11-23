'use client';

/**
 * 🧰 A SHARED TOOL — the card a supplier's "Share from your tools" posts (DECISION_LOG 2026-11-23 dee66686; drawing
 * `prototypes/supplier_store_graphs_badges_2026-11-23` frame 7, "What the couple sees"). One card for the five tools,
 * on the ONE card look (`KindCard`), each wearing its tool's own icon (the Store's `toolIcon`).
 *
 *   · the couple → the kind ("Cake design"), the title, where it was made · Open · Approve. Open lands on the event's
 *                  own face of that tool (the Cake Maker opens its designer here in the chat); Approve posts the hosts'
 *                  "✓ Approved · …" line through the shipped send, and the card reads "You approved this" from it.
 *   · the shop   → the same card with "Waiting for their OK" / "Approved by your client". No buttons.
 *
 * The couple NEVER sees a price or a lock here — only the supplier buys a tool (`lib/chat-tool-share.ts`). A failed
 * Approve says so with a plain reason and the button stays to try again; it is never drawn as approved.
 */
import { lazy, Suspense, useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ActionButton } from '@/components/action-button';
import { sendChatMessage } from '@/lib/chat-actions';
import { APPROVE_SEND_FAILED, toolApprovalBody, toolShareFace, type ShareableTool, type ToolShareViewer } from '@/lib/chat-tool-share';
import { routes } from '@/lib/routes';
import { guestsViewHref } from '@/lib/guests-views';
import { toolIcon } from '@/app/vendor-dashboard/shop/_components/specialized-tool-icon';
import { KindCard } from './card-bits';

const CakeDesigner = lazy(() => import('@/app/_components/cake-maker/cake-designer').then((m) => ({ default: m.CakeDesigner })));

/** Where the couple's Open lands — the event's own page for that tool (the Cake Maker opens in the chat instead). */
export function toolShareOpenHref(tool: Exclude<ShareableTool, 'cake_tool'>, eventId: string): string {
  switch (tool) {
    case 'plan_3d':
      return guestsViewHref(eventId, 'seats', { seat: '3d' });
    case 'run_of_show':
    case 'emcee_script':
      return routes.dashboard.schedule(eventId);
    case 'song_bank':
      return routes.dashboard.addOns.playlist(eventId);
  }
}

export function ToolShareCard({
  tool,
  viewer,
  approved,
  threadId,
  eventId,
  stamp = null,
  sendApproval = sendChatMessage,
}: {
  tool: ShareableTool;
  viewer: ToolShareViewer;
  /** The hosts answered this share (`approvedToolShares`). */
  approved: boolean;
  threadId: string;
  eventId: string;
  /** "Liwanag Events Styling · 10:24" under the card. */
  stamp?: string | null;
  /** Labs only — the shipped send otherwise. */
  sendApproval?: (formData: FormData) => Promise<unknown>;
}) {
  const router = useRouter();
  const face = toolShareFace(tool, viewer, approved);
  const [state, setState] = useState<{ s: 'idle' | 'sending' | 'sent' } | { s: 'failed' }>({ s: 'idle' });
  const [designing, setDesigning] = useState(false);
  const Icon = toolIcon(tool);
  const shownApproved = approved || state.s === 'sent';

  const approve = async () => {
    if (state.s === 'sending') return;
    setState({ s: 'sending' });
    const fd = new FormData();
    fd.set('thread_id', threadId);
    fd.set('body', toolApprovalBody(tool));
    try {
      await sendApproval(fd);
      setState({ s: 'sent' });
      // one-render: keep (no-revalidate) — the send without return_to revalidates nothing; the approval line must appear.
      router.refresh();
    } catch {
      setState({ s: 'failed' });
    }
  };

  return (
    <KindCard
      kind="file"
      topic="files"
      kicker={face.kicker}
      title={face.title}
      turn={viewer === 'couple' && !shownApproved ? 'me' : 'wait'}
      tone={viewer === 'vendor' ? 'mine' : 'theirs'}
      chip={
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-md bg-kind-file-bg text-kind-file">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
      }
    >
      <div className="grid gap-2" data-tool-share={tool} data-tool-share-viewer={viewer}>
        <p className="text-sn-md text-ink/70">{face.from}</p>
        {viewer === 'couple' ? (
          <div className="flex flex-wrap gap-2">
            {tool === 'cake_tool' ? (
              <ActionButton tone="neutral" icon={ExternalLink} label={face.open ?? 'Open'} onClick={() => setDesigning(true)} data-tool-share-open="" />
            ) : (
              <ActionButton tone="neutral" icon={ExternalLink} label={face.open ?? 'Open'} href={toolShareOpenHref(tool, eventId)} data-tool-share-open="" />
            )}
            {shownApproved ? null : (
              <ActionButton
                tone="brand"
                main
                icon={Check}
                label={state.s === 'sending' ? 'Sending…' : (face.approve ?? 'Approve')}
                onClick={() => void approve()}
                data-tool-share-approve=""
              />
            )}
          </div>
        ) : null}
        {shownApproved || viewer === 'vendor' ? (
          <p className="flex items-center gap-1.5 text-sn-md font-semibold text-ink/80" role="status" data-tool-share-status="">
            {shownApproved ? <Check aria-hidden className="h-3.5 w-3.5 text-kind-file" strokeWidth={2.6} /> : null}
            <span>{viewer === 'couple' ? 'You approved this' : face.status}</span>
          </p>
        ) : null}
        {state.s === 'failed' ? (
          <p role="alert" className="text-sn-md text-danger-700" data-tool-share-failed="">
            {APPROVE_SEND_FAILED}
          </p>
        ) : null}
        {stamp ? <p className="text-sn-sm text-ink/60">{stamp}</p> : null}
      </div>
      {designing ? (
        <Suspense fallback={null}>
          <CakeDesigner
            threadId={threadId}
            onClose={() => setDesigning(false)}
            onSent={() => {
              // one-render: keep (no-revalidate) — cakeAction's send revalidates nothing; the sent design must appear.
              router.refresh();
            }}
          />
        </Suspense>
      ) : null}
    </KindCard>
  );
}

