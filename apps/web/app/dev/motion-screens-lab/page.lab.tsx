/**
 * /dev/motion-screens-lab — the motion standard's Phase 3 ("screens & bars", 18 Nov 2026) on the SHIPPED shared parts,
 * with no sign-in and no database, so each motion can be walked at 375 / 390 px beside the prototype:
 *   Tuck (the top bar, the bottom nav's pill, the thumb row and the pinned row) · Highlight (the bottom nav at 0.7 s) ·
 *   the full-screen map (Stack · Zoom through · Picture leads on `RiseScreen`, Side peek on the inspector sheet) ·
 *   Push (the row that goes deeper, and its Back) · Picture leads card → page.
 * The parts are the app's own; the words are stand-ins.
 */
import { notFound } from 'next/navigation';
import { MotionScreensLabStage } from './stage';

export default function MotionScreensLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MotionScreensLabStage page="home" />;
}
