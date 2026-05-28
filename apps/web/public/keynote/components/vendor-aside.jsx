// VendorAside — small couple-page callout pointing vendors to /for-vendors.
// Light footprint on the customer homepage. Just a strip.

const VendorAside = () => (
  <section style={{ padding: "56px 56px", background: "var(--paper)" }}>
    <Reveal>
      <div className="card" style={{
        padding: "28px 36px",
        display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 28, alignItems: "center",
        background: "var(--paper-2)",
      }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <LogoMark size={32} />
        </div>
        <div>
          <div className="label-mono">For vendors</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", marginTop: 4, letterSpacing: "0.005em" }}>
            Are you a wedding supplier? We built one for you too.
          </div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Free profile, in-app chat with couples, BIR-compliant payouts, calendar, pipeline.
            Pro tier ₱4,999/wk (free until Jan 2027 · founder rate ₱3,999/wk for life).
          </div>
        </div>
        <a href="for-vendors" className="btn btn-primary" style={{ padding: "12px 20px", fontSize: 13 }}>
          See vendor view →
        </a>
      </div>
    </Reveal>
  </section>
);

Object.assign(window, { VendorAside });
