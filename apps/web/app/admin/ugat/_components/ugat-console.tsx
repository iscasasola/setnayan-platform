'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import {
  UGAT_TYPES,
  UGAT_TYPE_BY_ID,
  UGAT_TYPE_VOCAB,
  UGAT_ICON_PATHS,
  UGAT_FINDINGS,
  UGAT_FINDINGS_BY_ID,
  UGAT_JOINTS,
  platformEdges,
  findingsForType,
  findingForEdge,
  jointsForEdge,
  type UgatTypeMeta,
  type UgatFinding,
  type UgatJoint,
  type UgatEntityType,
} from '@/lib/ugat/graph';
import type {
  UgatCounts,
  UgatSavedSearch,
  UgatTableKey,
  UgatTablePage,
  UgatSearchGroup,
} from '@/lib/ugat/data';
import { fetchUgatTable, fetchUgatSearch, fetchUgatSavedSearch } from '../actions';
import './ugat-console.css';

/* ── inline icon helper (SVG innerHTML, no network — same set as the map) ── */
function Ico({ name, cls }: { name: string; cls?: string }) {
  return (
    <svg
      className={`ug-ico${cls ? ' ' + cls : ''}`}
      viewBox="0 0 24 24"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: UGAT_ICON_PATHS[name] ?? UGAT_ICON_PATHS.tag ?? '' }}
    />
  );
}

type Control = 'map' | 'tables';
type Resolution = 'entities' | 'joints' | 'fields';

/** Nodes carry their live count once merged with UgatCounts. */
type LiveNode = UgatTypeMeta & { count: number; countLabel: string };

const TABLE_META: Array<{ key: UgatTableKey; label: string; type: UgatEntityType }> = [
  { key: 'users', label: 'Users', type: 'user' },
  { key: 'events', label: 'Events', type: 'event' },
  { key: 'guests', label: 'Guests', type: 'guest' },
  { key: 'vendors', label: 'Vendors', type: 'vendor' },
  { key: 'services', label: 'Service cards', type: 'service' },
  { key: 'orders', label: 'Orders', type: 'order' },
  { key: 'threads', label: 'Threads', type: 'thread' },
  { key: 'billing', label: 'Billing', type: 'billing' },
];

const TYPE_TO_TABLE: Partial<Record<UgatEntityType, UgatTableKey>> = {
  user: 'users',
  event: 'events',
  guest: 'guests',
  vendor: 'vendors',
  service: 'services',
  order: 'orders',
  thread: 'threads',
  billing: 'billing',
};

function fmtCount(n: number): string {
  return n.toLocaleString('en-PH');
}

