// Vendor dashboard — Ato Catering, seeing the same Claire & Ice booking from the other side.

const VendorDashboard = ({ role, setRole }) => {
  const [tab, setTab] = useState("pipeline");
  const [thread, setThread] = useState("v-ci"); // Claire & Ice thread by default

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 880, background: "var(--paper-2)" }}>
      <VendorSidebar tab={tab} setTab={setTab} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <VendorTopbar role={role} setRole={setRole} />
        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>
          {tab === "pipeline" && <VPipeline setTab={setTab} setThread={setThread} />}
          {tab === "customers"&& <VCustomers />}
          {tab === "inbox"    && <VInbox thread={thread} setThread={setThread} />}
          {tab === "calendar" && <VCalendar />}
          {tab === "tokens"   && <VTokens />}
          {tab === "profile"  && <VProfile />}
        </main>
      </div>
    </div>
  );
};

const VendorSidebar = ({ tab, setTab }) => {
  const nav = [
    { id: "pipeline", label: "Pipeline",  badge: "9 active" },
    { id: "inbox",    label: "Inbox",     badge: "3 new" },
    { id: "calendar", label: "Calendar"  },
    { id: "tokens",   label: "Tokens",    badge: "87" },
    { id: "profile",  label: "Profile · microsite" },
    { id: "bundle",   label: "Bundle Maker", lock: "PRO+" },
    { id: "team",     label: "Team & crew" },
    { id: "boost",    label: "Sponsored boost", lock: "PRO+" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <aside style={{ background: "var(--paper)", borderRight: "1px solid var(--line)", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: "4px 4px 16px", borderBottom: "1px solid var(--line-soft)" }}>
        <LogoFull height={28} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px 4px" }}>
        <div className="label-mono">Ato Catering</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="pill pill-orange" style={{ fontSize: 10, padding: "3px 8px" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--orange)" }} />
            ★ Pro · verified
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
                <span className="mono" style={{ fontSize: 10, color: active ? "var(--orange-2)" : "var(--slate-3)" }}>{n.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", padding: 14, borderRadius: 10, background: "var(--ink)", color: "var(--paper)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>Boost your reach</div>
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          10km → 30km visibility for ₱1,200/wk. Pause anytime.
        </div>
        <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 12, alignSelf: "flex-start" }}>Try boost ↗</button>
      </div>
    </aside>
  );
};

const VendorTopbar = ({ role, setRole }) => (
  <header style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)", background: "var(--paper)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
    <div>
      <div className="label-mono">Vendor dashboard · Catering</div>
      <div className="display" style={{ fontSize: 44, marginTop: 4 }}>
        ATO CATERING
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 4 }}>
        Joey Castro · ★ Pro since Aug 2026 · 4.92 ★ (38 reviews)
      </div>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--ink)", color: "var(--paper)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange-3)" }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.08em" }}>87 tokens</span>
      </div>
      <RoleSwitch role={role} setRole={setRole} />
      <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Public profile ↗</button>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--orange-4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--orange-2)", fontWeight: 500 }}>A</div>
    </div>
  </header>
);

