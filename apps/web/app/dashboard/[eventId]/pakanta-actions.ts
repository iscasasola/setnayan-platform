/**
 * Pakanta wizard card · server actions.
 *
 * Iteration 0036 Pakanta · Wizard Card 17 (order 9.7 · style_identity phase).
 *
 * Owner directive 2026-05-25 (CLAUDE.md decision-log) · the wizard card
 * collects an 8-question intake BEFORE the host commits to a Pakanta
 * tier. Both CTAs persist the same draft row in `pakanta_intake_drafts`
 * keyed by event_id:
 *
 *   [Skip for now]   → saves draft · marks wizard task in_flight · host
 *                       stays on event home · the row surfaces in the
 *                       IN-FLIGHT TRAY for later return.
 *   [Lock in Pakanta — ₱1,999]
 *                    → saves draft with status='purchase_pending' · marks
 *                       wizard task in_flight (commit lands when the
 *                       order is paid) · returns redirect URL to
 *                       /dashboard/[eventId]/orders/new?service=pakanta_basic
 *
 * Sibling file to wizard-actions.ts to keep that file from growing past
 * 1500 lines · the existing markTaskInFlight/markTaskDone primitives are
 * reused by composition.
 *
 * Per [[feedback_setnayan_orphan_prevention]] · both actions are consumed
 * by the inline PakantaIntakeForm client component.
 *
 * Per [[feedback_setnayan_document_changes_with_why]] · the table this
 * writes to lives in supabase/migrations/20260625000000_iteration_0036_
 * pakanta_intake_drafts.sql · status enum + RLS + WHY all there.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  parseWizardState,
  type WizardState,
  type WizardTaskId,
} from '@/lib/wizard';

/**
 * Local copy of the wizard_state merge helper that lives privately in
 * wizard-actions.ts. Inlined here (vs imported) because wizard-actions.ts
 * exports `'use server'` actions only · its module-internal helpers
 * cannot be re-exported. Same shape · same semantics.
 */
function setTaskInFlight(
  prior: WizardState,
  taskId: WizardTaskId,
  extra: Record<string, unknown> = {},
): WizardState {
  const priorEntry = prior[taskId] ?? {};
  return {
    ...prior,
    [taskId]: {
      ...priorEntry,
      ...extra,
      in_flight_since: new Date().toISOString(),
    },
  };
}

export type PakantaIntakeResponses = {
  how_you_met: string;
  engagement_story: string;
  memorable_story: string;
  pet_names: string;
  story_to_add: string;
  groom_favorite_singer: string;
  bride_favorite_singer: string;
  music_type: string;
};

export type SavePakantaIntakeResult =
  | { ok: true; redirectTo: string | null }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof PakantaIntakeResponses, string>> };

// Story fields require ≥10 chars per owner spec quality bar — short enough
// to land "we met last year" without forcing essays, long enough to filter
// blank/space-only submissions. Singer + music-type are single-line so we
// only require non-empty trimmed strings.
const STORY_MIN_LEN = 10;
const STORY_FIELDS: ReadonlyArray<keyof PakantaIntakeResponses> = [
  'how_you_met',
  'engagement_story',
  'memorable_story',
  'pet_names',
  'story_to_add',
];
const SINGLE_LINE_FIELDS: ReadonlyArray<keyof PakantaIntakeResponses> = [
  'groom_favorite_singer',
  'bride_favorite_singer',
  'music_type',
];

