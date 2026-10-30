'use client';

import { useState, useTransition } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { InfoTip } from '@/app/_components/info-tip';
import {
  MEMORIES_RULES_FORBIDDEN,
  WHO_SEES_LINE,
  WHO_SEES_OPTIONS,
  isMemoriesWhoSees,
  poolGalleryOpenFor,
  whoSeesOf,
  type MemoriesWhoSees,
} from '@/lib/memories-rules';
import { setPoolGalleryOpen } from './pool-gallery-actions';

/**
 * 👁 WHO SEES WHAT — Memories ⚙'s first rule (owner 2026-10-30): **Only tagged** (the default) · **Share all
 * memories**, ONE dropdown (house rule: any set of choices is one PickMenu). It writes the shipped switch
 * (`events.pool_gallery_open`, through `setPoolGalleryOpen` — hosts + coordinator, gated on the server).
 *
 * SAVES IN PLACE (house rule): the pick shows at once, one request follows, nothing navigates; a refused or failed
 * save puts the choice back and says why, here. `locked` draws the row without the dropdown — the shared gallery is
 * not switched on for events yet (`papicPoolGalleryActive`), so the only true answer is the default.
 */
export function WhoSeesWhatPick({
  eventId,
  initialOpen,
  locked = false,
}: {
  eventId: string;
  initialOpen: boolean;
  /** The shared gallery cannot open yet (its env flag / privacy control): show the answer, offer no choice. */
  locked?: boolean;
}) {
  const [choice, setChoice] = useState<MemoriesWhoSees>(whoSeesOf(initialOpen));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const pick = (key: string) => {
    if (!isMemoriesWhoSees(key) || key === choice) return;
    const before = choice;
    setError(null);
    setChoice(key);
    startSaving(async () => {
      const res = await setPoolGalleryOpen(eventId, poolGalleryOpenFor(key)).catch(() => null);
      if (res && res.ok) {
        setChoice(whoSeesOf(res.open));
        return;
      }
      setChoice(before);
      setError(
        res?.error === 'forbidden'
          ? MEMORIES_RULES_FORBIDDEN
          : res?.error === 'unavailable'
            ? 'Sharing all memories isn’t available yet.'
            : res && res.error.startsWith('You can view')
              ? res.error
              : 'That didn’t save — try again.',
      );
    });
  };

  return (
    <section className="flex items-center justify-between gap-3 py-3" data-memories-setting="who-sees" data-who-sees={choice}>
      <span className="min-w-0">
        <InfoTip label="Who sees what" labelAs="h3" labelClassName="text-[15px] font-semibold text-ink" align="start">
          Only tagged: each guest sees the photos they are tagged in, plus the shots they took. Share all memories:
          every guest can browse every screened photo and clip (web copies only) and tag themselves into the ones they
          are in. You and your co-hosts always see everything. Switching back closes it for everyone
          at once. The photo wall has its own switch.
        </InfoTip>
        <span className="block text-[12.5px] text-ink/60" aria-live="polite">
          {saving ? 'Saving…' : error ? <span className="text-danger-700">{error}</span> : WHO_SEES_LINE[choice]}
        </span>
      </span>
      {locked ? (
        <span className="shrink-0 text-[13px] font-medium text-ink/70" data-who-sees-locked="">
          {WHO_SEES_OPTIONS.find((o) => o.key === choice)?.label}
        </span>
      ) : (
        <PickMenu
          label="Who sees what"
          value={choice}
          options={WHO_SEES_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          onPick={pick}
          dataAttr="data-who-sees-picker"
          className="shrink-0 border border-ink/15"
        />
      )}
    </section>
  );
}
