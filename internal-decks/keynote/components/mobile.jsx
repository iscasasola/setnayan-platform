// Mobile homepage — vertical phone-width layout (390px viewport).
// Renders inside a phone frame on the canvas. Same brand vocabulary,
// trimmed for thumb-zone reading.

const MobileHome = () => (
  <div style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--sans)", paddingBottom: 24 }}>
    {/* Status bar */}
    <div style={{ height: 44, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600 }}>
      <span>9:41</span>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
        <span style={{ fontSize: 10 }}>●●●●</span>
        <span style={{ width: 16, height: 8, borderRadius: 2, background: "var(--ink)", display: "inline-block" }} />
      </span>
    </div>

    {/* Top nav */}
    <div style={{ padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line-soft)" }}>
      <LogoFull height={22} />
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--slate)" }}>Sign in</span>
        <span style={{ width: 22, height: 16, display: "inline-flex", flexDirection: "column", justifyContent: "space-between" }}>
          {[0,1,2].map(i => <span key={i} style={{ height: 2, background: "var(--ink)" }} />)}
        </span>
      </div>
    </div>

    {/* Promo */}
    <div style={{ background: "var(--ink)", color: "var(--paper)", padding: "10px 20px", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--orange)" }}>●</span>
      <span>Planning tools are free forever.</span>
      <a href="#" style={{ color: "var(--orange-3)", marginLeft: "auto", textDecoration: "underline" }}>Start →</a>
    </div>

    {/* Hero */}
    <section style={{ padding: "32px 20px 20px" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--slate-2)", marginBottom: 14 }}>
        SET NA ‘YAN · /sɛt na jan/
      </div>
      <h1 className="display" style={{ fontSize: 56, lineHeight: 1.02, margin: 0, letterSpacing: "-0.005em" }}>
        PLANNING<br />A WEDDING?<br />
        <span style={{ color: "var(--orange)" }}>WE’LL SET IT UP.</span>
      </h1>
      <p style={{ fontSize: 15, color: "var(--slate)", lineHeight: 1.5, marginTop: 18 }}>
        The only Filipino-built platform with real operating tools — guest list, vendors,
        invitations, livestream, same-day highlight reel.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
        <button className="btn btn-primary" style={{ justifyContent: "center", padding: "14px 20px" }}>
          Start planning <span style={{ color: "var(--orange-3)" }}>· free</span>
        </button>
        <button className="btn btn-ghost" style={{ justifyContent: "center", padding: "14px 20px" }}>I’m a vendor →</button>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 16, lineHeight: 1.5 }}>
        Built in the Philippines · BIR-compliant receipts · English today, Tagalog soon
      </div>
    </section>

    {/* Hero collage card */}
    <section style={{ padding: "0 20px 32px" }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="photo-placeholder" style={{ aspectRatio: "5/4" }}>
          <span className="pp-label">photo · couple at golden hour</span>
        </div>
        <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="label-mono" style={{ fontSize: 9 }}>Live · sample wedding</div>
            <div className="serif" style={{ fontSize: 22, fontStyle: "italic", color: "var(--ink)", marginTop: 2 }}>Maria & Juan</div>
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)" }}>12 · 12 · 26</div>
        </div>
      </div>
    </section>

    {/* What's live today */}
    <section style={{ padding: "0 20px 40px" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>What’s live today</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["BIR receipts","QR invitations","Vendor marketplace","Livestream","Highlight reel","Multi-host","In-app chat","Milestone pay"].map(t => (
          <span key={t} className="pill" style={{ fontSize: 11, padding: "5px 10px" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--sage-deep)" }} />
            {t}
          </span>
        ))}
      </div>
    </section>

    {/* Problem */}
    <section style={{ padding: "40px 20px", background: "var(--paper-2)" }}>
      <div className="eyebrow">Sounds familiar?</div>
      <h2 className="display" style={{ fontSize: 40, lineHeight: 1.04, marginTop: 14, color: "var(--ink)" }}>
        FIVE APPS.<br />THREE SHEETS.<br />
        <span style={{ color: "var(--orange)" }}>A 11PM WHATSAPP GROUP.</span>
      </h2>
      <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.5, marginTop: 14 }}>
        Most Filipino couples plan a wedding across five apps and a barangay full of people asking
        when the dress code drops. Vendors aren’t any better off.
      </p>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          ["WhatsApp · 11pm", "“sino mag-pa-print ng QR?”"],
          ["Budget · v8 final", "₱2M, mostly guessed"],
          ["GCash · receipts", "screenshots, somewhere"],
          ["Drive · vendor PDFs", "14 PDFs, 6 versions"],
        ].map(([tag, body]) => (
          <div key={tag} className="card" style={{ padding: 12 }}>
            <div className="label-mono" style={{ fontSize: 9 }}>{tag}</div>
            <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>{body}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 20, background: "var(--ink)", color: "var(--paper)", border: "none", marginTop: 16 }}>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>One place</div>
        <div className="display" style={{ fontSize: 28, color: "var(--paper)", marginTop: 6 }}>
          SET NA <span style={{ color: "var(--orange)" }}>‘</span>YAN.
        </div>
        <div style={{ fontSize: 13, color: "var(--slate-4)", marginTop: 8, lineHeight: 1.5 }}>
          Every moving piece, in the same app you’ll use on the day.
        </div>
      </div>
    </section>

    {/* Two sides */}
    <section style={{ padding: "40px 20px" }}>
      <div className="eyebrow">Built for both sides</div>
      <h2 className="display" style={{ fontSize: 40, lineHeight: 1.04, marginTop: 14, color: "var(--ink)" }}>
        WE DIDN’T <span style={{ color: "var(--orange)" }}>PICK A SIDE.</span>
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
        <MobileSide tone="paper" tag="For couples" head="Plan it once. Together." items={[
          "Free forever — guest list, RSVP, seating, budget, mood board.",
          "Personal QR invitations with your monogram.",
          "Day-of live broadcast + paparazzi crew.",
          "Same-day highlight reel — 30 min after the kiss.",
        ]} />
        <MobileSide tone="ink" tag="For vendors" head="Run the business, not your DMs." items={[
          "Free listing + chat with couples.",
          "Real calendar with team roles, agent privacy.",
          "In-app payments, BIR receipts, 2307 done for you.",
          "Sponsored boost when you’re ready to scale.",
        ]} />
      </div>
    </section>

    {/* Pricing */}
    <section style={{ padding: "40px 20px", background: "var(--paper-2)" }}>
      <div className="eyebrow">Transparent pricing</div>
      <h2 className="display" style={{ fontSize: 38, lineHeight: 1.04, marginTop: 14 }}>
        FREE TO PLAN.<br /><span style={{ color: "var(--orange)" }}>WHAT YOU SEE IS WHAT YOU PAY.</span>
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
        <PriceMini tag="Free forever" amount="₱0" body="Every planning surface — guest list, RSVP, seating, budget, mood board." />
        <PriceMini tag="À la carte" amount="₱0–" body="Pay-per-feature. Free during launch (until Mar 31, 2027)." accent />
        <PriceMini tag="0% commission" amount="₱0" body="Setnayan never takes a cut of vendor bookings. Vendors keep 100% of what couples pay. Setnayan's revenue is verification fee + vendor subscriptions + per-action SKUs — not a transactional cut." />
      </div>
    </section>

    {/* Closing CTA */}
    <section style={{ padding: "48px 20px", background: "var(--ink)", color: "var(--paper)", textAlign: "left" }}>
      <div className="eyebrow" style={{ color: "var(--orange-3)" }}>Set na ‘yan.</div>
      <h2 className="display" style={{ fontSize: 64, lineHeight: 1.02, marginTop: 12, color: "var(--paper)" }}>
        EVERYTHING’S <span style={{ color: "var(--orange)" }}>SET.</span>
      </h2>
      <p style={{ fontSize: 14, color: "var(--slate-4)", marginTop: 12, lineHeight: 1.5 }}>
        Apply now. The Setnayan team contacts you within 24 hours with your activation link.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
        <button className="btn btn-orange" style={{ justifyContent: "center", padding: "14px 20px" }}>Apply now</button>
        <button className="btn btn-ghost" style={{ justifyContent: "center", padding: "14px 20px", color: "var(--paper)", borderColor: "rgba(255,255,255,0.18)" }}>
          I’m a vendor — register free →
        </button>
      </div>
    </section>

    {/* Footer mini */}
    <footer style={{ padding: "24px 20px", background: "var(--paper)" }}>
      <LogoFull height={22} />
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 12 }}>
        Quezon City, Philippines · © 2026 Setnayan · BIR-compliant · RA 10173
      </div>
    </footer>
  </div>
);

