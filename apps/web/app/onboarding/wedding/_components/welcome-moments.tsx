'use client';

/**
 * WelcomeMoments — the pure-moment conversational onboarding intro (owner 2026-06-05).
 *
 * Ported faithfully from the production-mirror prototype
 * `Onboarding_Wedding_Flow_2026-06-01.html` (the "pure-moment player" + conversational
 * reveal) into the live React flow on 2026-06-08. Behaviour mirrors the prototype:
 * ONE moment on screen at a time — `speak` = Setnayan says one line (auto-advances, tap
 * to skip); `ask` = one question + its options (advances when answered). It runs the
 * conversational core (Welcome → Role → Kind → Faith) on the welcome screen, collecting
 * role/kind/faith into the parent state, then hands off to the Name screen via onDone().
 *
 * The standalone role/kind/faith screens (steps 1-3) stay in place as back-navigation /
 * edit targets — exactly as in the prototype.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import type { OnboardingFaith, OnboardingKind, OnboardingRole } from '../types';

/* Personalized reactions (owner 2026-06-05 — verbatim from the prototype). */
const ROLE_REACT: Record<OnboardingRole, string> = {
  bride:
    'Love that. Filipino weddings so often start with the bride — you’re in good company. Let’s build the day you’ve always pictured.',
  groom:
    'A groom taking the lead — now that’s a rare find, and a green flag. Your partner’s lucky. Let’s build the day you both deserve.',
  helper:
    'You’re the secret ingredient. The best weddings are carried by the people who love the couple enough to plan. Let’s make this one unforgettable.',
};

const KIND_REACT: Record<OnboardingKind, string> = {
  religious: 'Beautiful — a wedding rooted in faith.',
  civil: 'The simplest, most modern way to marry.',
  mixed: 'Married not just by faith, but by heart.',
};

/* Both maps derive from lib/faith-registry (the single faith source,
   2026-06-12) — EVERY faith now has a reaction + one-liner, so a faith the
   owner flips active in /admin/wedding-types never lands silently. The audit
   (2026-06-11) caught the old partial maps covering only 5 of 8 faiths. */
const FAITH_REACT: Record<OnboardingFaith, string> = Object.fromEntries(
  FAITH_REGISTRY.map((e) => [e.key, e.react]),
) as Record<OnboardingFaith, string>;

/* Per-faith one-liners shown under each option. */
const FAITH_DESC: Record<OnboardingFaith, string> = Object.fromEntries(
  FAITH_REGISTRY.map((e) => [e.key, e.desc]),
) as Record<OnboardingFaith, string>;

type Ans = { role?: OnboardingRole; kind?: OnboardingKind; faith?: OnboardingFaith };
type Opt = { value: string; title: string; desc?: string };

type Moment =
  | { t: 'speak'; text: (a: Ans) => string; when?: (a: Ans) => boolean }
  | {
      t: 'ask';
      field: 'role' | 'kind' | 'faith';
      q: (a: Ans) => string;
      opts: (a: Ans, faiths: { value: OnboardingFaith; label: string }[]) => Opt[];
      when?: (a: Ans) => boolean;
    }
  | { t: 'end' };

/* The conversational script (verbatim from the prototype MOMENTS array). */
const MOMENTS: Moment[] = [
  { t: 'speak', text: () => 'Welcome to Setnayan.' },
  {
    t: 'speak',
    text: () =>
      'In just a few minutes, we’ll personalize your whole wedding — the kind of planning that takes couples hundreds of hours. For free.',
  },
  {
    t: 'speak',
    text: () =>
      'We’ve studied how thousands of Filipino weddings really come together — every snag, every stress — and built the fixes right in.',
  },
  { t: 'speak', text: () => 'To begin — let’s get to know you.' },
  {
    t: 'ask',
    field: 'role',
    q: () => 'Who are you in this wedding?',
    opts: () => [
      { value: 'bride', title: 'Bride', desc: 'Time to plan the wedding you’ve dreamed of.' },
      { value: 'groom', title: 'Groom', desc: 'Time to build the wedding you both deserve.' },
      { value: 'helper', title: 'Someone helping', desc: 'Let’s create a day they’ll never forget.' },
    ],
  },
  { t: 'speak', text: (a) => (a.role ? ROLE_REACT[a.role] : '') },
  {
    t: 'speak',
    text: () => 'In 2023, 414,213 Filipino couples married — every faith, every kind of celebration.',
  },
  {
    t: 'ask',
    field: 'kind',
    q: () => 'What kind is yours?',
    opts: () => [
      { value: 'religious', title: 'Religious', desc: 'Church, mosque, or temple — about 236,000 couples in 2023.' },
      { value: 'civil', title: 'Civil', desc: 'A judge or registrar — 177,627 in 2023, the top single rite.' },
      { value: 'mixed', title: 'Mixed', desc: 'Two faiths, one celebration — joined by heart.' },
    ],
  },
  { t: 'speak', text: (a) => (a.kind ? KIND_REACT[a.kind] : '') },
  {
    t: 'speak',
    when: (a) => a.kind !== 'civil',
    text: () => 'The Philippines is home to several major faith traditions.',
  },
  {
    t: 'ask',
    field: 'faith',
    when: (a) => a.kind !== 'civil',
    q: (a) => (a.kind === 'mixed' ? 'Which traditions are you joining?' : 'Which one is yours?'),
    // Offer the LIVE active faith set (passed in) so coverage never narrows to the
    // prototype's stale five — the player hands off to Name, bypassing the standalone
    // faith screen on the forward path.
    opts: (_a, faiths) => faiths.map((f) => ({ value: f.value, title: f.label, desc: FAITH_DESC[f.value] })),
  },
  {
    t: 'speak',
    when: (a) => a.kind !== 'civil',
    text: (a) => (a.faith && FAITH_REACT[a.faith]) || 'Beautiful — we’ll tailor everything to your tradition.',
  },
  {
    t: 'speak',
    when: (a) => a.kind === 'civil',
    text: () => 'Light on paperwork, big on heart — we’ll keep your checklist short and the day easy.',
  },
  { t: 'end' },
];

