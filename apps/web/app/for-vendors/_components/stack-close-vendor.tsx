/**
 * StackCloseVendor · the "3 things bundled, N apps replaced" stack collapse.
 *
 * WHY: ports `StackCloseVendor` from /tmp/setnayan-keynote-template/
 * components/homepage-stack.jsx (lines 271-575). Composed inline because
 * agent-homepage's shared homepage-* components haven't landed at
 * @/app/_components/marketing/ yet (verified `git log origin/main` on
 * 2026-05-28). Once they do, this section can dedupe into the shared file
 * — flagged as follow-up in PR body.
 *
 * DRIFT SCRUB applied (CLAUDE.md 2026-05-28 11th row v2.1 canonical · further
 * amended 2026-05-30 row § 1(a) Pro 28-day price flip ₱1,999 → ₱2,499):
 *   - "Pro at ₱499/wk" (2 occurrences in template) → "Pro at ₱2,499/28d"
 *   - Wording preserved otherwise to honor [[feedback_setnayan_button_preservation]]
 */
import { LogoMark } from '@/app/_components/brand-marks';

const VENDOR_STACK = [
  'Kasal.com listing',
  'Bridestory PH ads',
  'Pixieset · portfolio',
  'Bukku · bookkeeping',
  'Calendly · consults',
  'Google Calendar',
  'WhatsApp groups',
  'Manual Form 2307s',
  'Hand-written ORs',
  'Drive folder per couple',
];

