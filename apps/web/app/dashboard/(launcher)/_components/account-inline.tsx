import type { ComponentType, ReactNode } from 'react';
import {
  Users,
  UsersRound,
  HeartHandshake,
  HandHeart,
  Images,
  Trophy,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';

/**
 * Inline bodies for the launcher's "Your account" / "Your spaces" expand-collapse
 * rows (owner 2026-07-13). These render the same honest, prod-accurate content
 * their standalone pages show — but INLINE, so the home page never navigates away
 * for an account-level feature. Kept deliberately compact for an accordion.
 */

/** A small icon + title + body facet used across the inline panels. */
function Facet({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-ink/10 bg-white/50 p-3">
      <span className="mt-0.5 shrink-0 text-ink/45">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink/60">{body}</p>
      </div>
    </div>
  );
}

/** A muted "nothing to do yet / coming soon" note. */
function ComingSoonNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">{children}</p>
  );
}

/**
 * People — mirrors /dashboard/people. Owner degree model (2026-07-17): your
 * FIRST degree = connections + alaga + samahan groups; the people INSIDE your
 * samahans are your SECOND degree. The dependents flag is ON in production
 * (owner 2026-07-16); the coming-soon note now covers only the counsel-gated
 * connections flow.
 */
export function PeopleInline() {
  const live = peopleConnectionsEnabled() || dependentPeopleEnabled();
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/65">
        Your first degree — the people you&rsquo;re connected to, your alaga, and your samahan
        groups. The people inside your samahans are your second degree.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Facet
          icon={Users}
          title="Family & friends"
          body="Your closest — suggested from your events, confirmed by both sides."
        />
        <Facet
          icon={HeartHandshake}
          title="Ninong / Ninang"
          body="Godparents from your binyag, wedding, and confirmation roles."
        />
        <Facet
          icon={HandHeart}
          title="Alaga"
          body="The ones you care for — a child, a lolo, a pet. Their profile is yours until it's theirs."
        />
        <Facet
          icon={UsersRound}
          title="Samahan"
          body="Your groups — barkada, parish, clan. Their members are your second degree."
        />
      </div>
      {!live ? (
        <ComingSoonNote>
          Connections are coming soon — there’s nothing to manage here yet.
        </ComingSoonNote>
      ) : null}
    </div>
  );
}

/**
 * Life Story — the flag-off doorway in "Your spaces" used to link to the
 * Memories Hub; per the owner rule it now describes the Life-Flash vision inline
 * instead of navigating.
 */
export function LifeStoryInline() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/65">
        Every celebration you host or attend, gathered into one living story — the
        moments that mattered most, through every camera that was there.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Facet
          icon={Images}
          title="Every event"
          body="Photos and 5-second clips from all your celebrations."
        />
        <Facet
          icon={Trophy}
          title="Your milestones"
          body="The highlights that carry across the years."
        />
        <Facet
          icon={InfinityIcon}
          title="Kept for life"
          body="Yours to revisit, gathered while you’re living it."
        />
      </div>
    </div>
  );
}
