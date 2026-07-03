'use client';

/**
 * Taxonomy Studio — the visual, card-tree editor that replaced the zero-JS form
 * tree at /admin/taxonomy (PR 2 of the Taxonomy Studio program). Three panes:
 *
 *   • Left rail   — the 10 folders (icon + tile count) plus two pseudo-buckets
 *                   (Unfiled · Requests). Drop a tile card here to re-home it.
 *   • Center      — the selected folder's tile cards: icon + label + photo +
 *                   badges. Drag to reorder within the folder, or onto a folder
 *                   in the rail to move it. A ghost "Add tile" card at the end.
 *   • Right sheet — the inspector for the selected tile (Details · Services),
 *                   opened as a bottom sheet on mobile / right drawer on desktop.
 *
 * The server page hands ALL data in as props (small dataset — 66 categories +
 * 229 canonicals), so search + view filtering are client-side. The redirect-form
 * actions (rename, remap, faith, event-types, add, icon, photo) are unchanged and
 * fire as plain `<form action=…>`; the three NEW drag actions return JSON and the
 * client `router.refresh()`es on success. IDs + slugs are immutable — rename edits
 * label_en only; a re-home edits parent_id (+ denormalized folder_id) only.
 */

import { useCallback, useMemo, useState, useTransition, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Inbox,
  MessageSquareWarning,
  ImageIcon,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoveRight,
  Trash2,
  Circle,
  Lock,
  SlidersHorizontal,
  Tag,
  Pencil,
  Undo2,
  Archive,
  CalendarDays,
  Church,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { getLucideIcon } from '@/lib/nav-icons';
import { Sheet } from '@/app/_components/sheet';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  renameTaxonomyNode,
  createTaxonomyNode,
  createCanonicalLeaf,
  remapCanonical,
  setServiceFaith,
  setCategoryEventTypes,
  setCategoryIcon,
  setCategoryPhoto,
  reorderCategories,
  moveTileToFolder,
  deleteTileWithDestination,
  promoteCategoryRequest,
  mapCategoryRequest,
  resolveCategoryRequest,
  updateRefinementLeaf,
  updateRefinementOption,
  addRefinementOption,
  removeRefinementOption,
  reorderRefinementLeaves,
  reorderRefinementOptions,
  addLeafAttributeFieldAction,
  addLeafAttributeOptionAction,
  relabelLeafAttributeFieldAction,
  retireLeafAttributeFieldAction,
  retireLeafAttributeOptionAction,
  relabelEventTypeVocab,
  setEventTypeVocabStatus,
  reorderEventTypeVocab,
  createEventTypeVocab,
  relabelFaithVocab,
  setFaithVocabStatus,
  reorderFaithVocab,
  createFaithVocab,
  setFaithLaunchStatus,
  setFaithLaunchThreshold,
  setServiceFlag,
  setServiceSecondaryTiles,
  type StudioActionResult,
} from '../actions';

// ── Serializable prop shapes (mirror the server page's derivations) ───────────

export type StudioFolder = {
  id: string;
  label: string;
  iconName: string | null;
};

export type StudioTile = {
  id: string;
  parentId: string;
  label: string;
  slug: string;
  iconName: string | null;
  /** Resolved display URL for the sample photo, or null. */
  photoUrl: string | null;
  /** Raw stored ref (`r2://…` / `/public…`) carried into the photo form. */
  photoRaw: string | null;
  eventTypes: string[] | null;
  serviceCount: number;
  faithCount: number;
  refinementCount: number;
};

/** One option value on an option-bearing leaf refinement. `value` is the
 *  immutable stored string (also the vendor-visible label after underscores →
 *  spaces); `retired` hides it from new picks without dropping it. */
export type StudioLeafRefinementOption = {
  value: string;
  retired: boolean;
};

/** One leaf refinement = one vendor attribute field on a canonical service
 *  (`category_specific_attributes[key]`). The owner-clarified "refinement". */
export type StudioLeafRefinement = {
  key: string;
  type: string;
  label: string;
  retired: boolean;
  /** Non-empty only for enum / multi_select (option-bearing) types. */
  options: StudioLeafRefinementOption[];
};

export type StudioService = {
  canonical: string;
  displayEn: string;
  displayTl: string | null;
  tileId: string | null;
  phase: string;
  faith: string | null;
  ph: boolean;
  setnayan: boolean;
  rental: boolean;
  hidden: boolean;
  /** Cultural / tradition facet (is_tradition). Editable in the inspector. */
  tradition: boolean;
  /** Dietary grade (halal / alcohol_free) — READ-ONLY here; a dietary canonical
   *  must never be faith-gated (mirrors setServiceFaith's de-faith guard). */
  dietary: string | null;
  /** Tiles this canonical is cross-listed on beyond its home tile. */
  secondaryTiles: string[];
  /** Current schema_version — every refinement edit bumps this +1. */
  schemaVersion: number;
  /** Cross-category shared groups (faith / dietary / pricing) — read-only here;
   *  edited by their own dedicated tooling, not the leaf refinements editor. */
  sharedGroups: string[];
  /** The leaf's vendor attribute fields (category_specific_attributes). */
  refinements: StudioLeafRefinement[];
};

export type StudioRequest = {
  requestId: string;
  proposedLabel: string;
  proposedNote: string | null;
  vendorName: string;
};

export type VocabItem = { key: string; label: string };

/** One event-type vocab row for the Vocabularies rail editor. */
export type StudioEventTypeVocab = {
  key: string;
  label: string;
  status: string;
  /** How many tiles + canonicals explicitly scope to this event type. */
  usage: number;
  /** `wedding` is the base type — it can't be deactivated. */
  isBase: boolean;
};

/** The per-faith launch-gate readiness (folded from /admin/wedding-types). */
export type StudioFaithLaunch = {
  status: string;
  threshold: number;
  vendorCount: number;
  venueCount: number;
  total: number;
  ready: boolean;
};

/** One faith vocab row for the Vocabularies rail editor. */
export type StudioFaithVocab = {
  /** TITLE-CASE faith_key — never lowercase it. */
  key: string;
  label: string;
  status: string;
  isCivil: boolean;
  /** How many canonicals carry this faith tag. */
  usage: number;
  /** Launch gate + readiness, or null if no launch row maps to this faith. */
  launch: StudioFaithLaunch | null;
};

/** A tile option for the secondary-tiles cross-listing picker. */
export type StudioTileOption = { id: string; label: string };

export type StudioRefinementOption = {
  optionKey: string;
  emoji: string;
  label: string;
  status: string;
  photoRaw: string | null;
  /** Presigned display URL (r2:// refs) or /public path; null if presign failed. */
  photoUrl: string | null;
};

export type StudioRefinementLeaf = {
  leafKey: string;
  label: string;
  description: string;
  status: string;
  /** Faith-adaptive ceremony leaf — options come from the couple's faith pick. */
  dynamic: boolean;
  /** Projectable leaf (ceremony / catering / photo_video) — option keys feed
   *  vendor matching, so add/remove is locked (label/emoji/photo stay editable). */
  isProjectable: boolean;
  mainPhotoRaw: string | null;
  mainPhotoUrl: string | null;
  options: StudioRefinementOption[];
};

export type StudioData = {
  source: 'db' | 'fallback';
  folders: StudioFolder[];
  tiles: StudioTile[];
  services: StudioService[];
  eventVocab: VocabItem[];
  faithVocab: VocabItem[];
  /** Full event-type vocab (all statuses) + usage counts — the Vocabularies rail. */
  eventTypeVocab: StudioEventTypeVocab[];
  /** Full faith vocab (all statuses) + usage + launch gate — the Vocabularies rail. */
  faithVocabFull: StudioFaithVocab[];
  /** Tile catalog for the secondary-tiles cross-listing picker. */
  tileOptions: StudioTileOption[];
  requests: StudioRequest[];
  iconNames: string[];
  /** Couple-facing default folder icon (Lucide name) — matches /explore. */
  folderDefaultIcon: Record<string, string>;
  /** Refinement leaves anchored to each tile (tile id → leaves, sort-ordered). */
  refinementsByTile: Record<string, StudioRefinementLeaf[]>;
  initialQ: string;
  initialView: StudioView;
  /** Deep-link: tile to auto-open (`?open=`) + which inspector tab (`?opentab=`). */
  initialOpenTileId: string | null;
  initialOpenTab: InspectorTab | null;
};

export type InspectorTab = 'details' | 'services' | 'refinements';

export type StudioView =
  | 'all'
  | 'faith'
  | 'scoped'
  | 'unfiled'
  | 'requests'
  | 'vocab-event'
  | 'vocab-faith';

const PHASE_TONE_BASE = 'bg-ink/5 text-ink/70';

// ── Small render helpers ──────────────────────────────────────────────────────

