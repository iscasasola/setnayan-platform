'use client';

/**
 * 🪜 THE ONE CHAT CARD FRAME — every (+) card, one step at a time (Supplier Build 3 · lane B; lane C fills the bodies).
 *
 * Owner, 8 Nov: *"chat cant be the full form. it should be step by step. one step at a time."* ⇒ each step is ONE
 * question or ONE choice, with Back / Next and a small "2 of 4". The FULL tab page stays the all-fields view (the other
 * face of the same record). Enter = Next (Send on the last step); Shift+Enter breaks the line in a text box; a phone's
 * Return does the same as Enter (phones send too).
 *
 * The frame owns: the card head (the topic's icon from `TOPIC_ICON`, the kicker, the title, ✕ close), the step body,
 * and the footer (count · Back · Next/Send — `ActionButton`, equal gutters on every card). It owns NO data: a card
 * kind passes its steps and its own Send. Lane C: build Quote · Payment · Form · Photos & files · Decision · Log a
 * payment by passing `steps` — see `meeting-step-card.tsx` for the worked example.
 */
import { useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Send, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TOPIC_ICON, type ChatTopic } from '@/lib/topic-icons';

export type ChatCardStep = {
  title: string;
  sub?: ReactNode;
  body: ReactNode;
  /** May the person move on? Next / Send stay grey (still buttons) until true. */
  ok: boolean;
};

/** The card's chrome alone — also worn by a stub card and by the answered face of a card. */
export function ChatCardShell({
  topic,
  kicker,
  title,
  onClose,
  anchorId,
  tone = 'mine',
  children,
}: {
  topic: ChatTopic;
  kicker: string;
  title: string;
  onClose?: () => void;
  anchorId?: string;
  /** Mine sits right, theirs left, an automatic card full width (the prototype's `.card.me / .them / .auto`). */
  tone?: 'mine' | 'theirs' | 'auto';
  children: ReactNode;
}) {
  const Icon = TOPIC_ICON[topic];
  const place = tone === 'mine' ? 'ml-[8%]' : tone === 'theirs' ? 'mr-[8%]' : '';
  return (
    <section
      id={anchorId}
      data-chat-card={topic}
      aria-label={title}
      className={`my-2 scroll-mt-3 overflow-hidden rounded-2xl border border-ink/12 bg-white transition-shadow duration-[var(--sn-pill-dur)] data-[hot]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sn-accent)_35%,transparent)] dark:bg-ink/[0.04] ${place}`}
    >
      <header className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 px-4 pb-2 pt-3">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-sn-accent/10 text-sn-accent">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <span className="grid min-w-0">
          <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-ink/55">{kicker}</span>
          <span className="truncate text-[16px] font-semibold leading-tight text-ink">{title}</span>
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="sn-press grid h-11 w-11 place-items-center rounded-full text-ink/55 hover:bg-ink/[0.05]"
            data-chat-card-close=""
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </header>
      <div className="px-4 pb-3 text-[15px] text-ink">{children}</div>
    </section>
  );
}

/** Enter on a field moves on; Shift+Enter in a text box breaks the line; an IME's Enter is the IME's. */
export function isStepEnter(e: Pick<KeyboardEvent, 'key' | 'shiftKey'> & { nativeEvent?: { isComposing?: boolean } }, target: EventTarget | null): boolean {
  if (e.key !== 'Enter' || e.nativeEvent?.isComposing) return false;
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  if (tag === 'TEXTAREA') return !e.shiftKey;
  if (tag === 'INPUT' || tag === 'SELECT') return !e.shiftKey;
  return false;
}

export function ChatStepCard({
  topic,
  kicker,
  title,
  steps,
  step,
  onStep,
  sendLabel = 'Send',
  sending = false,
  onClose,
  anchorId,
  submitForm,
}: {
  topic: ChatTopic;
  kicker: string;
  title: string;
  steps: readonly ChatCardStep[];
  step: number;
  onStep: (next: number) => void;
  sendLabel?: string;
  sending?: boolean;
  onClose?: () => void;
  anchorId?: string;
  /** The id of the `<form>` the last step submits (the card's own server action). */
  submitForm: string;
}) {
  const n = steps.length;
  const s = Math.min(Math.max(step, 0), n - 1);
  const st = steps[s]!;
  const last = s === n - 1;
  const ref = useRef<HTMLDivElement>(null);

  const next = useCallback(() => {
    if (!st.ok) return;
    if (last) {
      const f = document.getElementById(submitForm) as HTMLFormElement | null;
      f?.requestSubmit();
      return;
    }
    onStep(s + 1);
  }, [st.ok, last, submitForm, onStep, s]);

  return (
    <ChatCardShell topic={topic} kicker={kicker} title={title} onClose={onClose} anchorId={anchorId}>
      <div
        ref={ref}
        className="grid gap-3"
        data-chat-step={`${s + 1}/${n}`}
        onKeyDown={(e) => {
          if (isStepEnter(e, e.target)) {
            e.preventDefault();
            next();
          }
        }}
      >
        <div className="grid gap-1">
          <p className="text-[17px] font-semibold leading-snug text-ink">{st.title}</p>
          {st.sub ? <p className="text-[14px] text-ink/65">{st.sub}</p> : null}
        </div>
        {st.body}
        <div className="flex items-center gap-2 border-t border-ink/10 pt-3">
          <span className="mr-auto text-[13px] tabular-nums text-ink/55" data-chat-step-count="">
            {s + 1} of {n}
          </span>
          {s > 0 ? (
            <ActionButton tone="neutral" quiet icon={ChevronLeft} label="Back" onClick={() => onStep(s - 1)} />
          ) : null}
          {last ? (
            <ActionButton
              tone="brand"
              main
              icon={Send}
              label={sending ? 'Sending…' : sendLabel}
              type="submit"
              form={submitForm}
              waiting={!st.ok || sending}
            />
          ) : (
            <ActionButton tone="brand" main icon={ChevronRight} label="Next" onClick={next} waiting={!st.ok} />
          )}
        </div>
      </div>
    </ChatCardShell>
  );
}
