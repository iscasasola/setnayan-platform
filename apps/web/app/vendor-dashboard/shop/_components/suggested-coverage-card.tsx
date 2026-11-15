'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import { InlineNotice } from '@/app/_components/notices/inline-notice';

import { useToast } from '@/app/_components/toast/toast-provider';
import { applySuggestedCoverage, dismissSuggestedCoverage } from '../suggested-coverage-actions';

export type SuggestedCoverageItem = {
  key: string;
  label: string;
  branch: string;
};

/**
 * My Shop → Business Profile → "Your website suggests you also do…" (C5,
 * 2026-08-28). Renders only when `fetchPendingSignupCoverageSuggestion`
 * (shop/page.tsx) found a completed, un-resolved `signup_suggestion` dossier
 * whose `detected_services` matched at least one trade this shop has not
 * already declared.
 *
 * ⚖ SUGGESTED, NEVER APPLIED — every chip starts UNCHECKED. Nothing is added
 * to this shop's coverage unless the owner ticks it and presses "Add", and
 * the server re-validates every ticked key against this shop's own open
 * suggestion before writing anything (see suggested-coverage-actions.ts).
 *
 * 🔒 THE DISCLOSURE LIVES ON THIS CARD, NOT ONLY IN /privacy — the ruling's
 * third condition. The card says outright that Setnayan read the shop's own
 * website once, for free, to produce this list.
 */
export function SuggestedCoverageCard({
  dossierId,
  suggestions,
}: {
  dossierId: number;
  suggestions: readonly SuggestedCoverageItem[];
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [resolved, setResolved] = useState(false);

  if (resolved || suggestions.length === 0) return null;

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function add() {
    if (picked.size === 0) return;
    const fd = new FormData();
    fd.set('dossier_id', String(dossierId));
    for (const key of picked) fd.append('trade_key', key);
    setPending(true);
    startTransition(async () => {
      const res = await applySuggestedCoverage(null, fd);
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.addedLabels.length > 0) {
        toast.success(`Added to your coverage: ${res.addedLabels.join(', ')}`);
      }
      setResolved(true);
    });
  }

  function notNow() {
    const fd = new FormData();
    fd.set('dossier_id', String(dossierId));
    setPending(true);
    startTransition(async () => {
      await dismissSuggestedCoverage(null, fd);
      setPending(false);
      setResolved(true);
    });
  }

  // 🔔 Inventory #7 — a To-do (one notice system, owner approved 14 Nov 2026), drawn where it stands on Details: the
  // suggestions are picked under the line, "Add" is the action and "Not now" the close — kept by the one notice memory
  // AND sent as the shipped dismiss (`vendor_web_dossiers.suggestion_dismissed_at`), so it is resolved either way.
  return (
    <section className="mt-3">
      <InlineNotice
        kind="todo"
        noticeKey={`website-suggests:${dossierId}`}
        title="Your website suggests you also do this"
        detail="We read your own website once, for free, to look for things you offer that aren’t on your coverage yet. Nothing changes until you tick what’s right and press Add — and you can just say not now."
        onClose={notNow}
        actions={
          <button type="button" onClick={add} disabled={pending || picked.size === 0} className={`${NOTICE_ACTION} disabled:opacity-60`}>
            {pending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
            Add {picked.size > 0 ? `(${picked.size})` : ''}
          </button>
        }
      />
      <div className="mt-1 flex flex-wrap gap-2">
        {suggestions.map((s) => {
          const active = picked.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              disabled={pending}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-60"
              style={
                active
                  ? { borderColor: 'var(--m-accent-deep)', background: 'var(--m-accent-deep)', color: 'rgb(var(--sn-on-accent))' }
                  : { borderColor: 'var(--m-line)', color: 'var(--m-ink)' }
              }
              aria-pressed={active}
            >
              {active ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
              {s.label}
              <span className="opacity-70">· {s.branch}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
