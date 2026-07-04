import { Clock, Users, HeartHandshake, UserPlus } from 'lucide-react';

export const metadata = {
  title: 'People',
};

/**
 * People — the reserved home for the person-spine connections layer
 * (owner-locked 2026-07-04, 03_Strategy/People_Graph_and_Lifelong_Identity_
 * 2026-07-04.md). The connect flow (suggest → request → mutually confirm) is
 * Phase 2, gated behind the people graph + PH counsel, so NOTHING here is
 * interactive yet.
 *
 * Owner feedback (2026-07-05): the earlier version rendered `+ Spouse` /
 * `+ Parent` chips that *looked* tappable but did nothing ("how do I send an
 * invite?" had no answer). This version is an honest, unmistakable "coming soon"
 * PREVIEW — descriptive, non-interactive — so nobody taps a dead control. It
 * keeps the feature's permanent nav home so the real flow drops in later without
 * a repaint.
 */
export default function PeoplePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">People</h1>
        <p className="text-base text-ink/60">
          Family, godparents, and friends — the people your celebrations connect.
        </p>
      </header>

      {/* Unmistakable "not yet" state — the whole point of this rewrite. */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-ink/10 bg-cream p-4">
        <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink/50" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Connections are coming soon.</p>
          <p className="text-sm text-ink/65">
            You&rsquo;ll be able to link the people in your life here — each one{' '}
            <span className="font-medium text-ink">suggested from your events</span> and{' '}
            <span className="font-medium text-ink">confirmed by both sides</span>, so nothing
            connects until you both agree. There&rsquo;s nothing to do on this page yet.
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
              className="rounded-full border border-ink/10 bg-cream px-3 py-1 text-xs text-ink/60"
            >
              {g}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/** A descriptive, non-interactive preview row (no button affordance — see file header). */
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
    <div className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white/40 p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink/60">{body}</p>
      </div>
    </div>
  );
}
