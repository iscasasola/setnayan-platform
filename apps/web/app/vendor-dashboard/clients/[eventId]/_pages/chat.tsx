/**
 * 🗂 CHAT — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v111/v113: the chat lives IN the client).
 *
 * ⚠ STUB pushed by L2 at hour 0. OWNER OF THIS FILE: **C2** (B1 step 7 — `SupplierThreadBody` split out of
 * `messages/[threadId]/page.tsx`, avatar strip, sender names, hearts). There is still exactly ONE chat box: this
 * stub mounts NO `ChatMessageStream`; until C2 lands the body it is a door into the shipped full-screen thread
 * (the envelope doors' page, kept by the 6 Nov ruling), or into Chats when this client has no conversation yet.
 */
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { SUPPLIER_CHATS_HREF } from '../../../customers/anchors';
import type { PickedPageProps } from './context';

export function ChatPage({ ctx, shipped }: PickedPageProps) {
  if (shipped) return <>{shipped}</>;
  return (
    <div className="px-1 py-6 text-center">
      <MessageSquare aria-hidden className="mx-auto h-6 w-6 text-ink/30" strokeWidth={1.5} />
      <p className="mt-2 text-sm text-ink/60">
        {ctx.threadId
          ? `Your conversation with ${ctx.eventName}.`
          : `No conversation with ${ctx.eventName} yet.`}
      </p>
      <Link
        href={ctx.threadId ? `/vendor-dashboard/messages/${ctx.threadId}` : SUPPLIER_CHATS_HREF}
        className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-cream"
      >
        {ctx.threadId ? 'Open chat' : 'Go to Chats'}
      </Link>
    </div>
  );
}
