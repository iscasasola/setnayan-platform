## 2026-06-22 · feat(seating-3d): the couple's monogram on the 3D seating-lab floor

Animated-logo surface rollout (owner 2026-06-22, owner-confirmed the mark WILL
show on the 3D seat plan). The flag-gated 3D seating lab (`NEXT_PUBLIC_SEATING_3D`)
rendered the room in all solid-colour materials with no couple identity at all —
`coupleNames` was even passed `null`. PR1 lays the couple's **canonical mark** as a
medallion on the **floor centre** (world origin) — the exact point the Play-mode
camera composes on (`CameraRig` lookAt `0,0.5,0`), and a safe anchor for both
free and venue-sized boards (no off-floor sprawl).

- **New reusable util `apps/web/lib/svg-monogram-texture.ts`** (client): rasterizes
  the SAME mark the QR centres / hero / save-the-date show (`monogramOverlaySvg` —
  a self-contained cream-plate + accent-ring + initials/lockup badge, so it reads
  on any floor hue) into a `THREE.CanvasTexture`. Two-branch source
  (`{kind:'svg'}` bespoke/uploaded · `{kind:'config'}` lockup/initials), data-URI
  → contain-fit `drawImage` → `SRGBColorSpace` texture; resolves `null` on any
  failure so the scene never breaks. Built as a seam the Live Wall + Recap 3D/
  render surfaces can reuse.
- **`lib/seating-3d.ts`** owns the new `MonogramTextureSource` / `Lab3DMonogram`
  types (type-only `MonogramConfig` import — stays runtime-dependency-free).
- **`page.tsx`** fetches the event's monogram columns (sibling `seating/print`
  reads `events` by `event_id` the same way; RLS-scoped) and resolves the mark
  with the canonical uploaded → bespoke → lockup/initials precedence, replacing
  the dead `coupleNames={null}` prop with `monogram`.
- **`seating-lab-3d.tsx` / `RoomShell`**: builds the texture in a `[monogram]`-keyed
  effect (disposes on unmount/source-change + a `live` flag drops late async
  resolves; NOT keyed on palette, so the runtime palette switcher never orphans a
  texture) and renders one unlit (`toneMapped:false`) plane at `y=0.022` (clears
  the floor/shadow/grid/dance y-stack) with `raycast={()=>null}` (never steals the
  drag/deselect pointer). Static in PR1.

Deferred followups: a one-shot in-three entrance bloom on Play-settle (gated behind
the paid `ANIMATED_MONOGRAM` SKU so the free seat-plan tool stays free), a stage
backdrop + entrance-arch second instance, and adopting the util on the Live Wall /
Recap surfaces.

SPEC IMPACT: None (flag-gated prototype surface; the mark is the canonical one
already specced under 0008 seating + 0037 monogram). Rollout progress in
`DECISION_LOG.md`.
