// Couple's mobile dashboard — what the couple uses day-to-day on their phone.
// Designed for thumb-zone, leading with Today's Focus, single-task discipline.
// Width: 390 (iPhone 15 Pro). Bottom nav tab bar.

const CoupleMobile = () => {
  const [tab, setTab] = useState("home");
  return (
    <div style={{ width: 390, margin: "0 auto", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--sans)", minHeight: 844, position: "relative", borderRadius: 32, overflow: "hidden", border: "1px solid var(--line)" }}>
      {/* Status bar */}
      <div style={{ height: 44, padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
        <span>9:41</span>
        <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 10 }}>●●●●</span>
          <span style={{ width: 16, height: 8, borderRadius: 2, background: "var(--ink)" }} />
        </span>
      </div>

      {/* Body — pad bottom for tab bar */}
      <div style={{ paddingBottom: 90 }}>
        {tab === "home"     && <CMHome />}
        {tab === "guests"   && <CMGuests />}
        {tab === "vendors"  && <CMVendors />}
        {tab === "schedule" && <CMSchedule />}
        {tab === "more"     && <CMMore />}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(251,248,242,0.94)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid var(--line-soft)",
        padding: "10px 8px 24px",
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4,
      }}>
        {[
          { id: "home",     label: "Home",     icon: "◐" },
          { id: "guests",   label: "Guests",   icon: "◇", badge: "47" },
          { id: "vendors",  label: "Vendors",  icon: "◑", badge: "3" },
          { id: "schedule", label: "Schedule", icon: "◒" },
          { id: "more",     label: "More",     icon: "◼" },
        ].map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              border: "none", background: "transparent",
              padding: "6px 4px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              fontFamily: "var(--sans)", position: "relative",
            }}>
              <div style={{ fontSize: 18, color: on ? "var(--orange-2)" : "var(--slate-2)", lineHeight: 1 }}>
                {t.icon}
              </div>
              <div style={{ fontSize: 10, color: on ? "var(--orange-2)" : "var(--slate-2)", fontWeight: on ? 500 : 400 }}>
                {t.label}
              </div>
              {t.badge && (
                <div style={{
                  position: "absolute", top: 2, right: "calc(50% - 18px)",
                  background: "var(--orange)", color: "#fff",
                  fontSize: 9, padding: "1px 5px", borderRadius: 999,
                  fontFamily: "var(--mono)", fontWeight: 500,
                }}>{t.badge}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────── Home tab — Today's focus + glance
const CMHome = () => (
  <>
    {/* Header */}
    <div style={{ padding: "12px 20px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
          Good evening, Claire
        </div>
        <div style={{ fontSize: 14, color: "var(--orange-2)", marginTop: 2, fontWeight: 500 }}>
          213 days to go · La Castellana
        </div>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--blush)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)", fontSize: 13, fontWeight: 500 }}>C</div>
    </div>

    {/* Phase progress */}
    <div style={{ padding: "0 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {["Dream","Book","Invite","Final","Day","After"].map((p, i) => {
          const cur = i === 2;
          const done = i < 2;
          return (
            <div key={p} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: cur ? "var(--orange)" : done ? "var(--sage-deep)" : "var(--line)",
              }} />
              <div style={{ fontSize: 9, color: cur ? "var(--orange-2)" : "var(--slate-2)", fontFamily: "var(--mono)", letterSpacing: "0.04em", textAlign: "center" }}>
                {p}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* TODAY'S FOCUS — the hero card */}
    <div style={{ padding: "0 16px", marginBottom: 16 }}>
      <div style={{
        background: "var(--ivory)",
        border: "1px solid var(--orange-3)",
        borderRadius: 18,
        padding: "22px 20px 20px",
        position: "relative", overflow: "hidden",
      }}>
        <div aria-hidden style={{ position: "absolute", right: -50, top: -50, width: 200, height: 200, borderRadius: "50%", background: "var(--orange-3)", opacity: 0.25, filter: "blur(30px)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange)" }} />
            <span className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Today's focus</span>
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: "var(--ink)", color: "var(--orange-3)", fontFamily: "var(--mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              ✦ Pro
            </span>
          </div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 26, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.04 }}>
            Send invites to<br />47 pending guests.
          </div>
          <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 10, lineHeight: 1.5 }}>
            <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Why now:</strong> caterer needs headcount in 7 days. Each guest takes 1–2 days to reply.
          </div>
          <button className="btn btn-orange" style={{ marginTop: 14, padding: "12px 18px", fontSize: 13, justifyContent: "center", width: "100%" }}>
            Send all 47 invites
          </button>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1, padding: "10px 12px", fontSize: 12, justifyContent: "center" }}>Print QR sheet</button>
            <button className="btn btn-ghost" style={{ padding: "10px 14px", fontSize: 12 }}>Later</button>
          </div>
        </div>
      </div>
    </div>

    {/* Two small things */}
    <div style={{ padding: "0 16px", marginBottom: 24 }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.10em", marginBottom: 8 }}>
        Two small things, if you have time
      </div>
      {[
        { label: "Review Bloom & Co. florals sample swatches", who: "Mika dropped them this morning", time: "5 min" },
        { label: "Reply to Manong Romy Trio's revised proposal", who: "Awaiting your sign-off",        time: "10 min" },
      ].map((t, i) => (
        <div key={i} style={{
          padding: "12px 14px", background: "var(--paper-2)", borderRadius: 10,
          marginBottom: 6, display: "grid", gridTemplateColumns: "1fr auto", gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500, lineHeight: 1.4 }}>{t.label}</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--slate-2)", marginTop: 3 }}>{t.who}</div>
          </div>
          <span className="mono" style={{ fontSize: 9, color: "var(--orange-2)", alignSelf: "center" }}>{t.time}</span>
        </div>
      ))}
    </div>

    {/* Stats grid 2×2 */}
    <div style={{ padding: "0 16px", marginBottom: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { k: "RSVPs in",    v: "166/213", hint: "47 pending" },
          { k: "Vendors",     v: "9/12",    hint: "1 proposal" },
          { k: "Budget",      v: "62%",     hint: "on pace" },
          { k: "Days to go",  v: "213",     hint: "Dec 18, 2026" },
        ].map(s => (
          <div key={s.k} className="card" style={{ padding: 14, borderRadius: 12 }}>
            <div className="mono" style={{ fontSize: 9, color: "var(--slate-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{s.k}</div>
            <div className="display" style={{ fontSize: 22, color: "var(--ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", marginTop: 2 }}>{s.hint}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Vendor inbox preview */}
    <div style={{ padding: "0 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.10em" }}>Vendor inbox · 3 new</span>
        <a href="#" style={{ fontSize: 11, color: "var(--orange-2)", textDecoration: "none" }}>Open →</a>
      </div>
      {[
        { who: "Bloom & Co.",   msg: "Sample swatches dropped 🌸",     when: "10:18am" },
        { who: "Ato Catering",  msg: "Headcount locked at 213.",         when: "Yesterday" },
        { who: "Manong Romy",   msg: "Updated set list per your notes.", when: "2 days" },
      ].map((m, i) => (
        <div key={i} style={{ padding: "12px 14px", background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--orange-2)" }}>{m.who}</span>
            <span className="mono" style={{ fontSize: 9, color: "var(--slate-3)" }}>{m.when}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink)", marginTop: 4, lineHeight: 1.4 }}>{m.msg}</div>
        </div>
      ))}
    </div>

    {/* On the day mini */}
    <div style={{ padding: "0 16px" }}>
      <div style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: 14, padding: 18 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.10em" }}>On the day · ready</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: "var(--paper)", textTransform: "uppercase", marginTop: 6 }}>
          Highlight reel · 30 min after the kiss
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
          {["Panood", "Papic", "Reel", "Monogram"].map(p => (
            <div key={p} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.06)", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--orange)" }} />
              <span style={{ fontSize: 11, color: "var(--paper)" }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </>
);

// ─────────────────────────── Guests tab — quick RSVP triage
const CMGuests = () => {
  const guests = (window.SETNAYAN_DATA?.guests || []).slice(0, 10);
  return (
    <>
      <div style={{ padding: "12px 20px 16px" }}>
        <div className="display" style={{ fontSize: 28 }}>GUEST LIST</div>
        <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4 }}>10 of 213 · tap to cycle RSVP</div>
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          {[
            { k: "Yes",     v: "166", t: "sage" },
            { k: "Pending", v: "47",  t: "orange" },
            { k: "No",      v: "0",   t: "" },
          ].map(s => (
            <div key={s.k} style={{
              padding: 10,
              background: s.t === "sage" ? "var(--sage)" : s.t === "orange" ? "var(--orange-4)" : "var(--paper-2)",
              borderRadius: 10,
            }}>
              <div className="mono" style={{ fontSize: 9, color: s.t === "sage" ? "var(--sage-deep)" : s.t === "orange" ? "var(--orange-2)" : "var(--slate-2)", letterSpacing: "0.08em" }}>{s.k}</div>
              <div className="display" style={{ fontSize: 22, color: s.t === "sage" ? "var(--sage-deep)" : s.t === "orange" ? "var(--orange-2)" : "var(--ink)", marginTop: 2 }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {guests.map((g, i) => (
            <div key={g.id} style={{
              display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
              padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
            }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{g.name}</div>
                <div className="mono" style={{ fontSize: 9, color: "var(--slate-2)", marginTop: 2 }}>
                  {g.group} · Table {g.table}
                </div>
              </div>
              <span style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 999, fontWeight: 500,
                background: g.rsvp === "yes" ? "var(--sage)" : g.rsvp === "pending" ? "var(--orange-4)" : "var(--paper-2)",
                color:      g.rsvp === "yes" ? "var(--sage-deep)" : g.rsvp === "pending" ? "var(--orange-2)" : "var(--slate-2)",
              }}>
                {g.rsvp === "yes" ? "Yes" : g.rsvp === "pending" ? "Pending" : "No"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────── Vendors tab — pipeline cards
const CMVendors = () => {
  const vendors = (window.SETNAYAN_DATA?.vendors || []).slice(0, 6);
  return (
    <>
      <div style={{ padding: "12px 20px 16px" }}>
        <div className="display" style={{ fontSize: 28 }}>VENDORS</div>
        <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4 }}>9 booked · 1 proposal · 1 inquiry</div>
      </div>
      <div style={{ padding: "0 16px" }}>
        {vendors.map(v => (
          <div key={v.id} className="card" style={{
            padding: 14, marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center",
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--paper-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--orange-2)", fontSize: 14, fontWeight: 500 }}>
              {v.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                {v.name}
                {v.verified && <span style={{ fontSize: 9, color: "var(--orange-2)" }}>✓</span>}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>{v.category} · {v.paid}% paid</div>
            </div>
            <span style={{
              padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 500,
              background: v.status === "Booked" ? "var(--sage)" : v.status === "Proposal" ? "var(--orange-4)" : "var(--paper-2)",
              color:      v.status === "Booked" ? "var(--sage-deep)" : v.status === "Proposal" ? "var(--orange-2)" : "var(--slate-2)",
            }}>{v.status}</span>
          </div>
        ))}
      </div>
    </>
  );
};

// ─────────────────────────── Schedule tab — timeline
const CMSchedule = () => {
  const timeline = (window.SETNAYAN_DATA?.timeline || []).slice(0, 7);
  return (
    <>
      <div style={{ padding: "12px 20px 16px" }}>
        <div className="display" style={{ fontSize: 28 }}>SCHEDULE</div>
        <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4 }}>Subscribe .ics to sync to your phone</div>
      </div>
      <div style={{ padding: "0 16px" }}>
        {timeline.map((t, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "60px 18px 1fr", gap: 12, alignItems: "center",
            padding: "12px 0", borderTop: i === 0 ? "1px solid var(--line)" : "1px solid var(--line-soft)",
            background: t.hero ? "var(--orange-4)" : "transparent",
            padding: t.hero ? "12px 12px" : "12px 0",
            borderRadius: t.hero ? 10 : 0,
            margin: t.hero ? "4px -8px" : 0,
          }}>
            <div className="mono" style={{ fontSize: 11, color: t.hero ? "var(--orange-2)" : "var(--slate-2)", fontWeight: t.hero ? 500 : 400 }}>{t.date}</div>
            <div style={{
              width: 14, height: 14, borderRadius: "50%",
              background: t.done ? "var(--sage-deep)" : "transparent",
              border: `1.5px solid ${t.done ? "var(--sage-deep)" : t.hero ? "var(--orange)" : "var(--line)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 9,
            }}>{t.done && "✓"}</div>
            <div style={{
              fontSize: t.hero ? 14 : 13,
              color: t.done ? "var(--slate-3)" : "var(--ink)",
              textDecoration: t.done ? "line-through" : "none",
              fontWeight: t.hero ? 500 : 400,
            }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

// ─────────────────────────── More tab
const CMMore = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 28 }}>MORE</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      {[
        { i: "✻", label: "Mood board", sub: "Pakulay · 12 boards saved" },
        { i: "✦", label: "Invitations", sub: "47 pending · 166 confirmed" },
        { i: "✱", label: "In-app services", sub: "Panood · Papic · Highlight reel" },
        { i: "◆", label: "Payments + receipts", sub: "Milestone schedule · official receipts" },
        { i: "◇", label: "Co-hosts", sub: "6 collaborating · parents, MOH, MC" },
        { i: "○", label: "Settings", sub: "Account · language · notifications" },
        { i: "?", label: "Help center", sub: "FAQs · contact a human" },
      ].map(m => (
        <div key={m.label} style={{
          display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center",
          padding: "16px 14px", borderRadius: 12, marginBottom: 4, background: "var(--paper-2)",
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--ink)", color: "var(--orange-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            {m.i}
          </div>
          <div>
            <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{m.label}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>{m.sub}</div>
          </div>
          <span style={{ color: "var(--slate-3)", fontSize: 18 }}>›</span>
        </div>
      ))}
      <div style={{ padding: 14, marginTop: 12, textAlign: "center" }}>
        <div className="serif" style={{ fontSize: 16, fontStyle: "italic", color: "var(--orange-2)" }}>
          Set na 'yan.
        </div>
        <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", marginTop: 6 }}>
          v 2026.05 · Quezon City, PH
        </div>
      </div>
    </div>
  </>
);

Object.assign(window, { CoupleMobile });
