/**
 * PageTail · Voices + Pricing + FAQ + ClosingCTA + Footer composed as one
 * file for /for-vendors only.
 *
 * WHY: marketing homepage parallel-dependency. agent-homepage is porting
 * homepage-* into apps/web/app/_components/marketing/ but those haven't
 * landed as of 2026-05-28 (verified via `git log origin/main`). This file
 * inlines those tail sections specifically for /for-vendors. Once the
 * shared marketing/* components land, this file becomes a candidate for
 * dedupe — flagged in PR body.
 *
 * Ports from /tmp/setnayan-keynote-template/:
 *   - components/homepage-stories.jsx:127 (Voices) — vendor + couple quotes
 *   - components/homepage-bottom.jsx:3 (Pricing) — couple-side cards
 *   - components/homepage-bottom.jsx:223 (FAQ) — 7 expandable Qs
 *   - components/homepage-bottom.jsx:311 (ClosingCTA) — Set na 'yan moment
 *   - components/homepage-bottom.jsx:345 (Footer) — 5-col compliance footer
 *
 * v2.1 DRIFT SCRUB applied (further amended 2026-05-30 row § 1(a) Pro 28-day
 * price flip ₱1,999 → ₱2,499):
 *   - FAQ "How does Setnayan make money?" updated (v2.1 canonical:
 *     ₱1,499 verification · ₱2,499/28d Pro · ₱5,499/28d Enterprise · tokens ·
 *     Productions services · 0% commission)
 *   - FAQ "Setnayan iOS/Android/Mac/Windows" preserved (matches v2.1 § 11)
 *   - ClosingCTA copy preserved verbatim
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogoMark, Wordmark } from '@/app/_components/brand-marks';

// ─── Voices (vendor + couple stories) ──────────────────────────────────
export function Voices() {
  const featured = {
    quote:
      'Three weddings booked through the app in my first month. None of them found me on Instagram. That’s new for me.',
    who: 'Mika Reyes',
    role: 'Founder, Bloom & Co. Florals · Tagaytay',
    detail: 'Vendor · Bloom & Co. Florals · first month on Setnayan',
  };
  const others = [
    {
      quote:
        'I’m a coordinator. I used to live in five WhatsApp groups per client. Now I live in one dashboard per wedding. I sleep again.',
      who: 'Camille Lao',
      role: 'Lead, Ilaya Coordinators · Cebu',
      kind: 'vendor' as const,
    },
    {
      quote:
        'We were the first wedding our caterer ever did through Setnayan. By the end, she was the one telling other vendors about it. We accidentally became her referral program.',
      who: 'Patricia Cruz',
      role: 'Couple · 6 Sept 2026 · Tagaytay',
      kind: 'couple' as const,
    },
  ];
  return (
    <section
      style={{
        padding: '120px 56px',
        background: 'var(--m-paper-2)',
      }}
    >
      <div
        className="m-grid-2"
        style={{
          display: 'grid',
          gap: 56,
          marginBottom: 56,
          alignItems: 'end',
        }}
      >
        <h2
          className="m-serif"
          style={{
            fontSize: 'clamp(40px, 5vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--m-ink)',
          }}
        >
          The people who{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--m-orange-2)' }}>
            actually used it.
          </em>
        </h2>
        <p
          style={{
            fontSize: 16,
            color: 'var(--m-slate)',
            lineHeight: 1.6,
            maxWidth: 480,
          }}
        >
          Eighty-four weddings in. Real names, real venues, real numbers. We
          invited every couple and every vendor on the platform to talk to you —
          these are the ones who said yes.
        </p>
      </div>

      <div
        className="m-card m-voices-featured"
        style={{
          padding: 0,
          overflow: 'hidden',
          display: 'grid',
        }}
      >
        <div
          className="m-photo-placeholder"
          style={{ minHeight: 380 }}
          aria-label="portrait · patricia · tagaytay 9.6.26"
        />
        <div
          style={{
            padding: '40px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <span
            className="m-label-mono"
            style={{ color: 'var(--m-orange-2)' }}
          >
            ★ Featured voice
          </span>
          <p
            className="m-serif"
            style={{
              fontSize: 30,
              fontStyle: 'italic',
              lineHeight: 1.4,
              color: 'var(--m-ink)',
              margin: 0,
            }}
          >
            &ldquo;{featured.quote}&rdquo;
          </p>
          <div>
            <div
              className="m-display"
              style={{
                fontSize: 22,
                color: 'var(--m-ink)',
                textTransform: 'uppercase',
                letterSpacing: '0.005em',
              }}
            >
              {featured.who}
            </div>
            <div
              className="m-mono"
              style={{
                fontSize: 11,
                color: 'var(--m-slate-2)',
                marginTop: 4,
                letterSpacing: '0.06em',
              }}
            >
              {featured.role}
            </div>
            <div
              className="m-mono"
              style={{
                fontSize: 11,
                color: 'var(--m-orange-2)',
                marginTop: 10,
                letterSpacing: '0.06em',
              }}
            >
              {featured.detail}
            </div>
          </div>
        </div>
      </div>

      <div
        className="m-voices-others"
        style={{
          display: 'grid',
          gap: 14,
          marginTop: 14,
        }}
      >
        {others.map((q, i) => (
          <div
            key={i}
            className="m-card m-card-lift"
            style={{
              padding: 28,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 20,
            }}
          >
            <p
              className="m-serif"
              style={{
                fontSize: 22,
                fontStyle: 'italic',
                lineHeight: 1.45,
                color: 'var(--m-ink)',
                margin: 0,
              }}
            >
              &ldquo;{q.quote}&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                className="m-display"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background:
                    q.kind === 'vendor' ? 'var(--m-orange-4)' : 'var(--m-blush)',
                  color:
                    q.kind === 'vendor' ? 'var(--m-orange-2)' : 'var(--m-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                {q.who
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--m-ink)',
                    fontWeight: 500,
                  }}
                >
                  {q.who}
                </div>
                <div
                  className="m-mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--m-slate-2)',
                    marginTop: 2,
                  }}
                >
                  {q.role}
                </div>
              </div>
              <span
                className="m-pill"
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  padding: '3px 9px',
                  background:
                    q.kind === 'vendor' ? 'var(--m-orange-4)' : 'var(--m-paper)',
                  color:
                    q.kind === 'vendor' ? 'var(--m-orange-2)' : 'var(--m-slate-2)',
                  borderColor: 'transparent',
                }}
              >
                {q.kind === 'vendor' ? 'Vendor' : 'Couple'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .m-voices-featured { grid-template-columns: 1fr 1.2fr; }
          .m-voices-others { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 1023px) {
          .m-voices-featured { grid-template-columns: 1fr; }
          .m-voices-others { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

// ─── Pricing (couple-side cards) ────────────────────────────────────────
export function Pricing() {
  return (
    <section style={{ padding: '120px 56px', background: 'var(--m-paper)' }}>
      <div className="m-eyebrow">Transparent pricing</div>
      <h2
        className="m-serif"
        style={{
          fontSize: 'clamp(48px, 6vw, 76px)',
          lineHeight: 1.04,
          margin: '20px 0 16px',
          maxWidth: 1100,
          letterSpacing: '-0.02em',
          color: 'var(--m-ink)',
          fontWeight: 400,
        }}
      >
        Fixed PHP prices.{' '}
        <em style={{ fontStyle: 'italic', color: 'var(--m-blush-deep)' }}>
          What you see is what you pay.
        </em>
      </h2>
      <p
        style={{
          fontSize: 17,
          color: 'var(--m-slate)',
          maxWidth: 720,
          lineHeight: 1.55,
        }}
      >
        The planning tools are free forever. Some in-app services are free (mood
        board, basic schedule). Others are pay-per-use (livestream, paparazzi,
        highlight reel). No subscription, no per-guest fee, no checkout
        surprises — what you see is what you pay.
      </p>

      <div
        className="m-pricing-grid"
        style={{
          display: 'grid',
          gap: 16,
          marginTop: 56,
        }}
      >
        {[
          {
            tag: 'Free forever',
            title: 'Planning, every surface.',
            body: 'Guest list, RSVP, seating, budget, mood board, schedule — every planning tool is free. Pakulay mood board is free too. No paywall, no per-guest fee.',
            amount: '₱0',
            sub: 'every month, every guest',
            accent: false,
          },
          {
            tag: 'Bid · unlimited',
            title: 'Every vendor. Free to ask.',
            body: "Send as many bid requests as you want, to as many vendors as you want, at no cost. Every quote that comes back is designed for you — because every wedding is unique and special, and a copy-paste rate card doesn't honor that.",
            amount: '₱0',
            sub: 'unlimited requests · custom quotes',
            accent: false,
          },
          {
            tag: 'À la carte',
            title: 'Pay only for what you use.',
            body: 'In-app services (Panood, Papic, AI highlight reel, custom monogram) are sold by Setnayan Productions like any other vendor. Most are FREE during launch (until 31 Mar 2027).',
            amount: '₱0–',
            sub: 'launch promo · prices on /pricing',
            accent: true,
          },
        ].map((p) => (
          <div
            key={p.tag}
            className="m-card"
            style={{
              padding: 28,
              background: p.accent ? 'var(--m-ivory)' : 'var(--m-paper)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              className="m-label-mono"
              style={{
                color: p.accent ? 'var(--m-orange-2)' : 'var(--m-slate-2)',
              }}
            >
              {p.tag}
            </div>
            <div
              className="m-display"
              style={{
                fontSize: 28,
                color: 'var(--m-ink)',
                lineHeight: 1.05,
                textTransform: 'uppercase',
              }}
            >
              {p.title}
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--m-slate)',
                lineHeight: 1.55,
                minHeight: 80,
              }}
            >
              {p.body}
            </div>
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 16,
                borderTop: '1px solid var(--m-line)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  className="m-display"
                  style={{
                    fontSize: 48,
                    color: p.accent ? 'var(--m-orange)' : 'var(--m-ink)',
                  }}
                >
                  {p.amount}
                </span>
              </div>
              <div
                className="m-mono"
                style={{ fontSize: 11, color: 'var(--m-slate-2)', marginTop: 4 }}
              >
                {p.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .m-pricing-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 1023px) {
          .m-pricing-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

// ─── FAQ (7 collapsible) ──────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How do payments work during the pilot?',
    a: 'Temporarily, every in-app service payment uses a QR-code method — GCash QR or Maya QR. At checkout you scan the QR, pay from your wallet, and the Setnayan team confirms the booking within minutes. This keeps payments fully traceable and zero-Apple-fee while we finalize the Xendit / InstaPay integrations. Card payments and direct bank transfers ship later this year.',
  },
  {
    q: 'Where do I pay — in the app or on the web?',
    a: 'On the web. The Setnayan iOS, Android, Mac, and Windows apps are great for planning, RSVPs, messaging, and uploading photos — but every purchase (vendor booking, milestone payment, in-app service like Panood) opens a secure Safari/Chrome window to setnayan.com to complete. This keeps your receipts, dispute protection, and milestone payment trails all in one place — and avoids the 15–30% surcharge mobile app stores add to in-app purchases. One transaction layer, one source of truth.',
  },
  {
    // 2026-06-13 reprice scrub (Pricing.md § 00.D): RSVP, the wedding website,
    // and QR invitations are paid SKUs — no longer promised as free.
    q: 'Is the planning really free?',
    a: 'Starting is free, and the planning workspace stays free — guest list, seating chart, budget, mood board, and schedule, with no subscription and no per-guest fee. Optional paid software (Setnayan AI matchmaking, the wedding website and RSVP, QR invitations, and the Productions services) is added only when the couple chooses it.',
  },
  {
    q: 'Do I have to be the bride or groom to sign up?',
    a: 'No. Anyone planning can start an event — a parent, a maid of honor, a wedding coordinator. Once your event exists you can invite co-hosts: each one signs in with their own account and gets the same dashboard, the same vendor chats, the same calendar. Roles are scoped, so you can let someone handle the guest list without giving them payment access.',
  },
  {
    q: 'How does Setnayan make money?',
    a: "Three ways. (1) Verified is free (₱0) — getting verified costs nothing. Vendors who want extra reach take an optional 28-day prepaid subscription: ₱6,000/28d Pro or ₱10,000/28d Enterprise (annual prepay saves ~25%). (2) Tokens: a token is ₱100, and a Pro/Enterprise vendor spends 1–3 tokens (₱100–₱300, banded by the wedding's region) to unlock a couple who was matched to them — one unlock covers every service they offer for that wedding. Verified vendors get up to 10 free unlocks a week. (3) Setnayan Productions — the in-app services like Editorial Website, Panood livestream, Papic, SDE, Live Background — are sold by Setnayan directly to couples. We don't touch what couples pay their vendors. Zero commission, zero middleman, zero surcharge.",
  },
  {
    q: 'How do I know a vendor is legit?',
    a: 'Every Setnayan vendor goes through verification before they earn the verified badge — DTI registration, BIR papers, mayor’s permit, and sample work all checked by hand. Unverified vendors are marked “Coming soon”. Reviews from real Setnayan couples sit on every vendor’s profile, so you can see how their last few weddings actually went.',
  },
  {
    q: 'Do I need to download anything?',
    a: 'Not yet. Setnayan runs on the web on any phone or laptop. Native apps for Windows, macOS, iOS, iPadOS, and Android are on the way; we’ll let you know when they land.',
  },
];

export function FAQ({
  vendorPrices,
}: {
  vendorPrices: { proMonthly: string; enterpriseMonthly: string; tokenUnit: string };
}) {
  const [open, setOpen] = useState(0);
  // De-hardcoded: the "how Setnayan makes money" answer reads the vendor prices
  // passed from the (server) page, which read them from the catalog DB.
  const items = FAQ_ITEMS.map((item) =>
    item.q === 'How does Setnayan make money?'
      ? {
          ...item,
          a: `Three ways. (1) Verified is free (₱0) — getting verified costs nothing. Vendors who want extra reach take an optional 28-day prepaid subscription: ${vendorPrices.proMonthly}/28d Pro or ${vendorPrices.enterpriseMonthly}/28d Enterprise (annual prepay saves ~25%). (2) Tokens: a token is ${vendorPrices.tokenUnit}, and a Pro/Enterprise vendor spends 1–3 tokens (banded by the wedding's region) to unlock a couple matched to them — one unlock covers every service they offer for that wedding. Verified vendors get up to 10 free unlocks a week. (3) Setnayan Productions — the in-app services like Editorial Website, Panood livestream, Papic, SDE, Live Background — are sold by Setnayan directly to couples. We don't touch what couples pay their vendors. Zero commission, zero middleman, zero surcharge.`,
        }
      : item,
  );
  return (
    <section
      style={{
        padding: '120px 56px',
        background: 'var(--m-paper-2)',
      }}
    >
      <div className="m-eyebrow">Quick answers</div>
      <h2
        className="m-serif"
        style={{
          fontSize: 'clamp(48px, 6vw, 76px)',
          lineHeight: 1.04,
          margin: '20px 0 16px',
          maxWidth: 1100,
          letterSpacing: '-0.02em',
          color: 'var(--m-ink)',
          fontWeight: 400,
          fontStyle: 'italic',
        }}
      >
        Common questions.
      </h2>
      <div
        className="m-faq-grid"
        style={{
          display: 'grid',
          gap: 56,
          marginTop: 48,
          alignItems: 'start',
        }}
      >
        <p
          style={{
            fontSize: 16,
            color: 'var(--m-slate)',
            lineHeight: 1.6,
            maxWidth: 420,
          }}
        >
          The seven we get most often. Anything else? The{' '}
          <Link href="/help" style={{ color: 'var(--m-orange-2)' }}>
            help center
          </Link>{' '}
          has the long version, and our team replies within a day on email.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                borderTop: '1px solid var(--m-line)',
                padding: '20px 0',
              }}
            >
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  padding: 0,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  color: 'var(--m-ink)',
                }}
                aria-expanded={open === i}
              >
                <span
                  className="m-display"
                  style={{
                    fontSize: 22,
                    textTransform: 'uppercase',
                    letterSpacing: '0.005em',
                  }}
                >
                  {item.q}
                </span>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: '1px solid var(--m-line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    color: 'var(--m-orange-2)',
                    flexShrink: 0,
                    background: open === i ? 'var(--m-orange)' : 'var(--m-paper)',
                    transition: 'background .2s, transform .2s',
                    transform: open === i ? 'rotate(180deg)' : 'rotate(0)',
                  }}
                  aria-hidden
                >
                  {open === i ? (
                    <span style={{ color: '#fff' }}>−</span>
                  ) : (
                    '+'
                  )}
                </span>
              </button>
              {open === i && (
                <p
                  style={{
                    fontSize: 15,
                    color: 'var(--m-slate)',
                    lineHeight: 1.6,
                    marginTop: 14,
                    maxWidth: 720,
                  }}
                >
                  {item.a}
                </p>
              )}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--m-line)' }} />
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .m-faq-grid { grid-template-columns: 1fr 2fr; }
        }
        @media (max-width: 1023px) {
          .m-faq-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}

// ─── ClosingCTA (Set na 'yan moment) ────────────────────────────────────
export function ClosingCTA() {
  return (
    <section
      style={{
        padding: '140px 56px',
        background:
          'linear-gradient(180deg, var(--m-ink) 0%, oklch(28% 0.03 30) 100%)',
        color: 'var(--m-paper)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Big background mark */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -120,
          top: -80,
          opacity: 0.05,
        }}
      >
        <LogoMark size={620} />
      </div>
      <div style={{ position: 'relative', maxWidth: 1100 }}>
        <div className="m-eyebrow" style={{ color: 'var(--m-orange-3)' }}>
          Set na &lsquo;yan.
        </div>
        <h2
          className="m-serif"
          style={{
            fontSize: 'clamp(64px, 10vw, 132px)',
            lineHeight: 1.0,
            margin: '20px 0 16px',
            color: 'var(--m-paper)',
            letterSpacing: '-0.025em',
            fontWeight: 400,
          }}
        >
          Every guest seated.
          <br />
          <em style={{ fontStyle: 'italic', color: 'var(--m-blush)' }}>
            Every vendor paid.
          </em>
          <br />
          <span
            className="m-display"
            style={{
              fontSize: 'clamp(64px, 10vw, 132px)',
              color: 'var(--m-orange)',
            }}
          >
            EVERYTHING&apos;S SET.
          </span>
        </h2>
        <p
          style={{
            fontSize: 19,
            color: 'var(--m-slate-4)',
            maxWidth: 640,
            lineHeight: 1.5,
          }}
        >
          Nothing else like it in the Philippines. Apply now — the Setnayan team
          contacts you within 24 hours with your activation link.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 32,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/signup" className="m-btn m-btn-orange m-btn-lg">
            Apply now
          </Link>
          <Link
            href="/signup?as=vendor"
            className="m-btn m-btn-ghost m-btn-lg"
            style={{
              color: 'var(--m-paper)',
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            You&apos;re a vendor? Register free →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer (5-col compliance footer) ──────────────────────────────────
export function Footer() {
  return (
    <footer
      style={{
        padding: '72px 56px 40px',
        background: 'var(--m-paper)',
        borderTop: '1px solid var(--m-line)',
      }}
    >
      <div
        className="m-footer-grid"
        style={{
          display: 'grid',
          gap: 32,
          alignItems: 'start',
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <Wordmark size={26} />
          <p
            style={{
              fontSize: 13,
              color: 'var(--m-slate)',
              marginTop: 18,
              lineHeight: 1.55,
            }}
          >
            <span
              className="m-serif"
              style={{
                fontStyle: 'italic',
                color: 'var(--m-ink)',
              }}
            >
              &ldquo;Set na &lsquo;yan.&rdquo;
            </span>{' '}
            A Tagalog phrase that means &ldquo;it&rsquo;s all set&rdquo; — the
            moment everything clicks into place. Your venue&rsquo;s booked. Your
            photographer confirmed. Your day is ready.
          </p>
          <div
            className="m-mono"
            style={{
              fontSize: 11,
              color: 'var(--m-slate-3)',
              marginTop: 20,
            }}
          >
            Quezon City, Philippines · © 2026 Setnayan
          </div>
        </div>
        <FooterCol
          title="Navigate"
          items={[
            { label: 'Plan an event', href: '/signup' },
            { label: 'For vendors', href: '/for-vendors' },
            { label: 'About', href: '/' },
            { label: 'Help center', href: '/help' },
            { label: 'Contact', href: '/help#contact' },
            { label: 'Login', href: '/login' },
          ]}
        />
        <FooterCol
          title="Legal"
          items={[
            { label: 'Privacy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
          ]}
        />
        <FooterCol
          title="Compliance"
          items={[
            { label: 'Data Privacy Act compliant', href: '/privacy' },
          ]}
        />
        <FooterCol
          title="Language"
          items={[
            { label: 'en · English', href: '/' },
            { label: 'tl · Tagalog (soon)', href: '/' },
            { label: 'ceb · Sugbuanon (soon)', href: '/' },
          ]}
          mono
        />
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .m-footer-grid { grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr; }
        }
        @media (max-width: 1023px) {
          .m-footer-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 639px) {
          .m-footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </footer>
  );
}

function FooterCol({
  title,
  items,
  mono,
}: {
  title: string;
  items: { label: string; href: string }[];
  mono?: boolean;
}) {
  return (
    <div>
      <div className="m-label-mono" style={{ marginBottom: 12 }}>
        {title}
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {items.map((i) => (
          <li
            key={i.label}
            className={mono ? 'm-mono' : undefined}
            style={{
              fontSize: 13,
              color: 'var(--m-slate)',
            }}
          >
            <Link
              href={i.href}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
