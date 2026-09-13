'use client';

import { useEffect, useRef, useState } from 'react';
import { isTauri, tauri } from '@/lib/desktop-oauth';
import { createProgramCanvas, type ProgramCanvas } from '@/lib/encoder/program-canvas';
import { createEncoderSession, type EncoderSession } from '@/lib/encoder/encoder-session';
import { guardGoLive } from '@/lib/encoder/go-live-guard';
import type { ProgramAirDecision } from '@/lib/live-studio-publish-pure';
import type { ResolvedOverlays } from '@/lib/live-studio-overlays';
import type { EncoderHealthInput, EncoderRtmpState } from '@/lib/live-studio-ingest-health';

/** Must match `HEALTH_EVENT` in `src-tauri/src/encoder_ipc.rs`. */
const HEALTH_EVENT = 'encoder://health';
import { publishEncoderHealth } from '@/lib/encoder/encoder-health-bus';
import { readStreamKeyHandoffs, subscribeStreamKeyHeld } from '@/lib/encoder/encoder-key-bus';
import { shouldAttemptStart } from '@/lib/encoder/encoder-start-attempt';

/**
 * S18 · THE CALL SITE. This is the component whose absence was the finding.
 *
 * ── WHAT IT CLOSES ──────────────────────────────────────────────────────────
 * `createProgramCanvas`, `createAudioMixer`, the WebCodecs encoders, the IPC
 * contract and the Rust RTMP sender were all built, tested and merged across
 * fourteen sessions — and every one of `lib/encoder/*` had ZERO non-test
 * importers. The plan of record said "the pipeline is complete end to end."
 * Every stage was; the pipeline was not, because nothing constructed any of
 * them. This mounts the canvas, opens the session, and joins the two.
 *
 * ── WHY IT LIVES ON THE CONTROLLER AND NOT THE POP-OUT ──────────────────────
 * `program-canvas.ts`'s own docblock: "the canvas runs beside the controller,
 * not in a pop-out". The controller is the window that installs the program
 * bridge (`ProgramBridgeHost`, mounted directly above this) and therefore the
 * window that holds the live `MediaStream`s. A canvas in the pop-out would be
 * reading a bridge across `window.opener` for no reason.
 *
 * ── WHY IT RENDERS NOTHING ──────────────────────────────────────────────────
 * Same shape as `ProgramBridgeHost` and `ChannelFreshness` beside it: this is a
 * behaviour, not a surface. The health it produces goes to the strip that
 * already exists (`IngestHealthStrip`) rather than growing a second status
 * display that could disagree with the first — rule 24.
 *
 * ── THE GATES, AND WHY EACH ONE ─────────────────────────────────────────────
 * · `isTauri()` — the same JS ships to plain browsers, where none of these
 *   commands exist. S5.md § "Gate everything web-side on `window.__TAURI__`".
 * · `isLive` — encoding into a broadcast that does not exist burns the
 *   couple's laptop battery to send bytes nowhere.
 * · `streamingEnabled` — the existing flag the rest of the controller obeys.
 * · `air` — passed straight through to the canvas, never re-derived here. The
 *   paywall decision is the server's, exactly as `ProgramBridgeHost` documents
 *   at length; this component must not become a second place that decides it.
 */
