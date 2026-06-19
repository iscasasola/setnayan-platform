/**
 * VendorDoorScenario · the interactive "we step back at your door" story.
 *
 * WHY: /for-vendors has to convert the relationship-first skeptic — the vendor
 * who says "I believe in the personal touch; that's why I don't use apps." The
 * research (objection-handling + narrative-transportation + PH market) says the
 * winning move is a SINGLE peer protagonist's story (not a benefit list):
 * validate his premise first, name the one true cost (couples book whoever
 * replied first, not whoever's best), then show the turn — Setnayan filters,
 * matches, walks one well-matched couple to his door, and STEPS BACK. He keeps
 * the meeting, his price, his contract, the money (0% commission, pay-direct).
 *
 * DESIGN DEPENDENCY (owner ask 2026-06-20): this section consumes ONLY the
 * shared `--m-*` tokens + `.m-*` utility classes. Restyle the palette in
 * globals.css and this section restyles with the rest of the site — no second
 * copy to keep in sync. The cool/warm split is two real brand tokens:
 * --m-sage (Setnayan's quiet work) ↔ --m-orange (the vendor's world).
 *
 * HONESTY: Marco is an explicitly-labelled ILLUSTRATIVE composite, not a real
 * customer (owner-approved 2026-06-20). The "Illustrative scenario" eyebrow +
 * the always-visible disclaimer keep that unambiguous — fabricated testimonials
 * backfire hardest with exactly this skeptical audience. Swap in a real vendor
 * quote once one exists.
 */
'use client';

import { useState } from 'react';

type TagKind = 'app' | 'vendor' | 'door' | 'cost';
type Beat = {
  pos: number; // couple token position along the track, 0–100%
  l: number; // left (Setnayan) zone opacity
  r: number; // right (vendor) zone opacity
  noise: number; // mismatched-inquiry dots opacity
  stat: { v: string; label: string } | null;
  tag: { kind: TagKind; text: string } | null;
  title: string;
  body: string;
  chips?: string[];
  peer?: { quote: string; who: string };
  reassure?: string;
};

const BEATS: Beat[] = [
  {
    pos: 6, l: 0.35, r: 1, noise: 0.5,
    stat: { v: '30', label: 'weddings a year — and never an app' },
    tag: null,
    title: 'And he’s right.',
    body: 'Marco shoots 30 weddings a year on referrals alone. The meeting — the talk, the tiwala — is the whole job. Nothing should touch that.',
  },
  {
    pos: 6, l: 0.9, r: 0.4, noise: 1,
    stat: { v: '1st', label: 'fastest reply wins — not the best fit' },
    tag: { kind: 'cost', text: 'the real problem' },
    title: 'But the right couples can’t find him.',
    body: 'They message ten suppliers at once and book whoever replies first — not whoever’s best. Marco never even hears about them.',
  },
  {
    pos: 20, l: 1, r: 0.3, noise: 1,
    stat: { v: '₱0', label: 'to list — and he can leave anytime' },
    tag: { kind: 'app', text: 'Setnayan handles this' },
    title: 'So he tries it — free, braced for the worst.',
    body: 'A feed of hagglers and “magkano?” messages that vanish. That’s what he expects to see.',
  },
  {
    pos: 38, l: 1, r: 0.3, noise: 0.3,
    stat: { v: '1', label: 'couple left — matched to Marco' },
    tag: { kind: 'app', text: 'Setnayan handles this' },
    title: 'Instead, the wrong inquiries never arrive.',
    body: 'Setnayan quietly matches on his date, his price, his style. One couple is left — already serious, already a fit for him.',
  },
  {
    pos: 50, l: 0.55, r: 0.85, noise: 0.12,
    stat: null,
    tag: { kind: 'door', text: 'the handshake' },
    title: 'Then it does the part he didn’t expect.',
    body: 'It steps back. “They’re yours now.” No middleman in the room — walang namamagitan.',
  },
  {
    pos: 80, l: 0.3, r: 1, noise: 0,
    stat: null,
    tag: { kind: 'vendor', text: 'yours, start to finish' },
    title: 'He meets them. His price. His contract.',
    body: 'They pay him directly — 0% commission. The personal touch was never ours to replace. We just brought the right couple to his door.',
    chips: ['0% commission', 'Paid straight to you', 'Your price, your terms', 'Free during launch'],
    peer: {
      quote: 'I thought it would get between me and the couple. It just opened the door — then disappeared.',
      who: 'Marco, after his first booking',
    },
    reassure: 'List free during launch · leave anytime · nothing about how you work changes.',
  },
];