function SetnayanMark({ className }: { className?: string }) {
  // Same brand mark as the top brandlock, sized small + gold via CSS.
  return (
    <svg className={className} viewBox="0 0 5333.3335 5333.3335" role="img" aria-label="Setnayan">
      <path
        d="M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z"
        fill="#cb9e4b"
        fillRule="nonzero"
        transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"
      />
    </svg>
  );
}

export type WelcomeMomentsProps = {
  /** Active faith chips to offer (already filtered for "soon"/inactive). */
  faithOptions: { value: OnboardingFaith; label: string }[];
  onPickRole: (r: OnboardingRole) => void;
  onPickKind: (k: OnboardingKind) => void;
  onPickFaith: (f: OnboardingFaith) => void;
  /** Conversation finished → hand off to the Name screen. Must be stable (useCallback). */
  onDone: () => void;
};

export function WelcomeMoments({ faithOptions, onPickRole, onPickKind, onPickFaith, onDone }: WelcomeMomentsProps) {
  const [ans, setAns] = useState<Ans>({});
  const ansRef = useRef<Ans>({});
  const [idx, setIdx] = useState(0);
  const doneRef = useRef(false);
  const lock = useRef(false);

  // Next renderable moment after `from`, skipping any whose `when(a)` is false.
  const findNext = (from: number, a: Ans) => {
    let j = from + 1;
    while (j < MOMENTS.length) {
      const m = MOMENTS[j];
      if (m && m.t !== 'end' && m.when && !m.when(a)) {
        j++;
        continue;
      }
      break;
    }
    return Math.min(j, MOMENTS.length - 1);
  };

  const advance = useCallback(() => {
    if (lock.current) return; // guard double-taps until the next moment commits
    lock.current = true;
    setIdx((i) => findNext(i, ansRef.current));
  }, []);

  const pick = (field: 'role' | 'kind' | 'faith', value: string) => {
    if (lock.current) return;
    lock.current = true;
    const next: Ans = { ...ansRef.current };
    if (field === 'role') {
      next.role = value as OnboardingRole;
      onPickRole(next.role);
    } else if (field === 'kind') {
      next.kind = value as OnboardingKind;
      onPickKind(next.kind);
    } else {
      next.faith = value as OnboardingFaith;
      onPickFaith(next.faith);
    }
    ansRef.current = next;
    setAns(next);
    setIdx((i) => findNext(i, next));
  };

  // Per-moment driver: release the tap-lock, auto-advance `speak`, fire `onDone` at `end`.
  useEffect(() => {
    lock.current = false;
    const m = MOMENTS[idx];
    if (!m) return;
    if (m.t === 'end') {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    if (m.t === 'speak') {
      const txt = m.text(ansRef.current);
      const dwell = Math.max(1900, Math.min(4200, 1100 + txt.length * 26));
      const id = setTimeout(advance, dwell);
      return () => clearTimeout(id);
    }
    // 'ask' waits for a pick — no auto-advance.
  }, [idx, advance, onDone]);

  const m = MOMENTS[idx];
  if (!m || m.t === 'end') return <div id="momentHost" aria-hidden="true" />;

  return (
    <div
      id="momentHost"
      aria-live="polite"
      onClick={m.t === 'speak' ? advance : undefined}
      style={m.t === 'speak' ? { cursor: 'pointer' } : undefined}
    >
      {m.t === 'speak' ? (
        <div className="moment mo-speak" key={idx}>
          <p className="fm-react">
            <SetnayanMark className="say-mark" />
            <span>{m.text(ans)}</span>
          </p>
          <div className="introhint">Tap to continue</div>
        </div>
      ) : (
        <div className="moment mo-ask" key={idx}>
          <p className="m-q">{m.q(ans)}</p>
          <div className="m-opts">
            {m.opts(ans, faithOptions).map((o) => (
              <button key={o.value} type="button" className="m-opt" onClick={() => pick(m.field, o.value)}>
                <span className="m-ot">{o.title}</span>
                {o.desc && <span className="m-od">{o.desc}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
