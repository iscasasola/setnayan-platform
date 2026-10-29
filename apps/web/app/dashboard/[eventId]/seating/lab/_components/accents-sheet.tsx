'use client';

/**
 * ✨ ACCENTS — what the 3D room adds on, switched on or off (owner 2026-10-30, Guests › Seats › 3D: *"okay. so we can
 * pick what accents will be added on the 3d plan?"* then *"these doesn't need placement. just activate and its there"*).
 *
 * The room is view-only (*"all are plottend on the 2d"*); an accent is not plotted — there is nothing to place, so
 * picking one is not an edit of the plan. ONE row per accent the room draws: a switch (on = it is in the room right
 * away, off = gone) and, only when the accent ships several looks, ONE dropdown for its style. No placement, no drag,
 * no "where". Booked-supplier offers sit at the top as rows (Add it / No thanks).
 *
 * The SAME save path as the Reception Designer it replaces on the room (`saveReceptionDesign` with its base — two hosts
 * never overwrite each other; `dismissRoomSuggestion` for a No thanks), the same supplier-agreed lock (a zone a supplier
 * agreed to build is shown, frozen, with who agreed), and the room updates in place through `onChange` — a save never
 * resets the screen.
 */

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  RECEPTION_PARTS,
  DEFAULT_DESIGN,
  selAll,
  venueZoneApplies,
  type AttributeValue,
  type PartId,
  type ReceptionDesign,
} from '@/lib/reception-scene';
import { suggestionsToShow, type BookedZoneCandidate } from '@/lib/reception-suggestion-chips';
import { trackFailure } from '@/lib/telemetry/track-error';
import { useSaveLoader } from '@/components/sd-loader';
import { Sheet } from '@/app/_components/sheet';
import { SwitchRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { saveReceptionDesign, dismissRoomSuggestion } from '../../actions';

/**
 * The accents the ROOM DRAWS — the reception attributes `VenueDecor` reads (`sel` / `selAll` over these pairs). A zone
 * the room does not draw is not an accent here: switching it would change nothing you can see.
 */
export const ROOM_ACCENTS: ReadonlyArray<readonly [PartId, string]> = [
  ['ceiling', 'treatment'],
  ['backdrop', 'style'],
  ['walls', 'treatment'],
  ['tunnel', 'style'],
  ['photo_wall', 'style'],
  ['welcome_signage', 'style'],
  ['tables', 'centerpiece'],
] as const;

/** The "nothing here" option a switch-off writes; null when the accent has none (it is always in the room). */
function offOption(part: PartId, attr: string): string | null {
  const a = RECEPTION_PARTS.find((p) => p.id === part)?.attributes.find((x) => x.id === attr);
  const ex = a?.options.filter((o) => o.exclusive) ?? [];
  return (ex.find((o) => o.id === 'bare' || o.id === 'none') ?? ex[0])?.id ?? null;
}

export function AccentsSheet({
  open,
  onClose,
  eventId,
  design,
  onChange,
  venueSetting,
  finalizedByPart,
  bookedSuggestions,
  dismissedSuggestions,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  design: ReceptionDesign;
  onChange: (next: ReceptionDesign) => void;
  venueSetting: string | null;
  finalizedByPart?: Record<string, { vendorName: string | null; agreedAt: string | null }>;
  bookedSuggestions?: BookedZoneCandidate[];
  dismissedSuggestions?: string[];
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState<string | null>(null);
  const commits = useRef(0);
  const save = useSaveLoader();
  /** The look an accent had before it was switched off — switching it back on brings THAT look back. */
  const lastOn = useRef(new Map<string, AttributeValue>());

  function commit(part: PartId, attr: string, value: AttributeValue) {
    if (finalizedByPart?.[part]) return;
    const cur = design[part] && typeof design[part] === 'object' ? (design[part] as Record<string, AttributeValue>) : {};
    const next: ReceptionDesign = { ...design, [part]: { ...DEFAULT_DESIGN[part], ...cur, [attr]: value } };
    const base: ReceptionDesign = { ...design, [part]: { ...DEFAULT_DESIGN[part], ...cur } };
    const mine = ++commits.current;
    onChange(next);
    setElsewhere(null);
    startTransition(async () => {
      try {
        const res = await save.run(() => saveReceptionDesign(eventId, next, base), { steps: ['Saving your accents'], hint: 'Saving' });
        setError(null);
        if (res?.elsewhere && mine === commits.current) {
          onChange(res.elsewhere.design);
          setElsewhere(res.elsewhere.note);
        }
      } catch (err) {
        setError('Could not save — try again.');
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Save room accents',
          filePath: 'app/dashboard/[eventId]/seating/lab/_components/accents-sheet.tsx',
          error: err,
          payload: { part, attr, value },
        });
      }
    });
  }

  const [dismissedLocal, setDismissedLocal] = useState<string[]>(dismissedSuggestions ?? []);
  const selectedTilesByZone = useMemo(() => {
    const out = new Map<PartId, ReadonlySet<string>>();
    for (const part of RECEPTION_PARTS) {
      const tiles = new Set<string>();
      for (const attr of part.attributes) {
        for (const id of selAll(design, part.id, attr.id)) {
          const tile = attr.options.find((o) => o.id === id)?.tile;
          if (tile) tiles.add(tile);
        }
      }
      out.set(part.id, tiles);
    }
    return out;
  }, [design]);
  const offers = useMemo(
    () =>
      suggestionsToShow(bookedSuggestions ?? [], {
        dismissedKeys: dismissedLocal,
        frozenZones: new Set(Object.keys(finalizedByPart ?? {})),
        selectedTilesByZone,
      }),
    [bookedSuggestions, dismissedLocal, finalizedByPart, selectedTilesByZone],
  );

  /** Add it — the offer's option joins its zone (a multi zone keeps what it had). */
  function accept(sg: BookedZoneCandidate) {
    const a = RECEPTION_PARTS.find((p) => p.id === sg.zone)?.attributes.find((x) => x.id === sg.attr);
    if (!a) return;
    if (a.multi !== true) return commit(sg.zone, a.id, sg.optionId);
    const kept = selAll(design, sg.zone, a.id).filter((id) => !a.options.find((o) => o.id === id)?.exclusive);
    commit(sg.zone, a.id, kept.includes(sg.optionId) ? kept : [...kept, sg.optionId]);
  }
  function dismiss(sg: BookedZoneCandidate) {
    setDismissedLocal((prev) => (prev.includes(sg.dismissKey) ? prev : [...prev, sg.dismissKey]));
    startTransition(async () => {
      try {
        await dismissRoomSuggestion(eventId, sg.dismissKey);
      } catch (err) {
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Dismiss reception suggestion',
          filePath: 'app/dashboard/[eventId]/seating/lab/_components/accents-sheet.tsx',
          error: err,
          payload: { dismissKey: sg.dismissKey },
        });
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} labelledById="room-accents-title" title="Accents">
      <div data-room-accents-sheet="" className="space-y-1 px-5 pb-5 pt-3">
        <p className="pb-2 text-sm text-ink/60">Switch one on and it is in the room. Nothing to place.</p>
        {offers.map((sg) => (
          <div key={sg.dismissKey} data-room-accent-offer="" className="flex flex-wrap items-center gap-2 py-2 text-sm text-ink/80">
            <span className="min-w-0 flex-1">
              You&rsquo;ve booked <span className="font-medium text-ink">{sg.vendorName}</span> — add{' '}
              <span className="font-medium text-ink">{sg.optionLabel}</span>?
            </span>
            <button type="button" onClick={() => accept(sg)} className="min-h-11 rounded-full border border-terracotta px-4 font-medium text-ink hover:bg-terracotta/10">
              Add it
            </button>
            <button type="button" onClick={() => dismiss(sg)} className="min-h-11 rounded-full border border-ink/15 px-4 text-ink/60 hover:border-ink/30">
              No thanks
            </button>
          </div>
        ))}
        {ROOM_ACCENTS.filter(([part]) => venueZoneApplies(venueSetting, part)).map(([partId, attrId]) => {
          const part = RECEPTION_PARTS.find((p) => p.id === partId)!;
          const attr = part.attributes.find((a) => a.id === attrId)!;
          const looks = attr.options.filter((o) => !o.exclusive);
          const chosen = selAll(design, partId, attrId);
          const onIds = chosen.filter((id) => looks.some((o) => o.id === id));
          const off = offOption(partId, attrId);
          const isOn = onIds.length > 0;
          const agreed = finalizedByPart?.[partId] ?? null;
          const key = `${partId}.${attrId}`;
          const name = attrId === 'centerpiece' ? 'Centerpieces' : part.label;
          const menu =
            looks.length > 1 ? (
              <PickMenu
                label={`${name} style`}
                value={onIds[0] ?? null}
                picked={attr.multi ? onIds : undefined}
                options={looks.map((o) => ({ key: o.id, label: o.label }))}
                onPick={(id) => {
                  if (agreed) return;
                  if (!attr.multi) return commit(partId, attrId, id);
                  const next = onIds.includes(id) ? onIds.filter((x) => x !== id) : [...onIds, id];
                  if (next.length === 0) return;
                  commit(partId, attrId, next.length === 1 ? next[0]! : next);
                }}
                dataAttr="data-room-accent-style"
              />
            ) : null;
          return (
            <div key={key} data-room-accent={key}>
              {off ? (
                <SwitchRow
                  name={name}
                  on={isOn}
                  disabled={Boolean(agreed)}
                  note={agreed ? `Agreed with ${agreed.vendorName ?? 'your supplier'} — frozen` : undefined}
                  onChange={(next) => {
                    if (next) {
                      const back = lastOn.current.get(key) ?? (looks.find((o) => o.id === (DEFAULT_DESIGN[partId]?.[attrId] as string))?.id ?? looks[0]!.id);
                      commit(partId, attrId, back);
                    } else {
                      lastOn.current.set(key, chosen.length === 1 ? chosen[0]! : chosen);
                      commit(partId, attrId, off);
                    }
                  }}
                  below={isOn ? menu : null}
                />
              ) : (
                <div className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="text-sm font-medium text-ink">
                    {name}
                    {agreed ? <span className="block text-xs font-normal text-ink/55">Agreed with {agreed.vendorName ?? 'your supplier'} — frozen</span> : null}
                  </span>
                  {menu}
                </div>
              )}
            </div>
          );
        })}
        {elsewhere ? <p className="pt-2 text-xs text-ink/60">{elsewhere}</p> : null}
        {error ? <p role="alert" className="pt-2 text-sm text-danger-700">{error}</p> : null}
      </div>
    </Sheet>
  );
}
