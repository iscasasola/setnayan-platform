/**
 * people-label-handshake.ts — a label is a thing two people stand behind.
 *
 * Owner, 2026-09-29:
 *   > "add partner (to become a couple)"
 *   > "assigning a label needs a handshake"
 *   > "it will show to their requests on people as well"
 *
 * ── THE MODEL (migration 20271254271392) ───────────────────────────────────
 * `person_connections.relation` is the label BOTH people stand behind. On a
 * connection they have already accepted, a new label is ASKED —
 * `proposed_relation` + `proposed_status` — and becomes `relation` only when
 * the person it is about says yes. Until then:
 *   · the asker's row says "Waiting for <name> to confirm";
 *   · it derives NO kin (the tree reads `relation` on confirmed rows only);
 *   · the person asked meets it in People → Requests, with the line
 *     "<name> added you as their <label>" and, when the word changes across
 *     the edge, "That makes <name> your <reciprocal>".
 * Declined, the label is gone quietly; the asker's row says "<name> didn't
 * confirm".
 *
 * On a connection that is itself still a request, the label rides that
 * request: accepting it accepts both, so the request line names the label too.
 *
 * ⚖ WHO NEEDS NO HANDSHAKE. A loved one in your care (an alaga) is not a
 * person_connections row at all — their word lives on `dependents` and is
 * yours to set. And a GROUP is its own mechanism: see
 * `groups-are-joined-not-placed.test.ts`.
 *
 * PURE — no I/O. The database is the control (the transition guard and the
 * one-partner trigger); this module is what the screen and the actions say.
 */

import {
  CONNECTION_RELATIONS,
  INVERSE_RELATION,
  type ConnectionRelation,
} from '@/lib/people-connections';
import { RELATION_LABEL } from '@/lib/people-add';

/** A person's first name, or a fallback that still reads as a sentence. */
function first(name: string | null | undefined, fallback = 'They'): string {
  const v = (name ?? '').trim();
  return v ? (v.split(/\s+/)[0] ?? v) : fallback;
}

/**
 * The line the person ASKED reads. `theirWord` is the label as stored — what
 * the asked person is TO the asker — so "Ice added you as their Sibling".
 * When the word turns over across the edge (parent ↔ child, ninong ↔ inaanak)
 * a second sentence says what the asker becomes to them, because "added you as
 * their Parent" alone leaves the reader to work out that Ice is their child.
 */
export function labelRequestLine(askerName: string, theirWord: ConnectionRelation): string {
  const who = first(askerName, 'Someone');
  const base = `${who} added you as their ${RELATION_LABEL[theirWord]}.`;
  const back = INVERSE_RELATION[theirWord];
  if (back === theirWord) return base;
  return `${base} That makes ${who} your ${RELATION_LABEL[back]}.`;
}

/** The asker's row while the other person has not answered. */
export function waitingForLine(name: string): string {
  return `Waiting for ${first(name)} to confirm`;
}

/** The asker's row after the other person said no. Quiet on purpose. */
export function didNotConfirmLine(name: string): string {
  return `${first(name)} didn’t confirm`;
}

// ── WHERE A ROW STANDS ──────────────────────────────────────────────────────

/**
 * A LABEL ASKED on a connection both people already accepted. `word` is the
 * label as the ASKER said it — what the asked person is to them — never
 * inverted, so the asked person's line reads "Ice added you as their Sibling".
 *   · `waiting_them` — I asked; they have not answered
 *   · `waiting_you`  — they asked me; the row is in my Requests
 *   · `declined`     — I asked and they said no ("didn't confirm")
 */
export type LabelAsk = {
  word: ConnectionRelation;
  state: 'waiting_them' | 'waiting_you' | 'declined';
};

const WORDS: readonly string[] = CONNECTION_RELATIONS;

/**
 * The ask on one row, from one side. A declined ask is the ASKER's to see; to
 * the person who said no it is simply gone ("the label is removed quietly").
 * Only a confirmed connection carries a separate ask — on a request still
 * waiting, the label rides the request.
 */
export function labelAskFor(
  row: { status: string; proposed_relation: string | null; proposed_status: string | null },
  iDeclared: boolean,
): LabelAsk | null {
  if (row.status !== 'confirmed') return null;
  const word = row.proposed_relation;
  if (!word || !WORDS.includes(word)) return null;
  if (row.proposed_status === 'pending') {
    return { word: word as ConnectionRelation, state: iDeclared ? 'waiting_them' : 'waiting_you' };
  }
  if (row.proposed_status === 'declined' && iDeclared) {
    return { word: word as ConnectionRelation, state: 'declined' };
  }
  return null;
}

