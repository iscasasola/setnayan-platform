'use client';

import { useEffect, useRef, useState } from 'react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { splitGroup, splitRoles, tickGroup, tickRole } from '@/lib/guest-group-role-pick';

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
  unlisted,
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
  /** The button's words while the value is not one of the options (the Title's stored or pending pick). */
  unlisted?: { key: string; text: string };
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
        buttonText={multiText ?? (unlisted && current === unlisted.key ? unlisted.text : undefined)}
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

/**
 * 👥 ONE CHECKMARK LIST THAT POSTS TWO COLUMNS (owner 2026-10-20: *"there are 2 groups."* · *"Roles doesn't need also
 * serves as"* · *"several group, several roles"*; DECISION_LOG "GUEST CARD: ONE GROUP DROPDOWN AND ONE ROLE DROPDOWN, EACH
 * MULTI"). `kind` says what one tick means (`lib/guest-group-role-pick.ts`):
 *   · 'group' — `one` are the standard keys, ONE of them (→ `group_category`); the rest tick freely (→ `group_ids`);
 *   · 'role'  — the first ticked is the main role (→ `role`); the rest (→ `extra_roles`); `one` = the one-per-event roles.
 * The card's form contract is unchanged: the SAME two hidden inputs the two old dropdowns posted, controlled by state,
 * `data-form-pick` + `sn-restore` for the Undo, `input` + `change` raised on the one that moved (a Role change still snaps
 * "Invited to"). `names[1]` null → only the first column posts (the groups could not be read; nothing can unTick them).
 */
export function useSplitPick(
  kind: 'group' | 'role',
  names: readonly [string, string | null],
  value: string,
  one: readonly string[],
  order: readonly string[],
) {
  const keys = (v: string) => v.split(',').filter(Boolean);
  const [picked, setPickedState] = useState(() => keys(value));
  /* The picks as of NOW, for a tap that lands after an await (a group made in place comes back ticked). */
  const now = useRef(picked);
  const setPicked = (p: string[]) => {
    now.current = p;
    setPickedState(p);
  };
  const a = useRef<HTMLInputElement>(null);
  const b = useRef<HTMLInputElement>(null);
  const split = (p: readonly string[]) => (kind === 'group' ? splitGroup(p, one, order) : splitRoles(p));
  useEffect(() => {
    const p = keys(value);
    setPicked(p);
    const [x, y] = split(p);
    if (a.current) a.current.value = x;
    if (b.current) b.current.value = y;
    // `value` is the server's answer; `split` reads props that come with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => {
    const reread = () => setPicked(keys(`${a.current?.value ?? ''},${b.current?.value ?? ''}`));
    const els = [a.current, b.current];
    for (const el of els) el?.addEventListener('sn-restore', reread);
    return () => {
      for (const el of els) el?.removeEventListener('sn-restore', reread);
    };
  }, []);
  const pick = (key: string) => {
    const next = kind === 'group' ? tickGroup(now.current, key, one) : tickRole(now.current, key, one);
    setPicked(next);
    const [x, y] = split(next);
    for (const [el, v] of [[a.current, x], [b.current, y]] as const) {
      if (!el || el.value === v) continue;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  const [x, y] = split(picked);
  const inputs = (
    <>
      <input ref={a} type="hidden" id={names[0]} name={names[0]} value={x} data-form-pick="" />
      {names[1] ? <input ref={b} type="hidden" id={names[1]} name={names[1]} value={y} data-form-pick="" /> : null}
    </>
  );
  return { picked, pick, inputs };
}

/** The pill's words: the group list's ticks in the LIST's order, the role list's in TICK order (the main one first). */
export function splitPickText(kind: 'group' | 'role', picked: readonly string[], options: readonly PickOption[]): string {
  const label = (k: string) => options.find((o) => o.key === k)?.label;
  return (kind === 'group' ? options.filter((o) => picked.includes(o.key)).map((o) => o.label) : picked.map(label)).filter(Boolean).join(' · ');
}

/** The role list's options with the main one marked "main" (the prototype's A7). */
export function withMainMark(options: readonly PickOption[], main: string | undefined): PickOption[] {
  return options.map((o) => (o.key === main ? { ...o, trail: { text: 'main', tone: 'left' as const, label: 'main role' } } : o));
}

/** The hand-drawn card's (the Maker's) one Group / one Role dropdown — the shipped checkmark `PickMenu`. */
export function FormSplitPick({
  kind,
  label,
  names,
  value,
  options,
  one,
  emptyText = 'None',
  doneNote,
}: {
  kind: 'group' | 'role';
  label: string;
  names: readonly [string, string | null];
  value: string;
  options: readonly PickOption[];
  one: readonly string[];
  emptyText?: string;
  doneNote?: string;
}) {
  const { picked, pick, inputs } = useSplitPick(kind, names, value, one, options.map((o) => o.key));
  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">{label}</span>
      <PickMenu
        label={label}
        value={null}
        options={kind === 'role' ? withMainMark(options, picked[0]) : options}
        onPick={pick}
        picked={picked}
        buttonText={splitPickText(kind, picked, options) || emptyText}
        doneNote={doneNote}
        className="w-full justify-between border border-ink/15 !bg-white/80 font-medium"
      />
      {inputs}
    </div>
  );
}
