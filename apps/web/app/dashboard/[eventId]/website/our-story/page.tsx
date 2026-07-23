import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BookHeart, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { updateOurStory } from './actions';
import { MilestonesField, type MilestoneRow } from './milestones-field';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Edit your story · Setnayan' };

/**
 * /dashboard/[eventId]/website/our-story — the post-onboarding love-story
 * editor (owner 2026-07-23). Onboarding's love stage says "Add it later";
 * this is the later. Edits the SAME events.love_story JSONB the wizard
 * commits; composeOurStory (app/[slug]/_components/our-story.tsx) weaves it
 * on Save-the-Date / RSVP / Event and renders nothing when it's empty.
 * Sibling of the special-message / dress-code editors.
 *
 * NOTE for the open-browse rebuild: the mirror manager's Story row
 * (Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md § 1.4)
 * should deep-link here.
 */

type LoveStoryBlob = Record<string, unknown> & {
  anchors?: Record<string, unknown>;
  milestones?: MilestoneRow[];
};

function s(blob: LoveStoryBlob, key: string): string {
  const v = blob[key];
  return typeof v === 'string' ? v : '';
}

const fieldCls =
  'mt-2 w-full rounded-lg border border-ink/15 bg-cream p-3 text-sm leading-relaxed text-ink focus:border-terracotta focus:outline-none';

function Field({
  label,
  name,
  value,
  placeholder,
  rows = 2,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="sn-eye">{label}</span>
      <textarea
        name={name}
        rows={rows}
        maxLength={600}
        defaultValue={value}
        placeholder={placeholder}
        className={fieldCls}
      />
      {hint ? <span className="mt-1 block text-xs text-ink/45">{hint}</span> : null}
    </label>
  );
}

