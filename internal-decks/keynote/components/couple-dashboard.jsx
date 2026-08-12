// Couple dashboard — interactive. Tabs switch the main view.
// State: active tab, guest RSVPs, expanded vendor, done-tasks, role.

const { useState } = React;

const CoupleDashboard = ({ role, setRole }) => {
  const [tab, setTab] = useState("overview");
  const [guests, setGuests] = useState(SETNAYAN_DATA.guests);
  const [expandVendor, setExpandVendor] = useState(null);
  const [done, setDone] = useState({});
  const ev = SETNAYAN_DATA.event;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 880, background: "var(--paper-2)" }}>
      <CoupleSidebar tab={tab} setTab={setTab} role={role} setRole={setRole} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <CoupleTopbar ev={ev} role={role} setRole={setRole} />
        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22, background: "var(--paper-2)" }}>
          {tab === "overview"  && <OverviewTab ev={ev} guests={guests} setGuests={setGuests} done={done} setDone={setDone} />}
          {tab === "guests"    && <GuestsTab guests={guests} setGuests={setGuests} />}
          {tab === "vendors"   && <VendorsTab expand={expandVendor} setExpand={setExpandVendor} />}
          {tab === "shortlist" && <ShortlistTab />}
          {tab === "schedule"  && <ScheduleTab done={done} setDone={setDone} />}
          {tab === "invitations" && <InvitationsTab />}
          {tab === "budget"    && <BudgetTab />}
        </main>
      </div>
    </div>
  );
};

