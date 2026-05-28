// Homepage bottom: pricing, event-type readiness, coverage, FAQ, closing CTA, footer

const Pricing = () => (
  <section style={{ padding: "120px 56px" }}>
    <div className="eyebrow">Transparent pricing</div>
    <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", maxWidth: 1100, letterSpacing: "-0.02em", color: "var(--ink)", fontWeight: 400 }}>
      Fixed PHP prices.{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>What you see is what you pay.</em>
    </h2>
    <p style={{ fontSize: 17, color: "var(--slate)", maxWidth: 720, lineHeight: 1.55 }}>
      The planning tools are free forever. Some in-app services are free (mood board, basic
      schedule). Others are pay-per-use (livestream, paparazzi, highlight reel). No subscription,
      no per-guest fee, no checkout surprises — what you see is what you pay.
    </p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 56 }}>
      {[
        { tag: "Free forever",     title: "Planning, every surface.",        body: "Guest list, RSVP, seating, budget, mood board, schedule — every planning tool is free. Pakulay mood board is free too. No paywall, no per-guest fee.", amount: "₱0",   sub: "every month, every guest" },
        { tag: "Bid · unlimited",  title: "Every vendor. Free to ask.",      body: "Send as many bid requests as you want, to as many vendors as you want, at no cost. Every quote that comes back is designed for you — because every wedding is unique and special, and a copy-paste rate card doesn't honor that.", amount: "₱0", sub: "unlimited requests · custom quotes" },
        { tag: "À la carte",       title: "Pay only for what you use.",      body: "In-app services (Panood, Papic, AI highlight reel, custom monogram) are sold by Setnayan Productions like any other vendor. Most are FREE during launch (until 31 Mar 2027).", amount: "₱0–", sub: "launch promo · prices on /pricing", accent: true },
      ].map((p, i) => (
        <Reveal key={p.tag} delay={i * 90}>
          <PriceCard {...p} />
        </Reveal>
      ))}
    </div>
  </section>
);

const PriceCard = ({ tag, title, body, amount, sub, accent }) => (
  <div className="card" style={{
    padding: 28,
    background: accent ? "var(--ivory)" : "var(--paper)",
    display: "flex", flexDirection: "column", gap: 14,
  }}>
    <div className="label-mono" style={{ color: accent ? "var(--orange-2)" : "var(--slate-2)" }}>{tag}</div>
    <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, color: "var(--ink)", lineHeight: 1.05, textTransform: "uppercase" }}>{title}</div>
    <div style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.55, minHeight: 80 }}>{body}</div>
    <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 48, color: accent ? "var(--orange)" : "var(--ink)" }}>{amount}</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 4 }}>{sub}</div>
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Event-type readiness

