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

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PILLARS, PILLAR_HEROES, HOME_SCENE } from './pillars';
import { HomeOverlays, type OverlayId } from './HomeOverlays';
import type { PricingData } from './pricing-data';

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

export function HomeReskin({ pricing }: { pricing: PricingData }) {
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
    if (activePillar === null) openGate();
    else openGate(PILLAR_HEROES[activePillar]?.id);
  }, [activePillar, openGate]);

  // ── Hero scene (cross-fade between two layers) ──
  const sceneARef = useRef<HTMLDivElement>(null);
  const sceneBRef = useRef<HTMLDivElement>(null);
  const sceneCur = useRef(0);
  useEffect(() => {
    if (sceneARef.current) sceneARef.current.style.background = HOME_SCENE;
  }, []);
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

  const selectPillar = useCallback(
    (i: number) => {
      const p = PILLAR_HEROES[i];
      if (!p) return;
      setActivePillar(i);
      crossFade(p.photo);
    },
    [crossFade],
  );
  useEffect(() => {
    if (activePillar === null) crossFade(HOME_SCENE);
  }, [activePillar, crossFade]);

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
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="8" cy="9" r="3" fill="currentColor" />
            <circle cx="16" cy="9" r="3" fill="currentColor" />
            <circle cx="12" cy="15.5" r="3" fill="currentColor" />
          </svg>
        </button>
        <div className="hr-links hr-glass-dark">
          <button onClick={() => setOverlay('prices')}>Prices</button>
          <button onClick={() => setOverlay('download')}>Download</button>
          <button onClick={() => setOverlay('vendors')}>Vendors</button>
        </div>
        {/* Sign in → the REAL auth at /login (Google + Apple via OAuthButtonRow,
            the desktop loopback variant, and email/password — env-flag gated).
            No mockup overlay: this is a direct link into the working login. */}
        <Link className="hr-signin hr-glass-dark" href="/login">
          Sign in
        </Link>
      </nav>

      {/* ── HERO — fullscreen, scroll locked ── */}
      <section className="hr-hero" id="hr-hero">
        <div className="hr-film" aria-hidden="true">
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

        {/* The 5 pillars as the dock: each swaps the hero photo + its description */}
        <div className="hr-dock">
          {PILLAR_HEROES.map((p, i) => (
            <button
              key={p.id}
              className={`hr-w${activePillar === i ? ' hr-active' : ''}`}
              style={{ backgroundImage: p.photo }}
              aria-label={`${p.name} · ${p.role}`}
              onClick={() => selectPillar(i)}
            >
              <span className="hr-lab">
                {p.name} · {p.role}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Cookie pill (voice riff) */}
      <CookiePill />

      {/* ── CONTENT — revealed when the gate opens ── */}
      <main className="hr-content" id="hr-content">
        <section className="hr-manifesto">
          <p>
            Setnayan is where the memories of every event in your life are kept — the ones you{' '}
            <b>hold</b> and the ones you <b>attend</b>. Most tools you open for one event and close.
            This is the place your celebrations live, so you come back for the next one. Plan it, run
            it, remember it — and <b>keep it, for life.</b>
          </p>
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
          <section className="hr-pillar" id={PILLAR_HEROES[pi]?.id} key={pillar.widgetId}>
            <div className="hr-pnum">{pillar.num}</div>
            <h2 className="hr-pname">{pillar.name}</h2>
            <p className="hr-pdef">{pillar.def}</p>
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
            No tricks at the floor — the free tier is a real planner, not a demo: the full Planuhan
            suite, the free Likhaan studio, a live event page, and Ala Ala basics. Add Surian and
            premium Likhaan when you want the brain and the polish. The full breakdown lives on the
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

        <footer className="hr-footer">
          <span>Setnayan · setnayan.com</span>
          <span>Ala Ala · Likhaan · Planuhan · Surian · Tiangge</span>
          <span>© 2026 · Made in the Philippines</span>
        </footer>
      </main>

      <HomeOverlays current={overlay} onClose={closeOverlay} pricing={pricing} />
    </div>
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

function CookiePill() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="hr-cookie hr-glass-dark">
      Cookies help us remember
      <button onClick={() => setHidden(true)}>Accept</button>
      <button className="hr-mng" onClick={() => setHidden(true)}>
        Manage
      </button>
    </div>
  );
}
