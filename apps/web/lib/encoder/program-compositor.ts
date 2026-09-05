/**
 * S1 · the program compositor — state + tick, painter-agnostic.
 *
 * Holds the latest decoded frame per video slot, keeps the current `ProgramFrame` (wire
 * form), and on every tick runs `planProgram` against an injected `ProgramPainter`. The
 * worker gives it a painter backed by an `OffscreenCanvas` 2D context; the tests give it a
 * recording painter and assert the DRAW-CALL LOG. That log is the contract — chosen over
 * pixel hashing (`@napi-rs/canvas`) because every decision this module makes is visible in
 * the calls, and a pixel test would only re-derive them through a rasteriser we do not ship.
 *
 * REPEAT-LAST-FRAME ON STALL. The tick never waits for the camera. If no new `VideoFrame`
 * arrived since the last tick, the plan runs again over the frames already held — the
 * canvas re-draws the last composite — and the frame counter still advances. A stalled
 * phone therefore shows as a held picture, never a gap in the encoder's input and never a
 * frozen tick (S4 will pull one encode per tick from this canvas).
 *
 * WHAT A NULL STREAM MEANS. When the frame says there is no stream, the held `VideoFrame`
 * for that slot is closed and dropped — not merely skipped. The planner already refuses to
 * plan a video op without a stream; this makes the previous camera's last picture
 * unreachable even by a later bug in the plan.
 */

import { EMPTY_FRAME } from '../panood-program-bridge';
import {
  fitContain,
  planProgram,
  toWireFrame,
  type DrawOp,
  type PlanInput,
  type ProgramFrameWire,
  type ProgramPlan,
  type Region,
  type VideoSlot,
} from './program-plan';

/** The subset of `VideoFrame` the compositor relies on, so tests can hand in a fake. */
export type VideoFrameLike = {
  readonly displayWidth: number;
  readonly displayHeight: number;
  close(): void;
};

/** What the compositor needs from its surface. One method per op kind. */
export interface ProgramPainter {
  clear(): void;
  /** `frame` is the slot's latest decoded picture; `dest` is already object-contain fitted. */
  drawVideo(frame: VideoFrameLike, dest: Region): void;
  drawDivider(x: number, width: number): void;
  drawCard(card: 'no-signal' | 'withheld-source', lines: readonly string[]): void;
  drawNotice(text: string): void;
}

/**
 * S2's seam: called after the program picture and before the tick returns, with the frame
 * that was just planned. S2 draws `ResolvedOverlays` (monogram · lower third · event QR)
 * here. Null by default — S1 draws no overlay of any kind.
 */
export type OverlayPainterHook = (painter: ProgramPainter, frame: ProgramFrameWire) => void;

export type TickResult = {
  /** Monotonic — advances on every tick, fresh or repeated. */
  frameCount: number;
  /** True when no new VideoFrame arrived since the previous tick and the last composite was re-drawn. */
  repeated: boolean;
  /** The ops that were executed, for assertions. */
  plan: ProgramPlan;
};

export class ProgramCompositor {
  private wire: ProgramFrameWire = toWireFrame(EMPTY_FRAME);
  private air: PlanInput['air'] = null;
  private held: Record<VideoSlot, VideoFrameLike | null> = { primary: null, secondary: null };
  private freshSinceLastTick = false;
  private frameCount = 0;
  private repeatedCount = 0;
  private overlayHook: OverlayPainterHook | null = null;

  constructor(private readonly painter: ProgramPainter) {}

  /** New `ProgramFrame` from the bridge (wire form). */
  setFrame(wire: ProgramFrameWire): void {
    this.wire = wire;
    if (!wire.hasStream) this.dropHeld('primary');
    if (!wire.hasSecondaryStream) this.dropHeld('secondary');
  }

  setAir(air: PlanInput['air']): void {
    this.air = air;
  }

  /**
   * The slot's track was replaced (or removed). Drop whatever picture the OLD track left
   * behind so the first tick after a cut shows the new camera or black — the pop-out's
   * `<video>` behaves the same way when its `srcObject` changes.
   */
  resetSlot(slot: VideoSlot): void {
    this.dropHeld(slot);
  }

  /** A decoded frame arrived for `slot`. Takes ownership; the previous one is closed. */
  pushVideoFrame(slot: VideoSlot, frame: VideoFrameLike): void {
    const previous = this.held[slot];
    this.held[slot] = frame;
    if (previous && previous !== frame) safeClose(previous);
    this.freshSinceLastTick = true;
  }

  /** S2 installs its overlay painter here. */
  setOverlayHook(hook: OverlayPainterHook | null): void {
    this.overlayHook = hook;
  }

  /** One tick of the master clock. Never throws for a missing frame; never skips. */
  tick(): TickResult {
    const repeated = !this.freshSinceLastTick;
    this.freshSinceLastTick = false;
    this.frameCount += 1;
    if (repeated) this.repeatedCount += 1;

    const plan = planProgram({ frame: this.wire, air: this.air });
    for (const op of plan) this.execute(op);
    this.overlayHook?.(this.painter, this.wire);

    return { frameCount: this.frameCount, repeated, plan };
  }

  stats(): { frameCount: number; repeatedCount: number } {
    return { frameCount: this.frameCount, repeatedCount: this.repeatedCount };
  }

  /** Close every held frame. Call on worker stop so the track's frame pool is released. */
  dispose(): void {
    this.dropHeld('primary');
    this.dropHeld('secondary');
  }

  private execute(op: DrawOp): void {
    switch (op.kind) {
      case 'clear':
        this.painter.clear();
        return;
      case 'video': {
        const frame = this.held[op.slot];
        // A stream with no decoded frame yet (first ~100 ms after a cut) is black in the
        // pop-out too — the cleared region stands.
        if (!frame) return;
        this.painter.drawVideo(frame, fitContainFrame(frame, op.region));
        return;
      }
      case 'divider':
        this.painter.drawDivider(op.x, op.width);
        return;
      case 'card':
        this.painter.drawCard(op.card, op.lines);
        return;
      case 'notice':
        this.painter.drawNotice(op.text);
        return;
    }
  }

  private dropHeld(slot: VideoSlot): void {
    const frame = this.held[slot];
    this.held[slot] = null;
    if (frame) safeClose(frame);
  }
}

function fitContainFrame(frame: VideoFrameLike, region: Region): Region {
  return fitContain(frame.displayWidth, frame.displayHeight, region);
}

function safeClose(frame: VideoFrameLike): void {
  try {
    frame.close();
  } catch {
    /* already closed — a VideoFrame closed twice throws, and that must never take the tick down */
  }
}
