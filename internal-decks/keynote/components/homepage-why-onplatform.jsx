// "Why book through Setnayan" — surfaces the ecosystem advantages:
// shortlist, favorites, vendor-exclusive perks, milestone protection,
// content team attendance. Reinforces on-platform value.

const WhyOnPlatform = () => (
  <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end", marginBottom: 48 }}>
      <Reveal>
        <div className="eyebrow">Why book on Setnayan</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 80, lineHeight: 1.02, margin: "20px 0 16px", letterSpacing: "-0.025em", color: "var(--ink)", fontWeight: 400 }}>
          Things you only get <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>by booking here.</em>
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 19, color: "var(--slate)", lineHeight: 1.6, maxWidth: 520 }}>
          Couples can pay vendors anywhere — through GCash, in cash, by passing
          envelopes at the reception.{" "}
          <span style={{ fontStyle: "normal", fontFamily: "var(--sans)", fontSize: 16, color: "var(--slate)" }}>
            But everything below only triggers when the booking goes through Setnayan.
            That's the whole ecosystem.
          </span>
        </p>
      </Reveal>
    </div>

    {/* Six advantage cards */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
      {[
        {
          icon: "♡",
          tag: "Shortlist",
          title: "Save vendors for this wedding.",
          body: "Tap the heart on any vendor in the marketplace — they go into your event-specific shortlist. One-tap message all 12. Disappears when the wedding wraps.",
        },
        {
          icon: "★",
          tag: "Favorites",
          title: "Carry them to every future event.",
          body: "Star a vendor and they pin to the top of your search results forever — across this wedding, your sibling's debut, your kid's baptism. Coordinators love this.",
        },
        {
          icon: "✓",
          tag: "Exclusive perks",
          title: "A free upgrade every couple gets.",
          body: "Every Setnayan vendor commits to one exclusive perk — free engagement shoot, complimentary sampaguita upgrade, second-shooter discount. Only unlocked at on-platform booking.",
        },
        {
          icon: "◉",
          tag: "Milestone protection",
          title: "Pay in stages, never up front.",
          body: "Vendor payments release on milestones (30% on signing, 30% mid, 40% on the day). If your florist no-shows, the unpaid milestones stay with you. We mediate disputes.",
        },
        {
          icon: "✦",
          tag: "Receipts that count",
          title: "Proper receipts for every payment.",
          body: "Every booking issues an official receipt, automatically. Tax paperwork handled in the background. Matters when your wedding has a corporate sponsor or anyone reimbursing.",
        },
        {
          icon: "◆",
          tag: "Content team option",
          title: "Setnayan documents your day.",
          body: "Opt in and 1–3 of our team attend for content + documentation — extra shots, social-ready clips. Disclosed to all your vendors. Only available for on-platform bookings.",
        },
      ].map((c, i) => (
        <Reveal key={c.tag} delay={i * 70}>
          <div className="card" style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "var(--ink)", color: "var(--orange-3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontFamily: "var(--display)",
            }}>
              {c.icon}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {c.tag}
            </div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.1 }}>
              {c.title}
            </div>
            <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>
              {c.body}
            </div>
          </div>
        </Reveal>
      ))}
    </div>

    {/* The "off-platform = unprotected" gentle counterpoint */}
    <div className="card" style={{ marginTop: 28, padding: 28, background: "var(--ink)", color: "var(--paper)", border: "none", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 36, alignItems: "center" }}>
      <div>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>The honest counterpoint</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 32, color: "var(--paper)", textTransform: "uppercase", lineHeight: 1.05, marginTop: 8 }}>
          You can pay vendors directly.<br />We just can't help you if it goes sideways.
        </div>
      </div>
      <div style={{ fontSize: 14, color: "var(--slate-4)", lineHeight: 1.6 }}>
        Off-platform vendors miss the Setnayan-exclusive perk, the review on their Setnayan profile, the concierge handoff for multi-event clients, and the boost we run on social. They get a free profile and chat — but they sit outside the engine we built to send couples their way.
        <br /><br />
        We're not saying don't. We're saying you'll wish you had.
      </div>
    </div>
  </section>
);

Object.assign(window, { WhyOnPlatform });
