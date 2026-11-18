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
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE, TemplateSection } from '@/app/_components/template-rows';
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
    <TemplateSection
      label="Colours you can adjust"
      data="colour-lane"
      tip={
        <>
          The couple gave you standing permission for{' '}
          {domains.map((d) => COLOUR_DOMAIN_LABEL[d].toLowerCase()).join(' and ')}. They are told
          about every change and can put any one back.
        </>
      }
    >
      <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
        {swatches.map((s) => {
          const k = keyOf(s);
          const value = draft[k] ?? s.current;
          const dirty = value.toUpperCase() !== s.current.toUpperCase();
          return (
            <li key={k} className="flex min-h-14 flex-wrap items-center gap-3 py-2">
              <input
                type="color"
                value={value}
                aria-label={s.label}
                disabled={busy === k}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                className="h-11 w-11 flex-none cursor-pointer rounded-xl border border-[color:var(--m-line)] bg-transparent p-0.5 disabled:opacity-50"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{s.label}</p>
                <p className={`mt-0.5 uppercase ${TEMPLATE_SUBLINE}`}>
                  {s.current}
                  {dirty ? ` → ${value.toUpperCase()}` : ''}
                </p>
              </div>
              <ActionButton
                tone="brand"
                icon={Palette}
                label={busy === k ? 'Saving…' : 'Save'}
                disabled={!dirty || busy === k}
                onClick={() => save(s, value.toUpperCase())}
              />
            </li>
          );
        })}
      </ul>

      {message ? (
        <p role="status" className={`py-2 ${TEMPLATE_SUBLINE}`}>
          {message}
        </p>
      ) : null}
    </TemplateSection>
  );
}
