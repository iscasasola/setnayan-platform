/**
 * CreatorStory* — the narrative sections of the /creators storyteller page,
 * mirroring the /vendors marketing-page pattern (vendor-grow-sections.tsx:
 * same primitives, same Clean Editorial --m-* tokens, same section rhythm).
 *
 * Flow: thesis strip → the wedge (a reel dead-ends; a Chapter books) →
 * anatomy of a Chapter (dark signature: embed + shoppable vendors mock) →
 * why storytellers publish here → who it's for → the one-breath band →
 * closing CTA.
 *
 * COPY DISCIPLINE — pitch only what is SHIPPED: public Chapters on /u/[slug]
 * (edit EMBEDDED from YouTube / TikTok / Instagram — Setnayan never hosts it),
 * shoppable vendor cards from the real event, followers + view counts, the
 * Storyteller (Creator) badge, featuring on Real Stories, and vendors sending
 * token-gated exclusive discount offers. Free forever; storytellers keep their
 * own channel monetization. Do NOT promise: audience promos on the Book
 * button, tier names, per-booking earnings, or cash of any kind.
 *
 * Radii route through --m-r-* per the radius-token lint guard. Server
 * components (no hooks).
 */
import Link from 'next/link';

/* ── shared primitives (the /vendors page vocabulary) ──────────────────── */

function Eyebrow({ children, center, onDark }: { children: React.ReactNode; center?: boolean; onDark?: boolean }) {
  return (
    <span
      className="m-mono"
      style={{
        fontSize: 11,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: onDark ? 'var(--m-orange)' : 'var(--m-orange-2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: center ? 'center' : undefined,
      }}
    >
      <span aria-hidden style={{ width: 24, height: 1, background: 'var(--m-orange)' }} />
      {children}
    </span>
  );
}

function H2({ children, onDark }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <h2
      className="m-serif"
      style={{
        fontSize: 'clamp(28px, 4.6vw, 50px)',
        lineHeight: 1.04,
        letterSpacing: '-0.01em',
        margin: '14px 0',
        fontWeight: 500,
        color: onDark ? '#fff' : 'var(--m-ink)',
        textWrap: 'balance',
      }}
    >
      {children}
    </h2>
  );
}

function Lede({ children, onDark, style }: { children: React.ReactNode; onDark?: boolean; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 17, color: onDark ? 'var(--m-mulberry-3)' : 'var(--m-slate)', margin: 0, lineHeight: 1.6, ...style }}>
      {children}
    </p>
  );
}

const SECTION: React.CSSProperties = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: 'clamp(56px, 8vw, 104px) clamp(20px, 5vw, 56px)',
};

const SPLIT: React.CSSProperties = {
  display: 'grid',
  gap: 'clamp(28px, 5vw, 64px)',
  alignItems: 'center',
};

function FeatureLI({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <li style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--m-r-sm)',
          background: 'var(--m-orange-4)',
          color: 'var(--m-orange-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 15,
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 15 }}>
        <b style={{ fontWeight: 700, color: 'var(--m-ink)' }}>{title}</b>
        <span style={{ color: 'var(--m-slate)', display: 'block', fontSize: 14, marginTop: 2, lineHeight: 1.5 }}>{body}</span>
      </span>
    </li>
  );
}

function GridCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="m-card m-card-lift" style={{ padding: 24 }}>
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--m-r-sm)',
          background: 'var(--m-ink)',
          color: 'var(--m-orange-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <h3 className="m-serif" style={{ fontSize: 21, fontWeight: 600, margin: '0 0 7px', color: 'var(--m-ink)' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13.5, color: 'var(--m-slate)', margin: 0, lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-cgrid" style={{ display: 'grid', gap: 16, marginTop: 36 }}>
      {children}
    </div>
  );
}

/* ── 0 · THESIS STRIP ──────────────────────────────────────────────────── */

