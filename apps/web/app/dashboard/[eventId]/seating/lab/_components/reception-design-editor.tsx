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
  selAll,
  venueZoneApplies,
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
   * MB15 — the room zones a supplier has AGREED to build, keyed by reception
   * part id, resolved on the server through `isPartFinalized` (the SAME
   * predicate the mood board's sections 02 and 03 read).
   *
   * 🛑 THIS EDITOR IS THE ONLY PLACE `events.reception_design` IS EDITED.
   * Section 03 shows the handshake and links here; until MB15 the editor it
   * links to did not know the handshake existed, so a couple could re-dress a
   * ceiling their stylist had signed off and neither surface said a word. A
   * part frozen in one surface and editable in the other is two mechanisms
   * disagreeing about one fact — both pass their own tests and the couple is
   * told two different things.
   *
   * ⚠ THE UI IS NOT THE LOCK. `events_hold_part_finalization_design` (migration
   * 20271204471183) re-asserts an agreed zone on every write to
   * `reception_design`, whichever writer sends it. This prop is what makes the
   * refusal legible instead of a silent revert.
   */
  finalizedByPart?: Record<string, { vendorName: string | null; agreedAt: string | null }>;
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
  /** `events.venue_setting` — READ, never re-asked (the couple already said
   *  it during onboarding / on the Details page). Re-shapes the drawing
   *  (`renderVenueSvg`) and gates a zone the venue genuinely lacks (a
   *  beach's ceiling, a garden's walls) — see `venueZoneApplies`. Omitting
   *  it draws the original hall-shaped room with nothing gated. */
  venueSetting?: string | null;
  /** The venue's display label ("Beach", "Garden Estate", …), already
   *  resolved by the caller (`VENUE_SETTING_LABEL`) — this component never
   *  guesses a label from the raw enum value. */
  venueLabel?: string;
  /** Gated on the same seating-editor lock as the rest of the Build sidebar
   *  (judgment call: reception_design writes don't actually touch the
   *  seating lock, but showing edit controls only when the couple "owns" the
   *  Build panel keeps this consistent with every other control in it). */
  canEdit: boolean;
};

/** "12 Sep 2026" — the agreed-on date, in the couple's own locale-neutral form.
 *  An unparseable timestamp yields null and the sentence simply omits the date
 *  rather than printing "Invalid Date" at a couple. */
