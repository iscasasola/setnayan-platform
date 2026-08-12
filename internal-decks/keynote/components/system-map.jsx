// System Map — visual diagram of how Setnayan's surfaces connect.
// Helps the team see the platform as one event-engine, not a list of features,
// and where we should collapse redundancies.

const SystemMap = () => (
  <div style={{ background: "var(--paper)", padding: "56px 64px", fontFamily: "var(--sans)", minHeight: "100%" }}>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36, gap: 24, borderTop: "1px solid var(--ink)", paddingTop: 16 }}>
      <div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)" }}>
          System map · v 2026.11
        </div>
        <h1 className="serif" style={{ fontSize: 64, margin: "16px 0 8px", lineHeight: 1.02, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          One event engine, <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>three doorways.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--slate)", maxWidth: 720, lineHeight: 1.6, margin: 0 }}>
          Setnayan looks like many surfaces but it's one database with three views. Every
          feature here writes into the same event record — that's why the couple, the vendor,
          and the guest see the same truth at the same moment.
        </p>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>
        Legend<br />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <span style={{ width: 12, height: 1.5, background: "var(--orange)" }} /> writes data
        </span><br />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ width: 12, height: 1.5, background: "var(--slate-3)", borderTop: "1.5px dashed var(--slate-3)" }} /> reads data
        </span>
      </div>
    </div>

    {/* Three doorways */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 36 }}>
      <DoorwayCard kind="couple"
        title="Couple"
        sub="The dashboard a real couple sees."
        rows={["Guest list", "Vendors", "Schedule", "Invitations", "Mood board", "In-app services", "Payments"]}
        you={["Claire", "Ice", "Claire's mom", "Maid of honor", "MC"]}
      />
      <DoorwayCard kind="vendor"
        title="Vendor"
        sub="What the supplier sees on the same booking."
        rows={["Pipeline", "Inbox", "Calendar", "Earnings", "Profile", "Team & crew", "Boost"]}
        you={["Ato Catering", "Bloom & Co.", "Studio Sereno"]}
      />
      <DoorwayCard kind="guest"
        title="Guest"
        sub="A QR away — no account needed."
        rows={["RSVP card", "Dietary form", "Seat preview", "Venue map", "Livestream link", "Photo gallery"]}
        you={["Tita Cora", "Lolo Eduardo", "Patricia + 1"]}
        light
      />
    </div>

    {/* The central truth */}
    <div style={{
      border: "1px solid var(--ink)",
      borderRadius: 16,
      padding: "28px 32px",
      background: "var(--ink)",
      color: "var(--paper)",
      marginBottom: 36,
      position: "relative",
    }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--orange-3)", textTransform: "uppercase", marginBottom: 8 }}>
        Single source of truth
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "center" }}>
        <div className="display" style={{ fontSize: 56, color: "var(--paper)", lineHeight: 1 }}>
          THE EVENT RECORD
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            ["213",  "headcount"],
            ["9",    "vendors"],
            ["6",    "co-hosts"],
            ["1",    "venue"],
            ["1",    "date"],
          ].map(([v, k]) => (
            <div key={k} style={{ padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8 }}>
              <div className="display" style={{ fontSize: 28, lineHeight: 1, color: "var(--paper)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)", marginTop: 3 }}>{k}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Feature flow grid — how each feature writes/reads from the record */}
    <div style={{ marginBottom: 36 }}>
      <div className="label-mono" style={{ marginBottom: 14 }}>How features connect · five chains that used to be five spreadsheets</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <FlowChain
          title="The headcount chain"
          steps={[
            { name: "Guest list",      kind: "core" },
            { name: "Invitations · QR", kind: "couple" },
            { name: "RSVP card",       kind: "guest"  },
            { name: "Seating chart",   kind: "couple" },
            { name: "Caterer headcount", kind: "vendor" },
          ]}
        />
        <FlowChain
          title="The payment chain"
          steps={[
            { name: "Vendor proposal",   kind: "vendor" },
            { name: "Couple approves",   kind: "couple" },
            { name: "Milestone schedule",kind: "core"   },
            { name: "Setnayan Pay",      kind: "core"   },
            { name: "BIR OR + 2307",     kind: "vendor" },
          ]}
        />
        <FlowChain
          title="The day-of chain"
          steps={[
            { name: "Run-of-show",       kind: "couple" },
            { name: "Panood broadcast",  kind: "core"   },
            { name: "Papic crew tagging",kind: "guest"  },
            { name: "Highlight reel AI", kind: "core"   },
            { name: "Photo handoff",     kind: "couple" },
          ]}
        />
        <FlowChain
          title="The conversation chain"
          steps={[
            { name: "Marketplace search",kind: "couple" },
            { name: "Vendor profile",    kind: "vendor" },
            { name: "In-app message",    kind: "core"   },
            { name: "Proposal + contract", kind: "vendor" },
            { name: "Booking on calendar", kind: "core" },
          ]}
        />
        <FlowChain
          title="The growth chain"
          steps={[
            { name: "Reviews from couples", kind: "couple" },
            { name: "Vendor verified badge",kind: "core"   },
            { name: "Boosted visibility",   kind: "vendor" },
            { name: "Event-type unlock",    kind: "core"   },
            { name: "New event verticals",  kind: "core"   },
          ]}
        />
      </div>
    </div>

    {/* Simplifications */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <div style={{ padding: 24, border: "1px solid var(--line)", borderRadius: 14, background: "var(--paper-2)" }}>
        <div className="label-mono" style={{ color: "var(--orange-2)" }}>Where to simplify</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "var(--ink)", textTransform: "uppercase", marginTop: 6 }}>
          Collapse before launch.
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 12 }}>
          {[
            ["Two CTAs", "Hero has “Start planning” + “I'm a vendor”. Land on one role-aware page; let them switch from there."],
            ["Two onboardings", "Couple sign-up and vendor sign-up share 80% of the form. Use one wizard that branches at step 2."],
            ["Two payment surfaces", "Couple sees “Payments”. Vendor sees “Earnings”. They're two views of the same ledger — name them consistently."],
            ["Two messaging surfaces", "Couple's “Vendor chat” and vendor's “Inbox” are the same threads. Same component, two filters."],
          ].map(([k, v]) => (
            <li key={k} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--orange-2)", paddingTop: 3 }}>−</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{k}</div>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2, lineHeight: 1.5 }}>{v}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ padding: 24, border: "1px solid var(--line)", borderRadius: 14, background: "var(--paper)" }}>
        <div className="label-mono" style={{ color: "var(--sage-deep)" }}>What's already simple</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "var(--ink)", textTransform: "uppercase", marginTop: 6 }}>
          Keep these unchanged.
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 12 }}>
          {[
            ["One database", "Couple, vendor, and guest write to the same record. Never duplicate state."],
            ["One QR", "Save-the-date, RSVP, seating preview, photo upload — same QR per guest, four behaviors."],
            ["One inbox", "Vendor messages live in the dashboard, not email. Setnayan is the only place a conversation can be."],
            ["One bill", "Couple sees one line per vendor. BIR receipts auto-attached. No GCash screenshots."],
          ].map(([k, v]) => (
            <li key={k} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--sage-deep)", paddingTop: 3 }}>✓</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{k}</div>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2, lineHeight: 1.5 }}>{v}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const DoorwayCard = ({ kind, title, sub, rows, you, light }) => {
  const dark = !light;
  return (
    <div style={{
      background: dark ? "var(--ink)" : "var(--paper-2)",
      color:      dark ? "var(--paper)" : "var(--ink)",
      borderRadius: 14, padding: 24,
      border: dark ? "none" : "1px solid var(--line)",
    }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: dark ? "var(--orange-3)" : "var(--orange-2)", textTransform: "uppercase" }}>
        Doorway · {kind}
      </div>
      <div className="display" style={{ fontSize: 36, color: dark ? "var(--paper)" : "var(--ink)", marginTop: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: dark ? "var(--slate-4)" : "var(--slate)", marginTop: 6, lineHeight: 1.5 }}>
        {sub}
      </div>
      <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: dark ? "rgba(255,255,255,0.06)" : "var(--paper)" }}>
        <div className="mono" style={{ fontSize: 10, color: dark ? "var(--slate-4)" : "var(--slate-2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Sees
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {rows.map(r => (
            <span key={r} style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 999,
              background: dark ? "rgba(255,255,255,0.08)" : "var(--paper-2)",
              color: dark ? "var(--paper)" : "var(--ink)",
              border: dark ? "none" : "1px solid var(--line-soft)",
              fontFamily: "var(--mono)",
            }}>{r}</span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="mono" style={{ fontSize: 10, color: dark ? "var(--slate-4)" : "var(--slate-2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Who
        </div>
        <div style={{ fontSize: 12, color: dark ? "var(--paper)" : "var(--slate)", marginTop: 4, lineHeight: 1.5 }}>
          {you.join(" · ")}
        </div>
      </div>
    </div>
  );
};

const FlowChain = ({ title, steps }) => {
  const kindColor = {
    couple: "var(--orange-2)",
    vendor: "var(--blush-deep)",
    guest:  "var(--sage-deep)",
    core:   "var(--ink)",
  };
  const kindBg = {
    couple: "var(--orange-4)",
    vendor: "var(--blush)",
    guest:  "var(--sage)",
    core:   "var(--paper-2)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.10em", color: "var(--slate-2)", textTransform: "uppercase", paddingBottom: 6, borderBottom: "1px solid var(--line)" }}>
        {title}
      </div>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{
            padding: "10px 12px",
            background: kindBg[s.kind],
            borderRadius: 8,
            border: s.kind === "core" ? "1px solid var(--line)" : "none",
          }}>
            <div className="mono" style={{ fontSize: 9, color: kindColor[s.kind], letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.kind}</div>
            <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 2 }}>{s.name}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg width="12" height="14" viewBox="0 0 12 14"><path d="M6 0 V12 M2 8 L6 12 L10 8" stroke="var(--orange)" strokeWidth="1.5" fill="none" /></svg>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

Object.assign(window, { SystemMap });
