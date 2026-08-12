// Admin dashboard — internal Setnayan ops. Platform health, vendor verification,
// trust & safety, event-type readiness.

const AdminDashboard = ({ role, setRole }) => {
  // Default to verification tab — it's the highest-activity admin surface during pilot.
  const [tab, setTab] = useState("verification");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 880, background: "var(--paper-2)" }}>
      <AdminSidebar tab={tab} setTab={setTab} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <AdminTopbar role={role} setRole={setRole} />
        <main style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>
          {tab === "overview"     && <AdminOverview />}
          {tab === "verification" && <AdminVerification />}
          {tab === "trust"        && <AdminTrust />}
          {tab === "eventTypes"   && <AdminEventTypes />}
          {tab === "finance"      && <AdminFinance />}
          {tab === "pricing"      && <AdminPricing />}
        </main>
      </div>
    </div>
  );
};

const AdminSidebar = ({ tab, setTab }) => {
  const nav = [
    { id: "overview",     label: "Overview"      },
    { id: "verification", label: "Vendor verification", badge: "12 new" },
    { id: "trust",        label: "Trust & safety", badge: "3 open" },
    { id: "eventTypes",   label: "Event types" },
    { id: "pricing",      label: "Pricing & fees" },
    { id: "finance",      label: "Finance" },
    { id: "directory",    label: "Directory"   },
    { id: "compliance",   label: "BIR · NPC"   },
    { id: "settings",     label: "Settings"    },
  ];
  return (
    <aside style={{ background: "var(--paper)", borderRight: "1px solid var(--line)", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: "4px 4px 16px", borderBottom: "1px solid var(--line-soft)" }}>
        <LogoFull height={28} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px 4px" }}>
        <div className="label-mono">Setnayan ops</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="pill" style={{ background: "var(--ink)", color: "var(--paper)", fontSize: 10, padding: "3px 8px", borderColor: "transparent" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--orange)" }} />
            Admin · level 3
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
                <span className="mono" style={{ fontSize: 10, color: active ? "var(--orange-2)" : "var(--orange)" }}>{n.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div style={{ marginTop: "auto", padding: 14, borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--line)" }}>
        <div className="label-mono">Platform health</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "var(--ink)" }}>All systems</span>
          <span style={{ fontSize: 11, color: "var(--sage-deep)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage-deep)" }} />
            operational
          </span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 6 }}>
          Last incident · 14 days ago
        </div>
      </div>
    </aside>
  );
};

const AdminTopbar = ({ role, setRole }) => (
  <header style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)", background: "var(--paper)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
    <div>
      <div className="label-mono">Internal · Quezon City HQ</div>
      <div className="display" style={{ fontSize: 44, marginTop: 4 }}>
        SETNAYAN OPS
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 4 }}>
        Signed in as Migs B. · level-3 admin · last action 2 min ago
      </div>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <RoleSwitch role={role} setRole={setRole} />
      <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Status page ↗</button>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--ink)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500 }}>MB</div>
    </div>
  </header>
);

