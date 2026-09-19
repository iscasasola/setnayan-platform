/**
 * WHAT THE "🧾 DEAL" ENTRY OFFERS ON ONE CONVERSATION — decided once, for both
 * sides.
 *
 * ── WHY THIS FILE EXISTS (owner live test, 2026-09-19) ─────────────────────
 * As the supplier, the owner tapped the composer's handshake icon to send a
 * FIRST quote. It opened "Deal or meeting", whose "🧾 Send a deal" is the
 * AMENDMENT builder (its first line defaults to "Freebie"). Owner: *"deal
 * doesn't look like a proposal? where they can create the proposal for the
 * guest?"* The real first quote is the Tools list's "Send a quote"
 * (`#build-quote`, the one quote tool since SUP-H). On the couple's side of the
 * same thread, a "🧾 Send a deal" chip rendered under the couple's own opening
 * inquiry, before any quote existed.
 *
 * 🔑 A DEAL AMENDS SOMETHING. The council verdict that created the "+" entry
 * (`Negotiation_Exchange_Council_Verdict_2026-07-24.md`) defines the Deal card
 * as "current total → the changes → new total", and the Proposal Maker as the
 * Deal's finalized state. With no quote and no booking on the thread there is
 * no current total, so "Send a deal" opened a builder over nothing. This file
 * keeps both entry points the owner chose there (the explicit "+" AND the
 * auto-suggest chip) and Meeting untouched — it only withholds the amendment
 * until there is something to amend, and on the supplier's side points the
 * same icon at the tool that makes the first quote.
 *
 * Pure, and imported by both thread pages; the composer icon, the Deal-or-
 * meeting menu and the chip under a message all read the one object it returns
 * (`lib/deal-waits-for-a-quote.test.ts` executes it and pins every mount).
 */

import { affordanceReveal, CHAT_BOX_AFFORDANCES } from './chat-box-tools';
import { THREAD_STAGE_HAS_AGREEMENT, VENDOR_THREAD_TOOLS } from './vendor-thread-tools';
import type { ThreadStage } from './vendor-thread-stage';

export type DealEntrySide = 'vendor' | 'couple';

export type DealEntry = {
  /** "🧾 Send a deal" (the amendment builder) — in the menu AND as the chip. */
  offerDeal: boolean;
  /** The composer row's 🧾 icon: what it opens, what it is called, how it looks. */
  composer: { reveal: readonly string[]; label: string; icon: 'deal' | 'quote' };
  /**
   * Inside the Deal-or-meeting panel, a "Send a quote" shortcut offered FIRST
   * (supplier, no quote yet) — the panel is still reachable from the rail, and
   * it must not be a dead end for the job the supplier came to do.
   */
  menuQuote: { reveal: readonly string[]; label: string } | null;
  /** One muted line saying why "Send a deal" is not there. */
  menuNote: string | null;
};

function toolReveal(key: string): readonly string[] {
  const tool = VENDOR_THREAD_TOOLS.find((t) => t.key === key);
  if (!tool?.reveal) throw new Error(`deal-entry: no in-page tool "${key}"`);
  return tool.reveal;
}

/**
 * Is there anything on this thread for a Deal to amend? Built ONLY from what
 * both thread pages already read — the pipeline rung and the live quote total —
 * so it adds no query.
 *
 *   • a live quote (`sent` / `viewed` / `accepted` — the same statuses the
 *     amendment action's own `latestProposal` bases a Deal on), or
 *   • the rung says one was sent (`quoted`), or
 *   • an agreement stands (`booked` / `completed`) — the amendment action needs
 *     only the booking, and bases the Deal on no proposal when there is none.
 *
 * ⚖ A `cancelled` thread with no live quote reads as "nothing to amend", which
 * is true: an ended conversation has no current total.
 */
export function threadHasQuote(facts: {
  stage: ThreadStage;
  liveQuoteTotalPhp: number | null;
}): boolean {
  return (
    facts.liveQuoteTotalPhp !== null ||
    facts.stage === 'quoted' ||
    THREAD_STAGE_HAS_AGREEMENT[facts.stage]
  );
}

export function dealEntryFor({
  side,
  hasQuote,
}: {
  side: DealEntrySide;
  hasQuote: boolean;
}): DealEntry {
  // 3 · A quote exists: exactly today's behaviour, on both sides.
  if (hasQuote) {
    return {
      offerDeal: true,
      composer: {
        reveal: affordanceReveal('deal'),
        label: CHAT_BOX_AFFORDANCES.deal.label,
        icon: 'deal',
      },
      menuQuote: null,
      menuNote: null,
    };
  }
  // 1 · Supplier, nothing sent: the icon IS the first quote.
  if (side === 'vendor') {
    const reveal = toolReveal('build-quote');
    return {
      offerDeal: false,
      composer: { reveal, label: 'Send a quote', icon: 'quote' },
      menuQuote: { reveal, label: 'Send a quote' },
      menuNote: 'A deal changes a quote — send your quote first.',
    };
  }
  // 2 · Couple, nothing received: a meeting is the only structured ask.
  return {
    offerDeal: false,
    composer: { reveal: affordanceReveal('deal'), label: 'Request a meeting', icon: 'deal' },
    menuQuote: null,
    menuNote: 'Deals open once there is a quote to change.',
  };
}
