// Mobile dashboards for vendors and admins.
// Same phone-shape pattern as CoupleMobile: status bar, bottom tab nav, single-task discipline.

// ──────────────────────────────────────────────────────────────────
// VENDOR MOBILE
const VendorMobile = () => {
  const [tab, setTab] = useState("pipeline");
  return (
    <div style={mobileShell()}>
      <MobileStatusBar />
      <div style={{ paddingBottom: 90 }}>
        {tab === "pipeline" && <VMPipeline />}
        {tab === "inbox"    && <VMInbox />}
        {tab === "calendar" && <VMCalendar />}
        {tab === "earnings" && <VMEarnings />}
        {tab === "more"     && <VMMore />}
      </div>
      <MobileTabBar tab={tab} setTab={setTab} tabs={[
        { id: "pipeline", label: "Pipeline", icon: "◐", badge: "9" },
        { id: "inbox",    label: "Inbox",    icon: "◇", badge: "3" },
        { id: "calendar", label: "Calendar", icon: "◑" },
        { id: "earnings", label: "Earnings", icon: "◒" },
        { id: "more",     label: "More",     icon: "◼" },
      ]} />
    </div>
  );
};

const VMPipeline = () => (
  <>
    <div style={{ padding: "12px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
          Ato Catering · ✓ Verified
        </div>
        <div className="display" style={{ fontSize: 22, marginTop: 2 }}>PIPELINE</div>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--orange-4)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--orange-2)", fontSize: 13, fontWeight: 500 }}>A</div>
    </div>
    <div style={{ padding: "0 16px 12px" }}>
      <div className="card" style={{ padding: 18, background: "var(--ivory)", border: "1px solid var(--orange-3)" }}>
        <div className="label-mono" style={{ color: "var(--orange-2)" }}>Today's focus</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: "var(--ink)", textTransform: "uppercase", marginTop: 4, lineHeight: 1.1 }}>
          Send proposal to Ria &amp; Sam
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 6 }}>Inquiry · 2 days old · response avg 4h</div>
        <button className="btn btn-orange" style={{ padding: "10px 14px", fontSize: 12, marginTop: 12, width: "100%", justifyContent: "center" }}>Open proposal builder</button>
      </div>
    </div>
    <div style={{ padding: "0 16px" }}>
      <div className="label-mono" style={{ marginBottom: 8 }}>By column</div>
      {[
        { col: "Inquiry",   n: 3, accent: "var(--paper-2)" },
        { col: "Proposal",  n: 2, accent: "var(--orange-4)" },
        { col: "Booked",    n: 3, accent: "var(--sage)" },
        { col: "Completed", n: 2, accent: "var(--paper-2)" },
      ].map(c => (
        <div key={c.col} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, padding: "12px 14px", marginBottom: 6, background: c.accent, borderRadius: 10, alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{c.col}</span>
          <span className="display" style={{ fontSize: 22, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{c.n}</span>
          <span style={{ color: "var(--slate-3)", fontSize: 18 }}>›</span>
        </div>
      ))}
    </div>
  </>
);

const VMInbox = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>INBOX · 3 NEW</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      {[
        { who: "Claire &amp; Ice", when: "Today", preview: "Got it — added crew meal note to schedule.", unread: false },
        { who: "Ria &amp; Sam",    when: "Yesterday", preview: "Could we swap the pork dish for a fish option?", unread: true },
        { who: "Bea &amp; Joaquin",when: "2d",   preview: "Hi — checking if you can do Feb 7?", unread: true },
        { who: "Camille &amp; Niko",when: "4d",  preview: "Sample menu pls — vegetarian for 80.", unread: true },
      ].map((t, i) => (
        <div key={i} style={{ padding: "12px 14px", marginBottom: 4, background: i === 0 ? "var(--orange-4)" : "var(--paper-2)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: t.unread ? 600 : 500 }} dangerouslySetInnerHTML={{ __html: t.who }} />
            <span className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>{t.when}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4, lineHeight: 1.4, display: "flex", gap: 6, alignItems: "center" }}>
            {t.unread && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--orange)", flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{t.preview}</span>
          </div>
        </div>
      ))}
    </div>
  </>
);