const MobileSide = ({ tone, tag, head, items }) => {
  const dark = tone === "ink";
  return (
    <div style={{
      background: dark ? "var(--ink)" : "var(--paper)",
      color: dark ? "var(--paper)" : "var(--ink)",
      border: dark ? "none" : "1px solid var(--line)",
      borderRadius: 18, padding: 20,
    }}>
      <div className="label-mono" style={{ color: dark ? "var(--orange-3)" : "var(--slate-2)" }}>{tag}</div>
      <div className="display" style={{ fontSize: 24, marginTop: 8, color: dark ? "var(--paper)" : "var(--ink)" }}>{head}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((t, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, fontSize: 13, lineHeight: 1.45, color: dark ? "var(--paper)" : "var(--slate)" }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--orange)" }}>{String(i+1).padStart(2,"0")}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <button className={dark ? "btn btn-orange" : "btn btn-primary"} style={{ padding: "10px 16px", fontSize: 12 }}>
        {dark ? "Register free" : "Start planning"}
      </button>
    </div>
  );
};

const PriceMini = ({ tag, amount, body, accent }) => (
  <div className="card" style={{ padding: 16, background: accent ? "var(--ivory)" : "var(--paper)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div className="label-mono" style={{ color: accent ? "var(--orange-2)" : "var(--slate-2)" }}>{tag}</div>
      <div className="display" style={{ fontSize: 24, color: accent ? "var(--orange)" : "var(--ink)" }}>{amount}</div>
    </div>
    <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 6, lineHeight: 1.5 }}>{body}</div>
  </div>
);

Object.assign(window, { MobileHome });
