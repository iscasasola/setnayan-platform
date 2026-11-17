/**
 * FocusReceived — "From your BDO" in Focus (owner 2026-11-17, specs
 * prototypes/admin_payment_verify_2026-11-17/ v5: "Tap a row and its oldest
 * item opens as one card, the approved pile grammar. ‹ Focus goes back; after
 * you act, the next one opens.").
 *
 *   /admin?card=received:<received_id>   In your BDO, no order · match by hand
 *   /admin?card=buyer:<payment_id>       Buyer says paid · not in your BDO yet
 *
 * The card rises in the SAME `FocusCardSheet` the request cards use, and is
 * the SAME card Admin › Payments lists (`received-pile.tsx`). Each card's
 * forms carry `next` — the following card, or `/admin` after the last.
 *
 * Kept in its own file so `focus-home.tsx` gains two lines, not a section.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatCount } from '@/lib/format-number';
import { TemplateFail } from '@/app/_components/template-rows';
import { readReceivedDesk } from '@/app/admin/payments/received';
import {
  BuyerSaysPaidCard,
  ReceivedCard,
  ReceivedTileBlock,
  pileCounts,
} from '@/app/admin/payments/_components/received-pile';
import { FocusCardSheet } from './focus-card-sheet';

const cardHref = (key: string) => `/admin?card=${encodeURIComponent(key)}`;

/** Is this `?card=` one of ours? Focus home skips its own sheet for it. */
export function isReceivedCardKey(cardKey: string | undefined): boolean {
  return !!cardKey && (cardKey.startsWith('received:') || cardKey.startsWith('buyer:'));
}

export async function FocusReceived({ cardKey }: { cardKey?: string }) {
  const { read, waiting, lastDrop } = await readReceivedDesk();

  if (read.kind === 'failed') {
    return (
      <section aria-label="From your BDO" className="mx-4 mt-4" data-focus-received="">
        <p className="sn-eye mb-1">From your BDO</p>
        <TemplateFail data="focus-received-read">Couldn&rsquo;t load your received payments. Refresh to try again.</TemplateFail>
      </section>
    );
  }

  const rows = [...read.rows].sort((a, b) => Number(a.left_reason === 'later') - Number(b.left_reason === 'later'));
  const { noOrder, buyers } = pileCounts(rows, waiting);
  // A card opens on the OLDEST item; "next" walks the same order.
  const receivedKeys = noOrder.map((r) => `received:${r.received_id}`);
  const buyerKeys = (buyers ?? []).map((p) => `buyer:${p.payment_id}`);

  let sheet: ReactNode = null;
  if (cardKey && isReceivedCardKey(cardKey)) {
    const list = cardKey.startsWith('received:') ? receivedKeys : buyerKeys;
    const at = list.indexOf(cardKey);
    const next = at >= 0 && at + 1 < list.length ? cardHref(list[at + 1]!) : '/admin';
    const kicker = cardKey.startsWith('received:') ? 'In your BDO, no order' : 'Buyer says paid';
    const position = at >= 0 ? `${formatCount(at + 1)} of ${formatCount(list.length)}` : null;
    let body: ReactNode;
    if (at < 0) {
      body = <p className="text-[14px] text-ink">This one is done. <Link href="/admin" className="underline underline-offset-2">Back to Focus</Link></p>;
    } else if (cardKey.startsWith('received:')) {
      const row = noOrder[at]!;
      body = <ReceivedCard row={row} waiting={waiting ?? []} query="" next={next} />;
    } else {
      const p = buyers![at]!;
      body = <BuyerSaysPaidCard payment={p} rows={rows} lastDrop={lastDrop} query="" next={next} />;
    }
    sheet = (
      <FocusCardSheet title={kicker} kicker={kicker}>
        <div className="flex items-center justify-between gap-3 text-[13px] text-[color:var(--sn-ink-500)]" data-focus-received-position="">
          <Link href="/admin" scroll={false} className="underline underline-offset-2">
            ‹ Focus
          </Link>
          {position ? <span className="tabular-nums">{position}</span> : null}
          {at >= 0 && at + 1 < list.length ? (
            <Link href={next} scroll={false} className="underline underline-offset-2">
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
        {body}
      </FocusCardSheet>
    );
  }

  return (
    <section aria-label="From your BDO" className="mx-4 mt-4" data-focus-received="">
      <p className="sn-eye mb-1">From your BDO</p>
      <ReceivedTileBlock
        rows={rows}
        waiting={waiting}
        lastDrop={lastDrop}
        hrefs={{
          noOrder: receivedKeys[0] ? cardHref(receivedKeys[0]) : undefined,
          buyers: buyerKeys[0] ? cardHref(buyerKeys[0]) : undefined,
        }}
      />
      {sheet}
    </section>
  );
}
