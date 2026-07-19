'use client';

import { useState, useTransition } from 'react';
import { Bot, Check, HandHelping } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import {
  DAILY_REPLY_CAP_MAX,
  DAILY_REPLY_CAP_MIN,
} from '@/lib/vendor-autoreply/config';

import { updateAutoReplyConfig, type AutoReplySaveResult } from '../autoreply-actions';

/**
 * My Shop → "Auto-Reply Assistant" (Phase 4 config card · flag-dark — the page
 * only renders this behind NEXT_PUBLIC_VENDOR_AUTOREPLY_V1).
 *
 * WebsiteEditor idiom: the switch saves instantly + optimistically (revert +
 * toast on error); the daily-cap field saves with an inline button that appears
 * when dirty. The explainer is STATIC — it mirrors the deterministic engine's
 * real intent set (lib/vendor-autoreply/intents.ts) so it can't over-promise.
 * Only `enabled` + `daily_reply_cap` are editable — the Phase-1 schema carries
 * no greeting/handoff copy columns, and the Pro columns wait for Phase 5/7.
 */
export function AutoReplyCard({
  initialEnabled,
  initialDailyCap,
}: {
  initialEnabled: boolean;
  initialDailyCap: number;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(initialEnabled);
  const [savedCap, setSavedCap] = useState(initialDailyCap);
  const [capVal, setCapVal] = useState(String(initialDailyCap));
  const capDirty = capVal.trim() !== String(savedCap);

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

  function saveCap() {
    save([['daily_reply_cap', capVal.trim()]], {
      onSuccess: (res) => {
        setSavedCap(res.dailyReplyCap);
        setCapVal(String(res.dailyReplyCap));
        toast.success('Daily reply cap saved.');
      },
    });
  }

  return (
    <div
      className="rounded-xl border p-4 sm:p-5"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      {/* ── Header: identity + the on/off switch ─────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          >
            <Bot className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h3 id="auto-reply-heading" className="text-sm font-semibold text-ink">
              Auto-Reply Assistant
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
              {enabled
                ? 'On — answers couples’ factual questions from your own catalog, up to your daily cap.'
                : 'Off — couples’ messages wait for you.'}
            </p>
          </div>
        </div>
        <Switch on={enabled} onClick={toggleEnabled} label="Auto-Reply Assistant" />
      </div>

      {/* ── Daily reply cap (dirty-save, About-field idiom) ──────────────── */}
      <div className="mt-4">
        <label htmlFor="autoreply-daily-cap" className="block text-xs font-medium text-ink">
          Daily reply cap
        </label>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
          After this many auto-replies in a day it pauses and leaves the rest to
          you. Set 0 to pause for the day without switching it off.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="autoreply-daily-cap"
            type="number"
            inputMode="numeric"
            min={DAILY_REPLY_CAP_MIN}
            max={DAILY_REPLY_CAP_MAX}
            step={1}
            value={capVal}
            onChange={(e) => setCapVal(e.target.value)}
            className="input-field max-w-[7rem]"
            aria-label="Daily reply cap"
          />
          <button
            type="button"
            disabled={!capDirty}
            onClick={saveCap}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--m-accent-deep)' }}
          >
            Save
          </button>
        </div>
      </div>

      {/* ── Static explainer — mirrors the deterministic engine exactly ──── */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--m-sage-deep)' }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            It answers
          </p>
          <ul className="mt-1.5 space-y-1 text-xs" style={{ color: 'var(--m-slate)' }}>
            <li>Prices &amp; packages — your listed rates, never invented</li>
            <li>Date availability — for the couple&rsquo;s date, or asks for it</li>
            <li>What&rsquo;s included — inclusions and add-ons</li>
            <li>Coverage — services and event types you serve</li>
            <li>Lead times — and any last-minute surcharge</li>
            <li>Active discounts — only ones currently running</li>
            <li>Reviews — your rating and recent feedback</li>
          </ul>
        </div>
        <div>
          <p
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--m-orange-2)' }}
          >
            <HandHelping className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            It hands to you
          </p>
          <ul className="mt-1.5 space-y-1 text-xs" style={{ color: 'var(--m-slate)' }}>
            <li>Customization requests</li>
            <li>Booking decisions — it never accepts or commits for you</li>
            <li>Anything it isn&rsquo;t sure about, instead of guessing</li>
            <li>Questions your catalog has no data for</li>
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Every auto-reply is visibly labeled as AI to the couple — never disguised
        as you. It reads only your own shop&rsquo;s catalog, and each handled
        thread is flagged so you can review what was said.
      </p>
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
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--m-orange)' : 'var(--m-line)' }}
    >
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}
