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
  GripVertical,
  MoveRight,
  Trash2,
  Circle,
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
};

export type StudioRequest = {
  requestId: string;
  proposedLabel: string;
  proposedNote: string | null;
  vendorName: string;
};

export type VocabItem = { key: string; label: string };

export type StudioData = {
  source: 'db' | 'fallback';
  folders: StudioFolder[];
  tiles: StudioTile[];
  services: StudioService[];
  eventVocab: VocabItem[];
  faithVocab: VocabItem[];
  requests: StudioRequest[];
  iconNames: string[];
  /** Couple-facing default folder icon (Lucide name) — matches /explore. */
  folderDefaultIcon: Record<string, string>;
  initialQ: string;
  initialView: StudioView;
};

export type StudioView = 'all' | 'faith' | 'scoped' | 'unfiled' | 'requests';

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
  const [selectedFolder, setSelectedFolder] = useState<string>(
    data.folders[0]?.id ?? '',
  );
  const [openTileId, setOpenTileId] = useState<string | null>(null);
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
                  onSelect={() => setOpenTileId(tile.id)}
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
        onClose={() => setOpenTileId(null)}
        labelledById="tile-inspector-title"
        title="Tile inspector"
      >
        {openTile ? (
          <Inspector
            key={openTile.id}
            tile={openTile}
            data={data}
            services={servicesByTile.get(openTile.id) ?? []}
            eventLabel={eventLabel}
            onDeleted={() => {
              setOpenTileId(null);
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
          <Badge tone="bg-violet-50 text-violet-700">{tile.refinementCount} ref</Badge>
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
  eventLabel,
  onDeleteRequest,
  confirm,
  onServiceDragStart,
}: {
  tile: StudioTile;
  data: StudioData;
  services: StudioService[];
  eventLabel: (e: string) => string;
  onDeleted: () => void;
  onDeleteRequest: (
    destTileId?: string,
  ) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  confirm: ReturnType<typeof useConfirm>['confirm'];
  onServiceDragStart: (canonical: string) => (e: DragEvent) => void;
}) {
  const [tab, setTab] = useState<'details' | 'services'>('details');
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
        {(['details', 'services'] as const).map((t) => (
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
        ) : (
          <ServicesTab
            tile={tile}
            data={data}
            services={services}
            onServiceDragStart={onServiceDragStart}
          />
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
