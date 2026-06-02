'use client';

/**
 * /onboarding/wedding — Onboarding shell (Phase 1 of 5).
 *
 * PROTOTYPE-DIRECT PORT (owner directive 2026-06-02: "port the prototype's
 * actual CSS/HTML, not a Tailwind rewrite"). This mirrors the locked prototype
 * Onboarding_Wedding_Flow_2026-06-01.html one-for-one: the same .pba > .phone >
 * .top / .body / .bottom chrome, the same .screen sections with verbatim class
 * names, the same gold SETNAYAN mark + progress bar + Continue CTA. The CSS in
 * ../_styles/onboarding.css IS the prototype CSS, scoped under .pba.
 *
 * What changed vs the prototype: the imperative JS state machine (screens[] +
 * go()/render() + DOM .sel/.active toggles + buildFaith()/setKindPhoto()) is
 * re-wired into React state + localStorage resume. Behaviour is identical:
 *   - .active toggles by step index
 *   - Civil weddings skip the faith screen (forward-compatible: lands on the
 *     name screen once Phase 2 adds it; in Phase 1 faith is terminal so a civil
 *     couple sees the faith screen's "we'll skip this" note)
 *   - faith screen adapts to kind (single-pick Religious · pick-2 Mixed · note for Civil)
 *   - kind + faith hero photos swap per selection (graceful gradient fallback)
 *
 * Phase 1 ships screens 0-3 (welcome/role/kind/faith). State persists to
 * localStorage; no DB write until Phase 4's account-or-skip commit.
 */

import { useCallback, useEffect, useState } from 'react';
import '../_styles/onboarding.css';
import {
  EMPTY_ONBOARDING_STATE,
  FLOW_TOTAL,
  ONBOARDING_DRAFT_KEY,
  ONBOARDING_DRAFT_TTL_DAYS,
  type OnboardingFaith,
  type OnboardingKind,
  type OnboardingRole,
  type OnboardingState,
} from '../types';

/* Phase 1 renders 4 of the FLOW_TOTAL screens. */
const PHASE1_SCREENS = 4;

/* Primary-button label per screen (prototype nextLabel[]). */
const NEXT_LABEL = ['Let’s go', 'Continue', 'Continue', 'Continue'];
/* Which screens show a Skip button (prototype canSkip[]). */
const CAN_SKIP = [false, false, false, true];

const ASSET = (name: string) => `/onboarding/${name}.webp`;

/* Kind → hero photo + caption (prototype setKindPhoto). */
const KIND_PHOTO: Record<OnboardingKind, { img: string; cap: string }> = {
  religious: { img: 'wed_catholic', cap: 'A church wedding' },
  civil: { img: 'wed_civil', cap: 'A city-hall ceremony' },
  mixed: { img: 'wed_mixed', cap: 'A blended celebration' },
};

/* Faith → hero photo + caption (prototype setFaithPhoto, religious mode). */
const FAITH_PHOTO: Record<OnboardingFaith, { img: string; cap: string }> = {
  catholic: { img: 'wed_catholic', cap: 'A Catholic wedding' },
  christian: { img: 'wed_christian', cap: 'A garden Christian wedding' },
  inc: { img: 'wed_inc', cap: 'An INC wedding' },
  muslim: { img: 'wed_muslim', cap: 'A Muslim wedding' },
  cultural: { img: 'wed_cultural', cap: 'A traditional Filipino wedding' },
};

const ROLE_OPTIONS: { value: OnboardingRole; title: string; desc: string }[] = [
  { value: 'bride', title: 'Bride', desc: 'Walking down the aisle.' },
  { value: 'groom', title: 'Groom', desc: 'Waiting at the altar.' },
  { value: 'helper', title: 'Someone helping', desc: 'A parent, planner, or part of the entourage.' },
];

const KIND_OPTIONS: { value: OnboardingKind; title: string; desc: string }[] = [
  { value: 'religious', title: 'Religious', desc: 'One faith — church, mosque, chapel, or temple.' },
  { value: 'civil', title: 'Civil', desc: 'A judge or registrar officiates.' },
  { value: 'mixed', title: 'Mixed', desc: 'Two faith traditions — an interfaith wedding (e.g. Catholic & Muslim).' },
];

const FAITH_CHIPS: { value: OnboardingFaith; label: string; soon: boolean }[] = [
  { value: 'catholic', label: 'Catholic', soon: false },
  { value: 'christian', label: 'Christian', soon: true },
  { value: 'inc', label: 'INC', soon: true },
  { value: 'muslim', label: 'Muslim', soon: true },
  { value: 'cultural', label: 'Cultural', soon: true },
];

