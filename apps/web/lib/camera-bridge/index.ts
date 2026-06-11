/**
 * Camera Bridge — brand-agnostic phone-as-bridge core (build plan C1 + C2).
 *
 * Brands plug the SOURCE side (implement `CameraBridge`); surfaces plug the
 * SINK side (consume files or the live-preview stream). See
 * `0012_papic/Camera_Bridge_Build_Plan_2026-06-11.md` (corpus) for the full
 * dependency graph; `MockBridge` lets every downstream workstream build and
 * test with zero DSLR hardware.
 *
 * Test suite: `pnpm --filter web exec tsx scripts/test-camera-bridge.ts`.
 */

export * from './types';
export { MockBridge, type MockBridgeOptions } from './mock-bridge';
export {
  captureUploadMeta,
  deliverCapture,
  makeBrowserSinkDeps,
  type PapicSinkDeps,
  type PresignRequest,
  type SinkDelivery,
} from './papic-sink';
export {
  DslrPairingController,
  resetBridgeSlots,
  type CompletedTake,
  type ContinuityEvent,
  type PairingControllerOptions,
  type PairingState,
  type SeamMarker,
  type TakeSegment,
  type TransitionEvent,
} from './pairing-fsm';
