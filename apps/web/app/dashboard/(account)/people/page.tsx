import Link from 'next/link';
import { Clock, Users, HeartHandshake, UserPlus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { getSpouseContext } from '@/lib/people-spouse-context';
import { getPeopleRoster } from '@/lib/people-roster';
import { getFollowCounts, getFollowers, getFollowing } from '@/lib/people-follows';
import {
  defaultPeopleView,
  peopleViewOptions,
  resolvePeopleView,
  type PeopleView,
  type PeopleViewGates,
} from '@/lib/people-views';
import { offerableRelations, spouseAbsenceNote, type SpouseContext } from '@/lib/people-add';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { Spotlight } from '@/app/_components/spotlight';
import { PeopleRosterView } from './_components/people-roster-view';
import { PeopleThumb } from './_components/people-thumb';
import { FollowListView } from './_components/follow-list-view';
import { AddAlagaButton } from './_components/add-alaga-button';
import { DependentsSection } from './_components/dependents-section';
import { SamahanPeopleSection } from './_components/samahan-people-section';
import { PageMasthead } from '@/app/_components/page-masthead';
import { YourStorySection } from './_components/your-story-section';
import { ConnectionTreeSection } from './_components/connection-tree-section';

export const metadata = {
  title: 'People',
};

const FENCE_ERROR: Record<string, string> = {
  fence: 'You can only add a child (under 18) or an elder (over 50). For anyone else, invite them to Setnayan instead.',
  name: 'Please add a name.',
  birthdate: 'Please add a valid birthday.',
  email: 'Please enter a valid email address.',
  no_active_link: 'Create the hand-over link first, then email it.',
  email_not_configured:
    'Email isn’t set up yet — an admin needs to add the Resend key in Admin → Integrations. The copy-link button still works.',
  email_send_failed: 'The email didn’t send — try again, or copy the link instead.',
  not_of_age: 'They can claim their profile once they turn 18.',
};

/**
 * People — the person-spine connections layer (owner-locked 2026-07-04,
 * 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md).
 *
 * Flag-gated (`peopleConnectionsEnabled()`, default OFF — Phase 2 is counsel-
 * gated). When OFF (production today) this renders the honest "coming soon"
 * PREVIEW — no interactive controls. When ON (post PH counsel + flag flip) it
 * renders the roster (<PeopleRosterView>) — add first, label after — wiring the
 * shipped propose/confirm/decline actions. The preview + functional modes share
 * this one route so nothing repaints on the flip.
 *
 * ── 2026-10-22: THE TOP IS THE COUNTS LINE (owner: "remove it", of the view dropdown) ──
 * People wears today's Guest list (prototypes/people_and_memories_template_2026-10-22.html). The view
 * dropdown that headed the page is gone; the roster's counts line is the top and filters. Loved ones is a
 * folded section of the list; Groups · Following · Followers sit under the ≡ button in the thumb row
 * (`PeopleViewPicker`, moved). Every `?view=` still resolves — the rail's rows link to them — and lands on
 * the same thing: requests → the list filtered to "asking you", alaga → the list with Loved ones open.
 *
 * ── ONE PAGE, ONE PICKER (owner 2026-09-28, the People redesign) ──────────
 * *"People is same as Alaga and Samahan."* The page is six views by URL —
 * `?view=` requests · connected (default) · following · followers · alaga ·
 * samahan — chosen with ONE shared `PickMenu` (owner: any set of choices is a
 * dropdown), which is the ONLY thing in the header. The rail's rows are the
 * same `?view=` links (`account-rail-context.tsx`), resolved by the same
 * `lib/people-views.ts`, so the lit row and the open view cannot disagree.
 *
 * ── EACH DOOR AT THE HEAD OF ITS OWN VIEW, AND NOWHERE ELSE ──────────────
 * Owner 2026-09-28, pointing at the prototype's header row:
 *   *"we already agreed this will be on the alaga and samahan row."*
 * So "Add an alaga" heads the Alaga view and "New samahan" heads the Samahan
 * view — once each. This
 * SUPERSEDES the 2026-08-22 header action row (*"where the buttons live"*),
 * which is why `the-buttons-live-together.test.ts` now pins the opposite of
 * what it used to: each door in its own view, never in the header.
 *
 * ⚠ "IMPORT CONTACTS" IS STILL DELIBERATELY ABSENT. It cannot be built honestly
 * under the rule the owner locked on 2026-08-21: a person must hold an account
 * to be listed. A pasted address book is mostly people who do not, so the
 * feature reduces to either telling you which of your contacts have Setnayan
 * accounts — an enumeration oracle over a list you supply, exactly what the
 * name search was built NOT to be — or bulk-emailing strangers who never asked.
 * A button that opens neither is a fake door.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; removed?: string; view?: string }>;
}) {
  const showConnections = peopleConnectionsEnabled();
  // Dependents (minors' SPI) surface only when the env flag AND the
  // dependent_minor_profiles data-privacy control are both on. Fail-closed.
  const showDependents =
    dependentPeopleEnabled() && (await isDataPrivacyControlActive('dependent_minor_profiles'));

  // Both flags off → the honest coming-soon preview. (Both are ON in production
  // — read 2026-09-21 — so this branch is dev/preview-only today.)
  if (!showConnections && !showDependents) {
    return <PeoplePreview />;
  }

  const sp = await searchParams;
  const errorMsg = sp.error ? (FENCE_ERROR[sp.error] ?? sp.error) : null;
  const gates: PeopleViewGates = { showConnections, showDependents };
  const view = resolvePeopleView(sp.view, gates);

  // ONE ROSTER for connections + alaga, shaped like the guest list (owner
  // 2026-08-21). The read is skipped entirely when nobody is signed in. It is
  // read on every view because the picker's counts come from it.
  const user = await getCurrentUser();
  // THE SPOUSE RULE (owner 2026-08-21). Read once here and handed to the card,
  // which never decides it — `addPersonConnection` recomputes the same rule from
  // the same helper, so a chip that was never drawn is still refused if posted.
  // No user (or connections off) → the not-married context, which is where a
  // failed read lands too: the chip can be hidden by a denial, never invented.
  //
  // ⚡ ONE WAIT (2026-10-23, the speed pass): the follow list and the spouse
  // rule need only the signed-in id and the view, so they are asked in the
  // same round as the roster instead of one after another (the spouse rule
  // alone was three more trips after the roster had come back).
  const notMarried: SpouseContext = { civilStatus: null, weddingHasHappened: false };
  const [roster, followCounts, followList, spouseCtx] = await Promise.all([
    user ? getPeopleRoster(user.id) : Promise.resolve(null),
    user ? getFollowCounts(user.id) : Promise.resolve({ following: null, followers: null }),
    user && view === 'following'
      ? getFollowing(user.id)
      : user && view === 'followers'
        ? getFollowers(user.id)
        : Promise.resolve(null),
    user && (view === 'connected' || view === 'requests' || view === 'alaga')
      ? getSpouseContext(user.id)
      : Promise.resolve(notMarried),
  ]);

  // The picker's counts. A count that could not be read is NULL and is left
  // off its label — never printed as 0 (a refused read is not an empty list).
  // Everything waiting on my answer — a request to connect, or a label asked
  // on a connection I already have (owner 2026-09-29: both live in Requests).
  const waiting = (roster?.counts.waitingYou ?? 0) + (roster?.counts.labelAsksForYou ?? 0);
  const options = peopleViewOptions(
    gates,
    {
      requests: roster?.connectionsUnavailable && waiting === 0 ? null : waiting,
      connected: roster && !roster.connectionsUnavailable ? roster.counts.connected : null,
      following: followCounts.following,
      followers: followCounts.followers,
      alaga: roster?.counts.alaga ?? null,
      samahan: roster?.counts.samahan ?? null,
    },
    view,
  );

  // THE ≡ LIST (owner 2026-10-22 — the dropdown at the top is removed; Groups, Following and Followers sit under
  // the filter button in the thumb row, the seat Guests keeps its groups in). Requests and Loved ones are not
  // in it: they are the "asking you" count and a folded section of the list.
  const picker = {
    view: (['connected', 'following', 'followers', 'samahan'] as PeopleView[]).includes(view) ? view : defaultPeopleView(gates),
    options: options
      .filter((o) => o.key !== 'requests' && o.key !== 'alaga')
      .map((o) => (o.key === 'connected' ? { ...o, label: o.label.replace(/^Connected/, 'Your people') } : o)),
    gates,
  };

  // LOVED ONES — "Add a loved one" at the head of its own section, its only home (owner 2026-09-28, and
  // 2026-10-22: a folded section in the list, like Family and Friends — a business alaga included).
  const lovedOnes = showDependents ? (
    <div data-people-view="alaga" className="pb-3">
      <div className="mb-3 mt-1" data-view-door="alaga">
        <AddAlagaButton />
      </div>
      <DependentsSection />
    </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
      <PageMasthead title="People" />
      {/* First visit only — the SPOTLIGHT (owner rule 2026-09-25: every feature gets a first-visit tour; 2026-10-10:
          "our tour is a spotlight tour"). It replaces the carousel `customer_people_v1`, switched off since 2026-10-03,
          whose words described the dropdown this page lost on 2026-10-22. After the host's journey, so two never stack. */}
      <Spotlight tourKey="customer_people_v2" after="host_spotlight_v1" />
      {errorMsg ? (
        <p
          role="alert"
          className="mb-4 rounded-md bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMsg}
        </p>
      ) : null}

      {/* THE TOP IS THE COUNTS LINE, inside the roster (owner 2026-10-22). No header block above it. */}
      {(view === 'connected' || view === 'requests' || view === 'alaga') && roster && showConnections ? (
        <PeopleRosterView
          roster={roster}
          relations={offerableRelations(spouseCtx)}
          spouseNote={spouseAbsenceNote(spouseCtx)}
          picker={picker}
          initialFilter={view === 'requests' ? 'asking' : 'all'}
          focus={view === 'alaga' ? 'alaga' : null}
          extra={[
            ...(lovedOnes
              ? [{ key: 'alaga' as const, label: 'Loved ones', count: roster.counts.alaga, node: lovedOnes }]
              : []),
            // THE TREE. `kinship-derive.ts` shipped on 2026-07-31 and had NO CONSUMER until then. It is the
            // last folded section — what the people above add up to (spec §6: "Do not build a new page").
            ...(user
              ? [{ key: 'tree' as const, label: 'Your connection tree', count: null, folded: true, node: <ConnectionTreeSection userId={user.id} bare /> }]
              : []),
          ]}
        />
      ) : null}
      {/* Loved ones with connections switched off (a dev/preview-only branch): the section on its own. */}
      {view === 'alaga' && !showConnections ? lovedOnes : null}

      {(view === 'following' || view === 'followers') && followList ? (
        <FollowListView
          which={view}
          list={followList}
          total={view === 'following' ? followCounts.following : followCounts.followers}
          picker={picker}
        />
      ) : null}

      {/* GROUPS — "New group" at the head of its own view, its only home. It goes to the page that already
          creates one; nothing here is a new destination. Samahan is live product and never flag-gated. */}
      {view === 'samahan' ? (
        <div data-people-view="samahan" className="mx-auto w-full max-w-3xl pb-24">
          <div className="mb-5 mt-2" data-view-door="samahan">
            <Link href="/dashboard/samahan/new" className="button-secondary inline-flex min-h-11 items-center text-sm">
              New group
            </Link>
          </div>
          <SamahanPeopleSection heading={false} />
          <PeopleThumb picker={picker} />
        </div>
      ) : null}

      {/* Your story stays on the page — on its default view, after the list (shown only when it has items). */}
      {view === defaultPeopleView(gates) ? (
        <div className="mx-auto mt-6 w-full max-w-3xl">
          <YourStorySection />
        </div>
      ) : null}
    </div>
  );
}

