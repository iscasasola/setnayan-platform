'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Users,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { FileUpload } from '@/app/_components/file-upload';
import { useSaveLoader } from '@/components/sd-loader';
import {
  createWalkthroughZone,
  deleteWalkthroughZone,
  removeWalkthroughZoneVideo,
  renameWalkthroughZone,
  saveWalkthroughZoneVideo,
  setWalkthroughZonePublished,
  setWalkthroughZoneTables,
} from '../actions';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { formatCount } from '@/lib/format-number';

export type ZoneVM = {
  zoneId: string;
  label: string;
  hasVideo: boolean;
  videoUrl: string | null;
  published: boolean;
  tableIds: string[];
};

export type TableVM = { tableId: string; label: string };

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export function WalkthroughManager({
  eventId,
  zones,
  tables,
}: {
  eventId: string;
  zones: ZoneVM[];
  tables: TableVM[];
}) {
  const [newLabel, setNewLabel] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = useSaveLoader();

  function run(fn: () => Promise<void>, onError?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await save.run(() => fn(), {
          steps: ['Saving your walkthrough'],
          hint: 'Saving',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
        onError?.();
      }
    });
  }

  const tagged = useMemo(
    () => new Set(zones.flatMap((z) => z.tableIds)),
    [zones],
  );
  const untaggedCount = tables.length - tagged.size;

  return (
    <div className="space-y-4">
      {/* ↩ The Undo a swiped-away zone leaves (owner 2026-11-03). */}
      <UndoToastHost />
      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 7): no box — one line, the rest behind ⓘ. */}
      <div className="text-sm text-ink/70">
        <InfoTip label="The walk-to-your-table video is the coordinator’s (or your own helper’s) handiwork." labelAs="span" labelClassName="text-ink/70" align="start">
          Setnayan just hosts it and routes each guest to the right clip. Tables with no zone simply show their table
          number, exactly as before.
        </InfoTip>
        {tables.length > 0 && untaggedCount > 0 ? (
          <p className="mt-2 text-ink/70">
            {formatCount(untaggedCount)} of {formatCount(tables.length)} table{tables.length === 1 ? '' : 's'} not in a zone
            yet.
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 border-l-2 border-danger-600 py-1 pl-3 text-sm text-danger-800"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </p>
      ) : null}

      {/* Create a zone */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const label = newLabel.trim();
          if (!label) return;
          run(
            async () => {
              await createWalkthroughZone(eventId, label);
              setNewLabel('');
            },
          );
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New zone — e.g. “Garden side”, “Near the stage”"
          aria-label="New zone name"
          maxLength={80}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-ink/15 bg-white dark:bg-raised px-4 py-2.5 text-base text-ink outline-none placeholder:text-ink/50 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20"
        />
        <ActionButton tone="brand" main type="submit" icon={Plus} label="Add zone" disabled={pending || newLabel.trim().length === 0} />
      </form>

      {zones.length === 0 ? (
        <p className="py-2 text-sm text-ink/70">
          No zones yet. Add one above, tag its tables, and record the walk to it.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.zoneId}
              eventId={eventId}
              zone={zone}
              tables={tables}
              pending={pending}
              run={run}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ZoneCard({
  eventId,
  zone,
  tables,
  pending,
  run,
}: {
  eventId: string;
  zone: ZoneVM;
  tables: TableVM[];
  pending: boolean;
  run: (fn: () => Promise<void>, onError?: () => void) => void;
}) {
  const [label, setLabel] = useState(zone.label);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(zone.tableIds));

  // Reseed from the server only when THIS zone's saved set actually changes
  // (after a successful save / cross-tab edit) — unrelated revalidations leave
  // unsaved local edits intact.
  const serverKey = zone.tableIds.join(',');
  useEffect(() => {
    setSelected(new Set(zone.tableIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);
  useEffect(() => {
    setLabel(zone.label);
  }, [zone.label]);

  const labelDirty = label.trim() !== zone.label && label.trim().length > 0;
  const tablesDirty =
    selected.size !== zone.tableIds.length || zone.tableIds.some((id) => !selected.has(id));

  function toggleTable(tableId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }

  /* 👈 A ZONE'S DELETE IS ITS CARD'S SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
     VISIBLE ✕ ON ROWS"): the trash beside the name left; the swipe asks the SAME question (its tables lose the walk
     video), then deletes after the Undo window (`deleteWithUndo`) — the same `deleteWalkthroughZone`. */
  if (gone) return <li hidden data-swipe-gone="" />;
  return (
    <SwipeToDelete
      as="li"
      label={`Delete ${zone.label}`}
      radiusClass="rounded-2xl"
      surfaceClass=""
      disabled={pending}
      onDelete={(close) => {
        if (!confirm(`Delete “${zone.label}”? Its tables keep their seats — they just lose the walk video.`)) return close();
        deleteWithUndo({
          label: `“${zone.label}” deleted`,
          hide: () => setGone(true),
          restore: () => setGone(false),
          commit: () => deleteWalkthroughZone(eventId, zone.zoneId),
          failed: `Couldn’t delete “${zone.label}”. It’s back — try again.`,
        });
      }}
    >
    <div className="py-4">
      {/* Label + delete */}
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Zone name"
          maxLength={80}
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-transparent px-1.5 py-1 text-lg font-semibold text-ink outline-none ring-terracotta focus:bg-cream/40 focus:ring-1"
        />
        {labelDirty ? (
          <ActionButton tone="brand" icon={Check} label="Save name" disabled={pending} onClick={() => run(() => renameWalkthroughZone(eventId, zone.zoneId, label))} />
        ) : null}
      </div>

      {/* Tables in this zone */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setTablesOpen((v) => !v)}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-ink"
        >
          <Users className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          {zone.tableIds.length} table{zone.tableIds.length === 1 ? '' : 's'} in this zone
          <ChevronDown
            className={`h-4 w-4 transition-transform ${tablesOpen ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>

        {tablesOpen ? (
          <div className="mt-2 border-l-2 border-ink/10 pl-3">
            {tables.length === 0 ? (
              <p className="py-2 text-sm text-ink/70">Add tables to your seating chart first.</p>
            ) : (
              <>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {tables.map((t) => {
                    const checked = selected.has(t.tableId);
                    return (
                      <li key={t.tableId}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/[0.03]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTable(t.tableId)}
                            className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta/30"
                          />
                          <span className={checked ? 'font-medium text-ink' : 'text-ink/70'}>
                            {t.label}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {tablesDirty ? (
                  <div className="mt-2 flex items-center gap-2">
                    <ActionButton
                      tone="brand"
                      main
                      icon={Check}
                      label="Save tables"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            setWalkthroughZoneTables(eventId, zone.zoneId, Array.from(selected)),
                          () => setSelected(new Set(zone.tableIds)),
                        )
                      }
                    />
                    <ActionButton tone="neutral" quiet icon={RotateCcw} label="Reset" disabled={pending} onClick={() => setSelected(new Set(zone.tableIds))} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Video */}
      <div className="mt-4 border-t border-ink/10 pt-4">
        {zone.hasVideo ? (
          <div className="space-y-3">
            {zone.videoUrl ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={zone.videoUrl}
                className="aspect-[9/16] w-full max-w-56 rounded-xl bg-black object-contain"
              />
            ) : (
              <p className="text-sm text-ink/70">Clip saved — preview unavailable.</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => setWalkthroughZonePublished(eventId, zone.zoneId, !zone.published))
                }
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-50 ${
                  zone.published
                    ? 'bg-success-100 text-success-800 hover:bg-success-200'
                    : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                }`}
              >
                {zone.published ? (
                  <>
                    <Eye className="h-3.5 w-3.5" strokeWidth={2} /> Showing to guests
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> Hidden — tap to show guests
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm('Remove this walk video? You can record a new one after.'))
                    run(() => removeWalkthroughZoneVideo(eventId, zone.zoneId));
                }}
                className="inline-flex min-h-11 items-center text-sm font-medium text-danger-700"
              >
                Remove video
              </button>
            </div>
          </div>
        ) : (
          <FileUpload
            bucket="media"
            pathPrefix={`zone-walkthroughs/${eventId}/${zone.zoneId}`}
            acceptedTypes={VIDEO_TYPES}
            maxSizeMB={60}
            variant="wide"
            label="Record or upload the walk to this zone"
            help="Shoot it on your phone — entrance to these tables, held vertically. Up to 60 MB. It stays hidden until you tap “show to guests”."
            onChange={(value) => {
              const ref = Array.isArray(value) ? value[0] : value;
              if (ref) run(() => saveWalkthroughZoneVideo(eventId, zone.zoneId, ref));
            }}
          />
        )}
      </div>
    </div>
    </SwipeToDelete>
  );
}
