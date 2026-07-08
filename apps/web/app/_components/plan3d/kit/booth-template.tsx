'use client';

/**
 * kit/booth-template — <BoothTemplate>: one templated vendor booth, assembled
 * from the kit per the owner-locked catalog
 * (`0008_3DPlan_Booth_Template_Catalog_2026-07-08.md`):
 *
 *   CHASSIS (kit/booth-chassis — mascot-smooth shared geometry)
 *   + PROPS (kit/booth-props — the category's signature pieces)
 *   + STAFF MASCOT(s) (the shipped <Figure> kit, ≤ 3 figures, staff outfit +
 *     a per-category wall-clock idle clip; never shadow-casting. The scene's
 *     `quality` knob flows through here — 'low' (phones) bakes each mascot to
 *     its clip's held t=0 pose, 'high' animates. Catalog-complete perf rule:
 *     a 10-booth phone room can carry ~16+ staff figures, which is exactly
 *     the crowd scale the figure kit's 'low' bake exists for.)
 *   + SIGNAGE (the shared BoothSign logo backdrop stays with BoothMesh for
 *     PRO/ENTERPRISE vendors — boothCanBrand unchanged; unbranded booths get
 *     the drawn BoothTextSign nameboard at the same hang height).
 *
 * CONTRACTS (unchanged from the generic booth):
 *   · Pure visual — the scene's invisible per-booth tap target (BoothHitTarget
 *     in plan3d-scene / guest-venue-3d) keeps catching taps over this mesh,
 *     exactly as it does over the generic BoothMesh.
 *   · Obstacle registration — every chassis' footprint discs reach the walk
 *     systems via `templateBoothObstacles` (kit/booth-templates.ts), the
 *     drop-in for seating-3d's boothObstacles at the three 3D call sites.
 *   · prefers-reduced-motion — <Figure> itself bakes the clip's held pose, so
 *     the booth still reads in-character with zero motion.
 *
 * Mounted by venue-objects' BoothMesh when `boothTemplateFor` resolves a
 * template — all 57 taxonomy leaves now do (catalog complete); only booths
 * with no template identity (unlinked custom pins, no-booth vendor
 * categories) keep the generic silhouette.
 */

import { useMemo } from 'react';
import {
  pctToWorld,
  boothCanBrand,
  type Lab3DBooth,
  type Lab3DPalette,
} from '@/lib/seating-3d';
import type { FigureSpec } from '@/lib/figure-rig';
import { Figure, type FigureQuality } from './figure';
import { BoothChassis, CHASSIS_SPECS } from './booth-chassis';
import { BoothProp, BoothTextSign } from './booth-props';
import type { BoothTemplateSpec } from './booth-templates';

export function BoothTemplate({
  booth,
  template,
  room,
  palette,
  quality = 'high',
}: {
  booth: Lab3DBooth;
  template: BoothTemplateSpec;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  /** Scene quality — 'low' bakes staff mascots to their held clip pose. */
  quality?: FigureQuality;
}) {
  const pos = useMemo(
    () => pctToWorld(booth.xPct, booth.yPct, room),
    [booth.xPct, booth.yPct, room],
  );
  const spec = CHASSIS_SPECS[template.chassis];

  // ≤ 3 staff mascots (the catalog cap), clamped to the chassis' anchors.
  // Stable ids keyed off the booth id → deterministic skin/hair per booth,
  // forever (the figure kit's resolveFigureLook promise). Staff carry no RSVP
  // status (empty statusColor → no ring) and no selfie path.
  const staffSpecs = useMemo<FigureSpec[]>(() => {
    const n = Math.min(template.staff.count, spec.staffAnchors.length, 3);
    return Array.from({ length: n }, (_, i) => ({
      id: `${booth.id}-staff-${i}`,
      outfit: template.staff.outfit,
      outfitColor: null,
      statusColor: '',
    }));
  }, [booth.id, template.staff.count, template.staff.outfit, spec.staffAnchors.length]);

  // Branded (pro/enterprise + logo) booths get the shared BoothSign logo
  // backdrop from BoothMesh; everyone else hangs the drawn nameboard here.
  const branded = boothCanBrand(booth.vendor?.tier) && !!booth.vendor?.logoUrl;
  const signText =
    booth.label.trim() || booth.vendor?.name.trim() || template.signText;

  return (
    <group position={[pos.x, 0, pos.z]}>
      <BoothChassis kind={template.chassis} palette={palette} />

      {template.props.map((p, i) => (
        <group
          key={i}
          position={[p.position[0], p.position[1], p.position[2]]}
          rotation={[0, p.rotY ?? 0, 0]}
          scale={p.scale ?? 1}
        >
          <BoothProp kind={p.kind} palette={palette} />
        </group>
      ))}

      {staffSpecs.map((s, i) => {
        const a = spec.staffAnchors[i]!;
        return (
          <group key={s.id} position={[a.x, a.y ?? 0, a.z]} rotation={[0, a.faceY, 0]}>
            {/* castShadow false: staff keep the crowd knob's shadow saving at
                every quality (the pre-threading `quality="low"` behavior). */}
            <Figure spec={s} pose="stand" quality={quality} idleClip={template.staff.idle} castShadow={false} />
          </group>
        );
      })}

      {!branded ? (
        <group position={[spec.signAnchor[0], spec.signAnchor[1], spec.signAnchor[2]]}>
          <BoothTextSign text={signText} palette={palette} />
        </group>
      ) : null}
    </group>
  );
}
