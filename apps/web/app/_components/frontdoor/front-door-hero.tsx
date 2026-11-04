'use client';

/**
 * front-door-hero.tsx — the moving half of the front page's hero: the six crossfading photos, the
 * "Which event?" picker and the word that turns in the <h1>.
 *
 * Ported from `prototypes/front_page_2026-11-04.html` (the hero script). One 5-second beat: the photo
 * crossfades, the word fades out and back in as the next type. Picking from the dropdown jumps there
 * and stops the turning (the prototype's `pick.onchange`). Under reduced motion nothing turns by
 * itself and the word swaps without a fade.
 *
 * 🧊 THE HEADLINE IS SERVER MARKUP. `<HeroWord>` renders the first slide's word on the server, so the
 * <h1> a crawler (and Google's OAuth review) reads is the whole sentence with "Setnayan" in it, before
 * any script runs. The copy is passed through `HeroStage` as children and never enters this bundle.
 *
 * 💸 ONLY THE FIRST PHOTO LOADS WITH THE PAGE. The other five are given their `src` once the page has
 * settled (idle), so the first screen pays for one image, not six.
 *
 * ⏭ NOT PORTED: the prototype's `<video>` slots. They point at the Higgsfield clips
 * (`hero-wedding-16x9.mp4` …), which do not exist yet; the prototype itself falls back to these stills
 * with the slow push-in. When the clips are made, they join each slide here.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { marketingPhoto } from '@/lib/front-page-photos';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { HeroSlide } from './front-door-landing-data';

const LOOP_MS = 5000;
/** The word's fade, matched to `.fl-word`'s transition in front-door-landing.css. */
const WORD_FADE_MS = 260;

const HeroIndex = createContext<{ word: string; out: boolean }>({ word: '', out: false });

/** The turning word inside the <h1>. */
export function HeroWord() {
  const { word, out } = useContext(HeroIndex);
  return <em className={out ? 'fl-word fl-word-out' : 'fl-word'}>{word}</em>;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function HeroStage({ slides, children }: { slides: readonly HeroSlide[]; children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [word, setWord] = useState(slides[0]?.word ?? '');
  const [out, setOut] = useState(false);
  /** Have the other photos been given their `src` yet? */
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef(0);

  const go = useCallback(
    (next: number) => {
      const slide = slides[next];
      if (!slide) return;
      current.current = next;
      setIndex(next);
      if (fade.current) clearTimeout(fade.current);
      if (prefersReducedMotion()) {
        setWord(slide.word);
        return;
      }
      setOut(true);
      fade.current = setTimeout(() => {
        setWord(slide.word);
        setOut(false);
      }, WORD_FADE_MS);
    },
    [slides],
  );

  useEffect(() => {
    const arm = () => setArmed(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(arm);
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(arm, 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion() || slides.length < 2) return;
    timer.current = setInterval(() => go((current.current + 1) % slides.length), LOOP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (fade.current) clearTimeout(fade.current);
    };
  }, [go, slides.length]);

  function pick(next: number) {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setArmed(true);
    go(next);
  }

  return (
    <HeroIndex.Provider value={{ word, out }}>
      <div className="fl-hero-photo" aria-hidden="true">
        {slides.map((s, i) => (
          <div key={s.key} className={i === index ? 'fl-slide fl-slide-on' : 'fl-slide'}>
            {i === 0 || armed ? (
              // A plain <img>, not next/image: these are already cropped and compressed to their slot,
              // and the desktop rule sizes them by their own height (`width: auto`), which `fill` cannot do.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={marketingPhoto(s.photo)}
                alt=""
                data-dr={s.dr ? '' : undefined}
                style={{ ['--dr' as string]: s.dr, ['--px' as string]: s.px }}
                fetchPriority={i === 0 ? 'high' : 'low'}
                decoding="async"
              />
            ) : null}
          </div>
        ))}
      </div>
      {/* House rule: any set of choices is ONE dropdown — the shared PickMenu, never a raw <select>. */}
      <div className="fl-picker">
        <PickMenu
          label="Which event?"
          value={String(index)}
          options={slides.map((s, i) => ({ key: String(i), label: s.label }))}
          onPick={(k) => pick(Number(k))}
          dataAttr="data-fl-hero-pick"
        />
      </div>
      {children}
    </HeroIndex.Provider>
  );
}
