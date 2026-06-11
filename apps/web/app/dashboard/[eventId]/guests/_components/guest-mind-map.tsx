'use client';

import { Fragment, useMemo, useRef, useState, useTransition } from 'react';
import {
  Award,
  ChevronDown,
  ChevronRight,
  Folder,
  Heart,
  Plus,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  SIDE_LABELS,
  ROLE_LABELS,
  guestDisplayName,
  type GuestGroupWithCount,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import {
  importanceGroupOf,
  roleImportanceRank,
  ROLE_GROUP_LABELS,
  type RoleGroup,
} from '@/lib/role-groups';
import { quickAddGuest } from '../quick-add-actions';
import { mapAddGroup, mapAddPlusOne } from '../map-actions';

/**
 * Guest-list MIND MAP (redesign Phase 2 — design locked 2026-06-10).
 *
 * One tree, two lenses over the SAME guest records:
 *  · Side + group — couple → Bride's / Both / Groom's side → custom groups
 *    (+ a "No group yet" bucket per side) → guests → +1s
 *  · Entourage — five sibling role branches (Principal sponsors · Secondary
 *    sponsors · Wedding party · Bearers & flower girl · Officiants), sponsors
 *    as PEERS of the wedding party (PH honor tiers); plain guests excluded.
 *
 * Every "+" creates a REAL record via the existing actions (quickAddGuest /
 * mapAddGroup / mapAddPlusOne) then router.refresh()es, so the map and the
 * flat list stay the same data. Desktop renders a node-and-edge canvas
 * (hidden below lg); mobile renders a vertical expand/collapse tree
 * (lg:hidden) — the locked responsive split.
 */

type Lens = 'sg' | 'entourage';

// Slim projection of GuestRow — the map only needs these fields, so the page
// serializes just this shape to the client (no qr_token/email/mobile payload).
export type GuestMapRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: GuestSide;
  role: GuestRole;
  extra_roles: GuestRole[];
  plus_one_name: string | null;
};

type AddSpec =
  | { type: 'group'; teamSide: GuestSide }
  | { type: 'guest'; side: GuestSide; groupId: string | null; role: GuestRole }
  | { type: 'plus'; guestId: string };

type MapNode = {
  id: string;
  parent: string | null;
  label: string;
  sub?: string;
  kind: 'couple' | 'side' | 'group' | 'nogroup' | 'rolegroup' | 'guest' | 'plus';
  side: GuestSide | null;
  add?: AddSpec;
};

const ENTOURAGE_BRANCHES: { key: RoleGroup; defaultRole: GuestRole }[] = [
  { key: 'principal_sponsors', defaultRole: 'principal_sponsor' },
  { key: 'secondary_sponsors', defaultRole: 'candle_sponsor' },
  { key: 'wedding_party', defaultRole: 'bridesmaid' },
  { key: 'bearers_flower_girl', defaultRole: 'ring_bearer' },
  { key: 'officiants', defaultRole: 'officiant' },
];

const SIDE_ORDER: GuestSide[] = ['bride', 'both', 'groom'];

// Side → accent classes (matches the list's side tints: bride rose · groom sky
// · both amber · structural nodes ink).
function accent(side: GuestSide | null): { text: string; border: string } {
  switch (side) {
    case 'bride':
      return { text: 'text-rose-600', border: 'border-l-rose-400' };
    case 'groom':
      return { text: 'text-sky-600', border: 'border-l-sky-400' };
    case 'both':
      return { text: 'text-amber-600', border: 'border-l-amber-400' };
    default:
      return { text: 'text-ink/50', border: 'border-l-ink/30' };
  }
}

const KIND_ICON = {
  couple: Heart,
  side: Users,
  group: Folder,
  nogroup: Folder,
  rolegroup: Award,
  guest: User,
  plus: UserPlus,
} as const;

