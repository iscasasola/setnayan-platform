import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { PageMasthead } from '@/app/_components/page-masthead';
import { eventNoun } from '@/lib/event-noun';
import { setChapterOnMyDay } from './actions';

export const metadata = { title: 'Stories about your day' };
export const dynamic = 'force-dynamic';

/**
 * The host deciding which attached stories appear on their celebration.
 *
 * Owner, 2026-08-15: *"vendors who are part of that event can create a content
 * for that event"* and *"they can create a column for that story, and the user
 * can decide to add it or not."*
 *
 * 🔑 THE AUTHOR IS NEVER BLOCKED FROM WRITING. A supplier who worked the day
 * publishes their piece on their own page whatever happens here. This screen
 * decides one thing only: whether it also appears where Setnayan speaks about
 * THIS celebration.
 */
export default async function EventStoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: membership, error: membershipError } = await admin
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (membershipError || !membership) redirect(`/dashboard/${eventId}`);

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('event_id, display_name, event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the event record. Degrades rather than claiming.
  if (eventError) {
    logQueryError('WebsiteStoriesPage.event', eventError, { eventId }, 'graceful_degrade');
  }
  if (!event) redirect('/dashboard');

  // Everything attached to this celebration by anyone — the author's own page
  // shows it regardless; this list is only about THIS day.
  const { data: rows, error: rowsError } = await admin
    .from('creator_chapters')
    .select('chapter_id, public_id, title, user_id, status, host_included_at, published_at')
    .eq('event_id', eventId)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  type Row = {
    chapter_id: string;
    public_id: string;
    title: string;
    user_id: string;
    host_included_at: string | null;
  };
  const chapters = (rows ?? []) as Row[];

  const authors = new Map<string, { name: string; slug: string | null }>();
  if (chapters.length > 0) {
    const { data: people, error: peopleError } = await admin
      .from('users')
      .select('user_id, display_name, slug')
      .in('user_id', [...new Set(chapters.map((c) => c.user_id))]);
    // ⚠ the people whose stories attach here. Refused, each reads as unnamed.
    if (peopleError) {
      logQueryError('WebsiteStoriesPage.people', peopleError, { eventId }, 'graceful_degrade');
    }
    for (const p of (people ?? []) as Array<{
      user_id: string;
      display_name: string | null;
      slug: string | null;
    }>) {
      authors.set(p.user_id, {
        name: p.display_name?.trim() || 'A Setnayan storyteller',
        slug: p.slug,
      });
    }
  }

  const noun = eventNoun(event.event_type as string);

  return (
    <section className="space-y-8">
      <Link
        href={`/dashboard/${eventId}/website`}
        className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-terracotta-700"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Back to your {noun} website
      </Link>

      <PageMasthead
        title="Stories about your day"
        lede={`People who were part of your ${noun} — your suppliers, and you — can write about it. You choose which of their stories appear alongside your ${noun}. Their own page always shows what they wrote; this is only about yours.`}
      />

      {search.error ? (
        <FormFlash tone="error">{decodeURIComponent(search.error)}</FormFlash>
      ) : null}
      {search.saved ? <FormFlash tone="success">Saved.</FormFlash> : null}

      {/* 🪤 A failed read is NOT "nobody has written about your day" — the two
          are indistinguishable to a reader, and the reassuring one is wrong. */}
      {rowsError ? (
        <p className="text-sm text-ink/70">
          We couldn&rsquo;t load these just now. Please refresh — nothing has
          changed.
        </p>
      ) : chapters.length === 0 ? (
        <p className="max-w-prose text-sm text-ink/70">
          Nobody has written about your {noun} yet. When one of your suppliers
          publishes their side of the day, it will appear here for you to add.
        </p>
      ) : (
        <ul className="space-y-3">
          {chapters.map((c) => {
            const author = authors.get(c.user_id);
            const on = Boolean(c.host_included_at);
            return (
              <li
                key={c.chapter_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-ink/10 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{c.title}</p>
                  <p className="text-xs text-ink/60">
                    by {author?.name ?? 'A Setnayan storyteller'}
                    {author?.slug ? (
                      <>
                        {' · '}
                        <Link
                          href={`/u/${author.slug}/c/${c.public_id}`}
                          className="underline"
                        >
                          Read it
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-ink/55">
                    {on
                      ? `Showing alongside your ${noun}.`
                      : `Not shown on your ${noun}. It is still on their own page.`}
                  </p>
                </div>
                <form action={setChapterOnMyDay}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="chapter_id" value={c.chapter_id} />
                  <input type="hidden" name="include" value={on ? '0' : '1'} />
                  <SubmitButton
                    className={on ? 'button-secondary' : 'button-primary'}
                    pendingLabel="Saving…"
                  >
                    {on ? 'Take off my day' : 'Add to my day'}
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
