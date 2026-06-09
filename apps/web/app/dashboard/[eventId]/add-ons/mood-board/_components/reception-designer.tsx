'use client';

/**
 * Reception Designer — stylist-grade (owner directive 2026-06-09: "as intricate
 * as possible … all the materials stylists use"). A palette-tinted stylized SVG
 * venue (lib/reception-scene) the couple designs material-by-material: tap a
 * part (ceiling / backdrop / stage / tables / entrance) and set each of its
 * attributes (e.g. tables = shape · chairs · linen · centerpiece · place
 * setting). The scene updates live; every choice also builds a stylist brief
 * that will drive the paid "Make it real" photoreal render (Nano Banana).
 * Free + instant — pure SVG, no AI, ₱0.
 */

import { useMemo, useState, useTransition } from 'react';
import {
  RECEPTION_PARTS,
  DEFAULT_DESIGN,
  renderVenueSvg,
  sel,
  type PartId,
  type ReceptionDesign,
} from '@/lib/reception-scene';
import { trackFailure } from '@/lib/telemetry/track-error';
import { saveReceptionDesign } from '../actions';

type Props = {
  eventId: string;
  initialDesign: ReceptionDesign;
  /** The couple's shared Reception palette (hex colors). */
  palette: string[];
};

const HOTSPOTS: ReadonlyArray<{ part: PartId; l: number; t: number; w: number; h: number }> = [
  { part: 'ceiling', l: 4, t: 0, w: 92, h: 20 },
  { part: 'backdrop', l: 33, t: 22, w: 34, h: 26 },
  { part: 'stage', l: 36, t: 49, w: 28, h: 13 },
  { part: 'tunnel', l: 35, t: 63, w: 30, h: 35 },
  { part: 'tables', l: 3, t: 49, w: 29, h: 45 },
  { part: 'tables', l: 68, t: 49, w: 29, h: 45 },
];

export function ReceptionDesigner({ eventId, initialDesign, palette }: Props) {
  const [design, setDesign] = useState<ReceptionDesign>(
    initialDesign && typeof initialDesign === 'object' ? initialDesign : {},
  );
  const [activePart, setActivePart] = useState<PartId>('ceiling');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const svg = useMemo(() => renderVenueSvg(design, palette), [design, palette]);
  const activeDef = RECEPTION_PARTS.find((p) => p.id === activePart)!;

  function choose(part: PartId, attr: string, optionId: string) {
    const cur =
      design[part] && typeof design[part] === 'object'
        ? (design[part] as Record<string, string>)
        : {};
    const next: ReceptionDesign = {
      ...design,
      [part]: { ...DEFAULT_DESIGN[part], ...cur, [attr]: optionId },
    };
    setDesign(next);
    startTransition(async () => {
      try {
        await saveReceptionDesign(eventId, next as Record<string, Record<string, string>>);
        setError(null);
      } catch (err) {
        setError('Could not save — try again.');
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Save reception design',
          filePath:
            'app/dashboard/[eventId]/add-ons/mood-board/_components/reception-designer.tsx',
          error: err,
          payload: { part, attr, optionId },
        });
      }
    });
  }

  function primaryLabel(part: (typeof RECEPTION_PARTS)[number]): string {
    const a = part.attributes[0]!;
    const id = sel(design, part.id, a.id);
    return a.options.find((o) => o.id === id)?.label ?? '';
  }

  return (
    <div className="space-y-3">
      {/* viewzone — the live venue */}
      <div className="relative overflow-hidden rounded-2xl border border-ink/15 bg-cream">
        <div
          className="block w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
        />
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
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
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
        {activeDef.attributes.map((attr) => (
          <div key={attr.id} className="space-y-1.5">
            <p className="text-[11px] font-medium text-ink/60">{attr.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {attr.options.map((opt) => {
                const selected = sel(design, activePart, attr.id) === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => choose(activePart, attr.id, opt.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      selected
                        ? 'border-terracotta bg-terracotta/10 text-ink ring-1 ring-terracotta/40'
                        : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink/50">
        {isPending ? 'Saving…' : 'Saved'} · colors come from your Reception palette above.
        {palette.length === 0 ? ' Set it to see your colors here.' : ''}
      </p>
    </div>
  );
}
