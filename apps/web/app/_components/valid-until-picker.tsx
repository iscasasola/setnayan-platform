'use client';

/**
 * 📅 VALID UNTIL — the one picker every quote surface uses (Supplier Build 3 · lane B; DECISION_LOG 📅 2026-11-09).
 *
 * One dropdown: 7 days · 14 days · 30 days · Pick a date, NONE preselected; a choice past the event is not offered.
 * "Pick a date" opens the shipped `DateRow` calendar (no raw date input, no new picker). The form carries the REAL
 * date in a hidden `name` field, and the line under it says it in words ("Valid until Nov 23").
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { DateRow } from '@/app/_components/form-row-date';
import {
  addDaysIso,
  validUntilChoices,
  validUntilWords,
  type ValidUntilChoiceKey,
} from '@/lib/quote-valid-until';

export function ValidUntilPicker({
  name = 'valid_until',
  todayIso,
  eventDate,
  initial = null,
  onChange,
}: {
  name?: string;
  todayIso: string;
  eventDate: string | null;
  /** A draft's own saved date, if any (never a default). */
  initial?: string | null;
  /** A composer that holds the date in its own state hears every change (the real date, or null). */
  onChange?: (iso: string | null) => void;
}) {
  const choices = useMemo(() => validUntilChoices(todayIso, eventDate), [todayIso, eventDate]);
  const [key, setKey] = useState<ValidUntilChoiceKey | ''>(() => {
    if (!initial) return '';
    return choices.find((c) => c.date === initial)?.key ?? 'pick';
  });
  const [picked, setPicked] = useState<string | null>(initial);
  const value = key === 'pick' ? picked : (choices.find((c) => c.key === key)?.date ?? null);
  const said = useRef<string | null>(initial);
  useEffect(() => {
    if (value === said.current) return;
    said.current = value;
    onChange?.(value);
  }, [value, onChange]);

  return (
    <div className="grid gap-1.5" data-valid-until="">
      <PickMenu
        label="Valid until"
        value={key}
        options={choices.map((c) => ({ key: c.key, label: c.label }))}
        onPick={(k) => setKey(k as ValidUntilChoiceKey)}
        buttonText={key ? undefined : 'How long is it valid?'}
        dataAttr="valid-until"
      />
      {key === 'pick' ? (
        <DateRow
          name={`${name}_pick`}
          value={picked}
          today={todayIso}
          min={addDaysIso(todayIso, 1)}
          max={eventDate}
          onKeep={(day) => {
            setPicked(day);
          }}
        />
      ) : null}
      <input type="hidden" name={name} value={value ?? ''} />
      <p className="text-[13px] text-ink/60" aria-live="polite">
        {value ? validUntilWords(value) : 'A quote needs a Valid until before it can be sent.'}
      </p>
    </div>
  );
}