function relTime(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

/* ═════════════════════════════════════════════════════════════════════════
   THE CONSOLE
   ═════════════════════════════════════════════════════════════════════════ */
export function UgatConsole({
  counts,
  savedSearches,
}: {
  counts: UgatCounts;
  savedSearches: UgatSavedSearch[];
}) {
  const [control, setControl] = useState<Control>('map');
  const [resolution, setResolution] = useState<Resolution>('entities');
  const [health, setHealth] = useState(false);
  const [openNode, setOpenNode] = useState<string | null>(null);
  const [openEdge, setOpenEdge] = useState<[string, string] | null>(null);
  const [openFinding, setOpenFinding] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  // cross-control table switching: the TablesView registers its setter here so
  // the omnibox + node cards can jump to a specific table when they switch to
  // the Tables control. `pendingTable` carries the target across the mount.
  const tableSetterRef = useRef<((t: UgatTableKey) => void) | null>(null);
  const [pendingTable, setPendingTable] = useState<UgatTableKey>('users');
  const goToTable = useCallback((t: UgatTableKey) => {
    setPendingTable(t);
    setControl('tables');
    // if the TablesView is already mounted, switch it immediately
    tableSetterRef.current?.(t);
  }, []);

  // merge live counts into the static type nodes
  const nodes: LiveNode[] = useMemo(() => {
    return UGAT_TYPES.map((t) => {
      const count = counts[t.countKey] ?? 0;
      let countLabel = fmtCount(count);
      if (t.type === 'taxonomy') {
        countLabel = fmtCount(counts.detail.taxonomyLeaves);
      }
      return { ...t, count, countLabel };
    });
  }, [counts]);

  const nodeById = useMemo(() => {
    const m: Record<string, LiveNode> = {};
    for (const n of nodes) m[n.id] = n;
    return m;
  }, [nodes]);

  const edges = useMemo(() => platformEdges(), []);

  const findingCount = UGAT_FINDINGS.length;

  const closePanels = useCallback(() => {
    setOpenNode(null);
    setOpenEdge(null);
    setOpenFinding(null);
  }, []);

  // Esc closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanels();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanels]);

  const openTypeNode = useCallback((id: string) => {
    setOpenEdge(null);
    setOpenFinding(null);
    setOpenNode(id);
    setHighlight(id);
  }, []);

  const panelOpen = openNode || openEdge || openFinding;

  return (
    <div className="ug-root">
      {/* ── header ── */}
      <div className="ug-topbar">
        <div className="ug-brand">
          <div className="ug-brand-t">
            <span className="ug-brand-dot" />
            Ugat Console
          </div>
          <div className="ug-brand-s">
            The live entity map — it shows what connects, and documents each binding.
          </div>
        </div>

        <div className="ug-toggle" role="group" aria-label="View">
          <button
            type="button"
            className={control === 'map' ? 'on' : ''}
            onClick={() => setControl('map')}
          >
            <Ico name="link" />
            Map
          </button>
          <button
            type="button"
            className={control === 'tables' ? 'on' : ''}
            onClick={() => setControl('tables')}
          >
            <Ico name="layers" />
            Tables
          </button>
        </div>

        <button
          type="button"
          className={`ug-healthbtn${health ? ' on' : ''}`}
          onClick={() => setHealth((h) => !h)}
          title="Toggle the 2026-07-05 audit overlay"
        >
          <span className="ug-hb-dot" />
          Health
          <span className="ug-hb-ct">{findingCount}</span>
        </button>

        <div className="ug-restoggle" role="group" aria-label="Resolution">
          {(['entities', 'joints', 'fields'] as Resolution[]).map((r) => (
            <button
              key={r}
              type="button"
              className={resolution === r ? 'on' : ''}
              onClick={() => setResolution(r)}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── omnibox ── */}
      <Omnibox
        savedSearches={savedSearches}
        onOpenRecord={(typeNodeId) => {
          setControl('map');
          openTypeNode(typeNodeId);
        }}
        onRunSaved={(table) => goToTable(table)}
      />

      {/* ── scope note ── */}
      <div className="ug-scopebar">
        <span className="ug-scope-lab">Scope</span>
        <span className="ug-schip on">
          <Ico name="link" />
          Platform <span className="ug-sub">type-level</span>
        </span>
        <span className="ug-scope-note">
          <Ico name="info" />
          Slice 1 — platform type-level only. Per-event &amp; per-vendor row scopes are slice 2.
          Counts are live (updated {relTime(counts.computedAt)}); joint cards are static schema
          documentation.
        </span>
      </div>

      {/* ── legend ── */}
      <div className="ug-legend">
        <span className="ug-li">
          <span className="ug-sw" style={{ background: 'var(--ug-edge-core)' }} /> connection
        </span>
        <span className="ug-li">
          <span className="ug-sw" style={{ background: 'var(--ug-report)' }} /> broken (audit)
        </span>
        <span className="ug-li">
          <span className="ug-sw" style={{ background: 'var(--ug-wait)' }} /> drift risk (audit)
        </span>
        <span className="ug-li">
          <span className="ug-sw" style={{ background: 'var(--ug-gold)' }} /> a joint (the edge is a
          table too)
        </span>
      </div>

      {/* ── stage ── */}
      {control === 'map' ? (
        <MapCanvas
          nodes={nodes}
          nodeById={nodeById}
          edges={edges}
          resolution={resolution}
          health={health}
          highlight={highlight}
          onNodeClick={openTypeNode}
          onEdgeClick={(a, b) => {
            setOpenNode(null);
            setOpenFinding(null);
            setOpenEdge([a, b]);
          }}
          onFindingClick={(id) => {
            setOpenNode(null);
            setOpenEdge(null);
            setOpenFinding(id);
          }}
        />
      ) : (
        <TablesView
          registerSetTable={(fn) => {
            tableSetterRef.current = fn;
          }}
          onRowOpen={(typeNodeId) => {
            /* a row opens the type node card (record cards are slice-2 detail) */
            setControl('map');
            openTypeNode(typeNodeId);
          }}
          initialTable={pendingTable}
        />
      )}

      {/* ── side panel (card) ── */}
      <div
        className={`ug-scrim${panelOpen ? ' on' : ''}`}
        onClick={closePanels}
        aria-hidden
      />
      <aside className={`ug-card${panelOpen ? ' on' : ''}`} aria-hidden={!panelOpen}>
        {openNode && nodeById[openNode] && (
          <NodeCard
            node={nodeById[openNode]}
            counts={counts}
            nodeById={nodeById}
            onClose={closePanels}
            onOpenNode={openTypeNode}
            onOpenTable={(t) => {
              goToTable(t);
              closePanels();
            }}
            onOpenEdge={(a, b) => setOpenEdge([a, b])}
            onOpenFinding={(id) => {
              setHealth(true);
              setOpenFinding(id);
              setOpenNode(null);
            }}
          />
        )}
        {openEdge && (
          <EdgeCard
            a={openEdge[0]}
            b={openEdge[1]}
            nodeById={nodeById}
            onClose={closePanels}
            onOpenFinding={(id) => {
              setHealth(true);
              setOpenFinding(id);
              setOpenEdge(null);
            }}
          />
        )}
        {openFinding && UGAT_FINDINGS_BY_ID[openFinding] && (
          <FindingCard finding={UGAT_FINDINGS_BY_ID[openFinding]} onClose={closePanels} />
        )}
      </aside>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   MAP CANVAS — inline SVG, pan/zoom, node + edge rendering. Vanilla math port.
   ═════════════════════════════════════════════════════════════════════════ */
function MapCanvas({
  nodes,
  nodeById,
  edges,
  resolution,
  health,
  highlight,
  onNodeClick,
  onEdgeClick,
  onFindingClick,
}: {
  nodes: LiveNode[];
  nodeById: Record<string, LiveNode>;
  edges: ReturnType<typeof platformEdges>;
  resolution: Resolution;
  health: boolean;
  highlight: string | null;
  onNodeClick: (id: string) => void;
  onEdgeClick: (a: string, b: string) => void;
  onFindingClick: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, k: 0.92 });
  const panning = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // fit-to-view on mount
  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 150;
    const maxX = Math.max(...xs) + 150;
    const minY = Math.min(...ys) - 100;
    const maxY = Math.max(...ys) + 100;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const rect = wrap.getBoundingClientRect();
    const k = Math.min(rect.width / bw, rect.height / bh, 1.15);
    setView({
      x: (rect.width - bw * k) / 2 - minX * k,
      y: (rect.height - bh * k) / 2 - minY * k,
      k,
    });
  }, [nodes]);

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setView((v) => {
      const nk = Math.max(0.4, Math.min(2.4, v.k * factor));
      return {
        x: mx - (mx - v.x) * (nk / v.k),
        y: my - (my - v.y) * (nk / v.k),
        k: nk,
      };
    });
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.ug-node')) return;
    panning.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    wrapRef.current?.classList.add('grabbing');
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!panning.current) return;
      setView((v) => ({
        ...v,
        x: panning.current!.vx + (e.clientX - panning.current!.x),
        y: panning.current!.vy + (e.clientY - panning.current!.y),
      }));
    };
    const up = () => {
      panning.current = null;
      wrapRef.current?.classList.remove('grabbing');
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const zoomBy = (f: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    setView((v) => {
      const nk = Math.max(0.4, Math.min(2.4, v.k * f));
      return {
        x: mx - (mx - v.x) * (nk / v.k),
        y: my - (my - v.y) * (nk / v.k),
        k: nk,
      };
    });
  };

  const showJoints = resolution !== 'entities';
  const lodDetail = view.k > 0.85;

  const nodeWidth = (n: LiveNode) =>
    Math.max(112, Math.min(230, n.name.length * 7 + 78));

  return (
    <div className="ug-stage">
      <div
        ref={wrapRef}
        className="ug-mapwrap"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        <svg className="ug-mapsvg">
          <defs>
            <filter id="ugNodeShadow" x="-40%" y="-40%" width="180%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3.2" floodColor="#000" floodOpacity="0.42" />
            </filter>
          </defs>
          <g
            transform={`translate(${view.x},${view.y}) scale(${view.k})`}
            className={lodDetail ? 'ug-lod-detail' : ''}
          >
            {/* edges */}
            {edges.map((e, i) => {
              const a = nodeById[e.from];
              const b = nodeById[e.to];
              if (!a || !b) return null;
              const ax = a.x;
              const ay = a.y;
              const bx = b.x;
              const by = b.y;
              const mx = (ax + bx) / 2;
              const my = (ay + by) / 2;
              const dx = bx - ax;
              const dy = by - ay;
              const cx = mx - dy * 0.08;
              const cy = my + dx * 0.08;
              const c1x = ax + dx / 3 - dy * 0.08;
              const c1y = ay + dy / 3 + dx * 0.08;
              const c2x = ax + (2 * dx) / 3 - dy * 0.08;
              const c2y = ay + (2 * dy) / 3 + dx * 0.08;
              const d = `M${ax} ${ay} C${c1x} ${c1y} ${c2x} ${c2y} ${bx} ${by}`;
              const joints = jointsForEdge(e.from, e.to);
              const primary = joints[0];
              const finding =
                health && (findingForEdge(e.from, e.to) ??
                  (primary?.healthId ? UGAT_FINDINGS_BY_ID[primary.healthId] : undefined));
              const jointName = primary?.joint ?? (primary ? '(direct FK)' : null);
              const short =
                jointName && jointName.length > 18
                  ? jointName.slice(0, 17) + '…'
                  : jointName;
              const chW = short ? Math.max(58, short.length * 5.4 + 30) : 0;
              return (
                <g className="ug-edge-group" key={i}>
                  <path className="ug-edge-glow" d={d} />
                  <path
                    className={`ug-edge ug-clickable${finding ? ' ug-h-' + finding.sev : ''}`}
                    d={d}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEdgeClick(e.from, e.to);
                    }}
                  />
                  {/* joint chip at midpoint when at joints/fields resolution */}
                  {showJoints && primary && short && (
                    <g
                      className={`ug-jointmark${joints.length > 1 ? ' multi' : ''}${
                        primary.healthId ? ' ug-h-' + (UGAT_FINDINGS_BY_ID[primary.healthId]?.sev ?? '') : ''
                      }`}
                      transform={`translate(${cx - chW / 2},${cy - 9})`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEdgeClick(e.from, e.to);
                      }}
                    >
                      <rect x={0} y={0} width={chW} height={18} rx={6} />
                      <svg
                        viewBox="0 0 24 24"
                        x={5}
                        y={3}
                        width={12}
                        height={12}
                        className="ug-jm-ic"
                        dangerouslySetInnerHTML={{
                          __html: (joints.length > 1 ? UGAT_ICON_PATHS.layers : UGAT_ICON_PATHS.link) ?? '',
                        }}
                      />
                      <text x={20} y={9} dominantBaseline="central">
                        {(joints.length > 1 ? `(${joints.length}) ` : '') + short}
                      </text>
                    </g>
                  )}
                  {/* verb label — LOD-gated + hover */}
                  <text className="ug-edge-lab" x={cx} y={cy - 6} textAnchor="middle">
                    {e.verb}
                  </text>
                  {/* health marker (only when no joint chip sits at the midpoint) */}
                  {finding && !(showJoints && primary) && (
                    <g
                      className={`ug-hmark ${finding.sev}`}
                      transform={`translate(${cx},${cy})`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onFindingClick(finding.id);
                      }}
                    >
                      <circle r={8} />
                      <text>{finding.sev === 'red' ? '!' : '~'}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* nodes */}
            {nodes.map((n) => {
              const vocab = UGAT_TYPE_VOCAB[n.type];
              const w = nodeWidth(n);
              const h = 40;
              const nodeFindings = health ? findingsForType(n.type) : [];
              const worst = nodeFindings.some((f) => f.sev === 'red')
                ? 'red'
                : nodeFindings.some((f) => f.sev === 'amber')
                  ? 'amber'
                  : null;
              return (
                <g
                  key={n.id}
                  className={`ug-node${highlight === n.id ? ' sel' : ''}${
                    worst ? ' ug-h-' + worst : ''
                  }`}
                  transform={`translate(${n.x - w / 2},${n.y - h / 2})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeClick(n.id);
                  }}
                >
                  <rect
                    className="ug-chip-bg"
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    rx={12}
                    style={{ stroke: vocab.color }}
                    filter="url(#ugNodeShadow)"
                  />
                  <rect
                    x={10}
                    y={h / 2 - 11}
                    width={22}
                    height={22}
                    rx={6}
                    fill={vocab.colorBg}
                  />
                  <svg
                    viewBox="0 0 24 24"
                    x={14}
                    y={h / 2 - 7}
                    width={14}
                    height={14}
                    style={{ stroke: vocab.color, fill: 'none', strokeWidth: 1.75 }}
                    dangerouslySetInnerHTML={{ __html: UGAT_ICON_PATHS[n.icon] ?? '' }}
                  />
                  <text className="ug-chip-lab" x={40} y={h / 2 - 4} dominantBaseline="middle">
                    {n.name}
                  </text>
                  <text className="ug-chip-ct" x={40} y={h / 2 + 9} dominantBaseline="middle">
                    {n.countLabel}
                  </text>
                  {/* health badge */}
                  {worst && (
                    <g
                      className={`ug-hmark ${worst}`}
                      transform={`translate(${w - 6},6)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const f0 = nodeFindings[0];
                        if (f0) onFindingClick(f0.id);
                      }}
                    >
                      <circle r={8} />
                      <text>{worst === 'red' ? '!' : '~'}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="ug-maphint">
          <Ico name="link" />
          Drag to pan · scroll or ± to zoom · click a node
        </div>
        <div className="ug-mapctl">
          <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomBy(0.83)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={fit} aria-label="Fit to view">
            ⤢
          </button>
        </div>
        {health && (
          <div className="ug-healthnote">
            <Ico name="alert" />
            Health overlay — as of the 2026-07-05 audit. Live telemetry coming (slice 2).
          </div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   NODE CARD — identity · status · connections rail (live counts + links)
   ═════════════════════════════════════════════════════════════════════════ */
function NodeCard({
  node,
  counts,
  nodeById,
  onClose,
  onOpenNode,
  onOpenTable,
  onOpenEdge,
  onOpenFinding,
}: {
  node: LiveNode;
  counts: UgatCounts;
  nodeById: Record<string, LiveNode>;
  onClose: () => void;
  onOpenNode: (id: string) => void;
  onOpenTable: (t: UgatTableKey) => void;
  onOpenEdge: (a: string, b: string) => void;
  onOpenFinding: (id: string) => void;
}) {
  const vocab = UGAT_TYPE_VOCAB[node.type];
  const findings = findingsForType(node.type);
  const tableKey = TYPE_TO_TABLE[node.type];

  // per-node kv extras from the live detail
  const kv: Array<[string, string]> = [['Total', node.countLabel]];
  if (node.type === 'vendor') {
    kv.push(['Verified (marketplace)', fmtCount(node.count)]);
    kv.push(['All orgs', fmtCount(counts.detail.vendorTotalOrgs)]);
  } else if (node.type === 'billing') {
    kv.push(['Active subscriptions', fmtCount(counts.detail.billingActiveSubs)]);
    kv.push(['Tokens in circulation', fmtCount(counts.detail.billingTokensInCirculation)]);
    kv.push(['Rate', '₱100 / token']);
    kv.push(['Commission', '0%']);
  } else if (node.type === 'order') {
    kv.push(['Pending payment', fmtCount(counts.detail.ordersPending)]);
  } else if (node.type === 'taxonomy') {
    kv.length = 0;
    kv.push(['Folders', fmtCount(counts.detail.taxonomyFolders)]);
    kv.push(['Tiles', fmtCount(counts.detail.taxonomyTiles)]);
    kv.push(['Leaves', fmtCount(counts.detail.taxonomyLeaves)]);
    kv.push(['Refinement sets', fmtCount(counts.detail.taxonomyRefinementSets)]);
  }

  return (
    <>
      <div className="ug-card-head">
        <div className="ug-av" style={{ background: vocab.colorBg, color: vocab.color }}>
          <Ico name={node.icon} />
        </div>
        <div className="ug-ti">
          <div className="ug-nm">{node.name}</div>
          <div className="ug-row2">
            <span className="ug-badge neutral">{vocab.label} · type node</span>
            <span className="ug-id">{node.id}</span>
          </div>
        </div>
        <button type="button" className="ug-card-x" onClick={onClose} aria-label="Close">
          <Ico name="x" />
        </button>
      </div>

      <div className="ug-status-line">
        <Ico name="check" />
        <span>
          <b>{node.countLabel}</b> · {node.blurb} · <span className="ug-live-dot">live</span>
        </span>
      </div>

      <div className="ug-card-body">
        {/* live key-values */}
        <div className="ug-sect">
          <div className="ug-lab">
            <Ico name="info" />
            At a glance <span className="ug-n">live</span>
          </div>
          <div className="ug-kv">
            {kv.map(([k, v]) => (
              <div className="ug-kv-r" key={k}>
                <span className="ug-k">{k}</span>
                <span className="ug-v">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* documented fields */}
        <div className="ug-sect">
          <div className="ug-lab">
            <Ico name="layers" />
            Table &amp; columns
          </div>
          <div className="ug-kv">
            <div className="ug-kv-r">
              <span className="ug-k">Table</span>
              <span className="ug-v mono">{node.table}</span>
            </div>
            {node.fields.map((f) => (
              <div className="ug-kv-r" key={f.name}>
                <span className="ug-k mono">
                  {f.key ? <span className="ug-fkey">{f.key}</span> : null} {f.name}
                </span>
                <span className="ug-v">{f.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* connections rail — live counts / links to the other type nodes */}
        <div className="ug-sect">
          <div className="ug-lab">
            <Ico name="link" />
            Connections <span className="ug-n">{node.edges.length}</span>
          </div>
          <div className="ug-conn-list">
            {node.edges.map((eg) => {
              const other = nodeById[eg.to];
              if (!other) return null;
              const overt = UGAT_TYPE_VOCAB[other.type];
              return (
                <button
                  type="button"
                  className="ug-conn"
                  key={eg.to + eg.verb}
                  onClick={() => onOpenEdge(node.id, eg.to)}
                  title={`${node.name} ${eg.verb} ${other.name}`}
                >
                  <span
                    className="ug-cav"
                    style={{ background: overt.colorBg, color: overt.color }}
                  >
                    <Ico name={other.icon} />
                  </span>
                  <span className="ug-cb">
                    <span className="ug-cn">
                      {eg.verb} {other.name}
                    </span>
                    <span className="ug-cs">{other.countLabel} rows</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* health findings on this type (static registry) */}
        {findings.length > 0 && (
          <div className="ug-sect">
            <div className="ug-lab">
              <Ico name="alert" />
              Audit findings <span className="ug-n">{findings.length}</span>
            </div>
            {findings.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`ug-finding-row ${f.sev}`}
                onClick={() => onOpenFinding(f.id)}
              >
                <span className="ug-fmark">{f.sev === 'red' ? '!' : '~'}</span>
                <span>
                  <b>{f.title}</b>
                  <span className="ug-fone">{f.oneliner}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* action rails are slice 3 — shown as the dashed-honesty pattern */}
        <div className="ug-sect">
          <div className="ug-lab">
            <Ico name="lock" />
            Actions
          </div>
          <div className="ug-actionrail">
            {tableKey && (
              <button type="button" className="ug-actbtn solid" onClick={() => onOpenTable(tableKey)}>
                <Ico name="layers" />
                Open {UGAT_TYPE_VOCAB[node.type].label} table
              </button>
            )}
            {node.href && (
              <Link className="ug-actbtn" href={node.href}>
                <Ico name="externalLink" />
                Open in admin
              </Link>
            )}
            <span className="ug-actbtn dashed" title="Action rails ship in slice 3">
              <Ico name="bolt" />
              Record actions — slice 3
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   EDGE CARD — the joint(s) documenting a connection (static schema doc)
   ═════════════════════════════════════════════════════════════════════════ */
function EdgeCard({
  a,
  b,
  nodeById,
  onClose,
  onOpenFinding,
}: {
  a: string;
  b: string;
  nodeById: Record<string, LiveNode>;
  onClose: () => void;
  onOpenFinding: (id: string) => void;
}) {
  const na = nodeById[a];
  const nb = nodeById[b];
  const joints = jointsForEdge(a, b);
  const finding = findingForEdge(a, b);

  return (
    <>
      <div className="ug-card-head">
        <div className="ug-av" style={{ background: 'var(--ug-gold-soft)', color: 'var(--ug-lock)' }}>
          <Ico name="link" />
        </div>
        <div className="ug-ti">
          <div className="ug-nm">
            {na?.name} ↔ {nb?.name}
          </div>
          <div className="ug-row2">
            <span className="ug-badge gold">Connection · {joints.length || 1} joint{joints.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <button type="button" className="ug-card-x" onClick={onClose} aria-label="Close">
          <Ico name="x" />
        </button>
      </div>

      <div className="ug-status-line">
        <Ico name="info" />
        <span>
          Static schema documentation — correct until the schema changes.
        </span>
      </div>

      <div className="ug-card-body">
        {joints.length === 0 && (
          <div className="ug-empty">
            <Ico name="info" /> This is a direct relationship with no dedicated joint table.
          </div>
        )}
        {joints.map((j) => (
          <div className="ug-jointblock" key={j.id}>
            <div className="ug-jb-head">
              <span className="ug-jb-chain">Chain #{j.chain}</span>
              <span className="ug-jb-title">{j.title}</span>
            </div>
            <div className="ug-edgekv">
              <EdgeRow k="Joint table" icon="layers">
                <span className="mono">{j.joint ?? '(direct FK — no joint table)'}</span>
              </EdgeRow>
              <EdgeRow k="Cardinality" icon="link">
                {j.cardinality}
              </EdgeRow>
              <EdgeRow k="Implemented by" icon="check">
                {j.implementedBy}
              </EdgeRow>
              <EdgeRow k="Written by" icon="bolt">
                {j.writtenBy}
              </EdgeRow>
              <EdgeRow k="Guarded by (RLS)" icon="shield">
                {j.guardedBy}
              </EdgeRow>
              <div className="ug-ekr trap">
                <div className="ug-ekk">
                  <Ico name="alert" />
                  Trap
                </div>
                <div className="ug-ekv">{j.traps}</div>
              </div>
              {j.healthId && UGAT_FINDINGS_BY_ID[j.healthId] && (
                <button
                  type="button"
                  className="ug-ekr health-row"
                  onClick={() => onOpenFinding(j.healthId!)}
                >
                  <div className="ug-ekk">
                    <Ico name="alert" />
                    Health finding {j.healthId} — open the binding trace
                  </div>
                  <div className="ug-ekv">{UGAT_FINDINGS_BY_ID[j.healthId!]?.title ?? ''}</div>
                </button>
              )}
            </div>
          </div>
        ))}
        {finding && !joints.some((j) => j.healthId === finding.id) && (
          <button
            type="button"
            className="ug-finding-row red"
            onClick={() => onOpenFinding(finding.id)}
          >
            <span className="ug-fmark">{finding.sev === 'red' ? '!' : '~'}</span>
            <span>
              <b>{finding.title}</b>
              <span className="ug-fone">{finding.oneliner}</span>
            </span>
          </button>
        )}
      </div>
    </>
  );
}

function EdgeRow({
  k,
  icon,
  children,
}: {
  k: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ug-ekr">
      <div className="ug-ekk">
        <Ico name={icon} />
        {k}
      </div>
      <div className="ug-ekv">{children}</div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   FINDING CARD — the 5-step binding trace (static 2026-07-05 audit)
   ═════════════════════════════════════════════════════════════════════════ */
function FindingCard({ finding, onClose }: { finding: UgatFinding; onClose: () => void }) {
  return (
    <>
      <div className="ug-card-head">
        <div
          className="ug-av"
          style={{
            background: finding.sev === 'red' ? 'var(--ug-report-bg)' : 'var(--ug-wait-bg)',
            color: finding.sev === 'red' ? 'var(--ug-report)' : 'var(--ug-wait)',
          }}
        >
          <Ico name="alert" />
        </div>
        <div className="ug-ti">
          <div className="ug-nm">{finding.title}</div>
          <div className="ug-row2">
            <span className={`ug-badge ${finding.sev === 'red' ? 'report' : 'wait'}`}>
              {finding.sev === 'red' ? 'Confirmed broken' : 'Drift risk'}
            </span>
            <span className="ug-id">{finding.id}</span>
          </div>
        </div>
        <button type="button" className="ug-card-x" onClick={onClose} aria-label="Close">
          <Ico name="x" />
        </button>
      </div>

      <div className="ug-status-line">
        <Ico name="info" />
        <span>As of the 2026-07-05 audit — live telemetry coming (slice 2).</span>
      </div>

      <div className="ug-card-body">
        <p className="ug-fbody">{finding.oneliner}</p>
        <div className="ug-sect">
          <div className="ug-lab">
            <Ico name="link" />
            Binding trace
          </div>
          {finding.trace.map(([label, val], i) => (
            <div className="ug-trace-step" key={label}>
              <span className="ug-trace-num">{i + 1}</span>
              <div className="ug-trace-b">
                <div className="ug-tt">{label}</div>
                <div className="ug-tv">{val}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="ug-sect">
          <span className={`ug-fix-chip ${finding.fix === 'queued' ? 'queued' : 'needsowner'}`}>
            <Ico name={finding.fix === 'queued' ? 'check' : 'alert'} />
            {finding.fixLabel}
          </span>
        </div>
      </div>
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   OMNIBOX — one bar: live search + saved-search Questions
   ═════════════════════════════════════════════════════════════════════════ */
function Omnibox({
  savedSearches,
  onOpenRecord,
  onRunSaved,
}: {
  savedSearches: UgatSavedSearch[];
  onOpenRecord: (typeNodeId: string) => void;
  onRunSaved: (table: UgatTableKey) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<UgatSearchGroup[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [strip, setStrip] = useState<string | null>(null);

  // ⌘K focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // debounced live search
  useEffect(() => {
    if (q.trim().length < 2) {
      setGroups([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await fetchUgatSearch(q);
        setGroups(res);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const runSaved = (s: UgatSavedSearch) => {
    setOpen(false);
    setStrip(s.summary);
    onRunSaved(s.table);
  };

  return (
    <>
      <div className="ug-navbar">
        <Ico name="sparkles" cls="ug-nav-ic" />
        <div className="ug-navwrap">
          <input
            ref={inputRef}
            className="ug-navinput"
            placeholder="Search vendors · events · users · orders · taxonomy — ⌘K"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            autoComplete="off"
          />
          {open && (
            <div className="ug-navdrop">
              {q.trim().length < 2 ? (
                <>
                  <div className="ug-nd-hd">
                    <Ico name="compass" />
                    Questions
                  </div>
                  {savedSearches.map((s) => (
                    <button
                      type="button"
                      key={s.key}
                      className="ug-nd-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => runSaved(s)}
                    >
                      <span className="ug-nd-ic">
                        <Ico name="compass" />
                      </span>
                      <div className="ug-nd-b">
                        <div className="ug-nd-t">{s.question}</div>
                        <div className="ug-nd-s">
                          {s.count} match{s.count === 1 ? '' : 'es'} · opens the {s.table} table
                        </div>
                      </div>
                      <span className="ug-nd-cat">Question</span>
                    </button>
                  ))}
                </>
              ) : pending && groups.length === 0 ? (
                <div className="ug-nd-hd">Searching…</div>
              ) : groups.length === 0 ? (
                <div className="ug-nd-hd">No matches for “{q}”.</div>
              ) : (
                groups.map((g) => (
                  <div key={g.category}>
                    <div className="ug-nd-hd">{g.category}</div>
                    {g.hits.map((h) => (
                      <button
                        type="button"
                        key={h.id + h.title}
                        className="ug-nd-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setOpen(false);
                          onOpenRecord(h.typeNodeId);
                        }}
                      >
                        <span
                          className="ug-nd-ic"
                          style={{
                            background: UGAT_TYPE_VOCAB[h.type].colorBg,
                            color: UGAT_TYPE_VOCAB[h.type].color,
                          }}
                        >
                          <Ico name={UGAT_TYPE_VOCAB[h.type].icon} />
                        </span>
                        <div className="ug-nd-b">
                          <div className="ug-nd-t">{h.title}</div>
                          <div className="ug-nd-s">{h.sub}</div>
                        </div>
                        <span className="ug-nd-cat">{UGAT_TYPE_VOCAB[h.type].label}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <span className="ug-navhint">
          Live search · <kbd>⌘K</kbd>
        </span>
      </div>
      {strip && (
        <div className="ug-resultstrip">
          <Ico name="info" />
          <span>{strip}</span>
          <button type="button" className="ug-rs-x" onClick={() => setStrip(null)} aria-label="Dismiss">
            <Ico name="x" />
          </button>
        </div>
      )}
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   TABLES VIEW — rail of the eight tables + a paginated live table (25/page)
   ═════════════════════════════════════════════════════════════════════════ */
function TablesView({
  registerSetTable,
  onRowOpen,
  initialTable,
}: {
  registerSetTable: (fn: (t: UgatTableKey) => void) => void;
  onRowOpen: (typeNodeId: string) => void;
  initialTable: UgatTableKey;
}) {
  const [active, setActive] = useState<UgatTableKey>(initialTable);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<UgatTablePage | null>(null);
  const [pending, startTransition] = useTransition();

  // let external callers (omnibox / cards) switch the table
  useEffect(() => {
    registerSetTable((t) => {
      setActive(t);
      setPage(0);
    });
  }, [registerSetTable]);

  useEffect(() => {
    startTransition(async () => {
      const res = await fetchUgatTable(active, page);
      setData(res);
    });
  }, [active, page]);

  const TYPE_NODE: Record<UgatEntityType, string> = {
    user: 'TYPE-USERS',
    event: 'TYPE-EVENTS',
    guest: 'TYPE-GUESTS',
    vendor: 'TYPE-VENDORS',
    service: 'TYPE-SERVICES',
    order: 'TYPE-ORDERS',
    thread: 'TYPE-THREADS',
    billing: 'TYPE-BILLING',
    taxonomy: 'TYPE-TAXONOMY',
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="ug-tblstage">
      <nav className="ug-tblrail">
        <div className="ug-rail-title">Entity tables</div>
        {TABLE_META.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`ug-tblfolder${active === t.key ? ' on' : ''}`}
            onClick={() => {
              setActive(t.key);
              setPage(0);
            }}
          >
            <span style={{ color: UGAT_TYPE_VOCAB[t.type].color }}>
              <Ico name={UGAT_TYPE_VOCAB[t.type].icon} />
            </span>
            <span className="ug-lbl">{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="ug-tblmain">
        {data && (
          <>
            <div className="ug-tblhead">
              <div>
                <div className="ug-h">
                  <span style={{ color: UGAT_TYPE_VOCAB[data.rows[0]?.type ?? 'user'].color }}>
                    <Ico name={UGAT_TYPE_VOCAB[TABLE_META.find((t) => t.key === active)!.type].icon} />
                  </span>
                  {TABLE_META.find((t) => t.key === active)!.label}
                </div>
                <div className="ug-sub">
                  {data.total.toLocaleString('en-PH')} row{data.total === 1 ? '' : 's'} · live · page{' '}
                  {data.page + 1} of {totalPages}
                </div>
              </div>
            </div>

            {data.note && (
              <div className="ug-tblnote">
                <Ico name="info" />
                {data.note}
              </div>
            )}

            {data.rows.length === 0 ? (
              <div className="ug-empty">
                <Ico name="info" /> No rows on this page.
              </div>
            ) : (
              <div className="ug-tblscroll">
                <table className="ug-etable">
                  <thead>
                    <tr>
                      {data.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} onClick={() => onRowOpen(TYPE_NODE[r.type])}>
                        {r.cells.map((cell, ci) => (
                          <td key={ci}>
                            {ci === 0 ? (
                              <span className="ug-et-name">
                                <span
                                  className="ug-et-ic"
                                  style={{
                                    background: UGAT_TYPE_VOCAB[r.type].colorBg,
                                    color: UGAT_TYPE_VOCAB[r.type].color,
                                  }}
                                >
                                  <Ico name={UGAT_TYPE_VOCAB[r.type].icon} />
                                </span>
                                <span>
                                  <span className="ug-et-nm">{cell}</span>
                                  <span className="ug-et-id mono">{r.id}</span>
                                </span>
                              </span>
                            ) : r.status && ci === r.cells.length - 1 && statusColumnFor(active) ? (
                              <span className={`ug-badge ${r.status[1]}`}>{cell}</span>
                            ) : (
                              cell
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="ug-pager">
                <button
                  type="button"
                  disabled={data.page <= 0 || pending}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  ← Prev
                </button>
                <span>
                  Page {data.page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={data.page + 1 >= totalPages || pending}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
        {!data && (
          <div className="ug-empty">
            <Ico name="info" /> Loading…
          </div>
        )}
      </main>
    </div>
  );
}

/** Which tables render the last column as a status chip. */
function statusColumnFor(key: UgatTableKey): boolean {
  return key === 'vendors' || key === 'orders' || key === 'threads' || key === 'billing';
}
