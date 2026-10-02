'use client';

/**
 * pickers.tsx — every set of choices on "Categories & event types" is ONE
 * PickMenu dropdown (owner, 2026-09-28: "if there are choices, again. us drop
 * down menu"). These wrap the shipped PickMenu around the shipped server
 * actions; none of them adds a write of its own.
 *
 *   SavePick        one value → posts it (Status ▾, Category ▾, Icon ▾ …)
 *   ListPick        several values → posts the whole list on every tick
 *                   (Asked on ▾, Also listed under ▾, Shows for ▾ …)
 *   TogglePick      several values, one action PER TICK (a category offered /
 *                   hidden for an event type; a service only for a religion)
 *   NavPick         a choice that is an address (the title dropdown, Show ▾)
 *
 * A pick submits at once. The action redirects back to the same panel, and
 * the server page re-renders with the saved value — nothing is optimistic.
 */
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';

type FormAction = (formData: FormData) => unknown;

export type Choice = { key: string; label: string; group?: string; hint?: string; icon?: ReactNode; disabledNote?: string };

function formOf(hidden: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
  return fd;
}

function toOptions(choices: readonly Choice[]): PickOption[] {
  return choices.map((c) => ({
    key: c.key,
    label: c.label,
    group: c.group,
    hint: c.hint,
    icon: c.icon,
    disabledNote: c.disabledNote,
  }));
}

/** One value, saved the moment it is picked. */
export function SavePick({
  label,
  value,
  choices,
  action,
  field,
  hidden = {},
  buttonText,
  compact = true,
}: {
  label: string;
  value: string;
  choices: readonly Choice[];
  action: FormAction;
  field: string;
  hidden?: Record<string, string>;
  buttonText?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <span className={pending ? 'opacity-60' : undefined} data-save-pick={field}>
      <PickMenu
        label={label}
        value={value}
        options={toOptions(choices)}
        buttonText={pending ? 'Saving…' : buttonText}
        compact={compact}
        className="border border-ink/15"
        onPick={(key) => {
          if (key === value) return;
          const fd = formOf(hidden);
          fd.set(field, key);
          start(async () => {
            await action(fd);
          });
        }}
      />
    </span>
  );
}

/** Several values; every tick posts the whole new list under `field`. */
export function ListPick({
  label,
  picked,
  choices,
  action,
  field,
  hidden = {},
  buttonText,
}: {
  label: string;
  picked: readonly string[];
  choices: readonly Choice[];
  action: FormAction;
  field: string;
  hidden?: Record<string, string>;
  buttonText: string;
}) {
  const [pending, start] = useTransition();
  const [now, setNow] = useState<string[]>([...picked]);
  return (
    <span className={pending ? 'opacity-60' : undefined} data-list-pick={field}>
      <PickMenu
        label={label}
        value=""
        picked={now}
        options={toOptions(choices)}
        buttonText={pending ? 'Saving…' : buttonText}
        compact
        className="border border-ink/15"
        onPick={(key) => {
          const next = now.includes(key) ? now.filter((k) => k !== key) : [...now, key];
          setNow(next);
          const fd = formOf(hidden);
          for (const k of next) fd.append(field, k);
          start(async () => {
            await action(fd);
          });
        }}
      />
    </span>
  );
}

/**
 * Several values, but the action takes ONE at a time: a tick posts
 * `{ [keyField]: key, [onField]: on ? onValue : offValue }`.
 */
export function TogglePick({
  label,
  picked,
  choices,
  action,
  keyField,
  onField,
  onValue = '1',
  offValue = '0',
  hidden = {},
  buttonText,
}: {
  label: string;
  picked: readonly string[];
  choices: readonly Choice[];
  action: FormAction;
  keyField: string;
  onField: string;
  onValue?: string;
  offValue?: string;
  hidden?: Record<string, string>;
  buttonText: string;
}) {
  const [pending, start] = useTransition();
  const [now, setNow] = useState<string[]>([...picked]);
  return (
    <span className={pending ? 'opacity-60' : undefined} data-toggle-pick={keyField}>
      <PickMenu
        label={label}
        value=""
        picked={now}
        options={toOptions(choices)}
        buttonText={pending ? 'Saving…' : buttonText}
        compact
        className="border border-ink/15"
        onPick={(key) => {
          const on = !now.includes(key);
          setNow(on ? [...now, key] : now.filter((k) => k !== key));
          const fd = formOf(hidden);
          fd.set(keyField, key);
          fd.set(onField, on ? onValue : offValue);
          start(async () => {
            await action(fd);
          });
        }}
      />
    </span>
  );
}

/** A choice that is an ADDRESS — the page's title dropdown and Show ▾. */
export function NavPick({
  label,
  value,
  choices,
  hrefs,
  compact = false,
  buttonText,
}: {
  label: string;
  value: string;
  choices: readonly Choice[];
  hrefs: Record<string, string>;
  compact?: boolean;
  buttonText?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className={pending ? 'opacity-60' : undefined} data-nav-pick={label}>
      <PickMenu
        label={label}
        value={value}
        options={toOptions(choices)}
        compact={compact}
        buttonText={buttonText}
        className="border border-ink/15"
        onPick={(key) => {
          const href = hrefs[key];
          if (href) start(() => router.push(href));
        }}
      />
    </span>
  );
}

/**
 * A choice INSIDE a form that saves with its own button (a deadline's unit, a
 * celebrant shape, a "What to expect" dimension): the PickMenu keeps a hidden
 * input current and posts nothing by itself. `form` ties the input to a form
 * elsewhere on the page (the event type's profile form spans four sections).
 */
export function FieldPick({
  label,
  name,
  defaultValue,
  choices,
  form,
}: {
  label: string;
  name: string;
  defaultValue: string;
  choices: readonly Choice[];
  form?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <span data-field-pick={name}>
      <input type="hidden" name={name} value={value} form={form} />
      <PickMenu
        label={label}
        value={value}
        options={toOptions(choices)}
        onPick={setValue}
        compact
        className="border border-ink/15"
      />
    </span>
  );
}
