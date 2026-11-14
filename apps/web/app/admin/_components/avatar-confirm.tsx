'use client';

/**
 * The avatar screens' confirm step (drawing: `P(id,{kind:'confirm', …})`) on the house pieces only:
 *
 *  · `ConfirmButton` — ONE button (T19, `ActionButton`) that posts its `<form>` only after the house `ConfirmDialog`
 *    has named what happens (the house `ConfirmForm`'s two-step, which also posts to a route). For a switch that changes Setnayan for everyone, or anything that cannot
 *    be undone.
 *  · `ConfirmPick` — the one selector (`PickMenu`) for a three-way switch (the AI paywall: env default · on · off);
 *    picking a choice opens the confirm for THAT choice, and only Confirm posts it. Cancel leaves the picker on what
 *    is saved.
 *
 * Both post to the SAME server actions the old pages posted to — nothing new is written, nothing is saved twice.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Check, Lock, Pause, Play, RotateCw, Rocket, Trash2, Undo2, X, Zap } from 'lucide-react';

import { ActionButton, type ActionTone } from '@/components/action-button';
import { ConfirmDialog } from '@/app/_components/confirm-dialog';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

const ICONS = { check: Check, lock: Lock, pause: Pause, play: Play, refresh: RotateCw, rocket: Rocket, trash: Trash2, undo: Undo2, x: X, bolt: Zap } as const;
export type AvatarIcon = keyof typeof ICONS;

export function ConfirmButton({
  action,
  fields = {},
  label,
  tone,
  icon,
  main = false,
  title,
  body,
  confirmLabel,
  destructive = false,
  disabled = false,
  data,
}: {
  /** A server action, or a route that takes a POST (the demo-mode toggle). */
  action: ((formData: FormData) => void | Promise<void>) | string;
  /** Hidden fields posted with the form. */
  fields?: Readonly<Record<string, string>>;
  label: string;
  tone: ActionTone;
  icon: AvatarIcon;
  main?: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  data?: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  return (
    <form
      ref={formRef}
      action={action}
      method={typeof action === 'string' ? 'post' : undefined}
      onSubmit={(e) => {
        // The first press asks; only Confirm lets the post through (the house ConfirmForm's two-step, for a route too).
        if (confirmed.current) {
          confirmed.current = false;
          return;
        }
        e.preventDefault();
        setOpen(true);
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ActionButton type="submit" tone={tone} icon={ICONS[icon]} label={label} main={main} disabled={disabled} data-avatar-confirm={data ?? ''} />
      <ConfirmDialog
        open={open}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        destructive={destructive}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          confirmed.current = true;
          queueMicrotask(() => formRef.current?.requestSubmit());
        }}
      />
    </form>
  );
}

export type ConfirmChoice = {
  key: string;
  label: string;
  hint?: string;
  /** The confirm this choice opens. */
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
};

export function ConfirmPick({
  action,
  fieldName,
  fields = {},
  label,
  value,
  choices,
  disabled = false,
  data,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** The posted name of the choice. */
  fieldName: string;
  fields?: Readonly<Record<string, string>>;
  label: string;
  /** What is saved now. */
  value: string;
  choices: readonly ConfirmChoice[];
  disabled?: boolean;
  data?: string;
}) {
  const [asked, setAsked] = useState<ConfirmChoice | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const choiceRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={action} data-avatar-pick={data ?? ''}>
      {Object.entries(fields).map(([name, v]) => (
        <input key={name} type="hidden" name={name} value={v} />
      ))}
      <input ref={choiceRef} type="hidden" name={fieldName} defaultValue={value} />
      <PickMenu
        label={label}
        value={value}
        options={choices.map((c) =>
          disabled ? { key: c.key, label: c.label, disabledNote: 'Couldn’t read what is saved, so switching is off until it loads.' } : { key: c.key, label: c.label, hint: c.hint },
        )}
        onPick={(key) => {
          if (disabled || key === value) return;
          setAsked(choices.find((c) => c.key === key) ?? null);
        }}
        className="!min-h-11 w-full sm:w-auto"
      />
      <ConfirmDialog
        open={asked !== null}
        title={asked?.title ?? ''}
        body={asked?.body ?? null}
        confirmLabel={asked?.confirmLabel ?? 'Confirm'}
        destructive={asked?.destructive ?? false}
        onCancel={() => setAsked(null)}
        onConfirm={() => {
          const chosen = asked;
          setAsked(null);
          if (!chosen || !choiceRef.current) return;
          choiceRef.current.value = chosen.key;
          queueMicrotask(() => formRef.current?.requestSubmit());
        }}
      />
    </form>
  );
}
