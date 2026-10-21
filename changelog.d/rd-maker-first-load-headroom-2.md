## 2026-10-22 · perf(maker): first-load headroom, round 2 — the Dress code row's form loads when its row opens; no guest-page component rides the Maker

The Maker's first load sat AT its 507KB budget again (CI "bundle size check" on main: 507.1KB after #6742/#6745; 507.0KB
on `57a012d`), so every open PR went red on it. Budget **not** raised.

- Measured by source-map byte attribution of the Maker's cold-open chunks plus each client boundary's EXCLUSIVE cost
  (the #6646 method). The largest piece not needed to draw the first screen: the Dress code row's form —
  `GroupAttireField` · `RoleAttireField` and the attire tables (`attire-rows`, `attire-figures`, `attire-designs`,
  `role-groups`, `role-dress-code`, `role-group-dress-code`), ~8.6KB gz.
- WHY it was in the first load: the Maker's server files (`website/editor/page.tsx`, `mood-board-editor.tsx`) imported
  `foldEventRoles` / `normalizeDressCodeConfig` from `dress-code-fields.tsx`, and Next puts every `'use client'`
  module a server file's imports reach into the route's first load — so two plain readers dragged the whole form in.
- `dress-code-config.ts` (new, plain) now holds the two readers; `dress-code-fields.tsx` re-exports them for every
  other caller. `DressCodePanel` moved WHOLE (form, fields, Save — unchanged) from `authoring-panels.tsx` to the client
  file `dress-code-panel.tsx`, reached through a `details-lazy.tsx` stand-in (existing `maker-details` chunk, warmed at
  idle — no new async chunk name, so the shared bundle's runtime is unchanged). A panel not yet arrived is a slot, never
  half a form.
- **Guest-page code accidentally pulled in:** `lib/event-poster.ts` (reached from the Maker via `event-poster.server.ts` →
  `maker-made-once.tsx`) imported `splitCoupleNames` through `app/[slug]/_components/pahina-masthead.tsx`'s re-export —
  it lives in `lib/split-names.ts`. That made the guest page's masthead a Maker server file and put its client doors
  (`FirstScreenDoor`, `CoverRsvpGoes`, `SceneClip` + `hub-veil`, ~6KB gz) in the Maker's first load, although the guest
  page draws in the canvas's own iframe route. `event-poster.ts` and `names-verb.ts` now import the helper from its lib.
- Guards: `details-pieces-are-lazy.test.ts` test 5 (new) — no `app/[slug]/` client component is a Maker first-load
  boundary (sabotage: the old import → red, restored → green).
- Guards: `details-pieces-are-lazy.test.ts` test 4 (new) — the dress-code form body is never on the Maker's server
  side, its readers are and import no client module, and the panel is a lazy piece. Repointed to the moved code:
  `every-maker-form-drafts-or-says-so`, `maker-live-savers-draft`, `each-role-wears-its-own`, `inc-dress-code-starter`.

SPEC IMPACT: None
