import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BookHeart, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { updateOurStory } from './actions';
import { StoryFields, type LoveStoryBlob } from './_components/story-fields';
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
        <StoryFields story={story} />

        <SubmitButton pendingLabel="Saving…" className="button-primary">
          Save our story
        </SubmitButton>
      </form>
    </section>
  );
}
