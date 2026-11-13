'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * 📲 "When do they show?" — Right away · After I check (guest upload v2, approved 2026-11-13). The control POSTS the
 * value it WANTS, never a flip of what it read (the house rule for two-state choices — `uploads-open-choice.tsx`).
 */
export function PhoneUploadsHeldPicker({ eventId, held: heldAtOpen }: { eventId: string; held: boolean }) {
  const router = useRouter();
  const [held, setHeld] = useState(heldAtOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/papic/phone-uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'set_held', event_id: eventId, held }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; words?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.words ?? 'Couldn’t save that — try again.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Couldn’t save that — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const pill = (value: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={held === value}
      onClick={() => {
        setHeld(value);
        setSaved(false);
      }}
      className={`min-h-11 flex-1 rounded-full px-4 text-[14px] font-semibold transition-colors ${
        held === value ? 'bg-ink text-cream' : 'text-ink/70'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3" data-phone-uploads-picker="">
      <p className="text-[13px] font-semibold text-ink/70">When do they show?</p>
      <div className="flex gap-1 rounded-full border border-ink/15 p-1" role="group" aria-label="When do they show?">
        {pill(false, 'Right away')}
        {pill(true, 'After I check')}
      </div>
      <p className="text-sm text-ink/65">
        {held
          ? 'A guest’s photo waits, out of sight, until you check it. You check them when you publish your Recap — keep each one, or leave it out. Nothing from a guest’s phone shows before that.'
          : 'A guest’s photo lands in your Memories the moment it’s sent, like a camera shot. You can still take one down later.'}
      </p>
      <p className="text-[13px] text-ink/55">Your guests’ camera shots are not changed by this.</p>
      {error ? (
        <p className="text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-success-700" role="status">
          {held ? 'Saved · guests’ phone photos wait for your check' : 'Saved · guests’ phone photos show right away'}
        </p>
      ) : null}
      <ActionButton
        tone="brand"
        main
        icon={saving ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : Check}
        label={saving ? 'Saving…' : 'Save'}
        waiting={saving}
        disabled={saving || (held === heldAtOpen && !saved)}
        onClick={() => void save()}
      />
    </div>
  );
}