// ─────────────────────────── Sidebar
const CoupleSidebar = ({ tab, setTab }) => {
  const nav = [
    { id: "overview",    label: "Overview"    },
    { id: "guests",      label: "Guest list",  badge: "47 pending" },
    { id: "vendors",     label: "Vendors",     badge: "9 active"   },
    { id: "shortlist",   label: "Shortlist",   badge: "12 saved"   },
    { id: "schedule",    label: "Schedule"    },
    { id: "invitations", label: "Invitations" },
    { id: "moodboard",   label: "Mood board"  },
    { id: "services",    label: "Productions" },
    { id: "budget",      label: "Budget",      badge: "₱760K to go" },
  ];
  return (
    <aside style={{ background: "var(--paper)", borderRight: "1px solid var(--line)", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: "4px 4px 16px", borderBottom: "1px solid var(--line-soft)" }}>
        <LogoFull height={28} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px 4px" }}>
        <div className="label-mono">{SETNAYAN_DATA.event.couple}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="pill pill-orange" style={{ fontSize: 10, padding: "3px 8px" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--orange)" }} />
            Couple
          </span>
          <span className="pill" style={{ fontSize: 10, padding: "3px 8px", background: "var(--paper-2)" }}>
            213 days to go
          </span>
        </div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
        {nav.map((n) => {
          const active = n.id === tab;
          return (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              border: "none", background: active ? "var(--orange-4)" : "transparent",
              color: active ? "var(--orange-2)" : "var(--slate)",
              padding: "9px 12px", borderRadius: 8,
              fontSize: 14, fontWeight: active ? 500 : 400,
              textAlign: "left", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: "var(--sans)",
            }}>
              <span>{n.label}</span>
              {n.badge && (
                <span className="mono" style={{
                  fontSize: 10,
                  color: active ? "var(--orange-2)" : "var(--slate-3)",
                }}>{n.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", padding: 14, borderRadius: 10, background: "var(--ink)", color: "var(--paper)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>On the day</div>
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          Same-day livestream + AI highlight reel — 30 minutes after the kiss.
        </div>
        <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 12, alignSelf: "flex-start" }}>Configure ↗</button>
      </div>
    </aside>
  );
};

// ─────────────────────────── Topbar
const CoupleTopbar = ({ ev, role, setRole }) => {
  const phases = ["Dreaming", "Booking", "Inviting", "Finalizing", "Day", "After"];
  const current = phases.indexOf(ev.phase);
  return (
    <header style={{
      padding: "20px 28px", borderBottom: "1px solid var(--line)",
      background: "var(--paper)",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div>
          <div className="label-mono">Good evening, {ev.couple.split(/ &(?:amp;)? /)[0]} · {ev.dateShort}</div>
          <div className="display" style={{ fontSize: 44, marginTop: 4 }}>
            {ev.couple.toUpperCase()}
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 4 }}>
            {ev.daysOut} days to go · {ev.venue}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RoleSwitch role={role} setRole={setRole} />
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Share dashboard</button>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--blush)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>M</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {phases.map((p, i) => (
          <div key={p} style={{
            flex: 1, padding: "8px 10px", borderRadius: 8,
            background: i === current ? "var(--orange)" : (i < current ? "var(--paper-2)" : "var(--paper-2)"),
            color: i === current ? "#fff" : "var(--slate-2)",
            fontSize: 12, fontWeight: i === current ? 500 : 400,
            border: i === current ? "none" : "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>{p}</span>
            {i < current && <span style={{ fontSize: 11, color: "var(--sage-deep)" }}>✓</span>}
          </div>
        ))}
      </div>
    </header>
  );
};

const RoleSwitch = ({ role, setRole }) => (
  <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--paper-2)", borderRadius: 999, border: "1px solid var(--line)" }}>
    {[
      { id: "couple",  label: "Couple"  },
      { id: "vendor",  label: "Vendor"  },
      { id: "admin",   label: "Admin"   },
    ].map((r) => {
      const active = role === r.id;
      return (
        <button key={r.id} onClick={() => setRole(r.id)} style={{
          border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 12,
          cursor: "pointer", fontFamily: "var(--sans)",
          background: active ? "var(--ink)" : "transparent",
          color: active ? "var(--paper)" : "var(--slate)",
          fontWeight: active ? 500 : 400,
        }}>{r.label}</button>
      );
    })}
  </div>
);

// ─────────────────────────── Overview tab — "Today's focus" first
const OverviewTab = ({ ev, guests, setGuests, done, setDone }) => {
  const [focusState, setFocusState] = useState("pending"); // pending | sending | done | skipped
  const [smalls, setSmalls] = useState({ swatches: false, proposal: false });

  const sendInvites = () => {
    setFocusState("sending");
    setTimeout(() => {
      setGuests(guests.map(g => g.rsvp === "pending" ? { ...g, rsvp: "yes" } : g));
      setFocusState("done");
    }, 800);
  };

  const stats = [
    { k: "RSVPs in",       v: guests.filter(g => g.rsvp === "yes").length + "/" + guests.length, sub: ev.pending + " still pending" },
    { k: "Vendors booked", v: SETNAYAN_DATA.vendors.filter(v => v.status === "Booked").length + "/" + SETNAYAN_DATA.vendors.length, sub: "1 proposal · 1 inquiry" },
    { k: "Budget",         v: "62%", sub: "on pace · 3 milestones left" },
    { k: "Days to go",     v: ev.daysOut, sub: "" },
  ];

  return (
    <>
      {/* TODAY'S FOCUS — interactive */}
      <div style={{ position: "relative" }}>
        <div className="card" style={{
          padding: "36px 36px 32px",
          background: focusState === "done" ? "var(--sage)" : focusState === "skipped" ? "var(--paper-2)" : "var(--ivory)",
          border: "1px solid " + (focusState === "done" ? "var(--sage-deep)" : focusState === "skipped" ? "var(--line)" : "var(--orange-3)"),
          display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36, alignItems: "center",
          position: "relative", overflow: "hidden", transition: "background .35s, border-color .35s",
        }}>
          <div aria-hidden style={{ position: "absolute", right: -80, top: -80, width: 360, height: 360, borderRadius: "50%", background: focusState === "done" ? "var(--sage-deep)" : "var(--orange-3)", opacity: 0.18, filter: "blur(40px)" }} />

          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: focusState === "done" ? "var(--sage-deep)" : "var(--orange)" }} />
              <span className="label-mono" style={{ color: focusState === "done" ? "var(--sage-deep)" : "var(--orange-2)" }}>
                {focusState === "done" ? "Done · Tuesday, 13 May" : focusState === "skipped" ? "Skipped · revisit tomorrow" : "Today's focus · Tuesday, 13 May"}
              </span>
              {focusState !== "done" && focusState !== "skipped" && (
                <span className="pill" style={{
                  background: "var(--ink)", color: "var(--orange-3)",
                  borderColor: "transparent", fontSize: 10, padding: "3px 8px",
                  fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase",
                }}>
                  ✦ PRO · AI Co-pilot
                </span>
              )}
            </div>
            {focusState === "done" ? (
              <>
                <div className="display" style={{ fontSize: 44, lineHeight: 1.02, color: "var(--ink)" }}>
                  ✓ All 47 invites sent.
                </div>
                <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 14, lineHeight: 1.6, maxWidth: 520 }}>
                  Personal QR codes generated. Guests will receive their links within the next minute. We'll surface your next focus tomorrow — for now, enjoy the small win.
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <button className="btn btn-ghost" onClick={() => setFocusState("pending")} style={{ padding: "14px 22px" }}>Undo</button>
                  <button className="btn btn-ghost" style={{ padding: "14px 22px" }}>View RSVPs ↗</button>
                </div>
              </>
            ) : focusState === "skipped" ? (
              <>
                <div className="display" style={{ fontSize: 44, lineHeight: 1.02, color: "var(--ink)" }}>
                  Skipped for today.
                </div>
                <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 14, lineHeight: 1.6, maxWidth: 520 }}>
                  We'll surface this again tomorrow. Heads-up: every day you wait shortens the
                  buffer before your caterer needs final headcount on Dec 5.
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <button className="btn btn-orange" onClick={() => setFocusState("pending")} style={{ padding: "14px 22px" }}>I'll do it now</button>
                </div>
              </>
            ) : (
              <>
                <div className="display" style={{ fontSize: 44, lineHeight: 1.02, color: "var(--ink)" }}>
                  Send invites to 47 pending guests.
                </div>
                <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 14, lineHeight: 1.6, maxWidth: 520 }}>
                  <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Why this matters today:</strong>{" "}
                  Your caterer needs a final headcount on Dec 5. Each guest takes a day or two to
                  respond — sending today gives you 19 days of buffer instead of 12.
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <button onClick={sendInvites} disabled={focusState === "sending"} className="btn btn-orange btn-lg">
                    {focusState === "sending" ? "Sending…" : "Send all 47 invites"}
                  </button>
                  <button onClick={() => alert("QR sheet sent to your default printer")} className="btn btn-ghost" style={{ padding: "14px 22px" }}>Print QR sheet</button>
                  <button onClick={() => setFocusState("skipped")} className="btn btn-ghost" style={{ padding: "14px 18px" }}>Skip · do tomorrow</button>
                </div>
              </>
            )}
          </div>

          {/* Today's other two things (small) */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="label-mono" style={{ color: "var(--slate-2)" }}>Two small things, if you have time</div>
            {[
              { key: "swatches", label: "Review Bloom & Co. florals sample swatches", who: "Mika dropped them this morning", time: "5 min" },
              { key: "proposal", label: "Reply to Manong Romy Trio's revised proposal", who: "Awaiting your sign-off on set list", time: "10 min" },
            ].map((t) => {
              const isDone = smalls[t.key];
              return (
                <button key={t.key} onClick={() => setSmalls({ ...smalls, [t.key]: !isDone })} style={{
                  padding: "14px 16px", background: isDone ? "var(--sage)" : "var(--paper)",
                  border: "1px solid " + (isDone ? "var(--sage-deep)" : "var(--line)"),
                  borderRadius: 10, cursor: "pointer", fontFamily: "var(--sans)",
                  display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, textAlign: "left",
                  transition: "background .2s, border-color .2s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: `1.5px solid ${isDone ? "var(--sage-deep)" : "var(--line)"}`,
                    background: isDone ? "var(--sage-deep)" : "transparent",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                  }}>{isDone && "✓"}</div>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, lineHeight: 1.4, textDecoration: isDone ? "line-through" : "none" }}>{t.label}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>{t.who}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: "var(--orange-2)", alignSelf: "center" }}>{t.time}</span>
                </button>
              );
            })}
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 4, lineHeight: 1.5 }}>
              Tap to mark done. <a href="#" style={{ color: "var(--orange-2)", textDecoration: "none" }}>Show me everything →</a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats — secondary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {stats.map((s) => (
          <div key={s.k} className="card" style={{ padding: 16 }}>
            <div className="label-mono" style={{ fontSize: 10 }}>{s.k}</div>
            <div className="display" style={{ fontSize: 30, marginTop: 4, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            {s.sub && <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22 }}>
        {/* Upcoming timeline */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="label-mono">Upcoming · next 30 days</div>
            <a href="#" style={{ fontSize: 12, color: "var(--orange-2)", textDecoration: "none" }}>Open schedule →</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {SETNAYAN_DATA.timeline.slice(1, 6).map((t, i) => {
              const isDone = done[i + 1] || t.done;
              return (
                <div key={i} onClick={() => setDone({ ...done, [i + 1]: !isDone })} style={{
                  display: "grid", gridTemplateColumns: "70px auto 1fr auto", gap: 14, alignItems: "center",
                  padding: "12px 4px", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                  cursor: "pointer",
                }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>{t.date}</div>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: `1.5px solid ${isDone ? "var(--sage-deep)" : "var(--line)"}`,
                    background: isDone ? "var(--sage-deep)" : "transparent",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                  }}>{isDone && "✓"}</div>
                  <div style={{ fontSize: 14, color: isDone ? "var(--slate-3)" : "var(--ink)", textDecoration: isDone ? "line-through" : "none" }}>
                    {t.label}
                  </div>
                  <span className="pill" style={{ fontSize: 10, padding: "3px 8px", background: t.type === "vendor" ? "var(--orange-4)" : "var(--paper-2)", borderColor: t.type === "vendor" ? "var(--orange-3)" : "var(--line)", color: t.type === "vendor" ? "var(--orange-2)" : "var(--slate-2)" }}>
                    {t.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vendor messages */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="label-mono">Vendor inbox · 3 new</div>
            <a href="#" style={{ fontSize: 12, color: "var(--orange-2)", textDecoration: "none" }}>Open all →</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SETNAYAN_DATA.vendors.filter(v => v.thread.length).slice(0, 3).map((v) => (
              <div key={v.id} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)", background: "var(--paper)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>{v.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>{v.thread[0].at}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4, lineHeight: 1.5 }}>
                  {v.thread[0].text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* On the day card */}
      <div className="card" style={{ padding: 20, background: "var(--ink)", color: "var(--paper)", border: "none", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "center" }}>
        <div>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>On the day · preview</div>
          <div className="display" style={{ fontSize: 36, marginTop: 6, color: "var(--paper)" }}>
            Same-day highlight reel, ready 30 min after the kiss.
          </div>
          <div style={{ fontSize: 13, color: "var(--slate-4)", marginTop: 8, lineHeight: 1.55, maxWidth: 480 }}>
            Connect the Panood broadcaster + designate your Papic crew. The AI editor stitches
            ceremony, walk-down, and reception toasts into a polished reel before dessert.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {["Panood live", "Papic crew", "Highlight reel", "Monogram"].map((p) => (
            <div key={p} style={{ padding: 10, background: "rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 12, color: "var(--paper)" }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--orange-3)" }}>● ready</span>
              <div style={{ marginTop: 4 }}>{p}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────── Guests tab — interactive RSVP toggle
const GuestsTab = ({ guests, setGuests }) => {
  const cycleRsvp = (id) => {
    const order = ["pending", "yes", "no"];
    setGuests(guests.map(g =>
      g.id === id ? { ...g, rsvp: order[(order.indexOf(g.rsvp) + 1) % order.length] } : g
    ));
  };
  const tally = {
    yes:     guests.filter(g => g.rsvp === "yes").length,
    pending: guests.filter(g => g.rsvp === "pending").length,
    no:      guests.filter(g => g.rsvp === "no").length,
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>GUEST LIST</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Click any RSVP to cycle yes → no → pending. Changes ripple to seating, QR sheet, and caterer headcount.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Import .csv</button>
          <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>+ Add guest</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <Stat k="Confirmed" v={tally.yes}     hint="seats locked" tone="sage" />
        <Stat k="Pending"   v={tally.pending} hint="follow up"   tone="orange" />
        <Stat k="Declined"  v={tally.no}      hint="off the chart" />
        <Stat k="Plus-ones" v={guests.filter(g => g.plusOne).length} hint="auto-added" />
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--paper-2)" }}>
              {["Guest", "Group", "RSVP", "Plus one", "Table", "Diet", "QR"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate-2)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td style={{ padding: "12px 14px", color: "var(--ink)", fontWeight: 500 }}>{g.name}</td>
                <td style={{ padding: "12px 14px", color: "var(--slate)" }}>{g.group}</td>
                <td style={{ padding: "12px 14px" }}>
                  <RsvpChip rsvp={g.rsvp} onClick={() => cycleRsvp(g.id)} />
                </td>
                <td style={{ padding: "12px 14px", color: "var(--slate)" }}>{g.plusOne ? "+1" : "—"}</td>
                <td style={{ padding: "12px 14px", color: "var(--slate)" }}>{g.table}</td>
                <td style={{ padding: "12px 14px", color: "var(--slate)" }}>{g.diet}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>{g.qr}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const Stat = ({ k, v, hint, tone }) => {
  const color = tone === "sage" ? "var(--sage-deep)" : tone === "orange" ? "var(--orange-2)" : "var(--ink)";
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="label-mono" style={{ fontSize: 10 }}>{k}</div>
      <div className="display" style={{ fontSize: 28, color, marginTop: 2 }}>{v}</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 2 }}>{hint}</div>
    </div>
  );
};

const RsvpChip = ({ rsvp, onClick }) => {
  const styles = {
    yes:     { bg: "var(--sage)",      fg: "var(--sage-deep)", dot: "var(--sage-deep)", label: "Yes" },
    pending: { bg: "var(--orange-4)",  fg: "var(--orange-2)",  dot: "var(--orange)",    label: "Pending" },
    no:      { bg: "var(--paper-2)",   fg: "var(--slate-2)",   dot: "var(--slate-3)",   label: "No" },
  }[rsvp];
  return (
    <button onClick={onClick} style={{
      background: styles.bg, color: styles.fg, border: "none", cursor: "pointer",
      padding: "4px 10px", borderRadius: 999, fontSize: 12, fontFamily: "var(--sans)", fontWeight: 500,
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: styles.dot }} />
      {styles.label}
    </button>
  );
};

Object.assign(window, { CoupleDashboard });
