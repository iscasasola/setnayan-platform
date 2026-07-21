'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Papic · /papic/lightcheck — THROWAWAY capability + frame-rate probe.
 *
 * Implements M1 and M3 of Papic_Low_Light_Council_Verdict_2026-07-21.md § 7.1.
 *
 * WHY THIS EXISTS. The low-light plan rests on four claims the council could not
 * verify from any primary source, and which no lens was allowed to assert from
 * memory: does iOS Safari expose `torch`? `exposureCompensation`? `iso`? Does
 * constraining frameRate lengthen exposure? Is `ImageCapture` real on this
 * device? Every downstream estimate — flash, frame stacking, night mode — is
 * gated on the answers. This page produces them in about a minute, on a real
 * handset, for free.
 *
 * M3 matters most and is the cheapest: **delivered FPS in a genuinely dark room**
 * decides whether frame stacking is physically possible at all. If auto-exposure
 * drops the stream to ~8 fps, a 300 ms capture window yields 2–3 frames and the
 * whole stacking approach is dead before anyone costs it.
 *
 * ── DELIBERATE NON-GOALS (do not "improve" these) ────────────────────────
 *   • NOT on the capture path. It opens its own stream and shares no code with
 *     lib/use-papic-camera.ts, so it can never affect a live event. It only
 *     COPIES that hook's constraints (HI_RES 2560×1440, facingMode ideal) so the
 *     numbers describe the real capture, not a synthetic one.
 *   • NO upload, NO points gate, NO persistence. Nothing leaves the device
 *     except what the operator pastes back themselves.
 *   • Throwaway. Delete it once the numbers are recorded in the verdict.
 *
 * The torch test is a live `applyConstraints` on an already-acquired track —
 * never a constraint at acquisition time — mirroring how `applyZoom` is done in
 * the hook, because the known WebKit failure mode is the camera PAUSING when
 * torch is enabled.
 */

type Row = { k: string; v: string };

// ImageCapture is not in the TS DOM lib and is absent on iOS Safari.
type ImageCaptureCtor = new (track: MediaStreamTrack) => {
  takePhoto: () => Promise<Blob>;
};

// `torch` is absent from the DOM lib's MediaTrackConstraintSet. The repo's
// existing pattern for exactly this (lib/use-papic-camera.ts:71, `zoom`) is a
// narrow local type rather than an `any` — matched here.
type TorchConstraintSet = MediaTrackConstraintSet & { torch: boolean };

