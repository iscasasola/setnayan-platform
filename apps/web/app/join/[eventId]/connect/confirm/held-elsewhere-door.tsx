import { DoorShell } from '@/app/_components/door/door-shell';
import { SEAT_HELD_ELSEWHERE } from '@/lib/seat-binding';

/**
 * The screen a SECOND account lands on after Google / Apple / sign-in when the
 * invitation it reached for is already kept in another account (owner
 * 2026-10-01: *"we will say this event QR is already assigned to someone."*).
 * Exactly the two sentences, nothing to press — the door's own wordmark is the
 * way out. Rendered by `./page.tsx`; pinned by
 * `one-invitation-one-account.test.ts`.
 */
export function HeldElsewhereDoor() {
  return (
    <DoorShell title={SEAT_HELD_ELSEWHERE.heading} sub={SEAT_HELD_ELSEWHERE.line} tone="dead_end" />
  );
}