// ─────────────────────────── Pipeline (kanban)
const VPipeline = ({ setTab, setThread }) => {
  const leads = {
    "Bid Request": [
      { id: "l1", couple: "Patricia & Mark",  date: "Mar 14, 2027", value: "—",        flag: "Just inquired", new: true },
      { id: "l2", couple: "Bea & Joaquin",    date: "Feb 7, 2027",  value: "—",        flag: "Asking sample menu" },
      { id: "l3", couple: "Camille & Niko",   date: "May 1, 2027",  value: "—",        flag: "Vegetarian focus" },
    ],
    Chat: [
      { id: "l4", couple: "Ria & Sam",        date: "Jan 18, 2027", value: "₱310,000", flag: "Quoting · 1 token spent" },
      { id: "l5", couple: "Andrea & Marco",   date: "Apr 22, 2027", value: "₱220,000", flag: "Negotiating pricing" },
    ],
    Accepted: [
      { id: "l6", couple: "Claire & Ice",     date: "Dec 18, 2026", value: "₱380,000", flag: "Same data as couple ↘", highlight: true },
      { id: "l7", couple: "The Lim wedding",  date: "Jan 30, 2027", value: "₱260,000", flag: "Headcount confirmed" },
    ],
    Completed: [
      { id: "l8", couple: "Reyes wedding",    date: "Sep 6, 2026",  value: "₱195,000", flag: "Delivered · 5★ review" },
      { id: "l9", couple: "Lopez christening",date: "Aug 14, 2026", value: "₱64,000",  flag: "Delivered" },
    ],
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>PIPELINE</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Request bid → chat → finalize pricing → customer accepts. Click a card to open the thread or jump to the event.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Export .csv</button>
          <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>+ New quote</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {Object.entries(leads).map(([col, items]) => (
          <div key={col} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px" }}>
              <div className="label-mono" style={{ color: col === "Accepted" ? "var(--orange-2)" : "var(--slate-2)" }}>{col}</div>
              <span className="mono" style={{ fontSize: 11, color: "var(--slate-3)" }}>{items.length}</span>
            </div>
            {items.map((lead) => (
              <div key={lead.id} onClick={() => { setThread("v-" + (lead.couple.includes("Claire") ? "mj" : lead.id)); setTab("inbox"); }} className="card" style={{
                padding: 14, cursor: "pointer",
                background: lead.highlight ? "var(--orange-4)" : "var(--paper)",
                borderColor: lead.highlight ? "var(--orange-3)" : "var(--line)",
                position: "relative",
              }}>
                {lead.new && <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "var(--orange)" }} />}
                <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{lead.couple}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>{lead.date}</div>
                <div className="mono" style={{ fontSize: 12, color: lead.highlight ? "var(--orange-2)" : "var(--ink)", marginTop: 8, fontWeight: 500 }}>{lead.value}</div>
                <div style={{ fontSize: 11, color: lead.highlight ? "var(--orange-2)" : "var(--slate-2)", marginTop: 6, lineHeight: 1.4 }}>
                  {lead.flag}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Cross-side preview: the same data the couple sees */}
      <div className="card" style={{ padding: 20, background: "var(--ink)", color: "var(--paper)", border: "none", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 24, alignItems: "center" }}>
        <div>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>One booking · two views</div>
          <div className="display" style={{ fontSize: 28, marginTop: 6, color: "var(--paper)", lineHeight: 1.02 }}>
            What you log here updates Maria’s dashboard live.
          </div>
          <div style={{ fontSize: 13, color: "var(--slate-4)", marginTop: 8, lineHeight: 1.55 }}>
            Headcount, crew meals, milestones — the couple sees the same numbers you do. No
            “let me check and get back to you.”
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { k: "Confirmed heads", v: "213" },
            { k: "Crew meals",      v: "28"  },
            { k: "Final payment",   v: "Dec 7" },
          ].map((c) => (
            <div key={c.k} style={{ padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8 }}>
              <div className="label-mono" style={{ fontSize: 10, color: "var(--orange-3)" }}>{c.k}</div>
              <div className="display" style={{ fontSize: 22, color: "var(--paper)", marginTop: 4 }}>{c.v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────── Inbox
const VInbox = ({ thread, setThread }) => {
  const threads = [
    { id: "v-ci",  who: "Claire & Ice",     when: "Today", preview: "Got it — added crew meal note to schedule.", unread: false, sel: true },
    { id: "v-rs",  who: "Ria & Sam",        when: "Yesterday", preview: "Could we swap the pork dish for a fish option?", unread: true },
    { id: "v-bj",  who: "Bea & Joaquin",    when: "2d",   preview: "Hi — checking if you can do Feb 7?", unread: true },
    { id: "v-cn",  who: "Camille & Niko",   when: "4d",   preview: "Sample menu pls — vegetarian for 80.", unread: true },
    { id: "v-am",  who: "Andrea & Marco",   when: "1w",   preview: "Locking in 220k. Sending PO.", unread: false },
  ];
  const sel = threads.find(t => t.id === thread) || threads[0];

  const mariaThread = [
    { from: "Claire",   at: "Mon · 4:14pm",  text: "Hi Joey! Headcount is looking like 213. Will confirm next week." },
    { from: "you",     at: "Mon · 4:32pm",  text: "Noted — locking provisional 213. I’ll quote crew meals separately." },
    { from: "Claire",   at: "Tue · 11:08am", text: "Sounds good. Crew count from your end?" },
    { from: "you",     at: "Tue · 11:21am", text: "28 crew for the day — 2 service captains, 18 servers, 6 kitchen, 2 dishwash." },
    { from: "Claire",   at: "Yesterday 6:30pm", text: "Locked. Updating the schedule milestone now." },
    { from: "you",     at: "Yesterday 6:42pm", text: "Headcount locked at 213. Crew meals: 28." },
    { from: "Claire",   at: "Yesterday 7:10pm", text: "Got it — added crew meal note to schedule." },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>INBOX</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Every couple thread in one place. Setnayan handles the routing — your number stays private.
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {threads.map((t, i) => (
            <button key={t.id} onClick={() => setThread(t.id)} style={{
              width: "100%", textAlign: "left", border: "none", cursor: "pointer",
              background: t.id === sel.id ? "var(--orange-4)" : "var(--paper)",
              borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
              padding: "14px 16px", fontFamily: "var(--sans)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: t.unread ? 600 : 500 }}>{t.who}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>{t.when}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4, lineHeight: 1.4, display: "flex", gap: 6, alignItems: "center" }}>
                {t.unread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange)", flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{t.preview}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--line-soft)" }}>
            <div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, textTransform: "uppercase", fontSize: 20, color: "var(--ink)" }}>{sel.who}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 2 }}>Dec 18, 2026 · La Castellana · ₱380,000 · 60% paid</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>View event</button>
              <button className="btn btn-orange" style={{ padding: "6px 12px", fontSize: 12 }}>Send quote</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 340 }}>
            {mariaThread.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.from === "you" ? "flex-end" : "flex-start",
                maxWidth: "76%",
                background: m.from === "you" ? "var(--ink)" : "var(--paper-2)",
                color: m.from === "you" ? "var(--paper)" : "var(--ink)",
                padding: "10px 14px", borderRadius: 12, fontSize: 13,
              }}>
                {m.from !== "you" && <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", marginBottom: 2 }}>{m.from}</div>}
                <div style={{ lineHeight: 1.45 }}>{m.text}</div>
                <div className="mono" style={{ fontSize: 9, opacity: 0.6, marginTop: 4 }}>{m.at}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
            <input placeholder="Reply to Maria…" style={{
              flex: 1, padding: "10px 12px", borderRadius: 8,
              border: "1px solid var(--line)", fontSize: 13, fontFamily: "var(--sans)", background: "var(--paper)", outline: "none",
            }} />
            <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12 }}>Attach quote</button>
            <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 12 }}>Send</button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────── Calendar
const VCalendar = () => {
  const month = "December 2026";
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const startOffset = 2; // Dec 1 2026 is a Tuesday
  const events = {
    5:  { label: "Headcount lock · Claire & Ice", type: "deadline" },
    7:  { label: "Final payment due · M&J",       type: "payment" },
    12: { label: "Claire & Ice wedding",          type: "wedding", hero: true },
    18: { label: "Tasting · Lim",                 type: "meeting" },
    27: { label: "Bea & Joaquin · quote due",     type: "deadline" },
  };
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>CALENDAR</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Every booking, payment deadline, and tasting in one view. Sync to Google or iCal.
          </div>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--slate)" }}>← {month} →</div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line-soft)", display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center", background: "var(--paper-2)" }}>
          <div>
            <div className="label-mono">Daily capacity</div>
            <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
              Maximum events you'll take per day. Bookings auto-block once the limit is reached.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--paper)", padding: "8px 12px", borderRadius: 999, border: "1px solid var(--line)" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>Max / day</span>
            {[1, 2, 3, "∞"].map(n => (
              <button key={n} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: n === 2 ? "var(--ink)" : "transparent",
                color: n === 2 ? "var(--paper)" : "var(--slate)",
                border: "none", cursor: "pointer",
                fontSize: 13, fontFamily: "var(--mono)", fontWeight: n === 2 ? 600 : 400,
              }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--paper-2)" }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="mono" style={{ padding: "10px 14px", fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`p${i}`} style={{ minHeight: 92, borderTop: "1px solid var(--line-soft)", borderRight: "1px solid var(--line-soft)", background: "var(--paper-2)" }} />
          ))}
          {days.map((d) => {
            const ev = events[d];
            const wedding = ev?.hero;
            return (
              <div key={d} style={{
                minHeight: 92, padding: 8,
                borderTop: "1px solid var(--line-soft)",
                borderRight: "1px solid var(--line-soft)",
                background: wedding ? "var(--orange-4)" : "var(--paper)",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="mono" style={{ fontSize: 12, color: wedding ? "var(--orange-2)" : "var(--ink)", fontWeight: wedding ? 600 : 400 }}>{d}</span>
                  {wedding && <span style={{ fontSize: 10, color: "var(--orange-2)" }}>★</span>}
                </div>
                {ev && (
                  <div style={{
                    padding: "4px 6px", borderRadius: 4, fontSize: 10, lineHeight: 1.3,
                    background: wedding ? "var(--orange)" : ev.type === "payment" ? "var(--sage)" : "var(--paper-2)",
                    color:      wedding ? "#fff" : ev.type === "payment" ? "var(--sage-deep)" : "var(--slate)",
                    border: wedding ? "none" : "1px solid var(--line)",
                  }}>{ev.label}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────── Earnings
// ─────────────────────────── Tokens
const VTokens = () => (
  <>
    <div>
      <div className="display" style={{ fontSize: 36 }}>TOKENS</div>
      <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4, maxWidth: 760, lineHeight: 1.55 }}>
        Tokens are how you get to the inquiry. Spend 1 to send a quote on a couple's bid request.
        Earn 1 every time a Setnayan Productions service you recommended is bought and used at the event (handshake-confirmed).
      </div>
    </div>

    {/* Big balance + founder bonus + CTA */}
    <div className="card" style={{ padding: 28, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 32, alignItems: "center", background: "var(--ink)", color: "var(--paper)", border: "none" }}>
      <div>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>Your balance</div>
        <div className="display" style={{ fontSize: 72, color: "var(--paper)", marginTop: 4, lineHeight: 1 }}>87</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 4 }}>tokens available</div>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>★ Founder bonus claimed</div>
        <div style={{ fontSize: 14, color: "var(--paper)", marginTop: 6, lineHeight: 1.55, maxWidth: 500 }}>
          100 free tokens dropped into your account on verification — claimed Aug 2026.
          Window closes <strong style={{ color: "var(--orange-3)" }}>31 Jan 2027</strong> for new vendors.
        </div>
      </div>
      <button className="btn btn-orange" style={{ padding: "12px 22px", fontSize: 14 }}>Buy more tokens →</button>
    </div>

    {/* Token packs */}
    <div>
      <div className="label-mono" style={{ marginBottom: 12 }}>Token packs · ₱180–250 per token</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {[
          { count: 4,   price: 1000,  perToken: 250 },
          { count: 10,  price: 2400,  perToken: 240 },
          { count: 25,  price: 5500,  perToken: 220 },
          { count: 50,  price: 10000, perToken: 200 },
          { count: 100, price: 18000, perToken: 180, best: true },
        ].map((p) => (
          <div key={p.count} className="card" style={{ padding: 18, position: "relative", border: p.best ? "1px solid var(--orange)" : undefined }}>
            {p.best && <span className="mono" style={{ position: "absolute", top: -8, right: 12, padding: "2px 8px", background: "var(--orange)", color: "#fff", fontSize: 9, borderRadius: 4, letterSpacing: "0.08em" }}>BEST VALUE</span>}
            <div className="display" style={{ fontSize: 36, lineHeight: 1 }}>{p.count}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 2 }}>tokens</div>
            <div style={{ marginTop: 14, fontSize: 18, color: "var(--ink)", fontFamily: "var(--mono)", fontWeight: 500 }}>₱{p.price.toLocaleString()}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 2 }}>₱{p.perToken}/token</div>
            <button className="btn btn-ghost" style={{ marginTop: 14, padding: "8px 14px", fontSize: 12, width: "100%", justifyContent: "center" }}>Buy</button>
          </div>
        ))}
      </div>
    </div>

    {/* Activity */}
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="label-mono">Recent activity</div>
        <a href="#" className="mono" style={{ fontSize: 11, color: "var(--orange-2)", textDecoration: "none" }}>View full ledger ↗</a>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--paper-2)" }}>
            {["When", "Activity", "Couple", "Δ Tokens", "Balance"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 18px", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate-2)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { when: "Today 9:42am", activity: "Earned · Panood referral · handshake confirmed", couple: "Reyes wedding",       delta: +1,   bal: 87 },
            { when: "Today 8:12am", activity: "Spent · accepted bid request",                    couple: "Patricia & Mark",     delta: -1,   bal: 86 },
            { when: "Yesterday",   activity: "Spent · accepted bid request",                    couple: "Bea & Joaquin",       delta: -1,   bal: 87 },
            { when: "2 days ago",  activity: "Earned · AI Reel referral · handshake confirmed", couple: "The Lim wedding",     delta: +1,   bal: 88 },
            { when: "Nov 24",      activity: "Bought · 50-token pack",                          couple: "—",                   delta: +50,  bal: 87 },
            { when: "Nov 18",      activity: "Spent · accepted bid request",                    couple: "Ria & Sam",           delta: -1,   bal: 37 },
            { when: "Aug 2",       activity: "Founder bonus on verification",                   couple: "—",                   delta: +100, bal: 100 },
          ].map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--line-soft)" }}>
              <td style={{ padding: "12px 18px", color: "var(--slate-2)", fontFamily: "var(--mono)", fontSize: 11 }}>{r.when}</td>
              <td style={{ padding: "12px 18px", color: "var(--ink)" }}>{r.activity}</td>
              <td style={{ padding: "12px 18px", color: "var(--slate)" }}>{r.couple}</td>
              <td style={{ padding: "12px 18px", fontFamily: "var(--mono)", fontWeight: 500, color: r.delta > 0 ? "var(--sage-deep)" : "var(--orange-2)" }}>
                {r.delta > 0 ? "+" : ""}{r.delta}
              </td>
              <td style={{ padding: "12px 18px", color: "var(--slate-2)", fontFamily: "var(--mono)", fontSize: 12 }}>{r.bal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Referral promo */}
    <div className="card" style={{ padding: 22, background: "var(--orange-4)", display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center" }}>
      <div>
        <div className="label-mono" style={{ color: "var(--orange-2)" }}>★ Earn tokens by recommending Productions</div>
        <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 6, lineHeight: 1.55, maxWidth: 760 }}>
          Send a Setnayan Productions service (Panood · Papic · AI Reel · Pakanta · Live Background · others) to your customer
          via your unique referral link. When they purchase and the service is used at the event (handshake-confirmed),
          <strong style={{ color: "var(--ink)" }}> you earn 1 token.</strong> No cap.
        </div>
      </div>
      <button className="btn btn-orange" style={{ padding: "10px 18px" }}>Open referral kit →</button>
    </div>
  </>
);

