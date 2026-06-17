import { registerPlugin } from '@capacitor/core';

/**
 * Panood — the on-device live broadcaster (Capacitor plugin contract).
 *
 * The web layer (this app, running in the Capacitor WebView) is the CONTROL
 * PLANE: it calls `createBroadcast` (server action) to get the RTMP target, then
 * tells the native plugin to start pushing. Video frames never cross this bridge
 * — only these small JSON commands. The native implementation lives in
 * apps/mobile (iOS: HaishinKit / Android: RootEncoder) — see
 * apps/mobile/PANOOD_LOCAL_SWITCHER_RUNBOOK.md.
 *
 * P1: the plugin captures the device's OWN camera and pushes it to the YouTube
 * stream key. P2 swaps the source for WebRTC-ingested remote cameras + an
 * on-device composite of the selected program feed.
 */
export interface PanoodBroadcasterPlugin {
  /**
   * Start capturing + encoding the local camera and push RTMP to the YouTube
   * ingestion URL with the given stream key. Resolves once publishing has begun
   * (the broadcast auto-goes-live on the YouTube side when the encoder connects).
   */
  start(opts: {
    ingestionUrl: string; // rtmp://a.rtmp.youtube.com/live2  (from createBroadcast)
    streamKey: string; // the secret stream key (from createBroadcast)
    resolution?: '720p' | '1080p'; // default 720p (lighter / cooler)
    facing?: 'front' | 'back'; // default back
  }): Promise<void>;

  /** Stop publishing and release the camera/mic. */
  stop(): Promise<void>;

  /** Current broadcaster state, for the director UI. */
  status(): Promise<{
    state: 'idle' | 'connecting' | 'live' | 'error';
    error?: string;
  }>;

  /** Flip between front/back camera mid-broadcast (P1 convenience). */
  switchCamera?(): Promise<void>;
}

/**
 * Registered native plugin. On a plain web browser (no native shell) every call
 * rejects with "not implemented" — gate calls behind `Capacitor.isNativePlatform()`.
 */
export const PanoodBroadcaster =
  registerPlugin<PanoodBroadcasterPlugin>('PanoodBroadcaster');