const VMCalendar = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>DECEMBER 2026</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>3 bookings · 2 payment deadlines · 1 wedding</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      {[
        { d: "5", label: "Headcount lock · M&J", type: "deadline" },
        { d: "7", label: "Final payment due · M&J", type: "payment" },
        { d: "12", label: "Claire & Ice wedding", type: "wedding", hero: true },
        { d: "18", label: "Tasting · The Lim", type: "meeting" },
        { d: "27", label: "Bea & Joaquin · proposal due", type: "deadline" },
      ].map((e, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "50px 1fr auto", gap: 12, padding: "14px 14px", marginBottom: 6, background: e.hero ? "var(--orange-4)" : "var(--paper-2)", borderRadius: 10, alignItems: "center" }}>
          <div className="display" style={{ fontSize: 28, color: e.hero ? "var(--orange-2)" : "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {e.d}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: e.hero ? 500 : 400 }}>{e.label}</div>
          <span className="mono" style={{ fontSize: 9, color: "var(--slate-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{e.type}</span>
        </div>
      ))}
    </div>
  </>
);

const VMEarnings = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>EARNINGS</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>Reconciled daily · receipts auto-stamped</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      <div className="card" style={{ padding: 18, background: "var(--ink)", color: "var(--paper)", border: "none" }}>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>This month</div>
        <div className="display" style={{ fontSize: 36, color: "var(--paper)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>₱228,000</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)", marginTop: 4 }}>2 payouts · 1 due Dec 7</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
        <Stat k="YTD" v="₱1.84M" hint="14 bookings" />
        <Stat k="Avg" v="₱131K" hint="up 12%" tone="sage" />
      </div>
      <div className="label-mono" style={{ marginTop: 16, marginBottom: 8 }}>Recent payouts</div>
      {[
        ["Claire & Ice", "60% midpoint", "₱216,600", "paid"],
        ["Reyes wedding", "Final 25%", "₱46,313", "paid"],
        ["The Lim", "Booking 25%", "₱61,750", "paid"],
        ["Claire & Ice", "Final 40%", "₱144,400", "due Dec 7"],
      ].map(([who, m, amt, status], i) => (
        <div key={i} style={{ padding: "12px 14px", marginBottom: 4, background: "var(--paper-2)", borderRadius: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{who}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>{m} · net after 5%</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 12, color: status === "paid" ? "var(--sage-deep)" : "var(--orange-2)", fontWeight: 500 }}>{amt}</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", marginTop: 2 }}>{status}</div>
          </div>
        </div>
      ))}
    </div>
  </>
);

const VMMore = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>MORE</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      {[
        { i: "★", label: "Public profile",    sub: "4.92 ★ · 38 reviews · ✓ verified" },
        { i: "✦", label: "Services & prices", sub: "8 services live" },
        { i: "○", label: "Team & crew",       sub: "Joey + 4 captains · 18 servers" },
        { i: "↗", label: "Sponsored boost",   sub: "₱1,200/wk · 10→30km reach" },
        { i: "◆", label: "Setnayan Pro",      sub: "₱1,999/month · founder rate available" },
        { i: "◇", label: "Settings",          sub: "Account · payouts · KYC" },
        { i: "?", label: "Help center",       sub: "Vendor docs · contact us" },
      ].map(m => (
        <div key={m.label} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", padding: "14px 14px", borderRadius: 10, marginBottom: 4, background: "var(--paper-2)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--ink)", color: "var(--orange-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{m.i}</div>
          <div>
            <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{m.label}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>{m.sub}</div>
          </div>
          <span style={{ color: "var(--slate-3)", fontSize: 18 }}>›</span>
        </div>
      ))}
    </div>
  </>
);

// ──────────────────────────────────────────────────────────────────
// ADMIN MOBILE
const AdminMobile = () => {
  const [tab, setTab] = useState("home");
  return (
    <div style={mobileShell()}>
      <MobileStatusBar />
      <div style={{ paddingBottom: 90 }}>
        {tab === "home"   && <AMHome />}
        {tab === "verify" && <AMVerify />}
        {tab === "trust"  && <AMTrust />}
        {tab === "growth" && <AMGrowth />}
        {tab === "more"   && <AMMore />}
      </div>
      <MobileTabBar tab={tab} setTab={setTab} tabs={[
        { id: "home",   label: "Overview", icon: "◐" },
        { id: "verify", label: "Verify",   icon: "◇", badge: "12" },
        { id: "trust",  label: "Trust",    icon: "◑", badge: "3" },
        { id: "growth", label: "Growth",   icon: "◒" },
        { id: "more",   label: "More",     icon: "◼" },
      ]} />
    </div>
  );
};

