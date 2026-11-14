'use client';

/**
 * The "Book a past supplier again" ask — two ▾ picks and one Request (design template 14 Nov 2026, rule 4: a pick is
 * the ▾ that opens its choices, never a native dropdown; rule 3: the shared button). The picks post through hidden
 * inputs, so the form and its server action are exactly as before; Request waits until both are chosen, which the
 * native `required` used to enforce.
 */
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { requestVendorReuseForm } from '../_actions/reuse-actions';

export function ReuseRequestForm({
  sources,
  targets,
}: {
  sources: { id: string; label: string }[];
  targets: { id: string; label: string }[];
}) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  return (
    <form action={requestVendorReuseForm} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="source_event_vendor_id" value={source} />
      <input type="hidden" name="target_event_id" value={target} />
      <PickMenu
        label="Past supplier"
        value={source || null}
        options={sources.map((s) => ({ key: s.id, label: s.label }))}
        onPick={setSource}
        buttonText={source ? undefined : 'Choose a past supplier'}
        dataAttr="data-reuse-source"
        className="w-full !min-h-11"
      />
      <PickMenu
        label="For which event"
        value={target || null}
        options={targets.map((t) => ({ key: t.id, label: t.label }))}
        onPick={setTarget}
        buttonText={target ? undefined : 'For which event'}
        dataAttr="data-reuse-target"
        className="w-full !min-h-11"
      />
      <ActionButton tone="brand" main type="submit" icon={RefreshCw} label="Request" disabled={!source || !target} />
    </form>
  );
}
