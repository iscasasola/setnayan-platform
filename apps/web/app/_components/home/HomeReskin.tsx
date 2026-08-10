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
// The shared reskin footer (extracted from the old private HomeFooter 2026-07-03)
// — the same component the persistent SiteFooterChrome renders on every other
// marketing page, so the homepage and the rest of the site can never fork.
import { ReskinFooter } from '@/app/_components/marketing/reskin-footer';
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

/**
 * THE FRONT-PAGE COPY IS OWNER-APPROVED AND VERBATIM — do not reword it.
 *
 * Source: `03_Strategy/Claude_Design_Brief_2026-07-31.md` § 5, approved by the
 * owner on 2026-07-31 with both scope questions answered — full front-page
 * repositioning, and **non-sectarian at the top of the funnel** (binyag ·
 * kumpil · kasal · aqiqah belong on `/alaala` and the deeper pages, NEVER in
 * the hero). The direction it replaces was culturally neutral: the hero sub
 * read "The independent hub to keep a lifetime of memories, and plan any event,
 * free.", which said nothing about who a Filipino celebration belongs to.
 *
 * `lib/home-front-copy.test.ts` pins these strings so a later edit cannot
 * silently revert them, and fails if the retired neutral sentence comes back.
 * Change the words here only with the owner — then update that test in the
 * same commit.
 */
const HOME_HERO = {
  kick: 'Set na ’yan',
  title: (
    <>
      Keep your memories.
      <br />
      Plan your moments.
    </>
  ),
  sub: 'The Filipino way to keep a celebration — remembered by everyone who came, not just the couple. Plan any event, free.',
};

/**
 * The manifesto, split into segments for the word-cascade ink reveal: each
 * word starts faint and rises to full ink, staggered left-to-right, when the
 * section scrolls into view. `b` = the bolded anchor words; `fin` = the
 * serif-italic finale that gets the gold underline sweep. The copy itself is
 * the owner-approved positioning statement (§ 5, see above) — presentation
 * only changes here.
 */
