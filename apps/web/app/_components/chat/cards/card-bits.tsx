'use client';

/**
 * The small parts every lane-C card shares (Supplier Build 3 · lane C): the honest read states, the one plan ledger
 * strip, an equal-width choice row, a refusal line. Loaded only with a card (each card is its own lazy chunk).
 */
import type { ReactNode } from 'react';
import { ArrowLeftRight, Check, Info, List, PhilippinePeso, RotateCcw, Star, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatCentavosPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { ledgerLine, type Ledger } from '@/lib/chat-cards';
import { TOPIC_ICON, type ChatTopic } from '@/lib/topic-icons';
import { ChatCardShell } from '../chat-step-card';

/**
 * 🎨 THE ONE CARD LOOK (Unichat part A, 20 Nov 2026 — drawing UNICHAT-LIVE-2026-11-19 `.cd`). Every card in the stream
 * wears this and nothing else: a white frame, ONE kind colour (the 3 px left edge + the icon chip), the title as the
 * hero, the kicker under it, and ONE signature detail per kind (the bits below). A card that waits on the reader says
 * "Your turn" (a dot + the word) and is the only one that lifts; a settled card folds to one ✓ line whose press opens
 * what it held. The icon is the topic's own (`TOPIC_ICON` — one icon per topic), except the drawing's three deal marks
 * (ruled 20 Nov, "match the drawing"): ⇄ a counter · ≡ a payment plan · ₱ a quote (`DEAL_MARK`).
 * The frame never stretches past a phone's width (owner 20 Nov: "card don't need to stretch") — on a computer it sits
 * like a message bubble, so its buttons keep their phone proportions.
 */
export type CardKind = 'quote' | 'counter' | 'offer' | 'meeting' | 'decision' | 'payment' | 'form' | 'file' | 'plain';
/** me = waits on the reader · wait = open, not theirs to answer · done = settled with a yes · old = settled without. */
export type CardTurn = 'me' | 'wait' | 'done' | 'old';

/** Whole class names, never built from parts — Tailwind (and the contrast lint) must be able to read each one. */
const KIND: Record<CardKind, { edge: string; chip: string; ink: string; fill: string; soft: string; wash: string }> = {
  quote: { edge: 'border-kind-quote', chip: 'bg-kind-quote-bg text-kind-quote', ink: 'text-kind-quote', fill: 'bg-kind-quote', soft: 'bg-kind-quote-bg', wash: 'bg-kind-quote-bg/55 dark:bg-kind-quote-bg' },
  counter: { edge: 'border-kind-counter', chip: 'bg-kind-counter-bg text-kind-counter', ink: 'text-kind-counter', fill: 'bg-kind-counter', soft: 'bg-kind-counter-bg', wash: 'bg-kind-counter-bg/55 dark:bg-kind-counter-bg' },
  offer: { edge: 'border-kind-offer', chip: 'bg-kind-offer-bg text-kind-offer', ink: 'text-kind-offer', fill: 'bg-kind-offer', soft: 'bg-kind-offer-bg', wash: 'bg-kind-offer-bg/55 dark:bg-kind-offer-bg' },
  meeting: { edge: 'border-kind-meeting', chip: 'bg-kind-meeting-bg text-kind-meeting', ink: 'text-kind-meeting', fill: 'bg-kind-meeting', soft: 'bg-kind-meeting-bg', wash: 'bg-kind-meeting-bg/55 dark:bg-kind-meeting-bg' },
  decision: { edge: 'border-kind-decision', chip: 'bg-kind-decision-bg text-kind-decision', ink: 'text-kind-decision', fill: 'bg-kind-decision', soft: 'bg-kind-decision-bg', wash: 'bg-kind-decision-bg/55 dark:bg-kind-decision-bg' },
  payment: { edge: 'border-kind-payment', chip: 'bg-kind-payment-bg text-kind-payment', ink: 'text-kind-payment', fill: 'bg-kind-payment', soft: 'bg-kind-payment-bg', wash: 'bg-kind-payment-bg/55 dark:bg-kind-payment-bg' },
  form: { edge: 'border-kind-form', chip: 'bg-kind-form-bg text-kind-form', ink: 'text-kind-form', fill: 'bg-kind-form', soft: 'bg-kind-form-bg', wash: 'bg-kind-form-bg/55 dark:bg-kind-form-bg' },
  file: { edge: 'border-kind-file', chip: 'bg-kind-file-bg text-kind-file', ink: 'text-kind-file', fill: 'bg-kind-file', soft: 'bg-kind-file-bg', wash: 'bg-kind-file-bg/55 dark:bg-kind-file-bg' },
  plain: { edge: 'border-kind-plain', chip: 'bg-kind-plain-bg text-kind-plain', ink: 'text-kind-plain', fill: 'bg-kind-plain', soft: 'bg-kind-plain-bg', wash: 'bg-kind-plain-bg/55 dark:bg-kind-plain-bg' },
};

/** 🔣 The drawing's own marks for the deal cards (`.k-counter` ⇄ · plan ≡ · `.k-quote` ₱) — ruled 20 Nov: "match the
 * drawing". A counter and a quote wear theirs by KIND; a payment plan says `mark="plan"` (a plan is a payment kind). */
const DEAL_MARK: { counter: LucideIcon; plan: LucideIcon; quote: LucideIcon; review: LucideIcon } = { counter: ArrowLeftRight, plan: List, quote: PhilippinePeso, review: Star };

const HOT = 'transition-shadow duration-sn-pill data-[hot]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sn-accent)_35%,transparent)]';
/** Phone: the chat's own width. Computer: a bubble's width — mine to the right, the rest to the left. */
const place = (tone: 'mine' | 'theirs' | 'auto') => `w-full max-w-[30rem] ${tone === 'mine' ? 'ml-auto' : ''}`;

export function KindCard({
  kind,
  topic,
  kicker,
  title,
  hero = false,
  turn = 'wait',
  settled,
  chip,
  tone = 'auto',
  anchorId,
  info,
  action,
  warn = false,
  mark,
  children,
}: {
  kind: CardKind;
  topic: ChatTopic;
  kicker: string;
  title: ReactNode;
  /** The title is an amount — one size up (the drawing's `.ct.hero`). */
  hero?: boolean;
  turn?: CardTurn;
  /** The ONE line a settled card folds to. Given with `done`/`old`, the card is that line; its press opens `children`. */
  settled?: ReactNode;
  /** A kind's own chip in place of the icon (the form's ring). */
  chip?: ReactNode;
  tone?: 'mine' | 'theirs' | 'auto';
  anchorId?: string;
  /**
   * ⓘ at the right of the title (the drawing's `.cinfo`) — the card's details live behind it (Unichat part C). Drawn
   * HERE, in the shared part, so a card file never hand-draws it (`lane-c-cards.test.ts` 🔘). `data` rides on the button.
   */
  info?: { onOpen: () => void; data?: Record<`data-${string}`, string | undefined> };
  /**
   * The drawing's action beside the title (the handover's "Open", Unichat part H2) — the house ActionButton, drawn HERE
   * so a card file never hand-draws it. Only for a press with a real destination: a card with nowhere to go gets none.
   */
  action?: { label: string; href: string; icon: LucideIcon; external?: boolean };
  /** The kicker is a warning (the counter's "Under your lowest") — the warn colour, one weight up. */
  warn?: boolean;
  /** A payment plan wears the drawing's plan mark (≡) instead of the payment topic's glyph; the review ask wears the
   *  drawing's ☆ (it borrows the quote's colour, never the quote's ₱). */
  mark?: 'plan' | 'review';
  children?: ReactNode;
}) {
  const Icon = mark === 'plan' ? DEAL_MARK.plan : mark === 'review' ? DEAL_MARK.review : kind === 'counter' ? DEAL_MARK.counter : kind === 'quote' ? DEAL_MARK.quote : TOPIC_ICON[topic];
  const k = KIND[kind];
  const label = typeof title === 'string' ? title : kicker;
  if (settled != null && (turn === 'done' || turn === 'old')) {
    const line = (
      <>
        <Icon aria-hidden className={`h-3.5 w-3.5 flex-none ${k.ink}`} strokeWidth={1.9} />
        {turn === 'done' ? <Check aria-hidden className={`h-3.5 w-3.5 flex-none ${k.ink}`} strokeWidth={2.6} /> : null}
        <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${turn === 'old' ? 'text-ink/70 line-through decoration-ink/50' : 'text-ink/80'}`}>{settled}</span>
      </>
    );
    if (!children) {
      return (
        <div id={anchorId} data-chat-card={topic} data-card-kind={kind} data-card-turn={turn} role="group" aria-label={label} className={`my-2 flex min-h-[32px] min-w-0 scroll-mt-3 items-center gap-2 rounded-md py-1 pl-2 pr-3 ${k.wash} ${HOT} ${place(tone)}`}>
          {line}
        </div>
      );
    }
    return (
      <details id={anchorId} data-chat-card={topic} data-card-kind={kind} data-card-turn={turn} aria-label={label} className={`group my-2 min-w-0 scroll-mt-3 rounded-md ${k.wash} ${HOT} ${place(tone)}`}>
        {/* The whole line is the press (its reach is 44 px tall through the ::after); open, it shows what the card held. */}
        <summary className="sn-press relative flex min-h-[32px] cursor-pointer list-none items-center gap-2 rounded-md py-1 pl-2 pr-3 after:absolute after:inset-x-0 after:-inset-y-1.5 [&::-webkit-details-marker]:hidden">
          {line}
        </summary>
        <div className="px-3 pb-3 pt-1 text-[15px] text-ink">{children}</div>
      </details>
    );
  }
  return (
    <section
      id={anchorId}
      data-chat-card={topic}
      data-card-kind={kind}
      data-card-turn={turn}
      aria-label={label}
      className={`my-2 grid scroll-mt-3 ${info && action ? 'grid-cols-[36px_minmax(0,1fr)_auto_auto]' : info || action ? 'grid-cols-[36px_minmax(0,1fr)_auto]' : 'grid-cols-[36px_minmax(0,1fr)]'} items-center gap-3 rounded-[var(--sn-frame-radius)] border-l-[length:var(--sn-border-w-edge)] bg-frame p-3 ${k.edge} ${turn === 'me' ? 'shadow-sn-frame' : 'shadow-sn-hair'} ${HOT} ${place(tone)}`}
    >
      {chip ?? (
        <span aria-hidden className={`grid h-9 w-9 place-items-center rounded-md ${k.chip}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
      )}
      <span className="grid min-w-0 gap-1">
        <span className={`line-clamp-2 font-bold leading-tight tabular-nums text-ink ${hero ? 'text-[17px] tracking-[-0.01em]' : 'text-[15px]'}`}>{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink/70">
          {turn === 'me' ? (
            <span className={`inline-flex flex-none items-center gap-1 text-[12px] font-bold ${k.ink}`} data-card-your-turn="">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${k.fill}`} />
              Your turn
            </span>
          ) : null}
          <span className={warn ? 'truncate font-semibold' : 'truncate'} style={warn ? { color: 'rgb(var(--color-warn))' } : undefined} data-card-warn={warn ? '' : undefined}>
            {kicker}
          </span>
        </span>
      </span>
      {action ? (
        <ActionButton tone="neutral" icon={action.icon} label={action.label} href={action.href} target={action.external ? '_blank' : undefined} data-card-action="" />
      ) : null}
      {info ? (
        <button
          type="button"
          className="sn-press -m-2 grid h-11 w-11 place-items-center rounded-full text-ink/70"
          aria-label="Details"
          aria-haspopup="dialog"
          onClick={info.onOpen}
          {...info.data}
        >
          <Info aria-hidden className="h-5 w-5" strokeWidth={1.9} />
        </button>
      ) : null}
      {children ? <div className="col-span-full min-w-0 text-[15px] text-ink">{children}</div> : null}
    </section>
  );
}

/**
 * 🧩 WHERE AN EDITOR SITS (Unichat part C, 20 Nov 2026). The quote, counter and plan editors are drawn the same in two
 * places: as the (+) card in the stream (`frame="card"`, today's placement — the shell with its title and ✕), and
 * INSIDE THE TEXT BOX on a phone (`frame="bare"` — the composer owns the title, the ✕ and the frame, so the editor
 * brings only its fields and its own Cancel · Send row). One component, two hosts; nothing is built twice.
 */
export type EditorFrame = 'card' | 'bare';

export function EditorShell({
  frame = 'card',
  topic,
  title,
  onClose,
  children,
}: {
  frame?: EditorFrame;
  topic: ChatTopic;
  title: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  if (frame === 'bare') {
    return (
      <div role="group" aria-label={title} data-chat-editor={topic} className="text-[15px] text-ink">
        {children}
      </div>
    );
  }
  return (
    <ChatCardShell topic={topic} kicker="You · not sent yet" title={title} onClose={onClose}>
      {children}
    </ChatCardShell>
  );
}

/** A kind's small pill — the offer's saving, the counter's gap (the drawing's `.tagk`). Words in the kind's own ink. */
export function KindTag({ kind, children }: { kind: CardKind; children: ReactNode }) {
  return <span className={`inline-block max-w-full truncate rounded-full px-2 py-px text-[12px] font-bold leading-4 ${KIND[kind].chip}`}>{children}</span>;
}

/** The form's chip: a ring that fills as questions are answered, "2/5" inside (the drawing's `.ci.ring`). */
export function ProgressRing({ kind, done, of }: { kind: CardKind; done: number; of: number }) {
  const C = 2 * Math.PI * 15;
  return (
    <span className={`relative grid h-9 w-9 flex-none place-items-center ${KIND[kind].ink}`} role="img" aria-label={`${formatCount(done)} of ${formatCount(of)} answered`}>
      <svg aria-hidden viewBox="0 0 36 36" className="absolute inset-0 h-9 w-9 -rotate-90 fill-none" strokeWidth={3}>
        <circle cx="18" cy="18" r="15" stroke="currentColor" opacity={0.2} />
        <circle cx="18" cy="18" r="15" stroke="currentColor" strokeLinecap="round" strokeDasharray={`${of > 0 ? (Math.min(done, of) / of) * C : 0} ${C}`} />
      </svg>
      <b className="relative text-[11px] font-bold tabular-nums">
        {formatCount(done)}/{formatCount(of)}
      </b>
    </span>
  );
}

/** Payment's signature: how much of the whole is paid (solid) and what comes next (soft) — the drawing's `.mbar`. */
export function MoneyBar({ kind = 'payment', paid, next = 0, total, label }: { kind?: CardKind; paid: number; next?: number; total: number; label: string }) {
  const pct = (n: number) => `${total > 0 ? Math.min(100, Math.max(0, (n / total) * 100)) : 0}%`;
  return (
    <span className={`flex h-1 overflow-hidden rounded-full ${KIND[kind].soft}`} role="img" aria-label={label} data-card-money-bar="">
      <i className={KIND[kind].fill} style={{ width: pct(paid) }} />
      <i className={`${KIND[kind].fill} opacity-40`} style={{ width: pct(next) }} />
    </span>
  );
}

/** A plan's signature: one segment per payment, as wide as its share (the drawing's `.segbar`). */
export function SegBar({ kind = 'payment', amounts }: { kind?: CardKind; amounts: readonly number[] }) {
  if (amounts.length === 0) return null;
  return (
    <span aria-hidden className="flex h-1.5 gap-0.5" data-card-seg-bar="">
      {amounts.map((a, i) => (
        <span key={i} className={`min-w-1 rounded-full ${KIND[kind].fill} ${i % 2 ? 'opacity-55' : ''}`} style={{ flex: Math.max(1, a) }} />
      ))}
    </span>
  );
}

/** A read in flight, refused, or answered. A refused read says so — never an empty list dressed as "none yet". */
export type Read<T> = { at: 'loading' } | { at: 'failed' } | { at: 'ok'; data: T };

export function Loading() {
  return (
    <p className="text-[14px] text-ink/55" role="status" data-card-read="loading">
      Loading…
    </p>
  );
}

export function CouldNotLoad({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="grid gap-2" data-card-read="failed">
      <p role="alert" className="text-[15px] text-ink">
        Couldn&rsquo;t load {what}.
      </p>
      <div className="flex">
        <ActionButton tone="neutral" icon={RotateCcw} label="Try again" onClick={onRetry} />
      </div>
    </div>
  );
}

/** An honest empty state: what is missing, in one line, and (optionally) the one way forward. */
export function EmptyLine({ line, children }: { line: string; children?: ReactNode }) {
  return (
    <div className="grid gap-2" data-card-empty="">
      <p className="text-[15px] text-ink/70">{line}</p>
      {children ? <div className="flex">{children}</div> : null}
    </div>
  );
}

export function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="text-[14px] font-medium text-danger-600" data-card-problem="">
      {text}
    </p>
  );
}

/** Equal-weight choices: one row, equal widths (owner 9 Nov — "buttons uniform, rows balanced") — the house one. */
export { EqualRow } from '@/components/action-button';

/** THE ONE LEDGER, as every face prints it: each payment, its state, and "Plan pays all … ✓". */
export function LedgerStrip({ ledger }: { ledger: Ledger }) {
  const paid = ledger.rows.filter((r) => r.state === 'paid').reduce((n, r) => n + r.amountCentavos, 0);
  const next = ledger.rows.find((r) => r.state !== 'paid')?.amountCentavos ?? 0;
  return (
    <div className="grid gap-1.5 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-[14px]" data-plan-ledger={ledger.paysInFull ? 'pays-in-full' : 'short'}>
      <MoneyBar paid={paid} next={next} total={ledger.sumCentavos} label={`${formatCentavosPhp(paid)} of ${formatCentavosPhp(ledger.sumCentavos)} paid`} />
      {ledger.rows.map((r) => (
        <div key={r.seq} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-ink/75">{r.label}</span>
          <span className="flex-none tabular-nums text-ink">
            {formatCentavosPhp(r.amountCentavos)}
            <span className="ml-1.5 text-[12px] text-ink/55">{r.state === 'paid' ? 'Paid ✓' : r.state === 'final' ? 'worked out' : 'Due'}</span>
          </span>
        </div>
      ))}
      <p className={`text-[13px] font-semibold ${ledger.paysInFull ? 'text-success-700' : 'text-danger-600'}`}>{ledgerLine(ledger)}</p>
    </div>
  );
}