function buildTree(
  lens: Lens,
  guests: GuestMapRow[],
  groups: GuestGroupWithCount[],
  memberships: Record<string, string[]>,
): MapNode[] {
  const nodes: MapNode[] = [];
  const bride = guests.find((g) => g.role === 'bride');
  const groom = guests.find((g) => g.role === 'groom');
  const coupleLabel =
    bride && groom
      ? `${bride.first_name} & ${groom.first_name}`
      : 'Your wedding';
  nodes.push({ id: 'root', parent: null, label: coupleLabel, kind: 'couple', side: null });

  const groupsById = Object.fromEntries(groups.map((g) => [g.group_id, g]));
  // A guest's anchor group = first alphabetical membership (same rule as the
  // list's group sections, so both views agree).
  const anchorGroup = (g: GuestMapRow): GuestGroupWithCount | null => {
    let best: GuestGroupWithCount | null = null;
    for (const id of memberships[g.guest_id] ?? []) {
      const grp = groupsById[id];
      if (grp && (!best || grp.label.localeCompare(best.label) < 0)) best = grp;
    }
    return best;
  };

  if (lens === 'sg') {
    for (const side of SIDE_ORDER) {
      nodes.push({
        id: `s-${side}`,
        parent: 'root',
        label: SIDE_LABELS[side],
        kind: 'side',
        side,
        add: { type: 'group', teamSide: side },
      });
    }
    const sortedGroups = [...groups].sort((a, b) => a.label.localeCompare(b.label));
    for (const grp of sortedGroups) {
      nodes.push({
        id: `g-${grp.group_id}`,
        parent: `s-${grp.team_side}`,
        label: grp.label,
        kind: 'group',
        side: grp.team_side,
        add: { type: 'guest', side: grp.team_side, groupId: grp.group_id, role: 'guest' },
      });
    }
    const ungroupedBySide = new Map<GuestSide, number>();
    for (const g of guests) {
      // Bride & Groom ARE the root — they don't re-appear as branch guests.
      if (importanceGroupOf([g.role, ...(g.extra_roles ?? [])]) === 'couple') continue;
      const anchor = anchorGroup(g);
      let parent: string;
      if (anchor) {
        parent = `g-${anchor.group_id}`;
      } else {
        if (!ungroupedBySide.has(g.side)) {
          ungroupedBySide.set(g.side, 0);
          nodes.push({
            id: `ng-${g.side}`,
            parent: `s-${g.side}`,
            label: 'No group yet',
            kind: 'nogroup',
            side: g.side,
            add: { type: 'guest', side: g.side, groupId: null, role: 'guest' },
          });
        }
        parent = `ng-${g.side}`;
      }
      nodes.push({
        id: `p-${g.guest_id}`,
        parent,
        label: guestDisplayName(g),
        sub: g.role !== 'guest' ? ROLE_LABELS[g.role] : undefined,
        kind: 'guest',
        side: g.side,
        add: g.plus_one_name ? undefined : { type: 'plus', guestId: g.guest_id },
      });
      if (g.plus_one_name) {
        nodes.push({
          id: `pl-${g.guest_id}`,
          parent: `p-${g.guest_id}`,
          label: `+1 · ${g.plus_one_name}`,
          kind: 'plus',
          side: g.side,
        });
      }
    }
  } else {
    for (const br of ENTOURAGE_BRANCHES) {
      nodes.push({
        id: `rg-${br.key}`,
        parent: 'root',
        label: ROLE_GROUP_LABELS[br.key],
        kind: 'rolegroup',
        side: null,
        add: { type: 'guest', side: 'both', groupId: null, role: br.defaultRole },
      });
    }
    for (const g of guests) {
      const allRoles = [g.role, ...(g.extra_roles ?? [])];
      const grp = importanceGroupOf(allRoles);
      if (!ENTOURAGE_BRANCHES.some((b) => b.key === grp)) continue;
      // Sub-label = the MOST IMPORTANT role (the one that binned the guest
      // here), so a Bridesmaid-who's-also-a-Ninang labels as the sponsor role
      // under the sponsors branch — label always matches the branch.
      const binRole = allRoles.reduce<GuestRole>(
        (best, r) => (roleImportanceRank(r) < roleImportanceRank(best) ? r : best),
        g.role,
      );
      nodes.push({
        id: `p-${g.guest_id}`,
        parent: `rg-${grp}`,
        label: guestDisplayName(g),
        sub: ROLE_LABELS[binRole],
        kind: 'guest',
        side: g.side,
      });
    }
  }
  // Re-order depth-first (root → its children → their children …) so the flat
  // array IS tree order. The MobileTree accordion renders the array directly,
  // so without this every group/guest would render after the LAST side/group
  // instead of beside its parent. DesktopCanvas is unaffected (absolute layout).
  return toDfsOrder(nodes);
}

