'use client';

import { Handshake, Phone, ReceiptText } from 'lucide-react';
import {
  CHAT_BOX_AFFORDANCES,
  affordanceReveal,
  type ChatBoxAffordanceKey,
} from '@/lib/chat-box-tools';
import type { DealEntry } from '@/lib/deal-entry';
import { revealThreadTool } from './reveal-thread-tool';

/**
 * One icon on the composer row that opens a tool panel on the same page.
 *
 * It is a `<button type="button">`, never a submit — it sits INSIDE the send
 * form's row, and a stray submit here would post an empty message. It holds no
 * state: `revealThreadTool` opens the panel (a `<details>` mounted once by the
 * page), closes every other one, and lands focus inside it. Which ids to open
 * comes from `lib/chat-box-tools.ts`, so this file cannot name a panel the
 * page does not render.
 *
 * 44px both ways — `globals.css` floors every button's height at 44px; the
 * width is set here so the target is square on a phone.
 */
const ICON: Record<ChatBoxAffordanceKey, typeof Phone> = {
  deal: Handshake,
  call: Phone,
};

export function RevealToolButton({
  affordance,
  label,
  entry,
}: {
  affordance: ChatBoxAffordanceKey;
  /** Overrides the registry label — e.g. "Call Hiraya Catering". */
  label?: string;
  /**
   * The deal slot only: what `dealEntryFor` decided this thread's 🧾 opens.
   * Before any quote the supplier's icon is "Send a quote" (#build-quote) and
   * the couple's is "Request a meeting" — see `lib/deal-entry.ts`.
   */
  entry?: DealEntry;
}) {
  const Icon = entry?.composer.icon === 'quote' ? ReceiptText : ICON[affordance];
  const text = label ?? entry?.composer.label ?? CHAT_BOX_AFFORDANCES[affordance].label;
  const reveal = entry ? entry.composer.reveal : affordanceReveal(affordance);
  return (
    <button
      type="button"
      onClick={() => revealThreadTool(reveal)}
      aria-label={text}
      title={text}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink/15 text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
    >
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