function fmt(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function LightcheckClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  const say = useCallback((m: string) => setLog((l) => [...l, m]), []);

  const start = useCallback(async () => {
    setBusy(true);
    setRows([]);
    setLog([]);
    try {
      // Same constraints as lib/use-papic-camera.ts:200 — the numbers must
      // describe the real capture, not a synthetic one.
      const HI_RES = { width: { ideal: 2560 }, height: { ideal: 1440 } } as const;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, ...HI_RES },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('no video track');
      trackRef.current = track;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setLive(true);

      const supported = navigator.mediaDevices.getSupportedConstraints() as Record<string, unknown>;
      const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
      const settings = (track.getSettings?.() ?? {}) as Record<string, unknown>;

      const out: Row[] = [
        { k: 'userAgent', v: navigator.userAgent },
        { k: '— settings —', v: '' },
        { k: 'width × height', v: `${fmt(settings.width)} × ${fmt(settings.height)}` },
        { k: 'frameRate', v: fmt(settings.frameRate) },
        { k: '— the four unverified —', v: '' },
        { k: 'torch (capability)', v: fmt(caps.torch) },
        { k: 'torch (supported-constraint)', v: fmt(supported.torch) },
        { k: 'exposureCompensation', v: fmt(caps.exposureCompensation) },
        { k: 'exposureMode', v: fmt(caps.exposureMode) },
        { k: 'iso', v: fmt(caps.iso) },
        { k: 'frameRate (capability range)', v: fmt(caps.frameRate) },
        { k: 'ImageCapture (constructor)', v: typeof (window as unknown as { ImageCapture?: unknown }).ImageCapture },
        { k: '— everything else —', v: '' },
        { k: 'focusMode', v: fmt(caps.focusMode) },
        { k: 'whiteBalanceMode', v: fmt(caps.whiteBalanceMode) },
        { k: 'zoom', v: fmt(caps.zoom) },
        { k: 'getSupportedConstraints()', v: JSON.stringify(supported) },
        { k: 'getCapabilities()', v: JSON.stringify(caps) },
        { k: 'getSettings()', v: JSON.stringify(settings) },
      ];
      setRows(out);

      // ImageCapture must be ATTEMPTED, not inferred — the council's § 10.9:
      // getCapabilities() does not answer the ImageCapture question.
      const IC = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
      if (typeof IC !== 'function') {
        say('ImageCapture: constructor absent (expected on iOS Safari).');
      } else {
        try {
          const blob = await new IC(track).takePhoto();
          say(`ImageCapture.takePhoto(): OK — ${blob.size} bytes, ${blob.type}`);
        } catch (e) {
          say(`ImageCapture.takePhoto(): THREW — ${(e as Error).message}`);
        }
      }
      say('Camera live. Now run the frame-rate test IN A GENUINELY DARK ROOM.');
    } catch (e) {
      say(`getUserMedia failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [say]);

  // M3 — delivered FPS. requestVideoFrameCallback counts REAL decoded frames;
  // rAF would count paints and overstate it. Absent on some browsers, so we
  // report the fallback honestly rather than silently measuring the wrong thing.
  const measureFps = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    const anyV = v as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (typeof anyV.requestVideoFrameCallback !== 'function') {
      say('requestVideoFrameCallback unavailable — cannot count real frames on this browser.');
      return;
    }
    setBusy(true);
    say('Counting frames for 5s…');
    let n = 0;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        n += 1;
        if (performance.now() - t0 >= 5000) return resolve();
        anyV.requestVideoFrameCallback!(tick);
      };
      anyV.requestVideoFrameCallback!(tick);
    });
    const secs = (performance.now() - t0) / 1000;
    const fps = n / secs;
    const in300ms = fps * 0.3;
    say(
      `FPS: ${fps.toFixed(1)} (${n} frames / ${secs.toFixed(1)}s) → ` +
        `~${in300ms.toFixed(1)} frames per 300ms window. ` +
        (in300ms >= 8
          ? 'Stacking is viable here.'
          : 'STACKING IS NOT VIABLE at this frame rate — fewer than 8 frames per window.'),
    );
    setBusy(false);
  }, [say]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
    if (!caps.torch) {
      say('torch: not in getCapabilities() on this device.');
      return;
    }
    try {
      // Live applyConstraints only — never at acquisition. Mirrors applyZoom.
      const on = !((track.getSettings?.() ?? {}) as Record<string, unknown>).torch;
      await track.applyConstraints({
        advanced: [{ torch: on } as TorchConstraintSet],
      });
      say(`torch → ${on ? 'ON' : 'OFF'} — applyConstraints resolved. Did the stream pause?`);
    } catch (e) {
      say(`torch applyConstraints REJECTED — ${(e as Error).message}`);
    }
  }, [say]);

  const stop = useCallback(() => {
    const v = videoRef.current;
    const s = v?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    trackRef.current = null;
    setLive(false);
    say('Camera stopped.');
  }, [say]);

  const copy = useCallback(() => {
    const text = [
      ...rows.filter((r) => r.v).map((r) => `${r.k}: ${r.v}`),
      '',
      ...log,
    ].join('\n');
    void navigator.clipboard?.writeText(text);
    say('Copied to clipboard.');
  }, [rows, log, say]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Papic light check</h1>
      <p className="mt-2 text-sm text-ink/65">
        Throwaway diagnostic. Opens its own camera, uploads nothing, stores nothing.
        Run it on a real phone <strong>in a genuinely dark room</strong>, then copy the
        results out.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={start} disabled={busy || live} className="rounded-md border border-ink/15 px-3 py-1.5 text-sm">
          Start camera
        </button>
        <button onClick={measureFps} disabled={busy || !live} className="rounded-md border border-ink/15 px-3 py-1.5 text-sm">
          Measure FPS (5s)
        </button>
        <button onClick={toggleTorch} disabled={busy || !live} className="rounded-md border border-ink/15 px-3 py-1.5 text-sm">
          Toggle torch
        </button>
        <button onClick={stop} disabled={!live} className="rounded-md border border-ink/15 px-3 py-1.5 text-sm">
          Stop
        </button>
        <button onClick={copy} disabled={!rows.length} className="rounded-md border border-ink/15 px-3 py-1.5 text-sm">
          Copy results
        </button>
      </div>

      <video ref={videoRef} playsInline muted className="mt-4 w-full rounded-lg bg-ink/5" />

      {log.length > 0 && (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-ink/[0.04] p-3 text-xs leading-relaxed">
          {log.join('\n')}
        </pre>
      )}

      {rows.length > 0 && (
        <table className="mt-4 w-full table-fixed text-xs">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.v ? '' : 'font-medium'}>
                <td className="w-1/2 break-words py-1 pr-2 align-top text-ink/60">{r.k}</td>
                <td className="w-1/2 break-all py-1 align-top">{r.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
