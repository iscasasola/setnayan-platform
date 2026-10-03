'use client';

import { useEffect, useRef, useState } from 'react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * card-fields.tsx — the guest card's dropdowns, inside its autosaving form
 * (owner 2026-09-30, `prototypes/guest_card_details_2026-09-30_fable.html`:
 * "One choice = one dropdown. Several choices = a dropdown with checkmarks").
 *
 * 🔑 EVERY DROPDOWN IS THE ONE SHIPPED `PickMenu` — never a native select, never
 * a row of pills. `PickMenu` is a button and a list, so it posts nothing by
 * itself: `FormPick` pairs it with ONE hidden input carrying the value (a
 * checkmark dropdown carries its picks comma-joined, so the autosave's undo —
 * which restores one value per named input — puts it back whole).
 *
 * The autosave form listens for `input`/`change`; a hidden input fires neither
 * when a script sets it, so a pick dispatches them itself. `change` also reaches
 * `InvitedToChips`, which snaps "Invited to" when the Role changes (as today).
 * An undo writes the hidden input back and fires `sn-restore`, and the button
 * re-reads it — so the screen shows what the row holds again.
 */
export function FormPick({
  name,
  label,
  value,
  options,
  multi = false,
  emptyText = 'None',
  dataAttr,
}: {
  /** The column the hidden input posts (`side`, `role`, `extra_roles` …). */
  name: string;
  /** What the control is — the words above it, and the screen reader's name. */
  label: string;
  /** The current value; for `multi`, the picked keys comma-joined. */
  value: string;
  options: readonly PickOption[];
  /** A dropdown with checkmarks: ticks stay, the list stays open until Done. */
  multi?: boolean;
  /** The button's words when a checkmark dropdown has nothing ticked. */
  emptyText?: string;
  dataAttr?: string;
}) {
  const [current, setCurrent] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  // A fresh server value (a save landed, the row was edited elsewhere) moves the
  // button AND the posted value — a stale hidden input would post the old one back.
  useEffect(() => {
    setCurrent(value);
    if (ref.current) ref.current.value = value;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reread = () => setCurrent(el.value);
    el.addEventListener('sn-restore', reread);
    return () => el.removeEventListener('sn-restore', reread);
  }, []);

  const picked = multi ? current.split(',').filter(Boolean) : undefined;

  const pick = (key: string) => {
    let next = key;
    if (multi) {
      const set = new Set(picked);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      // In the list's own order, so the posted value does not depend on tap order.
      next = options.map((o) => o.key).filter((k) => set.has(k)).join(',');
    }
    if (next === current) return;
    setCurrent(next);
    const el = ref.current;
    if (!el) return;
    el.value = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const multiText = picked
    ? options
        .filter((o) => picked.includes(o.key))
        .map((o) => o.label)
        .join(', ') || emptyText
    : undefined;

  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">{label}</span>
      <PickMenu
        label={label}
        value={multi ? null : current}
        options={options}
        onPick={pick}
        picked={picked}
        buttonText={multiText}
        dataAttr={dataAttr}
        className="w-full justify-between border border-ink/15 !bg-white/80 font-medium"
      />
      {/* 🔴 CONTROLLED — `value={current}`, NEVER `defaultValue={value}`
          (owner, live iPhone test 2026-10-02: the card's Reply set to "No reply"
          saved as "Attending" while `updated_at` moved). On a hidden input the
          default IS the value, and React re-applies `defaultValue` on every
          re-render (react-dom `updateInput` → `setDefaultValue`). So the
          re-render that `setCurrent` itself causes put the SERVER's old value
          back into the input before the autosave read the form — every
          dropdown on the card posted what it already was. Driven by `current`,
          a re-render writes the picked value instead. */}
      <input ref={ref} type="hidden" id={name} name={name} value={current} data-form-pick="" />
    </div>
  );
}