export default async function OurStoryEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const [{ data: membership }, { data: event }] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select('event_id, display_name, slug, event_type, love_story')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (!event) redirect(`/dashboard/${eventId}`);
  // Couple-only, like the website hub (moderators are read-only on events —
  // the form would silently no-op for them). Wedding-only: the love stage is
  // the wedding wizard's; other event types have no story concept (the
  // wedding-chrome-fallthrough gotcha).
  if (membership?.member_type !== 'couple' || event.event_type !== 'wedding') {
    redirect(`/dashboard/${eventId}/website`);
  }

  const story: LoveStoryBlob =
    event.love_story && typeof event.love_story === 'object'
      ? (event.love_story as LoveStoryBlob)
      : {};
  const anchors = (story.anchors ?? {}) as Record<string, unknown>;
  const anchor = (k: string) => (typeof anchors[k] === 'string' ? (anchors[k] as string) : '');
  const milestones: MilestoneRow[] = Array.isArray(story.milestones)
    ? story.milestones.filter(
        (m): m is MilestoneRow =>
          !!m && typeof m === 'object' && typeof (m as MilestoneRow).title === 'string',
      )
    : [];

  const updateAction = updateOurStory.bind(null, eventId);
  const saved = search.saved === '1';
  const error = search.error;

  return (
    <section className="space-y-6">
      <header className="sn-reveal space-y-3">
        <Link
          href={`/dashboard/${eventId}/website`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to website
        </Link>
        <div>
          <p className="sn-eye flex items-center gap-2">
            <BookHeart aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Our story
          </p>
          <h1 className="sn-h1 mt-1">The story you tell your guests</h1>
          <p className="mt-2 max-w-prose text-sm text-ink/65">
            How you met, the spark, the yes — and your own timeline of moments. Your
            website weaves the story into the &ldquo;Our Story&rdquo; section on the
            save-the-date, RSVP, and wedding-day pages, and the rest shapes how
            Setnayan tells your story in the keepsakes you create. Every line is
            optional; what you leave blank simply isn&rsquo;t told.
          </p>
        </div>

        {saved ? (
          <div
            role="status"
            className="inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Saved — your story is live on your website.
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
      </header>

      <form action={updateAction} className="max-w-2xl space-y-8">
        <fieldset className="space-y-4">
          <legend className="font-serif text-lg italic text-ink">The beginning</legend>
          <Field
            label="How you met"
            name="how_we_met"
            value={s(story, 'how_we_met')}
            placeholder="One jeepney, two strangers, and rain that would not stop."
            rows={3}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="sn-eye">The year you met</span>
              <input name="met_year" defaultValue={s(story, 'met_year')} placeholder="2022" maxLength={12} className={fieldCls} />
            </label>
            <label className="block">
              <span className="sn-eye">Together since</span>
              <input name="together_since" defaultValue={s(story, 'together_since')} placeholder="2022" maxLength={120} className={fieldCls} />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-serif text-lg italic text-ink">The spark</legend>
          <Field
            label="The first thing you noticed was…"
            name="spark"
            value={s(story, 'spark')}
            placeholder="The way she laughed before the punchline."
          />
          <Field
            label="Why did that stick?"
            name="spark_why"
            value={s(story, 'spark_why')}
            placeholder="Because nobody else laughs like that."
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-serif text-lg italic text-ink">The almost</legend>
          <Field
            label="There was a moment you almost didn&rsquo;t make it because…"
            name="obstacle"
            value={s(story, 'obstacle')}
            placeholder="Two cities, one long year."
          />
          <Field
            label="What kept you going?"
            name="obstacle_kept"
            value={s(story, 'obstacle_kept')}
            placeholder="Sunday calls that never got shorter."
          />
          <input type="hidden" name="obstacle_kind" defaultValue={s(story, 'obstacle_kind')} />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-serif text-lg italic text-ink">The yes</legend>
          <Field
            label="You knew the moment…"
            name="proposal"
            value={s(story, 'proposal')}
            placeholder="The sun came up over the ridge and the question was already out."
            rows={3}
          />
          <Field
            label="How the other of you felt"
            name="proposal_feel"
            value={s(story, 'proposal_feel')}
            placeholder="Yes — before the sentence even finished."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="sn-eye">The year</span>
              <input name="proposal_year" defaultValue={s(story, 'proposal_year')} placeholder="2025" maxLength={12} className={fieldCls} />
            </label>
            <label className="block">
              <span className="sn-eye">The setting</span>
              <input
                name="proposal_setting"
                defaultValue={s(story, 'proposal_setting')}
                placeholder="a sunrise at the ridge"
                maxLength={120}
                className={fieldCls}
              />
            </label>
          </div>
          <input type="hidden" name="proposal_voice" defaultValue={s(story, 'proposal_voice')} />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-serif text-lg italic text-ink">The little things</legend>
          <p className="text-sm text-ink/60">The details only the two of you would know.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="sn-eye">Your song</span>
              <input name="anchor_song" defaultValue={anchor('song')} placeholder="The one you never skip" maxLength={120} className={fieldCls} />
            </label>
            <label className="block">
              <span className="sn-eye">Your place</span>
              <input name="anchor_place" defaultValue={anchor('place')} placeholder="Where it always ends up" maxLength={120} className={fieldCls} />
            </label>
            <label className="block">
              <span className="sn-eye">Your inside joke</span>
              <input name="anchor_injoke" defaultValue={anchor('injoke')} placeholder="No one else gets it" maxLength={120} className={fieldCls} />
            </label>
            <label className="block">
              <span className="sn-eye">Your food</span>
              <input name="anchor_food" defaultValue={anchor('food')} placeholder="The usual order" maxLength={120} className={fieldCls} />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-serif text-lg italic text-ink">Your timeline</legend>
          <p className="text-sm text-ink/60">
            The moments worth a line of their own — they render as your story&rsquo;s
            timeline.
          </p>
          <MilestonesField initial={milestones} />
        </fieldset>

        <SubmitButton pendingLabel="Saving…" className="button-primary">
          Save our story
        </SubmitButton>
      </form>
    </section>
  );
}
