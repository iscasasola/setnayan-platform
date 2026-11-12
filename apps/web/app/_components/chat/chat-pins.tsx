'use client';

/**
 * 📌 THE PINS ON TOP OF A CHAT — both sides, one part (Supplier Build 3 · lane B).
 *
 * Owner rulings: automatic cards pin at the top however deep the chat scrolls, until answered, oldest due first (📌
 * 8 Nov); three levels — a Blocker (red, it also takes the whole screen: `chat-blocker.tsx`), Due now (amber, with a
 * countdown), Waiting on the other side (ONE quiet folded line) (🚦 9 Nov); the ONE open (+) card pins under them as
 * **Running topic** (8 Nov); the Due-now stack collapses to one row and remembers it per chat, and a NEW due item
 * re-opens it once (9 Nov); "the pinned on top should stay pinned" — this sits OUTSIDE the stream's scroller, inside the
 * chat's pinned region (at most 4/9 of the screen). Integrated with lane A, the ONE cap and the ONE scroller are `ChatPinnedStack`'s:
 * this list draws inside it, under any open panel, so it never caps or scrolls itself — two caps would be two stacks.
 *
 * The level and order are `lib/chat-pins.ts` (the same rule lane A's Chats-row dot reads). Each row wears its topic's
 * icon from `TOPIC_ICON` — never a bell or a clock of its own. A row is the press: "Answer ›" opens its answer IN
 * PLACE under the row (the same shipped controls the card in the chat posts — `ReplyControls`); a Running-topic row
 * jumps to its card.
 */
import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TOPIC_ICON } from '@/lib/topic-icons';
import {
  PIN_TOPIC,
  collapsedLine,
  countdownLabel,
  stackPins,
  waitingLine,
  type PinFact,
} from '@/lib/chat-pins';
import { PLUS_CARD_TOPIC, type RunningTopic } from '@/lib/chat-plus';
import { jumpTo } from '@/lib/chat-plus-store';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { formatCount } from '@/lib/format-number';

/**
 * 🗳 A body that takes the WHOLE screen (the opened decision, approved 11 Nov) closes itself through this: its back arrow
 * folds the pin again. Null outside a pin.
 */
export const PinBodyClose = createContext<(() => void) | null>(null);

const COLLAPSE_KEY = (threadId: string) => `sn-chat-pins-collapsed:${threadId}`;
const SEEN_KEY = (threadId: string) => `sn-chat-pins-seen:${threadId}`;

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, v: string): void {
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* a blocked store costs the memory, never the pins */
  }
}

