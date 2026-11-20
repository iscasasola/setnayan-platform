'use client';

/**
 * 💬 THE SUMMARY STRIP — four facts pinned on top of the client's chat, each the door to the page behind it (owner
 * 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screens 2 · 3 · 7).
 *
 *   Paid / Deal / Quote → Book & Budget (or Every version, before booking) · Next → Schedule ·
 *   Forms → Details at Forms · Decisions → Details at Decisions
 *
 * Drawn FIRST in the chat's one pinned stack (`ChatHomeTop`, above the shipped pins) — it never scrolls with the
 * messages. One frame, four presses: the box itself is the press, so no box wears a frame of its own.
 *
 * What each box says is decided in `lib/client-chat-strip.ts` (pure, tested) from reads the client page already made;
 * Decisions is counted by the chat itself (`chat-kind-store`), from the merge its cards are drawn from.
 * 🔑 A box whose read failed says "Couldn't load · tap to retry" in the danger colour, and the tap reads again — never
 * ₱0, never "0 open", never a blank.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decisionsBox, type StripBox, type StripTone } from '@/lib/client-chat-strip';
import { raiseDeal, useKinds } from '@/lib/chat-kind-store';
import { usePickedNav } from './picked-client-nav';
import type { PickedClientPage } from './picked-client-menu';

const TONE: Record<StripTone, { className?: string; color?: string }> = {
  plain: { className: 'text-ink' },
  needs: { className: 'text-sn-accent' },
  ok: { className: 'text-success-700' },
  quiet: { className: 'text-[color:var(--m-slate-2)]' },
  warn: { color: 'rgb(var(--color-warn))' },
  danger: { color: 'rgb(var(--color-danger))' },
};

export function ClientChatStrip({
  boxes,
  threadId,
}: {
  /** Money · Next · Forms, as the page read them (`chatStrip`). */
  boxes: readonly StripBox[];
  /** The conversation whose chat counts the Decisions; null = no conversation yet (nothing can be waiting in it). */
  threadId: string | null;
}) {
  const nav = usePickedNav();
  const router = useRouter();
  const [retrying, retry] = useTransition();
  const kinds = useKinds(threadId ?? '');
  const all = [...boxes, decisionsBox(threadId ? kinds.waiting : 0)];
  if (!nav) return null;
  return (
    <div className="px-3 pb-1.5 pt-2" data-chat-strip="">
      <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-frame shadow-sn-frame">
        {all.map((b, i) => {
          const tone = TONE[b.tone];
          const edge = `${i % 2 === 0 ? 'border-r' : ''} ${i >= 2 ? 'border-t' : ''} border-[color:var(--m-line)]`;
          const words = (
            <>
              <span className="block text-[11.5px] font-bold uppercase leading-none tracking-[0.08em] text-[color:var(--m-slate-2)]">{b.label}</span>
              <span
                className={`mt-1 block text-[13.5px] font-semibold leading-tight tabular-nums ${tone.className ?? ''}`}
                style={tone.color ? { color: tone.color } : undefined}
                data-chat-strip-value=""
              >
                {b.failed && retrying ? 'Loading…' : b.value}
              </span>
              {typeof b.progress === 'number' ? (
                <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[color:var(--m-line)]">
                  <span className="block h-full rounded-full bg-success-700" style={{ width: `${Math.round(b.progress * 100)}%` }} />
                </span>
              ) : null}
              {b.sub ? (
                <span
                  className={`mt-1 block text-[12.5px] font-semibold leading-tight tabular-nums ${TONE[b.sub.tone].className ?? ''}`}
                  style={TONE[b.sub.tone].color ? { color: TONE[b.sub.tone].color } : undefined}
                >
                  {b.sub.text}
                </span>
              ) : null}
            </>
          );
          const box = `min-h-[52px] px-3 py-2 text-left ${edge}`;
          // 🔒 Shut (Forms before booking): its reason, said — not a press, never hidden.
          if (!b.door) {
            return (
              <div key={b.key} className={box} data-chat-strip-box={b.key} data-shut="">
                {words}
              </div>
            );
          }
          const door = b.door;
          return (
            <button
              key={b.key}
              type="button"
              className={`sn-press ${box}`}
              data-chat-strip-box={b.key}
              data-tour={b.key === 'money' ? 'client-quote' : undefined}
              {...(b.failed ? { 'data-failed': '', 'aria-busy': retrying } : {})}
              onClick={() => {
                // A failed read is retried where it failed — the page reads again; nothing is guessed meanwhile.
                // one-render: keep (retry) — nothing was written here; a refused read is asked again.
                if (b.failed) return retry(() => router.refresh());
                if (door === 'deal') {
                  if (threadId) raiseDeal(threadId);
                  else nav.select('quote');
                  return;
                }
                nav.select(door as PickedClientPage);
              }}
            >
              {words}
            </button>
          );
        })}
      </div>
    </div>
  );
}