type Standing = {
  state: 'connected' | 'waiting_them' | 'waiting_you' | 'in_your_care';
  ask: LabelAsk | null;
};

/**
 * Is this row in MY Requests? A request to connect that waits on me, OR a label
 * somebody asked on a connection I already have (owner 2026-09-29: "it will
 * show to their requests on people as well").
 */
export function isRequestForMe(p: Standing): boolean {
  return p.state === 'waiting_you' || p.ask?.state === 'waiting_you';
}

/**
 * Is it THEIR move? My request to connect, or a label I asked. Either way the
 * row is "Waiting for them" — never filed under a family word nobody agreed to.
 */
export function isWaitingOnThem(p: Standing): boolean {
  return p.state === 'waiting_them' || p.ask?.state === 'waiting_them';
}

// ── ONE PARTNER AT A TIME ───────────────────────────────────────────────────

/** The row shape the partner rule reads — the columns, nothing else. */
export type PartnerRuleRow = {
  connection_id: string;
  from_person_id: string;
  to_person_id: string;
  relation: string | null;
  status: string;
  proposed_relation: string | null;
  proposed_status: string | null;
  deleted_at?: string | null;
};

export type PartnerHolding = {
  connectionId: string;
  /** The other person on that row. */
  otherPersonId: string;
  /** `agreed` — you are a couple · `asked` — you asked, they have not answered. */
  kind: 'agreed' | 'asked';
};

/**
 * Does `me` already hold a partner on some OTHER row? The TypeScript mirror of
 * `public.person_holds_a_partner` — the database refuses a second partner
 * whatever this says; this exists so the screen can ASK TO REPLACE, in plain
 * words, instead of relaying a refusal.
 *
 * A request somebody else sent you does not count: otherwise anyone could stop
 * you naming your own partner by asking first.
 */
export function partnerHolding(
  rows: readonly PartnerRuleRow[],
  me: string,
  exceptConnectionId: string | null,
): PartnerHolding | null {
  for (const r of rows) {
    if (r.connection_id === exceptConnectionId) continue;
    if (r.deleted_at) continue;
    if (r.status === 'declined') continue;
    const mine = r.from_person_id === me;
    const theirs = r.to_person_id === me;
    if (!mine && !theirs) continue;
    const other = mine ? r.to_person_id : r.from_person_id;
    if (r.relation === 'partner' && r.status === 'confirmed') {
      return { connectionId: r.connection_id, otherPersonId: other, kind: 'agreed' };
    }
    if (mine && r.relation === 'partner' && (r.status === 'pending' || r.status === 'draft')) {
      return { connectionId: r.connection_id, otherPersonId: other, kind: 'asked' };
    }
    if (mine && r.proposed_relation === 'partner' && r.proposed_status === 'pending') {
      return { connectionId: r.connection_id, otherPersonId: other, kind: 'asked' };
    }
  }
  return null;
}

/** The replace question, in the owner's register: plain, one breath. */
export function replacePartnerQuestion(
  current: { name: string; kind: 'agreed' | 'asked' },
  next: string,
): string {
  const now = first(current.name);
  const them = first(next);
  return current.kind === 'agreed'
    ? `${now} is your partner. Make ${them} your partner instead? ${now} won’t be your partner any more.`
    : `You asked ${now} to be your partner. Ask ${them} instead? We’ll take back the ask to ${now}.`;
}

/** The database's one-partner refusal, recognised so it is never shown raw. */
export function isOnePartnerRefusal(message: string | null | undefined): boolean {
  return /one partner at a time/i.test(message ?? '');
}

// ── "TO BECOME A COUPLE" ─────────────────────────────────────────────────────

/**
 * When to offer "Plan an event together": the partnership is AGREED (both
 * confirmed), no new label is being asked on the row, and the two of them do
 * not already share an event. Where they do, nothing changes — the event is
 * already the thing they are doing together.
 */
export function offersPlanTogether(input: {
  relationForViewer: ConnectionRelation | null;
  connected: boolean;
  askPending: boolean;
  sharesAnEvent: boolean | null;
}): boolean {
  return (
    input.connected &&
    input.relationForViewer === 'partner' &&
    !input.askPending &&
    // NULL = we could not read it. Offering a door the pair may already have
    // walked through is worse than holding one line back.
    input.sharesAnEvent === false
  );
}
