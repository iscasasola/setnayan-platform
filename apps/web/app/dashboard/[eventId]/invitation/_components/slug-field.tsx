'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';

type CheckResult =
  | { status: 'current' }
  | { status: 'available'; slug: string }
  | { status: 'taken'; suggestions: string[] }
  | { status: 'invalid_format'; reason: string }
  | { status: 'reserved'; reason: string };

type Props = {
  eventId: string;
  initialSlug: string;
  saveAction: (formData: FormData) => Promise<void>;
};

export function SlugField({ eventId, initialSlug, saveAction }: Props) {
  const [value, setValue] = useState(initialSlug);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setCheck(null);
      return;
    }
    if (value === initialSlug) {
      setCheck({ status: 'current' });
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setBusy(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/slugs/check?slug=${encodeURIComponent(value)}&entity_type=event&entity_id=${eventId}`,
          { method: 'GET' },
        );
        if (res.ok) {
          const json = (await res.json()) as CheckResult;
          setCheck(json);
        }
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, eventId, initialSlug]);

  const canSave = check?.status === 'available' && value !== initialSlug;

  return (
    <form
      action={(formData) => startTransition(() => saveAction(formData))}
      className="space-y-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label
          htmlFor="slug"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 sm:mr-2"
        >
          Slug
        </label>
        <div className="flex-1">
          <div className="relative">
            <input
              id="slug"
              name="slug"
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              placeholder="maria-and-juan"
              pattern="[a-z0-9-]{3,32}"
              className="input-field w-full pr-8 font-mono text-sm"
            />
            <StatusBadge busy={busy} check={check} />
          </div>
          <SuggestionsRow
            check={check}
            onPick={(s) => {
              setValue(s);
              setCheck(null);
            }}
          />
          <StatusLine check={check} />
        </div>
        <button
          type="submit"
          disabled={!canSave || pending}
          className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save slug'}
        </button>
      </div>
      <p className="text-xs text-ink/50">
        3–32 chars · lowercase letters, numbers, hyphens. Changes redirect old links for 90 days.
      </p>
    </form>
  );
}

function StatusBadge({
  busy,
  check,
}: {
  busy: boolean;
  check: CheckResult | null;
}) {
  let tone = '';
  let Icon: typeof Check | null = null;
  let spin = false;
  if (busy) {
    tone = 'text-ink/45';
    Icon = Loader2;
    spin = true;
  } else if (!check) {
    Icon = null;
  } else if (check.status === 'available' || check.status === 'current') {
    tone = 'text-success-700';
    Icon = Check;
  } else if (check.status === 'taken' || check.status === 'reserved') {
    tone = 'text-danger-700';
    Icon = X;
  } else if (check.status === 'invalid_format') {
    tone = 'text-warn-700';
    Icon = AlertTriangle;
  }

  if (!Icon) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${tone}`}
    >
      <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} strokeWidth={2} />
    </span>
  );
}

function StatusLine({ check }: { check: CheckResult | null }) {
  if (!check) return null;
  if (check.status === 'available') {
    return (
      <p className="mt-1 text-xs text-success-700">Available — click Save slug to claim it.</p>
    );
  }
  if (check.status === 'current') {
    return <p className="mt-1 text-xs text-ink/55">That&rsquo;s your current slug.</p>;
  }
  if (check.status === 'taken') {
    return <p className="mt-1 text-xs text-danger-700">Taken — try one of these:</p>;
  }
  if (check.status === 'invalid_format') {
    return <p className="mt-1 text-xs text-warn-700">{check.reason}</p>;
  }
  if (check.status === 'reserved') {
    return <p className="mt-1 text-xs text-danger-700">{check.reason}</p>;
  }
  return null;
}

function SuggestionsRow({
  check,
  onPick,
}: {
  check: CheckResult | null;
  onPick: (slug: string) => void;
}) {
  if (!check || check.status !== 'taken' || check.suggestions.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {check.suggestions.map((s) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-ink/15 bg-cream px-3 py-1 font-mono text-xs hover:border-terracotta"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}
