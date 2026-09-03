'use client';

/**
 * Reception Designer — RELOCATED from the Mood Board into the Seat Plan lab
 * (2026-09-03): `events.reception_design` is really the Seat Plan's own
 * venue-decor settings ("what does this room look like"), not a separate
 * Mood Board concern, so the owner decided on ONE editor, not two. This is
 * the same stylist-grade component that lived at
 * studio/mood-board/_components/reception-designer.tsx (owner directive
 * 2026-06-09: "as intricate as possible … all the materials stylists use"),
 * moved verbatim (including the in-flight AI decor-image layer pilot — see
 * @/lib/reception-decor-layers — that landed in that file while this move
 * was in progress) and adapted to be a CONTROLLED component: the seating lab
 * (seating-lab-3d.tsx) owns the `design` state so the 3D `VenueDecor` layer,
 * fed the same state, updates live right beside this panel — no separate
 * preview-vs-3D sync to worry about. It's wrapped in the same collapsible
 * accordion shape as the Build sidebar's other sections (FloorPanel /
 * RulesPanel in seating-lab-3d.tsx); the preview canvas + tap targets inside
 * are already responsive (`w-full h-auto` SVG, %-based hotspots), so they
 * scale down cleanly into that ~256px column without needing a rebuild.
 *
 * `saveReceptionDesign` / `getReceptionDecorLayerCatalog` moved to
 * `seating/actions.ts` alongside this component — they no longer belong in
 * the mood-board actions file either.
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  RECEPTION_PARTS,
  DEFAULT_DESIGN,
  MAX_SELECTIONS_PER_ATTRIBUTE,
  renderVenueSvg,
  sel,
  selAll,
  type Attribute,
  type AttributeValue,
  type PartId,
  type ReceptionDesign,
  type RoleColors,
} from '@/lib/reception-scene';
import {
  resolveDecorLayer,
  retintDecorLayerRGBA,
  primaryZoneTargetHex,
  PILOT_DECOR_ZONES,
  type DecorLayerCatalog,
} from '@/lib/reception-decor-layers';
import type { MoodboardStyleFamily } from '@/lib/moodboard-templates';
import { trackFailure } from '@/lib/telemetry/track-error';
import { saveReceptionDesign, getReceptionDecorLayerCatalog } from '../../actions';
import { useSaveLoader } from '@/components/sd-loader';

type Props = {
  eventId: string;
  /** Lifted into the caller's state (seating-lab-3d.tsx) so the 3D VenueDecor
   *  layer, fed the same value, updates live as the couple taps an option. */
  design: ReceptionDesign;
  onChange: (next: ReceptionDesign) => void;
  /** The couple's shared Reception palette (hex colors). */
  palette: string[];
  /** Per-role attire colors for the People layer (bride/groom/party/guest). */
  roleColors?: RoleColors;
  /** The couple's own inspiration photos, keyed by design part. Only the five
   *  parts with a matching slot appear; a part with none is simply absent, and
   *  shows no reference rather than an unrelated photo. */
  inspirationByPart?: Record<string, string[]>;
  /**
   * The couple's reception style family — drives the AI decor-image layer
   * pilot (see @/lib/reception-decor-layers).
   *
   * ✅ NOW ACTUALLY PASSED (2026-09-03). This prop's previous docblock said it
   * was "currently never passed by any caller", and that was the whole reason
   * the pilot was dormant: `applyMoodboardTemplate` merged a template's
   * palette + reception_design onto the event and persisted NOTHING about
   * which family produced them, so no caller HAD a value to pass. It does
   * now — `events.moodboard_style_family` (migration 20271197327520), read in
   * seating/lab/page.tsx, threaded through SeatingLab3D → Hud → here.
   *
   * ⚠ A REAL VALUE STILL ISN'T A RENDERED IMAGE. The 10 pilot asset rows are
   * seeded with `approved_at = NULL` (the generated files were never uploaded
   * to R2), and the catalog read requires approved, so today every zone still
   * resolves `{ kind: 'svg' }` — now because the CATALOG is empty rather than
   * because the family was unknowable. Null stays legitimate too: a couple who
   * never applied a template has no family, and `resolveDecorLayer` refuses to
   * guess one.
   */
  styleFamily?: MoodboardStyleFamily | null;
  /** Gated on the same seating-editor lock as the rest of the Build sidebar
   *  (judgment call: reception_design writes don't actually touch the
   *  seating lock, but showing edit controls only when the couple "owns" the
   *  Build panel keeps this consistent with every other control in it). */
  canEdit: boolean;
};

