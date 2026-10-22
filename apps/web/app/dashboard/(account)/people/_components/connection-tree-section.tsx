import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKinFor, namesForKin } from '@/lib/kinship-read-core';
import { buildKinTree, type KinLayer, type KinPerson } from '@/lib/kinship-tree';

/**
 * The connection tree, drawn.
 *
 * ── IT IS A CONNECTION TREE, NOT A FAMILY TREE ─────────────────────────────
 * The owner renamed it (OD1, `Kin_Graph_Adoption_and_Deltas_SPEC_2026-07-30.md`
 * §"it is a CONNECTION tree, not a family tree"), so the copy here uses his
 * word. Three layers, exactly as that document names them: family, ritual
 * (ninong/ninang), and the courtesy titos and titas that come through friends.
 *
 * ── WHY IT IS A SECTION AND NOT A PAGE ─────────────────────────────────────
 * The same spec, §6: *"Extend `connections-panel.tsx`. Do not build a new page
 * — the People surface exists."* That component has since been replaced by
 * `people-roster-view.tsx`; the instruction is about the SURFACE, so this
 * renders underneath the roster on `/dashboard/people`. The roster stays the
 * place you ADD someone; this is what those additions add up to.
 *
 * ── THE TWO THINGS THIS SCREEN MUST NOT SAY ────────────────────────────────
 *   1. "You have no relatives" when the read was refused. `measured === false`
 *      renders the unknown state, never the empty one.
 *   2. Anybody's name that the 2026-07-05 name rule does not permit. A person
 *      with `name === null` renders as their kin word alone.
 */
export async function ConnectionTreeSection({ userId, bare = false }: { userId: string; bare?: boolean }) {
  // `bare` (2026-10-22, People wears the Guest list): the roster's folded "Your connection tree" section is the
  // heading, so the frame draws none and no tile — rows in the Guest row's anatomy, on the page's own ground.
  const Frame = bare ? BareFrame : FramedFrame;
  const supabase = await createClient();
  const { kin, measured } = await getKinFor(supabase, createAdminClient, userId);

  // Names come from the USER's client, through the one function allowed to
  // resolve them — never from the service-role client that walked the graph.
  const names = measured ? await namesForKin(supabase, kin.map((k) => k.personId)) : new Map();
  const tree = buildKinTree(kin, (id) => names.get(id) ?? null);

  if (!measured) {
    return (
      <Frame>
        <div className={`${bare ? 'py-3' : 'sn-tile'} flex items-start gap-3`}>
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-ink">We couldn’t work out your tree just now.</p>
            {/* ⚠ NOT "you have no relatives". We do not know — and saying the
                one when we mean the other is the defect this whole section was
                written under. */}
            <p className="text-sm text-ink/65">
              This is a problem on our side, not an empty family. Your connections are safe — please
              refresh in a moment.
            </p>
          </div>
        </div>
      </Frame>
    );
  }

  if (tree.total === 0) {
    return (
      <Frame>
        <p className={`${bare ? 'py-2' : 'sn-tile'} text-sm text-ink/65`}>
          Once you and your closest people confirm each other, the rest works itself out — lolo and
          lola, tito and tita, pinsan and apo appear here on their own. You never add them.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="space-y-6">
        {tree.layers.map((layer) => (
          <Layer key={layer.basis} layer={layer} />
        ))}
      </div>
    </Frame>
  );
}

function BareFrame({ children }: { children: React.ReactNode }) {
  return (
    <div id="connection-tree" className="scroll-mt-24 pb-3" data-connection-tree="">
      <p className="mb-2 text-[13px] text-ink/60">
        Worked out from the people you’ve both confirmed — never from a request still waiting on an answer.
      </p>
      {children}
    </div>
  );
}

function FramedFrame({ children }: { children: React.ReactNode }) {
  return (
    <section id="connection-tree" className="mt-10 scroll-mt-24" aria-labelledby="connection-tree-heading">
      {/* The People page's ONE heading style (owner 2026-09-28 redesign,
          problem 5: four heading styles lived on one page). */}
      <h2
        id="connection-tree-heading"
        className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55"
      >
        Your connection tree
      </h2>
      <p className="mb-4 text-sm text-ink/60">
        Worked out from the people you’ve both confirmed — never from a request still waiting on an
        answer.
      </p>
      {children}
    </section>
  );
}

/**
 * One layer.
 *
 * BLOOD IS NEVER BEHIND A DISCLOSURE. `collapseAfter` is null for the family
 * and ritual layers by construction in `kinship-tree.ts`, so the `<details>`
 * below can only ever wrap surplus COURTESY kin — which is the owner's rule
 * ("blood must not be crowded out") expressed in markup.
 */
function Layer({ layer }: { layer: KinLayer }) {
  const cap = layer.collapseAfter;
  const shown = cap === null ? layer.people : layer.people.slice(0, cap);
  const hidden = cap === null ? [] : layer.people.slice(cap);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">{layer.title}</h3>
        <span className="text-xs text-ink/50">{layer.people.length}</span>
      </div>
      <p className="mb-3 text-sm text-ink/60">{layer.blurb}</p>
      <ul>
        {shown.map((p) => (
          <li key={`${p.personId}-${p.kind}`}>
            <Person person={p} />
          </li>
        ))}
      </ul>
      {hidden.length > 0 ? (
        <details className="mt-2 group">
          {/* The remainder is COUNTED, never silently dropped — volume is
              managed, not hidden. */}
          <summary className="cursor-pointer list-none text-sm font-medium text-ink/70 hover:text-ink">
            Show {hidden.length} more {hidden.length === 1 ? 'person' : 'people'}
          </summary>
          <ul className="mt-2">
            {hidden.map((p) => (
              <li key={`${p.personId}-${p.kind}`}>
                <Person person={p} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * One person.
 *
 * ⚠ BLOOD AND COURTESY CARRY THE SAME WORD AND ARE NOT THE SAME FACT. "My
 * mother's sister" and "my mother's best friend" are both Tita. The distinction
 * is drawn THREE ways, so it survives a stylesheet change, a monochrome print
 * and a screen reader:
 *   · the layer each one sits in,
 *   · the tint of the kin chip,
 *   · and the `via` line in words, which is the one that cannot be lost.
 * Colour alone would fail the last two.
 */
function Person({ person }: { person: KinPerson }) {
  return (
    <div className="flex min-h-[56px] flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-ink/10 py-2.5">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chipTint(person)}`}>
        {person.label}
      </span>
      {person.name ? (
        <span className="text-sm font-medium text-ink">{person.name}</span>
      ) : (
        /* The name rule (owner 2026-07-05) does not permit this one. The spec's
           word is "placeholder, never a name" — so we describe the relationship
           and say plainly why the name is absent. An id or an email here would
           break the rule the placeholder exists to keep. */
        <span className="text-sm italic text-ink/50">Name shown once you’re connected</span>
      )}
      <span className="ml-auto text-[13px] text-ink/60">through {person.via}</span>
    </div>
  );
}

function chipTint(person: KinPerson): string {
  switch (person.basis) {
    case 'blood':
      return 'bg-ink/10 text-ink';
    case 'ritual':
      return 'bg-terracotta/15 text-terracotta-700';
    case 'courtesy':
      // Deliberately the lightest of the three: present in full, never louder
      // than blood.
      return 'border border-ink/15 bg-transparent text-ink/70';
  }
}
