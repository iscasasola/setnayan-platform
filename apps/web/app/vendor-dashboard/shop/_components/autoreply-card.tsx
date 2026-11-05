'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Minus, Plus } from 'lucide-react';

import { InfoTip } from '@/app/_components/info-tip';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  AUTO_ACCEPT_THRESHOLD_MAX,
  AUTO_ACCEPT_THRESHOLD_MIN,
} from '@/lib/vendor-autoreply/config';

import { updateAutoReplyConfig, type AutoReplySaveResult } from '../autoreply-actions';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';

/**
 * Your page › Auto-reply — the supplier's "Auto-Reply Assistant" settings
 * (flag-dark: the page only renders this behind NEXT_PUBLIC_VENDOR_AUTOREPLY_V1).
 *
 * 🚫 NO PER-DAY LIMIT, AND NONE SHOWN (owner 2026-10-23, verbatim: "why do we
 * limit the auto reply? and too many words. we agreed to place all info that is
 * possible inside (i) and if you add description outside should be at
 * minimum"). The "Daily reply cap" and "Daily auto-accept cap" fields are gone
 * — the engine no longer counts against them either (`inbox-hook.ts`,
 * `auto-accept.ts`). Held by `lib/vendor-autoreply/no-daily-limit.test.ts`.
 *
 * WORDS: three controls, each a title + at most ONE short line. Everything else
 * — what it answers, what it hands to you, the AI-label promise, how the
 * threshold works — sits behind each title's ⓘ (the house `InfoTip`). The ⓘ
 * text mirrors the deterministic engine's real intent set
 * (`lib/vendor-autoreply/intents.ts`) so it cannot over-promise.
 *
 * SAVE: one pattern for all three — SAVE ON CHANGE, the pattern this card's
 * switches already shipped with (optimistic, revert + toast on error, a short
 * toast on success). The threshold stepper saves the same way, a moment after
 * the last press, so walking 78 → 85 is one save, not seven. No Save buttons.
 *
 * No frames: the fold is the container; topics are split by hairline dividers
 * (owner 2026-10-11, "a frame only on something pressable").
 */