function toDfsOrder(nodes: MapNode[]): MapNode[] {
  const children = new Map<string | null, MapNode[]>();
  for (const n of nodes) {
    const list = children.get(n.parent);
    if (list) list.push(n);
    else children.set(n.parent, [n]);
  }
  const out: MapNode[] = [];
  const walk = (id: string | null) => {
    for (const n of children.get(id) ?? []) {
      out.push(n);
      walk(n.id);
    }
  };
  walk(null);
  return out;
}

// ---------------------------------------------------------------------------

export function GuestMindMap({
  eventId,
  guests,
  groups,
  groupMemberships,
}: {
  eventId: string;
  guests: GuestMapRow[];
  groups: GuestGroupWithCount[];
  groupMemberships: Record<string, string[]>;
}) {
  const [lens, setLens] = useState<Lens>('sg');
  const [editing, setEditing] = useState<{ parentId: string; spec: AddSpec } | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [collapsedMobile, setCollapsedMobile] = useState<Set<string>>(new Set());

  const nodes = useMemo(
    () => buildTree(lens, guests, groups, groupMemberships),
    [lens, guests, groups, groupMemberships],
  );

  // Guards the Enter→commit + unmount-blur→commit double-fire (the input blurs
  // while the first transition is still pending — without this, one Enter could
  // add the same guest twice). A ref, not `pending`, because useTransition's
  // flag only flips on the NEXT render.
  const committingRef = useRef(false);

  const commit = () => {
    if (!editing || committingRef.current) return;
    const value = draft.trim();
    if (!value) {
      setEditing(null);
      setDraft('');
      setError(null);
      return;
    }
    const spec = editing.spec;
    // Snapshot the editor we're committing — if the user opens a DIFFERENT
    // node's editor while this resolves, the success path must not wipe it.
    const committed = editing;
    committingRef.current = true;
    startTransition(async () => {
      try {
        let result: { ok: boolean; error?: string };
        if (spec.type === 'group') {
          result = await mapAddGroup(eventId, value, spec.teamSide);
        } else if (spec.type === 'plus') {
          result = await mapAddPlusOne(eventId, spec.guestId, value);
        } else {
          // quickAddGuest needs first + last — split on the LAST space.
          const i = value.lastIndexOf(' ');
          const first = i > 0 ? value.slice(0, i) : value;
          const last = i > 0 ? value.slice(i + 1) : '';
          result = await quickAddGuest(eventId, {
            first_name: first,
            last_name: last,
            side: spec.side,
            role: spec.role,
            group_id: spec.groupId,
          });
        }
        if (!result.ok) {
          setError(result.error ?? 'Something went wrong.');
          return;
        }
        // Only clear if this editor is still the active one (the user may have
        // already opened another node's editor). The actions revalidatePath the
        // guests route, so the transition itself delivers the fresh tree — no
        // extra router.refresh() (which would double-fetch the page).
        setEditing((cur) => (cur === committed ? null : cur));
        setDraft((cur) => (cur === value ? '' : cur));
        setError(null);
      } catch {
        setError('Something went wrong — try again.');
      } finally {
        committingRef.current = false;
      }
    });
  };

  const startAdd = (node: MapNode) => {
    if (!node.add) return;
    setEditing({ parentId: node.id, spec: node.add });
    setDraft('');
    setError(null);
  };

  const addPlaceholder = (spec: AddSpec) =>
    spec.type === 'group' ? 'Group name…' : spec.type === 'plus' ? '+1 name…' : 'First Last…';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Mind map lens" className="inline-flex rounded-lg border border-ink/15 bg-cream p-0.5">
          {(
            [
              { key: 'sg', label: 'Side + group', Icon: Users },
              { key: 'entourage', label: 'Entourage', Icon: Award },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={lens === key}
              onClick={() => {
                setLens(key);
                setEditing(null);
                setDraft('');
                setError(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                lens === key ? 'bg-white font-medium text-ink shadow-sm' : 'text-ink/55 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink/50">
          Tap <Plus aria-hidden className="inline h-3 w-3" /> to grow a branch — it adds a real
          guest or group, synced with the list.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {/* Desktop — node-and-edge canvas */}
      <div className="hidden overflow-auto rounded-xl border border-ink/10 bg-cream/40 p-4 lg:block">
        <DesktopCanvas
          nodes={nodes}
          editing={editing}
          draft={draft}
          pending={pending}
          onDraft={setDraft}
          onCommit={commit}
          onCancel={() => setEditing(null)}
          onAdd={startAdd}
          placeholder={addPlaceholder}
        />
      </div>

      {/* Mobile — vertical expand/collapse tree */}
      <div className="overflow-hidden rounded-xl border border-ink/10 lg:hidden">
        <MobileTree
          nodes={nodes}
          collapsed={collapsedMobile}
          onToggle={(id) =>
            setCollapsedMobile((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          editing={editing}
          draft={draft}
          pending={pending}
          onDraft={setDraft}
          onCommit={commit}
          onCancel={() => setEditing(null)}
          onAdd={startAdd}
          placeholder={addPlaceholder}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared node chrome

type EditorProps = {
  editing: { parentId: string; spec: AddSpec } | null;
  draft: string;
  pending: boolean;
  onDraft: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onAdd: (node: MapNode) => void;
  placeholder: (spec: AddSpec) => string;
};

function AddButton({ node, onAdd, className = '' }: { node: MapNode; onAdd: (n: MapNode) => void; className?: string }) {
  if (!node.add) return null;
  const a = accent(node.side);
  const label =
    node.add.type === 'group' ? 'Add a group' : node.add.type === 'plus' ? 'Add a +1' : 'Add a guest';
  return (
    <button
      type="button"
      onClick={() => onAdd(node)}
      aria-label={label}
      title={label}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-cream ${a.text} hover:bg-white ${className}`}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </button>
  );
}

function InlineEditor({
  spec,
  draft,
  pending,
  onDraft,
  onCommit,
  onCancel,
  placeholder,
}: {
  spec: AddSpec;
  draft: string;
  pending: boolean;
  onDraft: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder: (spec: AddSpec) => string;
}) {
  return (
    <input
      autoFocus
      value={draft}
      disabled={pending}
      placeholder={placeholder(spec)}
      onChange={(e) => onDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={onCommit}
      className="h-7 w-full min-w-0 rounded border border-terracotta/40 bg-white px-2 text-sm text-ink outline-none focus:border-terracotta disabled:opacity-60"
    />
  );
}

// ---------------------------------------------------------------------------
// Desktop canvas — depth columns + bezier edges (the approved prototype layout)

const NODE_W = 176;
const NODE_H = 40;
const ROW_H = 50;
const COL_W = 212;

function DesktopCanvas({ nodes, ...editor }: { nodes: MapNode[] } & EditorProps) {
  const { editing } = editor;

  const layout = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const children = new Map<string | null, MapNode[]>();
    for (const n of nodes) {
      const list = children.get(n.parent) ?? [];
      list.push(n);
      children.set(n.parent, list);
    }
    const depthOf = (n: MapNode): number => {
      let d = 0;
      let cur = n;
      while (cur.parent) {
        cur = byId.get(cur.parent)!;
        d++;
      }
      return d;
    };
    const y = new Map<string, number>();
    let row = 0;
    let editorY = 0; // the exact row reserved for the open inline editor
    const place = (id: string) => {
      const kids = children.get(id) ?? [];
      const editorHere = editing?.parentId === id;
      if (kids.length === 0) {
        // Leaf: its own row; an open editor under it reserves the NEXT row, so
        // node + editor never overlap and never steal a sibling's row.
        y.set(id, row * ROW_H);
        row++;
        if (editorHere) {
          editorY = row * ROW_H;
          row++;
        }
        return;
      }
      for (const k of kids) place(k.id);
      // Editor under a parent renders just below its last child (its own row).
      if (editorHere) {
        editorY = row * ROW_H;
        row++;
      }
      const ys = kids.map((k) => y.get(k.id)!);
      y.set(id, (Math.min(...ys) + Math.max(...ys)) / 2);
    };
    place('root');
    const maxDepth = nodes.length ? Math.max(...nodes.map(depthOf)) : 0;
    return {
      y,
      editorY,
      depthOf,
      width: (maxDepth + (editing ? 2 : 1)) * COL_W + NODE_W,
      height: Math.max(row, 1) * ROW_H + NODE_H,
      byId,
    };
  }, [nodes, editing]);

  return (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      <svg
        width={layout.width}
        height={layout.height}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {nodes.map((n) => {
          if (!n.parent) return null;
          const par = layout.byId.get(n.parent)!;
          const x1 = layout.depthOf(par) * COL_W + NODE_W;
          const y1 = (layout.y.get(par.id) ?? 0) + NODE_H / 2;
          const x2 = layout.depthOf(n) * COL_W;
          const y2 = (layout.y.get(n.id) ?? 0) + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={n.id}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className={`${accent(n.side).text} opacity-40`}
            />
          );
        })}
      </svg>
      {nodes.map((n) => {
        const Icon = KIND_ICON[n.kind];
        const a = accent(n.side);
        const x = layout.depthOf(n) * COL_W;
        const yy = layout.y.get(n.id) ?? 0;
        return (
          <Fragment key={n.id}>
            <div
              className={`absolute flex items-center gap-2 rounded-lg border border-ink/10 border-l-[3px] bg-white px-2.5 shadow-sm ${a.border}`}
              style={{ left: x, top: yy, width: NODE_W, height: NODE_H }}
            >
              <Icon className={`h-4 w-4 shrink-0 ${a.text}`} strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] text-ink">{n.label}</span>
                {n.sub ? <span className="block truncate text-[10px] text-ink/45">{n.sub}</span> : null}
              </span>
              <AddButton node={n} onAdd={editor.onAdd} />
            </div>
            {editing?.parentId === n.id ? (
              <div
                className="absolute flex items-center"
                style={{
                  left: x + COL_W,
                  top: layout.editorY,
                  width: NODE_W,
                  height: NODE_H,
                }}
              >
                <InlineEditor
                  spec={editing.spec}
                  draft={editor.draft}
                  pending={editor.pending}
                  onDraft={editor.onDraft}
                  onCommit={editor.onCommit}
                  onCancel={editor.onCancel}
                  placeholder={editor.placeholder}
                />
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile — vertical expand/collapse tree (the locked phone form)

function MobileTree({
  nodes,
  collapsed,
  onToggle,
  ...editor
}: {
  nodes: MapNode[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
} & EditorProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = (id: string) => nodes.filter((n) => n.parent === id);
  const depthOf = (n: MapNode): number => {
    let d = 0;
    let cur = n;
    while (cur.parent) {
      cur = byId.get(cur.parent)!;
      d++;
    }
    return d;
  };
  const visible = (n: MapNode): boolean => {
    let p = n.parent;
    while (p) {
      if (collapsed.has(p)) return false;
      p = byId.get(p)?.parent ?? null;
    }
    return true;
  };

  return (
    <div>
      {nodes.map((n) => {
        if (!visible(n)) return null;
        const Icon = KIND_ICON[n.kind];
        const a = accent(n.side);
        const d = depthOf(n);
        const kids = childrenOf(n.id);
        const isCollapsed = collapsed.has(n.id);
        return (
          <Fragment key={n.id}>
            <div
              className={`flex min-h-[48px] items-center gap-2 border-b border-ink/5 border-l-[3px] py-2 pr-3 ${a.border}`}
              style={{ paddingLeft: 12 + d * 18 }}
            >
              {kids.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onToggle(n.id)}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `Expand ${n.label}` : `Collapse ${n.label}`}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-ink/40"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />
                  )}
                </button>
              ) : (
                <span className="w-6 shrink-0" aria-hidden />
              )}
              <Icon className={`h-4 w-4 shrink-0 ${a.text}`} strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm text-ink">{n.label}</span>
                {n.sub ? <span className="block truncate text-[11px] text-ink/45">{n.sub}</span> : null}
              </span>
              {kids.length > 0 ? (
                <span className="text-[11px] text-ink/35">{kids.length}</span>
              ) : null}
              <AddButton node={n} onAdd={editor.onAdd} />
            </div>
            {editor.editing?.parentId === n.id ? (
              <div className="border-b border-ink/5 py-2 pr-3" style={{ paddingLeft: 12 + (d + 1) * 18 + 32 }}>
                <InlineEditor
                  spec={editor.editing.spec}
                  draft={editor.draft}
                  pending={editor.pending}
                  onDraft={editor.onDraft}
                  onCommit={editor.onCommit}
                  onCancel={editor.onCancel}
                  placeholder={editor.placeholder}
                />
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