export function CreatorStoryThesis() {
  const items = [
    { b: '₱0', s: 'to publish, forever — storytellers never pay Setnayan a peso' },
    { b: 'Yours', s: 'your edit stays on your channel, embedded here — you keep its monetization' },
    { b: 'Courted', s: 'vendors who like your audience send you exclusive discount offers' },
  ];
  return (
    <div style={{ background: 'var(--m-ink)', color: 'var(--m-mulberry-3)' }}>
      <div
        className="m-cthesis-in"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: 'clamp(34px, 5vw, 52px) clamp(20px, 5vw, 56px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 22,
        }}
      >
        {items.map((t) => (
          <div key={t.b}>
            <b className="m-serif" style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--m-orange-3)', display: 'block', lineHeight: 1.1, fontWeight: 600 }}>
              {t.b}
            </b>
            <span style={{ fontSize: 13.5, color: 'var(--m-mulberry-3)', display: 'block', marginTop: 8, lineHeight: 1.5 }}>{t.s}</span>
          </div>
        ))}
      </div>
      <style>{`@media(max-width:720px){ .m-cthesis-in{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}

/* ── 1 · THE WEDGE — a reel dead-ends; a Chapter books ─────────────────── */

export function CreatorStoryWedge() {
  return (
    <section id="wedge" style={SECTION}>
      <div className="m-csplit" style={SPLIT}>
        <div style={{ maxWidth: '60ch' }}>
          <Eyebrow>The wedge</Eyebrow>
          <H2>A reel on a feed dead-ends. A Chapter carries the real event.</H2>
          <Lede>
            Someone watches your wedding film, loves the venue, loves the florals — and then the
            feed moves on. There&rsquo;s nowhere to go. A Chapter is the same edit with the actual
            event behind it: the real vendors who made it, each one a card a viewer can open and
            inquire with.
          </Lede>
          <Lede style={{ marginTop: 16 }}>
            Your taste stops being just content people admire. It becomes the thing people plan
            with — with a credit card open.
          </Lede>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FeatureLI icon="▶" title="Your edit, embedded" body="From YouTube, TikTok or Instagram — Setnayan never hosts or re-uploads your video." />
          <FeatureLI icon="🛍" title="The event, shoppable" body="The real vendors behind your event, credited as cards viewers can actually book from." />
          <FeatureLI icon="📖" title="A timeline, not a feed" body="No random posts — substantial events only. Your page reads as a body of work." />
        </ul>
      </div>
    </section>
  );
}

/* ── 2 · ANATOMY OF A CHAPTER (DARK SIGNATURE) ─────────────────────────── */

export function CreatorStoryChapter() {
  return (
    <div style={{ background: 'var(--m-ink)', color: 'var(--m-mulberry-3)' }}>
      <section id="chapter" style={{ ...SECTION, paddingTop: 'clamp(56px, 8vw, 100px)', paddingBottom: 'clamp(56px, 8vw, 100px)' }}>
        <div className="m-cchapter-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 'clamp(28px, 5vw, 56px)', alignItems: 'center' }}>
          <div>
            <Eyebrow onDark>Anatomy of a Chapter</Eyebrow>
            <H2 onDark>One page. Your film on top, the real event underneath.</H2>
            <Lede onDark>
              Every Chapter lives on your own public page — <b style={{ color: '#fff' }}>setnayan.com/u/yourname</b>.
              Your finished edit plays embedded from your channel, and below it sits the substrate
              nothing else on the internet carries: the real, bookable event.
            </Lede>
            <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { n: '1', t: 'The embed', p: 'Your YouTube / TikTok / Instagram edit, playing inside the Chapter. Views and monetization stay on your channel — we just give it a home that converts.' },
                { n: '2', t: 'Shop this event', p: 'The vendors who made the day — venue, photo, florals, catering — credited as cards a viewer can open and inquire with. 0% commission, as always.' },
                { n: '3', t: 'Your audience layer', p: 'Followers and view counts on your page, plus the Storyteller badge once you’ve published. Standout Chapters get featured on Setnayan’s Real Stories page.' },
              ].map((s) => (
                <li
                  key={s.n}
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(197,160,89,.24)',
                    borderRadius: 'var(--m-r-md)',
                    padding: '18px 20px',
                  }}
                >
                  <b style={{ fontWeight: 700, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span
                      className="m-mono"
                      aria-hidden
                      style={{
                        fontSize: 11,
                        color: 'var(--m-ink)',
                        background: 'var(--m-orange)',
                        width: 22,
                        height: 22,
                        borderRadius: 'var(--m-r-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {s.n}
                    </span>
                    {s.t}
                  </b>
                  <p style={{ fontSize: 14, color: 'var(--m-mulberry-3)', margin: '8px 0 0', paddingLeft: 31, lineHeight: 1.5 }}>{s.p}</p>
                </li>
              ))}
            </ul>
          </div>
          {/* Chapter-page mock — embed frame + shoppable vendor cards. */}
          <div
            aria-hidden
            style={{
              background: 'linear-gradient(160deg, #211a26, #151019)',
              border: '1px solid rgba(197,160,89,.3)',
              borderRadius: 'var(--m-r-lg)',
              padding: 22,
              boxShadow: '0 30px 70px -30px rgba(0,0,0,.7)',
            }}
          >
            <div
              style={{
                borderRadius: 'var(--m-r-md)',
                background: 'rgba(255,255,255,.06)',
                aspectRatio: '16 / 9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--m-r-full)',
                  background: 'var(--m-orange)',
                  color: 'var(--m-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                ▶
              </span>
            </div>
            <small className="m-mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--m-orange-2)', display: 'block', marginBottom: 8 }}>
              Shop this wedding
            </small>
            {[
              { v: 'The Glasshouse, Tagaytay', c: 'Venue' },
              { v: 'Hiraya Films', c: 'Photo & video' },
              { v: 'Flora & Fern Studio', c: 'Florals & styling' },
            ].map((r) => (
              <div
                key={r.v}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  background: 'rgba(255,255,255,.05)',
                  border: '1px solid rgba(197,160,89,.18)',
                  borderRadius: 'var(--m-r-sm)',
                  padding: '11px 14px',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, color: '#e4dac7', fontWeight: 600 }}>
                  {r.v}
                  <span className="m-mono" style={{ display: 'block', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--m-mulberry-3)', marginTop: 3, fontWeight: 400 }}>
                    {r.c}
                  </span>
                </span>
                <span className="m-mono" style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--m-orange)', border: '1px solid rgba(197,160,89,.4)', borderRadius: 'var(--m-r-full)', padding: '5px 10px', flexShrink: 0 }}>
                  View vendor
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <style>{`@media(max-width:820px){ .m-cchapter-grid{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}

/* ── 3 · WHY STORYTELLERS PUBLISH HERE ─────────────────────────────────── */

export function CreatorStoryWhy() {
  return (
    <section style={SECTION}>
      <div style={{ maxWidth: '60ch' }}>
        <Eyebrow>Why publish here</Eyebrow>
        <H2>Additive, not rival. Your channel keeps earning — this converts.</H2>
        <Lede>
          Setnayan isn&rsquo;t another platform asking you to feed it. Your edit stays where it
          already earns; a Chapter gives it a permanent, bookable home — and puts your taste in
          front of the vendors who want to work with you.
        </Lede>
      </div>
      <CardGrid>
        <GridCard icon="🎁" title="Vendors court you" body="Vendors who like your audience send you exclusive discount offers — real rates off your next event, in exchange for a Chapter that credits them. Live today." />
        <GridCard icon="⚡" title="Zero setup" body="No new channel to grow, no re-uploads, no format to learn. Paste your published edit, credit the vendors, done." />
        <GridCard icon="📺" title="Your monetization, untouched" body="The video is embedded from your channel — its views, ads and deals stay 100% yours. Setnayan never hosts your edit." />
        <GridCard icon="🏛" title="Permanence, not a feed" body="A Chapter doesn't scroll away. Your page is a timeline of substantial events — a portfolio that compounds." />
        <GridCard icon="⭐" title="The Storyteller badge" body="Publish a public Chapter and your page carries the storyteller mark — a signal to vendors and viewers alike." />
        <GridCard icon="📰" title="Featured on Real Stories" body="Standout Chapters get pulled onto Setnayan's Real Stories showcase — distribution to people actively planning." />
      </CardGrid>
    </section>
  );
}

/* ── 4 · WHO IT'S FOR ──────────────────────────────────────────────────── */

export function CreatorStoryWho() {
  return (
    <section style={{ ...SECTION, paddingTop: 0 }}>
      <div style={{ maxWidth: '60ch' }}>
        <Eyebrow>Who it&rsquo;s for</Eyebrow>
        <H2>Made for content people watch with a credit card open.</H2>
        <Lede>
          If your audience watches your work and asks &ldquo;who made that? where is that? how much
          was that?&rdquo; — a Chapter is the answer you&rsquo;ve never had a place to give.
        </Lede>
      </div>
      <CardGrid>
        <GridCard icon="💍" title="Wedding creators" body="Films, vlogs, BTS — your couples' days become bookable Chapters, and every vendor you credit knows exactly who sent the inquiry." />
        <GridCard icon="✈" title="Travel creators" body="A trip Chapter is shoppable: the stays, the kitchens, the guides behind your itinerary — leads for them, offers for you." />
        <GridCard icon="🎉" title="Event & lifestyle creators" body="Debuts, birthdays, food crawls, fiestas — any real event you cover can carry its real, credited suppliers." />
      </CardGrid>
    </section>
  );
}

/* ── 5 · THE ONE-BREATH BAND ───────────────────────────────────────────── */

export function CreatorStoryOneBreath() {
  return (
    <div style={{ background: 'var(--m-orange-4)' }}>
      <section style={{ ...SECTION, textAlign: 'center' }}>
        <Eyebrow center>In one breath</Eyebrow>
        <H2>
          Post the story of your event for free. Vendors who like your audience will offer you a
          discount in exchange for a chapter that credits them.
        </H2>
        <Lede style={{ maxWidth: '56ch', margin: '0 auto' }}>
          That&rsquo;s the whole deal. No fees, no exclusivity, no cut of anything you earn
          elsewhere — the discount is between you and the vendor.
        </Lede>
      </section>
    </div>
  );
}

/* ── CLOSING CTA ───────────────────────────────────────────────────────── */

export function CreatorStoryCTA() {
  return (
    <div style={{ textAlign: 'center', background: 'var(--m-paper)', borderTop: '1px solid var(--m-line)' }}>
      <section style={SECTION}>
        <Eyebrow center>Free, forever</Eyebrow>
        <H2>Publish your story.</H2>
        <Lede style={{ margin: '0 auto 26px', maxWidth: '48ch' }}>
          Any Setnayan account can publish a Chapter — your first real event is all it takes to
          become a storyteller.
        </Lede>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" className="m-btn m-btn-primary m-btn-lg">
            Publish your story — free
          </Link>
          <Link href="/realstories" className="m-btn m-btn-ghost m-btn-lg">
            See Real Stories
          </Link>
        </div>
        <p style={{ maxWidth: 1120, margin: '26px auto 0', textAlign: 'center', fontSize: 12, color: 'var(--m-slate-3)', fontStyle: 'italic' }}>
          Free for storytellers, always · your edit stays on your channel · Setnayan never hosts your video.
        </p>
      </section>
    </div>
  );
}

/* ── responsive helpers ────────────────────────────────────────────────── */

export function CreatorStoryStyles() {
  return (
    <style>{`
      .m-cgrid { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 820px) { .m-cgrid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 520px) { .m-cgrid { grid-template-columns: 1fr; } }
      .m-csplit { grid-template-columns: 1fr 1fr; }
      @media (max-width: 800px) { .m-csplit { grid-template-columns: 1fr !important; gap: 32px !important; } }
    `}</style>
  );
}