function LucideByName({
  name,
  fallback,
  className,
}: {
  name: string | null | undefined;
  fallback?: string;
  className?: string;
}) {
  const Icon = getLucideIcon(name) ?? getLucideIcon(fallback) ?? Circle;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}
    >
      {children}
    </span>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function TaxonomyStudio({ data }: { data: StudioData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const [query, setQuery] = useState(data.initialQ);
  const [view, setView] = useState<StudioView>(data.initialView);
  const initialOpenParent = data.initialOpenTileId
    ? data.tiles.find((t) => t.id === data.initialOpenTileId)?.parentId
    : undefined;
  const [selectedFolder, setSelectedFolder] = useState<string>(
    initialOpenParent ?? data.folders[0]?.id ?? '',
  );
  // Deep-link open: a redirect-back refinement save lands on ?open=<tile> so the
  // inspector re-opens where the admin left off; ?opentab picks the tab.
  const [openTileId, setOpenTileId] = useState<string | null>(data.initialOpenTileId);
  const [openTab, setOpenTab] = useState<InspectorTab | null>(data.initialOpenTab);
  const [dragTileId, setDragTileId] = useState<string | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const [dropTileIdx, setDropTileIdx] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const q = query.trim().toLowerCase();

  // ── Deep-link sync: mirror search + view into the URL (?q= / ?view=) so a
  //    refresh / share re-opens the same filter. router.replace keeps history
  //    clean (no back-button spam per keystroke). ────────────────────────────
  const syncUrl = useCallback(
    (nextQ: string, nextView: StudioView) => {
      const p = new URLSearchParams();
      if (nextQ.trim()) p.set('q', nextQ.trim().slice(0, 80));
      if (nextView !== 'all') p.set('view', nextView);
      const qs = p.toString();
      router.replace(qs ? `/admin/taxonomy?${qs}` : '/admin/taxonomy', { scroll: false });
    },
    [router],
  );

  const onQueryChange = (v: string) => {
    setQuery(v);
    syncUrl(v, view);
  };
  const onViewChange = (v: StudioView) => {
    setView(v);
    syncUrl(query, v);
  };

  // ── Indices ────────────────────────────────────────────────────────────────
  const tilesByFolder = useMemo(() => {
    const m = new Map<string, StudioTile[]>();
    for (const f of data.folders) m.set(f.id, []);
    for (const t of data.tiles) {
      if (!m.has(t.parentId)) m.set(t.parentId, []);
      m.get(t.parentId)!.push(t);
    }
    return m;
  }, [data.folders, data.tiles]);

  const servicesByTile = useMemo(() => {
    const m = new Map<string, StudioService[]>();
    for (const s of data.services) {
      if (!s.tileId) continue;
      if (!m.has(s.tileId)) m.set(s.tileId, []);
      m.get(s.tileId)!.push(s);
    }
    return m;
  }, [data.services]);

  const unfiled = useMemo(() => data.services.filter((s) => !s.tileId), [data.services]);
  const tileById = useMemo(() => new Map(data.tiles.map((t) => [t.id, t])), [data.tiles]);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const svcMatch = useCallback(
    (s: StudioService) =>
      !q ||
      s.displayEn.toLowerCase().includes(q) ||
      (s.displayTl ?? '').toLowerCase().includes(q) ||
      s.canonical.toLowerCase().includes(q),
    [q],
  );
  const tileMatches = useCallback(
    (t: StudioTile) => {
      if (view === 'faith' && t.faithCount === 0) return false;
      if (view === 'scoped' && !(t.eventTypes && t.eventTypes.length > 0)) return false;
      if (!q) return true;
      if (t.label.toLowerCase().includes(q)) return true;
      return (servicesByTile.get(t.id) ?? []).some(svcMatch);
    },
    [q, view, servicesByTile, svcMatch],
  );

  const folderTileCount = useCallback(
    (folderId: string) => (tilesByFolder.get(folderId) ?? []).length,
    [tilesByFolder],
  );

  const visibleTiles = useMemo(() => {
    const all = tilesByFolder.get(selectedFolder) ?? [];
    if (view === 'faith' || view === 'scoped' || q) return all.filter(tileMatches);
    return all;
  }, [tilesByFolder, selectedFolder, view, q, tileMatches]);

  const eventLabel = useCallback(
    (e: string) => data.eventVocab.find((v) => v.key === e)?.label ?? e,
    [data.eventVocab],
  );

  // ── Drag action runner ───────────────────────────────────────────────────────
  const runDrag = useCallback(
    (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) => {
      startTransition(async () => {
        const res = await fn();
        if (res.ok) {
          setFlash({ kind: 'ok', text: res.message });
          router.refresh();
        } else {
          setFlash({ kind: 'error', text: res.error });
        }
      });
    },
    [router],
  );

  // Tile drag start / end
  const onTileDragStart = (tileId: string) => (e: DragEvent) => {
    setDragTileId(tileId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/tile', tileId);
  };
  const onTileDragEnd = () => {
    setDragTileId(null);
    setDropTargetFolder(null);
    setDropTileIdx(null);
  };

  // Drop a tile onto a folder rail row → move to folder.
  const onFolderDrop = (folderId: string) => (e: DragEvent) => {
    e.preventDefault();
    setDropTargetFolder(null);
    const tileId = e.dataTransfer.getData('text/tile') || dragTileId;
    if (!tileId) return;
    const tile = tileById.get(tileId);
    if (!tile || tile.parentId === folderId) return;
    runDrag(() => moveTileToFolder(tileId, folderId));
    onTileDragEnd();
  };

  // Reorder within the center grid.
  const onGridDrop = (idx: number) => (e: DragEvent) => {
    e.preventDefault();
    setDropTileIdx(null);
    const tileId = e.dataTransfer.getData('text/tile') || dragTileId;
    if (!tileId) return;
    const current = (tilesByFolder.get(selectedFolder) ?? []).map((t) => t.id);
    const from = current.indexOf(tileId);
    if (from === -1) return; // tile from another folder — reorder is same-folder only
    const next = current.slice();
    next.splice(from, 1);
    const insertAt = from < idx ? idx - 1 : idx;
    next.splice(insertAt, 0, tileId);
    if (next.join() === current.join()) return;
    runDrag(() => reorderCategories(selectedFolder, next));
    onTileDragEnd();
  };

  // Service row → tile card remap (dragging a service onto a tile).
  const onServiceDropTile = (destTileId: string) => (e: DragEvent) => {
    e.preventDefault();
    const canonical = e.dataTransfer.getData('text/service');
    if (!canonical) return;
    // remapCanonical is a redirect form-action; call it via a synthesized form.
    const fd = new FormData();
    fd.set('canonical_service', canonical);
    fd.set('tile_id', destTileId);
    startTransition(async () => {
      try {
        await remapCanonical(fd);
      } catch {
        // redirect() throws NEXT_REDIRECT by design — that's the success path.
        router.refresh();
      }
    });
  };

  const openTile = openTileId ? tileById.get(openTileId) ?? null : null;

  return (
    <div className="space-y-4">
      {dialog}

      {/* Global header — search + view chips */}
      <div className="sticky top-[57px] z-20 -mx-4 border-b border-ink/10 bg-cream/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-cream/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              maxLength={80}
              placeholder="Find a folder, tile, or service…"
              aria-label="Find a folder, tile, or service"
              className="w-full rounded-md border border-ink/15 bg-white py-1.5 pl-8 pr-2 text-sm text-ink"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', 'All'],
                ['faith', 'Faith-tagged'],
                ['scoped', 'Event-scoped'],
                ['unfiled', `Unfiled ${unfiled.length}`],
                ['requests', `Requests ${data.requests.length}`],
              ] as [StudioView, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                aria-pressed={view === v}
                className={`rounded-full px-2.5 py-1 font-mono text-[11px] transition ${
                  view === v ? 'bg-terracotta text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {flash ? (
        <div
          role={flash.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm ${
            flash.kind === 'ok'
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-danger-200 bg-danger-50 text-danger-800'
          }`}
        >
          <span>
            {flash.kind === 'ok' ? '✓ ' : '⚠ '}
            {flash.text}
          </span>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 text-current/60 hover:bg-black/5"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {view === 'unfiled' ? (
        <UnfiledTray unfiled={unfiled.filter(svcMatch)} data={data} />
      ) : view === 'requests' ? (
        <RequestsQueue requests={data.requests} data={data} />
      ) : view === 'vocab-event' ? (
        <EventTypeVocabPanel rows={data.eventTypeVocab} query={q} />
      ) : view === 'vocab-faith' ? (
        <FaithVocabPanel rows={data.faithVocabFull} query={q} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(180px,220px)_1fr]">
          {/* ── Left rail — folders + pseudo-buckets ─────────────────────── */}
          <nav
            aria-label="Folders"
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {data.folders.map((f) => {
              const active = f.id === selectedFolder;
              const dropping = dropTargetFolder === f.id && dragTileId != null;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFolder(f.id)}
                  onDragOver={(e) => {
                    if (dragTileId && tileById.get(dragTileId)?.parentId !== f.id) {
                      e.preventDefault();
                      setDropTargetFolder(f.id);
                    }
                  }}
                  onDragLeave={() => setDropTargetFolder((cur) => (cur === f.id ? null : cur))}
                  onDrop={onFolderDrop(f.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition lg:w-full ${
                    dropping
                      ? 'border-terracotta border-dashed bg-terracotta/10'
                      : active
                        ? 'border-terracotta/50 bg-terracotta/5 text-ink'
                        : 'border-ink/10 bg-cream text-ink/70 hover:bg-ink/5'
                  }`}
                >
                  <LucideByName
                    name={f.iconName}
                    fallback={data.folderDefaultIcon[f.id]}
                    className="h-4 w-4 shrink-0 text-ink/70"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{f.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink/40">
                    {folderTileCount(f.id)}
                  </span>
                </button>
              );
            })}

            <div className="my-1 hidden h-px bg-ink/10 lg:block" aria-hidden />

            <button
              type="button"
              onClick={() => onViewChange('unfiled')}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-warn-200 bg-warn-50/60 px-3 py-2 text-left text-sm text-warn-800 hover:bg-warn-50 lg:w-full"
            >
              <Inbox className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">Unfiled</span>
              <span className="shrink-0 font-mono text-[11px]">{unfiled.length}</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('requests')}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-left text-sm text-sky-800 hover:bg-sky-50 lg:w-full"
            >
              <MessageSquareWarning className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">Requests</span>
              {data.requests.length > 0 ? (
                <span className="shrink-0 rounded-full bg-sky-600 px-1.5 font-mono text-[10px] text-white">
                  {data.requests.length}
                </span>
              ) : null}
            </button>

            {/* ── Vocabularies — the scoping vocab tables ─────────────────── */}
            <div className="my-1 hidden h-px bg-ink/10 lg:block" aria-hidden />
            <p className="hidden px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40 lg:block">
              Vocabularies
            </p>
            <button
              type="button"
              onClick={() => onViewChange('vocab-event')}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-ink/10 bg-cream px-3 py-2 text-left text-sm text-ink/70 hover:bg-ink/5 lg:w-full"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">Event types</span>
              <span className="shrink-0 font-mono text-[11px] text-ink/40">
                {data.eventTypeVocab.filter((v) => v.status === 'active').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('vocab-faith')}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-ink/10 bg-cream px-3 py-2 text-left text-sm text-ink/70 hover:bg-ink/5 lg:w-full"
            >
              <Church className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">Faiths</span>
              <span className="shrink-0 font-mono text-[11px] text-ink/40">
                {data.faithVocabFull.filter((f) => f.status === 'active').length}
              </span>
            </button>
          </nav>

          {/* ── Center — tile cards ──────────────────────────────────────── */}
          <div className={pending ? 'opacity-60 transition-opacity' : ''}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleTiles.map((tile, idx) => (
                <TileCard
                  key={tile.id}
                  tile={tile}
                  idx={idx}
                  dragging={dragTileId === tile.id}
                  dropBefore={dropTileIdx === idx && dragTileId != null && dragTileId !== tile.id}
                  onSelect={() => {
                    setOpenTileId(tile.id);
                    setOpenTab('details');
                  }}
                  onOpenRefinements={() => {
                    setOpenTileId(tile.id);
                    setOpenTab('refinements');
                  }}
                  onDragStart={onTileDragStart(tile.id)}
                  onDragEnd={onTileDragEnd}
                  onDragOverCard={(e) => {
                    if (dragTileId && dragTileId !== tile.id) {
                      e.preventDefault();
                      setDropTileIdx(idx);
                    }
                  }}
                  onDropCard={onGridDrop(idx)}
                  onServiceDrop={onServiceDropTile(tile.id)}
                  eventLabel={eventLabel}
                  folderDefaultIcon={data.folderDefaultIcon[tile.parentId]}
                />
              ))}

              {/* trailing drop zone (drop at end) + Add-tile ghost */}
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt('New tile name');
                  if (!name || name.trim().length < 2) return;
                  const fd = new FormData();
                  fd.set('parent_id', selectedFolder);
                  fd.set('label_en', name.trim());
                  startTransition(async () => {
                    try {
                      await createTaxonomyNode(fd);
                    } catch {
                      router.refresh();
                    }
                  });
                }}
                onDragOver={(e) => {
                  if (dragTileId) {
                    e.preventDefault();
                    setDropTileIdx(visibleTiles.length);
                  }
                }}
                onDrop={onGridDrop(visibleTiles.length)}
                className={`flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm transition ${
                  dropTileIdx === visibleTiles.length && dragTileId
                    ? 'border-terracotta bg-terracotta/10 text-terracotta'
                    : 'border-ink/20 bg-cream/40 text-ink/50 hover:border-terracotta/50 hover:text-terracotta'
                }`}
              >
                <Plus className="h-5 w-5" aria-hidden />
                Add tile
              </button>
            </div>

            {visibleTiles.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-6 text-center text-sm text-ink/55">
                No tiles match the current filter in this folder.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Right inspector ──────────────────────────────────────────────── */}
      <Sheet
        open={openTile != null}
        onClose={() => {
          setOpenTileId(null);
          setOpenTab(null);
        }}
        labelledById="tile-inspector-title"
        title="Tile inspector"
      >
        {openTile ? (
          <Inspector
            key={openTile.id}
            tile={openTile}
            data={data}
            services={servicesByTile.get(openTile.id) ?? []}
            refinements={data.refinementsByTile[openTile.id] ?? []}
            initialTab={openTab ?? 'details'}
            eventLabel={eventLabel}
            onDeleted={() => {
              setOpenTileId(null);
              setOpenTab(null);
              router.refresh();
            }}
            onDeleteRequest={async (destTileId) => {
              const res = await deleteTileWithDestination(openTile.id, destTileId);
              return res;
            }}
            confirm={confirm}
            onServiceDragStart={(canonical) => (e: DragEvent) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/service', canonical);
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

// ── Tile card ─────────────────────────────────────────────────────────────────

function TileCard({
  tile,
  dragging,
  dropBefore,
  onSelect,
  onOpenRefinements,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropCard,
  onServiceDrop,
  eventLabel,
  folderDefaultIcon,
}: {
  tile: StudioTile;
  idx: number;
  dragging: boolean;
  dropBefore: boolean;
  onSelect: () => void;
  onOpenRefinements: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOverCard: (e: DragEvent) => void;
  onDropCard: (e: DragEvent) => void;
  onServiceDrop: (e: DragEvent) => void;
  eventLabel: (e: string) => string;
  folderDefaultIcon: string | undefined;
}) {
  const scoped = tile.eventTypes && tile.eventTypes.length > 0;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        onDragOverCard(e);
        // also accept a service-row drop (remap)
        e.preventDefault();
      }}
      onDrop={(e) => {
        // Route to the right handler by payload type.
        if (e.dataTransfer.types.includes('text/service')) onServiceDrop(e);
        else onDropCard(e);
      }}
      className={`group relative flex cursor-pointer flex-col rounded-xl border bg-white p-3 text-left transition ${
        dragging ? 'opacity-40' : 'border-ink/10 hover:border-terracotta/40 hover:shadow-sm'
      } ${dropBefore ? 'ring-2 ring-terracotta ring-offset-1' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span
        className="absolute left-1.5 top-1.5 cursor-grab text-ink/25 opacity-0 transition group-hover:opacity-100"
        aria-hidden
        title="Drag to reorder or move"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-cream">
          <LucideByName name={tile.iconName} fallback={folderDefaultIcon} className="h-4 w-4 text-ink/70" />
        </span>
        {tile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.photoUrl}
            alt=""
            className="h-8 w-10 shrink-0 rounded-md object-cover"
            aria-hidden
          />
        ) : (
          <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-ink/15 text-ink/30">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-ink/25" aria-hidden />
      </div>
      <p className="mb-1.5 truncate text-sm font-semibold text-ink" title={tile.label}>
        {tile.label}
      </p>
      <div className="mt-auto flex flex-wrap gap-1">
        <Badge tone="bg-ink/5 text-ink/60">{tile.serviceCount} svc</Badge>
        {tile.refinementCount > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenRefinements();
            }}
            title="Edit refinements"
            className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-violet-700 transition hover:bg-violet-100 hover:ring-1 hover:ring-violet-300"
          >
            {tile.refinementCount} ref
          </button>
        ) : null}
        {scoped ? (
          <Badge tone="bg-sky-50 text-sky-700">
            {tile.eventTypes!.length === 1
              ? `${eventLabel(tile.eventTypes![0]!)}-only`
              : `${tile.eventTypes!.length} events`}
          </Badge>
        ) : (
          <Badge tone="bg-ink/5 text-ink/45">all events</Badge>
        )}
        {tile.faithCount > 0 ? (
          <Badge tone="bg-warn-50 text-warn-800">{tile.faithCount} faith</Badge>
        ) : null}
      </div>
    </div>
  );
}

// ── Inspector (Details + Services) ─────────────────────────────────────────────

function Inspector({
  tile,
  data,
  services,
  refinements,
  initialTab,
  eventLabel,
  onDeleteRequest,
  confirm,
  onServiceDragStart,
}: {
  tile: StudioTile;
  data: StudioData;
  services: StudioService[];
  refinements: StudioRefinementLeaf[];
  initialTab: InspectorTab;
  eventLabel: (e: string) => string;
  onDeleted: () => void;
  onDeleteRequest: (
    destTileId?: string,
  ) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  confirm: ReturnType<typeof useConfirm>['confirm'];
  onServiceDragStart: (canonical: string) => (e: DragEvent) => void;
}) {
  const [tab, setTab] = useState<InspectorTab>(initialTab);
  const [iconDraft, setIconDraft] = useState<string | null>(tile.iconName);
  const [photoDraft, setPhotoDraft] = useState<string | null>(tile.photoUrl);
  const [iconQuery, setIconQuery] = useState('');
  const [deleteDest, setDeleteDest] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filteredIcons = useMemo(() => {
    const iq = iconQuery.trim().toLowerCase();
    const list = iq ? data.iconNames.filter((n) => n.toLowerCase().includes(iq)) : data.iconNames;
    return list.slice(0, 120);
  }, [data.iconNames, iconQuery]);

  const hasContents = tile.serviceCount > 0 || tile.refinementCount > 0;
  const otherTiles = data.tiles.filter((t) => t.id !== tile.id);

  const runDelete = async () => {
    const okConfirm = await confirm({
      title: `Delete ${tile.label}?`,
      body: hasContents ? (
        <>
          {tile.serviceCount} service(s) and {tile.refinementCount} refinement set(s) will move to{' '}
          <strong>{data.tiles.find((t) => t.id === deleteDest)?.label ?? '—'}</strong>. IDs and slugs are
          unchanged; only their placement moves.
        </>
      ) : (
        'This tile is empty, so it will be removed outright.'
      ),
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (!okConfirm) return;
    startTransition(async () => {
      const res = await onDeleteRequest(hasContents ? deleteDest : undefined);
      if (res.ok) {
        router.refresh();
      } else {
        window.alert(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col">
      {/* Signature moment: live /explore preview card */}
      <div className="border-b border-ink/10 bg-gradient-to-b from-cream to-white px-5 py-5">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
          As couples see it
        </p>
        <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
          <div className="flex h-24 items-center justify-center bg-cream">
            {photoDraft ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoDraft} alt="" className="h-full w-full object-cover" aria-hidden />
            ) : (
              <LucideByName
                name={iconDraft}
                fallback={data.folderDefaultIcon[tile.parentId]}
                className="h-9 w-9 text-terracotta"
              />
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <LucideByName
              name={iconDraft}
              fallback={data.folderDefaultIcon[tile.parentId]}
              className="h-4 w-4 shrink-0 text-ink/70"
            />
            <span className="truncate text-sm font-semibold text-ink">{tile.label}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink/10 px-5 pt-3">
        {(['details', 'services', 'refinements'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium capitalize transition ${
              tab === t
                ? 'border-b-2 border-terracotta text-ink'
                : 'text-ink/50 hover:text-ink'
            }`}
          >
            {t}
            {t === 'services' ? <span className="ml-1 text-ink/40">{services.length}</span> : null}
            {t === 'refinements' ? <span className="ml-1 text-ink/40">{refinements.length}</span> : null}
          </button>
        ))}
      </div>

      <div className={`space-y-5 px-5 py-5 ${pending ? 'opacity-60' : ''}`}>
        {tab === 'details' ? (
          <>
            {/* Rename (label only) */}
            <form action={renameTaxonomyNode} className="space-y-1.5">
              <label className="block text-xs font-medium text-ink/70">Label</label>
              <div className="flex gap-2">
                <input type="hidden" name="id" value={tile.id} />
                <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
                <input
                  name="label_en"
                  defaultValue={tile.label}
                  minLength={2}
                  maxLength={80}
                  className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
                />
                <SubmitButton
                  className="shrink-0 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600"
                  pendingLabel="Saving…"
                >
                  Save
                </SubmitButton>
              </div>
              <p className="font-mono text-[10px] text-ink/40">
                id/slug immutable: <span className="text-ink/55">{tile.slug}</span>
              </p>
            </form>

            {/* Icon picker */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink/70">Icon</p>
              <input
                type="search"
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                placeholder="Filter icons…"
                className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
              />
              <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-ink/10 bg-white p-2">
                {filteredIcons.map((name) => {
                  const isCurrent = iconDraft === name;
                  return (
                    <form key={name} action={setCategoryIcon} className="contents">
                      <input type="hidden" name="category_id" value={tile.id} />
                      <input type="hidden" name="icon_name" value={name} />
                      <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
                      <button
                        type="submit"
                        title={name}
                        onClick={() => setIconDraft(name)}
                        className={`flex h-8 w-8 items-center justify-center rounded-md border text-ink hover:border-terracotta/40 hover:text-terracotta ${
                          isCurrent ? 'border-terracotta bg-terracotta/10 text-terracotta' : 'border-transparent'
                        }`}
                      >
                        <LucideByName name={name} className="h-4 w-4" />
                      </button>
                    </form>
                  );
                })}
              </div>
              {tile.iconName ? (
                <form action={setCategoryIcon}>
                  <input type="hidden" name="category_id" value={tile.id} />
                  <input type="hidden" name="icon_name" value="" />
                  <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
                  <SubmitButton
                    className="text-[11px] text-ink/50 underline hover:text-ink"
                    pendingLabel="Clearing…"
                  >
                    Clear icon → folder default
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            {/* Photo */}
            <form action={setCategoryPhoto} className="space-y-2">
              <p className="text-xs font-medium text-ink/70">Photo</p>
              <input type="hidden" name="category_id" value={tile.id} />
              <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
              <PhotoField tile={tile} onPreview={setPhotoDraft} />
            </form>

            {/* Event-type scope */}
            <form action={setCategoryEventTypes} className="space-y-2">
              <p className="text-xs font-medium text-ink/70">
                Event scope{' '}
                <span className="text-ink/45">
                  {tile.eventTypes && tile.eventTypes.length > 0
                    ? tile.eventTypes.map(eventLabel).join(' · ')
                    : 'Universal (all events)'}
                </span>
              </p>
              <input type="hidden" name="category_id" value={tile.id} />
              <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
              <div className="flex flex-wrap gap-1.5">
                {data.eventVocab.map((v) => (
                  <label
                    key={v.key}
                    className="flex items-center gap-1 rounded-md border border-ink/15 bg-white px-1.5 py-0.5 text-[11px] text-ink/70"
                  >
                    <input
                      type="checkbox"
                      name="event_types"
                      value={v.key}
                      defaultChecked={tile.eventTypes?.includes(v.key) ?? false}
                      className="h-3 w-3"
                    />
                    {v.label}
                  </label>
                ))}
              </div>
              <SubmitButton
                className="rounded-md border border-ink/20 bg-ink px-2.5 py-1 text-[11px] font-medium text-white hover:bg-ink/80"
                pendingLabel="Saving…"
              >
                Save scope
              </SubmitButton>
              <span className="ml-1.5 text-[10px] text-ink/40">none checked = universal</span>
            </form>

            {/* Delete */}
            <div className="space-y-2 rounded-lg border border-danger-200 bg-danger-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-danger-700">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete tile
              </p>
              {hasContents ? (
                <>
                  <p className="text-[11px] text-ink/60">
                    Holds {tile.serviceCount} service(s) + {tile.refinementCount} refinement set(s). Pick where
                    they move — nothing is stranded.
                  </p>
                  <select
                    value={deleteDest}
                    onChange={(e) => setDeleteDest(e.target.value)}
                    className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
                  >
                    <option value="">— move contents to… —</option>
                    {data.folders.map((f) => (
                      <optgroup key={f.id} label={f.label}>
                        {otherTiles
                          .filter((t) => t.parentId === f.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-[11px] text-ink/60">This tile is empty — it will be removed outright.</p>
              )}
              <button
                type="button"
                onClick={runDelete}
                disabled={hasContents && !deleteDest}
                className="rounded-md border border-danger-300 bg-white px-3 py-1.5 text-xs font-medium text-danger-700 hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {hasContents ? 'Move contents & delete' : 'Delete tile'}
              </button>
            </div>
          </>
        ) : tab === 'services' ? (
          <ServicesTab
            tile={tile}
            data={data}
            services={services}
            onServiceDragStart={onServiceDragStart}
          />
        ) : (
          <RefinementsTab tile={tile} refinements={refinements} />
        )}
      </div>
    </div>
  );
}

/** Photo field: FileUpload → r2:// ref + current-value carry + preview + clear. */
function PhotoField({
  tile,
  onPreview,
}: {
  tile: StudioTile;
  onPreview: (url: string | null) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0">
        {tile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tile.photoUrl}
            alt=""
            className="h-16 w-20 rounded-md border border-ink/10 object-cover"
          />
        ) : (
          <span className="flex h-16 w-20 items-center justify-center rounded-md border border-dashed border-ink/15 text-ink/30">
            <ImageIcon className="h-5 w-5" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        {/* Carry the current raw value so submitting with no new upload keeps it. */}
        <input type="hidden" name="photo_ref" defaultValue={tile.photoRaw ?? ''} />
        <FileUpload
          bucket="samples"
          pathPrefix={`taxonomy/${tile.id}`}
          name="photo_ref"
          maxSizeMB={5}
          acceptedTypes={['image/webp', 'image/jpeg', 'image/png']}
          variant="square"
          onChange={(v) => {
            if (typeof v === 'string') onPreview(v);
          }}
        />
        <div className="flex items-center gap-2">
          <SubmitButton
            className="rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600"
            pendingLabel="Saving…"
          >
            Save photo
          </SubmitButton>
          {tile.photoRaw ? (
            <button
              type="submit"
              name="photo_ref"
              value=""
              className="text-[11px] text-ink/50 underline hover:text-ink"
            >
              Clear photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ServicesTab({
  tile,
  data,
  services,
  onServiceDragStart,
}: {
  tile: StudioTile;
  data: StudioData;
  services: StudioService[];
  onServiceDragStart: (canonical: string) => (e: DragEvent) => void;
}) {
  return (
    <div className="space-y-3">
      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-3 py-4 text-center text-sm text-ink/55">
          No services filed here yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li
              key={s.canonical}
              draggable
              onDragStart={onServiceDragStart(s.canonical)}
              className="cursor-grab rounded-lg border border-ink/10 bg-white p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {s.displayEn}
                    {s.displayTl ? (
                      <span className="ml-1 font-mono text-[11px] text-ink/45">({s.displayTl})</span>
                    ) : null}
                  </p>
                  <p className="truncate font-mono text-[10px] text-ink/45">{s.canonical}</p>
                </div>
                <GripVertical className="h-4 w-4 shrink-0 text-ink/25" aria-hidden />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={PHASE_TONE_BASE}>{s.phase}</Badge>
                {s.setnayan ? <Badge tone="bg-terracotta/10 text-terracotta">Setnayan</Badge> : null}
                {s.ph ? <Badge tone="bg-sky-50 text-sky-700">PH</Badge> : null}
                {s.rental ? <Badge tone="bg-ink/5 text-ink/70">Rental</Badge> : null}
                {s.hidden ? <Badge tone="bg-danger-50 text-danger-700">hidden</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {/* Faith */}
                <form action={setServiceFaith} className="flex items-center gap-1">
                  <input type="hidden" name="canonical_service" value={s.canonical} />
                  <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
                  <select
                    name="faith"
                    defaultValue={s.faith ?? ''}
                    aria-label={`Faith scope for ${s.canonical}`}
                    className="rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[11px] text-ink"
                  >
                    <option value="">Faith: all</option>
                    {data.faithVocab.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <SubmitButton
                    className="rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[10px] font-medium text-ink/70 hover:border-ink/40"
                    pendingLabel="…"
                  >
                    Set
                  </SubmitButton>
                </form>
                {/* Remap */}
                <form action={remapCanonical} className="flex items-center gap-1">
                  <input type="hidden" name="canonical_service" value={s.canonical} />
                  <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
                  <select
                    name="tile_id"
                    defaultValue={tile.id}
                    aria-label={`Move ${s.canonical} to another tile`}
                    className="max-w-[130px] rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[11px] text-ink"
                  >
                    {data.folders.map((f) => (
                      <optgroup key={f.id} label={f.label}>
                        {data.tiles
                          .filter((t) => t.parentId === f.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <SubmitButton
                    className="rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[10px] font-medium text-ink/70 hover:border-terracotta/50 hover:text-terracotta"
                    pendingLabel="…"
                  >
                    <MoveRight className="h-3 w-3" aria-hidden />
                  </SubmitButton>
                </form>
              </div>

              {/* Leaf refinements (vendor attribute schema) editor */}
              <LeafRefinementsPanel tile={tile} service={s} />

              {/* Leaf scoping flags (is_tradition / is_ph / is_rental /
                  marketplace_hidden) + secondary-tiles cross-listing. */}
              <ServiceFlagsPanel tile={tile} service={s} tileOptions={data.tileOptions} />
            </li>
          ))}
        </ul>
      )}

      {/* Add a service (with optional starter refinement + faith) */}
      <details className="rounded-lg border border-success-200 bg-success-50/30 p-3">
        <summary className="cursor-pointer text-xs font-medium text-success-800">
          ＋ Add a service to this tile
        </summary>
        <form action={createCanonicalLeaf} className="mt-3 space-y-2">
          <input type="hidden" name="tile_id" value={tile.id} />
          <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
          <input
            name="display_name_en"
            required
            placeholder="Service name"
            className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
          />
          <select
            name="faith"
            defaultValue=""
            className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Universal (everyone)</option>
            {data.faithVocab.map((f) => (
              <option key={f.key} value={f.key}>
                Faith: {f.label}
              </option>
            ))}
          </select>
          <input
            name="refinement_label"
            placeholder="Starter refinement (optional) — e.g. Customization"
            className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
          />
          <input
            name="refinement_options"
            placeholder="Options, comma-separated"
            className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-ink/70">
              <input type="checkbox" name="is_rental" className="h-3.5 w-3.5" /> Rental
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink/70">
              <input type="checkbox" name="is_ph" className="h-3.5 w-3.5" /> PH-specific
            </label>
            <SubmitButton
              className="ml-auto rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700"
              pendingLabel="Adding…"
            >
              Add service
            </SubmitButton>
          </div>
        </form>
      </details>
    </div>
  );
}

// ── Leaf Refinements panel (vendor attribute schema editor) ──────────────────────
//
// The owner-clarified "refinements" = the vendor attribute fields on a leaf
// (canonical_service_schemas.category_specific_attributes). This is the FIRST
// editor for them. ADDITIVE-ONLY (0044 never-orphan contract): field keys +
// option values are IMMUTABLE, so we offer add-field · add-option · relabel-field
// (label is pure display, safe) · retire/restore (soft). We deliberately DO NOT
// offer option-relabel — an option string IS the value a vendor stored, so
// renaming it in place would orphan every saved payload. Each form is a
// redirect-back <form action> carrying `_opentab=services` so a save re-opens
// right here. Shared attribute groups are shown read-only (edited elsewhere).

/** Human labels for the vendor-form-supported field types. Mirrors AttributeFieldDef. */
const LEAF_FIELD_TYPE_LABELS: Record<string, string> = {
  boolean: 'Yes / no',
  int: 'Number',
  text_short: 'Short text',
  text_long: 'Long text',
  enum: 'Pick one',
  multi_select: 'Pick many',
  multi_select_open: 'Tags (free)',
};

/** The types the admin can mint here + whether they carry a fixed option list. */
const LEAF_TYPE_CHOICES: { value: string; hasOptions: boolean }[] = [
  { value: 'boolean', hasOptions: false },
  { value: 'int', hasOptions: false },
  { value: 'text_short', hasOptions: false },
  { value: 'text_long', hasOptions: false },
  { value: 'enum', hasOptions: true },
  { value: 'multi_select', hasOptions: true },
  { value: 'multi_select_open', hasOptions: false },
];

const OPTION_BEARING = new Set(['enum', 'multi_select']);

/** Underscores → spaces, matching the vendor form's option/label display. */
function humanize(s: string): string {
  return s.replaceAll('_', ' ');
}

function LeafRefinementsPanel({ tile, service }: { tile: StudioTile; service: StudioService }) {
  const [open, setOpen] = useState(false);
  const activeCount = service.refinements.filter((r) => !r.retired).length;
  const retiredCount = service.refinements.length - activeCount;

  return (
    <div className="mt-2 rounded-lg border border-ink/10 bg-cream/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink/40" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/40" aria-hidden />
        )}
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-ink/45" aria-hidden />
        <span className="text-xs font-medium text-ink/80">Refinements</span>
        <span className="text-[10px] text-ink/45">(vendor attributes)</span>
        <span className="ml-auto flex items-center gap-1">
          <Badge tone="bg-ink/5 text-ink/60">{activeCount} active</Badge>
          {retiredCount > 0 ? <Badge tone="bg-ink/5 text-ink/40">{retiredCount} retired</Badge> : null}
          <span className="font-mono text-[9px] text-ink/35">v{service.schemaVersion}</span>
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-ink/10 px-2.5 py-3">
          <p className="text-[10px] leading-relaxed text-ink/50">
            The attributes vendors fill in for <span className="font-medium text-ink/70">{service.displayEn}</span>.
            Keys and option values are permanent (a vendor’s saved answer must never break) — so you can
            <strong> add</strong> and <strong>rename labels</strong>, and <strong>retire</strong> instead of delete.
            Every change bumps the schema version.
          </p>

          {/* Shared groups — read-only */}
          {service.sharedGroups.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-ink/40">Shared groups:</span>
              {service.sharedGroups.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white px-2 py-0.5 font-mono text-[10px] text-ink/55"
                >
                  <Lock className="h-2.5 w-2.5" aria-hidden />
                  {g}
                </span>
              ))}
            </div>
          ) : null}

          {/* Field cards */}
          {service.refinements.length === 0 ? (
            <p className="rounded-md border border-dashed border-ink/15 bg-white/60 px-2.5 py-3 text-center text-[11px] text-ink/50">
              No refinements yet. Add the first one below.
            </p>
          ) : (
            <ul className="space-y-2">
              {service.refinements.map((f) => (
                <LeafFieldCard key={f.key} tile={tile} service={service} field={f} />
              ))}
            </ul>
          )}

          {/* Add a field */}
          <AddLeafFieldForm tile={tile} service={service} />
        </div>
      ) : null}
    </div>
  );
}

// ── Service scoping flags panel ──────────────────────────────────────────────
//
// The per-canonical scoping/marketplace flags, now editable after creation:
//   is_tradition · is_ph · is_rental · marketplace_hidden  (quiet toggles)
//   secondary_tiles (cross-listing checkboxes)
// dietary stays READ-ONLY (a dietary canonical must never be faith-gated —
// mirrors setServiceFaith's de-faith guard; dietary is a per-vendor grade). Kept
// as a quiet collapsible so it never adds badge noise to the row.

const SERVICE_FLAG_DEFS: { flag: string; label: string; get: (s: StudioService) => boolean }[] = [
  { flag: 'is_tradition', label: 'Cultural / tradition', get: (s) => s.tradition },
  { flag: 'is_ph', label: 'PH-specific', get: (s) => s.ph },
  { flag: 'is_rental', label: 'Rental', get: (s) => s.rental },
  { flag: 'marketplace_hidden', label: 'Hidden from marketplace', get: (s) => s.hidden },
];

function ServiceFlagsPanel({
  tile,
  service,
  tileOptions,
}: {
  tile: StudioTile;
  service: StudioService;
  tileOptions: StudioTileOption[];
}) {
  const [open, setOpen] = useState(false);
  const onCount = SERVICE_FLAG_DEFS.filter((d) => d.get(service)).length;
  const secondarySet = new Set(service.secondaryTiles);
  // Cross-list candidates = every tile except this service's home tile.
  const crossListOptions = tileOptions.filter((t) => t.id !== service.tileId);

  return (
    <div className="mt-2 rounded-lg border border-ink/10 bg-cream/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink/40" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/40" aria-hidden />
        )}
        <Tag className="h-3.5 w-3.5 shrink-0 text-ink/45" aria-hidden />
        <span className="text-xs font-medium text-ink/80">Scoping flags</span>
        <span className="ml-auto flex items-center gap-1">
          {onCount > 0 ? <Badge tone="bg-ink/5 text-ink/60">{onCount} on</Badge> : null}
          {service.secondaryTiles.length > 0 ? (
            <Badge tone="bg-sky-50 text-sky-700">
              +{service.secondaryTiles.length} tile{service.secondaryTiles.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-ink/10 px-2.5 py-3">
          {/* Boolean toggles — each is a one-field redirect-back form. */}
          <div className="flex flex-wrap gap-1.5">
            {SERVICE_FLAG_DEFS.map((d) => {
              const on = d.get(service);
              return (
                <form key={d.flag} action={setServiceFlag}>
                  <input type="hidden" name="canonical_service" value={service.canonical} />
                  <input type="hidden" name="flag" value={d.flag} />
                  <input type="hidden" name="value" value={on ? '0' : '1'} />
                  <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
                  <input type="hidden" name="_opentab" value="services" />
                  <SubmitButton
                    className={
                      on
                        ? 'inline-flex items-center gap-1 rounded-full border border-terracotta/40 bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium text-terracotta hover:bg-terracotta/15'
                        : 'inline-flex items-center gap-1 rounded-full border border-ink/12 bg-white px-2 py-0.5 text-[10px] font-medium text-ink/50 hover:border-ink/30 hover:text-ink/70'
                    }
                    pendingLabel="…"
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${on ? 'bg-terracotta' : 'bg-ink/20'}`}
                      aria-hidden
                    />
                    {d.label}
                  </SubmitButton>
                </form>
              );
            })}
          </div>

          {/* Dietary — read-only (dietary services stay universal). */}
          {service.dietary ? (
            <p className="flex items-center gap-1.5 text-[10px] text-ink/50">
              <Lock className="h-2.5 w-2.5" aria-hidden />
              Dietary: <span className="font-mono text-ink/70">{service.dietary}</span> — stays
              universal (a per-vendor grade, edited elsewhere).
            </p>
          ) : null}

          {/* Secondary tiles — cross-listing checkboxes. */}
          <form action={setServiceSecondaryTiles} className="space-y-2">
            <input type="hidden" name="canonical_service" value={service.canonical} />
            <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
            <input type="hidden" name="_opentab" value="services" />
            <p className="text-[10px] uppercase tracking-wide text-ink/40">
              Cross-list on other tiles
            </p>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-ink/10 bg-white p-2 sm:grid-cols-2">
              {crossListOptions.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-[11px] text-ink/70">
                  <input
                    type="checkbox"
                    name="secondary_tiles"
                    value={t.id}
                    defaultChecked={secondarySet.has(t.id)}
                    className="h-3 w-3"
                  />
                  <span className="truncate">{t.label}</span>
                </label>
              ))}
            </div>
            <SubmitButton
              className="rounded-md border border-ink/15 bg-white px-2.5 py-1 text-[10px] font-medium text-ink/70 hover:border-terracotta/50 hover:text-terracotta"
              pendingLabel="Saving…"
            >
              Save cross-listing
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function LeafFieldCard({
  tile,
  service,
  field,
}: {
  tile: StudioTile;
  service: StudioService;
  field: StudioLeafRefinement;
}) {
  const [renaming, setRenaming] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
  const hasOptions = OPTION_BEARING.has(field.type);

  return (
    <li
      className={`rounded-md border p-2 ${
        field.retired ? 'border-ink/10 bg-ink/[0.02] opacity-70' : 'border-ink/15 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {renaming ? (
              <form action={relabelLeafAttributeFieldAction} className="flex items-center gap-1">
                <LeafHiddenFields tile={tile} service={service} />
                <input type="hidden" name="field_key" value={field.key} />
                <input
                  name="field_label"
                  defaultValue={field.label}
                  autoFocus
                  required
                  minLength={2}
                  maxLength={80}
                  className="rounded border border-ink/20 bg-white px-1.5 py-0.5 text-xs"
                  aria-label={`Rename ${field.key}`}
                />
                <SubmitButton
                  className="rounded border border-ink/15 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:border-terracotta/50 hover:text-terracotta"
                  pendingLabel="…"
                >
                  Save
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setRenaming(false)}
                  className="rounded p-0.5 text-ink/45 hover:bg-black/5"
                  aria-label="Cancel rename"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </form>
            ) : (
              <>
                <span className="text-xs font-medium text-ink">{field.label}</span>
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="rounded p-0.5 text-ink/35 hover:bg-black/5 hover:text-ink/60"
                  aria-label={`Rename ${field.label}`}
                  title="Rename (label only — key is permanent)"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                </button>
              </>
            )}
            {field.retired ? <Badge tone="bg-ink/5 text-ink/45">retired</Badge> : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-ink/40">{field.key}</span>
            <Badge tone="bg-ink/5 text-ink/55">{LEAF_FIELD_TYPE_LABELS[field.type] ?? field.type}</Badge>
          </div>
        </div>

        {/* Retire / restore the whole field */}
        <form action={retireLeafAttributeFieldAction} className="shrink-0">
          <LeafHiddenFields tile={tile} service={service} />
          <input type="hidden" name="field_key" value={field.key} />
          <input type="hidden" name="retired" value={field.retired ? 'false' : 'true'} />
          <SubmitButton
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
              field.retired
                ? 'border-success-200 bg-white text-success-700 hover:bg-success-50'
                : 'border-ink/15 bg-white text-ink/55 hover:border-ink/40'
            }`}
            pendingLabel="…"
          >
            {field.retired ? (
              <>
                <Undo2 className="h-3 w-3" aria-hidden /> Restore
              </>
            ) : (
              <>
                <Archive className="h-3 w-3" aria-hidden /> Retire
              </>
            )}
          </SubmitButton>
        </form>
      </div>

      {/* Options (enum / multi_select) */}
      {hasOptions ? (
        <div className="mt-2 border-t border-ink/10 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {field.options.length === 0 ? (
              <span className="text-[10px] text-ink/45">No options.</span>
            ) : (
              field.options.map((opt) => (
                <span
                  key={opt.value}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                    opt.retired
                      ? 'border-ink/10 bg-ink/[0.02] text-ink/40 line-through'
                      : 'border-ink/15 bg-cream text-ink/70'
                  }`}
                >
                  <span>{humanize(opt.value)}</span>
                  <form action={retireLeafAttributeOptionAction} className="inline-flex">
                    <LeafHiddenFields tile={tile} service={service} />
                    <input type="hidden" name="field_key" value={field.key} />
                    <input type="hidden" name="option" value={opt.value} />
                    <input type="hidden" name="retired" value={opt.retired ? 'false' : 'true'} />
                    <button
                      type="submit"
                      className="rounded p-0.5 text-ink/40 hover:bg-black/10"
                      aria-label={opt.retired ? `Restore option ${opt.value}` : `Retire option ${opt.value}`}
                      title={opt.retired ? 'Restore option' : 'Retire option (kept for saved answers)'}
                    >
                      {opt.retired ? <Undo2 className="h-2.5 w-2.5" aria-hidden /> : <X className="h-2.5 w-2.5" aria-hidden />}
                    </button>
                  </form>
                </span>
              ))
            )}
            {addingOption ? (
              <form action={addLeafAttributeOptionAction} className="inline-flex items-center gap-1">
                <LeafHiddenFields tile={tile} service={service} />
                <input type="hidden" name="field_key" value={field.key} />
                <input
                  name="option_label"
                  autoFocus
                  required
                  maxLength={80}
                  placeholder="New option"
                  className="w-28 rounded border border-ink/20 bg-white px-1.5 py-0.5 text-[10px]"
                  aria-label={`New option for ${field.key}`}
                />
                <SubmitButton
                  className="rounded border border-success-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-success-700 hover:bg-success-50"
                  pendingLabel="…"
                >
                  Add
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setAddingOption(false)}
                  className="rounded p-0.5 text-ink/45 hover:bg-black/5"
                  aria-label="Cancel add option"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingOption(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/25 bg-white px-2 py-0.5 text-[10px] text-ink/55 hover:border-terracotta/50 hover:text-terracotta"
              >
                <Plus className="h-2.5 w-2.5" aria-hidden /> Option
              </button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** The hidden fields every leaf-refinement form needs so redirect-back re-opens
 *  this tile on the Services tab. */
function LeafHiddenFields({ tile, service }: { tile: StudioTile; service: StudioService }) {
  return (
    <>
      <input type="hidden" name="canonical_service" value={service.canonical} />
      <input type="hidden" name="tile_id" value={tile.id} />
      <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
      <input type="hidden" name="_opentab" value="services" />
    </>
  );
}

function AddLeafFieldForm({ tile, service }: { tile: StudioTile; service: StudioService }) {
  const [type, setType] = useState('multi_select');
  const needsOptions = OPTION_BEARING.has(type);
  return (
    <details className="rounded-md border border-success-200 bg-success-50/40 p-2">
      <summary className="cursor-pointer text-[11px] font-medium text-success-800">
        ＋ Add a refinement
      </summary>
      <form action={addLeafAttributeFieldAction} className="mt-2 space-y-1.5">
        <input type="hidden" name="canonical_service" value={service.canonical} />
        <input type="hidden" name="tile_id" value={tile.id} />
        <input type="hidden" name="_anchor" value={`t-${tile.id}`} />
        <input type="hidden" name="_opentab" value="services" />
        <input
          name="field_label"
          required
          minLength={2}
          maxLength={80}
          placeholder="Refinement name — e.g. Shooting style"
          className="w-full rounded border border-ink/20 bg-white px-2 py-1 text-xs"
        />
        <div className="flex items-center gap-1.5">
          <Tag className="h-3 w-3 shrink-0 text-ink/40" aria-hidden />
          <select
            name="field_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded border border-ink/20 bg-white px-1.5 py-1 text-xs"
            aria-label="Field type"
          >
            {LEAF_TYPE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {LEAF_FIELD_TYPE_LABELS[c.value]}
              </option>
            ))}
          </select>
        </div>
        {needsOptions ? (
          <input
            name="field_options"
            required
            placeholder="Options, comma-separated — e.g. candid, traditional, editorial"
            className="w-full rounded border border-ink/20 bg-white px-2 py-1 text-xs"
          />
        ) : (
          <input type="hidden" name="field_options" value="" />
        )}
        <SubmitButton
          className="rounded-md bg-success-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-success-700"
          pendingLabel="Adding…"
        >
          Add refinement
        </SubmitButton>
      </form>
    </details>
  );
}

// ── Refinements tab ─────────────────────────────────────────────────────────────
//
// Edits the onboarding "what kind of X?" leaves anchored to this tile
// (onboarding_refinements.tile_id) + their option grids. Leaf CRUD + option CRUD
// fire as redirect-back <form action> (carrying `_anchor=t-<tile>` +
// `_opentab=refinements` so a save re-opens right here). Reorder — both leaves
// within the tile and options within a leaf — uses drag OR up/down buttons and
// calls the JSON reorder actions, then router.refresh(). PROJECTABLE leaves keep
// their add/remove lock; dynamic-ceremony leaves show the faith-driven note.

const IMG_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

function RefinementsTab({
  tile,
  refinements,
}: {
  tile: StudioTile;
  refinements: StudioRefinementLeaf[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openLeaf, setOpenLeaf] = useState<string | null>(
    refinements.length === 1 ? refinements[0]!.leafKey : null,
  );
  const [flash, setFlash] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [dragLeaf, setDragLeaf] = useState<string | null>(null);
  const [dropLeafIdx, setDropLeafIdx] = useState<number | null>(null);

  const runReorder = useCallback(
    (fn: () => Promise<StudioActionResult>) => {
      startTransition(async () => {
        const res = await fn();
        if (res.ok) {
          setFlash({ kind: 'ok', text: res.message });
          router.refresh();
        } else {
          setFlash({ kind: 'error', text: res.error });
        }
      });
    },
    [router],
  );

  const leafKeys = refinements.map((l) => l.leafKey);

  const moveLeaf = (leafKey: string, dir: -1 | 1) => {
    const from = leafKeys.indexOf(leafKey);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= leafKeys.length) return;
    const next = leafKeys.slice();
    [next[from], next[to]] = [next[to]!, next[from]!];
    runReorder(() => reorderRefinementLeaves(tile.id, next));
  };

  const onLeafDrop = (idx: number) => (e: DragEvent) => {
    e.preventDefault();
    setDropLeafIdx(null);
    const leafKey = e.dataTransfer.getData('text/leaf') || dragLeaf;
    setDragLeaf(null);
    if (!leafKey) return;
    const from = leafKeys.indexOf(leafKey);
    if (from === -1) return;
    const next = leafKeys.slice();
    next.splice(from, 1);
    const insertAt = from < idx ? idx - 1 : idx;
    next.splice(insertAt, 0, leafKey);
    if (next.join() === leafKeys.join()) return;
    runReorder(() => reorderRefinementLeaves(tile.id, next));
  };

  if (refinements.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-3 py-4 text-center text-sm text-ink/55">
        No refinements anchored to this tile. Refinements are the couple-facing “what kind of{' '}
        {tile.label}?” cards in onboarding.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${pending ? 'opacity-60' : ''}`}>
      {flash ? (
        <div
          role={flash.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
            flash.kind === 'ok'
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-danger-200 bg-danger-50 text-danger-800'
          }`}
        >
          <span>
            {flash.kind === 'ok' ? '✓ ' : '⚠ '}
            {flash.text}
          </span>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 hover:bg-black/5"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : null}

      <p className="text-[11px] text-ink/50">
        The “what kind of {tile.label}?” cards couples see in onboarding. Drag or use ↑↓ to reorder.
      </p>

      {refinements.map((leaf, idx) => (
        <LeafBlock
          key={leaf.leafKey}
          tile={tile}
          leaf={leaf}
          open={openLeaf === leaf.leafKey}
          onToggle={() => setOpenLeaf((o) => (o === leaf.leafKey ? null : leaf.leafKey))}
          canMoveUp={idx > 0}
          canMoveDown={idx < refinements.length - 1}
          onMoveUp={() => moveLeaf(leaf.leafKey, -1)}
          onMoveDown={() => moveLeaf(leaf.leafKey, 1)}
          dragging={dragLeaf === leaf.leafKey}
          dropBefore={dropLeafIdx === idx && dragLeaf != null && dragLeaf !== leaf.leafKey}
          onDragStart={(e) => {
            setDragLeaf(leaf.leafKey);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/leaf', leaf.leafKey);
          }}
          onDragEnd={() => {
            setDragLeaf(null);
            setDropLeafIdx(null);
          }}
          onDragOver={(e) => {
            if (dragLeaf && dragLeaf !== leaf.leafKey) {
              e.preventDefault();
              setDropLeafIdx(idx);
            }
          }}
          onDrop={onLeafDrop(idx)}
          runReorder={runReorder}
        />
      ))}
    </div>
  );
}

function LeafBlock({
  tile,
  leaf,
  open,
  onToggle,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  dragging,
  dropBefore,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  runReorder,
}: {
  tile: StudioTile;
  leaf: StudioRefinementLeaf;
  open: boolean;
  onToggle: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragging: boolean;
  dropBefore: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  runReorder: (fn: () => Promise<StudioActionResult>) => void;
}) {
  const activeOpts = leaf.options.filter((o) => o.status === 'active').length;
  const anchor = `t-${tile.id}`;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-xl border bg-white transition ${
        dragging ? 'opacity-40' : 'border-ink/10'
      } ${dropBefore ? 'ring-2 ring-terracotta ring-offset-1' : ''} ${
        leaf.status === 'retired' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="shrink-0 cursor-grab text-ink/25" aria-hidden title="Drag to reorder">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <RefThumb url={leaf.mainPhotoUrl} className="h-10 w-12" />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{leaf.label}</span>
            {leaf.status === 'retired' ? (
              <Badge tone="bg-ink/10 text-ink/50">retired</Badge>
            ) : null}
            {leaf.dynamic ? (
              <Badge tone="bg-terracotta/10 text-terracotta">faith-adaptive</Badge>
            ) : null}
            {leaf.isProjectable ? <Badge tone="bg-sky-50 text-sky-700">matched</Badge> : null}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] text-ink/45">
            {leaf.leafKey} · {leaf.dynamic ? 'faith-driven options' : `${activeOpts} option${activeOpts === 1 ? '' : 's'}`}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Move up"
            className="rounded p-1 text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move down"
            className="rounded p-1 text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="rounded p-1 text-ink/40 hover:bg-ink/5 hover:text-ink"
          >
            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-ink/10 px-3 py-3">
          {/* Leaf fields (label / description / status / main photo) */}
          <form action={updateRefinementLeaf.bind(null, leaf.leafKey)} className="space-y-2.5">
            <input type="hidden" name="main_photo_current" value={leaf.mainPhotoRaw ?? ''} />
            <input type="hidden" name="_anchor" value={anchor} />
            <input type="hidden" name="_opentab" value="refinements" />
            <label className="block space-y-1">
              <span className="block text-[11px] font-medium text-ink/70">Label</span>
              <input
                name="label_en"
                required
                defaultValue={leaf.label}
                className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="block space-y-1">
              <span className="block text-[11px] font-medium text-ink/70">
                Description <span className="text-ink/45">(under the main photo)</span>
              </span>
              <input
                name="description_en"
                defaultValue={leaf.description}
                placeholder="e.g. The centerpiece sweet of your reception."
                className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <div className="flex items-start gap-3">
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-ink/70">Main photo</span>
                <RefThumb url={leaf.mainPhotoUrl} className="h-14 w-[4.67rem]" />
              </div>
              <div className="min-w-0 flex-1">
                <FileUpload
                  bucket="samples"
                  pathPrefix={`refinements/${leaf.leafKey}`}
                  name="main_photo_url"
                  maxSizeMB={5}
                  acceptedTypes={IMG_TYPES}
                  variant="wide"
                  label="Replace"
                  help="Leave empty to keep the current one."
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink/70">
              <input
                type="checkbox"
                name="status"
                value="retired"
                defaultChecked={leaf.status === 'retired'}
                className="h-3.5 w-3.5"
              />
              Retire (hide from onboarding)
            </label>
            <SubmitButton
              className="rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600"
              pendingLabel="Saving…"
            >
              Save refinement
            </SubmitButton>
          </form>

          {/* Options */}
          {leaf.dynamic ? (
            <p className="rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-[11px] text-ink/60">
              This refinement is <strong>faith-adaptive</strong> — its options (church / mosque / temple /
              garden / beach / civil …) come from the couple’s faith pick, with photos from the shared{' '}
              <code className="font-mono">/onboarding/prefs</code> set. Edit the label / description / main
              photo above.
            </p>
          ) : (
            <OptionGrid tile={tile} leaf={leaf} runReorder={runReorder} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function OptionGrid({
  tile,
  leaf,
  runReorder,
}: {
  tile: StudioTile;
  leaf: StudioRefinementLeaf;
  runReorder: (fn: () => Promise<StudioActionResult>) => void;
}) {
  const [dragOpt, setDragOpt] = useState<string | null>(null);
  const [dropOptIdx, setDropOptIdx] = useState<number | null>(null);
  const optKeys = leaf.options.map((o) => o.optionKey);

  const moveOpt = (optionKey: string, dir: -1 | 1) => {
    const from = optKeys.indexOf(optionKey);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= optKeys.length) return;
    const next = optKeys.slice();
    [next[from], next[to]] = [next[to]!, next[from]!];
    runReorder(() => reorderRefinementOptions(leaf.leafKey, next));
  };

  const onOptDrop = (idx: number) => (e: DragEvent) => {
    e.preventDefault();
    setDropOptIdx(null);
    const optionKey = e.dataTransfer.getData('text/option') || dragOpt;
    setDragOpt(null);
    if (!optionKey) return;
    const from = optKeys.indexOf(optionKey);
    if (from === -1) return;
    const next = optKeys.slice();
    next.splice(from, 1);
    const insertAt = from < idx ? idx - 1 : idx;
    next.splice(insertAt, 0, optionKey);
    if (next.join() === optKeys.join()) return;
    runReorder(() => reorderRefinementOptions(leaf.leafKey, next));
  };

  return (
    <div className="space-y-2">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">Options</h4>
      {leaf.options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-3 py-3 text-center text-[11px] text-ink/55">
          No options yet.
        </p>
      ) : (
        <div className="space-y-2">
          {leaf.options.map((o, idx) => (
            <OptionCard
              key={o.optionKey}
              tile={tile}
              leaf={leaf}
              option={o}
              canDelete={!leaf.isProjectable}
              canMoveUp={idx > 0}
              canMoveDown={idx < leaf.options.length - 1}
              onMoveUp={() => moveOpt(o.optionKey, -1)}
              onMoveDown={() => moveOpt(o.optionKey, 1)}
              dragging={dragOpt === o.optionKey}
              dropBefore={dropOptIdx === idx && dragOpt != null && dragOpt !== o.optionKey}
              onDragStart={(e) => {
                setDragOpt(o.optionKey);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/option', o.optionKey);
              }}
              onDragEnd={() => {
                setDragOpt(null);
                setDropOptIdx(null);
              }}
              onDragOver={(e) => {
                if (dragOpt && dragOpt !== o.optionKey) {
                  e.preventDefault();
                  setDropOptIdx(idx);
                }
              }}
              onDrop={onOptDrop(idx)}
            />
          ))}
        </div>
      )}

      {leaf.isProjectable ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-[11px] text-ink/60">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" aria-hidden />
          <span>
            These options are <strong>reserved</strong> — their keys drive vendor matching, so the set is
            fixed. You can edit each option’s label, emoji, and photo above, but can’t add or remove options
            here.
          </span>
        </p>
      ) : (
        <AddOptionForm tile={tile} leaf={leaf} />
      )}
    </div>
  );
}

function OptionCard({
  tile,
  leaf,
  option,
  canDelete,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  dragging,
  dropBefore,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  tile: StudioTile;
  leaf: StudioRefinementLeaf;
  option: StudioRefinementOption;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragging: boolean;
  dropBefore: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}) {
  const anchor = `t-${tile.id}`;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-lg border bg-white p-2.5 transition ${
        dragging ? 'opacity-40' : 'border-ink/10'
      } ${dropBefore ? 'ring-2 ring-terracotta ring-offset-1' : ''} ${
        option.status === 'retired' ? 'opacity-60' : ''
      }`}
    >
      <form
        action={updateRefinementOption.bind(null, leaf.leafKey, option.optionKey)}
        className="space-y-2"
      >
        <input type="hidden" name="photo_current" value={option.photoRaw ?? ''} />
        <input type="hidden" name="_anchor" value={anchor} />
        <input type="hidden" name="_opentab" value="refinements" />
        <div className="flex items-start gap-2">
          <span className="shrink-0 cursor-grab pt-1 text-ink/25" aria-hidden title="Drag to reorder">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <RefThumb url={option.photoUrl} className="h-12 w-12" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex gap-1.5">
              <input
                name="emoji"
                maxLength={4}
                defaultValue={option.emoji}
                aria-label="Emoji"
                placeholder="🎂"
                className="w-12 shrink-0 rounded-md border border-ink/15 bg-white px-1 py-1 text-center text-sm"
              />
              <input
                name="label_en"
                required
                defaultValue={option.label}
                aria-label="Option label"
                className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
              />
            </div>
            <FileUpload
              bucket="samples"
              pathPrefix={`refinements/${leaf.leafKey}`}
              name="photo_url"
              maxSizeMB={5}
              acceptedTypes={IMG_TYPES}
              variant="square"
              label="Replace photo"
            />
          </div>
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="Move option up"
              className="rounded p-1 text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Move option down"
              className="rounded p-1 text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ink/70">
            <input
              type="checkbox"
              name="status"
              value="retired"
              defaultChecked={option.status === 'retired'}
              className="h-3.5 w-3.5"
            />
            Retire
          </label>
          <SubmitButton
            className="rounded-md bg-mulberry px-2.5 py-1 text-[11px] font-medium text-cream hover:bg-mulberry-600"
            pendingLabel="…"
          >
            Save
          </SubmitButton>
        </div>
      </form>
      {canDelete ? (
        <form
          action={removeRefinementOption.bind(null, leaf.leafKey, option.optionKey)}
          className="mt-1.5 text-right"
        >
          <input type="hidden" name="_anchor" value={anchor} />
          <input type="hidden" name="_opentab" value="refinements" />
          <SubmitButton
            className="inline-flex items-center gap-1 text-[10px] text-ink/45 hover:text-danger-700"
            pendingLabel="Deleting…"
          >
            <Trash2 className="h-3 w-3" aria-hidden /> Delete option
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

/** Add-option form — photo REQUIRED (owner 2026-06-10). The submit is disabled
 *  until a photo is uploaded so the required-photo rule surfaces before the POST
 *  (the server action also re-checks). */
function AddOptionForm({ tile, leaf }: { tile: StudioTile; leaf: StudioRefinementLeaf }) {
  const [hasPhoto, setHasPhoto] = useState(false);
  const anchor = `t-${tile.id}`;
  return (
    <form
      action={addRefinementOption.bind(null, leaf.leafKey)}
      className="space-y-2 rounded-lg border border-dashed border-success-300 bg-success-50/30 p-2.5"
    >
      <input type="hidden" name="_anchor" value={anchor} />
      <input type="hidden" name="_opentab" value="refinements" />
      <p className="text-[11px] font-medium text-success-800">Add an option</p>
      <div className="flex gap-1.5">
        <input
          name="emoji"
          maxLength={4}
          aria-label="Emoji"
          placeholder="🎂"
          className="w-12 shrink-0 rounded-md border border-ink/15 bg-white px-1 py-1 text-center text-sm"
        />
        <input
          name="label_en"
          required
          aria-label="New option label"
          placeholder="e.g. Glazed"
          className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink"
        />
      </div>
      <div className="space-y-1">
        <span className="block text-[11px] font-medium text-ink/70">
          Photo <span className="text-danger-600">*required</span>
        </span>
        <FileUpload
          bucket="samples"
          pathPrefix={`refinements/${leaf.leafKey}`}
          name="photo_url"
          maxSizeMB={5}
          acceptedTypes={IMG_TYPES}
          variant="square"
          onChange={(v) => setHasPhoto(typeof v === 'string' && v.length > 0)}
        />
      </div>
      <SubmitButton
        disabled={!hasPhoto}
        className="inline-flex items-center gap-1.5 rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-40"
        pendingLabel="Adding…"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add option
      </SubmitButton>
      {!hasPhoto ? (
        <span className="ml-2 text-[10px] text-ink/45">Upload a photo to enable — every new option needs one.</span>
      ) : null}
    </form>
  );
}

function RefThumb({ url, className }: { url: string | null; className: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`shrink-0 rounded-md object-cover ring-1 ring-ink/10 ${className}`}
      aria-hidden
    />
  ) : (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md bg-ink/5 text-ink/30 ring-1 ring-ink/10 ${className}`}
      aria-hidden
    >
      <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

// ── Vocabularies · Event types ──────────────────────────────────────────────
//
// The event_type_vocab editor: relabel, reorder, activate/deactivate, add-new.
// Additive-only — keys are permanent, rows never delete, deactivate is soft.
// Copy is deliberately explicit that a vocab row is for CATEGORY SCOPING, NOT a
// couple-facing launch (that's the separate gated Event-Type Engine). Usage
// counts make deactivation informed.

function VocabRowShell({
  title,
  subtitle,
  statusPill,
  usagePill,
  reorder,
  children,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  statusPill: React.ReactNode;
  usagePill: React.ReactNode;
  reorder: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-white p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mt-0.5 flex shrink-0 flex-col gap-0.5">{reorder}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {title}
            {statusPill}
            {usagePill}
          </div>
          <p className="mt-0.5 text-[11px] text-ink/50">{subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>
        </div>
      </div>
    </li>
  );
}

function ReorderButtons({
  action,
  keyField,
  keyValue,
  view,
}: {
  action: (fd: FormData) => void | Promise<void>;
  keyField: string;
  keyValue: string;
  view: string;
}) {
  const btn =
    'rounded border border-ink/12 bg-cream p-0.5 text-ink/50 hover:border-terracotta/40 hover:text-terracotta disabled:opacity-40';
  return (
    <>
      <form action={action}>
        <input type="hidden" name={keyField} value={keyValue} />
        <input type="hidden" name="dir" value="up" />
        <input type="hidden" name="_view" value={view} />
        <button type="submit" className={btn} aria-label="Move up" title="Move up">
          <ArrowUp className="h-3 w-3" aria-hidden />
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name={keyField} value={keyValue} />
        <input type="hidden" name="dir" value="down" />
        <input type="hidden" name="_view" value={view} />
        <button type="submit" className={btn} aria-label="Move down" title="Move down">
          <ArrowDown className="h-3 w-3" aria-hidden />
        </button>
      </form>
    </>
  );
}

const VOCAB_INPUT =
  'rounded-md border border-ink/15 bg-white px-2 py-1 text-xs text-ink';
const VOCAB_BTN =
  'rounded-md border border-ink/15 bg-white px-2 py-1 text-[10px] font-medium text-ink/70 hover:border-terracotta/50 hover:text-terracotta';

function EventTypeVocabPanel({
  rows,
  query,
}: {
  rows: StudioEventTypeVocab[];
  query: string;
}) {
  const active = rows.filter((r) => r.status === 'active');
  const filtered = query
    ? rows.filter((r) => r.key.includes(query) || r.label.toLowerCase().includes(query))
    : rows;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-ink/10 bg-cream/60 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-ink/60" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Event types</h2>
          <span className="font-mono text-[11px] text-ink/45">{active.length} active · {rows.length} total</span>
        </div>
        <p className="mt-1 max-w-prose text-sm text-ink/60">
          The vocabulary that scopes which categories each event offers. Used for{' '}
          <strong>category scoping</strong> only — adding one here does not, by itself, put a new
          event type in front of couples (that&apos;s the separate Event-Type Engine). Keys are
          permanent; deactivating one just hides it from scoping pickers — existing scopes keep
          working.
        </p>
      </header>

      {/* Add-new */}
      <form
        action={createEventTypeVocab}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-success-200 bg-success-50/30 p-3"
      >
        <input type="hidden" name="_view" value="vocab-event" />
        <label className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
            New event type
          </span>
          <input
            name="label_en"
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. House Blessing"
            className={`${VOCAB_INPUT} w-52`}
          />
        </label>
        <SubmitButton
          className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700"
          pendingLabel="Adding…"
        >
          <Plus className="mr-1 inline h-3 w-3" aria-hidden />
          Add for scoping
        </SubmitButton>
        <span className="text-[11px] text-ink/45">Key = snake_case from the label · permanent.</span>
      </form>

      <ul className="space-y-2">
        {filtered.map((r) => {
          const isActive = r.status === 'active';
          return (
            <VocabRowShell
              key={r.key}
              reorder={
                isActive ? (
                  <ReorderButtons
                    action={reorderEventTypeVocab}
                    keyField="event_type"
                    keyValue={r.key}
                    view="vocab-event"
                  />
                ) : null
              }
              title={
                <span className="text-sm font-semibold text-ink">
                  {r.label}{' '}
                  <code className="ml-1 font-mono text-[11px] font-normal text-ink/45">{r.key}</code>
                </span>
              }
              statusPill={
                isActive ? (
                  <Badge tone="bg-success-100 text-success-800">Active</Badge>
                ) : (
                  <Badge tone="bg-ink/10 text-ink/55">Inactive</Badge>
                )
              }
              usagePill={
                <Badge tone={r.usage > 0 ? 'bg-sky-50 text-sky-700' : 'bg-ink/5 text-ink/45'}>
                  scoped by {r.usage}
                </Badge>
              }
              subtitle={
                r.isBase
                  ? 'The base event type — always active.'
                  : r.usage > 0
                    ? `${r.usage} tile${r.usage === 1 ? '' : 's'} / service${r.usage === 1 ? '' : 's'} scope to this type.`
                    : 'Not referenced by any scoped tile or service.'
              }
            >
              {/* Relabel */}
              <form action={relabelEventTypeVocab} className="flex items-center gap-1">
                <input type="hidden" name="event_type" value={r.key} />
                <input type="hidden" name="_view" value="vocab-event" />
                <input
                  name="label_en"
                  defaultValue={r.label}
                  required
                  minLength={2}
                  maxLength={80}
                  aria-label={`Rename ${r.key}`}
                  className={`${VOCAB_INPUT} w-44`}
                />
                <SubmitButton className={VOCAB_BTN} pendingLabel="…">
                  Save name
                </SubmitButton>
              </form>
              {/* Status toggle */}
              {!r.isBase ? (
                <form action={setEventTypeVocabStatus}>
                  <input type="hidden" name="event_type" value={r.key} />
                  <input type="hidden" name="active" value={isActive ? '0' : '1'} />
                  <input type="hidden" name="_view" value="vocab-event" />
                  <SubmitButton
                    className={
                      isActive
                        ? 'rounded-md border border-ink/15 bg-white px-2 py-1 text-[10px] font-medium text-ink/60 hover:border-danger-300 hover:text-danger-700'
                        : 'rounded-md border border-success-300 bg-white px-2 py-1 text-[10px] font-medium text-success-700 hover:bg-success-50'
                    }
                    pendingLabel="…"
                  >
                    {isActive ? 'Deactivate' : 'Reactivate'}
                  </SubmitButton>
                </form>
              ) : null}
            </VocabRowShell>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-6 text-center text-sm text-ink/55">
          No event types match “{query}”.
        </p>
      ) : null}
    </section>
  );
}

// ── Vocabularies · Faiths (wedding types) ────────────────────────────────────
//
// The faith_vocab editor + the per-faith launch gate folded from
// /admin/wedding-types (status Live / Coming soon / Disabled + readiness
// threshold + counts). ⚠ FAITH LANDMINE: keys are TITLE-CASE and compared with
// strict `===` — the UI never lowercases a key. Additive-only, same as events.

function FaithLaunchPill({ launch }: { launch: StudioFaithLaunch | null }) {
  if (!launch) return <Badge tone="bg-ink/5 text-ink/45">no launch row</Badge>;
  if (launch.status === 'active') return <Badge tone="bg-success-100 text-success-800">Live</Badge>;
  if (launch.status === 'coming_soon')
    return <Badge tone="bg-warn-100 text-warn-900">Coming soon</Badge>;
  return <Badge tone="bg-ink/10 text-ink/60">Disabled</Badge>;
}

function FaithVocabPanel({ rows, query }: { rows: StudioFaithVocab[]; query: string }) {
  const active = rows.filter((r) => r.status === 'active');
  const filtered = query
    ? rows.filter(
        (r) => r.key.toLowerCase().includes(query) || r.label.toLowerCase().includes(query),
      )
    : rows;

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-ink/10 bg-cream/60 p-4">
        <div className="flex items-center gap-2">
          <Church className="h-5 w-5 text-ink/60" aria-hidden />
          <h2 className="text-base font-semibold text-ink">Faiths (wedding types)</h2>
          <span className="font-mono text-[11px] text-ink/45">{active.length} active · {rows.length} total</span>
        </div>
        <p className="mt-1 max-w-prose text-sm text-ink/60">
          The faith vocabulary that tags services and gates the wedding-type picker. The{' '}
          <strong>launch gate</strong> (Live / Coming soon / Disabled + a readiness threshold)
          decides which faiths couples can pick — open one when its vendors can cater it. Faith keys
          are permanent and case-sensitive; deactivating one hides it from scoping while existing
          tags keep working.
        </p>
      </header>

      {/* Add-new */}
      <form
        action={createFaithVocab}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-success-200 bg-success-50/30 p-3"
      >
        <input type="hidden" name="_view" value="vocab-faith" />
        <label className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
            New faith
          </span>
          <input
            name="label_en"
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. Methodist"
            className={`${VOCAB_INPUT} w-52`}
          />
        </label>
        <SubmitButton
          className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700"
          pendingLabel="Adding…"
        >
          <Plus className="mr-1 inline h-3 w-3" aria-hidden />
          Add faith
        </SubmitButton>
        <span className="text-[11px] text-ink/45">
          Key = Title-Case from the label · permanent · starts as Coming soon.
        </span>
      </form>

      <ul className="space-y-2">
        {filtered.map((r) => {
          const isActive = r.status === 'active';
          return (
            <VocabRowShell
              key={r.key}
              reorder={
                isActive ? (
                  <ReorderButtons
                    action={reorderFaithVocab}
                    keyField="faith_key"
                    keyValue={r.key}
                    view="vocab-faith"
                  />
                ) : null
              }
              title={
                <span className="text-sm font-semibold text-ink">
                  {r.label}{' '}
                  <code className="ml-1 font-mono text-[11px] font-normal text-ink/45">{r.key}</code>
                </span>
              }
              statusPill={
                <span className="flex items-center gap-1">
                  {isActive ? (
                    <Badge tone="bg-success-100 text-success-800">Active</Badge>
                  ) : (
                    <Badge tone="bg-ink/10 text-ink/55">Inactive</Badge>
                  )}
                  <FaithLaunchPill launch={r.launch} />
                  {r.isCivil ? <Badge tone="bg-ink/5 text-ink/50">civil</Badge> : null}
                </span>
              }
              usagePill={
                <Badge tone={r.usage > 0 ? 'bg-warn-50 text-warn-800' : 'bg-ink/5 text-ink/45'}>
                  {r.usage} tagged
                </Badge>
              }
              subtitle={
                r.launch
                  ? `${r.launch.total} / ${r.launch.threshold} compatible · ${r.launch.vendorCount} vendors · ${r.launch.venueCount} ceremonial venues${r.launch.ready ? ' · ready' : ''}`
                  : 'No launch-status row maps to this faith.'
              }
            >
              {/* Relabel */}
              <form action={relabelFaithVocab} className="flex items-center gap-1">
                <input type="hidden" name="faith_key" value={r.key} />
                <input type="hidden" name="_view" value="vocab-faith" />
                <input
                  name="label_en"
                  defaultValue={r.label}
                  required
                  minLength={2}
                  maxLength={80}
                  aria-label={`Rename ${r.key}`}
                  className={`${VOCAB_INPUT} w-44`}
                />
                <SubmitButton className={VOCAB_BTN} pendingLabel="…">
                  Save name
                </SubmitButton>
              </form>

              {/* Launch status flips */}
              {r.launch ? (
                <div className="flex flex-wrap items-center gap-1">
                  {r.launch.status !== 'active' ? (
                    <FaithLaunchButton faithKey={r.key} status="active" tone="live">
                      Go live
                    </FaithLaunchButton>
                  ) : null}
                  {r.launch.status !== 'coming_soon' ? (
                    <FaithLaunchButton faithKey={r.key} status="coming_soon" tone="hold">
                      Hold
                    </FaithLaunchButton>
                  ) : null}
                  {r.launch.status !== 'disabled' ? (
                    <FaithLaunchButton faithKey={r.key} status="disabled" tone="disable">
                      Disable
                    </FaithLaunchButton>
                  ) : null}
                </div>
              ) : null}

              {/* Readiness threshold */}
              {r.launch ? (
                <form action={setFaithLaunchThreshold} className="flex items-center gap-1">
                  <input type="hidden" name="faith_key" value={r.key} />
                  <input type="hidden" name="_view" value="vocab-faith" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                    Ready at
                  </span>
                  <input
                    name="threshold"
                    type="number"
                    min={0}
                    max={100000}
                    defaultValue={r.launch.threshold}
                    aria-label={`Readiness threshold for ${r.key}`}
                    className={`${VOCAB_INPUT} w-16`}
                  />
                  <SubmitButton className={VOCAB_BTN} pendingLabel="…">
                    Save
                  </SubmitButton>
                </form>
              ) : null}

              {/* Status toggle (taxonomy status, distinct from launch) */}
              {!r.isCivil ? (
                <form action={setFaithVocabStatus}>
                  <input type="hidden" name="faith_key" value={r.key} />
                  <input type="hidden" name="active" value={isActive ? '0' : '1'} />
                  <input type="hidden" name="_view" value="vocab-faith" />
                  <SubmitButton
                    className={
                      isActive
                        ? 'rounded-md border border-ink/15 bg-white px-2 py-1 text-[10px] font-medium text-ink/60 hover:border-danger-300 hover:text-danger-700'
                        : 'rounded-md border border-success-300 bg-white px-2 py-1 text-[10px] font-medium text-success-700 hover:bg-success-50'
                    }
                    pendingLabel="…"
                  >
                    {isActive ? 'Deactivate' : 'Reactivate'}
                  </SubmitButton>
                </form>
              ) : null}
            </VocabRowShell>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-6 text-center text-sm text-ink/55">
          No faiths match “{query}”.
        </p>
      ) : null}
    </section>
  );
}

function FaithLaunchButton({
  faithKey,
  status,
  tone,
  children,
}: {
  faithKey: string;
  status: string;
  tone: 'live' | 'hold' | 'disable';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'live'
      ? 'bg-success-700 text-cream hover:bg-success-800'
      : tone === 'hold'
        ? 'border border-ink/15 bg-cream text-ink hover:border-terracotta/40 hover:text-terracotta'
        : 'border border-ink/15 bg-cream text-ink/60 hover:border-danger-300 hover:text-danger-700';
  return (
    <form action={setFaithLaunchStatus}>
      <input type="hidden" name="faith_key" value={faithKey} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="_view" value="vocab-faith" />
      <SubmitButton
        className={`rounded-md px-2 py-1 text-[10px] font-medium ${cls}`}
        pendingLabel="…"
      >
        {children}
      </SubmitButton>
    </form>
  );
}

// ── Unfiled tray ────────────────────────────────────────────────────────────────

function UnfiledTray({ unfiled, data }: { unfiled: StudioService[]; data: StudioData }) {
  return (
    <section className="rounded-xl border border-warn-200 bg-warn-50/40 p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-warn-800">Unfiled services</h2>
        <p className="text-sm text-ink/60">
          Not placed on any tile — pick a tile and File. (Legacy pre-existing state; new services always land on a
          tile.)
        </p>
      </header>
      {unfiled.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/55">
          Nothing unfiled — every service is placed on a tile.
        </p>
      ) : (
        <ul className="space-y-2">
          {unfiled.map((s) => (
            <li
              key={s.canonical}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-warn-200 bg-white p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{s.displayEn}</p>
                <p className="truncate font-mono text-[10px] text-ink/45">{s.canonical}</p>
              </div>
              <form action={remapCanonical} className="flex items-center gap-1.5">
                <input type="hidden" name="canonical_service" value={s.canonical} />
                <input type="hidden" name="_view" value="unfiled" />
                <select
                  name="tile_id"
                  required
                  defaultValue=""
                  aria-label={`File ${s.canonical}`}
                  className="max-w-[160px] rounded-md border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
                >
                  <option value="" disabled>
                    — pick a tile —
                  </option>
                  {data.folders.map((f) => (
                    <optgroup key={f.id} label={f.label}>
                      {data.tiles
                        .filter((t) => t.parentId === f.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <SubmitButton
                  className="rounded-md border border-ink/15 bg-white px-2 py-1 text-[11px] font-medium text-ink hover:border-terracotta/50 hover:text-terracotta"
                  pendingLabel="Filing…"
                >
                  File
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Requests queue ──────────────────────────────────────────────────────────────

function RequestsQueue({ requests, data }: { requests: StudioRequest[]; data: StudioData }) {
  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/30 p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-sky-900">Vendor category requests</h2>
        <p className="text-sm text-ink/60">Promote · map to existing · keep private · reject.</p>
      </header>
      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/55">
          No pending requests. Vendor proposals from the services editor land here.
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.requestId} className="space-y-2 rounded-xl border border-sky-200 bg-white p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{r.proposedLabel}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                  from {r.vendorName}
                </span>
              </div>
              {r.proposedNote ? <p className="text-xs text-ink/65">{r.proposedNote}</p> : null}
              <div className="flex flex-wrap items-end gap-2">
                <form action={promoteCategoryRequest} className="flex items-center gap-1">
                  <input type="hidden" name="request_id" value={r.requestId} />
                  <input type="hidden" name="_view" value="requests" />
                  <select
                    name="tile_id"
                    defaultValue=""
                    required
                    aria-label="Promote under tile"
                    className="max-w-[150px] rounded-md border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
                  >
                    <option value="" disabled>
                      promote under tile…
                    </option>
                    {data.folders.map((f) => (
                      <optgroup key={f.id} label={f.label}>
                        {data.tiles
                          .filter((t) => t.parentId === f.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <SubmitButton
                    className="rounded-md border border-success-300 bg-white px-2 py-1 text-[11px] font-medium text-success-700 hover:bg-success-50"
                    pendingLabel="Promoting…"
                  >
                    Promote ✓
                  </SubmitButton>
                </form>
                <form action={mapCategoryRequest} className="flex items-center gap-1">
                  <input type="hidden" name="request_id" value={r.requestId} />
                  <input type="hidden" name="_view" value="requests" />
                  <select
                    name="mapped_to_canonical"
                    defaultValue=""
                    required
                    aria-label="Map to existing service"
                    className="max-w-[150px] rounded-md border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
                  >
                    <option value="" disabled>
                      map to existing…
                    </option>
                    {data.services.map((s) => (
                      <option key={s.canonical} value={s.canonical}>
                        {s.displayEn}
                      </option>
                    ))}
                  </select>
                  <SubmitButton
                    className="rounded-md border border-sky-300 bg-white px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50"
                    pendingLabel="Mapping…"
                  >
                    Map →
                  </SubmitButton>
                </form>
                <form action={resolveCategoryRequest}>
                  <input type="hidden" name="request_id" value={r.requestId} />
                  <input type="hidden" name="outcome" value="kept_private" />
                  <input type="hidden" name="_view" value="requests" />
                  <SubmitButton
                    className="rounded-md border border-ink/20 bg-white px-2 py-1 text-[11px] font-medium text-ink/70 hover:border-ink/40"
                    pendingLabel="Saving…"
                  >
                    Keep private
                  </SubmitButton>
                </form>
                <form action={resolveCategoryRequest} className="flex items-center gap-1">
                  <input type="hidden" name="request_id" value={r.requestId} />
                  <input type="hidden" name="outcome" value="rejected" />
                  <input type="hidden" name="_view" value="requests" />
                  <input
                    name="resolution_note"
                    placeholder="reason (optional)"
                    aria-label="Reject reason"
                    className="w-28 rounded-md border border-ink/15 bg-white px-1.5 py-1 text-[11px] text-ink"
                  />
                  <SubmitButton
                    className="rounded-md border border-danger-200 bg-white px-2 py-1 text-[11px] font-medium text-danger-700 hover:bg-danger-50"
                    pendingLabel="Rejecting…"
                  >
                    Reject
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
