/**
 * /panood/control/[eventId] — the Live Watch controller while the server answers. The flag, sign-in, "not your event",
 * the host gate and the app's ownership rule are all decided by `./layout.tsx` before this streams, so a 404 / 307 is
 * never sent as a 200 + skeleton. The page's own masthead is replaced by a status row (its title is sr-only), so no
 * heading is drawn here either: the status row, the camera board and its side list, all grey.
 */
import { BoardPageSkeleton } from '@/components/skeletons';

export default function ControlRoomLoading() {
  return <BoardPageSkeleton />;
}