function readResponses(
  formData: FormData,
): {
  responses: PakantaIntakeResponses;
  fieldErrors: Partial<Record<keyof PakantaIntakeResponses, string>>;
} {
  function readField(name: keyof PakantaIntakeResponses): string {
    const raw = formData.get(name);
    return typeof raw === 'string' ? raw.trim() : '';
  }

  const responses: PakantaIntakeResponses = {
    how_you_met: readField('how_you_met'),
    engagement_story: readField('engagement_story'),
    memorable_story: readField('memorable_story'),
    pet_names: readField('pet_names'),
    story_to_add: readField('story_to_add'),
    groom_favorite_singer: readField('groom_favorite_singer'),
    bride_favorite_singer: readField('bride_favorite_singer'),
    music_type: readField('music_type'),
  };

  const fieldErrors: Partial<Record<keyof PakantaIntakeResponses, string>> = {};
  for (const field of STORY_FIELDS) {
    if (responses[field].length < STORY_MIN_LEN) {
      fieldErrors[field] = `Please share at least ${STORY_MIN_LEN} characters.`;
    }
  }
  for (const field of SINGLE_LINE_FIELDS) {
    if (responses[field].length === 0) {
      fieldErrors[field] = 'Please fill this in.';
    }
  }

  return { responses, fieldErrors };
}

/**
 * Save the host's 8-question Pakanta intake. `intent='skip'` saves the
 * draft + marks the wizard task in_flight so the host can revisit later.
 * `intent='purchase'` saves with status='purchase_pending' AND returns a
 * redirect URL to the orders/new page pre-filling the Basic tier SKU.
 */
export async function savePakantaIntake(
  formData: FormData,
): Promise<SavePakantaIntakeResult> {
  const eventIdRaw = formData.get('event_id');
  const intentRaw = formData.get('intent');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { ok: false, error: 'event_id required' };
  }
  if (intentRaw !== 'skip' && intentRaw !== 'purchase') {
    return { ok: false, error: 'intent must be skip or purchase' };
  }
  const intent = intentRaw;

  const { responses, fieldErrors } = readResponses(formData);

  // On Skip we still require ≥1 question with real content so the draft
  // is meaningful (no all-blank rows); the owner spec doesn't make Skip
  // a zero-validation path — it's "Save & continue later", not "Cancel".
  if (intent === 'skip') {
    const anyContent =
      STORY_FIELDS.some((f) => responses[f].length > 0) ||
      SINGLE_LINE_FIELDS.some((f) => responses[f].length > 0);
    if (!anyContent) {
      return {
        ok: false,
        error: "Nothing saved yet — add a detail or two before stepping away.",
      };
    }
  } else {
    // Purchase intent · all 8 fields must validate.
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: 'Some answers need a little more.', fieldErrors };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Upsert keyed on event_id · matches the unique index on the table.
  // The host can re-submit to overwrite their draft without piling up
  // stale rows.
  const status = intent === 'purchase' ? 'purchase_pending' : 'draft';
  const { error: upsertErr } = await supabase
    .from('pakanta_intake_drafts')
    .upsert(
      {
        event_id: eventIdRaw,
        responses,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id' },
    );
  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  // Mark the wizard task in_flight either way · purchase advances when
  // the order is paid (handled by the existing orders flow's downstream
  // markTaskDone hook), skip advances on the host's next return when
  // they mark done from the IN-FLIGHT TRAY.
  const { data: priorRow, error: priorErr } = await supabase
    .from('events')
    .select('wizard_state')
    .eq('event_id', eventIdRaw)
    .maybeSingle();
  if (priorErr) {
    return { ok: false, error: priorErr.message };
  }
  if (!priorRow) {
    return { ok: false, error: 'Event not found' };
  }

  const priorWizardState = parseWizardState(priorRow.wizard_state);
  const newWizardState = setTaskInFlight(priorWizardState, 'pakanta', {
    last_saved_at: new Date().toISOString(),
    intent,
  });

  const { error: updateErr } = await supabase
    .from('events')
    .update({ wizard_state: newWizardState })
    .eq('event_id', eventIdRaw);
  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  revalidatePath(`/dashboard/${eventIdRaw}`, 'layout');

  const redirectTo =
    intent === 'purchase'
      ? `/dashboard/${eventIdRaw}/orders/new?service=pakanta_basic`
      : null;

  return { ok: true, redirectTo };
}
