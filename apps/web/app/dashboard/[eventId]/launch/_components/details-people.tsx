'use client';

import type { ReactNode } from 'react';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { DetailsPieceButton, useDetailsPiece } from './details-go';

/**
 * PARENTS & HOSTS, IN THE MAKER'S THREE PARTS (owner 2026-09-29, DECISION_LOG
 * "A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS"):
 *
 *   LEFT    the people — each parent, "Add a parent", each host;
 *   MIDDLE  where they print — the parents on The Invitation, a host on the
 *           card that carries "Kindly reply" (The Finer Details);
 *   RIGHT   the picked parent's OWN guest card (`GuestCardBody`, loaded by the
 *           Guest list's loader — it posts every column), the Guest list's own
 *           single-guest add for a new parent (`ParentCards`), or the host.
 *
 * +0 writers: the cards and the add are part 1's (`parent-cards.tsx`); a host's
 * number is read from their own account.
 */

export type PersonPiece = { key: string; name: string };
export type HostPiece = { key: string; label: string; contact: string | null };

const ADD = 'add';

function usePick(parents: readonly PersonPiece[], hosts: readonly HostPiece[], parentsOffered: boolean) {
  const first = parentsOffered ? (parents[0]?.key ?? ADD) : (hosts[0]?.key ?? null);
  // Part 3's ONE piece mechanism (`details-go.tsx`), under the item's own key.
  const [pick, setPick] = useDetailsPiece('parents');
  const known = pick === ADD ? parentsOffered : parents.some((p) => p.key === pick) || hosts.some((h) => h.key === pick);
  return [known ? pick : first, (v: string) => setPick(v, { openEditor: true })] as const;
}

export function PeoplePieces({ parents, hosts, parentsOffered }: { parents: readonly PersonPiece[]; hosts: readonly HostPiece[]; parentsOffered: boolean }) {
  const [pick, setPick] = usePick(parents, hosts, parentsOffered);
  const heading = (t: string) => <p className="hidden px-1 pb-0.5 pt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/50 lg:block">{t}</p>;
  const row = (key: string, label: string, sub?: string) => (
    <DetailsPieceButton key={key} on={pick === key} onPick={() => setPick(key)} data={key}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{label}</span>
        {sub ? <small className="truncate text-[11px] opacity-70">{sub}</small> : null}
      </span>
    </DetailsPieceButton>
  );
  return (
    <>
      {parentsOffered ? (
        <div className="contents" data-people-piece="parents">
          {heading('Parents')}
          {parents.map((p) => row(p.key, p.name, 'Parent'))}
          {row(ADD, '+ Add a parent')}
        </div>
      ) : null}
      <div className="contents" data-people-piece="hosts">
        {heading('Hosts')}
        {hosts.map((h) => row(h.key, h.label, 'Host'))}
      </div>
    </>
  );
}

/** MIDDLE — where the picked person prints. */
export function PeopleBody({
  parents,
  hosts,
  parentsOffered,
  invitation,
  finer,
}: {
  parents: readonly PersonPiece[];
  hosts: readonly HostPiece[];
  parentsOffered: boolean;
  invitation: ReactNode;
  finer: ReactNode;
}) {
  const [pick] = usePick(parents, hosts, parentsOffered);
  const host = hosts.some((h) => h.key === pick);
  return (
    <div className="flex flex-col items-center gap-2" data-people-body={host ? 'host' : 'parent'}>
      <p className="text-center text-xs text-ink/60">
        {host ? 'Guests reply to your host on The Finer Details (“Kindly reply”).' : 'Parents print on The Invitation.'}
      </p>
      {host ? finer : invitation}
    </div>
  );
}

/** RIGHT — the picked person's own card, the add, or the host. */
export function PeopleControls({
  parents,
  hosts,
  parentsOffered,
  cards,
  add,
}: {
  parents: readonly PersonPiece[];
  hosts: readonly HostPiece[];
  parentsOffered: boolean;
  /** Each parent's own guest card, by piece key (null when it could not be loaded). */
  cards: Readonly<Record<string, ReactNode>>;
  /** Part 1's parent list + add (`ParentCards`). */
  add: ReactNode;
}) {
  const [pick] = usePick(parents, hosts, parentsOffered);
  if (pick === ADD) return <section data-people-controls="add">{add}</section>;
  const host = hosts.find((h) => h.key === pick);
  if (host) {
    return (
      <section data-people-controls="host" className="flex flex-col gap-1.5">
        <p className="font-serif text-lg text-ink">{host.label}</p>
        <p className="text-sm text-ink/70">{host.contact ?? 'No number on their account yet.'}</p>
        <p className="text-xs text-ink/55">A host’s number comes from their own account, so it is always the one they use.</p>
      </section>
    );
  }
  const parent = parents.find((p) => p.key === pick);
  if (!parent) return <p className="text-sm text-ink/65">No hosts yet.</p>;
  const card = cards[parent.key] ?? null;
  return (
    <section data-people-controls="parent" className="flex flex-col gap-2">
      <HubSavesImmediately />
      {card ?? <p className="text-sm text-ink/65">{parent.name} prints on the invitation, but their guest card could not be opened just now.</p>}
    </section>
  );
}