const HOTSPOTS: ReadonlyArray<{ part: PartId; l: number; t: number; w: number; h: number }> = [
  { part: 'ceiling', l: 4, t: 0, w: 92, h: 20 },
  { part: 'backdrop', l: 33, t: 22, w: 34, h: 26 },
  { part: 'stage', l: 36, t: 49, w: 28, h: 13 },
  { part: 'tunnel', l: 35, t: 63, w: 30, h: 35 },
  { part: 'tables', l: 3, t: 49, w: 29, h: 45 },
  { part: 'tables', l: 68, t: 49, w: 29, h: 45 },
];

/** Same bounding boxes HOTSPOTS already uses for the pilot zones — reused
 *  (not redefined) so the AI-image overlay lands exactly where the flat SVG
 *  drew that zone. */
const DECOR_ZONE_BOUNDS: Partial<Record<PartId, { l: number; t: number; w: number; h: number }>> =
  Object.fromEntries(
    HOTSPOTS.filter((z) => (PILOT_DECOR_ZONES as readonly string[]).includes(z.part)).map((z) => [
      z.part,
      z,
    ]),
  );

/** Fetch a decor image (SVG or raster), rasterize it, retint its tagged
 *  region to `targetHex`, and return a PNG data URL — the same
 *  fetch-into-canvas + pixel-buffer pattern ColorRangeManipulator already
 *  uses for the admin tagger, just headless (no visible canvas). */
