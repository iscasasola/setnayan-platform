'use client';

/**
 * what-couples-choose.tsx — the "What couples choose" section of a category
 * panel: the onboarding "what kind of X?" cards anchored to the category
 * (onboarding_refinements.tile_id) and their option grids.
 *
 * Moved 2026-10-02 out of the Taxonomy Studio's Refinements tab, unchanged in
 * what it can do: label · description · main photo · retire · reorder per
 * card; emoji · label · photo (required on a new one) · retire · reorder ·
 * delete per option. Matched cards (ceremony · catering · photo_video) keep
 * their add/remove lock; the faith-adaptive ceremony card keeps its note.
 * Saves are the shipped redirect-back actions (they land back on this
 * category); the two reorders are the shipped JSON actions.
 */
import { useCallback, useState, useTransition, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, GripVertical, ImageIcon, Lock, Plus, Trash2, X } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  updateRefinementLeaf,
  updateRefinementOption,
  addRefinementOption,
  removeRefinementOption,
  reorderRefinementLeaves,
  reorderRefinementOptions,
  type StudioActionResult,
} from '../actions';
import type { RefinementCard, RefinementOption } from './model';

type CategoryRef = { id: string; label: string };

/** The two hidden fields that land a save back on this category's panel. */
function CategoryBack({ tileId }: { tileId: string }) {
  return (
    <>
      <input type="hidden" name="_list" value="categories" />
      <input type="hidden" name="_open" value={`c:${tileId}`} />
    </>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {children}
    </span>
  );
}

const IMG_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

export function WhatCouplesChoose({
  tile,
  refinements,
}: {
  tile: CategoryRef;
  refinements: RefinementCard[];
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
      <p className="rounded-lg px-3 py-3 text-sm text-ink/70">
        No “what kind of {tile.label.toLowerCase()}?” card yet.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${pending ? 'opacity-60' : ''}`}>
      {flash ? (
        <div
          role={flash.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-2 rounded-lg  px-3 py-2 text-xs ${
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-black/5"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : null}

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
  tile: CategoryRef;
  leaf: RefinementCard;
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
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-xl  bg-white transition ${
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
              <Badge tone="bg-terracotta/10 text-mulberry">follows the religion</Badge>
            ) : null}
            {leaf.isProjectable ? <Badge tone="bg-sky-50 text-sky-700">🔒 matched</Badge> : null}
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Move down"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-ink/60 hover:bg-ink/5 hover:text-ink"
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
            <CategoryBack tileId={tile.id} />
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
                  unsavedHint="press Save card below"
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
              Save card
            </SubmitButton>
          </form>

          {/* Options */}
          {leaf.dynamic ? (
            <p className="rounded-lg px-3 py-2.5 text-xs text-ink/75">
              Options follow the religion the couple picks.
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
  tile: CategoryRef;
  leaf: RefinementCard;
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
        <p className="rounded-lg bg-cream/60 px-3 py-3 text-center text-[11px] text-ink/55">
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
        <p className="flex items-start gap-1.5 rounded-lg bg-ink/[0.03] px-3 py-2.5 text-[11px] text-ink/60">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" aria-hidden />
          <span>
            {leaf.label} is a matched card — its option keys drive supplier matching, so options can be
            renamed, not added or removed.
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
  tile: CategoryRef;
  leaf: RefinementCard;
  option: RefinementOption;
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
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-lg  bg-white p-2.5 transition ${
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
        <CategoryBack tileId={tile.id} />
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
              unsavedHint="press Save below"
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Move option down"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-25"
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
          <CategoryBack tileId={tile.id} />
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
function AddOptionForm({ tile, leaf }: { tile: CategoryRef; leaf: RefinementCard }) {
  const [hasPhoto, setHasPhoto] = useState(false);
  return (
    <form
      action={addRefinementOption.bind(null, leaf.leafKey)}
      className="space-y-2 rounded-lg bg-success-50/30 p-2.5"
    >
      <CategoryBack tileId={tile.id} />
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
          unsavedHint="press Add option below"
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
        <span className="ml-2 text-xs text-ink/70">Every new option needs a photo.</span>
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
