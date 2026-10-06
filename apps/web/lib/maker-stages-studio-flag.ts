import { envFlagEnabled } from '@/lib/env-flag';

/**
 * THE NEW EVENT HUB MAKER ("Stages | Studio") — feature flag.
 *
 * Gates which Maker chrome a PHONE draws (`launch/_components/maker-shell.tsx`):
 * ON  → the Stages | Studio frame (owner 2026-10-06, `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md`
 *       PR 1; prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`):
 *       ✕ · Stages | Studio · ↺ · ✓ on top, the lower third that drags up to
 *       half the screen, one bottom sheet for every pop-up, and the Studio home
 *       of eleven tiles that open the editors the Maker already has.
 * OFF → the shipped Maker, untouched. A desktop is unchanged either way this round.
 *
 * It is ALSO on for an internal (§10a) viewer, so the owner can check each PR of
 * the build on the live site with the test wedding while every couple keeps the
 * shipped Maker. "Internal" is the reading the launch page already makes for
 * the View-as-a-free-couple switch (`viewAsFreeSwitch().offered`, lib/view-as-free.server.ts)
 * — handed in, never re-read here, so this stays a pure function a test can
 * run in both states.
 *
 * NEXT_PUBLIC_ because it is the same family as every other launch flag here
 * (`canvas-maker-flag.ts`, `booth-studio-flag.ts`): a server component reads it
 * to choose the chrome, and the value must survive the client bundle boundary
 * if a client ever needs it. Read through `envFlagEnabled` — `true` · `1` ·
 * `yes` · `on`, any case, trimmed; anything else, a missing var included, is
 * OFF, so the frame ships dark. ONE reader: the launch page calls this and
 * passes one boolean into `MakerShell`; nothing else reads the env
 * (`lib/flag-chokepoint-scan.test.ts`, `lib/maker-stages-studio-ships-dark.test.ts`).
 */
export function makerStagesStudioEnabled({ internal }: { internal: boolean }): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED) || internal === true;
}
