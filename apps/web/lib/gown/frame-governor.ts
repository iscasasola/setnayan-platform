/**
 * 👗 gown/frame-governor — keeps phones cool (owner, the phone got hot; prototype v186 `cool`). Phones draw at 30 fps;
 * after 15 s without a touch, and with nothing moving, drawing drops to 4 fps; any touch wakes it. A desktop draws
 * every frame the browser offers. Pure: the stage asks `shouldDraw(now)` each animation frame.
 * 🔒 lib/gown/stage.test.ts
 */

/** 30 fps on a phone (v186: a 32 ms gap). */
export const GOWN_PHONE_FRAME_MS = 32;
/** 4 fps when idle (v186: a 250 ms gap). */
export const GOWN_IDLE_FRAME_MS = 250;
/** Idle after 15 s without a touch. */
export const GOWN_IDLE_AFTER_MS = 15_000;

export type GownFrameGovernor = {
  /** A touch, a drag, a key or an input: wake up. */
  touch: (now: number) => void;
  /** Something is moving (a pose blend, a turn): never idle while it is. */
  setBusy: (busy: boolean) => void;
  /** Ask once per animation frame; true = draw this one. */
  shouldDraw: (now: number) => boolean;
  /** The gap the governor is keeping now (for the lab's readout). */
  gap: (now: number) => number;
};

export function createGownFrameGovernor(phone: boolean, start = 0): GownFrameGovernor {
  let last = start;
  let drawn = -Infinity;
  let busy = false;
  const gap = (now: number) => (!busy && now - last > GOWN_IDLE_AFTER_MS ? GOWN_IDLE_FRAME_MS : phone ? GOWN_PHONE_FRAME_MS : 0);
  return {
    touch: (now) => {
      last = now;
      drawn = -Infinity; // the first frame after a touch draws at once
    },
    setBusy: (b) => {
      busy = b;
    },
    shouldDraw: (now) => {
      if (now - drawn < gap(now)) return false;
      drawn = now;
      return true;
    },
    gap,
  };
}