export function StackCloseVendor() {
  return (
    <section
      style={{
        padding: '120px 56px',
        background: 'var(--m-paper-2)',
      }}
    >
      {/* App-Store-style reveal · "three platforms, one Setnayan" */}
      <div style={{ maxWidth: 1100, marginBottom: 72 }}>
        <div className="m-eyebrow">For vendors · the wedding ecosystem</div>
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {[
            {
              idx: '01',
              phrase: 'A discovery engine.',
              sub: 'couples find you · 192 verified categories · search across PH',
            },
            {
              idx: '02',
              phrase: 'A planning hub.',
              sub: 'guest list · RSVP · budget · schedule · mood board',
            },
            {
              idx: '03',
              phrase: 'A reputation system.',
              sub: 'verified vendor badge · real reviews from real Setnayan couples',
            },
          ].map((line, i) => (
            <div
              key={line.idx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 24,
                alignItems: 'baseline',
                padding: '10px 0',
                borderTop:
                  i === 0
                    ? '1px solid var(--m-line)'
                    : '1px solid var(--m-line-soft)',
              }}
            >
              <span
                className="m-mono"
                style={{ fontSize: 14, color: 'var(--m-orange)' }}
              >
                {line.idx}
              </span>
              <div>
                <span
                  className="m-serif"
                  style={{
                    fontSize: 'clamp(48px, 6vw, 84px)',
                    lineHeight: 1.02,
                    color: 'var(--m-ink)',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    letterSpacing: '-0.025em',
                  }}
                >
                  {line.phrase}
                </span>
                <div
                  className="m-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--m-slate-2)',
                    marginTop: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  {line.sub}
                </div>
              </div>
            </div>
          ))}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 24,
              alignItems: 'baseline',
              padding: '18px 0 10px',
              borderTop: '1px solid var(--m-ink)',
            }}
          >
            <span
              className="m-mono"
              style={{ fontSize: 14, color: 'var(--m-slate-3)' }}
            >
              =
            </span>
            <div>
              <span
                className="m-display"
                style={{
                  fontSize: 'clamp(56px, 7vw, 96px)',
                  lineHeight: 0.98,
                  color: 'var(--m-ink)',
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                }}
              >
                ONE SETNAYAN.
              </span>
              <div
                className="m-serif"
                style={{
                  fontSize: 16,
                  color: 'var(--m-slate)',
                  marginTop: 8,
                  fontStyle: 'italic',
                }}
              >
                You run the wedding service.{' '}
                <span style={{ color: 'var(--m-orange-2)' }}>
                  We handle everything else.
                </span>
              </div>
              <div
                className="m-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--m-slate-3)',
                  marginTop: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                What iPhone did for software, Setnayan does for Filipino wedding services
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stack-collapse proof */}
      <div
        className="m-stack-receipt-header"
        style={{
          display: 'grid',
          gap: 48,
          alignItems: 'end',
          marginBottom: 40,
        }}
      >
        <div>
          <div className="m-eyebrow" style={{ color: 'var(--m-slate-2)' }}>
            The receipt
          </div>
          <h3
            className="m-serif"
            style={{
              fontSize: 44,
              lineHeight: 1.06,
              margin: '16px 0 0',
              color: 'var(--m-ink)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
            }}
          >
            Three things bundled.{' '}
            <em
              style={{
                fontStyle: 'italic',
                color: 'var(--m-blush-deep)',
              }}
            >
              {VENDOR_STACK.length} apps replaced.
            </em>
          </h3>
        </div>
        <p
          style={{
            fontSize: 16,
            color: 'var(--m-slate)',
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        >
          Most vendors run their business on a Frankenstein stack — a Kasal
          listing here, a Pixieset there, an accountant who does the BIR forms
          by hand. Setnayan&apos;s free tier replaces every tool below.{' '}
          <strong style={{ color: 'var(--m-ink)' }}>
            Average PH vendor saves ₱18,400/year
          </strong>{' '}
          on subscriptions alone, plus ₱2-5K per event in BIR receipt prep.
        </p>
      </div>

      <div
        className="m-stack-3col"
        style={{
          display: 'grid',
          gap: 32,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT — vendor stack chaos */}
        <div
          style={{
            background: 'var(--m-paper)',
            border: '1px dashed var(--m-line)',
            borderRadius: 'var(--m-r-md)',
            padding: 28,
            position: 'relative',
          }}
        >
          <div
            className="m-mono"
            style={{
              fontSize: 10,
              color: 'var(--m-slate-3)',
              letterSpacing: '0.10em',
              marginBottom: 18,
              textTransform: 'uppercase',
            }}
          >
            BEFORE · WHAT YOU PIECE TOGETHER
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {VENDOR_STACK.map((tool) => (
              <span
                key={tool}
                className="m-pill"
                style={{ fontSize: 11 }}
              >
                {tool}
              </span>
            ))}
          </div>
          <div
            className="m-mono"
            style={{
              fontSize: 11,
              color: 'var(--m-slate-2)',
              marginTop: 22,
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--m-line-soft)',
              paddingTop: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span>
              {VENDOR_STACK.length} tools · ~₱18,400/yr in subs · BIR forms by hand
            </span>
            <span style={{ color: 'var(--m-blush-deep)' }}>
              1 missed lead = 1 lost wedding
            </span>
          </div>
        </div>

        {/* MIDDLE — collapse arrow */}
        <div
          className="m-stack-arrow"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          <span
            className="m-mono"
            style={{
              fontSize: 10,
              color: 'var(--m-slate-3)',
              letterSpacing: '0.10em',
              marginBottom: 12,
              textTransform: 'uppercase',
            }}
          >
            COLLAPSES INTO
          </span>
          <svg
            width="48"
            height="120"
            viewBox="0 0 48 120"
            style={{ display: 'block' }}
            aria-hidden
          >
            <path
              d="M24 6 L24 96 M14 86 L24 96 L34 86"
              stroke="var(--m-orange)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="108" r="4" fill="var(--m-orange)" />
          </svg>
        </div>

        {/* RIGHT — Setnayan vendor card */}
        <div
          style={{
            background: 'var(--m-ink)',
            color: 'var(--m-paper)',
            border: '1px solid var(--m-orange-3)',
            borderRadius: 'var(--m-r-md)',
            padding: 28,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -80,
              top: -80,
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'var(--m-orange)',
              opacity: 0.08,
              filter: 'blur(40px)',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flex: 1,
            }}
          >
            <div
              className="m-mono"
              style={{
                fontSize: 10,
                color: 'var(--m-orange-3)',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}
            >
              AFTER · ONE DASHBOARD
            </div>
            <LogoMark size={56} />
            <div
              className="m-display"
              style={{
                fontSize: 36,
                lineHeight: 0.98,
                color: 'var(--m-paper)',
              }}
            >
              Ship your
              <br />
              service. Done.
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--m-slate-4)',
                lineHeight: 1.55,
              }}
            >
              Profile, inbox, pipeline, calendar, contracts, payments, BIR
              receipts, reviews — one login.{' '}
              <strong style={{ color: 'var(--m-paper)' }}>
                Verified is free; Pro at ₱6,000/28d
              </strong>{' '}
              for ecosystem-locked extras.
            </div>
            <div
              style={{
                marginTop: 'auto',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <div>
                <div
                  className="m-display"
                  style={{ fontSize: 28, color: 'var(--m-orange-3)' }}
                >
                  ₱18.4K
                </div>
                <div
                  className="m-mono"
                  style={{ fontSize: 10, color: 'var(--m-slate-4)' }}
                >
                  saved / year
                </div>
              </div>
              <div>
                <div
                  className="m-display"
                  style={{ fontSize: 28, color: 'var(--m-orange-3)' }}
                >
                  ₱0
                </div>
                <div
                  className="m-mono"
                  style={{ fontSize: 10, color: 'var(--m-slate-4)' }}
                >
                  to start
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Small footer note */}
      <div
        className="m-mono"
        style={{
          fontSize: 11,
          color: 'var(--m-slate-3)',
          textAlign: 'center',
          marginTop: 14,
          letterSpacing: '0.04em',
        }}
      >
        Tool subscriptions only · ₱2-5K per event in BIR receipt prep saved separately
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (min-width: 1024px) {
          .m-stack-receipt-header { grid-template-columns: 1fr 1fr; }
          .m-stack-3col { grid-template-columns: 1.65fr auto 1fr; }
        }
        @media (max-width: 1023px) {
          .m-stack-receipt-header { grid-template-columns: 1fr; }
          .m-stack-3col { grid-template-columns: 1fr; }
          .m-stack-arrow svg { transform: rotate(0deg); }
        }
      `}</style>
    </section>
  );
}
