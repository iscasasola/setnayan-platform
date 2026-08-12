// Operating layer section — the role-scoped access, auto-pacing, and
// unified calendar feed that turn the product from "feature list" into "ops tool."
// Slots in between TwoSides and DashboardPreview.

const OperatingLayer = () => (
  <section style={{ padding: "120px 56px", background: "var(--paper-2)", position: "relative", overflow: "hidden" }}>
    <Blob top={-80} right={-80} size={520} color="var(--sage)" opacity={0.10} />

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end", marginBottom: 56 }}>
      <Reveal>
        <div className="eyebrow">The operating layer</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", letterSpacing: "-0.02em", color: "var(--ink)", fontWeight: 400 }}>
          Outsource what you can.{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>Pace what you can't.</em>
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.6, maxWidth: 520 }}>
          The thing that turns Setnayan from "wedding app" into "operating tool" — every helper
          you invite gets a scoped view, every milestone auto-generates, and the whole thing
          exports to your phone's calendar so nothing lives in one person's head.
        </p>
      </Reveal>
    </div>

    {/* Three pillars */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      <Reveal>
        <PillarCard
          tag="01 · Role-scoped access"
          title="Outsource the work, keep the control."
          body="Invite your planner, day-of coordinator, stylist, or maid of honor. Each gets only what they need — your planner sees vendors and budgets, your day-of sees the timeline, your family helper only sees the guest list. No more giving your whole password to anyone."
          rows={[
            { who: "Planner",      sees: "Vendors · budget · contracts" },
            { who: "Day-of",       sees: "Timeline · run-of-show · crew" },
            { who: "Stylist",      sees: "Mood board · monogram · palette" },
            { who: "Family helper",sees: "Guest list · RSVPs only" },
          ]}
        />
      </Reveal>
      <Reveal delay={120}>
        <PillarCard
          tag="02 · Auto-paced milestones"
          title="The next thing, surfaced on the right day."
          body="Pick your wedding date. Setnayan generates the full milestone calendar — when to send save-the-dates, when to lock catering headcount, when to print QR sheets, when the venue walkthrough is due. Tuned per event type."
          rows={[
            { who: "T−180d", sees: "Lock venue · sign with caterer" },
            { who: "T−60d",  sees: "Send invites · vendor walkthrough" },
            { who: "T−14d",  sees: "RSVP cutoff · headcount lock" },
            { who: "T−1d",   sees: "Crew briefing · ready-room setup" },
          ]}
        />
      </Reveal>
      <Reveal delay={240}>
        <PillarCard
          tag="03 · One calendar feed"
          title=".ics that lives on your phone."
          body="Every milestone, vendor meeting, payment deadline, and reminder pulls into a single calendar subscription. Sync to Apple, Google, Outlook — once. Changes propagate. Stop checking the app to know what's next."
          rows={[
            { who: "Apple Calendar", sees: "subscribed · auto-syncs" },
            { who: "Google Calendar",sees: "subscribed · auto-syncs" },
            { who: "Outlook",        sees: "subscribed · auto-syncs" },
            { who: "Filipinos abroad", sees: "syncs across timezones" },
          ]}
        />
      </Reveal>
    </div>

    {/* Quote-style closer */}
    <div className="card" style={{ marginTop: 28, padding: 32, background: "var(--ink)", color: "var(--paper)", border: "none", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "center" }}>
      <div>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>The why</div>
        <p className="serif" style={{ fontSize: 28, lineHeight: 1.4, fontStyle: "italic", margin: "12px 0 0", color: "var(--paper)" }}>
          “A wedding is a project. We built the operating system you'd use for any other ₱2M project — with the proper receipts, the Tagalog roles, and the Lola test.”
        </p>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 16, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          — From the engineering spec
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { k: "Co-hosts",       v: "Unlimited per event" },
          { k: "Milestone presets",v: "Wedding · Debut · Corp · Baptism" },
          { k: "Calendar export", v: "iCal · Google · Outlook" },
        ].map(s => (
          <div key={s.k} style={{ padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--orange-3)" }}>{s.k}</span>
            <span style={{ fontSize: 13, color: "var(--paper)" }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const PillarCard = ({ tag, title, body, rows }) => (
  <div className="card" style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column", gap: 14, background: "var(--paper)" }}>
    <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>{tag}</div>
    <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.08 }}>
      {title}
    </div>
    <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>{body}</div>
    <div style={{ marginTop: 6, padding: 14, background: "var(--paper-2)", borderRadius: 10 }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "100px 1fr", gap: 10, padding: "6px 0",
          borderTop: i === 0 ? "none" : "1px solid var(--line-soft)", fontSize: 12,
        }}>
          <span className="mono" style={{ color: "var(--orange-2)", letterSpacing: "0.06em" }}>{r.who}</span>
          <span style={{ color: "var(--ink)" }}>{r.sees}</span>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, { OperatingLayer });
