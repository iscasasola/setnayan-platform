/**
 * Card 17 · Pakanta · Style & Identity tier (order 9.7).
 *
 * Owner directive 2026-05-25 (CLAUDE.md decision-log) · inline 8-question
 * intake form ABOVE the Skip/Purchase CTAs · sample audio auto-plays
 * (muted, looping) at the top so the host can hear what their song
 * could feel like while they fill in the brief.
 *
 * Server component shell · reads any existing `pakanta_intake_drafts`
 * row for this event + pre-fills the client form so the host can return
 * to a partial draft without re-typing. Falls through to an empty form
 * when no draft exists.
 *
 * The form itself is a client component (sample audio + per-field
 * client-side validation feedback) — see ./pakanta-intake-form.tsx.
 *
 * Per [[feedback_setnayan_orphan_prevention]] · this card is wired into
 * the wizard-hero.tsx dispatcher at `case 'pakanta'`.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] · all copy uses
 * polite brand voice. Sample audio is a Setnayan-owned royalty-free
 * V1 placeholder (Bensound · CC license) · iteration 0036 swaps to
 * curated Suno-generated samples when the Suno API integration lands
 * V1.x. The placeholder is honest enough — short instrumental that
 * reads "wedding feel" without locking the host into a single style.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { PakantaIntakeForm } from './pakanta-intake-form';
import type { PakantaIntakeResponses } from '../../pakanta-actions';

type Props = { eventId: string };

type DraftRow = {
  responses: PakantaIntakeResponses | null;
  status: 'draft' | 'purchase_pending' | 'purchased' | null;
};

export async function PakantaCard({ eventId }: Props) {
  const admin = createAdminClient();
  const { data: draftRow } = await admin
    .from('pakanta_intake_drafts')
    .select('responses, status')
    .eq('event_id', eventId)
    .maybeSingle();

  const row = (draftRow as DraftRow | null) ?? null;
  const initialResponses: PakantaIntakeResponses | null = row?.responses ?? null;

  return (
    <PakantaIntakeForm
      eventId={eventId}
      initialResponses={initialResponses}
    />
  );
}
