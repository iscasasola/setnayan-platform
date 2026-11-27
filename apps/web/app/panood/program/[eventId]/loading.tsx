/**
 * /panood/program/[eventId] — the program window an encoder (OBS) captures, while the server answers.
 *
 * Why: speed audit 2026-11-27, Group J. No loading boundary sat at or above this route and the page makes about
 * 7 reads before paint, so a tap showed nothing until the server answered.
 *
 * Shape it mirrors (program-surface.tsx): one full-viewport dark frame with the picture centred and nothing else.
 * This window can be captured to air, so the wait is deliberately almost empty — the dark frame and one small
 * centred mark where the source label lands, no rows, no panels.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private page,
 * as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen } from '@/components/skeletons';

export default function PanoodProgramLoading() {
  return (
    <Screen className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-ink">
      <Ghost className="h-3 w-32 rounded opacity-40" />
    </Screen>
  );
}