/**
 * The fold: rows open/close at the family's one speed (`--sn-pill-dur`); reduced motion shows the end state. An open the
 * person caused glides its row into view through the app's ONE reveal (`useRevealOnOpen`, owner 2026-11-04 app-wide).
 */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useRevealOnOpen(open, () => ({ head: box.current?.previousElementSibling ?? box.current, end: box.current }), { cause: 'gesture' });
  return (
    <div
      ref={box}
      className="grid transition-[grid-template-rows] duration-[var(--sn-pill-dur)] ease-[var(--sn-ease)] motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      aria-hidden={!open}
      inert={!open || undefined}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

type Tone = 'blocker' | 'due' | 'waiting' | 'run';
const ROUND: Record<Tone, string> = {
  blocker: 'bg-danger-100 text-danger-700',
  due: 'bg-warn-100 text-warn-800',
  waiting: 'bg-ink/[0.05] text-ink/50',
  run: 'bg-sn-accent/10 text-sn-accent',
};

function PinRow({
  topic,
  tone,
  kicker,
  line,
  action,
  onPress,
  expanded,
  pinKey,
}: {
  topic: keyof typeof TOPIC_ICON;
  tone: Tone;
  kicker: string;
  line: string;
  action: ReactNode;
  onPress: () => void;
  expanded?: boolean;
  pinKey: string;
}) {
  const Icon = TOPIC_ICON[topic];
  return (
    <button
      type="button"
      onClick={onPress}
      aria-expanded={expanded}
      data-chat-pin={tone}
      data-chat-pin-key={pinKey}
      className="sn-press grid min-h-[48px] w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5 text-left"
    >
      <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full ${ROUND[tone]}`}>
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
      </span>
      <span className="grid min-w-0">
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-ink/55">{kicker}</span>
        <span className="truncate text-[14px] font-semibold leading-snug text-ink">{line}</span>
      </span>
      <span className={`whitespace-nowrap text-[13px] font-semibold ${tone === 'waiting' ? 'font-medium text-ink/55' : 'text-sn-accent'}`}>
        {action}
      </span>
    </button>
  );
}

export type ChatPinsProps = {
  threadId: string;
  /** Every automatic fact on this chat, for THIS reader (both levels and the waiting ones). */
  facts: readonly PinFact[];
  /** The answer drawn under a pin when it is opened (the shipped controls). Absent → the row jumps or opens the blocker. */
  bodies?: Readonly<Record<string, ReactNode>>;
  /** A red row re-opens its full-screen blocker. */
  onBlocker?: (key: string) => void;
  /** The ONE open (+) card, from either side. */
  running: RunningTopic | null;
  /** "Ask about it" / Return to chat — the topic the chat is now about. */
  talking?: { key: string; title: string } | null;
  onCloseTalking?: () => void;
  eventDate: string | null;
  /** Labs pass a fixed clock; the chat reads the device's. */
  nowMs?: number;
};

export function ChatPins({
  threadId,
  facts,
  bodies,
  onBlocker,
  running,
  talking,
  onCloseTalking,
  eventDate,
  nowMs,
}: ChatPinsProps) {
  const [now] = useState(() => nowMs ?? Date.now());
  // 🗳 A decision pin is a DOOR, not a due item (approved prototype 11 Nov): it never sits in the amber Due-now stack —
  // it wears the Running-topic round under the running card, reads "Decision · you opened it" and "N filed ›".
  const decisions = useMemo(() => facts.filter((f) => f.kind === 'decision'), [facts]);
  const stack = useMemo(
    () => stackPins(facts.filter((f) => f.kind !== 'decision'), { nowMs: now, eventDate }),
    [facts, now, eventDate],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const loaded = useRef(false);

  // The person's fold is remembered per chat on this device; a NEW due-now item re-opens it once.
  const dueKeys = stack.due.map((f) => f.key).join('|');
  useEffect(() => {
    const was = readLocal(COLLAPSE_KEY(threadId)) === '1';
    const seen = new Set((readLocal(SEEN_KEY(threadId)) ?? '').split('|').filter(Boolean));
    const fresh = stack.due.some((f) => !seen.has(f.key));
    setCollapsed(was && !fresh);
    if (fresh && was) writeLocal(COLLAPSE_KEY(threadId), '0');
    writeLocal(SEEN_KEY(threadId), dueKeys);
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, dueKeys]);
  const setFold = (c: boolean) => {
    setCollapsed(c);
    writeLocal(COLLAPSE_KEY(threadId), c ? '1' : '0');
  };

  const nothing =
    stack.blockers.length === 0 && stack.due.length === 0 && stack.waiting.length === 0 && !running && !talking && decisions.length === 0;
  if (nothing) return null;

  const toggle = (k: string) => setOpenKey((cur) => (cur === k ? null : k));
  const row = (f: PinFact, tone: Tone) => {
    const body = bodies?.[f.key];
    const kicker =
      tone === 'blocker' ? 'Needs you first' : tone === 'due' ? (f.dueMs != null ? countdownLabel(f.dueMs, now) : 'Due now') : 'Waiting';
    return (
      <li key={f.key} className="border-t border-ink/[0.07] first:border-t-0">
        <PinRow
          pinKey={f.key}
          topic={PIN_TOPIC[f.kind]}
          tone={tone}
          kicker={kicker}
          line={f.title}
          action={tone === 'waiting' ? `Waiting for ${f.themName ?? 'them'}` : tone === 'blocker' ? 'Open ›' : 'Answer ›'}
          expanded={body ? openKey === f.key : undefined}
          onPress={() => {
            if (tone === 'blocker' && onBlocker) onBlocker(f.key);
            else if (body) toggle(f.key);
          }}
        />
        {f.olderCount ? (
          // 🗓 More than one schedule change unanswered: the newest pins, the rest are counted under it (Seen answers all).
          <p className="-mt-1 pb-2 pl-[38px] text-[13px] text-ink/60" data-chat-pin-older={f.olderCount}>
            + {f.olderCount} older change{f.olderCount === 1 ? '' : 's'} · Seen answers them all
          </p>
        ) : null}
        {body ? (
          <Fold open={openKey === f.key}>
            <div className="pb-3 pl-[38px]" data-chat-pin-body={f.key}>
              {body}
            </div>
          </Fold>
        ) : null}
      </li>
    );
  };

  const decisionRow = (f: PinFact) => {
    const body = bodies?.[f.key];
    const open = openKey === f.key;
    return (
      <li key={f.key} className="border-t border-ink/[0.07] first:border-t-0">
        <PinRow
          pinKey={f.key}
          topic="decision"
          tone="run"
          kicker={`Decision · ${f.openedByYou ? 'you' : 'they'} opened it`}
          line={f.title}
          action={f.filedCount != null ? `${formatCount(f.filedCount)} filed ›` : 'Open ›'}
          expanded={body ? open : undefined}
          onPress={() => {
            if (body) toggle(f.key);
          }}
        />
        {/* The opened decision rises over the whole chat (it portals itself to <body>); its ← folds this pin again. */}
        {body && open ? <PinBodyClose.Provider value={() => setOpenKey(null)}>{body}</PinBodyClose.Provider> : null}
      </li>
    );
  };

  const topDue = stack.due[0];
  const wLine = waitingLine(stack.waiting);

  return (
    <div
      data-chat-pins=""
      className="shrink-0 border-b border-ink/10 bg-cream px-3 shadow-[0_6px_14px_-12px_rgb(0_0_0/0.4)] sm:px-4"
    >
      <ul>
        {stack.blockers.map((f) => row(f, 'blocker'))}
        {stack.due.length > 0 ? (
          <li className="border-t border-ink/[0.07] first:border-t-0" data-chat-pins-due="">
            {collapsed && topDue ? (
              <PinRow
                pinKey="due-collapsed"
                topic={PIN_TOPIC[topDue.kind]}
                tone="due"
                kicker="Due now"
                line={collapsedLine(stack.due, now) ?? ''}
                action={<ChevronDown aria-label="Show all" className="h-4 w-4" strokeWidth={2} />}
                expanded={false}
                onPress={() => setFold(false)}
              />
            ) : (
              <>
                <ul>{stack.due.map((f) => row(f, 'due'))}</ul>
                {stack.due.length > 1 || wLine ? (
                  <button
                    type="button"
                    onClick={() => setFold(true)}
                    className="sn-press flex min-h-11 w-full items-center justify-center gap-1 text-[12px] font-medium text-ink/55"
                    data-chat-pins-collapse=""
                    aria-label="Fold the pins to one row"
                  >
                    <ChevronUp aria-hidden className="h-4 w-4" strokeWidth={2} /> Fold
                  </button>
                ) : null}
              </>
            )}
          </li>
        ) : null}
        {/* Decisions sit right under what is due, as drawn (approved page, 11 Nov) — above the Waiting line. */}
        {decisions.map(decisionRow)}
        {wLine && !(collapsed && stack.due.length > 0) ? (
          <li className="border-t border-ink/[0.07] first:border-t-0" data-chat-pins-waiting="">
            <button
              type="button"
              onClick={() => setShowWaiting((v) => !v)}
              aria-expanded={showWaiting}
              className="sn-press flex min-h-11 w-full items-center gap-2 text-left text-[13px] text-ink/60"
            >
              <span className="min-w-0 flex-1 truncate">{wLine}</span>
              <span className="text-[13px] font-medium text-ink/55">{showWaiting ? 'Hide' : 'Show ›'}</span>
            </button>
            <Fold open={showWaiting}>
              <ul>{stack.waiting.map((f) => row(f, 'waiting'))}</ul>
            </Fold>
          </li>
        ) : null}
        {running ? (
          <li className="border-t border-ink/[0.07] first:border-t-0">
            <PinRow
              pinKey={running.key}
              topic={PLUS_CARD_TOPIC[running.card]}
              tone="run"
              kicker={`Running topic${running.by === 'them' ? ` · from ${running.byName ?? 'them'}` : ''}`}
              line={`${running.title}${running.status === 'draft' ? ' · not sent yet' : ''}`}
              action="Open ›"
              onPress={() => jumpTo(running.anchorId)}
            />
          </li>
        ) : null}
        {talking ? (
          <li className="flex min-h-[48px] items-center gap-2.5 border-t border-ink/[0.07] first:border-t-0" data-chat-pin="talk">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-ink/[0.05] text-ink/60">
              {(() => {
                const I = TOPIC_ICON.decision;
                return <I className="h-[15px] w-[15px]" strokeWidth={1.9} />;
              })()}
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-ink/55">Talking about</span>
              <span className="truncate text-[14px] font-semibold text-ink">{talking.title}</span>
            </span>
            {onCloseTalking ? (
              <button type="button" onClick={onCloseTalking} className="sn-press min-h-11 px-2 text-[13px] font-semibold text-sn-accent">
                Close
              </button>
            ) : null}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
