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
 *
 * 🏠 NOTHING LOSES ITS ONLY HOME. The Reception Designer edited every reception choice, and some of them the room never
 * draws (the stage setup, linens, chairs, the feast, the program, booths, who is in the concept image…) — they feed the
 * concept image, the printed concept and the suppliers' brief. They are listed here too, under "For your concept and
 * suppliers", the same row shape. The couple's own inspiration photo for a zone sits under its row, REFERENCE ONLY —
 * never composited into the render.
 */

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  RECEPTION_PARTS,
  DEFAULT_DESIGN,
  MAX_SELECTIONS_PER_ATTRIBUTE,
  selAll,
  venueZoneApplies,
  type Attribute,
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

/** "Agreed with Sampaguita Studio on 12 Sep 2026 — frozen": WHO and WHEN, never a control that just stops responding. */
function agreedLine(a: { vendorName: string | null; agreedAt: string | null }): string {
  const t = a.agreedAt ? Date.parse(a.agreedAt) : Number.NaN;
  const on = Number.isNaN(t) ? null : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `Agreed${a.vendorName ? ` with ${a.vendorName}` : ''}${on ? ` on ${on}` : ''} — frozen`;
}

/** Every other reception choice (not drawn in the room) — the concept image's and the suppliers' brief's. */
const CONCEPT_CHOICES: ReadonlyArray<readonly [PartId, string]> = RECEPTION_PARTS.flatMap((p) =>
  p.attributes.map((a) => [p.id, a.id] as const),
).filter(([p, a]) => !ROOM_ACCENTS.some(([rp, ra]) => rp === p && ra === a));

