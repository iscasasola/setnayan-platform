'use client';

import { useState } from 'react';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import { AUTO_AGREE_CHOICES } from '@/lib/supplier-schedule';
import { resolveScheduleSuggestion } from '@/app/dashboard/[eventId]/schedule/actions';

/**
 * 🤝 AUTO-AGREE — the host's one setting for supplier changes (owner 2026-10-03, DECISION_LOG "ONE HOST APPROVAL SETTING
 * COVERS ALL SUPPLIER REQUESTS" · "THE HOST APPROVAL SETTING STARTS ON 'I CHECK AND APPROVE / REJECT'"; ruled again
 * 2026-11-01, "SCHEDULE PLAN §9" item 4: Auto-agree starts Off). "I check and approve / reject" (the default) or
 * "Auto-agree": a supplier's add · edit · delete · times on the schedule go straight in.
 *
 * Where: the plan's "Event Details › Privacy" — Event Details has no Privacy group, so it sits in Event access, the one
 * place the host sets who may change what (owner 2026-10-03). A dropdown (any set of choices is one PickMenu); it saves
 * the moment it is picked and the screen stays (a save never resets the screen). `autoAgree` null = the setting could
 * not be read — said, never drawn as Off.
 */
export function SupplierChangesRow({ eventId, autoAgree }: { eventId: string; autoAgree: boolean | null }) {
  const [value, setValue] = useState<'check' | 'auto' | null>(autoAgree === null ? null : autoAgree ? 'auto' : 'check');
  const [problem, setProblem] = useState<string | null>(autoAgree === null ? 'This setting couldn’t be read — pick one to set it.' : null);
  return (
    <FormRows width="wide" data="supplier-changes">
      <ChosenRow
        name="Supplier changes"
        about={{
          words:
            'When a booked supplier adds, changes or deletes their part of the schedule. “I check and approve / reject” waits for you or your coordinator; “Auto-agree” puts it straight in.',
        }}
        value={value}
        options={AUTO_AGREE_CHOICES.map((c) => ({ key: c.value, label: c.label }))}
        buttonText={value === null ? 'Not read' : undefined}
        onPick={async (k) => {
          const next = k === 'auto' ? 'auto' : 'check';
          const before = value;
          setValue(next);
          setProblem(null);
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('decision', 'auto_agree');
          fd.set('auto_agree', next === 'auto' ? '1' : '0');
          try {
            await resolveScheduleSuggestion(fd);
          } catch {
            setValue(before);
            setProblem('That didn’t save — try again.');
          }
        }}
        problem={problem}
        data="supplier-changes-auto-agree"
      />
    </FormRows>
  );
}