export function DesktopEncoderHost({
  eventId,
  air,
  isLive,
  streamingEnabled,
  overlays,
}: {
  eventId: string;
  air: Pick<ProgramAirDecision, 'enforced' | 'permittedSlots'> | null;
  isLive: boolean;
  streamingEnabled: boolean;
  overlays: {
    resolved: ResolvedOverlays | null;
    qrSrc: string | null;
    lowerThirdFallback: string;
  } | null;
}) {
  const canvasRef = useRef<ProgramCanvas | null>(null);
  const sessionRef = useRef<EncoderSession | null>(null);
  const [, setTick] = useState(0);

  const shouldRun = isLive && streamingEnabled && isTauri();

  useEffect(() => {
    if (!shouldRun) return;
    let cancelled = false;

    // The worker's own drop counters, folded into the health reading the strip
    // renders. Rust reports the socket; the page reports what never reached it.
    let droppedFrames = 0;
    let rtmp: EncoderRtmpState = 'idle';
    let reconnectingForMs = 0;
    let recording = false;
    // Set once by the go-live probe, then carried for the life of the session.
    let transportEnvelope: string | null = null;
    let guardSentence = '';

    function emitHealth(): void {
      const input: EncoderHealthInput = {
        rtmp,
        reconnectingForMs,
        droppedFrames,
        // 0 until S9's ladder is driven from real occupancy readings — stated
        // rather than guessed. A fabricated rung would make the strip claim a
        // quality decision nothing actually made.
        bitrateRung: 0,
        recording,
      };
      publishEncoderHealth(eventId, input, { transportEnvelope, guardSentence });
      if (!cancelled) setTick((n) => n + 1);
    }

    const shell = tauri();
    if (!shell) return;

    const session = createEncoderSession({
      invoke: (command, args) => shell.core.invoke(command, args),
      mintToken: async (id) => {
        const res = await fetch('/api/live-studio/encoder/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventId: id }),
        });
        if (!res.ok) throw new Error(`token_${res.status}`);
        const body = (await res.json()) as { token?: string };
        if (!body.token) throw new Error('token_missing');
        return body.token;
      },
    });
    sessionRef.current = session;

    const canvas = createProgramCanvas({ air, overlays });
    canvasRef.current = canvas;

    const offConfig = canvas.onConfig((config) => session.acceptConfig(config));
    const offMedia = canvas.onMedia((media) => session.acceptMedia(media));
    const offStats = canvas.onFrameCount((stats) => {
      droppedFrames = stats.videoRingDrops + stats.audioRingDrops + stats.videoDriftDrops;
      emitHealth();
    });

    // Rust emits here for the life of the broadcast. An event rather than an
    // `ipc::Channel` because the web app has no `@tauri-apps/api` dependency —
    // it reaches Rust through the same `window.__TAURI__` accessor the OAuth
    // flow uses. `core:event:default` is already granted.
    let unlisten: (() => void) | null = null;
    void shell.event
      .listen(HEALTH_EVENT, (e) => {
        const update = e.payload as {
          rtmp: EncoderRtmpState;
          reconnectingForMs: number;
          recording: boolean;
        } | null;
        if (!update) return;
        rtmp = update.rtmp;
        reconnectingForMs = update.reconnectingForMs;
        recording = update.recording;
        emitHealth();
      })
      .then((off) => {
        if (cancelled) off();
        else unlisten = off;
      });

    // START ORDER MATTERS: probe, then start, then encode.
    //
    // THE PROBE COMES FIRST because it is the one check that can still be acted
    // on. `encoder_probe` ships in every build for exactly this call (its Rust
    // docblock says so, and distinguishes itself from the debug-only S0 spike
    // harness on that basis). If the transport cannot carry a chunk at all,
    // saying so here costs a second; discovering it after the couple has been
    // told they are live costs the ceremony.
    //
    // The canvas is started only after `encoder_start` resolves. Encoding
    // before Rust holds the socket would fill the pre-config buffer with frames
    // nobody asked for yet, and — worse — would report a "no_stream_key"
    // refusal AFTER the couple was told they were live.
    //
    // ── DSK-1: WHY START IS A FUNCTION AND NOT A ONE-SHOT ───────────────────
    // On the own-channel route this effect runs BEFORE the couple has anywhere
    // to paste a key: `isLive` is true the moment the event goes on air, and the
    // key box only appears then. So the first `session.start` throws
    // `no_stream_key`, and because this effect is keyed on `[shouldRun, eventId]`
    // — neither of which changes when a key arrives — nothing ever tried again.
    // The couple pasted a key, was told "Saved to your desktop encoder", and the
    // encoder stayed dead until a page reload.
    //
    // So: the probe still happens ONCE (it measures the transport, which a key
    // does not change, and it is a network round trip), and the publish attempt
    // is re-runnable. `announceStreamKeyHeld` — fired by the paste panel only
    // after Rust confirms it holds the key — is what re-runs it.
    let started = false;
    let starting = false;
    let probeVerdictAllowed: boolean | null = null;

    // An arrow const, not a `function` declaration: a declaration is hoisted
    // above the `if (!shell) return` guard, so TypeScript will not carry that
    // narrowing into it and `shell` reads as possibly-null inside. The IIFE this
    // replaced was an arrow expression for the same reason.
    const attemptStart = async (): Promise<void> => {
      // The three-way guard lives in a pure module so it is actually tested —
      // see encoder-start-attempt.ts for what each field prevents. `starting` is
      // the one a boolean-per-attempt cannot express: two concurrent starts
      // while `started` is still false.
      if (!shouldAttemptStart({ cancelled, started, starting })) return;
      starting = true;
      try {
        if (probeVerdictAllowed === null) {
          const verdict = await guardGoLive((command, args) =>
            shell.core.invoke(command, args) as Promise<string>,
          );
          if (cancelled) return;

          // Provenance for the strip, whatever the verdict: which envelope
          // carried the probe is an annotation, never a state (rule 24, and
          // `decideIngestHealth` refuses to let it change one).
          transportEnvelope = verdict.envelope;
          guardSentence = verdict.sentence;
          probeVerdictAllowed = verdict.allowed;
        }

        if (!probeVerdictAllowed) {
          // REFUSED — and the ONLY reason that can happen is
          // `transport_unusable`. Never because the envelope was not `raw`:
          // Raw never arrives on WebKit at all, so that rule would refuse every
          // macOS user. See go-live-guard.ts's docblock.
          //
          // A key cannot fix a broken transport, so this verdict is kept and a
          // later paste does not re-probe into the same refusal.
          rtmp = 'idle';
          emitHealth();
          return;
        }

        await session.start(eventId);
        if (cancelled) return;
        started = true;
        canvas.start();
        emitHealth();
      } catch {
        // The refusal is the honest outcome and the strip stays at
        // `waiting_for_encoder`, which is what "we are not sending" looks like.
        // `started` stays false, so a key pasted after this wakes it and tries
        // again — which is the whole of DSK-1's second half.
        rtmp = 'idle';
        emitHealth();
      } finally {
        starting = false;
      }
    };

    void attemptStart();

    // A key reaching Rust is an EVENT this component has to hear. Without this
    // the paste above changes a fact nothing re-reads — the same shape as the
    // controller that resolved camera status correctly and still showed a stale
    // screen because nothing re-rendered it.
    // SCOPED TO THIS EVENT. The subscription is notified for every event's
    // paste, exactly like `encoder-health-bus`, so the reader is what narrows it
    // — a module-level singleton outlives a route change, and without this a
    // paste on one wedding's controller would fire a start attempt for the
    // wedding whose page happened to be open before it.
    const offKeyHeld = subscribeStreamKeyHeld(() => {
      if (readStreamKeyHandoffs(eventId) === 0) return;
      void attemptStart();
    });

    return () => {
      cancelled = true;
      offKeyHeld();
      unlisten?.();
      offConfig();
      offMedia();
      offStats();
      canvas.stop();
      void session.stop();
      canvasRef.current = null;
      sessionRef.current = null;
      publishEncoderHealth(eventId, null);
    };
    // `air` and `overlays` are server-resolved and stable for a render; the
    // canvas is deliberately NOT torn down and rebuilt when their object
    // identity changes, which would restart the encoder mid-ceremony.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRun, eventId]);

  return null;
}