const AMHome = () => (
  <>
    <div style={{ padding: "12px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
          Setnayan ops · Level 3
        </div>
        <div className="display" style={{ fontSize: 22, marginTop: 2 }}>OVERVIEW</div>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ink)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500 }}>MB</div>
    </div>
    <div style={{ padding: "0 16px 12px" }}>
      <div className="card" style={{ padding: 16, background: "var(--paper-2)" }}>
        <div className="label-mono">All systems</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 14, color: "var(--ink)" }}>Operational</span>
          <span style={{ fontSize: 11, color: "var(--sage-deep)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage-deep)" }} />
            14d since last incident
          </span>
        </div>
      </div>
    </div>
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { k: "Active couples",   v: "1,840", d: "+187" },
          { k: "Verified vendors", v: "412",   d: "+24"  },
          { k: "Weddings shipped", v: "84",    d: "+14"  },
          { k: "Time-to-book",     v: "3.2d",  d: "−0.6d", tone: "sage" },
        ].map(s => (
          <div key={s.k} className="card" style={{ padding: 14, borderRadius: 12 }}>
            <div className="mono" style={{ fontSize: 9, color: "var(--slate-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{s.k}</div>
            <div className="display" style={{ fontSize: 22, color: "var(--ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div className="mono" style={{ fontSize: 9, color: s.tone === "sage" ? "var(--sage-deep)" : "var(--orange-2)", marginTop: 2 }}>↑ {s.d} / 30d</div>
          </div>
        ))}
      </div>
      <div className="label-mono" style={{ marginBottom: 8 }}>Today's queue</div>
      {[
        { kind: "Verify",  item: "Hilom Make-up · Davao", age: "4h", pill: "orange" },
        { kind: "Dispute", item: "Reyes · refund request", age: "3h", pill: "blush" },
        { kind: "Flagged", item: "Vendor msg · off-platform price", age: "6h", pill: "blush" },
        { kind: "Approve", item: "Boost · Bloom & Co.", age: "1d", pill: "orange" },
      ].map((q, i) => (
        <div key={i} style={{ padding: "12px 14px", marginBottom: 4, background: "var(--paper-2)", borderRadius: 8, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
          <span className="pill" style={{ fontSize: 9, padding: "2px 7px", background: q.pill === "orange" ? "var(--orange-4)" : "var(--blush)", color: q.pill === "orange" ? "var(--orange-2)" : "var(--blush-deep)", borderColor: "transparent" }}>{q.kind}</span>
          <span style={{ fontSize: 12, color: "var(--ink)" }}>{q.item}</span>
          <span className="mono" style={{ fontSize: 9, color: "var(--slate-3)" }}>{q.age}</span>
        </div>
      ))}
    </div>
  </>
);

const AMVerify = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>VERIFICATION · 12</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>SLA 24h · current 18h avg</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      {[
        { name: "Hilom Make-up", cat: "H&M · Davao", docs: "5/5", status: "ready" },
        { name: "Tinta Calligraphy", cat: "Stationery · Manila", docs: "4/5", status: "ready" },
        { name: "Bukid Catering", cat: "Catering · Pampanga", docs: "5/5", status: "ready" },
        { name: "Indak Dance Crew", cat: "Entertainment · Cebu", docs: "3/5", status: "missing" },
        { name: "Sila Events", cat: "Coord · Iloilo", docs: "5/5", status: "ready" },
      ].map((v, i) => (
        <div key={i} style={{ padding: "12px 14px", marginBottom: 6, background: "var(--paper-2)", borderRadius: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{v.name}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>{v.cat} · {v.docs} docs</div>
          </div>
          <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 500, background: v.status === "ready" ? "var(--sage)" : "var(--blush)", color: v.status === "ready" ? "var(--sage-deep)" : "var(--blush-deep)" }}>
            {v.status === "ready" ? "Ready" : "Missing"}
          </span>
        </div>
      ))}
      <button className="btn btn-orange" style={{ padding: "12px 14px", fontSize: 13, marginTop: 12, width: "100%", justifyContent: "center" }}>
        Bulk approve ready (4)
      </button>
    </div>
  </>
);

const AMTrust = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>TRUST &amp; SAFETY</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>3 high · 4 medium · median 19h</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      {[
        { id: "TS-0042", kind: "Dispute", party: "Reyes ↔ Ato Catering", detail: "Refund · final 25%", age: "3h", sev: "high" },
        { id: "TS-0041", kind: "Flagged", party: "Lakas Lights msg", detail: "Off-platform price", age: "6h", sev: "high" },
        { id: "TS-0040", kind: "Refund",  party: "Patricia Cruz", detail: "Coordinator no-show", age: "2d", sev: "med" },
        { id: "TS-0039", kind: "Identity", party: "New vendor signup", detail: "DTI mismatch", age: "3d", sev: "med" },
      ].map((c, i) => (
        <div key={i} style={{ padding: "14px 14px", marginBottom: 6, background: "var(--paper-2)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>{c.id}</span>
            <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 9, background: c.sev === "high" ? "var(--blush)" : "var(--orange-4)", color: c.sev === "high" ? "var(--blush-deep)" : "var(--orange-2)", fontWeight: 500 }}>{c.sev}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>{c.kind} · {c.party}</div>
          <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4 }}>{c.detail}</div>
          <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", marginTop: 6 }}>{c.age} old</div>
        </div>
      ))}
    </div>
  </>
);

