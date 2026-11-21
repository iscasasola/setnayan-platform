'use client';

/**
 * 🧾 THE QUOTE AS A RECEIPT — the chat's mini quote editor (Unichat part C, owner 20 Nov 2026: "build it now, I am happy
 * with the design"; drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`, the quote tool).
 *
 * A receipt that holds the quote maker's REAL parts: the lines (name · price each · how many · Free · how the line
 * books), Crew meal, Transport, Discount, and the money at the foot (Subtotal → offer → Discount → Total). Every figure
 * is priced by `lib/quote-receipt.ts`, which calls the maker's own resolvers — nothing is priced here.
 *
 * It is FIELDS ONLY: the card that hosts it (Make a quote · Change quote) owns the form, the Valid until, the note and
 * the Send — so the same receipt sits in the (+) card today and inside the text box on a phone (`EditorShell`).
 *
 *   · a line opens on a tap (native <details> — the root layout's reveal-on-open covers it) and leaves by the house
 *     swipe (left on a phone, hover on a computer); never a ✕ on the row;
 *   · the availability tag is the line's OWN card's style (`vendor_services.availability_style`); a card with none
 *     wears no tag — "Not set" is never dressed as one of the seven;
 *   · what the receipt cannot edit faithfully (an offer's line, its gifts, a stored crew-meal credit) is shown, not
 *     editable, and is sent back exactly as stored.
 */
import { useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SwitchRow, TypedRow } from '@/app/_components/form-row';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { formatCentavosPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { availabilityName, type AvailabilityStyle } from '@/lib/availability-styles';
import { planLedger, type Ledger } from '@/lib/chat-cards';
import { newReceiptLine, receiptLineCentavos, receiptLineUnpriced, type ReceiptDraft, type ReceiptLine, type ReceiptMoney, type ReceiptPlan, type ReceiptPlanChoice } from '@/lib/quote-receipt';
import { QUOTE_LINE_AMOUNT_NOT_SET } from '@/lib/quote-line-price-words';
import { KindTag, LedgerStrip } from './card-bits';

const pesos = (centavos: number) => formatCentavosPhp(centavos);
const php = (typed: string) => Number(String(typed).replace(/[^0-9.]/g, '')) || 0;
const digits = (n: number) => (n > 0 ? String(n) : '');

const CREW: readonly { key: ReceiptDraft['crew']['mode']; label: string }[] = [
  { key: 'included', label: 'Included' },
  { key: 'charge', label: 'Charge' },
  { key: 'offset', label: 'Offset — couple provides' },
];
const TRANSPORT: readonly { key: ReceiptDraft['transport']['mode']; label: string }[] = [
  { key: 'included', label: 'Included' },
  { key: 'flat', label: 'Flat fee' },
  { key: 'distance', label: 'Quoted after site check' },
];

/** One label-left · control-right row (the cards' form grammar). */
function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 text-[15px] text-ink">
        {label}
        {sub ? <small className="block text-[12.5px] text-ink/70">{sub}</small> : null}
      </span>
      <span className="flex-none">{children}</span>
    </div>
  );
}

