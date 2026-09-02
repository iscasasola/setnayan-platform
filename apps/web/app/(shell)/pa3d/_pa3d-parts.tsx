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

  /* ⚠ THESE CLIPS ARE HALF EMPTY, AND IT IS NOT A CSS PROBLEM.
     Measured by drawing a frame to a canvas and scanning it: content ends at
     x=229 of 460 — EXACTLY half — on every clip tested (papic, mood-board,
     indoor-blueprint, custom-qr-guest, save-the-date). The deployed
     `papic.mp4` is byte-identical to the repo's, so `/papic` has been showing
     a half-grey film in its "this is all of it" section too. That is a bug in
     the capture pipeline (`scripts/capture-demo-videos.mjs`), reported
     separately — fixing it here would be fixing it in the wrong place.
     
     Until the assets are recaptured, this frame CROPS to the live half: the
     element is rendered at double the window's width and pinned left, so the
     grey never enters the box. Recapturing the clips full-width makes this
     crop harmless (it would simply show the left half of a full frame), so
     this does not have to be unwound in lock-step. */
  return (
    <div className="relative h-[240px] w-[124px] flex-none overflow-hidden rounded-xl border border-[var(--m-line)] sm:h-[260px] sm:w-[136px]">
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
        className="absolute left-0 top-0 h-auto w-[248px] max-w-none sm:w-[272px]"
      />
    </div>
  );
}
