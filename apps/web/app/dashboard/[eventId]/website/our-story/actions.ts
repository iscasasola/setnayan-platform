'use server';

/**
 * Server action for the Our Story editor — the post-onboarding doorway for
 * events.love_story (the wayfinding fix: onboarding's "Add it later" finally
 * has a later; owner 2026-07-23, corpus DECISION_LOG).
 *
 * Writes the SAME v2 LoveStory JSONB the onboarding love stage commits
 * (app/onboarding/wedding/types.ts LoveStory — spark/obstacle/proposal braid,
 * anchors{}, milestones[]), read by composeOurStory (app/[slug]/_components/
 * our-story.tsx) on STD/RSVP/Event and reused downstream (kept story-shaped —
 * the covert naming rule from the onboarding types holds here too).
 *
 * MERGE, never clobber: keys this form doesn't edit (spark_anchor, plus any
 * future additions) are preserved from the stored blob. Milestones are
 * replaced wholesale from the repeater rows and auto-sorted chronologically
 * (the canonical "auto-sorted" behavior from the type doc). Runs with the
 * host's JWT — couple_can_update_event RLS is the gate (mirrors
 * updateSpecialMessage). NOT gated on the home_activity_signals privacy
 * control: that control governs covert signal COLLECTION at onboarding; this
 * is the couple explicitly authoring their own public website section (like
 * special_message, which has no such gate). Surfaced for DPO visibility in
 * the corpus DECISION_LOG row.
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const FIELD_MAX = 600;
const SHORT_MAX = 120;
const YEAR_MAX = 12;

/** The scalar LoveStory keys this form edits, all trimmed + length-capped. */
const TEXT_FIELDS = [
  'how_we_met',
  'spark',
  'spark_why',
  'obstacle',
  'obstacle_kept',
  'proposal',
  'proposal_feel',
] as const;
const SHORT_FIELDS = ['together_since', 'proposal_setting', 'obstacle_kind', 'proposal_voice'] as const;
const YEAR_FIELDS = ['met_year', 'proposal_year'] as const;
const ANCHOR_KEYS = ['song', 'place', 'injoke', 'food'] as const;

function str(v: FormDataEntryValue | null, max: number): string {
  return (typeof v === 'string' ? v.trim() : '').slice(0, max);
}

type MilestoneRow = { year: string; month?: string; day?: string; title: string };

function readMilestones(formData: FormData): MilestoneRow[] {
  const years = formData.getAll('ms_year');
  const months = formData.getAll('ms_month');
  const days = formData.getAll('ms_day');
  const titles = formData.getAll('ms_title');
  const rows: MilestoneRow[] = [];
  for (let i = 0; i < years.length; i++) {
    const year = str(years[i] ?? null, 4);
    const title = str(titles[i] ??
      null, SHORT_MAX);
    if (!year || !title) continue; // a row needs at least a year + a title
    const month = str(months[i] ?? null, 2);
    const day = str(days[i] ?? null, 2);
    rows.push({ year, ...(month ? { month } : {}), ...(day ? { day } : {}), title });
  }
  // Cap the timeline (a couple can't balloon their own blob into every /[slug] render).
  if (rows.length > 100) rows.length = 100;
  // Auto-sorted chronologically — the canonical milestones behavior.
  rows.sort(
    (a, b) =>
      Number(a.year) - Number(b.year) ||
      Number(a.month ?? 0) - Number(b.month ?? 0) ||
      Number(a.day ?? 0) - Number(b.day ?? 0),
  );
  return rows;
}

export async function updateOurStory(eventId: string, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Read the stored blob first so unedited/unknown keys survive the merge.
  const { data: current } = await supabase
    .from('events')
    .select('love_story')
    .eq('event_id', eventId)
    .maybeSingle();
  const existing =
    current?.love_story && typeof current.love_story === 'object'
      ? (current.love_story as Record<string, unknown>)
      : {};
  const existingAnchors =
    existing.anchors && typeof existing.anchors === 'object'
      ? (existing.anchors as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = { ...existing };
  for (const key of TEXT_FIELDS) merged[key] = str(formData.get(key), FIELD_MAX);
  for (const key of SHORT_FIELDS) merged[key] = str(formData.get(key), SHORT_MAX);
  for (const key of YEAR_FIELDS) merged[key] = str(formData.get(key), YEAR_MAX);
  merged.anchors = {
    ...existingAnchors,
    ...Object.fromEntries(ANCHOR_KEYS.map((k) => [k, str(formData.get(`anchor_${k}`), SHORT_MAX)])),
  };
  merged.milestones = readMilestones(formData);

  // together_since is DUAL-STORED: onboarding writes both the blob and the
  // events.together_since column, and public readers PREFER the column
  // (editorial data.ts, event-brief). Keep both in sync or edits are no-ops.
  const togetherSince = str(formData.get('together_since'), SHORT_MAX);

  const { data: event, error } = await supabase
    .from('events')
    .update({ love_story: merged, together_since: togetherSince || null })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  // A 0-row update (RLS-blocked or wrong event) surfaces as !event with no
  // error — treat it as a failure, never a false "Saved".
  if (error || !event) {
    redirect(
      `/dashboard/${eventId}/website/our-story?error=${encodeURIComponent(
        'Could not save your story. Please try again.',
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/website`);
  if (event.slug) revalidatePath(`/${event.slug}`);
  redirect(`/dashboard/${eventId}/website/our-story?saved=1`);
}
