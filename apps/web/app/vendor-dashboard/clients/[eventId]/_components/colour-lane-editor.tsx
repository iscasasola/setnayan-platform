'use client';

/**
 * MB16 · the SUPPLIER's half — the swatches they may actually change.
 *
 * 🔑 IT LIVES ON THE READ-ONLY MOOD BOARD THEY ALREADY OPEN, beside the
 * palette it edits, for the same reason MB12 put the sign-off here rather than
 * on the Answers Desk: a colour cannot honestly be chosen from a list of rows.
 *
 * ⚠ IT RENDERS NOTHING WITHOUT AN ACTIVE GRANT, and that absence is the whole
 * design — there is no disabled state, no "ask the couple" button, no dead
 * control. A supplier who has not been given colour access simply has the same
 * read-only board they had yesterday.
 *
 * ⚠ AND THE SCREEN IS NOT THE GATE. `apply_colour_change` re-checks the grant
 * and re-checks that the target is inside its domain, so a supplier who kept
 * this page open through a revoke gets a refusal rather than a write, and the
 * message below says so instead of failing silently.
 */

import { useState, useTransition } from 'react';
import { Palette } from 'lucide-react';
import {
  COLOUR_DOMAIN_LABEL,
  type ColourDomain,
  type ColourTargetKind,
  type EditableSwatch,
} from '@/lib/colour-access';

type Result = { status: string };

export function ColourLaneEditor({
  swatches,
  applyAction,
}: {
  swatches: readonly EditableSwatch[];
  applyAction: (
    domain: ColourDomain,
    targetKind: ColourTargetKind,
    targetKey: string,
    targetIndex: number | null,
    newValue: string,
  ) => Promise<Result>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (swatches.length === 0) return null;

  const domains = [...new Set(swatches.map((s) => s.domain))];

  function keyOf(s: EditableSwatch): string {
    return `${s.kind}:${s.key}:${s.index ?? '-'}`;
  }

  function save(s: EditableSwatch, value: string) {
    const k = keyOf(s);
    setBusy(k);
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await applyAction(s.domain, s.kind, s.key, s.index, value);
        if (r.status === 'refused') {
          setMessage(
            'The couple has turned this off, or that colour is outside what they gave you. Reload to see where it stands.',
          );
        } else if (r.status === 'frozen') {
          // 🔑 NAMED, NOT SWALLOWED. MB12's freeze trigger reverts the write
          // inside the same statement and the UPDATE still reports success —
          // so "saved" would be a lie the supplier could not detect.
          setMessage(
            'That part has already been signed off, so its colour is frozen. Nothing was changed.',
          );
        } else if (r.status === 'unchanged') {
          setMessage('That is already the colour.');
        } else if (r.status !== 'ok') {
          setMessage('That didn’t go through. Reload and try again.');
        } else {
          setMessage('Saved. The couple has been told.');
        }
      } catch {
        setMessage('That didn’t go through. Reload and try again.');
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <section
      aria-labelledby="colour-lane-heading"
      className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
    >
      <header className="space-y-1">
        <h2
          id="colour-lane-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Palette aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Colours you can adjust
        </h2>
        <p className="text-xs text-ink/65">
          This couple gave you standing permission for{' '}
          {domains.map((d) => COLOUR_DOMAIN_LABEL[d].toLowerCase()).join(' and ')}. You don’t
          need to ask each time — but they are told about every change, and they can put any
          single one back.
        </p>
      </header>

      <ul className="divide-y divide-ink/10">
        {swatches.map((s) => {
          const k = keyOf(s);
          const value = draft[k] ?? s.current;
          const dirty = value.toUpperCase() !== s.current.toUpperCase();
          return (
            <li key={k} className="flex flex-wrap items-center gap-3 py-2.5">
              <input
                type="color"
                value={value}
                aria-label={s.label}
                disabled={busy === k}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                className="h-8 w-10 flex-none cursor-pointer rounded-md border border-ink/15 bg-transparent p-0.5 disabled:opacity-50"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-ink">{s.label}</p>
                <p className="mt-0.5 font-mono text-[10.5px] uppercase text-ink/45">
                  {s.current}
                  {dirty ? ` → ${value.toUpperCase()}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={!dirty || busy === k}
                onClick={() => save(s, value.toUpperCase())}
                className="inline-flex flex-none items-center rounded-md bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                {busy === k ? 'Saving…' : 'Save'}
              </button>
            </li>
          );
        })}
      </ul>

      {message ? (
        <p role="status" className="text-xs text-ink/70">
          {message}
        </p>
      ) : null}
    </section>
  );
}
