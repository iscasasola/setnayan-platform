import Link from 'next/link';
import { ArrowLeft, Clock, Users, HeartHandshake, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { ConnectionsPanel, type ConnectionItem } from './_components/connections-panel';
import { DependentsSection } from './_components/dependents-section';

export const metadata = {
  title: 'People',
};

const FENCE_ERROR: Record<string, string> = {
  fence: 'You can only add a child (under 18) or an elder (over 50). For anyone else, invite them to Setnayan instead.',
  name: 'Please add a name.',
  birthdate: 'Please add a valid birthday.',
};

/**
 * People — the person-spine connections layer (owner-locked 2026-07-04,
 * 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md).
 *
 * Flag-gated (`peopleConnectionsEnabled()`, default OFF — Phase 2 is counsel-
 * gated). When OFF (production today) this renders the honest "coming soon"
 * PREVIEW — no interactive controls. When ON (post PH counsel + flag flip) it
 * renders the functional suggest→confirm flow via <ConnectionsPanel>, wiring the
 * shipped propose/confirm/decline actions. The preview + functional modes share
 * this one route so nothing repaints on the flip.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; removed?: string }>;
}) {
  const showConnections = peopleConnectionsEnabled();
  const showDependents = dependentPeopleEnabled();

  // Both flags off (production today) → the honest coming-soon preview.
  if (!showConnections && !showDependents) {
    return <PeoplePreview />;
  }

  const sp = await searchParams;
  const errorMsg = sp.error ? (FENCE_ERROR[sp.error] ?? sp.error) : null;

  const user = showConnections ? await getCurrentUser() : null;
  const { incoming, outgoing, confirmed } = user
    ? await fetchMyConnections(user.id)
    : { incoming: [], outgoing: [], confirmed: [] };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to home
      </Link>
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">People</h1>
        <p className="text-base text-ink/60">Your family, godparents, and friends.</p>
      </header>
      {errorMsg ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMsg}
        </p>
      ) : null}
      {showConnections ? (
        <ConnectionsPanel incoming={incoming} outgoing={outgoing} confirmed={confirmed} />
      ) : null}
      {showDependents ? <DependentsSection /> : null}
    </div>
  );
}

/**
 * Fetch the signed-in user's connections, classified into incoming (pending,
 * I'm the recipient) / outgoing (pending, I proposed) / confirmed. RLS on
 * `person_connections` already scopes this to edges I'm a participant in.
 *
 * Name resolution degrades gracefully: `people` RLS only surfaces people I
 * claimed or created, so a connected person's name shows for people I added and
 * falls back to a neutral label otherwise — until the counsel-gated cross-person
 * name-visibility RLS lands with the flag flip.
 */
async function fetchMyConnections(userId: string): Promise<{
  incoming: ConnectionItem[];
  outgoing: ConnectionItem[];
  confirmed: ConnectionItem[];
}> {
  const empty = { incoming: [], outgoing: [], confirmed: [] };
  const supabase = await createClient();

  const { data: me } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  const myPerson = (me as { person_id: string } | null)?.person_id;
  if (!myPerson) return empty;

  const { data: rowsData } = await supabase
    .from('person_connections')
    .select('connection_id, relation, layer, status, from_person_id, to_person_id')
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .is('deleted_at', null)
    .neq('status', 'declined');
  const rows = (rowsData ?? []) as Array<{
    connection_id: string;
    relation: string;
    layer: string;
    status: string;
    from_person_id: string;
    to_person_id: string;
  }>;
  if (rows.length === 0) return empty;

  const otherIds = [
    ...new Set(rows.map((r) => (r.from_person_id === myPerson ? r.to_person_id : r.from_person_id))),
  ];
  // Cross-person name visibility (owner-signed-off rule 2026-07-05): resolve
  // names ONLY through `visible_connection_names`, which returns display_name and
  // ONLY for people we share a CONFIRMED edge with — name only, no contact
  // details. Pending/outgoing connections therefore stay unnamed (the panel
  // degrades to "Someone"/"Pending") until both sides confirm.
  const names = new Map<string, string>();
  const { data: nameRows } = await supabase.rpc('visible_connection_names', {
    p_person_ids: otherIds,
  });
  for (const r of (nameRows ?? []) as Array<{
    person_id: string;
    display_name: string | null;
  }>) {
    const label = (r.display_name ?? '').trim();
    if (label) names.set(r.person_id, label);
  }

  const incoming: ConnectionItem[] = [];
  const outgoing: ConnectionItem[] = [];
  const confirmed: ConnectionItem[] = [];
  for (const r of rows) {
    const otherId = r.from_person_id === myPerson ? r.to_person_id : r.from_person_id;
    const item: ConnectionItem = {
      connectionId: r.connection_id,
      relation: r.relation,
      layer: r.layer,
      status: r.status,
      otherName: names.get(otherId) ?? null,
    };
    if (r.status === 'confirmed') confirmed.push(item);
    else if (r.to_person_id === myPerson) incoming.push(item);
    else outgoing.push(item);
  }
  return { incoming, outgoing, confirmed };
}

/** The honest, non-interactive "coming soon" preview (flag OFF — production today). */
function PeoplePreview() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to home
      </Link>
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">People</h1>
        <p className="text-base text-ink/60">
          Family, godparents, and friends — the people your celebrations connect.
        </p>
      </header>

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
    <div className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white/40 p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink/60">{body}</p>
      </div>
    </div>
  );
}
