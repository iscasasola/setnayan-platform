// Vendor Application — /vendors/apply
// Multi-step verification flow shown as a single long page.
// Steps: Business · Documents · Portfolio · Exclusive perk · Payment

const VendorApplication = () => {
  const steps = [
    { num: "1", label: "Business",        sub: "Profile basics" },
    { num: "2", label: "Documents",       sub: "DTI · BIR · Permit" },
    { num: "3", label: "Portfolio",       sub: "Up to 15 samples" },
    { num: "4", label: "Exclusive perk",  sub: "What couples get" },
    { num: "5", label: "Payment",         sub: "₱1,499 once" },
  ];

  return (
    <div style={{ minHeight: 3400, background: "var(--paper-2)", fontFamily: "var(--sans)" }}>
      {/* Top nav */}
      <header style={{
        padding: "18px 56px", borderBottom: "1px solid var(--line-soft)",
        background: "var(--paper)", position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <LogoFull height={28} />
        <nav style={{ display: "flex", gap: 26, fontSize: 14, color: "var(--slate)" }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Marketplace</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Productions</a>
          <a href="#" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 500 }}>For vendors</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Help</a>
        </nav>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="#" style={{ fontSize: 14, color: "var(--slate)", textDecoration: "none", alignSelf: "center" }}>Vendor sign in</a>
          <button className="btn btn-ghost" style={{ padding: "9px 16px", fontSize: 13 }}>Save & exit</button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "72px 56px 48px", background: "var(--paper)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 56, alignItems: "center" }}>
          <div>
            <div className="eyebrow">Apply to be a Setnayan vendor</div>
            <h1 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 84, lineHeight: 1.04, letterSpacing: "-0.025em", color: "var(--ink)", margin: "20px 0 24px" }}>
              Verify once.<br />List forever.
            </h1>
            <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.55, maxWidth: 620 }}>
              ₱1,499 one-time. No monthly listing fee. 24-hour verification. After that you're on the
              marketplace forever, on the couples' shortlists forever, and 100% of every booking you
              close is yours.
            </p>
            <div className="mono" style={{ fontSize: 12, color: "var(--orange-2)", marginTop: 28, letterSpacing: "0.14em", display: "flex", gap: 18, flexWrap: "wrap" }}>
              <span>★ 100 FREE TOKENS ON VERIFICATION</span>
              <span>·</span>
              <span>UNTIL 31 JAN 2027</span>
            </div>
          </div>
          <div className="card" style={{ padding: 28, background: "var(--ink)", color: "var(--paper)", border: "none" }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.16em" }}>WHAT YOU UNLOCK</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Lifetime verified badge on your profile",
                "Unlimited bid acceptances (Free is capped at 10/wk)",
                "Reviews from real Setnayan couples",
                "Video call with couples",
                "Public website + microsite",
                "Hybrid scheduling (auto-block on accept)",
                "Eligibility for Pro & Enterprise tiers",
              ].map(line => (
                <li key={line} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--paper)" }}>
                  <span style={{ color: "var(--orange-3)" }}>✓</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Step indicator */}
      <section style={{ padding: "24px 56px", background: "var(--paper-2)", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)", position: "sticky", top: 65, zIndex: 5 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "2px solid " + (i === 0 ? "var(--orange)" : "var(--line)") }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: i === 0 ? "var(--orange)" : "var(--paper)",
                color: i === 0 ? "#fff" : "var(--slate-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--display)", fontWeight: 700, fontSize: 13,
                border: "1px solid " + (i === 0 ? "var(--orange)" : "var(--line)"),
              }}>{s.num}</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{s.label}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step 1 · Business */}
      <FormStep num="01" label="Business" title="Tell us about your business.">
        <FormRow label="Business name">
          <input type="text" placeholder="Ato Catering" defaultValue="Ato Catering" style={inputStyle} />
        </FormRow>
        <FormRow label="Category (192 to choose from)">
          <select style={inputStyle}>
            <option>Catering · Sit-down + buffet</option>
          </select>
        </FormRow>
        <FormRow label="Service area">
          <input type="text" placeholder="e.g. Quezon City + 50km radius" defaultValue="Quezon City + 50km radius" style={inputStyle} />
        </FormRow>
        <FormRow label="Owner name">
          <input type="text" placeholder="Joey Castro" defaultValue="Joey Castro" style={inputStyle} />
        </FormRow>
        <FormRow label="Contact number">
          <input type="text" placeholder="+63 917 xxx xxxx" defaultValue="+63 917 234 5678" style={inputStyle} />
        </FormRow>
      </FormStep>

      {/* Step 2 · Documents */}
      <FormStep num="02" label="Documents" title="Three documents. Three minutes." dark>
        <p style={{ fontSize: 14, color: "var(--slate-4)", marginTop: -8, marginBottom: 24, lineHeight: 1.55, maxWidth: 720 }}>
          Upload your DTI registration, BIR Certificate of Registration, and Mayor's permit. Our AI
          co-pilot (Claude Haiku 4.5) extracts the fields automatically — you confirm what's read,
          then a human admin signs off within 24 hours. <strong style={{ color: "var(--paper)" }}>No auto-approve, ever.</strong>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { name: "DTI Business Name Registration", state: "extracted", file: "dti-ato-2024.pdf",      ext: "BN 4180-2026 · Ato Catering · valid until Aug 2029" },
            { name: "BIR Certificate of Registration",state: "extracted", file: "bir-2303.pdf",          ext: "TIN 274-518-002 · Joey Castro · VAT-registered" },
            { name: "Mayor's Permit",                 state: "uploaded",  file: "qc-mayors-2026.pdf",   ext: "Claude is reading…" },
          ].map((d) => (
            <div key={d.name} style={{ padding: 18, background: "rgba(255,255,255,0.04)", border: "1px solid " + (d.state === "extracted" ? "var(--sage-deep)" : "var(--orange-3)"), borderRadius: 12 }}>
              <div className="mono" style={{ fontSize: 10, color: d.state === "extracted" ? "var(--sage)" : "var(--orange-3)", letterSpacing: "0.12em" }}>
                {d.state === "extracted" ? "✓ EXTRACTED" : "✦ READING…"}
              </div>
              <div style={{ fontSize: 14, color: "var(--paper)", fontWeight: 500, marginTop: 6, lineHeight: 1.3 }}>{d.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 10 }}>{d.file}</div>
              <div style={{ marginTop: 12, padding: 10, background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 11, color: "var(--slate-4)", lineHeight: 1.5, fontFamily: "var(--mono)" }}>
                {d.ext}
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 12, padding: "6px 12px", fontSize: 11, width: "100%", justifyContent: "center", color: "var(--paper)", borderColor: "rgba(255,255,255,0.18)" }}>
                Replace file
              </button>
            </div>
          ))}
        </div>
      </FormStep>

      {/* Step 3 · Portfolio */}
      <FormStep num="03" label="Portfolio" title="Up to 15 sample shots.">
        <p style={{ fontSize: 14, color: "var(--slate)", marginTop: -8, marginBottom: 24, lineHeight: 1.55, maxWidth: 720 }}>
          Couples decide in 8 seconds whether to send you a bid request. Make those seconds count.
          Free tier: up to 15 photos. Verified, Pro, Enterprise: unlimited.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{
              aspectRatio: "4/5",
              background: i < 8 ? `linear-gradient(135deg, oklch(72% 0.10 ${(i * 47) % 360}) 0%, oklch(86% 0.06 ${(i * 47 + 40) % 360}) 100%)` : "var(--paper-2)",
              border: i < 8 ? "none" : "1px dashed var(--line)",
              borderRadius: 8, position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--slate-3)", fontSize: 24,
            }}>
              {i >= 8 && "＋"}
            </div>
          ))}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 14, letterSpacing: "0.06em" }}>8 of 15 photos uploaded · drag &amp; drop or click to add</div>
      </FormStep>

      {/* Step 4 · Exclusive perk */}
      <FormStep num="04" label="Exclusive perk" title="One offer, just for Setnayan customers.">
        <p style={{ fontSize: 14, color: "var(--slate)", marginTop: -8, marginBottom: 24, lineHeight: 1.55, maxWidth: 720 }}>
          Every Setnayan vendor declares one exclusive perk. This sits on your marketplace card, your
          microsite, and the couple's shortlist — it's what tells them <em>"the price you got me through
          Setnayan is better than anything you'd get going direct."</em>
        </p>
        <FormRow label="Your Setnayan-exclusive perk">
          <textarea
            placeholder="e.g. Free crew meals (₱24K value) · or · Free upgrade to plated service · or · Complimentary cocktail hour"
            defaultValue="Free crew meals for the entire vendor team (₱24K value at 20-pax crew)"
            rows={3}
            style={{ ...inputStyle, fontFamily: "var(--sans)", resize: "vertical" }}
          />
        </FormRow>
        <div style={{ padding: 18, background: "var(--orange-4)", borderRadius: 10, fontSize: 13, color: "var(--ink)", lineHeight: 1.55, maxWidth: 720, marginTop: 8 }}>
          <strong>Required.</strong> Every vendor must declare an exclusive. If a couple reports that
          a competing quote from you outside Setnayan was better than the price they got here, Trust &amp; Safety
          investigates and your perk may be adjusted.
        </div>
      </FormStep>

      {/* Step 5 · Payment */}
      <FormStep num="05" label="Payment" title="₱1,499 to verify. One time." dark final>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.16em" }}>YOUR SUMMARY</div>
            <div style={{ marginTop: 18, padding: 22, background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
              {[
                { k: "Verification fee",          v: "₱1,499", strike: false },
                { k: "Founder bonus tokens",      v: "+ 100 tokens", strike: false },
                { k: "Pro subscription",          v: "skip for now", strike: true },
                { k: "Enterprise subscription",   v: "skip for now", strike: true },
                { k: "Boosted Ads · ₱1,200/wk",   v: "skip for now", strike: true },
              ].map((row) => (
                <div key={row.k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: row.strike ? "var(--slate-4)" : "var(--paper)" }}>
                  <span>{row.k}</span>
                  <span className="mono" style={{ textDecoration: row.strike ? "line-through" : "none" }}>{row.v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0 0", fontSize: 16, color: "var(--paper)", fontWeight: 500 }}>
                <span>Total today</span>
                <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, color: "var(--orange-3)" }}>₱1,499</span>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 14, letterSpacing: "0.08em" }}>
              No recurring charge. No monthly listing fee. You can upgrade to Pro (₱1,999/mo) or Enterprise (₱5,499/mo) any time after verification.
            </div>
          </div>
          <div style={{ padding: 22, background: "rgba(255,255,255,0.05)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.16em" }}>PAY VIA QR · PILOT</div>
            <div style={{ width: "100%", aspectRatio: "1/1", background: `repeating-conic-gradient(var(--paper) 0% 25%, var(--ink) 0% 50%) 50% / 14px 14px`, borderRadius: 8, maxWidth: 220, margin: "0 auto" }} />
            <div style={{ textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)" }}>GCash · Maya · InstaPay</div>
              <div style={{ fontSize: 12, color: "var(--paper)", marginTop: 4 }}>Setnayan team confirms within minutes.</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", letterSpacing: "0.10em" }}>
            By verifying, you accept the Setnayan vendor terms and the price-protection commitment.
          </div>
          <button className="btn btn-orange" style={{ padding: "14px 32px", fontSize: 14 }}>Submit application →</button>
        </div>
      </FormStep>

      {/* Bottom · what happens next */}
      <section style={{ padding: "72px 56px", background: "var(--ivory)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}>
          <div className="eyebrow" style={{ justifyContent: "center" }}>After you submit</div>
          <h2 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 56, lineHeight: 1.1, letterSpacing: "-0.02em", color: "var(--ink)", margin: "16px 0 36px" }}>
            Within 24 hours.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 1100, margin: "0 auto" }}>
            {[
              { num: "1", title: "AI co-pilot reads your docs", body: "Claude extracts every field, cross-checks the three documents, and generates a verification summary with confidence score." },
              { num: "2", title: "Human admin signs off",       body: "A Setnayan Trust & Safety admin reviews the AI summary, runs a gov-DB cross-check (DTI BNRS, BIR, Mayor's permit), and approves." },
              { num: "3", title: "Badge + 100 tokens go live",   body: "Your verified badge appears on your profile. 100 founder tokens land in your wallet. You start receiving bid requests." },
            ].map(s => (
              <div key={s.num} className="card" style={{ padding: 24, textAlign: "left" }}>
                <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 40, color: "var(--orange-2)", lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: "var(--ink)", marginTop: 14, lineHeight: 1.2, textTransform: "uppercase" }}>{s.title}</div>
                <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 10, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "12px 16px",
  fontFamily: "var(--sans)", fontSize: 14,
  border: "1px solid var(--line)", borderRadius: 8,
  background: "var(--paper)", color: "var(--ink)",
};

const FormStep = ({ num, label, title, dark, final, children }) => (
  <section style={{
    padding: "72px 56px", background: dark ? "var(--ink)" : "var(--paper)",
    color: dark ? "var(--paper)" : "var(--ink)",
    borderTop: "1px solid var(--line-soft)",
  }}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 28 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: dark ? "var(--orange-3)" : "var(--orange-2)", letterSpacing: "0.18em" }}>{num} · {label}</span>
        {final && <span style={{ padding: "3px 10px", background: "var(--orange)", color: "#fff", fontSize: 10, borderRadius: 4, fontFamily: "var(--mono)", letterSpacing: "0.08em" }}>★ FINAL STEP</span>}
      </div>
      <h2 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", color: dark ? "var(--paper)" : "var(--ink)", margin: "0 0 32px" }}>
        {title}
      </h2>
      {children}
    </div>
  </section>
);

const FormRow = ({ label, children }) => (
  <div style={{ marginBottom: 18, maxWidth: 720 }}>
    <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</label>
    {children}
  </div>
);

Object.assign(window, { VendorApplication });
