'use client';

/**
 * front-door-pitch-hero.tsx — the photo half of the signed-out pitch.
 *
 * Owner 2026-10-28, approved from `prototypes/front-door-pitch-2026-10-28.html`
 * ("set na yan"): one photo, one line, one button, with the photo and the one
 * word in the headline turning through the kinds of event we run — because
 * *"we have so many events that we can cater"*.
 *
 * 🔑 THE FIRST BYTE SAYS "event". The server HTML (and so Google's OAuth
 * reviewer and every crawler) reads "Your event, beautifully handled." The
 * word only starts turning after hydration, and never under reduced motion.
 *
 * 🧭 NO PILL ROW. The prototype had a row of event-type chips under the button;
 * house rule (owner 2026-09-28) is that a set of choices is never a pill row,
 * and these were not a choice anyway — so the photo turns on its own.
 *
 * Photos are the shipped `public/event-types/*` set the create-event picker
 * already uses. They are decoration (`alt=""`, aria-hidden): the headline
 * carries the meaning.
 */
import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';

/** `word` is what the headline says; the first entry is what the server renders. */
export const PITCH_SLIDES = [
  { word: 'event', photo: '/event-types/wedding.webp' },
  { word: 'debut', photo: '/event-types/debut.webp' },
  { word: 'christening', photo: '/event-types/christening.webp' },
  { word: 'birthday', photo: '/event-types/birthday.webp' },
  { word: 'reunion', photo: '/event-types/reunion.webp' },
  { word: 'company event', photo: '/event-types/corporate.webp' },
  { word: 'wedding', photo: '/event-types/wedding.webp' },
] as const;

const TURN_MS = 4200;

export function FrontDoorPitchHero({ children }: { children: ReactNode }) {
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setAt((i) => (i + 1) % PITCH_SLIDES.length), TURN_MS);
    return () => window.clearInterval(id);
  }, []);

  const photos = [...new Set(PITCH_SLIDES.map((s) => s.photo))];
  const shown = PITCH_SLIDES[at]!.photo;

  return (
    <div className="fd-pitch-hero">
      <div className="fd-pitch-slides" aria-hidden="true">
        {photos.map((src, i) => (
          <div key={src} className="fd-pitch-slide" data-on={src === shown ? 'true' : undefined}>
            <Image src={src} alt="" fill priority={i === 0} sizes="(min-width: 1024px) 75vw, 100vw" />
          </div>
        ))}
      </div>
      <div className="fd-pitch-copy">
        {/*
          THE PAGE'S ONLY <h1>. The name stays inside it, typed "Setnayan" — Google's
          OAuth brand review (2026-10-22), held by app/google-can-verify-the-home-page.test.ts.
        */}
        <h1 id="fd-opening-h" className="fd-opening-h1">
          <span className="fd-opening-kick">Setnayan</span>
          <span className="sr-only">: </span>
          Your{' '}
          <span key={at} className="fd-pitch-word">
            {PITCH_SLIDES[at]!.word}
          </span>
          , <br />
          beautifully handled.
        </h1>
        {children}
      </div>
    </div>
  );
}