export function QuoteReceipt({
  draft,
  onDraft,
  money,
  tags,
}: {
  draft: ReceiptDraft;
  onDraft: (next: ReceiptDraft) => void;
  money: ReceiptMoney;
  /** How each service card books, by card id; null = not read (then no line wears a tag). */
  tags: Readonly<Record<string, AvailabilityStyle>> | null;
}) {
  // The line just added opens by itself, so its name can be typed at once.
  const [fresh, setFresh] = useState<string | null>(null);
  const setLine = (key: string, patch: Partial<ReceiptLine>) => onDraft({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const hasCredit = draft.kept.some((k) => (k.amount_centavos ?? 0) < 0 && !k.offer_id);
  return (
    <div className="grid gap-1" data-quote-receipt="">
      <ul className="grid divide-y divide-ink/10 border-y border-ink/10" data-receipt-lines="">
        {draft.lines.map((l) => {
          const style = l.cardId && tags ? (tags[l.cardId] ?? null) : null;
          const qty = Math.max(1, Math.round(l.qty) || 1);
          const name = l.label.trim() || 'New line';
          return (
            <SwipeToDelete
              key={l.key}
              as="li"
              label={`Remove ${name}`}
              word="Remove"
              radiusClass="rounded-none"
              surfaceClass="bg-white dark:bg-raised"
              onDelete={() => onDraft({ ...draft, lines: draft.lines.filter((x) => x.key !== l.key) })}
            >
              <details className="group" open={fresh === l.key || undefined} data-receipt-line={l.free ? 'free' : 'priced'}>
                <summary className="sn-press flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className={`truncate text-[15px] ${l.label.trim() ? 'text-ink' : 'text-ink/70'}`}>{name}</span>
                    {qty > 1 || style ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] tabular-nums text-ink/70">
                        {qty > 1 && !l.free && !receiptLineUnpriced(l) ? (
                          <span className="flex-none">
                            {pesos(Math.round(l.pricePhp * 100))} × {formatCount(qty)}
                          </span>
                        ) : null}
                        {style ? (
                          <span data-receipt-availability={style} className="min-w-0">
                            <KindTag kind="plain">{availabilityName(style)}</KindTag>
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <span className={`flex-none text-[15px] tabular-nums ${receiptLineUnpriced(l) ? 'text-ink/70' : 'text-ink'}`} data-receipt-line-amount={receiptLineUnpriced(l) ? 'not-set' : undefined}>
                    {l.free ? 'Free' : receiptLineUnpriced(l) ? QUOTE_LINE_AMOUNT_NOT_SET : pesos(receiptLineCentavos(l))}
                  </span>
                  <ChevronDown aria-hidden className="h-4 w-4 flex-none text-ink/70 transition-transform duration-sn-pill ease-sn group-open:rotate-180" strokeWidth={2} />
                </summary>
                <div className="grid gap-1 pb-2">
                  <TypedRow name="Item" value={l.label} empty="Name it" maxLength={120} openAsk={fresh === l.key ? 1 : 0} onType={(v) => setLine(l.key, { label: v })} onKeep={(v) => setLine(l.key, { label: v })} data="receipt-line-name" />
                  {l.free ? null : (
                    <TypedRow
                      name="Price each"
                      amount
                      value={digits(l.pricePhp)}
                      empty="₱"
                      onType={(v) => setLine(l.key, { pricePhp: php(v) })}
                      onKeep={(v) => setLine(l.key, { pricePhp: php(v) })}
                      data="receipt-line-price"
                    />
                  )}
                  <Row label="How many">
                    <span className="flex items-center gap-1" role="group" aria-label={`How many of ${name}`}>
                      <ActionButton tone="neutral" iconOnly icon={Minus} label="One less" name={`One less of ${name}`} disabled={qty <= 1} onClick={() => setLine(l.key, { qty: Math.max(1, qty - 1) })} />
                      <b className="min-w-8 text-center text-[15px] tabular-nums text-ink" data-receipt-line-qty="">
                        {formatCount(qty)}
                      </b>
                      <ActionButton tone="neutral" iconOnly icon={Plus} label="One more" name={`One more of ${name}`} onClick={() => setLine(l.key, { qty: Math.min(9999, qty + 1) })} />
                    </span>
                  </Row>
                  <SwitchRow name="Free" line="Shown as Complimentary — adds nothing to the total." on={l.free} onChange={(on) => setLine(l.key, { free: on })} data="receipt-line-free" />
                </div>
              </details>
            </SwipeToDelete>
          );
        })}
      </ul>
      <div className="flex">
        <ActionButton
          tone="neutral"
          icon={Plus}
          label="Add a line"
          onClick={() => {
            const line = newReceiptLine();
            setFresh(line.key);
            onDraft({ ...draft, lines: [...draft.lines, line] });
          }}
          data-receipt-add=""
        />
      </div>

      <div className="grid divide-y divide-ink/10 border-y border-ink/10" data-receipt-parts="">
        <div>
          <Row label="Crew meal">
            <PickMenu
              label="Crew meal"
              value={draft.crew.mode}
              // A stored credit already says "couple provides" — it is kept as it is, never added a second time.
              options={CREW.filter((o) => !(hasCredit && o.key === 'offset'))}
              onPick={(k) => onDraft({ ...draft, crew: { ...draft.crew, mode: k as ReceiptDraft['crew']['mode'] } })}
              dataAttr="data-receipt-crew"
            />
          </Row>
          {draft.crew.mode === 'included' ? null : (
            <>
              <TypedRow
                name="How many crew"
                value={digits(draft.crew.size)}
                empty="Add"
                inputMode="numeric"
                maxLength={3}
                clean={(t) => t.replace(/\D/g, '')}
                onType={(v) => onDraft({ ...draft, crew: { ...draft.crew, size: Math.round(php(v)) } })}
                onKeep={(v) => onDraft({ ...draft, crew: { ...draft.crew, size: Math.round(php(v)) } })}
                data="receipt-crew-size"
              />
              <TypedRow
                name="Per head"
                amount
                value={digits(draft.crew.perHeadPhp)}
                empty="₱"
                onType={(v) => onDraft({ ...draft, crew: { ...draft.crew, perHeadPhp: php(v) } })}
                onKeep={(v) => onDraft({ ...draft, crew: { ...draft.crew, perHeadPhp: php(v) } })}
                data="receipt-crew-rate"
              />
            </>
          )}
        </div>
        <div>
          <Row label="Transport">
            <PickMenu
              label="Transport"
              value={draft.transport.mode}
              options={TRANSPORT}
              onPick={(k) => onDraft({ ...draft, transport: { ...draft.transport, mode: k as ReceiptDraft['transport']['mode'] } })}
              dataAttr="data-receipt-transport"
            />
          </Row>
          {draft.transport.mode === 'flat' ? (
            <TypedRow
              name="Fee"
              amount
              value={digits(draft.transport.flatPhp)}
              empty="₱"
              onType={(v) => onDraft({ ...draft, transport: { ...draft.transport, flatPhp: php(v) } })}
              onKeep={(v) => onDraft({ ...draft, transport: { ...draft.transport, flatPhp: php(v) } })}
              data="receipt-transport-fee"
            />
          ) : null}
        </div>
        <div>
          <TypedRow
            name="Discount"
            amount
            value={digits(draft.discountPhp)}
            empty="None"
            onType={(v) => onDraft({ ...draft, discountPhp: php(v) })}
            onKeep={(v) => onDraft({ ...draft, discountPhp: php(v) })}
            data="receipt-discount"
          />
          {draft.discountPhp > 0 ? (
            <TypedRow
              name="Why"
              value={draft.discountWhy}
              empty="Add"
              placeholder="They read this beside the discount"
              maxLength={120}
              onType={(v) => onDraft({ ...draft, discountWhy: v })}
              onKeep={(v) => onDraft({ ...draft, discountWhy: v })}
              data="receipt-discount-why"
            />
          ) : null}
        </div>
      </div>

      {draft.kept.length > 0 ? (
        <ul className="grid gap-0.5 py-1 text-[14px]" aria-label="Kept from the quote" data-receipt-kept="">
          {draft.kept.map((k, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-ink/70">{k.label}</span>
              <span className="flex-none tabular-nums text-ink/70">{k.amount_centavos == null ? 'Free' : `−${pesos(Math.abs(k.amount_centavos))}`}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-xl bg-kind-quote-bg/55 px-3 py-2 text-[14px] tabular-nums" data-receipt-total="">
        <dt className="text-ink/70">Subtotal</dt>
        <dd className="text-right text-ink">{pesos(money.subtotal)}</dd>
        {money.offer > 0 ? (
          <>
            <dt className="text-ink/70">Offer</dt>
            <dd className="text-right text-ink">−{pesos(money.offer)}</dd>
          </>
        ) : null}
        {money.discount > 0 ? (
          <>
            <dt className="text-ink/70">Discount</dt>
            <dd className="text-right text-ink">−{pesos(money.discount)}</dd>
          </>
        ) : null}
        {money.creditCentavos > 0 ? (
          <>
            <dt className="text-ink/70">Crew meal credit</dt>
            <dd className="text-right text-ink">−{pesos(money.creditCentavos)}</dd>
          </>
        ) : null}
        <dt className="text-[15px] font-bold text-ink">Total</dt>
        <dd className="text-right text-[15px] font-bold text-ink">{pesos(money.net)}</dd>
      </dl>
    </div>
  );
}

/** The plan a choice makes of this total — THE ONE LEDGER every face of the plan prints (`planLedger`). */
export function receiptLedger(plan: ReceiptPlan, money: ReceiptMoney, paidSeqs: readonly number[]): Ledger {
  return planLedger({ manual: plan.manual, autoBalance: plan.autoBalance, agreedCentavos: money.net, creditCentavos: money.creditCentavos, paidSeqs: new Set(paidSeqs) });
}

/** "How they pay" — the schedule's presets, with the plan each makes of the total drawn under the pick. */
export function ReceiptPlanRow({
  choices,
  pick,
  onPick,
  money,
  paidSeqs = [],
}: {
  choices: readonly ReceiptPlanChoice[];
  pick: string;
  onPick: (key: string) => void;
  money: ReceiptMoney;
  paidSeqs?: readonly number[];
}) {
  const chosen = choices.find((c) => c.key === pick) ?? choices[0] ?? null;
  if (!chosen) return null;
  const ledger = chosen.plan ? receiptLedger(chosen.plan, money, paidSeqs) : null;
  return (
    <div className="grid gap-2" data-receipt-plan={!ledger ? 'none' : ledger.paysInFull ? 'pays-in-full' : 'short'}>
      {/* The caption sits ABOVE its pick: a plan's label is long, and beside it the caption broke into three lines on a phone. */}
      <div className="grid gap-1">
        <span className="text-[13px] font-medium text-ink/70">How they pay</span>
        <div className="flex">
          <PickMenu label="How they pay" value={chosen.key} options={choices.map((c) => ({ key: c.key, label: c.label }))} onPick={onPick} dataAttr="data-receipt-plan-pick" />
        </div>
      </div>
      {ledger && money.net > 0 ? <LedgerStrip ledger={ledger} /> : null}
    </div>
  );
}

/** What the picked plan sends: the maker's own schedule draft (the server re-resolves it against the re-summed total). */
export function receiptSchedule(plan: ReceiptPlan | null, money: ReceiptMoney): { manual: ReceiptPlan['manual']; autoBalance: ReceiptPlan['autoBalance']; baseCentavos: number; creditCentavos: number } | null {
  return plan ? { manual: plan.manual, autoBalance: plan.autoBalance, baseCentavos: money.total, creditCentavos: money.creditCentavos } : null;
}

/** Does the picked plan pay the whole quote? (The server refuses one that does not; the card says so first.) */
export function receiptPlanProblem(plan: ReceiptPlan | null, money: ReceiptMoney, paidSeqs: readonly number[]): string | null {
  return plan && money.net > 0 ? receiptLedger(plan, money, paidSeqs).problem : null;
}