const AMGrowth = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>GROWTH</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>Signups · GMV · event-type readiness</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="label-mono">Signups · this week</div>
        <div className="display" style={{ fontSize: 32, color: "var(--ink)", marginTop: 4 }}>312</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", marginTop: 2 }}>↑ 18% WoW</div>
      </div>
      <div className="label-mono" style={{ marginTop: 14, marginBottom: 8 }}>Event-type readiness</div>
      {[
        { name: "Wedding",    n: 412, t: 100, live: true },
        { name: "Debut",      n: 64,  t: 80,  ready: true },
        { name: "Birthday",   n: 38,  t: 60 },
        { name: "Baptism",    n: 22,  t: 50 },
        { name: "Corporate",  n: 31,  t: 80 },
      ].map(e => {
        const pct = Math.min(100, (e.n / e.t) * 100);
        return (
          <div key={e.name} style={{ padding: "12px 14px", marginBottom: 4, background: "var(--paper-2)", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{e.name}</span>
              <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 9, background: e.live ? "var(--sage)" : e.ready ? "var(--orange-4)" : "var(--paper)", color: e.live ? "var(--sage-deep)" : e.ready ? "var(--orange-2)" : "var(--slate-2)", border: e.live || e.ready ? "none" : "1px solid var(--line)" }}>
                {e.live ? "Live" : e.ready ? "Ready" : "Growing"}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>{e.n} / {e.t} vendors</div>
            <div style={{ height: 5, background: "var(--paper)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
              <div style={{ width: pct + "%", height: "100%", background: e.live ? "var(--sage-deep)" : e.ready ? "var(--orange)" : "var(--orange-3)" }} />
            </div>
          </div>
        );
      })}
    </div>
  </>
);

const AMMore = () => (
  <>
    <div style={{ padding: "12px 20px 16px" }}>
      <div className="display" style={{ fontSize: 24 }}>MORE</div>
    </div>
    <div style={{ padding: "0 16px" }}>
      {[
        { i: "◆", label: "Pricing & fees",  sub: "Take rate 5.0% · tiers · catalog" },
        { i: "₱", label: "Finance",          sub: "GMV ₱18.4M · payouts queued" },
        { i: "✦", label: "Directory",        sub: "1,840 couples · 412 vendors" },
        { i: "○", label: "BIR · NPC",        sub: "Compliance dashboard" },
        { i: "✱", label: "Website editor",   sub: "Marketing-site widgets" },
        { i: "◇", label: "Settings",         sub: "Org · team · permissions" },
      ].map(m => (
        <div key={m.label} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", padding: "14px 14px", borderRadius: 10, marginBottom: 4, background: "var(--paper-2)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--ink)", color: "var(--orange-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{m.i}</div>
          <div>
            <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{m.label}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>{m.sub}</div>
          </div>
          <span style={{ color: "var(--slate-3)", fontSize: 18 }}>›</span>
        </div>
      ))}
    </div>
  </>
);

// ──────────────────────────────────────────────────────────────────
// Shared mobile shell pieces

function mobileShell() {
  return {
    width: 390, margin: "0 auto",
    background: "var(--paper)", color: "var(--ink)",
    fontFamily: "var(--sans)", minHeight: 844,
    position: "relative", borderRadius: 32, overflow: "hidden",
    border: "1px solid var(--line)",
  };
}

const MobileStatusBar = () => (
  <div style={{ height: 44, padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
    <span>9:41</span>
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
      <span style={{ fontSize: 10 }}>●●●●</span>
      <span style={{ width: 16, height: 8, borderRadius: 2, background: "var(--ink)" }} />
    </span>
  </div>
);

const MobileTabBar = ({ tab, setTab, tabs }) => (
  <div style={{
    position: "absolute", bottom: 0, left: 0, right: 0,
    background: "rgba(251,248,242,0.94)",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid var(--line-soft)",
    padding: "10px 8px 24px",
    display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: 4,
  }}>
    {tabs.map(t => {
      const on = tab === t.id;
      return (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          border: "none", background: "transparent", padding: "6px 4px", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          fontFamily: "var(--sans)", position: "relative",
        }}>
          <div style={{ fontSize: 18, color: on ? "var(--orange-2)" : "var(--slate-2)", lineHeight: 1 }}>{t.icon}</div>
          <div style={{ fontSize: 10, color: on ? "var(--orange-2)" : "var(--slate-2)", fontWeight: on ? 500 : 400 }}>{t.label}</div>
          {t.badge && (
            <div style={{ position: "absolute", top: 2, right: "calc(50% - 18px)", background: "var(--orange)", color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: 999, fontFamily: "var(--mono)", fontWeight: 500 }}>{t.badge}</div>
          )}
        </button>
      );
    })}
  </div>
);

Object.assign(window, { VendorMobile, AdminMobile });
