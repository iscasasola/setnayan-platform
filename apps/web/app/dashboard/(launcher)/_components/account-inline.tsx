import type { ComponentType, ReactNode } from 'react';
import {
  Users,
  HeartHandshake,
  UserPlus,
  CalendarClock,
  Wallet,
  Compass,
  Sparkles,
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
 * People — mirrors /dashboard/people. Flags are OFF in production, so the honest
 * state is the "what will live here" preview; when connections/dependents flip
 * on, the note drops. (The full suggest→confirm flow still lives on the People
 * page for now — this inline peek describes it.)
 */
export function PeopleInline() {
  const live = peopleConnectionsEnabled() || dependentPeopleEnabled();
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/65">
        Family, godparents, and friends — the people your celebrations connect. Each
        one suggested from your events and confirmed by both sides.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Facet
          icon={Users}
          title="Family"
          body="Your closest — parent, sibling, child. The rest appear on their own."
        />
        <Facet
          icon={HeartHandshake}
          title="Ninong / Ninang"
          body="Godparents from your binyag, wedding, and confirmation roles."
        />
        <Facet
          icon={UserPlus}
          title="Friends"
          body="Suggested from the people you’ve celebrated with."
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
 * Setnayan AI — mirrors /dashboard/setnayan-ai, which is dormant (per-user flag
 * off) and shows a "coming soon" state in production. This inline peek describes
 * the planning copilot and carries the same coming-soon note.
 */
export function SetnayanAiInline() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/65">
        Your always-on planning copilot — one assistant across every event. It keeps
        your plan moving:
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Facet
          icon={CalendarClock}
          title="Never miss a step"
          body="Nudges the next task before it slips overdue."
        />
        <Facet
          icon={Wallet}
          title="Budget guard"
          body="Flags where you’re drifting over, early."
        />
        <Facet
          icon={Compass}
          title="Right vendors"
          body="Suggests vendors that fit your date and area."
        />
        <Facet
          icon={Sparkles}
          title="Weekly digest"
          body="A short read of exactly what needs you."
        />
      </div>
      <ComingSoonNote>
        Setnayan AI is on the way — we’ll let you know the moment it opens.
      </ComingSoonNote>
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