// ─────────────────────────── Marketplace profile preview
const VProfile = () => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <div className="display" style={{ fontSize: 36 }}>PUBLIC PROFILE</div>
        <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
          What couples see in the marketplace. Edit any block — changes go live in under a minute.
        </div>
      </div>
      <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>Edit profile</button>
    </div>
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="photo-placeholder" style={{ aspectRatio: "32/9" }}>
        <span className="pp-label">photo · catering hero shot</span>
      </div>
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="display" style={{ fontSize: 32 }}>ATO CATERING</div>
            <span className="pill pill-orange" style={{ fontSize: 10, padding: "3px 8px" }}>✓ Verified</span>
          </div>
          <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 8, lineHeight: 1.6 }}>
            Filipino-leaning catering with a deft hand on continental. Built for sit-down receptions
            of 80–400, with a separate crew-meal kitchen so your photographers don’t go hungry.
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Sit-down 80–400", "Buffet", "Cocktail hour", "Crew meals", "Halal kitchen", "Vegan menu"].map(t =>
              <span key={t} className="pill">{t}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            ["Bookings", "14 this year"],
            ["Avg rating", "4.92 ★"],
            ["Response time", "under 2h"],
            ["Repeat coordinators", "9"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "var(--paper-2)" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>{k}</span>
              <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </>
);

Object.assign(window, { VendorDashboard });