const TAG_STYLE: Record<TagKind, { bg: string; fg: string }> = {
  app: { bg: 'var(--m-sage)', fg: 'var(--m-sage-deep)' },
  vendor: { bg: 'var(--m-orange-4)', fg: 'var(--m-orange-2)' },
  door: { bg: 'var(--m-paper-2)', fg: 'var(--m-slate)' },
  cost: { bg: 'var(--m-paper-2)', fg: 'var(--m-slate-2)' },
};

// Faint mismatched-inquiry dots that crowd the Setnayan side, then get filtered
// away. Static positions (left%/top%) so there's no hydration mismatch.
const NOISE_DOTS = [
  [7, 24], [13, 60], [18, 38], [24, 18], [28, 66], [33, 44], [38, 28], [42, 58], [21, 50],
];

function HeartGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21S3.5 15.6 3.5 9.8C3.5 6.9 5.7 5 8.2 5c1.7 0 3 .9 3.8 2.2C12.8 5.9 14.1 5 15.8 5c2.5 0 4.7 1.9 4.7 4.8C20.5 15.6 12 21 12 21z"
        fill="currentColor"
      />
    </svg>
  );
}

export function VendorDoorScenario() {
  const [i, setI] = useState(0);
  const b = BEATS[i];
  // BEATS[i] is `Beat | undefined` under noUncheckedIndexedAccess; `i` is always
  // a valid index (setI clamps to 0..len-1), but narrow explicitly for tsc.
  if (!b) return null;
  const last = i === BEATS.length - 1;
  const gold = i >= 4; // couple has crossed into the vendor's world

  return (
    <section
      style={{
        padding: 'clamp(72px, 10vw, 120px) clamp(20px, 5vw, 56px)',
        background: 'var(--m-paper)',
      }}
    >
      <div className="m-eyebrow">Illustrative scenario</div>
      <h2
        className="m-serif"
        style={{
          fontSize: 'clamp(36px, 5vw, 64px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          margin: '20px 0 16px',
          maxWidth: 900,
          color: 'var(--m-ink)',
          fontWeight: 400,
        }}
      >
        The app brings them to your door.{' '}
        <em style={{ fontStyle: 'italic', color: 'var(--m-orange-2)' }}>You do the rest.</em>
      </h2>

      <blockquote
        className="m-serif"
        style={{
          fontStyle: 'italic',
          fontSize: 'clamp(18px, 2.4vw, 24px)',
          lineHeight: 1.5,
          color: 'var(--m-ink)',
          maxWidth: 720,
          margin: '8px 0 6px',
          paddingLeft: 18,
          borderLeft: '2px solid var(--m-orange-3)',
        }}
      >
        “I believe in the personal touch — meeting people, talking with them. That’s why I never
        used an online app.”
      </blockquote>
      <div className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-3)', letterSpacing: '0.06em' }}>
        — Marco, wedding photographer · an illustrative example, not a real customer
      </div>

      {/* ── Interactive stage ─────────────────────────────────────────── */}
      <div
        role="group"
        aria-label="Step-through scenario: how a couple reaches Marco, and where Setnayan steps back"
        style={{ marginTop: 40, maxWidth: 760 }}
      >
        {/* Stat readout */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minHeight: 34, marginBottom: 16 }}>
          {b.stat && (
            <>
              <span
                className="scn-stat-v m-display"
                style={{ fontSize: 30, lineHeight: 1, color: gold ? 'var(--m-orange-2)' : 'var(--m-ink)' }}
              >
                {b.stat.v}
              </span>
              <span style={{ fontSize: 13, color: 'var(--m-slate)' }}>{b.stat.label}</span>
            </>
          )}
        </div>

        {/* Track: Setnayan side (left) ↔ the vendor's door (right) */}
        <div
          style={{
            position: 'relative',
            height: 84,
            borderRadius: 'var(--m-r-md)',
            overflow: 'hidden',
            border: '1px solid var(--m-line)',
          }}
        >
          <div
            className="scn-zone"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', background: 'var(--m-sage)', opacity: b.l }}
          />
          <div
            className="scn-zone"
            style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '50%', background: 'var(--m-orange-3)', opacity: b.r }}
          />

          {/* mismatched-inquiry noise on the Setnayan side */}
          <div className="scn-noise" style={{ position: 'absolute', inset: 0, opacity: b.noise, zIndex: 1 }}>
            {NOISE_DOTS.map(([x, y], n) => (
              <span
                key={n}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--m-slate-4)',
                  opacity: 0.5,
                }}
              />
            ))}
          </div>

          {/* the door */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 0, borderLeft: '1px dashed var(--m-slate-4)', zIndex: 2 }}
          />
          <div
            className="m-mono"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: 8,
              transform: 'translateX(-50%)',
              fontSize: 10,
              letterSpacing: '0.08em',
              color: 'var(--m-slate-3)',
              whiteSpace: 'nowrap',
              zIndex: 2,
            }}
          >
            HIS DOOR
          </div>

          {/* the couple — travels left→right toward Marco, turns gold at the door */}
          <div
            className="scn-couple"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '55%',
              left: `${b.pos}%`,
              transform: 'translate(-50%, -50%)',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--m-paper)',
              border: `1px solid ${gold ? 'var(--m-orange)' : 'var(--m-line)'}`,
              color: gold ? 'var(--m-orange-2)' : 'var(--m-slate-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3,
            }}
          >
            <HeartGlyph />
          </div>

          {/* Marco — never moves; he stays in his world */}
          <div
            className="m-display"
            title="Marco, at his studio"
            style={{
              position: 'absolute',
              top: '55%',
              left: '93%',
              transform: 'translate(-50%, -50%)',
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'var(--m-orange-4)',
              border: '1px solid var(--m-orange-3)',
              color: 'var(--m-orange-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              zIndex: 3,
            }}
          >
            M
          </div>
        </div>

        {/* zone labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
          <span className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-3)' }}>Setnayan: find &amp; filter</span>
          <span className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-3)' }}>Marco: the relationship</span>
        </div>

        {/* Beat card */}
        <div aria-live="polite" style={{ marginTop: 28, minHeight: 150 }}>
          {b.tag && (
            <span
              className="m-pill"
              style={{
                fontSize: 11,
                padding: '4px 11px',
                background: TAG_STYLE[b.tag.kind].bg,
                color: TAG_STYLE[b.tag.kind].fg,
                borderColor: 'transparent',
                marginBottom: 12,
                display: 'inline-block',
              }}
            >
              {b.tag.text}
            </span>
          )}
          <h3
            className="m-serif"
            style={{ fontSize: 'clamp(22px, 3vw, 28px)', lineHeight: 1.3, margin: '0 0 10px', color: 'var(--m-ink)', fontWeight: 400 }}
          >
            {b.title}
          </h3>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--m-slate)', margin: 0, maxWidth: 640 }}>{b.body}</p>

          {b.chips && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {b.chips.map((c) => (
                <span
                  key={c}
                  className="m-pill"
                  style={{ fontSize: 12, padding: '5px 11px', background: 'var(--m-paper-2)', color: 'var(--m-slate)', borderColor: 'var(--m-line)' }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {b.peer && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--m-line)', maxWidth: 640 }}>
              <p className="m-serif" style={{ fontStyle: 'italic', fontSize: 18, lineHeight: 1.5, color: 'var(--m-ink)', margin: 0 }}>
                “{b.peer.quote}”
              </p>
              <div className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-3)', marginTop: 8, letterSpacing: '0.06em' }}>
                — {b.peer.who}
              </div>
            </div>
          )}

          {b.reassure && (
            <p className="m-mono" style={{ fontSize: 11, color: 'var(--m-slate-3)', marginTop: 12, letterSpacing: '0.04em' }}>{b.reassure}</p>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 }}>
          <div style={{ display: 'flex', gap: 7 }} aria-hidden="true">
            {BEATS.map((_, n) => (
              <button
                key={n}
                onClick={() => setI(n)}
                aria-label={`Go to step ${n + 1} of ${BEATS.length}`}
                style={{
                  width: 8,
                  height: 8,
                  padding: 0,
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  background: n === i ? 'var(--m-ink)' : 'var(--m-slate-4)',
                  transform: n === i ? 'scale(1.25)' : 'none',
                  transition: 'background .3s, transform .3s',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="m-btn m-btn-ghost" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
              Back
            </button>
            <button className="m-btn m-btn-primary" onClick={() => setI((v) => (last ? 0 : v + 1))}>
              {last ? 'Start over' : 'Next →'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .scn-couple { transition: left .7s cubic-bezier(.5,0,.2,1), color .5s, border-color .5s; }
        .scn-zone, .scn-noise { transition: opacity .45s; }
        .scn-stat-v { transition: color .4s; }
        @media (prefers-reduced-motion: reduce) {
          .scn-couple, .scn-zone, .scn-noise, .scn-stat-v { transition: none; }
        }
      `}</style>
    </section>
  );
}
