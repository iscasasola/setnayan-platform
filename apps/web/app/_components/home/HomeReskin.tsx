'use client';

/**
 * HomeReskin — the ELN-style homepage (client island).
 *
 * Faithful port of `03_Strategy/Home_ELN_Reskin_2026-06-28.html`
 * (owner-approved 2026-06-29). The no-scroll cinematic gate, the 5-pillar dock
 * that swaps the hero photo + copy, the scroll-snap sections, the per-pillar
 * interactive preview widgets, the kinetic feelings ticker, the Real Stories
 * cards, the glass nav, and the 4 overlays (Prices/Download/Vendors/Sign in).
 *
 * Pricing is NOT hardcoded — `pricing` arrives resolved from the live catalog
 * (see pricing-data.ts) and is threaded into the Prices overlay.
 *
 * Scroll lock toggles `hr-locked`/`hr-snap` on <html> and `hr-open` on the
 * .home-reskin root (the documentElement is the scroller, matching the
 * prototype). The class names are cleaned up on unmount so a client navigation
 * away never leaves the rest of the site scroll-locked.
 */

import { Fragment, cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { PILLARS, PILLAR_HEROES, PILLAR_SECTION_IDS, HOME_SCENE } from './pillars';
import type { OverlayId } from './HomeOverlays';
import type { PricingData } from './pricing-data';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { SetnayanAiHeroStory } from './setnayan-ai-story';
import { openConsentManager } from '@/lib/cookie-consent';
import dynamic from 'next/dynamic';

// The Sign-in / Prices / vendor / login overlays are CLOSED on first paint
// (`overlay` is null → HomeOverlays renders nothing) yet their code was
// statically imported into the homepage's first-load JS bundle. Load the chunk
// lazily after hydration so it's off the critical first-load path. ssr:false is
// safe because there is nothing to server-render while every overlay is closed.
// (Perf sweep 2026-07-02, finding #7.)
const HomeOverlays = dynamic(() => import('./HomeOverlays').then((m) => m.HomeOverlays), {
  ssr: false,
});

const HOME_HERO = {
  kick: 'Set na ’yan',
  title: (
    <>
      Keep your memories.
      <br />
      Plan your moments.
    </>
  ),
  sub: 'The independent hub to keep a lifetime of memories — and plan any event, free.',
};

/**
 * The manifesto, split into segments for the word-cascade ink reveal: each
 * word starts faint and rises to full ink, staggered left-to-right, when the
 * section scrolls into view. `b` = the bolded anchor words; `fin` = the
 * serif-italic finale that gets the gold underline sweep. The copy itself is
 * the owner-locked positioning statement — presentation only changes here.
 */
const MANIFESTO: Array<{ t: string; b?: boolean; fin?: boolean }> = [
  { t: 'Setnayan is where the memories of every event in your life are kept — the ones you' },
  { t: 'hold', b: true },
  { t: 'and the ones you' },
  { t: 'attend.', b: true },
  {
    t: 'Most tools you open for one event and close. This is the place your celebrations live, so you come back for the next one. Plan it, run it, remember it — and',
  },
  { t: 'keep it, for life.', fin: true },
];

const TICKER_WORDS = [
  'Joy',
  'Tears',
  'Laughter',
  'Vows',
  'Family',
  'The first dance',
  'Presence',
  'Wonder',
  'Togetherness',
  'Every moment',
];

const STORIES = [
  { g: 'hr-g1', lab: 'Edition 01 · Wedding', ti: 'Claire & Ice', su: 'La Castellana, Negros · December' },
  { g: 'hr-g2', lab: 'Edition 02 · Wedding', ti: 'Maria & Jose', su: 'A garden in Tagaytay' },
  { g: 'hr-g3', lab: 'Edition 03 · Debut', ti: 'Lena turns 18', su: 'A candlelit night in Cebu' },
  { g: 'hr-g4', lab: 'Edition 04 · Reunion', ti: 'The Reyes Reunion', su: 'Three generations, one long table' },
];

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Admin-uploaded homepage background videos (/admin/background-videos):
 *   • main      — the cinematic hero backdrop (slot 0), shown on the home scene.
 *   • pillars[] — the five dock "icon" videos in PILLAR_HEROES order
 *                 (Ala ala · Suri · Papic · Panood · 3D Plan — owner 2026-07-03;
 *                 slots are positional, so previously-uploaded videos keep
 *                 their slot and may need re-uploading to match). Each entry
 *                 is a URL or null (null → that tile / hero swap keeps its
 *                 gradient). A selected pillar's video also takes over the hero.
 */
export type HomeBgVideos = { main: string | null; pillars: (string | null)[] };

export function HomeReskin({
  pricing,
  bgVideos,
}: {
  pricing: PricingData;
  bgVideos?: HomeBgVideos;
}) {
  const mainVideo = bgVideos?.main ?? null;
  const pillarVideos = bgVideos?.pillars ?? [];
  const rootRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>(null);
  // Which dock pillar is selected (null = home scene). Drives the hero swap.
  const [activePillar, setActivePillar] = useState<number | null>(null);
  // Which feature card is selected per pillar widget (index into mocks).
  const [selFeat, setSelFeat] = useState<number[]>(() => PILLARS.map(() => 0));

  // ── Gate scroll-lock is driven PURELY by the `opened` state via an effect
  // below (never inside a setState updater — updaters must stay pure, and a rAF
  // scheduled inside one can be dropped when React replays it). The homepage IS
  // the no-scroll cinematic gate: it holds the viewport until opened. ──
  useEffect(() => {
    const html = document.documentElement;
    if (opened) {
      // gate is open: release the lock immediately, then enable scroll-snap a
      // tick later so the freshly-revealed content has laid out before snap
      // engages. setTimeout (not rAF) so it still fires in a backgrounded/hidden
      // tab, where rAF is throttled.
      html.classList.remove('hr-gate-closed');
      const t = window.setTimeout(() => html.classList.add('hr-snap'), 60);
      return () => window.clearTimeout(t);
    }
    // gate is closed (initial mount + after goHome): lock scroll, drop snap.
    html.classList.add('hr-gate-closed');
    html.classList.remove('hr-snap');
    return undefined;
  }, [opened]);

  useEffect(() => {
    // Safety: never leave the rest of the SPA scroll-locked after navigating away.
    return () => {
      document.documentElement.classList.remove('hr-gate-closed', 'hr-locked', 'hr-snap');
    };
  }, []);

  const openGate = useCallback((targetId?: string) => {
    const reduce = reduceMotion();
    setOpened(true);
    const dest = targetId
      ? document.getElementById(targetId)
      : document.getElementById('hr-content');
    // Defer until after the `opened` effect drops `hr-gate-closed` (unlocking
    // scroll) so scrollIntoView actually moves. setTimeout fires even when the
    // tab is backgrounded (rAF is throttled there).
    window.setTimeout(() => {
      dest?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, 70);
  }, []);

  // Logo = Home: restore hero, scroll to top, re-lock the gate.
  const goHome = useCallback(() => {
    const reduce = reduceMotion();
    setActivePillar(null);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    const relock = () => {
      // The `opened` effect re-adds hr-gate-closed + drops hr-snap.
      setOpened(false);
    };
    if (reduce) relock();
    else window.setTimeout(relock, 560);
  }, []);

  const heroLearn = useCallback(() => {
    if (activePillar === null) {
      openGate();
      return;
    }
    // Jump to the tile's MATCHING below-fold section. Product tiles (Papic ·
    // Panood · 3D Plan) carry a `feat` target: pre-select their feature card
    // in the Likha widget so the landing shows their preview, then center the
    // card in the carousel once the smooth scroll has settled.
    const hero = PILLAR_HEROES[activePillar];
    const feat = hero?.feat;
    if (feat) {
      setSelFeat((prev) => {
        const next = [...prev];
        next[feat.pillar] = feat.card;
        return next;
      });
      window.setTimeout(
        () => {
          const sec = document.getElementById(PILLAR_SECTION_IDS[feat.pillar] ?? '');
          const track = sec?.querySelector<HTMLElement>('.hr-pfeats');
          const card = track?.children[feat.card] as HTMLElement | undefined;
          if (track && card) {
            const target = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
            track.scrollTo({ left: Math.max(0, target), behavior: reduceMotion() ? 'auto' : 'smooth' });
          }
        },
        reduceMotion() ? 120 : 700,
      );
    }
    openGate(hero?.sectionId ?? undefined);
  }, [activePillar, openGate]);

  // ── Hero scene (cross-fade between two gradient layers, with optional video) ──
  // The home scene + each selected pillar can be an admin-uploaded looping
  // VIDEO (bgVideos) instead of the gradient: when a slot has a video it plays
  // under the cinematic overlays and both gradient layers fade out; otherwise
  // the gradient cross-fades in as before. The hero gracefully degrades to the
  // original gradient cinematic when no videos are published.
  const sceneARef = useRef<HTMLDivElement>(null);
  const sceneBRef = useRef<HTMLDivElement>(null);
  const sceneCur = useRef(0);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  const crossFade = useCallback((bg: string) => {
    const layers = [sceneARef.current, sceneBRef.current];
    const next = layers[1 - sceneCur.current];
    const prev = layers[sceneCur.current];
    if (next) {
      next.style.background = bg;
      next.style.opacity = '1';
    }
    if (prev) prev.style.opacity = '0';
    sceneCur.current = 1 - sceneCur.current;
  }, []);

  // Show the hero <video> backdrop (url) or hide it (null). Showing it fades
  // BOTH gradient layers out so the video reads; hiding it lets the caller
  // cross-fade a gradient back in.
  const showHeroVideo = useCallback((url: string | null) => {
    const v = heroVideoRef.current;
    if (url) {
      if (v) {
        if (v.dataset.src !== url) {
          v.src = url;
          v.dataset.src = url;
        }
        v.style.opacity = '1';
        void v.play?.()?.catch(() => {});
      }
      if (sceneARef.current) sceneARef.current.style.opacity = '0';
      if (sceneBRef.current) sceneBRef.current.style.opacity = '0';
    } else if (v) {
      v.style.opacity = '0';
      v.pause?.();
    }
  }, []);

  // Paint a scene by index (null = home): the slot's video wins, else gradient.
  const paintScene = useCallback(
    (index: number | null) => {
      const url = index === null ? mainVideo : pillarVideos[index] ?? null;
      if (url) {
        showHeroVideo(url);
      } else {
        showHeroVideo(null);
        crossFade(index === null ? HOME_SCENE : PILLAR_HEROES[index]?.photo ?? HOME_SCENE);
      }
    },
    [mainVideo, pillarVideos, showHeroVideo, crossFade],
  );

  // Initial paint: home scene. With a video, play it; without, set the gradient
  // directly (no fade-from-black on first load).
  useEffect(() => {
    if (mainVideo) showHeroVideo(mainVideo);
    else if (sceneARef.current) sceneARef.current.style.background = HOME_SCENE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPillar = useCallback(
    (i: number) => {
      const p = PILLAR_HEROES[i];
      if (!p) return;
      setActivePillar(i);
      paintScene(i);
    },
    [paintScene],
  );

  // The Setnayan AI story IS the hero (owner 2026-07-03: "we want that to be
  // the new background" — no takeover, no extra buttons; supersedes the PR
  // #2652 modal). Selecting the Suri tile paints its scene like every tile,
  // and the hero-mid renders the story text on top of the background; only
  // the original hero CTAs (Start planning · free + Learn more) remain. The
  // nav pop-up's "full story" action selects the tile + returns to the hero.
  const openStory = useCallback(() => {
    setOverlay(null); // the nav pop-up is open when this fires
    const i = PILLAR_HEROES.findIndex((p) => p.role === 'Setnayan AI');
    if (i >= 0) selectPillar(i);
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }, [selectPillar]);
  useEffect(() => {
    if (activePillar === null) paintScene(null);
  }, [activePillar, paintScene]);

  // ── Kinetic feelings ticker ──
  const tickerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!opened) return;
    const root = tickerRef.current;
    if (!root) return;
    const words = Array.from(root.querySelectorAll<HTMLElement>('.hr-word'));
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const mid = window.innerHeight / 2;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const w of words) {
        const r = w.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = w;
        }
        w.style.opacity = Math.max(0.14, 1 - d / (window.innerHeight * 0.55)).toFixed(3);
        w.classList.remove('hr-active');
      }
      if (best && bestD < window.innerHeight * 0.16) {
        best.classList.add('hr-active');
        best.style.opacity = '1';
      }
    };
    const onScroll = () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, [opened]);

  // ── Section entrance reveal ──
  // Toggles `hr-in` on each content section as it scrolls into view; the CSS
  // (gated behind prefers-reduced-motion: no-preference) staggers a rise-in
  // per direct child, and drives the manifesto's word cascade. Toggling BOTH
  // ways lets the choreography replay when a section re-enters.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const sections = Array.from(main.querySelectorAll<HTMLElement>(':scope > section'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.classList.toggle('hr-in', e.isIntersecting);
      },
      { threshold: 0.18 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // ── Drag-to-scroll for the feature carousels (native swipe on touch) ──
  const onCarouselPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const track = e.currentTarget;
    const startX = e.clientX;
    const startLeft = track.scrollLeft;
    let moved = false;
    const pid = e.pointerId;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        track.classList.add('hr-dragging');
        try {
          track.setPointerCapture(pid);
        } catch {
          /* noop */
        }
      }
      if (moved) track.scrollLeft = startLeft - dx;
    };
    const end = () => {
      track.classList.remove('hr-dragging');
      try {
        track.releasePointerCapture(pid);
      } catch {
        /* noop */
      }
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', end);
      track.removeEventListener('pointercancel', end);
      // swallow the click that follows a real drag
      if (moved) {
        const swallow = (ce: Event) => {
          ce.preventDefault();
          ce.stopPropagation();
          track.removeEventListener('click', swallow, true);
        };
        track.addEventListener('click', swallow, true);
      }
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
  }, []);

  // Click a feature card → swap that pillar widget's mock + center the card.
  const onSelFeat = useCallback(
    (pillarIdx: number, featIdx: number, card: HTMLElement) => {
      setSelFeat((prev) => {
        const next = [...prev];
        next[pillarIdx] = featIdx;
        return next;
      });
      const track = card.closest<HTMLElement>('.hr-pfeats');
      if (track) {
        const target = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
        track.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      }
    },
    [],
  );

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const hero = activePillar === null ? null : PILLAR_HEROES[activePillar];

  return (
    <div ref={rootRef} className={`home-reskin${opened ? ' hr-open' : ''}`}>
      {/* ── Floating glass nav ── */}
      <nav className="hr-nav">
        <button
          className="hr-logo hr-glass-dark"
          aria-label="Home"
          title="Home"
          onClick={goHome}
        >
          {/* Official Setnayan mark (filled glyph, paints in currentColor). The
              .hr-logo button drives color: #fff on the gate and var(--hr-ink)
              when the nav switches to the unlocked glass state, so the mark is
              white on the cinematic gate and ink once opened — the same adaptive
              behavior the old 3-dot placeholder had. */}
          <SetnayanMark className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="hr-links hr-glass-dark">
          {/* Setnayan AI was removed from the nav (owner 2026-07-03) — the Suri
              dock tile remains the entry point to the story takeover; the
              'setnayan-ai' overlay in HomeOverlays is dormant until an entry
              point returns. */}
          <button onClick={() => setOverlay('prices')}>Prices</button>
          <button onClick={() => setOverlay('download')}>Download</button>
          <button onClick={() => setOverlay('vendors')}>Vendors</button>
        </div>
        {/* Sign in → a popup overlay, consistent with Prices / Download /
            Vendors (owner 2026-06-30 "login should be like the rest of the
            upper menu — a popup"). The overlay hosts the REAL auth (Google +
            Apple via OAuthButtonRow / the desktop loopback variant, plus
            email/password — env-flag gated), wired to the same server actions
            as /login. Not a mockup. */}
        <button className="hr-signin hr-glass-dark" onClick={() => setOverlay('signin')}>
          Sign in
        </button>
      </nav>

      {/* ── HERO — fullscreen, scroll locked ── */}
      <section className="hr-hero" id="hr-hero">
        <div className="hr-film" aria-hidden="true">
          {/* Admin-uploaded looping backdrop (main / selected pillar video). Sits
              below the gradient layers; paintScene() fades the gradients out to
              reveal it. Hidden (opacity 0) until a published video is shown. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={heroVideoRef}
            className="hr-hero-video"
            muted
            loop
            playsInline
            // metadata (not auto): don't buffer the whole clip against LCP —
            // the src is injected post-hydration and the gradient scene is the
            // real LCP element, so the backdrop needn't pre-fetch its full
            // stream on first paint. (Perf sweep 2026-07-02, finding #24.)
            preload="metadata"
            aria-hidden="true"
            style={{ opacity: 0 }}
          />
          <div className="hr-scene" ref={sceneARef} />
          <div className="hr-scene" ref={sceneBRef} style={{ opacity: 0 }} />
          <div className="hr-bokeh" />
          <div className="hr-vignette" />
          <div className="hr-grain" />
          <div className="hr-scrim" />
        </div>

        <div className="hr-hero-mid">
          <div className="hr-kick">{hero ? `0${activePillar! + 1} · ${hero.name} — ${hero.role}` : HOME_HERO.kick}</div>
          <h1 className="hr-htitle">{hero ? hero.head : HOME_HERO.title}</h1>
          <p className="hr-hsub">{hero ? hero.desc : HOME_HERO.sub}</p>
          {/* Setnayan AI story-as-hero (owner 2026-07-03): pure TEXT on top of
              the background — no extra buttons; the original two CTAs below
              stay exactly as on every scene. */}
          {hero?.role === 'Setnayan AI' && (
            <SetnayanAiHeroStory pricing={pricing} onCompare={() => setOverlay('setnayan-ai')} />
          )}
          <div className="hr-hctas">
            <Link className="hr-pill-cta hr-glass-dark" href="/onboarding/wedding">
              Start planning&nbsp;·&nbsp;free
            </Link>
            <button className="hr-learn" onClick={heroLearn}>
              Learn more{' '}
              <span className="hr-arr">{hero ? '→' : '↓'}</span>
            </button>
          </div>
        </div>

        {/* The 5 pillars as the dock: each swaps the hero photo + its description.
            When a pillar slot has an admin-uploaded video it plays as the tile
            (the "icon" video); otherwise the gradient thumbnail shows. */}
        <div className="hr-dock">
          {PILLAR_HEROES.map((p, i) => {
            const tileVideo = pillarVideos[i] ?? null;
            return (
              <button
                key={p.id}
                className={`hr-w${activePillar === i ? ' hr-active' : ''}${tileVideo ? ' hr-has-video' : ''}`}
                style={{ backgroundImage: p.photo }}
                aria-label={`${p.name} · ${p.role}`}
                onClick={() => selectPillar(i)}
              >
                {tileVideo && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    className="hr-w-video"
                    src={tileVideo}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                  />
                )}
                <span className="hr-lab">
                  {p.name} · {p.role}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── CONTENT — revealed when the gate opens ── */}
      <main className="hr-content" id="hr-content" ref={mainRef}>
        <section className="hr-manifesto">
          <ManifestoReveal />
        </section>

        <section className="hr-ticker" ref={tickerRef}>
          {TICKER_WORDS.map((w) => (
            <div className="hr-word" key={w}>
              <span>{w}</span>
              <span className="hr-suf">, kept forever.</span>
            </div>
          ))}
        </section>

        {PILLARS.map((pillar, pi) => (
          <section className="hr-pillar" id={PILLAR_SECTION_IDS[pi]} key={pillar.widgetId}>
            {/* Editorial pillar header: serif numeral · hairline · Filipino
                name · small-caps English role, then the owner-authored hook
                as the headline. */}
            <header className="hr-phead">
              <div className="hr-pid">
                <span className="hr-pn2">{pillar.num}</span>
                <span className="hr-psep" aria-hidden="true" />
                <span className="hr-ptag">{pillar.tag}</span>
                <span className="hr-prole">{pillar.role}</span>
              </div>
              <h2 className="hr-pname">{pillar.name}</h2>
              <p className="hr-pdef">{pillar.def}</p>
            </header>
            <div className="hr-pwidget" id={pillar.widgetId}>
              <div className="hr-pw-frame">
                <div className="hr-pw-bar">
                  <span className="hr-d" />
                  <span className="hr-d" />
                  <span className="hr-d" />
                  <span className="hr-u">{pillar.barUrl}</span>
                </div>
                <div className="hr-pw-screen">
                  {pillar.mocks.map((mock, mi) => (
                    <Mock key={mi} active={selFeat[pi] === mi}>
                      {mock}
                    </Mock>
                  ))}
                </div>
              </div>
            </div>
            <div className="hr-pfeats" onPointerDown={onCarouselPointerDown}>
              {pillar.features.map((f, fi) => (
                <button
                  type="button"
                  className={`hr-pfeat${selFeat[pi] === fi && fi < pillar.mocks.length ? ' hr-sel' : ''}`}
                  key={f.fn}
                  onClick={(e) => {
                    // Only the first N cards (= number of mocks) swap a preview;
                    // trailing copy-only cards (e.g. "And it keeps growing") don't.
                    if (fi < pillar.mocks.length) onSelFeat(pi, fi, e.currentTarget);
                  }}
                >
                  <div className="hr-ic">{f.ic}</div>
                  <div className="hr-fn">{f.fn}</div>
                  <div className="hr-fl">{f.fl}</div>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* Real Stories gallery */}
        <section className="hr-stories">
          <div className="hr-pnum">Real Stories</div>
          <h2 className="hr-pname">The front-page story of your day.</h2>
          <p className="hr-pdef" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
            A living archive of real celebrations — each one unique in feeling, faith, and place.
          </p>
          <div className="hr-grid2">
            {STORIES.map((s) => (
              <Link href="/realstories" className="hr-storyc" key={s.ti}>
                <div className={`hr-img ${s.g}`} />
                <div className="hr-ov" />
                <div className="hr-c">
                  <div className="hr-lab">{s.lab}</div>
                  <div className="hr-ti">{s.ti}</div>
                  <div className="hr-su">{s.su}</div>
                  <span className="hr-lm hr-glass-dark">Read the story</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Pricing (free-floor; no hardcoded numbers — overlay reads catalog) */}
        <section className="hr-pillar" id="hr-pricing">
          <div className="hr-pnum">Pricing</div>
          <h2 className="hr-pname">Start free. Stay if it earns you.</h2>
          <p className="hr-pdef">
            No tricks at the floor — the free tier is a real planner, not a demo: the full Plano
            suite, the free Likha studio, a live event page, and Ala Ala basics. Add Suri and
            premium Likha when you want the brain and the polish. The full breakdown lives on the
            pricing page.
          </p>
          <button className="hr-btn-dark" onClick={() => setOverlay('prices')}>
            See pricing
          </button>
        </section>

        {/* Download band */}
        <section className="hr-pillar" id="hr-download">
          <div className="hr-pnum">Get the app</div>
          <h2 className="hr-pname">Laptop at midnight. Phone in the venue.</h2>
          <p className="hr-pdef">
            Tablet on the couch a year later, walking back through it. Browser, phone, tablet — the
            same plan and the same memories, in sync. One account, every screen.
          </p>
          <div className="hr-dlrow">
            <span className="hr-dltile hr-soon">
              <span className="hr-nm">iPhone &amp; iPad</span>
              <span className="hr-sb">App Store · soon</span>
            </span>
            <span className="hr-dltile hr-soon">
              <span className="hr-nm">Android</span>
              <span className="hr-sb">Google Play · soon</span>
            </span>
            <Link className="hr-dltile hr-live" href="/download">
              <span className="hr-nm">Mac</span>
              <span className="hr-sb">macOS · download</span>
            </Link>
            <span className="hr-dltile hr-soon">
              <span className="hr-nm">Windows</span>
              <span className="hr-sb">Installer · soon</span>
            </span>
          </div>
          <button className="hr-dlweb" onClick={() => setOverlay('download')}>
            ◍ Launch web app
          </button>
        </section>

        <section className="hr-close">
          <h2>
            One place that plans it, runs it, remembers it, and keeps it.{' '}
            <b>You’ll be back for the next one.</b> Set na ’yan.
          </h2>
          <Link className="hr-btn-dark" href="/onboarding/wedding">
            Start planning · free
          </Link>
        </section>

        <HomeFooter />
      </main>

      <HomeOverlays current={overlay} onClose={closeOverlay} pricing={pricing} onOpenStory={openStory} />
    </div>
  );
}

/**
 * The manifesto paragraph, split word-by-word so each word can cascade from
 * faint grey to full ink (CSS transition-delay keyed off `--wi`). The words
 * remain plain inline text to assistive tech — only the presentation is
 * staggered. The `fin` segment renders as a serif-italic <em> that carries
 * the gold underline sweep.
 */
function ManifestoReveal() {
  let wi = 0;
  return (
    <p>
      {MANIFESTO.map((seg, si) => {
        const words = seg.t.split(' ').map((w) => {
          const idx = wi++;
          return (
            <Fragment key={idx}>
              <span
                className={`hr-mw${seg.b ? ' hr-mw-b' : ''}`}
                style={{ '--wi': idx } as CSSProperties}
              >
                {w}
              </span>{' '}
            </Fragment>
          );
        });
        return seg.fin ? (
          <em className="hr-mfin" key={si}>
            {words}
          </em>
        ) : (
          <Fragment key={si}>{words}</Fragment>
        );
      })}
    </p>
  );
}

/**
 * A single preview mock. The mock JSX root is a `.hr-pmock` (absolutely
 * positioned, cross-fading via opacity). We clone it to merge the `hr-on`
 * class onto that SAME root — no wrapper div — so the `position:absolute;
 * inset:0` overlay stacking the prototype relies on is preserved exactly.
 */
function Mock({ active, children }: { active: boolean; children: ReactNode }) {
  if (!isValidElement<{ className?: string; 'aria-hidden'?: boolean }>(children)) return <>{children}</>;
  const base = children.props.className ?? '';
  const className = active ? `${base} hr-on` : base;
  return cloneElement(children, { className, 'aria-hidden': !active });
}
// The site footer for the homepage. Carries every compliance link (Legal
// column) plus product/company links, and "crawls in" — translateY + fade,
// staggered per column — when it scrolls into view. Respects reduced motion.
function HomeFooter() {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduceMotion()) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer ref={ref} className={`hr-footer${inView ? ' hr-foot-in' : ''}`}>
      <div className="hr-foot-grid">
        <div className="hr-foot-brand">
          <span className="hr-foot-mark">
            <SetnayanMark />
          </span>
          <span className="hr-foot-word">Setnayan</span>
          <p className="hr-foot-tag">
            One place that plans it, runs it, remembers it — and keeps it, for
            life. <i>Set na &rsquo;yan.</i>
          </p>
        </div>

        <nav className="hr-foot-col" aria-label="Explore">
          <h3>Explore</h3>
          <Link href="/pricing">Prices</Link>
          <Link href="/explore">Vendors</Link>
          <Link href="/papic">Papic</Link>
          <Link href="/monogram">Monogram maker</Link>
          <Link href="/download">Download app</Link>
        </nav>

        <nav className="hr-foot-col" aria-label="Company">
          <h3>Company</h3>
          <Link href="/about">About</Link>
          <Link href="/blog">Journal</Link>
          <Link href="/weddings">Real stories</Link>
          <Link href="/help">Help center</Link>
          <Link href="/for-vendors">For vendors</Link>
        </nav>

        <nav className="hr-foot-col" aria-label="Legal">
          <h3>Legal</h3>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds &amp; cancellations</Link>
          <Link href="/cookies">Cookie policy</Link>
          <Link href="/acceptable-use">Acceptable use</Link>
          <button type="button" className="hr-foot-linkbtn" onClick={() => openConsentManager()}>
            Cookie settings
          </button>
        </nav>
      </div>

      <div className="hr-foot-base">
        <span>&copy; 2026 Setnayan &middot; Made in the Philippines</span>
        <span>
          Data Protection Officer ·{' '}
          <a href="mailto:dpo@setnayan.com">dpo@setnayan.com</a>
        </span>
      </div>
    </footer>
  );
}
