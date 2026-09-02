'use client';

/**
 * The parts that stand the room up.
 *
 * ─── WHY THIS REPLACED A PHOTO RAIL ───────────────────────────────────────
 * Owner 2026-09-02: *"the room, hours later is like a photo gallery. the goal
 * of 3D plan is to create the interactive environment for the different parts
 * it is integrated to. letting them see their virtual reception."*
 *
 * The rail that used to sit here was eight real photographs of the sample
 * wedding drifting past. It was attractive and it sold the wrong product: a
 * gallery of somebody's wedding day argues for photography. **3D Plan is the
 * integrative surface** — the seat plan, the venue shape, the mood board and
 * the guest list stop being four separate screens and become one room you can
 * walk. That is the claim, so this section shows the PARTS arriving, not a
 * wedding that already happened.
 *
 * ─── THE FILMS ARE THE REAL APP, WHICH IS THE WHOLE POINT ─────────────────
 * Each clip under `public/add-ons/demo/` is a recording of the same live scene
 * that Studio card renders (see that folder's README) — never a hand-made
 * mock-up, so it cannot drift from the product. Three of them happen to be
 * exactly the inputs this page is arguing about, already in the repo.
 *
 * ⚠ AUTOPLAY IS A POLICY, NOT A GUARANTEE — the lesson `_papic-film.tsx`
 * documents and this file inherits deliberately. A bare `<video autoPlay>` is
 * correct until a browser refuses, and then it is a still frame with no
 * control on it: dead motion on a section whose entire job is to move. So the
 * `play()` promise is caught, and a refusal hands the viewer real controls.
 */

import { useEffect, useRef, useState } from 'react';

export type Part = {
  /** Slug under `public/add-ons/demo/` — the .mp4 and .jpg share it. */
  slug: string;
  /** What this part IS to the couple, in their words. */
  title: string;
  /** What it becomes once the room stands up. One line. */
  line: string;
};

export function PartsFilms({ parts }: { parts: ReadonlyArray<Part> }) {
  return (
    <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {parts.map((p) => (
        <li key={p.slug} className="pa3d-lift overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-paper)]">
          <div className="flex justify-center bg-[var(--m-paper-2)] px-4 pt-4">
            <PartFilm slug={p.slug} title={p.title} />
          </div>
          <div className="px-4 pb-4 pt-3">
            <h3 className="font-serif text-[1.02rem] text-[var(--m-ink)]">{p.title}</h3>
            <p className="mt-1 text-[0.9rem] text-[var(--m-slate-2)]">{p.line}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PartFilm({ slug, title }: { slug: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsControls, setNeedsControls] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    // `play()` REJECTS when the policy refuses. A bare call swallows that and
    // leaves a still frame nobody can start.
    void v
      .play()
      .then(() => {
        if (!cancelled) setNeedsControls(false);
      })
      .catch(() => {
        if (!cancelled) setNeedsControls(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* The clip is a 9:19 phone recording (460×972), so the frame is its own
     ratio — nothing is cropped or letterboxed and it reads as what it is: the
     app, running on a phone.

     🔑 THIS USED TO CROP TO THE LEFT HALF, and the reason is worth keeping:
     every clip under public/add-ons/demo shipped three quarters empty, because
     the recorder composited a 230×486 page into a 460×972 canvas and padded
     the rest (Playwright only ever scales a page DOWN). Fixed at the source in
     #5109 and the clips recaptured in #5119 — measured here before the crop
     was removed: the right half of a frame went from 3,403 bytes of flat grey
     to 29,773 bytes of real UI. `lint-demo-capture-geometry` guards the cause,
     so this can go back to being a plain frame. */
  return (
    <div className="aspect-[460/972] w-[124px] flex-none overflow-hidden rounded-xl border border-[var(--m-line)] sm:w-[136px]">
      <video
        ref={ref}
        src={`/add-ons/demo/${slug}.mp4`}
        poster={`/add-ons/demo/${slug}.jpg`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={needsControls}
        aria-label={`${title}, running in the app`}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
