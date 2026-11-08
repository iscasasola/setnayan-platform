'use client';

/**
 * 🚦 THE BLOCKER — the whole screen, until they do the act (Supplier Build 3 · lane B; DECISION_LOG 🚦 ⏳ 2026-11-09).
 *
 * Owner: *"if it is something that we cannot proceed until they answer, then it should take the whole screen until they
 * do the act."* ⇒ when the chat opens with a blocker unanswered, this layer covers it: WHY it blocks, the facts to
 * decide, the ONE action, and — like a skippable ad — no way back while the hold runs, only quiet text "Return to chat
 * in N"; at 0 a quiet full-width **Return to chat** fades in, which opens the chat on that topic with the red pin kept.
 * The hold is 5 s / 30 s / 60 s by how many times THIS blocker was shown (`lib/blocker-hold.ts`; the count is the
 * server's, `chat_blocker_shown()`). 🔑 The action buttons are NEVER held.
 *
 * Motion: it rises at the family's one speed (`--sn-pill-dur`, the rise ease); the ring drains in real time; under
 * reduced motion the same states draw with no movement. One shared part for all six blockers (booking ask · overdue
 * booking fee · coordinator Agree at proof · a change awaiting approval within 7 days · call time unset within 7
 * days · an expired quotation) — `lib/one-blocker-part.test.ts` holds it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ActionButton } from '@/components/action-button';
import { TOPIC_ICON, type ChatTopic } from '@/lib/topic-icons';
import { actionHeld, blockerHoldSeconds, holdLeft, holdLine } from '@/lib/blocker-hold';
import { recordBlockerShow, type BlockerKind } from './blocker-actions';

export type BlockerFactRow = { label: string; value: ReactNode };

export type ChatBlockerProps = {
  threadId: string;
  kind: BlockerKind;
  /** Changes when the blocker is a NEW one (a new ask, a new quote) — so its count starts again. */
  subjectKey: string;
  topic: ChatTopic;
  /** "They asked to book you" — the headline. */
  title: string;
  /** Why the booking cannot move until this is done. One sentence. */
  why: string;
  facts?: readonly BlockerFactRow[];
  /**
   * The ONE action — the shipped controls that answer it (e.g. the booking ask's own `LockRequestAnswer`, whose fee
   * line and expiry are the shipped ones). Never held.
   */
  action: ReactNode;
  /** Return to chat — opens the chat on this topic, the red pin kept. */
  onReturn: () => void;
  /** Labs: a fixed show count (skips the server) and a fixed seconds-left to draw a state. */
  labShownCount?: number;
  labLeft?: number;
};

const RING = 2 * Math.PI * 15;

export function ChatBlocker({
  threadId,
  kind,
  subjectKey,
  topic,
  title,
  why,
  facts,
  action,
  onReturn,
  labShownCount,
  labLeft,
}: ChatBlockerProps) {
  const [mounted, setMounted] = useState(false);
  const [hold, setHold] = useState<number | null>(labShownCount != null ? blockerHoldSeconds(labShownCount) : null);
  const [started, setStarted] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(labLeft ?? null);
  const [risen, setRisen] = useState(false);
  const counted = useRef(false);
  const Icon = TOPIC_ICON[topic];

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setRisen(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // One show = one count, once per mount (a re-render is not a show).
  useEffect(() => {
    if (labShownCount != null || counted.current) return;
    counted.current = true;
    void recordBlockerShow(threadId, kind, subjectKey).then((n) => setHold(blockerHoldSeconds(n)));
  }, [threadId, kind, subjectKey, labShownCount]);

  useEffect(() => {
    if (hold == null || labLeft != null) return;
    const t0 = Date.now();
    setStarted(t0);
    setLeft(hold);
    const id = window.setInterval(() => {
      const l = holdLeft(t0, hold, Date.now());
      setLeft(l);
      if (l <= 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [hold, labLeft]);

  // Esc never skips the hold; the screen stays until the act or Return to chat.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const free = left === 0;
  const total = hold ?? 1;
  const drained = left == null ? 0 : 1 - left / total;

  const layer = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`blocker-${subjectKey}`}
      data-chat-blocker={kind}
      data-hold={left ?? ''}
      className="fixed inset-0 flex flex-col bg-cream"
      style={{ zIndex: 'var(--sn-z-modal)' as unknown as number }}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1.25rem)] transition-[transform,opacity] duration-[var(--sn-pill-dur)] ease-[var(--sn-ease-rise)] motion-reduce:transition-none sm:mx-auto sm:w-full sm:max-w-[520px]"
        style={{ transform: risen ? 'none' : 'translateY(24px)', opacity: risen ? 1 : 0 }}
      >
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-danger-100 text-danger-800">
            <Icon className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-danger-700">Needs you first</span>
        </div>
        <h2 id={`blocker-${subjectKey}`} className="mt-4 text-[24px] font-semibold leading-tight text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/70">{why}</p>
        {facts && facts.length > 0 ? (
          <dl className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-[13px] text-ink/60">{f.label}</dt>
                <dd className="text-right text-[15px] font-semibold text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="mt-6" data-blocker-action="" data-held={String(actionHeld(left ?? 0))}>
          {action}
        </div>
        <div className="mt-auto pt-6">
          {free ? (
            <div className="animate-[sn-fade_var(--sn-pill-dur)_var(--sn-ease)_both] motion-reduce:animate-none">
              <ActionButton
                tone="neutral"
                quiet
                icon={TOPIC_ICON.chat}
                label="Return to chat"
                onClick={onReturn}
                className="w-full justify-center"
                data-testid="blocker-return"
              />
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2.5 text-[14px] text-ink/60" aria-live="polite" data-blocker-hold="">
              <span className="relative grid h-9 w-9 place-items-center" aria-hidden>
                <svg viewBox="0 0 36 36" className="absolute inset-0 h-9 w-9 -rotate-90 motion-reduce:hidden">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={RING}
                    strokeDashoffset={RING * drained}
                    style={{ transition: started && left != null ? 'stroke-dashoffset 250ms linear' : undefined }}
                  />
                </svg>
                <span className="text-[13px] font-semibold tabular-nums text-ink">{left ?? ''}</span>
              </span>
              {left != null ? holdLine(left) : 'Return to chat in a moment'}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(layer, document.body) : null;
}