/** Fade-in hero image (prototype setHero: add `loaded` on load; gradient shows on error/missing). */
function HeroImg({ src, alt = '' }: { src: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      className={loaded ? 'loaded' : undefined}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
    />
  );
}

export function OnboardingShell() {
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);

  /* Hydrate from localStorage on mount (30-day TTL auto-clear). */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as OnboardingState;
        const ageMs = Date.now() - new Date(saved.lastSavedAt || 0).getTime();
        const ttlMs = ONBOARDING_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
        if (saved.lastSavedAt && ageMs < ttlMs) {
          setState({ ...EMPTY_ONBOARDING_STATE, ...saved });
        } else {
          localStorage.removeItem(ONBOARDING_DRAFT_KEY);
        }
      }
    } catch {
      /* corrupt draft — ignore, start fresh */
    }
    setHydrated(true);
  }, []);

  /* Persist on every change (after hydration, so we don't clobber the draft on mount). */
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({ ...state, lastSavedAt: new Date().toISOString() }),
      );
    } catch {
      /* storage full / blocked — non-fatal */
    }
  }, [state, hydrated]);

  const { step, role, kind, faith } = state;
  const patch = useCallback((p: Partial<OnboardingState>) => setState((s) => ({ ...s, ...p })), []);

  const isCivil = kind === 'civil';

  /* ── navigation (prototype go(d) + Civil-skip-faith) ── */
  const go = useCallback((d: number) => {
    setState((s) => {
      if (d === 0) return s;
      let n = Math.max(0, Math.min(PHASE1_SCREENS - 1, s.step + d));
      // Civil weddings have no faith/tradition — skip the faith screen (index 3).
      if (n === 3 && s.kind === 'civil') {
        n = Math.max(0, Math.min(PHASE1_SCREENS - 1, n + (d > 0 ? 1 : -1)));
      }
      return { ...s, step: n };
    });
  }, []);

  const selectRole = (r: OnboardingRole) => patch({ role: r });

  const selectKind = (k: OnboardingKind) =>
    patch({ kind: k, faith: k === 'religious' ? ['catholic'] : [] });

  const selectFaith = (f: OnboardingFaith) => {
    if (kind === 'mixed') {
      // pick exactly 2 — rolling cap (a 3rd pick drops the oldest)
      setState((s) => {
        const has = s.faith.includes(f);
        const next = has ? s.faith.filter((x) => x !== f) : [...s.faith, f];
        return { ...s, faith: next.length > 2 ? next.slice(next.length - 2) : next };
      });
    } else {
      // single-select (Religious)
      patch({ faith: [f] });
    }
  };

  /* ── per-step chrome ── */
  const canContinue = (() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return role !== null;
      case 2:
        return kind !== null;
      case 3:
        return isCivil ? true : faith.length >= 1;
      default:
        return true;
    }
  })();

  /* ── kind hero ── */
  const kindPhoto = KIND_PHOTO[kind ?? 'religious'];

  /* ── faith adaptive content (prototype buildFaith) ── */
  const faithView = (() => {
    if (kind === 'civil') {
      return {
        mode: 'civil' as const,
        eyebrow: 'Civil ceremony',
        h1: 'No tradition to set',
        sub: 'A judge or registrar officiates — we’ll skip the faith step.',
        photo: { img: 'wed_civil', cap: 'A civil ceremony' },
      };
    }
    if (kind === 'mixed') {
      return {
        mode: 'mixed' as const,
        eyebrow: 'Your two traditions',
        h1: 'Which two traditions?',
        sub: 'Pick the two faiths you’ll both honor — we’ll match vendors for each and pre-set dietary + protocols for both.',
        photo: { img: 'wed_mixed', cap: 'An interfaith wedding' },
      };
    }
    const first = (faith[0] ?? 'catholic') as OnboardingFaith;
    return {
      mode: 'religious' as const,
      eyebrow: 'Your tradition',
      h1: 'Your ceremony tradition',
      sub: 'We’ll match vendors who know your faith’s protocols — and pre-set things like halal catering.',
      photo: FAITH_PHOTO[first],
    };
  })();

  const sel = (cond: boolean) => (cond ? ' sel' : '');

  return (
    <div className="pba">
      <div className="phone">
        {/* top — brand + progress */}
        <div className="top">
          <div className="brandrow">
            <button
              className="btn-back"
              type="button"
              onClick={() => go(-1)}
              aria-label="Back"
              style={{ display: step === 0 ? 'none' : 'inline-flex' }}
            >
              {'‹'}
            </button>
            <span className="brandlock">
              <svg className="blmark-img" viewBox="0 0 5333.3335 5333.3335" role="img" aria-label="Setnayan">
                <path
                  d="M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z"
                  fill="#cb9e4b"
                  fillRule="nonzero"
                  transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"
                />
              </svg>
              <span className="wm">SETNAYAN</span>
            </span>
            <button
              className="skip"
              type="button"
              onClick={() => go(1)}
              style={{ display: CAN_SKIP[step] ? 'inline-block' : 'none' }}
            >
              Skip
            </button>
          </div>
          <div className="bar">
            <div className="barfill" style={{ width: `${((step + 1) / FLOW_TOTAL) * 100}%` }} />
          </div>
        </div>

        {/* body — the 4 screens (only the active one displays) */}
        <div className="body">
          {/* 1 WELCOME */}
          <section className={`screen welcomescreen${step === 0 ? ' active' : ''}`}>
            <div className="welcomehero">
              <HeroImg src={ASSET('welcome')} />
              <div className="welcomeoverlay">
                <h1>Let{'’'}s plan your wedding.</h1>
                <p>
                  A few quick questions and we{'’'}ll build a plan made for <i>your</i> day
                  {' — '}every vendor sorted to fit. Free to start, always.
                </p>
              </div>
            </div>
          </section>

          {/* 2 ROLE */}
          <section className={`screen${step === 1 ? ' active' : ''}`} id="screen-role">
            <div className="viewzone">
              <div className="eyebrow">About you</div>
              <h1 className="q">Who are you in this wedding?</h1>
              <p className="sub">This account is just you {'—'} your partner can join as a co-host anytime.</p>
              <figure className="rolephoto">
                <HeroImg src={ASSET('role')} />
                <figcaption className="rolecap">
                  <span className="rolecapline">You and your people.</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              <div className="stack" data-single="">
                {ROLE_OPTIONS.map((o) => (
                  <div
                    key={o.value}
                    className={`opt${sel(role === o.value)}`}
                    onClick={() => selectRole(o.value)}
                  >
                    <div className="otrow">
                      <div className="ot">{o.title}</div>
                      <span className="check" />
                    </div>
                    <div className="od">{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3 KIND */}
          <section className={`screen${step === 2 ? ' active' : ''}`} id="screen-kind">
            <div className="viewzone">
              <div className="eyebrow">Your wedding</div>
              <h1 className="q">What kind of wedding?</h1>
              <p className="sub">This shapes your timeline, your paperwork, and which vendors we show.</p>
              <figure className="kindphoto">
                <HeroImg src={ASSET(kindPhoto.img)} />
                <figcaption className="kindcap">
                  <span className="kindcapline">{kindPhoto.cap}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              <div className="stack" data-single="">
                {KIND_OPTIONS.map((o) => (
                  <div
                    key={o.value}
                    className={`opt${sel(kind === o.value)}`}
                    onClick={() => selectKind(o.value)}
                  >
                    <div className="otrow">
                      <div className="ot">{o.title}</div>
                      <span className="check" />
                    </div>
                    <div className="od">{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 4 FAITH — adaptive (single Religious · pick-2 Mixed · note for Civil) */}
          <section className={`screen${step === 3 ? ' active' : ''}`} id="screen-faith">
            <div className="viewzone">
              <div className="eyebrow">
                {faithView.eyebrow}
                {faithView.mode === 'mixed' && <span className="tag new">Interfaith</span>}
              </div>
              <h1 className="q">{faithView.h1}</h1>
              <p className="sub">{faithView.sub}</p>
              <figure className="faithphoto">
                <HeroImg src={ASSET(faithView.photo.img)} />
                <figcaption className="faithcap">
                  <span className="faithcapline">{faithView.photo.cap}</span>
                </figcaption>
              </figure>
            </div>
            <div className="tapzone">
              {faithView.mode === 'civil' ? (
                <div className="note">
                  <span>{'✦'}</span>
                  <div>
                    <b>Civil ceremony</b> {'—'} no religious tradition to set. We{'’'}ll
                    skip this step in the real flow.
                  </div>
                </div>
              ) : (
                <div
                  className="chips"
                  {...(faithView.mode === 'religious' ? { 'data-single': '' } : { 'data-max': '2' })}
                >
                  {FAITH_CHIPS.map((c) => (
                    <span
                      key={c.value}
                      className={`chip${sel(faith.includes(c.value))}`}
                      onClick={() => selectFaith(c.value)}
                    >
                      {c.label}
                      {c.soon && <span className="soon">soon</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* bottom — primary CTA */}
        <div className="bottom">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => canContinue && go(1)}
            disabled={!canContinue}
            style={!canContinue ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            {NEXT_LABEL[step] ?? 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
