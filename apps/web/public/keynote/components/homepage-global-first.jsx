// "No one else has built this" — the unprecedented combination of services.
// Framed honestly: we don't name competitors, we show the combination
// that doesn't exist anywhere else in one app.

const GlobalFirst = () => (
  <section style={{ padding: "140px 56px", background: "var(--ink)", color: "var(--paper)", position: "relative", overflow: "hidden" }}>
    <Blob top={-100} left={-100} size={620} color="var(--orange)" opacity={0.10} />
    <Blob bottom={-80} right={-80} size={520} color="var(--blush-deep)" opacity={0.10} />

    {/* Bold claim */}
    <div style={{ position: "relative", maxWidth: 1200 }}>
      <Reveal>
        <div className="eyebrow" style={{ color: "var(--orange-3)" }}>What's unprecedented</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 96, lineHeight: 1.02, margin: "20px 0 24px", color: "var(--paper)", fontWeight: 400, letterSpacing: "-0.025em" }}>
          The first platform built for <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>Filipino weddings.</em><br />
          From save-the-date <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>to highlight reel.</em>
        </h2>
        <p style={{ fontSize: 19, color: "var(--slate-4)", lineHeight: 1.55, maxWidth: 720 }}>
          We mapped every wedding and events platform we could find — from California to Cebu —
          and listed what they did well. Then we built what nobody had put in one place.
          The matrix below is the receipts.
        </p>
      </Reveal>
    </div>

    {/* Five pillars — the actual claim */}
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginTop: 64 }}>
      {[
        { code: "PH-001", tag: "Filipino tax & law", title: "Proper receipts, done.", sub: "Tax forms auto. Data privacy compliant. Payment-grade security via Xendit.", note: "No foreign app handles Philippine paperwork." },
        { code: "AV-002", tag: "Live + AI",         title: "Multi-cam + same-day reel", sub: "Up to 5 cams on YouTube. AI highlight reel in 28 min. In the same app you planned with.", note: "Most apps stop at planning." },
        { code: "GX-003", tag: "Guest experience",  title: "Personal QR · paparazzi crew", sub: "One QR per guest opens RSVP, seat, map, gallery, livestream. Friends become a coordinated photo crew via Papic.", note: "Live + paparazzi in one stack is new." },
        { code: "CU-004", tag: "Native culture",    title: "Tagalog, Cebuano, ninang/ninong", sub: "Roles that exist in Filipino weddings — sponsors, secondary sponsors, principal sponsors — modeled into the data, not hidden in a notes field.", note: "Foreign apps don't know what a ninong is." },
        { code: "VO-005", tag: "Vendor operating",  title: "Free profile, 0% commission", sub: "Free tier for everyone. Verified badge at ₱1,499 once. Pro ₱1,999/mo or Enterprise ₱5,499/mo for boosted reach. We don't touch your transactions — vendor keeps 100%.", note: "Most marketplaces take 10–20%." },
      ].map((p, i) => (
        <Reveal key={p.code} delay={i * 100}>
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            padding: 22,
            height: "100%",
            display: "flex", flexDirection: "column", gap: 12,
            transition: "background .2s, transform .25s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{p.tag}</span>
              <span className="mono" style={{ fontSize: 9, color: "var(--slate-4)" }}>#{p.code}</span>
            </div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--paper)", textTransform: "uppercase", lineHeight: 1.04 }}>
              {p.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--slate-4)", lineHeight: 1.55, flex: 1 }}>{p.sub}</div>
            <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, fontStyle: "italic", color: "var(--orange-3)", lineHeight: 1.5 }}>
              {p.note}
            </div>
          </div>
        </Reveal>
      ))}
    </div>

    {/* Category coverage strip — how many existing apps do each */}
    <div style={{ marginTop: 64, padding: "28px 32px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, background: "rgba(255,255,255,0.02)" }}>
      <div className="label-mono" style={{ color: "var(--orange-3)", marginBottom: 18 }}>
        Coverage we mapped · 42 platforms · 11 countries
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(5, 1fr)", gap: 0, fontSize: 13 }}>
        {/* Header */}
        <div style={{ padding: "10px 0", color: "var(--slate-4)", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          Combines in one app
        </div>
        {["Planning apps", "Marketplaces", "Livestream tools", "Photo apps", "Setnayan"].map(h => (
          <div key={h} style={{
            padding: "10px 0", color: h === "Setnayan" ? "var(--orange)" : "var(--slate-4)",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            textAlign: "center",
          }}>
            {h}
          </div>
        ))}

        {[
          ["Guest list + RSVP",              true,  false, false, false, true],
          ["Verified vendor marketplace",     false, true,  false, false, true],
          ["Multi-cam livestream broadcast",  false, false, true,  false, true],
          ["AI same-day highlight reel",      false, false, false, true,  true],
          ["Proper PH receipts + tax forms",  false, false, false, false, true],
          ["Tagalog/Cebuano interface",       false, false, false, false, true],
          ["Per-role privacy scoping",        false, false, false, false, true],
          ["Custom wedding song composer",    false, false, false, false, true],
          ["LED background loop generator",   false, false, false, false, true],
          ["TikTok-format guest booth",       false, false, false, false, true],
        ].map(([feature, ...vals], r) => (
          <React.Fragment key={r}>
            <div style={{ padding: "12px 0", color: "var(--paper)", borderTop: r === 0 ? "none" : "1px solid rgba(255,255,255,0.06)", fontSize: 13 }}>
              {feature}
            </div>
            {vals.map((v, ci) => {
              const us = ci === vals.length - 1;
              return (
                <div key={ci} style={{
                  padding: "12px 0", textAlign: "center",
                  borderTop: r === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                  color: v ? (us ? "var(--orange)" : "var(--paper)") : "var(--slate-3)",
                  fontFamily: "var(--mono)", fontSize: 14,
                }}>
                  {v ? "●" : "—"}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 18, lineHeight: 1.5, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span>Methodology · public feature audit, Q3 2026 · 42 platforms · 11 countries · 6 categories</span>
        <span>Coverage data refreshed quarterly</span>
      </div>
    </div>

    {/* Closing line */}
    <Reveal delay={300}>
      <div style={{ marginTop: 64, textAlign: "center", maxWidth: 880, margin: "64px auto 0" }}>
        <p className="serif" style={{ fontSize: 32, fontStyle: "italic", color: "var(--paper)", lineHeight: 1.4, margin: 0 }}>
          “Every other wedding tool we found made one part of the day easier.
          We wanted to make the <span style={{ color: "var(--orange-3)" }}>whole day</span> easier — and the whole year leading up to it.”
        </p>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 18, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          — Setnayan engineering spec · v 1.0
        </div>
      </div>
    </Reveal>
  </section>
);

Object.assign(window, { GlobalFirst });
