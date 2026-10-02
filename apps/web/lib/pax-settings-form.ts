/**
 * The form half of `updatePaxSettings`: what a posted form says about the two
 * columns it writes TOGETHER (`events.guest_list_edit_deadline` and
 * `events.adaptive_pricing_mode`).
 *
 * Because the action always writes both, every form that posts to it must
 * carry both. A form that shows only one of them (Event settings shows only
 * "How you see costs"; the date is the RSVP item's "Reply by", 2026-10-02)
 * carries the other as a hidden value. Otherwise saving the cost view would
 * blank the deadline: an empty deadline here means "clear it", back to the
 * automatic 14 days before the event. Held by
 * `app/dashboard/[eventId]/details/_components/the-settings-card-keeps-the-deadline.test.ts`.
 *
 * Pure (no I/O), so a test can feed it the exact fields a rendered card submits.
 */
export type PaxSettingsForm =
  | { ok: true; deadline: string | null; mode: 'realtime' | 'final_only' }
  | { ok: false; message: string };

export function parsePaxSettingsForm(formData: FormData): PaxSettingsForm {
  // Deadline: empty clears it (back to the auto default); else a valid ISO date.
  const raw = formData.get('guest_list_edit_deadline');
  const deadlineRaw = typeof raw === 'string' ? raw.trim() : '';
  let deadline: string | null = null;
  if (deadlineRaw !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw) || Number.isNaN(Date.parse(`${deadlineRaw}T00:00:00Z`))) {
      return { ok: false, message: 'Enter a valid date.' };
    }
    deadline = deadlineRaw;
  }
  const mode = formData.get('adaptive_pricing_mode') === 'final_only' ? 'final_only' : 'realtime';
  return { ok: true, deadline, mode };
}
