// Pillar 02 · "A personal wedding website."
// Shows what the guest microsite (/e/<slug>) does in a compact phone-frame mock
// alongside the four killer features. Sits on the customer homepage right after
// MarketplacePreview.

const PersonalSitePreview = () => {
  const stage = (typeof useSnynStage === "function") ? useSnynStage() : "pilot";

  return (
    <section style={{ padding: "120px 56px", background: "var(--paper)", position: "relative", overflow: "hidden" }}>
      <Blob bottom={-120} left={-80} size={520} color="var(--blush)" opacity={0.10} />
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 80, alignItems: "center", position: "relative" }}>
        {/* LEFT — phone-frame mock of the guest microsite */}
        <Reveal>
          <PhoneMock />
        </Reveal>

        {/* RIGHT — pillar headline + features */}
        <Reveal delay={150}>
          <div>
            <div className="eyebrow">Pillar 02 · A personal wedding website</div>
            <h2 style={{
              fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04,
              margin: "20px 0 24px", color: "var(--ink)", fontWeight: 400, letterSpacing: "-0.025em",
            }}>
              Every guest gets{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>their own door.</em>
            </h2>
            <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.6, maxWidth: 540, marginBottom: 28 }}>
              Replaces Greenvelope, Paperless Post, Google Forms, and the "sino-na-magprint-ng-QR"
              group chat. Every guest scans a personal QR and lands on a page that knows who they
              are — RSVP, dress code, table number, day-of livestream, post-event gallery.
              The site evolves through five phases without you lifting a finger.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {[
                { icon: "◆", tag: "Per-guest QR",   body: "Every invite is unique. Names, plus-ones, dietary, table — pre-loaded." },
                { icon: "◐", tag: "Phase-aware",    body: "Save-the-date → invitation → day-of → after. Auto-evolves on the calendar." },
                { icon: "○", tag: "Photo pool",     body: "Guests upload from any phone. No app install. Lands in your gallery." },
                { icon: "◇", tag: "Multilingual",   body: "EN today. TL + CEB Q1 2027. Setnayan handles the translations." },
              ].map((f) => (
                <div key={f.tag} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--orange)", fontSize: 14 }}>{f.icon}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{f.tag}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.5 }}>{f.body}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary" style={{ padding: "10px 18px" }}>See a sample microsite →</button>
              <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>
                claire-ice.setnayan.app  ·  free with every account
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ─── Phone-frame mock ───────────────────────────────────────────────────────
const PhoneMock = () => (
  <div style={{
    width: 320, height: 600,
    background: "var(--ink)",
    borderRadius: 38,
    padding: 10,
    boxShadow: "0 30px 80px rgba(31, 26, 23, 0.18), 0 8px 24px rgba(31, 26, 23, 0.08)",
    position: "relative",
  }}>
    {/* Notch */}
    <div style={{
      position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
      width: 100, height: 22, background: "var(--ink)",
      borderRadius: 14, zIndex: 2,
    }} />
    {/* Screen */}
    <div style={{
      width: "100%", height: "100%",
      background: "var(--ivory)",
      borderRadius: 30,
      overflow: "hidden",
      position: "relative",
      display: "flex", flexDirection: "column",
    }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 22px 6px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)" }}>
        <span>9:41</span>
        <span style={{ display: "inline-flex", gap: 4 }}>●●●●●</span>
      </div>

      {/* URL bar */}
      <div style={{ margin: "6px 14px 10px", padding: "5px 10px", background: "var(--paper-2)", borderRadius: 10, fontFamily: "var(--mono)", fontSize: 9, color: "var(--slate-2)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--sage-deep)" }} />
        claire-ice.setnayan.app
      </div>

      {/* Hero */}
      <div style={{ padding: "12px 18px 6px", textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", letterSpacing: "0.10em" }}>SAVE THE DATE</div>
        <div style={{
          fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.05,
          color: "var(--ink)", fontStyle: "italic", marginTop: 8,
        }}>
          Claire <span style={{ color: "var(--orange)" }}>&amp;</span> Ice
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 6, letterSpacing: "0.12em" }}>
          18.12.2026 · LA CASTELLANA
        </div>
      </div>

      {/* Phase pill */}
      <div style={{ padding: "0 18px", display: "flex", justifyContent: "center", marginTop: 6 }}>
        <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--orange-2)", background: "var(--orange-4)", padding: "3px 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--orange)" }} />
          PHASE 1 OF 5 · SAVE-THE-DATE
        </span>
      </div>

      {/* Personalized greeting */}
      <div style={{ margin: "16px 16px 8px", padding: "12px 14px", background: "var(--paper)", borderRadius: 12, border: "1px solid var(--line-soft)" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", letterSpacing: "0.08em" }}>WELCOME</div>
        <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 4, fontWeight: 500 }}>Tita Ana &amp; Tito Manny</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>SEAT 2 · TABLE 4 · 2 plates</div>
      </div>

      {/* RSVP */}
      <div style={{ margin: "0 16px 10px", padding: "12px 14px", background: "var(--ink)", borderRadius: 12, color: "var(--paper)" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--orange-3)", letterSpacing: "0.08em" }}>YOU'RE CONFIRMED</div>
        <div style={{ fontSize: 14, color: "var(--paper)", marginTop: 4 }}>Tap to change ✓</div>
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {["yes", "pending", "no"].map((s, i) => (
            <span key={s} style={{
              flex: 1, padding: "5px 0", borderRadius: 6, textAlign: "center",
              fontSize: 9, fontFamily: "var(--mono)", letterSpacing: "0.06em", textTransform: "uppercase",
              background: i === 0 ? "var(--orange)" : "rgba(255,255,255,0.06)",
              color: i === 0 ? "#fff" : "var(--slate-4)",
            }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Quick tiles */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          ["Dress code", "Filipiniana modern"],
          ["Livestream", "Day-of · open"],
          ["Map · QC",   "Pin saved"],
          ["Photo pool", "0 uploaded"],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: "8px 10px", background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 8 }}>
            <div className="mono" style={{ fontSize: 8, color: "var(--slate-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{k}</div>
            <div style={{ fontSize: 10, color: "var(--ink)", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { PersonalSitePreview });