export function AutoReplyCard({
  initialEnabled,
  initialAutoAcceptEnabled,
  initialAutoAcceptThreshold,
}: {
  initialEnabled: boolean;
  initialAutoAcceptEnabled: boolean;
  initialAutoAcceptThreshold: number;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(initialEnabled);
  const [autoAccept, setAutoAccept] = useState(initialAutoAcceptEnabled);
  const [threshold, setThreshold] = useState(initialAutoAcceptThreshold);
  const savedThreshold = useRef(initialAutoAcceptThreshold);
  const thresholdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (thresholdTimer.current) clearTimeout(thresholdTimer.current);
    },
    [],
  );

  function save(
    entries: [string, string][],
    opts?: { onError?: () => void; onSuccess?: (res: Extract<AutoReplySaveResult, { ok: true }>) => void },
  ) {
    const fd = new FormData();
    for (const [k, v] of entries) fd.set(k, v);
    startTransition(async () => {
      const res = await updateAutoReplyConfig(null, fd);
      if (!res.ok) {
        toast.error(res.error);
        opts?.onError?.();
      } else {
        opts?.onSuccess?.(res);
      }
    });
  }

  function toggleEnabled() {
    const was = enabled;
    const next = !was;
    setEnabled(next);
    save([['enabled', next ? 'true' : 'false']], {
      onError: () => setEnabled(was),
      onSuccess: () =>
        toast.success(next ? 'Auto-Reply Assistant is on.' : 'Auto-Reply Assistant is off.'),
    });
  }

  function toggleAutoAccept() {
    const was = autoAccept;
    const next = !was;
    setAutoAccept(next);
    save([['auto_accept_enabled', next ? 'true' : 'false']], {
      onError: () => setAutoAccept(was),
      onSuccess: () => toast.success(next ? 'Auto-accept is on.' : 'Auto-accept is off.'),
    });
  }

  // The value the next press steps from — a ref, so two quick presses never both read the same stale state.
  const thresholdNow = useRef(initialAutoAcceptThreshold);

  function stepThreshold(delta: number) {
    const next = Math.max(
      AUTO_ACCEPT_THRESHOLD_MIN,
      Math.min(AUTO_ACCEPT_THRESHOLD_MAX, thresholdNow.current + delta),
    );
    if (next === thresholdNow.current) return;
    thresholdNow.current = next;
    setThreshold(next);
    if (thresholdTimer.current) clearTimeout(thresholdTimer.current);
    thresholdTimer.current = setTimeout(() => {
      const value = thresholdNow.current;
      if (value === savedThreshold.current) return;
      save([['auto_accept_threshold', String(value)]], {
        onError: () => {
          thresholdNow.current = savedThreshold.current;
          setThreshold(savedThreshold.current);
        },
        onSuccess: (res) => {
          savedThreshold.current = res.autoAcceptThreshold;
          thresholdNow.current = res.autoAcceptThreshold;
          setThreshold(res.autoAcceptThreshold);
          toast.success('Saved.');
        },
      });
    }, 700);
  }

  return (
    <div data-autoreply-card="" className="divide-y divide-[var(--m-line)]">
      {/* ── The assistant: title + ⓘ · one line · the switch ─────────────── */}
      <div className="flex items-center justify-between gap-3 py-3" data-autoreply-control="assistant">
        <div className="min-w-0">
          <InfoTip
            label="Auto-Reply Assistant"
            labelAs="h3"
            labelId="auto-reply-heading"
            labelClassName="text-sm font-semibold text-ink"
            align="start"
          >
            <span className="block font-semibold">It answers</span>
            Prices and packages, what is included, the services and events you cover, lead times, running
            discounts and your reviews — from your own listings, never made up. Asked about a date, it asks
            for theirs or says you will confirm.
            <span className="mt-2 block font-semibold">It hands to you</span>
            Custom requests, the decision to book, and anything it is not sure of or cannot find in your
            listings.
            <span className="mt-2 block">
              Couples always see that the reply is from the assistant, never disguised as you, and you can
              read every reply in the chat.
            </span>
          </InfoTip>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }} data-autoreply-line="">
            {enabled ? 'Answers couples’ questions for you.' : 'Off — messages wait for you.'}
          </p>
        </div>
        <Switch on={enabled} onClick={toggleEnabled} label="Auto-Reply Assistant" />
      </div>

      {/* ── Auto-accept: title + ⓘ · one line · the switch ───────────────── */}
      <div className="flex items-center justify-between gap-3 py-3" data-autoreply-control="auto-accept">
        <div className="min-w-0">
          <InfoTip label="Auto-accept" labelAs="h4" labelClassName="text-sm font-semibold text-ink" align="start">
            Accepts an inquiry for you when the couple’s match score reaches your threshold — the same as
            pressing Accept yourself. It only opens the chat; it never books you. When it cannot accept, the
            assistant keeps answering and the inquiry waits for you.
          </InfoTip>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }} data-autoreply-line="">
            Opens the chat for strong matches.
          </p>
        </div>
        <Switch on={autoAccept} onClick={toggleAutoAccept} label="Auto-accept" />
      </div>

      {/* ── Match threshold: title + ⓘ · the stepper (saves on change) ───── */}
      <div className="flex items-center justify-between gap-3 py-3" data-autoreply-control="threshold">
        <InfoTip label="Match threshold" labelAs="h4" labelClassName="text-sm font-semibold text-ink" align="start">
          Only couples who score at least this much are accepted. 80 and above is a strong match; 60 to 79
          is a good match.
        </InfoTip>
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Match threshold">
          <button
            type="button"
            onClick={() => stepThreshold(-1)}
            disabled={threshold <= AUTO_ACCEPT_THRESHOLD_MIN}
            aria-label="Lower the match threshold"
            className="sn-press flex h-11 w-11 items-center justify-center rounded-full border text-ink disabled:opacity-35"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <output
            aria-live="polite"
            className="w-12 text-center text-sm font-semibold tabular-nums text-ink"
            data-autoreply-threshold=""
          >
            {threshold}%
          </output>
          <button
            type="button"
            onClick={() => stepThreshold(1)}
            disabled={threshold >= AUTO_ACCEPT_THRESHOLD_MAX}
            aria-label="Raise the match threshold"
            className="sn-press flex h-11 w-11 items-center justify-center rounded-full border text-ink disabled:opacity-35"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Switch (WebsiteEditor idiom) ────────────────────────────────────────── */
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={SWITCH_BUTTON}
    >
      <SwitchTrack on={on} />
    </button>
  );
}