function finalizedOnLabel(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
  venueSetting = null,
  venueLabel,
  canEdit,
  inspirationByPart,
  finalizedByPart,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activePart, setActivePart] = useState<PartId>(
    () => RECEPTION_PARTS.find((p) => venueZoneApplies(venueSetting, p.id))?.id ?? 'ceiling',
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = useSaveLoader();

  const svg = useMemo(
    () => renderVenueSvg(design, palette, roleColors, venueSetting),
    [design, palette, roleColors, venueSetting],
  );
  const activeDef = RECEPTION_PARTS.find((p) => p.id === activePart)!;

  // A venue switch (or the initial `ceiling` default landing on a venue that
  // never had one) can strand `activePart` on a zone this venue lacks — fall
  // back to the first zone the venue actually has, same guard the prototype
  // this ports carries (`renderReceptionDetail`'s "a venue switch can strand
  // the selection" comment).
  useEffect(() => {
    if (venueZoneApplies(venueSetting, activePart)) return;
    const next = RECEPTION_PARTS.find((p) => venueZoneApplies(venueSetting, p.id));
    if (next) setActivePart(next.id);
  }, [venueSetting, activePart]);

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
    // MB15 — a zone the supplier agreed to build stops moving. Refused at the
    // ONE funnel every chip (single and multi) already passes through, so a new
    // control cannot route around it. The chips are also disabled below; this
    // is the half that holds when they are not.
    if (finalizedByPart?.[part]) return;
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

  /** The zone rail's per-zone treatment text — every selected option of the
   *  part's first (defining) attribute, not just the primary one, so the
   *  rail reads the same way `moodboard-make-it-real.ts`'s `briefZoneLines`
   *  does ("Draped canopy + Fairy lights"), not a bare "+1" count. */
  function zoneRailText(part: (typeof RECEPTION_PARTS)[number]): string {
    const a = part.attributes[0]!;
    const labels = selAll(design, part.id, a.id)
      .map((id) => a.options.find((o) => o.id === id)?.label)
      .filter((l): l is string => Boolean(l));
    return labels.length ? labels.join(' + ') : 'not chosen yet';
  }

  /** Who agreed to the zone currently open, or null. */
  const activeFinalized = finalizedByPart?.[activePart] ?? null;
  const activeFinalizedOn = activeFinalized?.agreedAt ? finalizedOnLabel(activeFinalized.agreedAt) : null;

  const venueZoneHotspots = HOTSPOTS.filter((z) => venueZoneApplies(venueSetting, z.part));

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
          {/* The venue is a KNOWN FACT (events.venue_setting, set during
              onboarding / the Details page) — READ here, never re-asked. A
              full picker lives at Details; this is a pointer to it, not a
              second place to change it (one-directional, same rule as the
              majors mirror in 02's Venue group). */}
          {venueLabel ? (
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-white/60">
              <span className="font-medium text-white/85">Reception venue</span>
              <span>· {venueLabel}</span>
              <span className="text-white/40">— from your event, correct it on Details if it&rsquo;s wrong</span>
            </p>
          ) : null}
          {/* viewzone — the live venue, drawn IN the couple's colours and
              re-shaped by the venue type — repaints on every palette or
              venue change via the `svg` useMemo above. */}
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
            {venueZoneHotspots.map((z, i) => (
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

          {/* zone rail — every zone, name + current treatment at a glance.
              A zone the venue lacks is SHOWN, disabled, and SAYS so — never
              silently offered, never silently gone. */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="All reception zones">
            {RECEPTION_PARTS.map((p) => {
              const na = !venueZoneApplies(venueSetting, p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={na}
                  aria-pressed={activePart === p.id}
                  onClick={() => setActivePart(p.id)}
                  title={na ? `Not at a ${(venueLabel ?? 'this venue').toLowerCase()}` : undefined}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    na
                      ? 'cursor-not-allowed border-ink/10 bg-cream text-ink/30'
                      : activePart === p.id
                        ? 'border-terracotta bg-terracotta/10 text-ink'
                        : 'border-ink/15 bg-cream text-ink/70 hover:border-ink/30'
                  }`}
                >
                  {p.label}
                  {/* MB15 — an agreed zone is marked in the rail, so a couple
                      can see what is settled without opening each one. */}
                  {finalizedByPart?.[p.id] ? <span className="ml-1" aria-label="Agreed with your supplier">🔒</span> : null}
                  <span className={na ? 'ml-1' : 'ml-1 text-ink/40'}>
                    · {na ? `not at a ${(venueLabel ?? 'this venue').toLowerCase()}` : zoneRailText(p)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* tapzone — every material for the active part */}
          <div className="space-y-3 rounded-xl border border-ink/10 bg-white p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              {activeDef.label} · {activeDef.blurb}
            </p>
            {/* ── MB15 · AGREED, SO IT STOPS MOVING ──────────────────────────
                The same sentence the mood board's sections 02 and 03 show, in
                the surface where the design is actually edited. Naming WHO and
                WHEN is the point: "locked" with nobody's name attached leaves a
                couple with a control that does not respond and nothing anywhere
                telling them why, which is the shape MB12's panel exists against. */}
            {activeFinalized ? (
              <p className="rounded-lg border border-terracotta/30 bg-terracotta/10 px-2.5 py-2 text-[11px] leading-snug text-ink/75">
                <span className="font-medium text-ink">Agreed{activeFinalized.vendorName ? ` with ${activeFinalized.vendorName}` : ''}</span>
                {activeFinalizedOn ? ` on ${activeFinalizedOn}` : ''}. This part stops changing
                until you both re-open it — ask on your Mood Board.
              </p>
            ) : null}
            {/* ── WHO IS IN THE ROOM IS THE GUEST LIST'S ANSWER ──────────────
                This control sits beside the 3D room and reads like a room
                control. It is not one: it feeds `renderVenueSvg` — the flat
                concept illustration, the printed concept PDF and the supplier's
                mood-board mirror — where there is no seating to draw from, so
                somebody has to say who to sketch.

                The ROOM populates from `occByTable`: the guests who actually
                hold a seat. That is the right source and it must stay the
                source — a picker that could empty a room the guest list says is
                full would be a second mechanism owning one fact, and the two
                would disagree forever while each passed its own tests.

                So the honest fix is to say which surface this governs, not to
                wire it to the room. */}
            {activePart === 'people' ? (
              <p className="text-[11px] leading-snug text-ink/45">
                This sets who appears in your <span className="font-medium text-ink/70">concept
                image</span> and printed concept. The room itself seats whoever is on your guest
                list.
              </p>
            ) : null}
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
                      // A finalized zone blocks EVERY chip, selected or not:
                      // turning the agreed treatment off is as much a change as
                      // turning another one on.
                      const blocked =
                        Boolean(activeFinalized) || (atCap && !selected && opt.exclusive !== true);
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
                  {/* ── SAY WHAT THE ROOM IS NOT SHOWING ─────────────────────
                      A multi-select attribute is drawn by the 3D room as its
                      PRIMARY only (`sel`), while the mood board, the printable
                      and the concept PDF all render every chosen treatment
                      (`selAll`). That asymmetry is intended — what is not
                      allowed is leaving it unsaid, because the couple then
                      believes their combination is on screen when it is not.

                      Naming the treatment matters: a generic "showing one of
                      several" still leaves them guessing WHICH, and the whole
                      point is that they can tell what they are looking at. */}
                  {attr.multi === true && chosen.length > 1 ? (
                    <p className="text-[11px] leading-snug text-ink/45">
                      The 3D room draws{' '}
                      <span className="font-medium text-ink/70">
                        {attr.options.find((o) => o.id === chosen[0])?.label ?? chosen[0]}
                      </span>{' '}
                      only. Your other {chosen.length - 1}{' '}
                      {chosen.length - 1 === 1 ? 'choice shows' : 'choices show'} on the mood board
                      and the printed concept.
                    </p>
                  ) : null}
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