const MANIFESTO: Array<{ t: string; b?: boolean; fin?: boolean }> = [
  { t: 'Setnayan is where the memories of every event in your life are kept — the ones you' },
  { t: 'hold', b: true },
  { t: 'and the ones you' },
  { t: 'attend.', b: true },
  { t: 'A Filipino celebration was never one family’s; it belongs to the whole' },
  { t: 'samahan', b: true },
  {
    t: '— the ninong and ninang, the titos and titas, the barkada, everyone who showed up. So the memory shouldn’t belong to one camera either. Every one of them is holding a piece of your day. Setnayan is where those pieces come together, and everyone goes home with their own. Plan it, run it, remember it, and',
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
  showcases = [],
  articles = [],
}: {
  pricing: PricingData;
  bgVideos?: HomeBgVideos;
  /** Real published weddings. Empty = none yet OR the read failed — both render
   *  the written invitation rather than a grid, which is honest either way. */
  showcases?: ReadonlyArray<{ href: string; coupleNames: string; city: string | null; dateLabel: string | null }>;
  /** Journal articles. Git-tracked markdown, so this cannot fail — only be short. */
  articles?: ReadonlyArray<{ slug: string; title: string; excerpt?: string }>;
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

  // ── Deep links into the below-fold content survive the gate ──
  // The gate scroll-locks <html> on mount, so landing on `/#what-is-setnayan`
  // (or any in-content anchor) would otherwise strand the visitor on the hero
  // with the target unreachable — the browser's own hash jump gets undone the
  // moment `hr-gate-closed` lands. Open the gate and scroll to the target
  // instead. Scoped to ids INSIDE #hr-content so a `#hr-hero` link (or any
  // stray hash) still leaves the cinematic gate closed as designed.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    if (!document.getElementById(id)?.closest('#hr-content')) return;
    openGate(id);
    // Mount-only: a later in-page hash change is an ordinary anchor jump, and
    // by then the gate is already open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── A scroll gesture opens the gate, exactly as "Learn more" does ──
  // The gate sets `overflow:hidden` on <html>, so before this a wheel/swipe on
  // the hero did NOTHING: anyone who scrolls instead of clicking hit a dead end
  // and never reached the content — including the purpose copy and the
  // privacy-policy link in the footer, two things Google's App Homepage
  // checklist requires a reviewer to be able to find without interacting.
  // (Owner-approved 2026-07-25.) Nothing about the design changes: the
  // cinematic screen still loads first, and this routes through the SAME
  // openGate() the button uses, so the reveal + smooth scroll are identical.
  useEffect(() => {
    // Only while the gate is shut, and never while an overlay is up — the
    // overlays scroll their own bodies (`overflow-y:auto`) and a wheel inside
    // one must not blow the gate open behind it.
    if (opened || overlay) return;
    const open = () => openGate();
    // Downward intent only; scrolling up at the top is a no-op, as before.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) open();
    };
    // Touch: finger moving UP = scrolling down. Require vertical dominance so a
    // horizontal swipe across the pillar dock doesn't trip the gate.
    let sx = 0;
    let sy = 0;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      sx = t.clientX;
      sy = t.clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const dy = sy - t.clientY;
      const dx = Math.abs(t.clientX - sx);
      if (dy > 12 && dy > dx) open();
    };
    // Keyboard scrolling is a scroll too. Space is deliberately excluded — it
    // activates a focused button, and the hero CTAs are buttons.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === 'End') open();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [opened, overlay, openGate]);

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
          className="hr-logo hr-logo-wm hr-glass-dark"
          aria-label="Setnayan · Home"
          title="Setnayan · Home"
          onClick={goHome}
        >
          {/* Official Setnayan mark (filled glyph, paints in currentColor). The
              .hr-logo button drives color: #fff on the gate and var(--hr-ink)
              when the nav switches to the unlocked glass state, so the mark is
              white on the cinematic gate and ink once opened — the same adaptive
              behavior the old 3-dot placeholder had. */}
          <SetnayanMark className="h-5 w-5" aria-hidden="true" />
          {/* 🔒 THE VISIBLE APP NAME — do not remove, and do not replace with an
              image. Google's OAuth "App Homepage" checklist requires the app
              name shown on the consent screen ("Setnayan") to be VISIBLE on the
              homepage, and until 2026-08-09 the top of this page rendered the
              glyph alone: the live HTML carried aria-label="Home" on the button
              and aria-hidden on the mark, so the product's own name appeared
              nowhere above the fold — not to a reviewer, not to a screen reader,
              not to a first-time visitor. That was half of why brand
              verification was refused on 2026-07-25 (the other half, "explain
              the purpose of your app", is answered by #what-is-setnayan below).
              Guarded by app/home-brand-name.test.ts. */}
          <span className="hr-wordmark">Setnayan</span>
        </button>
        <div className="hr-links hr-glass-dark">
          {/* Setnayan AI was removed from the nav (owner 2026-07-03) — the Suri
              dock tile remains the entry point to the story takeover; the
              'setnayan-ai' overlay in HomeOverlays is dormant until an entry
              point returns. */}
          {/* ── The three destinations that had NO way in ─────────────────
              Before this, the entire public site offered four outbound links
              and no menu: start planning, real stories, privacy, download.
              /explore, /realstories and /blog were all live, all public, and
              all reachable only by knowing the address. The Journal in
              particular was linked from NOWHERE on this page.

              These are real <Link>s, not overlays, because each is a place you
              go and stay — unlike Prices/Download/Vendors, which the owner
              locked as popups in 2026-06-30 ("login should be like the rest of
              the upper menu — a popup"). That ruling was about the popups; it
              did not say the site should have no destinations. */}
          <Link href="/explore">Find vendors</Link>
          <Link href="/realstories">Real weddings</Link>
          <Link href="/blog">Journal</Link>
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
          <div className="hr-kick">{hero ? `0${activePillar! + 1} · ${hero.name} · ${hero.role}` : HOME_HERO.kick}</div>
          <h1 className="hr-htitle">{hero ? hero.head : HOME_HERO.title}</h1>
          <p className="hr-hsub">{hero ? hero.desc : HOME_HERO.sub}</p>
          {/* Setnayan AI story-as-hero (owner 2026-07-03): pure TEXT on top of
              the background — no extra buttons; the original two CTAs below
              stay exactly as on every scene. */}
          {hero?.role === 'Setnayan AI' && (
            <SetnayanAiHeroStory pricing={pricing} onCompare={() => setOverlay('setnayan-ai')} />
          )}
          {/* Live product demos (owner 2026-07-03, demos program): every tile's
              demo button uses the SAME treatment + placement as Suri's
              comparator CTA (.hr-ai-cta) — the subtle glass accent sitting
              between the hero copy and the standard Start-planning/Learn-more
              CTAs (owner 2026-07-03: "apply this kind of placement for all
              5"). Ala ala's showcases the editorial — two complete sample
              editions (owner 2026-07-03). */}
          {hero?.name === 'Ala ala' && (
            <button className="hr-ai-cta" onClick={() => setOverlay('alaala-editorial')}>
              Read two sample editions&nbsp;·&nbsp;the editorial
            </button>
          )}
          {hero?.name === 'Papic' && (
            <button className="hr-ai-cta" onClick={() => setOverlay('papic-demo')}>
              Try the live demo, you and a friend, right now
            </button>
          )}
          {hero?.name === 'Live Studio' && (
            <button className="hr-ai-cta" onClick={() => setOverlay('panood-demo')}>
              Try the control room&nbsp;·&nbsp;two phones
            </button>
          )}
          {hero?.name === '3D Plan' && (
            <button className="hr-ai-cta" onClick={() => setOverlay('plan3d-demo')}>
              Find your seat&nbsp;·&nbsp;try it live
            </button>
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
            A living archive of real celebrations, each one unique in feeling, faith, and place.
          </p>
          {/* REAL published weddings. This grid used to render four HARDCODED
              couples, so a real couple publishing their day changed nothing on
              the front page — and the examples would have stayed on the site
              beside the real ones, indistinguishable.

              Threshold of TWO: a two-column grid holding one card reads as
              broken rather than sparse. Below it, a written invitation — which
              is also the honest thing to show when the read failed, since a
              failure and an empty archive arrive identically here. */}
          {showcases.length >= 2 ? (
            <div className="hr-grid2">
              {showcases.map((w, i) => (
                <Link href={w.href} className="hr-storyc" key={w.href}>
                  <div className={`hr-img hr-g${(i % 4) + 1}`} />
                  <div className="hr-ov" />
                  <div className="hr-c">
                    <div className="hr-lab">
                      {[w.city, w.dateLabel].filter(Boolean).join(' · ')}
                    </div>
                    <div className="hr-ti">{w.coupleNames}</div>
                    <span className="hr-lm hr-glass-dark">Read the story</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="hr-pdef" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
              The first celebrations are being filmed now. When a couple publishes
              their day, it appears here — told by them, and by everyone who came.
            </p>
          )}
        </section>

        {/* ── The Journal ────────────────────────────────────────────────
            Live and public at /blog, and until now linked from NOWHERE on this
            page — you had to know the address.

            Threshold of TWO, same reasoning as the stories rail: a strip with a
            single article on it reads as broken. Unlike the stories, this cannot
            fail — the Journal is git-tracked markdown, so the count is known at
            build time and there is no read to go wrong. */}
        {articles.length >= 2 ? (
          <section className="hr-stories">
            <div className="hr-pnum">The Journal</div>
            <h2 className="hr-pname">What we&rsquo;ve learned, written down.</h2>
            <div className="hr-grid2">
              {articles.map((a) => (
                <Link href={`/blog/${a.slug}`} className="hr-storyc" key={a.slug}>
                  <div className="hr-c">
                    <div className="hr-ti">{a.title}</div>
                    {a.excerpt ? <div className="hr-su">{a.excerpt}</div> : null}
                    <span className="hr-lm hr-glass-dark">Read it</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Pricing (free-floor; no hardcoded numbers — overlay reads catalog) */}
        <section className="hr-pillar" id="hr-pricing">
          <div className="hr-pnum">Pricing</div>
          <h2 className="hr-pname">Start free. Stay if it earns you.</h2>
          <p className="hr-pdef">
            No tricks at the floor. The free tier is a real planner, not a demo: the full Plano
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
            Tablet on the couch a year later, walking back through it. Browser, phone, tablet, the
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

        {/* ── "What is Setnayan?" — the plain-language statement of purpose ──
            Everything else on this page is editorial: the copy evokes rather
            than explains, and the concrete description of what the product IS
            lived only in metadata + the JSON-LD graph. That's fine for a
            visitor and NOT fine for a reviewer, and it cost us a Google OAuth
            brand verification (2026-07-25) on two counts: "your home page does
            not explain the purpose of your app", and the OAuth consent-screen
            app name "Setnayan" not matching the page — the visible wordmark
            renders "SETNAYAN" in caps and the title-case string never appeared
            as prose.

            So this block is deliberately literal, and three things in it are
            load-bearing — do not "tighten" them away:
              1. the literal title-case string "Setnayan" as body prose,
              2. a plain description of what the app does,
              3. an explicit statement that Live Studio sets up a YouTube live
                 broadcast — that's the justification Google's SENSITIVE-SCOPE
                 review asks for next, and it has to be visible on the homepage
                 before that review, not after it fails.

            ⚠ RULE FOR WHOSE CHANNEL (added 2026-07-27). Two arrangements ship
            on main: goLivePanood prefers a Setnayan-owned pool channel when
            NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED is on and otherwise uses the
            couple's own grant (setup/actions.ts:203-229), and
            /api/oauth/youtube/start still lets a couple connect their own.
            In production the pool is EMPTY, so the couple-connects path is the
            only one that has ever run. Therefore: describe whose channel is
            used as a FUNCTION OF HOW THE EVENT IS SET UP. Never assert which
            arrangement is in force — in EITHER direction. "creates the
            couple's own YouTube live broadcast" was wrong under the pool;
            "runs on a Setnayan channel" would be wrong today. Both readings
            must survive the pool shipping with no rewrite.
            Do not say Setnayan streams or pushes the video: it never sends a
            video byte (panood-youtube.ts:52-53, 266-274). The couple's own
            encoder pushes to the stream key.
            Anchored as #what-is-setnayan so the URL can be handed to a reviewer
            directly (see the hash-deep-link effect above). */}
        <section className="hr-about" id="what-is-setnayan">
          <div className="hr-pnum">What is Setnayan?</div>
          <h2 className="hr-pname">
            Setnayan is a Philippines-first platform for planning life’s events.
          </h2>
          <p className="hr-adef">
            Couples plan a wedding on Setnayan for free — guest list, seating chart, budget,
            verified vendors at 0% commission, and a live event page for their guests. Optional
            paid upgrades set the day apart: <em>Papic</em> turns the guests’ own phones into a
            photo-and-video crew, <em>Setnayan AI</em> drafts the timeline and matches vendors,
            and <em>Live Studio</em> sets up a YouTube live broadcast for the ceremony and puts
            the player on their event page, so family working abroad can watch the moment it
            happens. The broadcast is created on the couple’s own YouTube channel when they
            connect one; where Setnayan supplies the channel for an event, the couple connects
            nothing. Every photo, video, and milestone gathers into one living memory the couple
            keeps, for life.
          </p>
          {/* Google's App Homepage checklist requires the homepage to "explain
              with transparency the purpose for which your app requests user
              data" — describing the FEATURE is not the same as explaining the
              DATA REQUEST, and this paragraph is the latter. It also carries a
              privacy-policy link, so the checklist's "include a link to your
              privacy policy" is satisfied inside the purpose block itself and
              not only from the footer. That link must keep matching the URL
              configured on the OAuth consent screen. Deliberately describes
              what Setnayan DOES with the access rather than promising what it
              can't touch — the granted scope (auth/youtube) is broad, and a
              narrower claim here than the scope supports would be untrue.
              (auth/youtube.upload was dropped 2026-07-25; see
              YOUTUBE_OAUTH_SCOPES in lib/panood-youtube.ts.) */}
          <p className="hr-adef hr-anote">
            {/* The label names BOTH grants since 2026-08-09 — the paragraph
                gained the Drive sentence, and a lead-in that says "YouTube"
                over a paragraph covering two permissions reads to a reviewer
                as an undisclosed one. */}
            <em>Why Setnayan asks for YouTube and Google Drive access:</em> Live Studio is
            optional and off by
            default. It uses one Google permission — the YouTube account-management permission,{' '}
            <code>https://www.googleapis.com/auth/youtube</code> — and Setnayan uses it only to set
            up and run Live Studio broadcasts: see which channel is connected, create the live
            broadcast and its streaming slot, start and end it, check that the stream is arriving,
            and afterwards find the replay of the broadcast we created so the event page can link
            to it. When a couple connects their own channel, that connection is held against their
            event and used for nothing else. Where Setnayan supplies the channel for an event, the
            couple connects nothing and grants Setnayan no access to their Google account.
            Broadcasts are always created unlisted, and Setnayan does not send the video itself —
            the couple’s own streaming software does that. Setnayan does not upload videos to
            anyone’s channel, does not read anything else on a connected channel, never sells
            YouTube data or uses it to train AI, and shares nothing beyond the broadcast link the
            couple asked us to put on their event page. Setnayan also offers an
            optional Google Drive connection, so photos land in a folder the
            couple owns — it uses the narrowest Drive permission Google offers,{' '}
            <code>https://www.googleapis.com/auth/drive.file</code>, which lets
            Setnayan touch only the files it created itself. Both connections in
            plain words:{' '}
            <Link href="/privacy/google-access">What connecting Google does</Link>
            . Full details are in our <Link href="/privacy">Privacy Policy</Link>
            .
          </p>
        </section>

        <ReskinFooter />
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
