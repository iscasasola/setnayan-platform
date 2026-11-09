'use client';

/**
 * 👥 GUEST COUNT CHANGED — under lane B's "Guest count changed · 150 → 170 guests" line (Supplier Build 3 · lane C;
 * prototype v8.3 `guestsCard`).
 *
 * Owner, 9 Nov: only the quote's PER-GUEST lines (`pricing_basis = 'per_pax'`) re-multiply, never below `min_pax`;
 * flat lines never move; a lower total is held at the paid quotation. The supplier answers **Apply ₱X | Keep price**
 * (one row, equal widths). Apply posts a NEW VERSION through the shipped send (the hosts accept it like any other);
 * Keep price posts one line. A quote with no per-guest line is only told ("the price does not move by itself") with
 * Change quote | No change. A LOCKED quote is never recounted: "<supplier>'s price is final".
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, Minus, PencilLine } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { DateRow } from '@/app/_components/form-row-date';
import { sendCustomProposalFromChat } from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';
import { formatCentavosPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { patchPlus } from '@/lib/chat-plus-store';
import { deltaWords, guestRecount, recountedLines, type PerPaxLine, type Recount } from '@/lib/chat-cards';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';
import { ChatCardShell } from '../chat-step-card';
import { keepPriceFromChat, loadRecount, type QuoteForCard } from './card-actions';
import { CouldNotLoad, EqualRow, Loading, Problem, type Read } from './card-bits';

export function GuestRecountCard({
  threadId,
  from,
  to,
  viewer,
  supplierName,
  eventDate,
  seed,
}: {
  threadId: string;
  from: number;
  to: number;
  viewer: 'vendor' | 'couple';
  supplierName: string;
  eventDate: string | null;
  seed?: { quote: QuoteForCard | null; perPax: PerPaxLine[] };
}) {
  const [read, setRead] = useState<Read<{ quote: QuoteForCard | null; perPax: PerPaxLine[] }>>(seed ? { at: 'ok', data: seed } : viewer === 'vendor' ? { at: 'loading' } : { at: 'ok', data: { quote: null, perPax: [] } });
  const [done, setDone] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadRecount(threadId).then((r) => setRead(r.ok ? { at: 'ok', data: { quote: r.quote, perPax: r.perPax } } : { at: 'failed' }));
  }, [threadId]);
  useEffect(() => {
    if (!seed && viewer === 'vendor') load();
  }, [load, seed, viewer]);

  const head = (
    <p className="text-[15px] text-ink">
      Guests <b className="tabular-nums">{formatCount(from)} → {formatCount(to)}</b>
    </p>
  );
  if (viewer === 'couple') {
    return (
      <ChatCardShell topic="quote" kicker="Guest count" title="Guest count changed" tone="auto">
        <div className="grid gap-2">
          {head}
          <p className="text-[14px] text-ink/60">{supplierName} decides: apply a new total for the per-guest lines, or keep the price.</p>
        </div>
      </ChatCardShell>
    );
  }
  if (read.at !== 'ok') {
    return (
      <ChatCardShell topic="quote" kicker="Guest count" title="Guest count changed" tone="auto">
        {read.at === 'loading' ? <Loading /> : <CouldNotLoad what="your quote" onRetry={load} />}
      </ChatCardShell>
    );
  }
  const q = read.data.quote;
  if (!q) return null; // no quote yet — nothing to re-price; lane B's line already told them
  const r: Recount = guestRecount({ lines: q.lines, perPax: read.data.perPax, from, to, floorCentavos: q.floorCentavos, locked: q.locks.quote, supplierName });
  const today = manilaTodayIsoFor(Date.now());

  const apply = async () => {
    if (r.kind !== 'recount' || !validUntil) return;
    setBusy(true);
    setProblem(null);
    const lines = recountedLines(q.lines, r);
    const fd = new FormData();
    fd.set('thread_id', threadId);
    fd.set(
      'payload',
      JSON.stringify({
        lineItems: lines.map((l) => ({ label: l.label, detail: l.detail, amount_centavos: l.amountCentavos })),
        validUntil,
        title: q.title,
        schedule: q.plan ? { manual: q.plan.manual, autoBalance: q.plan.autoBalance, creditCentavos: q.creditCentavos } : null,
        paymentMethodIds: q.paymentMethodIds,
        includesSetnayanGift: q.gift,
        serviceCardIds: q.serviceCardIds,
      }),
    );
    await sendCustomProposalFromChat(fd); // the shipped send ends on its own notice; it never returns here on success
    setBusy(false);
  };
  const keep = async () => {
    setBusy(true);
    setProblem(null);
    const fd = new FormData();
    fd.set('thread_id', threadId);
    fd.set('total_words', formatCentavosPhp(q.totalCentavos));
    fd.set('guests', String(to));
    const res = await keepPriceFromChat(fd);
    setBusy(false);
    if (res.ok) setDone(`Price kept at ${formatCentavosPhp(q.totalCentavos)}`);
    else setProblem(res.message);
  };

  return (
    <ChatCardShell topic="quote" kicker="Guest count" title="Guest count changed" tone="auto">
      <div className="grid gap-2" data-recount={r.kind}>
        {head}
        {r.kind === 'locked' ? (
          <p className="text-[14px] text-ink/60">{r.line}</p>
        ) : r.kind === 'inform' ? (
          <>
            <p className="text-[14px] text-ink/65">Your quote has no per-guest price — every line is flat, so the total stays {formatCentavosPhp(r.totalCentavos)}.</p>
            {done ? (
              <p className="text-[14px] font-medium text-success-700">{done}</p>
            ) : (
              <EqualRow>
                <ActionButton tone="neutral" icon={Minus} label="No change" onClick={() => setDone('No change')} />
                <ActionButton tone="brand" main icon={PencilLine} label="Change quote" onClick={() => patchPlus(threadId, { draft: { kind: 'quote', startedAt: Date.now() } })} />
              </EqualRow>
            )}
          </>
        ) : (
          <>
            <ul className="grid gap-1 text-[14px]">
              {r.rows.map((x) => (
                <li key={x.key} className="flex justify-between gap-3">
                  <span className="min-w-0 text-ink/75">
                    <span className="block truncate">{x.label}</span>
                    <span className="block text-[12px] text-ink/50">per guest{x.minPax ? ` · min ${formatCount(x.minPax)}` : ''} · from your quotation</span>
                  </span>
                  <span className="flex-none tabular-nums">
                    {formatCount(x.fromQty)} → {formatCount(x.toQty)} × {formatCentavosPhp(x.rateCentavos)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-3 text-ink/60">
                <span>Flat lines</span>
                <span>do not move</span>
              </li>
              <li className="flex justify-between gap-3 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatCentavosPhp(r.oldTotalCentavos)} → {formatCentavosPhp(r.newTotalCentavos)} ({deltaWords(r.newTotalCentavos, r.oldTotalCentavos)})
                </span>
              </li>
            </ul>
            {r.floored && q.floorCentavos != null ? <p className="text-[13px] text-ink/60">Held at the paid quotation {formatCentavosPhp(q.floorCentavos)} — a lower count never goes under it.</p> : null}
            {done ? (
              <p className="text-[14px] font-medium text-success-700">{done}</p>
            ) : (
              <>
                {q.requote === 'ok' ? <DateRow name="Valid until" value={validUntil} today={today} min={today} max={eventDate} onKeep={(d) => setValidUntil(d)} note="Needed to apply — a new version is a new quotation." /> : null}
                {q.requote === 'ok' ? (
                  <EqualRow>
                    <ActionButton tone="ok" main icon={Check} label={`Apply ${formatCentavosPhp(r.newTotalCentavos)}`} onClick={() => void apply()} waiting={busy || !validUntil || validUntil <= today} />
                    <ActionButton tone="ok" icon={Minus} label="Keep price" onClick={() => void keep()} waiting={busy} />
                  </EqualRow>
                ) : (
                  // The shipped S5 gate refuses a new version on a confirmed booking — say so, keep the one answer left.
                  <>
                    <p className="text-[13px] text-ink/60">Booked — a new total goes through a change order, not a new quote.</p>
                    <EqualRow>
                      <ActionButton tone="ok" icon={Minus} label="Keep price" onClick={() => void keep()} waiting={busy} />
                    </EqualRow>
                  </>
                )}
              </>
            )}
          </>
        )}
        <Problem text={problem} />
      </div>
    </ChatCardShell>
  );
}
