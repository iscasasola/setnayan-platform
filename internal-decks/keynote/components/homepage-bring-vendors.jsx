// "Bring your own vendors" — couple-facing section.
// Couples can invite vendors they already know/trust to join Setnayan for free,
// so the vendor can plug into the same dashboard the couple is using.
// Answers the natural question: "What if my Tita's florist isn't on Setnayan?"

const BringYourVendors = () => (
  <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
      <Reveal>
        <div className="eyebrow">Already have a vendor in mind?</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", letterSpacing: "-0.02em", color: "var(--ink)", fontWeight: 400 }}>
          Bring your <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>own vendors.</em>
        </h2>
        <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 19, color: "var(--slate)", maxWidth: 540, lineHeight: 1.65 }}>
          Tita's florist already booked? Pastor scheduled? Coordinator on retainer?
          <span style={{ fontStyle: "normal", fontFamily: "var(--sans)", fontSize: 16, color: "var(--slate)" }}>{" "}Send them a link — they sign up free, plug into your event in two minutes, and suddenly you're all working from the same dashboard. Free for vendors, forever.</span>
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button className="btn btn-orange btn-lg">Invite a vendor</button>
          <button className="btn btn-ghost btn-lg">Copy invite link</button>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 18, lineHeight: 1.5 }}>
          Vendor link expires in 14 days · revoke anytime from your dashboard
        </div>
      </Reveal>

      {/* Right: invite-flow mock */}
      <Reveal delay={150}>
        <div className="card" style={{ padding: 28, position: "relative", overflow: "hidden" }}>
          <div className="label-mono" style={{ color: "var(--orange-2)" }}>Your invite · how it works</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
            {[
              {
                step: "01",
                title: "Send",
                body: "Type your vendor's name + email. We generate a one-tap signup link.",
                pill: "30 seconds",
              },
              {
                step: "02",
                title: "They join · free",
                body: "Vendor clicks the link, fills in their business name + service category. Verified within 24h.",
                pill: "₱0 to them",
              },
              {
                step: "03",
                title: "Auto-linked to your event",
                body: "Their account appears as Booked in your vendor tab. Chat, calendar, payments all live in one thread.",
                pill: "Synced",
              },
            ].map((s, i) => (
              <div key={s.step} style={{
                display: "grid", gridTemplateColumns: "40px 1fr auto", gap: 14, alignItems: "center",
                padding: "14px 16px",
                background: i === 0 ? "var(--orange-4)" : "var(--paper-2)",
                borderRadius: 12,
                border: i === 0 ? "1px solid var(--orange-3)" : "1px solid var(--line)",
              }}>
                <div className="mono" style={{ fontSize: 14, color: i === 0 ? "var(--orange-2)" : "var(--slate-2)", fontWeight: 500 }}>
                  {s.step}
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{s.title}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>
                </div>
                <span className="pill" style={{
                  fontSize: 10, padding: "3px 9px",
                  background: i === 0 ? "var(--orange)" : "var(--paper)",
                  color: i === 0 ? "#fff" : "var(--slate-2)",
                  borderColor: "transparent",
                }}>{s.pill}</span>
              </div>
            ))}
          </div>

          {/* Example invite card */}
          <div style={{ marginTop: 16, padding: 14, background: "var(--ink)", color: "var(--paper)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--orange-4)", color: "var(--orange-2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500 }}>
              T
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--paper)" }}>Tita's Garden Florals</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)", marginTop: 2 }}>florist · QC · invited 2h ago</div>
            </div>
            <span className="pill pill-orange" style={{ fontSize: 10, padding: "3px 9px" }}>Joined ✓</span>
          </div>
        </div>
      </Reveal>
    </div>

    {/* Closing line — answering the next question */}
    <div style={{ marginTop: 56, padding: "20px 28px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--paper)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <div>
        <div className="label-mono">What if my vendor doesn't want to use the app?</div>
        <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 4 }}>
          That's fine too. You can log them in manually as an "off-platform" vendor — you'll
          just track contracts and payments yourself in the dashboard. No vendor left out.
        </div>
      </div>
      <a href="#" style={{ color: "var(--orange-2)", fontSize: 13, textDecoration: "none", fontWeight: 500, flexShrink: 0 }}>
        How off-platform vendors work →
      </a>
    </div>
  </section>
);

Object.assign(window, { BringYourVendors });
