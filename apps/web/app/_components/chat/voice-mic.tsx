'use client';

/**
 * 🎤 THE MIC IN THE TEXT BOX — hold to record, slide left to cancel, release to send (Unichat H1; approved prototype
 * v3, DECISION_LOG 2026-11-20: "Empty box: the arrow is a mic. Hold to record, slide left to cancel.").
 *
 * It stands where Send stands while the box is empty, and hands the composer ONE finished file and its length; the
 * composer sends it down the same road as every chat file (`prepareChatFile` → `/api/upload` → the send action) — no
 * second upload path. While recording, the box itself shows the time and "Slide left to cancel".
 *
 * From a keyboard: Enter or Space starts, and the same key again sends (Escape cancels) — a hold is a pointer's gesture.
 *
 * Everything that can stop a recording SAYS SO, through `onHint`: no microphone, permission refused, a tap that was
 * too short. A mic that quietly did nothing would read as a note that was sent.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Mic } from 'lucide-react';

import {
  CHAT_VOICE_CANCEL_PX,
  CHAT_VOICE_MAX_SECONDS,
  CHAT_VOICE_MIN_MS,
  pickVoiceMime,
  voiceFileName,
  voiceLength,
  voiceMimeOf,
} from '@/lib/chat-message-extras';
import type { StreamLike } from '@/lib/camera-comes-back';
import { useCameraThatComesBack } from '@/lib/use-camera-that-comes-back';

export const VOICE_HOLD_HINT = 'Hold the mic to record a voice note.';
export const VOICE_MIC_REFUSED = 'Allow the microphone for Setnayan to record a voice note.';
export const VOICE_NOT_SUPPORTED = 'This browser can’t record a voice note.';
export const VOICE_NOT_RECORDED = 'Couldn’t record that. Try again.';
export const VOICE_MIC_TAKEN = 'The microphone stopped. Hold the mic to record again.';

/** Can this browser record at all? Asked after mount (never during the server render). */
export function canRecordVoice(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    pickVoiceMime((m) => window.MediaRecorder.isTypeSupported(m)) !== null
  );
}

type Recording = {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  t0: number;
  startX: number | null;
  cancel: boolean;
  send: boolean;
  ms: number;
  tick: ReturnType<typeof setInterval>;
};