/** The honest, non-interactive "coming soon" preview (flag OFF — production today). */
function PeoplePreview() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="People"
      />

      {/* 🚨 SAMAHAN IS LIVE AND THIS BRANCH USED TO HIDE IT.
          `samahan-people-section.tsx` is NOT flag-gated — this file says so itself
          further up — but the preview returned early without ever rendering it. So
          the phone pill nav's People target, the most thumb-prominent People door in
          the app, said "there's nothing to do on this page yet" to a user who had
          samahans sitting right there. The owner hit exactly that.
          It renders FIRST because it is the part that actually works; the
          coming-soon note is about connections only. It also carries its own
          "Create one" door when the user has none, so it is never dead weight. */}
      <div className="mb-8">
        <YourStorySection />
      <SamahanPeopleSection />
      </div>

      {/* Everything below is the not-yet-built Connections preview — one
          block, hidden in the store shell (lib/store-shell.ts `COMING_SOON_ATTR`). */}
      <div data-coming-soon>
      <div className="sn-tile mb-8 flex items-start gap-3">
        <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/50" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Connections are coming soon.</p>
          <p className="text-sm text-ink/65">
            You&rsquo;ll be able to link the people in your life here — each one{' '}
            <span className="font-medium text-ink">suggested from your events</span> and{' '}
            <span className="font-medium text-ink">confirmed by both sides</span>, so nothing
            connects until you both agree.{' '}
            {/* ⚠ WAS "There's nothing to do on this page yet." That sentence was FALSE for
                anyone with a samahan, and it is the sentence the owner read. Scope the
                claim to connections — never to the page. */}
            Your groups above are ready now.
          </p>
        </div>
      </div>

      <p className="mb-4 text-sm font-medium text-ink/70">A preview of what will live here</p>

      <div className="space-y-4">
        <PreviewRow
          icon={<Users aria-hidden className="h-5 w-5 text-ink/45" strokeWidth={1.75} />}
          title="Family"
          body="Add only your closest — spouse, parent, sibling, child. Grandparents, cousins, and in-laws appear automatically from those."
        />
        <PreviewRow
          icon={<HeartHandshake aria-hidden className="h-5 w-5 text-ink/45" strokeWidth={1.75} />}
          title="Godparents · Ninong / Ninang"
          body="Created from your binyag, wedding, and confirmation roles — so celebrating together is what connects you. Kumpare/kumare links form on their own."
        />
        <PreviewRow
          icon={<UserPlus aria-hidden className="h-5 w-5 text-ink/45" strokeWidth={1.75} />}
          title="Friends"
          body="Suggested from the people you&rsquo;ve celebrated with — a lighter connection, kept separate from family."
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-2 border-t border-ink/10 pt-6">
        {['Suggested from your events', 'Confirmed by both sides', 'Adults first', 'Private to you'].map(
          (g) => (
            <span
              key={g}
              className="sn-row px-3 py-1 text-xs text-ink/60"
            >
              {g}
            </span>
          ),
        )}
      </div>
      </div>
    </div>
  );
}

/** A descriptive, non-interactive preview row (no button affordance). */
function PreviewRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="sn-row flex items-start gap-3 p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink/60">{body}</p>
      </div>
    </div>
  );
}
