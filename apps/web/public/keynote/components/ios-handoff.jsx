// iOS handoff demo — shows the "Continue on web" pattern for payments.
// Two phones side-by-side: app browsing/RSVP state on the left, the moment
// before a purchase routes to web on the right. Plus an annotated breakdown.

const IOSHandoff = () => (
  <div style={{ background: "var(--paper)", padding: "56px 64px", fontFamily: "var(--sans)" }}>
    {/* Header */}
    <div style={{ borderTop: "1px solid var(--ink)", paddingTop: 14, marginBottom: 36, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)" }}>
          iOS pattern · purchase handoff
        </div>
        <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.02, margin: "12px 0 8px", letterSpacing: "-0.02em" }}>
          Native checkout for vendor bookings. <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>Web fallback for the rare case.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--slate)", maxWidth: 720, lineHeight: 1.55, margin: 0 }}>
          Vendor bookings (catering, photography, Setnayan Productions services) are exempt from
          Apple IAP under Guideline 3.1.5(a) — real-world services consumed outside the app. They
          checkout natively in the iOS app using Xendit / GCash / cards. Same pattern as Shopee,
          Grab, Airbnb. Only the rare in-app digital subscription bounces to web.
        </p>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>
        iPhone 15 Pro · 393×852
      </div>
    </div>

    {/* Two phones side by side */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28, alignItems: "start" }}>
      {/* Native app — browsing OK */}
      <Reveal>
        <div>
          <div className="label-mono" style={{ marginBottom: 14, color: "var(--sage-deep)" }}>
            ✓ Native · free engagement
          </div>
          <PhoneShell>
            <NativeBrowsingState />
          </PhoneShell>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>
            Sign up, plan, RSVP, message vendors, upload photos via Papic — all free,
            all native. Apple has no claim on free actions.
          </div>
        </div>
      </Reveal>

      {/* Handoff moment */}
      <Reveal delay={150}>
        <div>
          <div className="label-mono" style={{ marginBottom: 14, color: "var(--sage-deep)" }}>
            ✓ Native checkout · in-app
          </div>
          <PhoneShell>
            <HandoffState />
          </PhoneShell>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>
            Tap "Book vendor" or "Add Panood" → native sheet shows total, payment methods,
            confirm. No bounce. Apple has no claim because the service is consumed offline.
          </div>
        </div>
      </Reveal>

      {/* Web checkout */}
      <Reveal delay={300}>
        <div>
          <div className="label-mono" style={{ marginBottom: 14, color: "var(--orange-2)" }}>
            → Web · only for rare digital subs
          </div>
          <PhoneShell browser>
            <WebCheckoutState />
          </PhoneShell>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>
            Reserved for the small set of purely-digital subscriptions (e.g. if we ever add
            a Pro plan for couples). Opens secure Safari to setnayan.com/checkout.
          </div>
        </div>
      </Reveal>
    </div>

    {/* Annotated breakdown */}
    <div style={{ marginTop: 56, padding: "28px 32px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--paper-2)" }}>
      <div className="label-mono" style={{ marginBottom: 18 }}>What stays where</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        <div style={{ padding: "0 24px 0 0" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--sage-deep)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
            Native iOS · always free
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {[
              "Sign up / sign in",
              "Browse marketplace, view vendor profiles",
              "Send messages, receive notifications",
              "RSVP to invitations, fill guest details",
              "Upload photos via Papic, tag guests",
              "View timeline, mark tasks done",
              "Watch livestream (Panood) via YouTube embed",
              "Download highlight reel after delivery",
              "Book any vendor (catering, photographer, florist)",
              "Book Setnayan Productions services (Panood, Papic, Reel)",
              "Pay milestones · vendor bookings · all-in price",
              "Receive your receipt in-app",
            ].map(item => (
              <li key={item} style={{ padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink)", display: "flex", gap: 10, alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--sage-deep)" }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ padding: "0 0 0 24px", borderLeft: "1px solid var(--line)" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
            Web · rare exceptions only
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {[
              "Couple-side Pro subscription (if we ever add one)",
              "Purely-digital downloads with no real-world delivery",
              "Vendor Pro subscription · ₱1,999/month · B2B exempt anyway",
              "Admin panel · internal tools",
              "(That's it — almost everything is exempt)",
            ].map(item => (
              <li key={item} style={{ padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink)", display: "flex", gap: 10, alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>↗</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 22, lineHeight: 1.5, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span>Pattern · Shopee, Airbnb, Grab, Booking.com — physical/service exemption</span>
        <span>App Store Review Guideline 3.1.5(a) · real-world goods + services</span>
      </div>
    </div>
  </div>
);

// Minimal iPhone shell — status bar + bezel + home indicator
const PhoneShell = ({ children, browser }) => (
  <div style={{
    width: 320, margin: "0 auto",
    background: "var(--ink)",
    borderRadius: 36,
    padding: 8,
    boxShadow: "var(--shadow-lg)",
  }}>
    <div style={{
      width: "100%",
      background: browser ? "var(--paper)" : "var(--paper)",
      borderRadius: 28,
      overflow: "hidden",
      position: "relative",
      height: 600,
      display: "flex", flexDirection: "column",
    }}>
      {/* status bar */}
      <div style={{
        height: 30, padding: "0 18px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 11, fontWeight: 600, color: "var(--ink)",
        flexShrink: 0,
      }}>
        <span>9:41</span>
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 9 }}>●●●●</span>
          <span style={{ width: 14, height: 7, borderRadius: 2, background: "var(--ink)" }} />
        </span>
      </div>
      {browser && (
        <div style={{ padding: "6px 14px", display: "flex", gap: 8, alignItems: "center", background: "var(--paper-2)", borderBottom: "1px solid var(--line-soft)", fontSize: 10 }}>
          <span style={{ fontFamily: "var(--mono)", color: "var(--slate-2)", fontSize: 10 }}>🔒 setnayan.com/checkout</span>
          <span style={{ marginLeft: "auto", color: "var(--orange-2)", fontWeight: 500, fontSize: 10 }}>Done</span>
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {children}
      </div>
      {/* home indicator */}
      <div style={{ height: 18, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 100, height: 4, borderRadius: 2, background: "var(--ink)" }} />
      </div>
    </div>
  </div>
);

const NativeBrowsingState = () => (
  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <LogoFull height={18} />
      <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--blush)", fontSize: 11, color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500 }}>M</span>
    </div>
    <div className="display" style={{ fontSize: 24, marginTop: 4 }}>CLAIRE & ICE</div>
    <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>213 days to go · La Castellana</div>
    <div style={{ padding: 14, background: "var(--ivory)", borderRadius: 10, marginTop: 4 }}>
      <div className="label-mono" style={{ fontSize: 9 }}>Today's focus</div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 15, color: "var(--ink)", textTransform: "uppercase", marginTop: 4 }}>
        Send invites to 47 pending guests
      </div>
      <button style={{ marginTop: 10, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 999, padding: "8px 14px", fontSize: 11, fontFamily: "var(--sans)", fontWeight: 500 }}>
        Send all
      </button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {[["166", "RSVPs"], ["9", "vendors"], ["62%", "budget"]].map(([v, k]) => (
        <div key={k} style={{ padding: 8, background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <div className="display" style={{ fontSize: 16 }}>{v}</div>
          <div className="mono" style={{ fontSize: 8, color: "var(--slate-2)" }}>{k}</div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 4 }}>
      <div className="label-mono" style={{ fontSize: 9 }}>Vendor inbox</div>
      <div style={{ padding: 10, background: "var(--paper-2)", borderRadius: 8, marginTop: 6 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--orange-2)" }}>Bloom & Co.</div>
        <div style={{ fontSize: 11, color: "var(--ink)", marginTop: 2, lineHeight: 1.4 }}>
          Sample swatches dropped to your dashboard 🌸
        </div>
      </div>
    </div>
  </div>
);

const HandoffState = () => (
  <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
    {/* Dimmed background — last screen */}
    <div style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
      <NativeBrowsingState />
    </div>
    {/* Modal sheet */}
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "var(--paper)",
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      padding: "20px 18px 24px",
      boxShadow: "0 -20px 50px rgba(0,0,0,0.18)",
      border: "1px solid var(--line)",
    }}>
      <div style={{ width: 38, height: 4, borderRadius: 2, background: "var(--line)", margin: "0 auto 14px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogoMark size={20} />
        </div>
        <div>
          <div className="label-mono" style={{ fontSize: 9 }}>Booking · Studio Sereno</div>
          <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>Photography · pre-nup shoot</div>
        </div>
      </div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.1 }}>
        Confirm your<br />booking.
      </div>
      <div style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.5, marginTop: 8 }}>
        Real-world service, paid in-app via Xendit. Milestone-protected.
        Official receipt issued. No Apple cut.
      </div>
      <div style={{ marginTop: 14, padding: 10, background: "var(--paper-2)", borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span className="mono" style={{ color: "var(--slate-2)" }}>Vendor's listed price</span>
        <span style={{ fontFamily: "var(--mono)", color: "var(--ink)" }}>₱180,000</span>
      </div>
      <div style={{ marginTop: 6, padding: 10, background: "var(--paper-2)", borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span className="mono" style={{ color: "var(--slate-2)" }}>Total today</span>
        <span style={{ fontFamily: "var(--mono)", color: "var(--orange-2)", fontWeight: 500 }}>₱180,000</span>
      </div>
      <button style={{
        width: "100%", marginTop: 14, background: "var(--orange)", color: "#fff",
        border: "none", borderRadius: 12, padding: "14px 16px",
        fontSize: 13, fontFamily: "var(--sans)", fontWeight: 500,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        Pay ₱180,000 · in-app
      </button>
      <button style={{
        width: "100%", marginTop: 8, background: "transparent", color: "var(--slate)",
        border: "none", padding: "10px 16px",
        fontSize: 12, fontFamily: "var(--sans)",
      }}>
        Cancel
      </button>
    </div>
  </div>
);

const WebCheckoutState = () => (
  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
    <div className="mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--slate-2)" }}>SECURE CHECKOUT</div>
    <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.05 }}>
      Studio Sereno<br />Pre-nup shoot
    </div>
    <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>For Claire & Ice · Dec 18, 2026</div>
    <div style={{ padding: 12, background: "var(--paper-2)", borderRadius: 8, marginTop: 4, display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
      {[
        ["Vendor's listed price", "₱180,000"],
        ["Setnayan platform fee", "₱0 · 0% commission"],
      ].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="mono" style={{ color: "var(--slate-2)" }}>{k}</span>
          <span style={{ fontFamily: "var(--mono)", color: "var(--ink)" }}>{v}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
        <span style={{ color: "var(--orange-2)", fontWeight: 500 }}>Total today</span>
        <span style={{ fontFamily: "var(--display)", fontWeight: 700, color: "var(--orange-2)" }}>₱189,000</span>
      </div>
    </div>
    <div className="label-mono" style={{ fontSize: 9, marginTop: 6 }}>Pay with · pilot · QR</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[
        { logo: "QR", n: "GCash QR · pilot",     primary: true },
        { logo: "QR", n: "Maya QR · pilot" },
        { logo: "🅒",  n: "Card · coming soon" },
      ].map((p, i) => (
        <div key={p.n} style={{
          padding: "10px 12px", border: "1px solid " + (p.primary ? "var(--orange)" : "var(--line)"),
          background: p.primary ? "var(--orange-4)" : "var(--paper)",
          borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 12,
          opacity: p.n.includes("coming soon") ? 0.55 : 1,
        }}>
          <div style={{ width: 26, height: 26, borderRadius: 4, background: "var(--ink)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "var(--mono)" }}>{p.logo}</div>
          <span style={{ color: "var(--ink)" }}>{p.n}</span>
          {p.primary && <span style={{ marginLeft: "auto", color: "var(--orange-2)", fontSize: 11 }}>●</span>}
        </div>
      ))}
    </div>
    <button style={{
      background: "var(--ink)", color: "var(--paper)",
      border: "none", borderRadius: 12, padding: "14px 16px",
      fontSize: 13, fontFamily: "var(--sans)", fontWeight: 500, marginTop: 4,
    }}>
      Pay ₱189,000
    </button>
    <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", marginTop: 4, textAlign: "center", lineHeight: 1.45 }}>
      Powered by Xendit · PCI-DSS · returns to Setnayan app on success
    </div>
  </div>
);

Object.assign(window, { IOSHandoff });