export function AccentsSheet({
  open,
  onClose,
  eventId,
  design,
  onChange,
  venueSetting,
  finalizedByPart,
  inspirationByPart,
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
  /** The couple's own photos per zone (`event_inspiration_assets`), shown under the row — reference only. */
  inspirationByPart?: Record<string, string[]>;
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

  /** THE ONE FUNNEL every pick and every "Add it" goes through — a frozen zone, the per-attribute cap and a "nothing
   *  here" option beside a real one are refused HERE, so no control can route around them. */
  function choose(part: PartId, attrDef: Attribute, optionId: string) {
    if (finalizedByPart?.[part]) return;
    if (attrDef.multi !== true) {
      commit(part, attrDef.id, optionId);
      return;
    }
    const isExclusive = (id: string) => attrDef.options.find((o) => o.id === id)?.exclusive === true;
    const current = selAll(design, part, attrDef.id);
    let next: string[];
    if (isExclusive(optionId)) {
      next = [optionId];
    } else if (current.includes(optionId)) {
      next = current.filter((id) => id !== optionId);
      if (next.length === 0) return; // never leave an attribute with nothing
    } else {
      const kept = current.filter((id) => !isExclusive(id));
      if (kept.length >= MAX_SELECTIONS_PER_ATTRIBUTE) return; // at the cap
      next = [...kept, optionId];
    }
    commit(part, attrDef.id, next.length === 1 ? next[0]! : next);
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

  /** Add it — routed through `choose()`, the same funnel as every pick (a multi zone keeps what it had). */
  function acceptSuggestion(sg: BookedZoneCandidate) {
    const attrDef = RECEPTION_PARTS.find((p) => p.id === sg.zone)?.attributes.find((a) => a.id === sg.attr);
    if (!attrDef) return;
    choose(sg.zone, attrDef, sg.optionId);
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

  /** One choice, one row: a switch when it can be "nothing here", ONE dropdown for its look, the reference photo. */
  function row(partId: PartId, attrId: string, inRoom: boolean) {
    const part = RECEPTION_PARTS.find((p) => p.id === partId)!;
    const attr = part.attributes.find((x) => x.id === attrId)!;
    const looks = attr.options.filter((o) => !o.exclusive);
    const chosen = selAll(design, partId, attrId);
    const onIds = chosen.filter((id) => looks.some((o) => o.id === id));
    const off = offOption(partId, attrId);
    const isOn = onIds.length > 0;
    const agreed = finalizedByPart?.[partId] ?? null;
    const key = `${partId}.${attrId}`;
    const name =
      attrId === 'centerpiece' ? 'Centerpieces' : part.attributes.length > 1 ? `${part.label} · ${attr.label}` : part.label;
    const photos = attrId === part.attributes[0]!.id ? inspirationByPart?.[partId] ?? [] : [];
    const menu =
      looks.length > 1 ? (
        <PickMenu
          label={`${name} style`}
          value={onIds[0] ?? null}
          picked={attr.multi ? onIds : undefined}
          options={looks.map((o) => ({ key: o.id, label: o.label }))}
          onPick={(id) => choose(partId, attr, id)}
          dataAttr="data-room-accent-style"
        />
      ) : null;
    /* WHAT THE ROOM IS NOT SHOWING: a combination is the couple's to pick, the room draws ONE of it — and says which. */
    const primary = attr.options.find((o) => o.id === chosen[0]);
    const disclosure =
      inRoom && attr.multi === true && chosen.length > 1 && primary ? (
        <span className="block text-xs text-ink/60">The 3D room draws {primary.label}; the rest go to your concept and suppliers.</span>
      ) : null;
    const peopleNote =
      partId === 'people' ? (
        <span className="block text-xs text-ink/60">
          Who your concept image shows — the 3D room seats whoever is on your guest list.
        </span>
      ) : null;
    const strip =
      photos.length > 0 ? (
        <span className="flex gap-1.5 pt-1" data-room-accent-photos="">
          {photos.slice(0, 3).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element -- a signed reference thumbnail, never optimised or composited
            <img key={url} src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ))}
        </span>
      ) : null;
    const below = (
      <>
        {isOn || !off ? menu : null}
        {disclosure}
        {peopleNote}
        {strip}
      </>
    );
    return (
      <div key={key} data-room-accent={key}>
        {off ? (
          <SwitchRow
            name={name}
            on={isOn}
            disabled={Boolean(agreed)}
            note={agreed ? agreedLine(agreed) : undefined}
            onChange={(next) => {
              if (next) {
                const back =
                  lastOn.current.get(key) ??
                  (looks.find((o) => o.id === (DEFAULT_DESIGN[partId]?.[attrId] as string))?.id ?? looks[0]!.id);
                if (agreed) return;
                commit(partId, attrId, back);
              } else {
                if (agreed) return;
                lastOn.current.set(key, chosen.length === 1 ? chosen[0]! : chosen);
                choose(partId, attr, off);
              }
            }}
            below={below}
          />
        ) : (
          <div className="flex min-h-14 flex-col justify-center gap-1 py-2">
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink">{name}</span>
              {menu}
            </span>
            {agreed ? <span className="block text-xs text-ink/55">{agreedLine(agreed)}</span> : null}
            {disclosure}
            {peopleNote}
            {strip}
          </div>
        )}
      </div>
    );
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
            <button type="button" onClick={() => acceptSuggestion(sg)} className="min-h-11 rounded-full border border-terracotta px-4 font-medium text-ink hover:bg-terracotta/10">
              Add it
            </button>
            <button type="button" onClick={() => dismiss(sg)} className="min-h-11 rounded-full border border-ink/15 px-4 text-ink/60 hover:border-ink/30">
              No thanks
            </button>
          </div>
        ))}
        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink/50">In the 3D room</h3>
        {ROOM_ACCENTS.filter(([part]) => venueZoneApplies(venueSetting, part)).map(([p, a]) => row(p, a, true))}
        <h3 className="pt-5 text-xs font-semibold uppercase tracking-wide text-ink/50">For your concept and suppliers</h3>
        <p className="pb-1 text-xs text-ink/55">Not drawn in 3D — they shape your concept image and what your suppliers see.</p>
        {CONCEPT_CHOICES.filter(([part]) => venueZoneApplies(venueSetting, part)).map(([p, a]) => row(p, a, false))}
        {elsewhere ? <p className="pt-2 text-xs text-ink/60">{elsewhere}</p> : null}
        {error ? <p role="alert" className="pt-2 text-sm text-danger-700">{error}</p> : null}
      </div>
    </Sheet>
  );
}