const EventTypes = () => {
  const types = [
    { name: "Wedding", body: "Full feature set already shipped. Western, Filipino-traditional, and Chinese-wedding templates — tea ceremony, ancestor altar, double-happiness presets all bundled in.", live: true },
    { name: "Gender Reveal", body: "Themed reveal templates, balloon/confetti vendor packages, livestream for relatives abroad." },
    { name: "Debut", body: "18th-birthday packages — formal venues, cotillion, gown designers, hosts." },
    { name: "Birthday Parties", body: "Children's party packages, theme decorators, party planners." },
    { name: "Anniversaries", body: "Surprise-party concierge, intimate-venue partners." },
    { name: "Vow Renewals", body: "Same as wedding, smaller-scale catering." },
    { name: "Baptism", body: "Officiant + reception bundle." },
    { name: "Corporate", body: "Conference AV, team-event venues, corporate emcees." },
    { name: "Reunion", body: "Class, family, or company reunion packages — name tags, slideshow, photo wall." },
    { name: "Homecoming", body: "Alumni events, throwback themes, batch-color palettes, hosted welcome bar." },
    { name: "Prom", body: "High-school and college prom — venue, hair & make-up, photo booth, after-party." },
    { name: "Concerts", body: "Stage rental, lights & sound at scale." },
    { name: "Burial / Wake", body: "Memorial photographers, livestream condolences." },
    { name: "Travel", body: "Out-of-town logistics, destination vendor sourcing." },
    { name: "Celebration", body: "Generic event type for everything else." },
  ];
  return (
    <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
      <div className="eyebrow">Wedding muna. May iba pang darating.</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", maxWidth: 1100, letterSpacing: "-0.02em", color: "var(--ink)", fontWeight: 400 }}>
        Wedding today.{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>Every celebration tomorrow.</em>
      </h2>
      <p style={{ fontSize: 17, color: "var(--slate)", maxWidth: 780, lineHeight: 1.55 }}>
        Setnayan was built event-agnostic from day one. Wedding is live now — every other event
        type opens the moment enough verified vendors are ready to take bookings in that
        category. Your account, your vendor history, your reviews carry across all of them.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 48 }}>
        {types.map((t, i) => (
          <Reveal key={t.name} delay={i * 50}>
            <div style={{
              background: t.live ? "var(--ink)" : "var(--paper)",
              color: t.live ? "var(--paper)" : "var(--ink)",
              border: t.live ? "none" : "1px solid var(--line)",
              borderRadius: "var(--r-md)",
              padding: 18,
              display: "flex", flexDirection: "column", gap: 10,
              minHeight: 160,
              height: "100%",
              transition: "transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, textTransform: "uppercase", color: t.live ? "var(--paper)" : "var(--ink)" }}>
                  {t.name}
                </div>
                <span style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 999,
                  background: t.live ? "var(--orange)" : "var(--paper-2)",
                  color: t.live ? "#fff" : "var(--slate-2)",
                  border: t.live ? "none" : "1px solid var(--line)",
                  fontFamily: "var(--mono)", letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  {t.live ? "Live" : "Soon"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: t.live ? "var(--slate-4)" : "var(--slate)", lineHeight: 1.5 }}>{t.body}</div>
              {!t.live && (
                <a href="#" style={{ marginTop: "auto", color: "var(--orange-2)", fontSize: 12, textDecoration: "none", fontWeight: 500 }}>
                  Notify me when this opens →
                </a>
              )}
            </div>
          </Reveal>
        ))}
        <div style={{
          borderRadius: "var(--r-md)",
          padding: 18,
          border: "1px dashed var(--line)",
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 6,
          color: "var(--slate-2)",
        }}>
          <div className="mono" style={{ fontSize: 11 }}>+ 11 more</div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>
            Each tile opens as soon as enough verified vendors are ready in your area.
          </div>
        </div>
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────
// Coverage

const Coverage = () => (
  <section style={{ padding: "120px 56px" }}>
    <div className="eyebrow">Coverage</div>
    <h2 style={{ fontFamily: "var(--serif)", fontSize: 84, lineHeight: 1.04, margin: "20px 0 16px", maxWidth: 1100, letterSpacing: "-0.025em", color: "var(--ink)", fontWeight: 400 }}>
      From Luzon{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>to Mindanao.</em>
    </h2>
    <p style={{ fontSize: 17, color: "var(--slate)", maxWidth: 720, lineHeight: 1.55 }}>
      City-level coverage only on the public site. Aggregated event counts only — never
      individual events, never barangay-level.
    </p>

    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28, marginTop: 56, alignItems: "start" }}>
      {/* Stylized PH map placeholder */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="photo-placeholder" style={{ aspectRatio: "4/3", position: "relative" }}>
          <span className="pp-label">illustration · stylized PH archipelago</span>
          {/* Pins */}
          {[
            { name: "Metro Manila", count: 84, x: "44%", y: "32%" },
            { name: "Tagaytay",     count: 22, x: "42%", y: "38%" },
            { name: "Baguio",       count: 18, x: "40%", y: "20%" },
            { name: "Iloilo",       count: 14, x: "38%", y: "58%" },
            { name: "Cebu City",    count: 27, x: "52%", y: "60%" },
            { name: "Bohol",        count:  9, x: "56%", y: "66%" },
            { name: "Cagayan de Oro", count: 11, x: "62%", y: "76%" },
            { name: "Davao",        count: 16, x: "68%", y: "84%" },
          ].map((p) => (
            <div key={p.name} style={{
              position: "absolute", left: p.x, top: p.y, transform: "translate(-50%, -100%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <div style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: "3px 8px",
                fontSize: 10, color: "var(--ink)",
                whiteSpace: "nowrap",
                fontFamily: "var(--mono)",
                boxShadow: "var(--shadow-sm)",
              }}>
                {p.name} · {p.count}
              </div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--orange)", border: "2px solid var(--paper)", boxShadow: "0 0 0 1px var(--orange-2)" }} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="label-mono" style={{ marginBottom: 12 }}>Cities live</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["Metro Manila", 84], ["Tagaytay", 22], ["Cebu City", 27], ["Davao", 16],
            ["Baguio", 18], ["Iloilo", 14], ["Cagayan de Oro", 11], ["Bohol", 9],
          ].map(([city, n], i) => (
            <Reveal key={city} delay={i * 60}>
              <div style={{
                padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 10,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--paper)",
                transition: "transform .2s, box-shadow .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{city}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}><Counter to={n} /> weddings</span>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", marginTop: 18, lineHeight: 1.5 }}>
          City pins light up as Setnayan-booked weddings ship in each location. Counts are
          aggregated — we never expose individual events publicly.
        </div>
      </div>
    </div>
  </section>
);

// ──────────────────────────────────────────────────────────────────
// FAQ

const FAQ = () => {
  const [open, setOpen] = React.useState(0);
  const items = [
    {
      q: "How do payments work during the pilot?",
      a: "Temporarily, every in-app service payment uses a QR-code method — GCash QR or Maya QR. At checkout you scan the QR, pay from your wallet, and the Setnayan team confirms the booking within minutes. This keeps payments fully traceable, BIR-compliant, and zero-Apple-fee while we finalize the Xendit / InstaPay integrations. Card payments and direct bank transfers ship later this year.",
    },
    {
      q: "Where do I pay — in the app or on the web?",
      a: "On the web. The Setnayan iOS, Android, Mac, and Windows apps are great for planning, RSVPs, messaging, and uploading photos — but every purchase (vendor booking, milestone payment, in-app service like Panood) opens a secure Safari/Chrome window to setnayan.com to complete. This keeps your BIR receipts, dispute protection, and milestone payment trails all in one place — and avoids the 15–30% surcharge mobile app stores add to in-app purchases. One transaction layer, one source of truth.",
    },
    {
      q: "Is the planning really free?",
      a: "Yes. Guest list, RSVP, seating chart, budget, mood board, schedule, QR invitations — every planning surface is free forever. No subscription. No per-guest fee. No paywall on anything you need to actually run the wedding.",
    },
    {
      q: "Do I have to be the bride or groom to sign up?",
      a: "No. Anyone planning can start an event — a parent, a maid of honor, a wedding coordinator. Once your event exists you can invite co-hosts: each one signs in with their own account and gets the same dashboard, the same vendor chats, the same calendar. Roles are scoped, so you can let someone handle the guest list without giving them payment access.",
    },
    {
      q: "How does Setnayan make money?",
      a: "Three ways. (1) Verified vendors pay a one-time ₱1,499 verification fee, plus an optional monthly subscription if they want extra reach — ₱1,999/mo Pro or ₱5,499/mo Enterprise. (2) Vendors buy tokens to send quotes when couples send them an inquiry. (3) Setnayan Productions — the in-app services like Pro Website, Panood livestream, Papic, SDE, Live Background — are sold by Setnayan directly to couples. We don't touch what couples pay their vendors. Zero commission, zero middleman, zero surcharge.",
    },
    {
      q: "How do I know a vendor is legit?",
      a: "Every Setnayan vendor goes through verification before they earn the verified badge — DTI registration, BIR papers, mayor's permit, and sample work all checked by hand. Unverified vendors are marked “Coming soon”. Reviews from real Setnayan couples sit on every vendor's profile, so you can see how their last few weddings actually went.",
    },
    {
      q: "Do I need to download anything?",
      a: "Not yet. Setnayan runs on the web on any phone or laptop. Native apps for Windows, macOS, iOS, iPadOS, and Android are on the way; we’ll let you know when they land.",
    },
  ];
  return (
    <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
      <div className="eyebrow">Quick answers</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", maxWidth: 1100, letterSpacing: "-0.02em", color: "var(--ink)", fontWeight: 400, fontStyle: "italic" }}>
        Common questions.
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 56, marginTop: 48, alignItems: "start" }}>
        <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.6, maxWidth: 420 }}>
          The six we get most often. Anything else? The{" "}
          <a href="#" style={{ color: "var(--orange-2)" }}>help center</a> has the long version,
          and our team replies within a day on email.
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 50}>
              <div style={{ borderTop: "1px solid var(--line)", padding: "20px 0" }}>
                <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  width: "100%", textAlign: "left", padding: 0,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                  color: "var(--ink)",
                }}>
                  <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, textTransform: "uppercase", letterSpacing: "0.005em" }}>
                    {item.q}
                  </span>
                  <span style={{
                    width: 32, height: 32, borderRadius: "50%",
                    border: "1px solid var(--line)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, color: "var(--orange-2)",
                    flexShrink: 0,
                    background: open === i ? "var(--orange)" : "var(--paper)",
                    transition: "background .2s, transform .2s",
                    transform: open === i ? "rotate(180deg)" : "rotate(0)",
                  }}>
                    {open === i ? <span style={{ color: "#fff" }}>−</span> : "+"}
                  </span>
                </button>
                {open === i && (
                  <p style={{ fontSize: 15, color: "var(--slate)", lineHeight: 1.6, marginTop: 14, maxWidth: 720 }}>
                    {item.a}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────
// Closing CTA

const ClosingCTA = () => (
  <section style={{ padding: "140px 56px", background: "linear-gradient(180deg, var(--ink) 0%, oklch(28% 0.03 30) 100%)", color: "var(--paper)", position: "relative", overflow: "hidden" }}>
    {/* Big background mark */}
    <div style={{ position: "absolute", right: -120, top: -80, opacity: 0.05 }}>
      <LogoMark size={620} ring="var(--paper)" fill="var(--paper)" />
    </div>
    <div style={{ position: "relative", maxWidth: 1100 }}>
      <Reveal>
        <div className="eyebrow" style={{ color: "var(--orange-3)" }}>Set na 'yan.</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 132, lineHeight: 1.0, margin: "20px 0 16px", color: "var(--paper)", letterSpacing: "-0.025em", fontWeight: 400 }}>
          Every guest seated.<br />
          <em style={{ fontStyle: "italic", color: "var(--blush)" }}>Every vendor paid.</em><br />
          <span className="display" style={{ fontSize: 132, fontWeight: 800, color: "var(--orange)" }}>EVERYTHING'S SET.</span>
        </h2>
      </Reveal>
      <Reveal delay={200}>
        <p style={{ fontSize: 19, color: "var(--slate-4)", maxWidth: 640, lineHeight: 1.5 }}>
          Nothing else like it in the Philippines. Apply now — the Setnayan team contacts you
          within 24 hours with your activation link.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
          <button className="btn btn-orange btn-lg">Apply now</button>
          <button className="btn btn-ghost btn-lg" style={{ color: "var(--paper)", borderColor: "rgba(255,255,255,0.2)" }}>
            You’re a vendor? Register free →
          </button>
        </div>
      </Reveal>
    </div>
  </section>
);

// ──────────────────────────────────────────────────────────────────
// Footer

const Footer = () => (
  <footer style={{ padding: "72px 56px 40px", background: "var(--paper)", borderTop: "1px solid var(--line)" }}>
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 32, alignItems: "start" }}>
      <div style={{ maxWidth: 360 }}>
        <LogoFull height={36} />
        <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 18, lineHeight: 1.55 }}>
          <span className="serif" style={{ fontStyle: "italic", color: "var(--ink)" }}>“Set na ‘yan.”</span> A
          Tagalog phrase that means “it’s all set” — the moment everything clicks into place.
          Your venue’s booked. Your photographer confirmed. Your day is ready.
        </p>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", marginTop: 20 }}>
          Quezon City, Philippines · © 2026 Setnayan
        </div>
      </div>
      <FooterCol title="Navigate" items={["Plan an event", "For vendors", "About", "Help center", "Contact", "Login"]} />
      <FooterCol title="Legal" items={["Privacy", "Terms"]} />
      <FooterCol title="Compliance" items={["Tax-compliant receipts", "Data Privacy Act compliant"]} />
      <FooterCol title="Language" items={["en · English", "tl · Tagalog (soon)", "ceb · Sugbuanon (soon)"]} mono />
    </div>
  </footer>
);

const FooterCol = ({ title, items, mono }) => (
  <div>
    <div className="label-mono" style={{ marginBottom: 12 }}>{title}</div>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((i) => (
        <li key={i} style={{
          fontSize: 13, color: "var(--slate)",
          fontFamily: mono ? "var(--mono)" : "inherit",
        }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>{i}</a>
        </li>
      ))}
    </ul>
  </div>
);

Object.assign(window, { Pricing, EventTypes, Coverage, FAQ, ClosingCTA, Footer });
