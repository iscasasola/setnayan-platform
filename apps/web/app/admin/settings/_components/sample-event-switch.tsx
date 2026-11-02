'use client';

import { useState, useTransition } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { setSampleEventSwitch } from '../actions';

type Mode = 'default' | 'on' | 'off';

const OPTIONS = [
  { key: 'default', label: 'Default — off' },
  { key: 'on', label: 'On — everyone can open it' },
  { key: 'off', label: 'Off — internal accounts only' },
] as const;

/**
 * 🎭 The Maria and Jose sample's switch, in place on Admin › Settings › Demo
 * mode. A pick saves at once and the screen stays put (house rule: a save never
 * resets the screen); a failed save says so and the picker goes back to what is
 * really stored.
 */
export function SampleEventSwitch({ initial }: { initial: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pick = (key: string) => {
    const previous = mode;
    setMode(key as Mode);
    setNote(null);
    start(async () => {
      const res = await setSampleEventSwitch(key);
      if (res.ok) {
        setNote({ tone: 'ok', text: 'Saved.' });
      } else {
        setMode(previous);
        setNote({ tone: 'error', text: res.message });
      }
    });
  };

  return (
    <div className="space-y-2" data-sample-event-switch="">
      <span className="block text-xs font-medium text-ink/70">The sample at /sample</span>
      <PickMenu
        label="The sample at /sample"
        value={mode}
        options={OPTIONS}
        onPick={pick}
        dataAttr="data-sample-event-mode"
        className="w-full !min-h-11"
      />
      <p className="text-xs text-ink/60" aria-live="polite">
        {pending ? 'Saving…' : note ? (
          <span className={note.tone === 'error' ? 'text-danger-700' : undefined}>{note.text}</span>
        ) : null}
      </p>
    </div>
  );
}
