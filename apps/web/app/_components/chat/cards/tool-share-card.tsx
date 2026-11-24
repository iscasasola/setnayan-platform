'use client';

/**
 * 🧰 A SHARED TOOL — the card a supplier's "Share from your tools" posts (DECISION_LOG 2026-11-23 dee66686), PORTED from
 * the drawing, not redrawn: `prototypes/supplier_store_graphs_badges_2026-11-23` frame 7, "What the couple sees"
 * (`.ccard`). Class for class:
 *   `.ccard`  the house frame (`.sn-frame`), 280 px wide at most, 12 px in, 4 px between parts
 *   `.kind`   the eyebrow — 11 px, bold, upper case, spaced (Cake design · Layout · Timeline · Script · Playlist)
 *   `.cpic`   the tool's picture on the ghost panel — the drawing's five sketches, in the accent and its wash
 *   `b`, `em` the title (15 px, semibold) and where it was made (12 px, the second ink)
 *   `.cact`   two equal buttons: Open (quiet) · Approve (the one filled)
 *
 *   · the couple → Open lands on the event's own face of that tool (the Cake Maker opens its designer here in the
 *                  chat); Approve posts the hosts' "✓ Approved · …" line through the shipped send, and the card then
 *                  reads "Approved" from it.
 *   · the shop   → the same card, its own (right side), with "Waiting for their OK" / "Approved by your client".
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

/* The drawing's `.cpic` sketches (viewBox 200×84), their fills by job: `br`/`tp` the accent · `gh` its wash · `pl` a
   deeper wash · `c1`/`c2` the cake's two creams, here two washes of the accent (no hex in a component) · `ls2` .35. */
const BR = 'fill-sn-accent';
const GH = 'fill-sn-accent/15';
const PL = 'fill-sn-accent/25';

function ToolSharePicture({ tool }: { tool: ShareableTool }) {
  switch (tool) {
    case 'cake_tool':
      return (
        <svg viewBox="0 0 200 84" aria-hidden className="block w-full">
          <ellipse className={GH} cx="100" cy="76" rx="56" ry="5" />
          <rect className="fill-sn-accent/20" x="58" y="50" width="84" height="24" rx="5" />
          <rect className="fill-sn-accent/30" x="70" y="30" width="60" height="22" rx="5" />
          <rect className="fill-sn-accent/20" x="82" y="12" width="36" height="20" rx="5" />
          <circle className={BR} cx="100" cy="9" r="4" />
        </svg>
      );
    case 'plan_3d':
      return (
        <svg viewBox="0 0 200 84" aria-hidden className="block w-full">
          <rect className={GH} x="20" y="8" width="160" height="68" rx="6" />
          {[48, 82, 116, 150].flatMap((cx) => [28, 56].map((cy) => <circle key={`${cx}-${cy}`} className={BR} cx={cx} cy={cy} r="7" />))}
          <rect className="fill-sn-accent/35" x="152" y="14" width="22" height="56" rx="3" />
        </svg>
      );
    case 'run_of_show':
      return (
        <svg viewBox="0 0 200 84" aria-hidden className="block w-full">
          {([[16, 120], [34, 90], [52, 140], [70, 70]] as const).map(([y, w]) => (
            <g key={y}>
              <circle className={BR} cx="26" cy={y} r="4" />
              <rect className={GH} x="40" y={y - 4} width={w} height="8" rx="4" />
            </g>
          ))}
          <path className="fill-none stroke-sn-accent" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" d="M26 16 V70" />
        </svg>
      );
    case 'emcee_script':
      return (
        <svg viewBox="0 0 200 84" aria-hidden className="block w-full">
          <rect className={GH} x="44" y="6" width="112" height="72" rx="6" />
          {([[18, 88], [30, 70], [42, 84], [54, 52], [66, 76]] as const).map(([y, w]) => (
            <rect key={y} className={PL} x="56" y={y} width={w} height="6" rx="3" />
          ))}
        </svg>
      );
    case 'song_bank':
      return (
        <svg viewBox="0 0 200 84" aria-hidden className="block w-full">
          {([[8, 86], [32, 110], [56, 64]] as const).map(([y, w]) => (
            <g key={y}>
              <rect className={GH} x="24" y={y} width="152" height="16" rx="8" />
              <path className={BR} d={`M34 ${y + 3} l8 5 -8 5z`} />
              <rect className={PL} x="50" y={y + 6} width={w} height="5" rx="2.5" />
            </g>
          ))}
        </svg>
      );
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
  const shownApproved = approved || state.s === 'sent';

  const approve = async () => {
    if (state.s === 'sending') return;
    setState({ s: 'sending' });
    const fd = new FormData();
    fd.set('thread_id', threadId);
    fd.set('body', toolApprovalBody(tool));
    try {
      await sendApproval(fd);
      // The card reads "Approved" at once; the approval line arrives like every message, on the stream's Realtime feed.
      setState({ s: 'sent' });
    } catch {
      setState({ s: 'failed' });
    }
  };

  const statusWords = face.status ?? 'Approved';
  const status = (
    <span role="status" className="inline-flex min-h-10 items-center justify-center gap-1.5 text-sn-md font-bold text-ink" data-tool-share-status="">
      {shownApproved ? <Check aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2.4} /> : null}
      <span>{statusWords}</span>
    </span>
  );

  return (
    <div className={`w-full max-w-[17.5rem] ${viewer === 'vendor' ? 'ml-auto' : ''}`}>
      <article
        className="sn-frame grid gap-1 !p-3"
        aria-label={`${face.kicker} · ${face.title}`}
        data-tool-share={tool}
        data-tool-share-viewer={viewer}
        data-chat-card="files"
      >
        <span className="text-sn-xs font-bold uppercase tracking-[0.06em] text-[color:var(--m-slate-2)]">{face.kicker}</span>
        <div className="my-1 overflow-hidden rounded bg-[color:var(--m-paper-2)]">
          <ToolSharePicture tool={tool} />
        </div>
        <b className="text-sn-lg font-semibold leading-tight text-ink">{face.title}</b>
        <span className="text-sn-sm text-[color:var(--m-slate-2)]">{face.from}</span>
        {viewer === 'couple' ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {tool === 'cake_tool' ? (
              <ActionButton tone="neutral" icon={ExternalLink} label={face.open ?? 'Open'} onClick={() => setDesigning(true)} className="w-full justify-center" data-tool-share-open="" />
            ) : (
              <ActionButton tone="neutral" icon={ExternalLink} label={face.open ?? 'Open'} href={toolShareOpenHref(tool, eventId)} className="w-full justify-center" data-tool-share-open="" />
            )}
            {shownApproved ? (
              status
            ) : (
              <ActionButton
                tone="brand"
                main
                icon={Check}
                label={state.s === 'sending' ? 'Sending…' : (face.approve ?? 'Approve')}
                onClick={() => void approve()}
                className="w-full justify-center"
                data-tool-share-approve=""
              />
            )}
          </div>
        ) : (
          <div className="mt-2 flex">{status}</div>
        )}
        {state.s === 'failed' ? (
          <p role="alert" className="text-sn-md text-danger-700" data-tool-share-failed="">
            {APPROVE_SEND_FAILED}
          </p>
        ) : null}
      </article>
      {stamp ? <p className={`mt-1 px-1 text-sn-sm text-[color:var(--m-slate-2)] ${viewer === 'vendor' ? 'text-right' : ''}`}>{stamp}</p> : null}
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
    </div>
  );
}