async function loadAndRetintDecorLayer(
  storagePath: string,
  colorRange: { slotId: number; sampledHex: string; toleranceDe: number },
  targetHex: string,
): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Could not load decor layer at ${storagePath}`));
  });
  img.src = storagePath;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 512;
  canvas.height = img.naturalHeight || 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const retinted = retintDecorLayerRGBA(imageData.data, colorRange, targetHex);
  imageData.data.set(retinted);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function ReceptionDesignEditor({
  eventId,
  design,
  onChange,
  palette,
  roleColors,
  styleFamily = null,
  canEdit,
  inspirationByPart,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activePart, setActivePart] = useState<PartId>('ceiling');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = useSaveLoader();

  const svg = useMemo(
    () => renderVenueSvg(design, palette, roleColors),
    [design, palette, roleColors],
  );
  const activeDef = RECEPTION_PARTS.find((p) => p.id === activePart)!;

  // ---- AI decor-image layer pilot (backdrop + ceiling only) ----
  // Fetch the catalog once — it's tiny (at most 2 zones × 5 styles) and reads
  // only approved+not-retired rows, so an empty result (today's reality until
  // a human uploads the pilot images to R2, per the migration header) is
  // silent and cheap. Skipped entirely while collapsed — no point fetching
  // for a panel the couple hasn't opened.
  const [catalog, setCatalog] = useState<DecorLayerCatalog>({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getReceptionDecorLayerCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((err) => {
        // Non-fatal — every zone already falls back to the flat SVG when the
        // catalog is empty, so a failed fetch just means "no AI layers this
        // load," not a broken designer.
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Load reception decor layer catalog',
          filePath: 'app/dashboard/[eventId]/seating/lab/_components/reception-design-editor.tsx',
          error: err,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Per-zone retinted image data URLs — recomputed whenever the resolved
  // asset or the couple's target color for that zone changes. `decorImages`
  // holds ONLY zones currently resolving to an image; a zone that falls back
  // to svg is simply absent (and the flat SVG under it is already correct).
  const [decorImages, setDecorImages] = useState<Partial<Record<PartId, string>>>({});
  const targetHex = primaryZoneTargetHex(palette);
  useEffect(() => {
    let cancelled = false;
    const nextEntries: Array<[PartId, string]> = [];
    Promise.all(
      PILOT_DECOR_ZONES.map(async (zone) => {
        const resolved = resolveDecorLayer(zone, styleFamily, catalog);
        if (resolved.kind !== 'image') return;
        try {
          const dataUrl = await loadAndRetintDecorLayer(
            resolved.asset.storagePath,
            resolved.asset.colorRange,
            targetHex,
          );
          nextEntries.push([zone, dataUrl]);
        } catch (err) {
          void trackFailure({
            eventType: 'SUPABASE_SAVE_ERROR',
            elementName: 'Retint reception decor layer',
            filePath: 'app/dashboard/[eventId]/seating/lab/_components/reception-design-editor.tsx',
            error: err,
            payload: { zone, storagePath: resolved.asset.storagePath },
          });
        }
      }),
    ).then(() => {
      if (!cancelled) setDecorImages(Object.fromEntries(nextEntries));
    });
    return () => {
      cancelled = true;
    };
  }, [catalog, styleFamily, targetHex]);

  /** Write one attribute's value (a bare string for one pick, an array for
   *  several) and persist. The server re-sanitizes, so this is the optimistic
   *  half only — it never has the last word on what is valid. */
  function commit(part: PartId, attr: string, value: AttributeValue) {
    const cur =
      design[part] && typeof design[part] === 'object'
        ? (design[part] as Record<string, AttributeValue>)
        : {};
    const next: ReceptionDesign = {
      ...design,
      [part]: { ...DEFAULT_DESIGN[part], ...cur, [attr]: value },
    };
    onChange(next);
    startTransition(async () => {
      try {
        await save.run(() => saveReceptionDesign(eventId, next), {
          steps: ['Saving your design'],
          hint: 'Saving',
        });
        setError(null);
      } catch (err) {
        setError('Could not save — try again.');
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Save reception design',
          filePath: 'app/dashboard/[eventId]/seating/lab/_components/reception-design-editor.tsx',
          error: err,
          payload: { part, attr, value },
        });
      }
    });
  }

  /**
   * A tap on one option chip.
   *
   * • single attribute (the default) — replaces the choice, exactly as before;
   * • `multi` attribute — toggles like a checkbox, with three refusals that
   *   keep the room describable: an `exclusive` "nothing here" option clears
   *   the rest (and is cleared BY the rest), the last remaining selection
   *   cannot be turned off (an empty attribute silently falls back to
   *   DEFAULT_DESIGN, so the room would change to something the couple never
   *   picked), and nothing is added past MAX_SELECTIONS_PER_ATTRIBUTE.
   */
  function choose(part: PartId, attrDef: Attribute, optionId: string) {
    if (attrDef.multi !== true) {
      commit(part, attrDef.id, optionId);
      return;
    }
    const isExclusive = (id: string) =>
      attrDef.options.find((o) => o.id === id)?.exclusive === true;
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

  /** The part-chip's trailing summary: the primary option's label, plus how
   *  many more are selected alongside it ("Draped canopy +1"). */
  function primaryLabel(part: (typeof RECEPTION_PARTS)[number]): string {
    const a = part.attributes[0]!;
    const chosen = selAll(design, part.id, a.id);
    const label = a.options.find((o) => o.id === sel(design, part.id, a.id))?.label ?? '';
    return chosen.length > 1 ? `${label} +${chosen.length - 1}` : label;
  }

  if (!canEdit) return null;

  return (
    <div className="mb-2 rounded-xl bg-white/[0.06] p-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs font-medium text-white/85"
      >
        <span>Reception design</span>
        <span className="text-white/50">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="mt-2 space-y-3">
          {/* viewzone — the live venue */}
          <div className="relative overflow-hidden rounded-2xl border border-ink/15 bg-cream">
            <div
              className="block w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            {/* AI decor-image layer pilot — composited ON TOP of the flat SVG
                at the exact zone bounds, only for zones that resolved to a
                retinted image this render. Every other zone (and today, in
                production, EVERY zone — see the styleFamily doc-comment)
                shows nothing here, leaving the flat SVG as the only visible
                rendering. */}
            {(Object.entries(decorImages) as Array<[PartId, string]>).map(([zone, dataUrl]) => {
              const bounds = DECOR_ZONE_BOUNDS[zone];
              if (!bounds) return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={zone}
                  src={dataUrl}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-sm object-cover"
                  style={{ left: `${bounds.l}%`, top: `${bounds.t}%`, width: `${bounds.w}%`, height: `${bounds.h}%` }}
                />
              );
            })}
            {HOTSPOTS.map((z, i) => (
              <button
                key={`${z.part}-${i}`}
                type="button"
                onClick={() => setActivePart(z.part)}
                aria-label={`Design the ${z.part}`}
                className={`absolute rounded-lg transition ${
                  activePart === z.part ? 'ring-2 ring-terracotta/70' : 'hover:bg-white/15'
                }`}
                style={{ left: `${z.l}%`, top: `${z.t}%`, width: `${z.w}%`, height: `${z.h}%` }}
              />
            ))}
            <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-ink/55 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-cream">
              Tap a part to design it
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-terracotta-700">
              {error}
            </p>
          ) : null}

          {/* part selector */}
          <div className="flex flex-wrap gap-1.5">
            {RECEPTION_PARTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePart(p.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  activePart === p.id
                    ? 'border-terracotta bg-terracotta/10 text-ink'
                    : 'border-ink/15 bg-cream text-ink/70 hover:border-ink/30'
                }`}
              >
                {p.label}
                <span className="ml-1 text-ink/40">· {primaryLabel(p)}</span>
              </button>
            ))}
          </div>

          {/* tapzone — every material for the active part */}
          <div className="space-y-3 rounded-xl border border-ink/10 bg-white p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              {activeDef.label} · {activeDef.blurb}
            </p>
            {/* ── THE PHOTO THEY PICKED THIS ZONE FOR ────────────────────────
                The couple uploads inspiration during onboarding and on the mood
                board, and no 3D surface has ever read it — so they chose a
                ceiling they loved, then picked a ceiling treatment on another
                screen with the photo nowhere in sight.

                Reference, NEVER composited into the render: this sits beside
                the choice, so the room stays what the room actually draws.
                Only five parts have a matching slot, so most zones show
                nothing here — absent is the honest answer, not a placeholder. */}
            {(inspirationByPart?.[activePart]?.length ?? 0) > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-medium text-ink/60">Your inspiration</p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {inspirationByPart![activePart]!.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 shrink-0 rounded-lg border border-ink/10 object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {activeDef.attributes.map((attr) => {
              // A `multi` attribute's chips behave like checkboxes — several
              // can be pressed at once, up to the cap. Same chip styling as
              // every other option; only the pressed COUNT differs.
              const chosen = selAll(design, activePart, attr.id);
              const atCap = attr.multi === true && chosen.length >= MAX_SELECTIONS_PER_ATTRIBUTE;
              return (
                <div key={attr.id} className="space-y-1.5">
                  <p className="text-[11px] font-medium text-ink/60">
                    {attr.label}
                    {attr.multi === true ? (
                      <span className="ml-1 font-normal text-ink/40">
                        · pick up to {MAX_SELECTIONS_PER_ATTRIBUTE}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.options.map((opt) => {
                      const selected = chosen.includes(opt.id);
                      // At the cap, an unselected chip can't be added — say so
                      // by dimming it rather than swallowing the tap silently.
                      const blocked = atCap && !selected && opt.exclusive !== true;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={selected}
                          disabled={blocked}
                          onClick={() => choose(activePart, attr, opt.id)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                            selected
                              ? 'border-terracotta bg-terracotta/10 text-ink ring-1 ring-terracotta/40'
                              : blocked
                                ? 'cursor-not-allowed border-ink/10 bg-cream text-ink/30'
                                : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-white/50">
            {isPending ? 'Saving…' : 'Saved'} · colors come from your Reception palette.
            {palette.length === 0 ? ' Set it in the Mood Board to see your colors here.' : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
