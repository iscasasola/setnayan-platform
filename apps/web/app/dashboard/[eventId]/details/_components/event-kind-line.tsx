'use client';

import { useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickArrowClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import type { EventKindLineInput } from '@/lib/event-type-requests';
import { updateEventMatchCriteria } from '../../actions';

/**
 * 🏷 KIND OF EVENT — Event settings' ONE line (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST BE SPECIFIC").
 *
 * Drawn only when there is something to pick: an event made under the generic type (new events can no longer pick
 * it — existing ones keep working, and their host picks a specific kind here), or an event whose host asked us to add
 * a type that is now added ("start with the closest type and switch once it exists"). One dropdown (PickMenu), the
 * details inside the ⓘ. It saves the moment a kind is picked, through the shipped `updateEventMatchCriteria`
 * (`event_type_switch` door, +0 actions), and the action's own revalidate redraws it in place — the screen never resets.
 */
export function EventKindLine({ eventId, kind }: { eventId: string; kind: EventKindLineInput }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const firstAsked = kind.choices.find((c) => c.asked);

  return (
    <div className="space-y-2" data-event-kind-line="">
      <InfoTip label="Kind of event" labelAs="p" labelClassName="text-sm font-medium text-ink" align="start">
        The kind decides which suppliers and services cover this event, so every event needs a specific one. Your
        guests, suppliers and plans stay as they are.
      </InfoTip>
      <p className="text-[13px] text-ink/65">
        {kind.generic
          ? 'Pick the specific kind of this event.'
          : `${firstAsked?.label ?? 'The kind you asked for'} is ready — switch this event to it.`}
      </p>
      <PickMenu
        label="Kind of event"
        value={null}
        buttonText={kind.generic ? 'Pick a kind' : kind.currentLabel}
        dataAttr="data-event-kind"
        className={/* no-card-ok: PickMenu's own <button> (the `trigger` row), a pressable */ 'sn-press sn-press-ring flex min-h-11 w-full items-center gap-3 rounded-xl border border-ink/12 bg-white/70 px-4 py-2 text-left transition-colors hover:bg-white dark:border-ink/15 dark:bg-raised'}
        trigger={
          <>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
              {pending ? 'Saving…' : kind.generic ? 'Pick a kind' : kind.currentLabel}
            </span>
            <ChevronDown aria-hidden className={pickArrowClass(false)} strokeWidth={2} />
          </>
        }
        options={kind.choices.map((c) => ({
          key: c.key,
          label: c.label,
          hint: c.asked ? 'You asked for this one' : undefined,
        }))}
        onPick={(key) => {
          setMessage(null);
          start(async () => {
            const fd = new FormData();
            fd.set('event_id', eventId);
            fd.set('event_type_switch', key);
            const res = await updateEventMatchCriteria(fd);
            if (res.ok) {
              // The action revalidates the event's layout, so its answer already carries the new render.
              setMessage({ ok: true, text: 'Saved.' });
            } else {
              setMessage({ ok: false, text: res.message });
            }
          });
        }}
      />
      {message ? (
        <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-ink/70' : 'text-terracotta-700'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