// ─────────────────────────── Overview tab — platform KPIs + queues snapshot
const AdminOverview = () => (
  <>
    {/* KPI strip */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      <KPI k="Active couples"   v="1,840" delta="+187 / 30d" />
      <KPI k="Verified vendors" v="412"   delta="+24 / 30d" />
      <KPI k="Weddings shipped" v="84"    delta="+14 / 30d" />
      <KPI k="Avg time-to-book" v="3.2d"  delta="−0.6d / 30d" good />
    </div>

    {/* Growth chart */}
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div className="label-mono">Signups · last 12 weeks</div>
          <div className="display" style={{ fontSize: 28, marginTop: 4, color: "var(--ink)" }}>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>312</span>
            <span style={{ fontSize: 14, color: "var(--slate-2)", fontWeight: 400, marginLeft: 10, fontFamily: "var(--sans)", textTransform: "none", letterSpacing: 0 }}>this week · +18% WoW</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span className="pill" style={{ background: "var(--orange-4)", color: "var(--orange-2)", borderColor: "transparent", fontSize: 11 }}>Couples</span>
          <span className="pill" style={{ background: "var(--paper-2)", fontSize: 11 }}>Vendors</span>
        </div>
      </div>
      <GrowthChart />
    </div>

    {/* Action queues + activity feed */}
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="label-mono">Today's queue</div>
          <a href="#" style={{ fontSize: 12, color: "var(--orange-2)", textDecoration: "none" }}>Open all →</a>
        </div>
        {[
          { kind: "Verify",   item: "Hilom Make-up · Davao",         age: "4h",  pill: "orange" },
          { kind: "Verify",   item: "Lakas Lights · Pampanga · re-up",age: "1d",  pill: "orange" },
          { kind: "Dispute",  item: "Reyes wedding · catering refund", age: "3h", pill: "blush" },
          { kind: "Flagged",  item: "Vendor message · pricing outside platform", age: "6h", pill: "blush" },
          { kind: "Approve",  item: "Boost campaign · Bloom & Co.",   age: "1d",  pill: "orange" },
        ].map((q, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "100px 1fr auto auto", gap: 12, alignItems: "center",
            padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
          }}>
            <span className="pill" style={{
              fontSize: 10, padding: "3px 9px",
              background: q.pill === "orange" ? "var(--orange-4)" : "var(--blush)",
              color:      q.pill === "orange" ? "var(--orange-2)" : "var(--blush-deep)",
              borderColor: "transparent",
            }}>{q.kind}</span>
            <span style={{ fontSize: 13, color: "var(--ink)" }}>{q.item}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>{q.age} old</span>
            <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>Open</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="label-mono" style={{ marginBottom: 12 }}>Live activity</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { who: "Patricia Cruz",  what: "booked Studio Sereno",       when: "2m ago", kind: "couple" },
            { who: "Ato Catering",   what: "issued BIR OR #1043",        when: "8m ago", kind: "vendor" },
            { who: "Andrea Sy",      what: "RSVP'd 4 guests",             when: "11m ago",kind: "guest"  },
            { who: "Claire & Ice",   what: "locked headcount at 213",     when: "22m ago",kind: "couple" },
            { who: "Bloom & Co.",    what: "started Tagaytay boost",      when: "1h ago", kind: "vendor" },
            { who: "New account",    what: "Camille L. signed up · couple",when: "1h ago", kind: "couple" },
          ].map((a, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", fontSize: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.kind === "couple" ? "var(--orange)" : a.kind === "vendor" ? "var(--blush-deep)" : "var(--sage-deep)" }} />
              <span style={{ color: "var(--slate)" }}>
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>{a.who}</span> {a.what}
              </span>
              <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>{a.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </>
);

const KPI = ({ k, v, delta, good }) => (
  <div className="card" style={{ padding: 16 }}>
    <div className="label-mono" style={{ fontSize: 10 }}>{k}</div>
    <div className="display" style={{ fontSize: 36, marginTop: 4, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
    <div className="mono" style={{ fontSize: 11, color: good ? "var(--sage-deep)" : "var(--orange-2)", marginTop: 2 }}>↑ {delta}</div>
  </div>
);

const GrowthChart = () => {
  // Simple inline SVG bar chart — 12 weeks of signups
  const data = [82, 96, 110, 118, 132, 145, 168, 190, 218, 246, 278, 312];
  const max = Math.max(...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, padding: "12px 4px 0", borderTop: "1px solid var(--line-soft)" }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{
            width: "100%", height: `${(v / max) * 100}%`,
            background: i === data.length - 1 ? "var(--orange)" : "var(--orange-3)",
            borderRadius: "3px 3px 0 0",
            transition: "height .6s ease",
          }} />
          <span className="mono" style={{ fontSize: 9, color: "var(--slate-3)" }}>W{i + 1}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────── Verification tab
// Claude generates a per-vendor checklist of manual gov-DB lookups (no public
// APIs exist for DTI / BIR / mayor's permit). Clean vendors get 4 items, flagged
// get 4 + N extras. Admin works the list in ~5 minutes per vendor.

const VERIF_QUEUE = [
  {
    name: "Hilom Make-up", cat: "Hair & Make-up", loc: "Davao", city: "Davao City",
    submitted: "4h ago", docs: 5, status: "ready", confidence: 97, recommendation: "approve",
    tin: "240-481-440-000", dtiCert: "DTI-2-1024-2024", permit: "DC-BP-2024-08214",
    bir: "(082) 224-5371", cityHall: "(082) 222-2244",
    summary: "All 3 documents match on business name and address (Davao City, Region XI). BIR cert seal intact. Portfolio is 10 unique pieces, none flagged on reverse-image search. No fraud signals — recommend approve.",
    flags: [],
  },
  {
    name: "Tinta Calligraphy", cat: "Stationery", loc: "Manila", city: "Manila",
    submitted: "7h ago", docs: 4, status: "ready", confidence: 93, recommendation: "approve",
    tin: "287-991-001-000", dtiCert: "DTI-NCR-0992-2023", permit: "MNL-BP-2024-04417",
    bir: "(02) 8929-7676", cityHall: "(02) 8527-3232",
    summary: "Documents align on business name and Manila address. TIN format valid, last renewal Q1 2024. Portfolio is 11 pieces, 0 reverse-image matches. Recommend approve.",
    flags: [],
  },
  {
    name: "Bukid Catering", cat: "Catering", loc: "Pampanga", city: "Angeles City",
    submitted: "1d ago", docs: 5, status: "ready", confidence: 95, recommendation: "approve",
    tin: "319-552-007-000", dtiCert: "DTI-3-2074-2024", permit: "ANG-BP-2024-01992",
    bir: "(045) 322-9876", cityHall: "(045) 322-1234",
    summary: "All documents consistent. Portfolio is 12 pieces, all original. Minor: cert lists 'Pampanga', permit lists 'Angeles City' — same address, non-blocking. Recommend approve.",
    flags: ["addr-typo"],
  },
  {
    name: "Indak Dance Crew", cat: "Entertainment", loc: "Cebu", city: "Cebu City",
    submitted: "1d ago", docs: 3, status: "missing", confidence: 62, recommendation: "request-more",
    tin: "240-883-441-000", dtiCert: "DTI-7-3318-2024", permit: "—",
    bir: "(032) 255-6789", cityHall: "(032) 253-6789",
    summary: "Business name and TIN check out. But: only 3 of 10 portfolio pieces uploaded, no public liability insurance on file, and the mayor's permit field lists just 'Cebu' (province? city?) — needs vendor clarification. Recommend request more before approval.",
    flags: ["portfolio-incomplete", "missing-insurance", "addr-ambiguous", "no-permit-number"],
  },
  {
    name: "Sila Events", cat: "Coordination", loc: "Iloilo", city: "Iloilo City",
    submitted: "2d ago", docs: 5, status: "ready", confidence: 91, recommendation: "approve",
    tin: "298-441-882-000", dtiCert: "DTI-6-1845-2023", permit: "ILO-BP-2024-02118",
    bir: "(033) 337-1234", cityHall: "(033) 337-9999",
    summary: "All documents present and consistent. Portfolio 14 pieces, 0 matches. TIN active. Clean approve.",
    flags: [],
  },
  {
    name: "Vista Drones", cat: "Photography", loc: "Tagaytay", city: "Tagaytay City",
    submitted: "2d ago", docs: 4, status: "missing", confidence: 71, recommendation: "request-more",
    tin: "440-118-722-000", dtiCert: "DTI-4-2992-2024", permit: "TAG-BP-2024-00781",
    bir: "(046) 413-4567", cityHall: "(046) 413-1234",
    summary: "DTI and BIR check out. Drone photography requires CAAP RPAS Pilot license — not yet uploaded. Portfolio 7 pieces, 1 reverse-image match against a 2022 stock-photo set (false-flag suspected). Need pilot license + portfolio clarification.",
    flags: ["missing-caap", "image-match", "portfolio-incomplete"],
  },
  {
    name: "Lakas Lights v2", cat: "Lights & Sound", loc: "Pampanga", city: "San Fernando",
    submitted: "3d ago", docs: 5, status: "ready", confidence: 88, recommendation: "approve",
    tin: "312-882-117-000", dtiCert: "DTI-3-2118-2024", permit: "SF-BP-2024-00444",
    bir: "(045) 961-1234", cityHall: "(045) 961-7777",
    summary: "All docs match. Note: 're-applied vendor' — original Lakas Lights was banned in 2024 for off-platform payment solicitation (TS-0019). New entity, new owners per filings. Recommend approve with watchlist tag.",
    flags: ["watchlist-prior-ban"],
  },
];

// Build the Claude-generated checklist for a vendor.
// Each vendor gets the 4 base items; flags add targeted extras.
const buildChecklist = (v) => {
  const base = [
    {
      id: "dti",
      title: "DTI BNRS · business-name lookup",
      reason: `Search "${v.name}" in DTI BNRS to confirm registration is active and matches the cert serial.`,
      action: { kind: "link", label: `bnrs.dti.gov.ph?q=${encodeURIComponent(v.name)}`, url: `https://bnrs.dti.gov.ph/search?q=${encodeURIComponent(v.name)}` },
      hint: `Expected serial: ${v.dtiCert}`,
      eta: "1 min",
    },
    {
      id: "bir",
      title: "BIR · confirm TIN not revoked",
      reason: `TIN ${v.tin} parses as a Filipino business TIN. Quick call to the ${v.city} RDO confirms it's active.`,
      action: { kind: "phone", label: v.bir, url: `tel:${v.bir.replace(/[^\d]/g, "")}` },
      hint: `Ask for "Taxpayer Status Inquiry · ${v.tin}"`,
      eta: "3 min",
    },
    {
      id: "permit",
      title: `${v.city} Mayor's permit · verify on record`,
      reason: v.permit === "—"
        ? "No permit number was filled on the cert upload — we cannot phone-verify without it."
        : `Call ${v.city} business-permits office to confirm permit ${v.permit} is on record.`,
      action: { kind: "phone", label: v.cityHall, url: `tel:${v.cityHall.replace(/[^\d]/g, "")}` },
      hint: v.permit === "—" ? "Blocker — request the permit number first." : `Reference: ${v.permit}`,
      eta: "2 min",
      blocked: v.permit === "—",
    },
    {
      id: "rev-image",
      title: "Reverse-image · scan top 5 portfolio shots",
      reason: "Background worker pre-ran Google Vision against the portfolio. Eyeball the matches.",
      action: { kind: "internal", label: "Open pre-scan results →" },
      hint: v.flags.includes("image-match")
        ? "⚠ 1 match found — likely false-positive (stock-set, not vendor work). Review."
        : "0 of 10 flagged. No action expected.",
      eta: "30 sec",
    },
  ];

  const extras = [];
  if (v.flags.includes("portfolio-incomplete")) {
    extras.push({
      id: "portfolio",
      title: "⚠ Portfolio incomplete · request more samples",
      reason: `Only ${v.docs <= 3 ? 3 : v.docs <= 4 ? 7 : 9} of 10 required pieces uploaded. Templated chat message ready to send.`,
      action: { kind: "internal", label: "Send template message →" },
      hint: "Auto-fills: name, missing count, 7-day SLA reminder.",
      eta: "30 sec",
      severity: "warn",
    });
  }
  if (v.flags.includes("missing-insurance")) {
    extras.push({
      id: "insurance",
      title: "⚠ Public liability insurance · missing certificate",
      reason: "Category 'Entertainment' requires PLI ≥ ₱1M per platform policy v3. Request from vendor.",
      action: { kind: "internal", label: "Send PLI request →" },
      hint: "Templated message references the exact policy clause.",
      eta: "30 sec",
      severity: "warn",
    });
  }
  if (v.flags.includes("addr-ambiguous")) {
    extras.push({
      id: "addr",
      title: "⚠ Address ambiguity · clarify with vendor",
      reason: "DTI cert lists 'Cebu City'; mayor's permit field reads just 'Cebu' — could be province. Ask vendor to confirm.",
      action: { kind: "internal", label: "Ask vendor →" },
      hint: "Without clarity, RDO and city-hall calls can't proceed.",
      eta: "30 sec",
      severity: "warn",
    });
  }
  if (v.flags.includes("no-permit-number")) {
    extras.push({
      id: "no-permit",
      title: "⚠ Mayor's permit number · not filled on cert",
      reason: "Permit document uploaded but the number field on the form was blank. Ask vendor to type it in.",
      action: { kind: "internal", label: "Request permit number →" },
      hint: "Blocks step 3 (Mayor's permit phone-verify).",
      eta: "30 sec",
      severity: "warn",
    });
  }
  if (v.flags.includes("missing-caap")) {
    extras.push({
      id: "caap",
      title: "⚠ CAAP RPAS Pilot license · category-specific",
      reason: "Drone photography needs a CAAP Remotely Piloted Aircraft System pilot certificate. Not in uploads.",
      action: { kind: "link", label: "caap.gov.ph/rpas-registry", url: "https://caap.gov.ph/rpas-registry" },
      hint: "Check registry against vendor's claimed CAAP-ID. Then request scan.",
      eta: "2 min",
      severity: "warn",
    });
  }
  if (v.flags.includes("image-match")) {
    extras.push({
      id: "img-explain",
      title: "Reverse-image match · vendor must explain",
      reason: "1 portfolio shot matched a 2022 stock-photo set on TinEye. May be a licensed asset — ask vendor.",
      action: { kind: "internal", label: "Send clarification request →" },
      hint: "If licensed, vendor uploads the receipt; otherwise reject.",
      eta: "30 sec",
      severity: "warn",
    });
  }
  if (v.flags.includes("addr-typo")) {
    extras.push({
      id: "addr-typo",
      title: "Address typo · acknowledge & continue",
      reason: "Cert says 'Pampanga' (province), permit says 'Angeles City' (city in Pampanga). Same address, non-blocking.",
      action: { kind: "internal", label: "Acknowledge →" },
      hint: "No vendor outreach needed.",
      eta: "5 sec",
      severity: "info",
    });
  }
  if (v.flags.includes("watchlist-prior-ban")) {
    extras.push({
      id: "watchlist",
      title: "⚠ Watchlist · same business name as banned vendor",
      reason: "TS-0019 (May 2024) banned 'Lakas Lights'. New filing has different TIN + ownership — likely new entity, but tag.",
      action: { kind: "internal", label: "Open TS-0019 →" },
      hint: "On approval, vendor is tagged 'watchlist · 90d' in admin directory.",
      eta: "2 min",
      severity: "warn",
    });
  }

  return [...base, ...extras];
};

const AdminVerification = () => {
  const [selName, setSelName] = useState(VERIF_QUEUE[0].name);
  const [checked, setChecked] = useState({});            // { "Hilom Make-up": Set(["dti","bir"]) }
  const [filter, setFilter] = useState("all");           // all / ready / missing

  const sel = VERIF_QUEUE.find(v => v.name === selName);
  const visible = VERIF_QUEUE.filter(v =>
    filter === "all" ? true :
    filter === "ready" ? v.status === "ready" :
    v.status === "missing"
  );
  const checklist = buildChecklist(sel);
  const selChecked = checked[selName] || new Set();
  const done = checklist.filter(i => selChecked.has(i.id)).length;
  const total = checklist.length;
  const totalEta = checklist
    .filter(i => !selChecked.has(i.id))
    .reduce((acc, i) => acc + (parseFloat(i.eta) || 0), 0);

  const toggle = (id) => setChecked(prev => {
    const next = new Set(prev[selName] || []);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { ...prev, [selName]: next };
  });
  const markAll = () => setChecked(prev => ({ ...prev, [selName]: new Set(checklist.map(i => i.id)) }));

  const tone = (v) =>
    v.status === "ready"
      ? { bg: "var(--sage)", fg: "var(--sage-deep)", label: "Ready" }
      : { bg: "var(--blush)", fg: "var(--blush-deep)", label: "Needs work" };

  const confTone = (c) =>
    c >= 90 ? { fg: "var(--sage-deep)", bg: "var(--sage)" } :
    c >= 75 ? { fg: "var(--orange-2)", bg: "var(--orange-4)" } :
              { fg: "var(--blush-deep)", bg: "var(--blush)" };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>VENDOR VERIFICATION</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4, maxWidth: 580 }}>
            {VERIF_QUEUE.length} pending · target SLA 24h · current avg 18h. Claude pre-reads every cert + drafts a manual checklist below. <strong style={{ color: "var(--ink)" }}>Humans approve · no auto-approve, ever.</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "inline-flex", borderRadius: 8, background: "var(--paper)", border: "1px solid var(--line)", padding: 2 }}>
            {[["all","All"],["ready","Ready"],["missing","Needs work"]].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                border: "none", background: filter === id ? "var(--orange-4)" : "transparent",
                color:  filter === id ? "var(--orange-2)" : "var(--slate)",
                padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                fontFamily: "var(--sans)", fontWeight: 500,
              }}>{label}</button>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Bulk approve ready (4)</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, alignItems: "start" }}>
        {/* Queue list */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "var(--paper-2)", borderBottom: "1px solid var(--line-soft)" }}>
            <div className="label-mono">Queue · {visible.length}</div>
          </div>
          {visible.map((v, i) => {
            const isSel = v.name === selName;
            const t = tone(v);
            const c = confTone(v.confidence);
            const vChecked = (checked[v.name] || new Set()).size;
            const vTotal = buildChecklist(v).length;
            return (
              <button key={v.name} onClick={() => setSelName(v.name)} style={{
                width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                background: isSel ? "var(--orange-4)" : "var(--paper)",
                borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                borderLeft: isSel ? "3px solid var(--orange)" : "3px solid transparent",
                padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 6,
                fontFamily: "var(--sans)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{v.name}</div>
                  <span className="mono" style={{ fontSize: 10, color: c.fg, background: c.bg, padding: "2px 6px", borderRadius: 4 }}>{v.confidence}%</span>
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>{v.cat} · {v.loc} · {v.submitted}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                  <span className="pill" style={{ background: t.bg, color: t.fg, borderColor: "transparent", fontSize: 10, padding: "2px 7px" }}>{t.label}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>{v.docs}/5 docs · {vChecked}/{vTotal} checked</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail workspace */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Header */}
          <div className="card" style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "center" }}>
            <div>
              <div className="label-mono">{sel.cat} · submitted {sel.submitted}</div>
              <div className="display" style={{ fontSize: 30, marginTop: 4 }}>{sel.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 4 }}>{sel.city} · TIN {sel.tin} · DTI {sel.dtiCert}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: "9px 14px", fontSize: 13 }}>Request more</button>
              <button className="btn btn-ghost" style={{ padding: "9px 14px", fontSize: 13, color: "var(--blush-deep)", borderColor: "var(--blush)" }}>Reject</button>
              <button className="btn btn-orange" style={{ padding: "9px 18px", fontSize: 13, opacity: done === total ? 1 : 0.55 }}>
                Approve · grant ✓
              </button>
            </div>
          </div>

          {/* Claude summary */}
          <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ padding: "14px 20px", background: "var(--ink)", color: "var(--paper)", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.10em" }}>✦ CLAUDE CO-PILOT · AUTO-ANALYSIS</div>
                <p style={{ fontSize: 13, color: "var(--paper)", lineHeight: 1.55, marginTop: 6, marginBottom: 0 }}>
                  {sel.summary} Recommended action: <strong style={{ color: "var(--orange-3)", textTransform: "uppercase" }}>{sel.recommendation === "approve" ? "approve" : "request more"}</strong>.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 4px 0 14px", borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ fontFamily: "var(--display)", fontSize: 38, lineHeight: 1, color: "var(--orange-3)" }}>{sel.confidence}<span style={{ fontSize: 18 }}>%</span></div>
                <div className="mono" style={{ fontSize: 9, color: "var(--slate-4)", letterSpacing: "0.10em" }}>CONFIDENCE</div>
              </div>
            </div>
            <div style={{ padding: "12px 20px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, background: "var(--paper-2)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--slate-2)" }}>
              <div><div style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--slate-3)" }}>BIZ NAME</div><div style={{ color: "var(--ink)", marginTop: 2 }}>✓ match</div></div>
              <div><div style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--slate-3)" }}>TIN</div><div style={{ color: "var(--ink)", marginTop: 2 }}>✓ valid</div></div>
              <div><div style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--slate-3)" }}>ADDRESS</div><div style={{ color: sel.flags.some(f => f.startsWith("addr")) ? "var(--blush-deep)" : "var(--ink)", marginTop: 2 }}>{sel.flags.some(f => f.startsWith("addr")) ? "⚠ check" : "✓ match"}</div></div>
              <div><div style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--slate-3)" }}>PORTFOLIO</div><div style={{ color: sel.flags.includes("portfolio-incomplete") ? "var(--blush-deep)" : "var(--ink)", marginTop: 2 }}>{sel.flags.includes("portfolio-incomplete") ? "⚠ partial" : "✓ 10+"}</div></div>
              <div><div style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--slate-3)" }}>LIVENESS</div><div style={{ color: "var(--ink)", marginTop: 2 }}>✓ verified</div></div>
            </div>
          </div>

          {/* Checklist — the core */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div className="label-mono" style={{ color: "var(--orange-2)" }}>✦ Claude-generated checklist · manual gov-DB lookups</div>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4 }}>
                  No public APIs exist for DTI / BIR / mayor's permit. Work the list below — Claude prefilled every link and phone number.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>{done} of {total} done</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 2 }}>est. {totalEta} min remaining</div>
                </div>
                <button onClick={markAll} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>Mark all done</button>
              </div>
            </div>

            {/* Progress meter */}
            <div style={{ height: 4, background: "var(--paper-2)", overflow: "hidden" }}>
              <div style={{ width: `${(done / total) * 100}%`, height: "100%", background: "var(--orange)", transition: "width 240ms ease" }} />
            </div>

            {/* Items */}
            <div>
              {checklist.map((item, i) => {
                const isDone = selChecked.has(item.id);
                const isBlocked = item.blocked && !isDone;
                const sevColor =
                  item.severity === "warn" ? "var(--blush-deep)" :
                  item.severity === "info" ? "var(--slate-3)" :
                  "var(--ink)";
                return (
                  <div key={item.id} style={{
                    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16,
                    padding: "16px 20px", alignItems: "start",
                    borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                    background: isDone ? "rgba(0,0,0,0.015)" : "var(--paper)",
                    opacity: isDone ? 0.62 : 1,
                  }}>
                    <button
                      onClick={() => toggle(item.id)}
                      aria-label={isDone ? "Mark not done" : "Mark done"}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: isDone ? "1px solid var(--orange)" : `1.5px solid ${item.severity === "warn" ? "var(--blush)" : "var(--line)"}`,
                        background: isDone ? "var(--orange)" : "var(--paper)",
                        color: "#fff",
                        cursor: "pointer", padding: 0,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, marginTop: 2,
                      }}
                    >{isDone ? "✓" : ""}</button>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <div style={{
                          fontSize: 14, color: sevColor, fontWeight: 500,
                          textDecoration: isDone ? "line-through" : "none",
                        }}>{item.title}</div>
                        <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>· {item.eta}</span>
                        {isBlocked && <span className="mono" style={{ fontSize: 10, color: "var(--blush-deep)", background: "var(--blush)", padding: "1px 6px", borderRadius: 3 }}>BLOCKED</span>}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.55, margin: "6px 0 0" }}>
                        {item.reason}
                      </p>
                      <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 6 }}>
                        ↳ {item.hint}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", minWidth: 220 }}>
                      {item.action.kind === "link" && (
                        <a href={item.action.url} target="_blank" rel="noreferrer" onClick={(e) => e.preventDefault()} style={{
                          fontFamily: "var(--mono)", fontSize: 11, color: "var(--orange-2)",
                          background: "var(--orange-4)", padding: "6px 10px", borderRadius: 6,
                          textDecoration: "none", border: "1px solid var(--orange-3)",
                          maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>↗ {item.action.label}</a>
                      )}
                      {item.action.kind === "phone" && (
                        <a href={item.action.url} onClick={(e) => e.preventDefault()} style={{
                          fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)",
                          background: "var(--paper-2)", padding: "6px 10px", borderRadius: 6,
                          textDecoration: "none", border: "1px solid var(--line)",
                        }}>☎ {item.action.label}</a>
                      )}
                      {item.action.kind === "internal" && (
                        <button onClick={() => {}} style={{
                          fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)",
                          background: "var(--paper)", padding: "6px 10px", borderRadius: 6,
                          border: "1px solid var(--line)", cursor: "pointer",
                        }}>{item.action.label}</button>
                      )}
                      <span className="mono" style={{ fontSize: 9, color: "var(--slate-3)" }}>step {i + 1} of {total}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer note */}
            <div style={{ padding: "12px 20px", background: "var(--paper-2)", borderTop: "1px solid var(--line-soft)", fontSize: 11, color: "var(--slate-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span><strong style={{ color: "var(--ink)" }}>Founder policy:</strong> Claude assists, never decides. Every approval is human. Switch to Hyperverge API at ~100 vendors/week.</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>~₱1.50 / vendor · 4 Claude calls</span>
            </div>
          </div>

          {/* Documents · compact */}
          <div className="card" style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="label-mono">Documents on file</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)" }}>{sel.docs}/5 uploaded</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 10 }}>
              {[
                ["DTI / SEC reg.",          true],
                ["BIR Cert of Reg.",        true],
                ["Mayor's permit",          sel.permit !== "—"],
                ["Portfolio · 10+ pieces",  sel.docs >= 4 && !sel.flags.includes("portfolio-incomplete")],
                ["Public liability insur.", sel.docs >= 5 && !sel.flags.includes("missing-insurance")],
              ].map(([d, on]) => (
                <div key={d} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", background: "var(--paper-2)", borderRadius: 6, border: `1px solid ${on ? "var(--line-soft)" : "var(--blush)"}` }}>
                  <span style={{ fontSize: 11, color: "var(--slate)" }}>{d}</span>
                  {on
                    ? <span style={{ fontSize: 10, color: "var(--sage-deep)", fontFamily: "var(--mono)" }}>✓ on file</span>
                    : <span style={{ fontSize: 10, color: "var(--blush-deep)", fontFamily: "var(--mono)" }}>⚠ missing</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────── Trust & safety
const AdminTrust = () => {
  const cases = [
    { id: "TS-0042", kind: "Dispute",  party: "Reyes wedding ↔ Ato Catering",  detail: "Refund requested · final 25% payment", opened: "3h ago",  sev: "high" },
    { id: "TS-0041", kind: "Flagged",  party: "Lakas Lights message",          detail: "Asked couple to pay outside platform",  opened: "6h ago",  sev: "high" },
    { id: "TS-0040", kind: "Refund",   party: "Patricia Cruz",                 detail: "Coordinator no-show partial refund",     opened: "2d ago",  sev: "med"  },
    { id: "TS-0039", kind: "Identity", party: "New vendor signup",             detail: "DTI number mismatch · KYC review",       opened: "3d ago",  sev: "med"  },
  ];
  return (
    <>
      <div>
        <div className="display" style={{ fontSize: 36 }}>TRUST &amp; SAFETY</div>
        <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
          Open cases · 3 high · 4 medium · 0 critical. Median resolution time 19h.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <Stat k="Open cases"  v={cases.length}                hint="3 high priority" tone="orange" />
        <Stat k="Resolved 30d" v={42}                          hint="median 19h"      tone="sage" />
        <Stat k="Refund rate"  v="1.4%"                        hint="of GMV"          />
        <Stat k="Vendor rating" v="4.86★"                      hint="across 412"      />
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--paper-2)" }}>
              {["Case", "Kind", "Parties", "Detail", "Opened", "Severity", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate-2)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td style={{ padding: "12px 14px", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 12 }}>{c.id}</td>
                <td style={{ padding: "12px 14px", color: "var(--ink)" }}>{c.kind}</td>
                <td style={{ padding: "12px 14px", color: "var(--ink)" }}>{c.party}</td>
                <td style={{ padding: "12px 14px", color: "var(--slate)" }}>{c.detail}</td>
                <td style={{ padding: "12px 14px", color: "var(--slate)", fontFamily: "var(--mono)", fontSize: 11 }}>{c.opened}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{
                    background: c.sev === "high" ? "var(--blush)" : "var(--orange-4)",
                    color:      c.sev === "high" ? "var(--blush-deep)" : "var(--orange-2)",
                    padding: "3px 9px", borderRadius: 999, fontSize: 11,
                  }}>{c.sev}</span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <a href="#" style={{ color: "var(--orange-2)", fontSize: 12, textDecoration: "none" }}>Open →</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─────────────────────────── Event types — unlock controls
const AdminEventTypes = () => {
  const types = [
    { name: "Wedding",          vendors: 412, target: 100, status: "live" },
    { name: "Gender Reveal",    vendors: 12,  target: 30,  status: "early" },
    { name: "Debut",            vendors: 64,  target: 80,  status: "ready-soon" },
    { name: "Birthday Parties", vendors: 38,  target: 60,  status: "growing" },
    { name: "Baptism",          vendors: 22,  target: 50,  status: "growing" },
    { name: "Anniversaries",    vendors: 19,  target: 50,  status: "growing" },
    { name: "Vow Renewals",     vendors: 14,  target: 30,  status: "growing" },
    { name: "Corporate",        vendors: 31,  target: 80,  status: "growing" },
    { name: "Reunion",          vendors: 9,   target: 30,  status: "early" },
    { name: "Homecoming",       vendors: 7,   target: 30,  status: "early" },
    { name: "Prom",             vendors: 14,  target: 40,  status: "early" },
    { name: "Concerts",         vendors: 8,   target: 40,  status: "early" },
    { name: "Burial / Wake",    vendors: 11,  target: 40,  status: "early" },
    { name: "Travel",           vendors: 5,   target: 40,  status: "early" },
  ];
  return (
    <>
      <div>
        <div className="display" style={{ fontSize: 36 }}>EVENT-TYPE READINESS</div>
        <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
          Flip a vertical live once it has enough verified vendors. Debut is closest — 64/80.
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--paper-2)" }}>
              {["Event type", "Verified vendors", "Progress", "Status", "Action"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate-2)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((t, i) => {
              const pct = Math.min(100, (t.vendors / t.target) * 100);
              const live = t.status === "live";
              const ready = t.status === "ready-soon";
              return (
                <tr key={t.name} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "12px 14px", color: "var(--ink)", fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: "12px 14px", color: "var(--ink)", fontFamily: "var(--mono)" }}>{t.vendors} / {t.target}</td>
                  <td style={{ padding: "12px 14px", width: 280 }}>
                    <div style={{ height: 8, background: "var(--paper-2)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: live ? "var(--sage-deep)" : ready ? "var(--orange)" : "var(--orange-3)" }} />
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span className="pill" style={{
                      background: live ? "var(--sage)" : ready ? "var(--orange-4)" : "var(--paper-2)",
                      color:      live ? "var(--sage-deep)" : ready ? "var(--orange-2)" : "var(--slate-2)",
                      borderColor: "transparent", fontSize: 11,
                    }}>{live ? "Live" : ready ? "Ready to flip" : "Growing"}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {live
                      ? <a href="#" className="mono" style={{ fontSize: 11, color: "var(--slate-2)", textDecoration: "none" }}>Settings ↗</a>
                      : ready
                        ? <button className="btn btn-orange" style={{ padding: "6px 12px", fontSize: 12 }}>Flip live</button>
                        : <a href="#" className="mono" style={{ fontSize: 11, color: "var(--orange-2)", textDecoration: "none" }}>Outreach plan →</a>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─────────────────────────── Finance (internal)
const AdminFinance = () => (
  <>
    <div>
      <div className="display" style={{ fontSize: 36 }}>FINANCE</div>
      <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
        GMV, take rate, payouts. Reconciled daily against the bank ledger.
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      <Stat k="GMV (Nov)"     v="₱18.4M"  hint="+22% MoM" tone="sage" />
      <Stat k="Take rate"     v="5.0%"    hint="flat fee"  />
      <Stat k="Setnayan rev"  v="₱920K"   hint="this month" tone="orange" />
      <Stat k="Payouts queued" v="₱1.62M" hint="14 vendors"  />
    </div>
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="label-mono">Weekly GMV · last 12 weeks</div>
        <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>↑ trending</span>
      </div>
      <GrowthChart />
    </div>
  </>
);

// ─────────────────────────── Pricing & Fees (control center)
const AdminPricing = () => {
  const [feePct, setFeePct] = useState(5.0);
  const [services, setServices] = useState([
    { name: "Panood · Multi-Cam Livestream", category: "Add-on", free: false, price: 18000, takeRate: 5,   status: "live" },
    { name: "Papic · Paparazzi App",          category: "Add-on", free: false, price: 8000,  takeRate: 5,   status: "live" },
    { name: "AI Highlight Reel",              category: "Add-on", free: false, price: 12000, takeRate: 5,   status: "live" },
    { name: "Pailaw · LED Background Maker",  category: "Add-on", free: false, price: 6000,  takeRate: 5,   status: "live" },
    { name: "Pakulay · Mood Board",           category: "Add-on", free: true,  price: 0,     takeRate: 0,   status: "free" },
    { name: "Pro Invitation Widgets",         category: "Event site", free: false, price: 1500,  takeRate: 5,   status: "live" },
    { name: "Photo Delivery (full-res)",      category: "Add-on", free: false, price: 3500,  takeRate: 5,   status: "live" },
    { name: "Save-the-Date Video",            category: "Add-on", free: false, price: 5000,  takeRate: 5,   status: "live" },
    { name: "Custom Monogram pack",           category: "Branding", free: false, price: 3000,  takeRate: 5,   status: "live" },
    { name: "Event Site · Premium Themes",    category: "Event site", free: false, price: 4500,  takeRate: 5,   status: "live" },
    { name: "Event Site · Custom domain",     category: "Event site", free: false, price: 2000,  takeRate: 5,   status: "live" },
    { name: "Event Site · Music & audio",     category: "Event site", free: false, price: 1500,  takeRate: 5,   status: "live" },
    { name: "Event Site · Photo Gallery Pro", category: "Event site", free: false, price: 2500,  takeRate: 5,   status: "live" },
    { name: "Today's Focus · AI Co-pilot",   category: "AI features", free: false, price: 2500,  takeRate: 5,   status: "live" },
    { name: "Monogram · Animated reveal",     category: "Branding", free: false, price: 2500,  takeRate: 5,   status: "live" },
  ]);

  const updateService = (i, patch) =>
    setServices(services.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="display" style={{ fontSize: 36 }}>PRICING &amp; FEES</div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
            Platform-wide controls. Changes roll out to every couple and vendor on next page load.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>View change log</button>
          <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 13 }}>Publish changes</button>
        </div>
      </div>

      {/* Vendor take-rate control */}
      <div className="card" style={{ padding: 28, background: "var(--ivory)", border: "1px solid var(--orange-3)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 36, alignItems: "center" }}>
          <div>
            <div className="label-mono" style={{ color: "var(--orange-2)" }}>Setnayan Pay convenience fee</div>
            <div className="display" style={{ fontSize: 44, marginTop: 8 }}>
              Vendor take rate
            </div>
            <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 10, lineHeight: 1.6, maxWidth: 480 }}>
              The platform fee taken from each vendor payout. Couple pays vendor's listed price
              (no surcharge). Vendor receives the listed price minus this fee. The only commission
              Setnayan takes from vendor bookings.
            </div>
          </div>
          <div style={{ background: "var(--paper)", borderRadius: 12, padding: 24, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="label-mono">Current rate</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>Live · since Aug 2026</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "16px 0", fontVariantNumeric: "tabular-nums" }}>
              <button onClick={() => setFeePct(Math.max(0, +(feePct - 0.5).toFixed(1)))} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--paper-2)", cursor: "pointer", fontSize: 18, color: "var(--slate)" }}>−</button>
              <div className="display" style={{ fontSize: 64, lineHeight: 1, display: "inline-flex", alignItems: "baseline" }}>
                {feePct.toFixed(1)}<span style={{ fontSize: 32, color: "var(--orange)", marginLeft: 4 }}>%</span>
              </div>
              <button onClick={() => setFeePct(Math.min(15, +(feePct + 0.5).toFixed(1)))} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--paper-2)", cursor: "pointer", fontSize: 18, color: "var(--slate)" }}>+</button>
            </div>
            <div style={{ marginTop: 14, padding: 12, background: "var(--paper-2)", borderRadius: 8 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginBottom: 6 }}>Impact on a ₱100,000 booking</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--slate)" }}>Couple pays</span>
                <span className="mono" style={{ color: "var(--ink)", fontWeight: 500 }}>₱100,000</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                <span style={{ color: "var(--slate)" }}>Setnayan platform fee</span>
                <span className="mono" style={{ color: "var(--orange-2)", fontWeight: 500 }}>− ₱{(100000 * feePct/100).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                <span style={{ color: "var(--slate)" }}>Vendor receives</span>
                <span className="mono" style={{ color: "var(--sage-deep)", fontWeight: 500 }}>₱{(100000 * (1 - feePct/100)).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Volume tiers */}
      <div className="card" style={{ padding: 22 }}>
        <div className="label-mono">Volume-based take-rate tiers</div>
        <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4, marginBottom: 18, lineHeight: 1.5 }}>
          Reward high-volume vendors with a lower take rate. Auto-applies based on rolling 90-day GMV through Setnayan Pay.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { tier: "Starter", from: "₱0",      take: "5.0%", count: 387 },
            { tier: "Growing", from: "₱500K",   take: "4.5%", count: 18  },
            { tier: "Scale",   from: "₱2M",     take: "4.0%", count: 6   },
            { tier: "Pillar",  from: "₱5M",     take: "3.5%", count: 1   },
          ].map((t, i) => (
            <div key={t.tier} style={{
              padding: 16, borderRadius: 10,
              border: "1px solid var(--line)",
              background: i === 0 ? "var(--orange-4)" : "var(--paper-2)",
            }}>
              <div className="label-mono" style={{ color: i === 0 ? "var(--orange-2)" : "var(--slate-2)" }}>{t.tier}</div>
              <div className="display" style={{ fontSize: 28, marginTop: 6 }}>{t.take}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 4 }}>from {t.from} GMV</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 8 }}>{t.count} vendor{t.count === 1 ? "" : "s"} here</div>
            </div>
          ))}
        </div>
      </div>

      {/* Service catalog */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="label-mono">Service catalog · Setnayan-priced add-ons</div>
            <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>
              Platform services (Panood, Papic, etc.) — set the public price and platform cut.
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>+ Add service</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--paper-2)" }}>
              {["Service", "Type", "Listed price", "Platform cut", "Status", "Live"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--slate-2)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td style={{ padding: "12px 16px", color: "var(--ink)", fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--slate)" }}>{s.category}</td>
                <td style={{ padding: "12px 16px" }}>
                  {s.free ? (
                    <span style={{ fontFamily: "var(--mono)", color: "var(--sage-deep)" }}>FREE</span>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--slate-3)", fontFamily: "var(--mono)" }}>₱</span>
                      <input
                        type="number" value={s.price}
                        onChange={(e) => updateService(i, { price: +e.target.value })}
                        style={{ width: 90, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", background: "var(--paper)", outline: "none" }}
                      />
                    </div>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {s.free ? (
                    <span className="mono" style={{ color: "var(--slate-3)", fontSize: 11 }}>—</span>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number" step="0.5" value={s.takeRate}
                        onChange={(e) => updateService(i, { takeRate: +e.target.value })}
                        style={{ width: 50, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", background: "var(--paper)", outline: "none" }}
                      />
                      <span className="mono" style={{ color: "var(--slate-3)", fontSize: 12 }}>%</span>
                    </div>
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <select value={s.status} onChange={(e) => updateService(i, { status: e.target.value })}
                    style={{ padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, color: "var(--ink)", background: "var(--paper)", outline: "none" }}>
                    <option value="live">Live</option>
                    <option value="free">Free (launch)</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    width: 36, height: 20, borderRadius: 999, padding: 2, display: "inline-flex", alignItems: "center",
                    background: s.status === "live" || s.status === "free" ? "var(--orange)" : "var(--line)",
                    justifyContent: s.status === "live" || s.status === "free" ? "flex-end" : "flex-start",
                  }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--paper)" }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Launch promo */}
      <div className="card" style={{ padding: 22, background: "var(--ink)", color: "var(--paper)", border: "none", display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center" }}>
        <div>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>Launch promo · active</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "var(--paper)", textTransform: "uppercase", marginTop: 4 }}>
            All add-ons free until 31 March 2027
          </div>
          <div style={{ fontSize: 13, color: "var(--slate-4)", marginTop: 6 }}>
            8 services have prices set. They will charge automatically when the promo ends.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-lg" style={{ color: "var(--paper)", borderColor: "rgba(255,255,255,0.2)" }}>Edit promo</button>
          <button className="btn btn-orange btn-lg">End early</button>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { AdminDashboard });

