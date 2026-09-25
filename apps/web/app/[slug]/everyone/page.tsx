import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { canViewSlugEvent } from '@/lib/slug-access';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { isHostMemberType } from '../_lib/host-scope';
import { loadEntourageSectionOrder } from '../_lib/loaders';
import {
  buildEntourage,
  plainGuestNames,
  ENTOURAGE_COLUMNS,
  ENTOURAGE_ROLES,
  type EntourageGuestRow,
} from '@/lib/entourage';
import { EntourageSection } from '../_components/entourage-section';

export const metadata = {
  title: 'Everyone who will be there',
  robots: { index: false, follow: false },
};

/**
 * EVERYONE WHO WILL BE THERE — the whole list, on its own page.
 *
 * ⚖ OWNER 2026-09-15, on where the full list lives: *"Both — a preview that
 * opens the full list."* The invitation keeps a short version; this is what it
 * opens into, and it is reachable from the shared link AND from a guest's own
 * personalised page.
 *
 * ── 🔒 TWO AUDIENCES, ONE PAGE, AND THE DIFFERENCE IS THE POINT ────────────
 * Asked who may read the plain guest names, the owner ruled: **guests and hosts
 * only.**
 *   · THE CAST is invitation content. A wedding prints its entourage; anyone
 *     who can open the page can read it.
 *   · A PLAIN GUEST'S NAME is not. On a PUBLIC event "everybody" means anyone
 *     with the link and the search engines behind them — 77 people on one live
 *     wedding who never agreed to that.
 *
 * 🔑 SO THE REFUSAL IS A READ THAT NEVER HAPPENS, not a filter after the fact.
 * A stranger's request does not fetch those rows at all; there is nothing to
 * forget to hide, and nothing for a later refactor to leak. The same shape
 * `page.tsx` already uses for `chaptersOnThisDay`.
 *
 * ⛔ `robots: noindex` regardless. Even the cast half is a list of real people's
 * names and does not belong in a search index.
 */
const fetchEvent = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from('events')
    .select('event_id, slug, display_name, landing_page_visibility')
    .ilike('slug', slug)
    .maybeSingle();
  return data as {
    event_id: string;
    slug: string | null;
    display_name: string | null;
    landing_page_visibility: string | null;
  } | null;
});

/**
 * Does this event RECOGNISE the person reading?
 *
 * A guest who opened their personal link or scanned their QR carries a session
 * for this event; a host is signed in and holds an `event_members` row. Anyone
 * else — including somebody a couple forwarded the link to — is a passer-by.
 *
 * ⚠ `isHostMemberType`, never a bare `Boolean(row)`: a `guest`-typed member row
 * once waved somebody into a private site because the membership was checked
 * for existence and never compared.
 */
async function eventRecognisesViewer(eventId: string): Promise<boolean> {
  const session = await readGuestSession();
  if (session?.event_id === eventId) return true;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  return isHostMemberType((data as { member_type?: string | null } | null)?.member_type);
}

export default async function EveryonePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) notFound();

  /*
    Lives on the event website → the 'website' surface.

    ⚠ NO `?? 'wedding'` FALLBACK, and a guard caught me writing one. I had
    copied it from `/pabuya`, which is grandfathered onto that guard's
    allow-list. Defaulting an unknown type to "wedding" is how a wake gets a
    wedding's surfaces — the word is a guess dressed as a default.

    🔑 RESOLVED FROM THE EVENT, not from a column this page had to re-type:
    `resolveProfileByEvent` takes the id we already hold, so there is no
    nullable string to fall back FROM and nothing for the next reader to guess
    at. The `event_type` column is not selected here at all.
  */
  if (!surfaceEnabled(await resolveProfileByEvent(event.event_id), 'website')) {
    notFound();
  }

  // A private page turns a stranger away here exactly as it does at `/[slug]`.
  if (!(await canViewSlugEvent(event.event_id, event.landing_page_visibility))) {
    redirect(`/${slug}`);
  }

  const recognised = await eventRecognisesViewer(event.event_id);
  const admin = createAdminClient();

  const { data: castRows } = await admin
    .from('guests')
    .select(ENTOURAGE_COLUMNS)
    .eq('event_id', event.event_id)
    .is('deleted_at', null)
    .or(
      `role.in.(${ENTOURAGE_ROLES.join(',')}),extra_roles.ov.{${ENTOURAGE_ROLES.join(',')}}`,
    );
  // Same section order the invitation prints — the couple's, when they set one.
  const groups = buildEntourage(
    (castRows ?? []) as EntourageGuestRow[],
    await loadEntourageSectionOrder(admin, event.event_id),
  );

  /*
    🔒 THE GATED READ RUNS ONLY FOR SOMEONE THE EVENT RECOGNISES, and it is its
    own statement rather than a ternary inside a call — a source guard walking
    back from the query to find its condition stops at the enclosing `(` and
    cannot see a gate that far out.
  */
  let guests: string[] = [];
  if (recognised) {
    const { data: guestRows } = await admin
      .from('guests')
      .select(ENTOURAGE_COLUMNS)
      .eq('event_id', event.event_id)
      .is('deleted_at', null);
    guests = plainGuestNames((guestRows ?? []) as EntourageGuestRow[]);
  }

  const name = event.display_name ?? 'this celebration';

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <p className="pahina-eyebrow justify-center">
          <span>Everyone</span>
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium italic sm:text-4xl">
          Everyone who will be there
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/65">
          The people standing with {name}, and — for invited guests — everyone else coming.
        </p>
      </header>

      {groups.length > 0 ? (
        <EntourageSection groups={groups} />
      ) : (
        <p className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-10 text-center text-sm text-ink/60">
          The entourage hasn&rsquo;t been shared yet. Check back closer to the day.
        </p>
      )}

      <section className="mt-12">
        <header className="space-y-2">
          <p className="pahina-eyebrow">
            <span>Also coming</span>
          </p>
        </header>
        {recognised ? (
          guests.length > 0 ? (
            <ul className="mt-4 grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-8">
              {guests.map((g, i) => (
                <li key={`${g}-${i}`} className="text-base leading-snug text-ink">
                  {g}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink/60">
              No one else is on the list yet.
            </p>
          )
        ) : (
          /* ⚠ SAY WHY, AND SAY IT AS A FACT ABOUT THE READER — not "you are not
             allowed". A relative opening a forwarded link is not doing anything
             wrong; they simply are not holding an invitation. */
          <p className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-8 text-center text-sm text-ink/60">
            The rest of the guest list is for invited guests. Open your own
            invitation link, or scan your QR, and it will appear here.
          </p>
        )}
      </section>

      <footer className="mt-12 border-t border-ink/10 pt-8 text-center">
        {/* min-h-[40px] + matching negative margin (mobile audit item 3:
            measured 18px) — grows the hit area without shifting the text. */}
        <Link
          href={`/${slug}`}
          className="inline-flex min-h-[40px] items-center py-2.5 -my-2.5 text-sm text-ink/60 underline underline-offset-4"
        >
          Back to the invitation
        </Link>
      </footer>
    </main>
  );
}