export function VoiceMic({
  onSend,
  onHint,
  overlayHost,
  className = '',
}: {
  /** One finished recording: the file (its type already the plain `audio/…`) and its length in whole seconds. */
  onSend: (file: File, seconds: number) => void;
  /** Words for the person when nothing was recorded, or `null` to clear them when a recording starts. */
  onHint: (words: string | null) => void;
  /** The message box (`[data-chat-message-box]`, positioned) — the recording line is drawn over it. */
  overlayHost: HTMLElement | null;
  className?: string;
}) {
  const rec = useRef<Recording | null>(null);
  const holding = useRef(false);
  const starting = useRef(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [cancelArmed, setCancelArmed] = useState(false);
  // The latest callbacks, without re-binding the recorder's own handlers.
  const sendRef = useRef(onSend);
  const hintRef = useRef(onHint);
  sendRef.current = onSend;
  hintRef.current = onHint;

  const finish = useCallback((r: Recording) => {
    clearInterval(r.tick);
    r.stream.getTracks().forEach((t) => t.stop());
    if (rec.current === r) rec.current = null;
    setSeconds(null);
    setCancelArmed(false);
    if (!r.send || r.cancel) return;
    if (r.ms < CHAT_VOICE_MIN_MS) {
      hintRef.current(VOICE_HOLD_HINT);
      return;
    }
    const mime = voiceMimeOf(r.recorder.mimeType);
    const blob = mime ? new Blob(r.chunks, { type: mime }) : null;
    if (!mime || !blob || blob.size === 0) {
      hintRef.current(VOICE_NOT_RECORDED);
      return;
    }
    const length = Math.max(1, Math.min(CHAT_VOICE_MAX_SECONDS, Math.round(r.ms / 1000)));
    sendRef.current(new File([blob], voiceFileName(mime), { type: mime }), length);
  }, []);

  const end = useCallback((send: boolean) => {
    const r = rec.current;
    if (!r || r.recorder.state === 'inactive') return;
    r.send = send;
    r.ms = Date.now() - r.t0;
    try {
      r.recorder.stop(); // → onstop → finish
    } catch {
      r.send = false;
      finish(r);
    }
  }, [finish]);

  const begin = useCallback(
    async (startX: number | null) => {
      if (starting.current || rec.current) return;
      const type = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' ? pickVoiceMime((m) => window.MediaRecorder.isTypeSupported(m)) : null;
      if (!type || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        hintRef.current(VOICE_NOT_SUPPORTED);
        return;
      }
      hintRef.current(null);
      starting.current = true;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        starting.current = false;
        holding.current = false;
        hintRef.current(VOICE_MIC_REFUSED);
        return;
      }
      starting.current = false;
      // Released while the browser was still asking for the microphone: that was a tap.
      if (!holding.current) {
        stream.getTracks().forEach((t) => t.stop());
        hintRef.current(VOICE_HOLD_HINT);
        return;
      }
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: type });
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        holding.current = false;
        hintRef.current(VOICE_NOT_SUPPORTED);
        return;
      }
      const r: Recording = {
        stream,
        recorder,
        chunks: [],
        t0: Date.now(),
        startX,
        cancel: false,
        send: false,
        ms: 0,
        tick: setInterval(() => {
          const elapsed = Math.floor((Date.now() - r.t0) / 1000);
          setSeconds(elapsed);
          // The longest note sends itself — nothing recorded is thrown away at the cap.
          if (elapsed >= CHAT_VOICE_MAX_SECONDS) {
            holding.current = false;
            end(true);
          }
        }, 250),
      };
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) r.chunks.push(e.data);
      };
      recorder.onstop = () => finish(r);
      recorder.onerror = () => {
        r.send = false;
        hintRef.current(VOICE_NOT_RECORDED);
        finish(r);
      };
      rec.current = r;
      setSeconds(0);
      recorder.start();
    },
    [end, finish],
  );

  // Leaving the chat mid-recording throws it away and frees the microphone.
  useEffect(
    () => () => {
      holding.current = false;
      const r = rec.current;
      if (!r) return;
      r.send = false;
      clearInterval(r.tick);
      try {
        if (r.recorder.state !== 'inactive') r.recorder.stop();
      } catch {
        /* already stopped */
      }
      r.stream.getTracks().forEach((t) => t.stop());
      rec.current = null;
    },
    [],
  );

  // 🎙 THE MIC THAT IS TAKEN AWAY SAYS SO (lib/every-camera-comes-back.test.ts). iOS, a call or a trip to the home
  // screen can end or mute the microphone mid-note; recorded on, the note would be silence that reads as sent. The
  // shared watch reads the MIC's track (it watches `getVideoTracks`, so the adapter hands it the audio ones). A
  // voice note cannot be "reopened" mid-hold, so its restart ends the note unsent and tells the person; the next
  // hold opens the mic afresh. A window resize is not the mic's business and is ignored.
  const micStream = useRef<StreamLike | null>(null);
  micStream.current = rec.current ? { getVideoTracks: () => rec.current?.stream.getAudioTracks() ?? [] } : null;
  useCameraThatComesBack({
    streamRef: micStream,
    live: seconds !== null,
    restart: (reason) => {
      if (reason === 'resize') return;
      holding.current = false;
      const r = rec.current;
      if (!r) return;
      r.cancel = true;
      end(false);
      hintRef.current(VOICE_MIC_TAKEN);
    },
  });

  const recording = seconds !== null;
  const pointer = {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault(); // the keyboard stays as it is; no text is selected under a long press
      holding.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer that cannot be captured still records */
      }
      void begin(e.clientX);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
      const r = rec.current;
      if (!r || r.startX === null) return;
      const armed = r.startX - e.clientX > CHAT_VOICE_CANCEL_PX;
      if (armed !== r.cancel) {
        r.cancel = armed;
        setCancelArmed(armed);
      }
    },
    onPointerUp: () => {
      if (!holding.current) return;
      holding.current = false;
      end(true);
    },
    onPointerCancel: () => {
      holding.current = false;
      end(false);
    },
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.repeat) return;
    if (e.key === 'Escape' && rec.current) {
      e.preventDefault();
      holding.current = false;
      end(false);
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (rec.current) {
      holding.current = false;
      end(true);
    } else {
      holding.current = true;
      void begin(null);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={recording ? 'Recording a voice note — release to send' : 'Hold to record a voice note'}
        aria-pressed={recording}
        {...pointer}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        className={`h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-full [-webkit-touch-callout:none] ${recording ? 'bg-sn-accent text-sn-on-accent' : 'text-ink hover:bg-ink/[0.05]'} ${className}`}
        data-chat-voice-mic={recording ? (cancelArmed ? 'cancel' : 'recording') : 'idle'}
      >
        <Mic aria-hidden className="h-6 w-6" strokeWidth={1.9} />
      </button>
      {recording && overlayHost
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-0 z-[1] flex items-center gap-2 rounded-2xl bg-[color:var(--m-paper-2)] px-3.5 text-[15px] text-ink"
              data-chat-voice-recording={cancelArmed ? 'cancel' : 'on'}
            >
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: 'rgb(var(--color-danger))' }} />
              <span className="tabular-nums">{voiceLength(seconds)}</span>
              <span className="min-w-0 flex-1 truncate text-right text-[13px] text-[color:var(--m-slate-2)]">
                {cancelArmed ? 'Release to cancel' : 'Slide left to cancel'}
              </span>
            </div>,
            overlayHost,
          )
        : null}
    </>
  );
}
