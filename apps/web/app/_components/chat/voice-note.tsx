'use client';

/**
 * 🎤 A VOICE NOTE IN A BUBBLE — play, its bars, its length (Unichat H1; approved prototype v3, DECISION_LOG 2026-11-20;
 * drawing `.vn`: a round play button, twelve bars, "0:07").
 *
 * 🔒 `url` is ALWAYS `/api/chat/attachment/<message_id>` — the same route every chat file is read through, which
 * re-proves the listener is in the thread on every request. Nothing is fetched until Play is pressed.
 *
 * One note plays at a time. A note that will not play SAYS SO — a silent button would read as an empty recording.
 */
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { voiceLength } from '@/lib/chat-message-extras';

/** The drawing's twelve bar heights, in px. */
const BARS = [8, 14, 20, 12, 18, 24, 10, 16, 22, 12, 18, 8] as const;
export const VOICE_NOT_PLAYED = 'Couldn’t play this voice note. Try again.';

let nowPlaying: HTMLAudioElement | null = null;

export function VoiceNote({ url, seconds, mine }: { url: string; seconds: number | null; mine: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const total = Math.max(1, seconds ?? 1);

  useEffect(
    () => () => {
      const a = audio.current;
      if (!a) return;
      a.pause();
      if (nowPlaying === a) nowPlaying = null;
      audio.current = null;
    },
    [],
  );

  const toggle = () => {
    let a = audio.current;
    if (a && playing) {
      a.pause();
      return;
    }
    if (!a) {
      a = new Audio(url);
      a.preload = 'auto';
      a.addEventListener('play', () => setPlaying(true));
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('ended', () => {
        setPlaying(false);
        setAt(0);
      });
      a.addEventListener('timeupdate', () => setAt(audio.current?.currentTime ?? 0));
      a.addEventListener('error', () => {
        setPlaying(false);
        setFailed(true);
      });
      audio.current = a;
    }
    if (nowPlaying && nowPlaying !== a) nowPlaying.pause();
    nowPlaying = a;
    setFailed(false);
    void a.play().catch(() => {
      setPlaying(false);
      setFailed(true);
    });
  };

  const lit = playing || at > 0 ? Math.ceil((Math.min(at, total) / total) * BARS.length) : BARS.length;
  return (
    <span className="block" data-chat-voice={playing ? 'playing' : 'idle'}>
      <span className="inline-flex items-center gap-2 align-middle">
        <button
          type="button"
          onClick={toggle}
          aria-label={`${playing ? 'Pause' : 'Play'} voice note, ${voiceLength(total)}`}
          aria-pressed={playing}
          className="sn-press -my-1.5 -ml-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full"
          data-chat-voice-play=""
        >
          <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full ${mine ? 'bg-white text-sn-accent' : 'bg-ink text-white'}`}>
            {playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} /> : <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />}
          </span>
        </button>
        <span aria-hidden className="inline-flex h-6 items-center gap-0.5">
          {BARS.map((h, i) => (
            <i key={i} className={`w-[3px] rounded-full bg-current ${i < lit ? 'opacity-90' : 'opacity-35'}`} style={{ height: h }} />
          ))}
        </span>
        <span className="text-[13px] tabular-nums">{voiceLength(playing || at > 0 ? at : total)}</span>
      </span>
      {failed ? (
        <span role="alert" className="mt-1 block text-[12px]" data-chat-voice-failed="">
          {VOICE_NOT_PLAYED}
        </span>
      ) : null}
    </span>
  );
}
