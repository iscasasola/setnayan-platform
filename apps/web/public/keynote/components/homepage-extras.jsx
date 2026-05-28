// Marketplace preview, competitive comparison (couple-side), and vendor-side
// "why us" sections. Drops into the homepage between existing sections.

const { useState } = React;

const MARKETPLACE_VENDORS = [
  { name: "Setnayan Productions", cat: "Setnayan service", loc: "Nationwide",     rating: 4.94, reviews: 84,  base: "from ₱3,500",   tags: ["Panood livestream", "Papic crew", "AI reel"], verified: true, firstParty: true, hue: 60 },
  { name: "Ato Catering",        cat: "Catering",          loc: "Quezon City",   rating: 4.92, reviews: 38,  base: "from ₱950/head", tags: ["Sit-down", "Halal", "Vegan menu"],     verified: true,  booked: true,  hue: 80  },
  { name: "Bloom & Co. Florals", cat: "Florals",           loc: "Tagaytay",      rating: 4.88, reviews: 27,  base: "from ₱55K",     tags: ["Garden", "Tropical", "Sampaguita"],    verified: true,  hue: 25  },
  { name: "Tala Studio",         cat: "Photography",       loc: "Quezon City",   rating: 4.86, reviews: 31,  base: "from ₱65K",     tags: ["Documentary", "SDE", "Mid-budget"],    verified: true,  hue: 220 },
  { name: "Studio Sereno",       cat: "Photography",       loc: "Makati",        rating: 4.96, reviews: 64,  base: "from ₱180K",    tags: ["Editorial", "Same-day reel", "Drone"], verified: true,  hue: 200 },
  { name: "Glasshouse QC",       cat: "Venue",             loc: "Quezon City",   rating: 4.81, reviews: 24,  base: "from ₱120K",    tags: ["Indoor", "120–200 pax", "Modern"],     verified: true,  hue: 160 },
  { name: "La Castellana Estate",cat: "Venue",             loc: "Negros Occ.",   rating: 4.85, reviews: 19,  base: "from ₱350K",    tags: ["Garden", "200–400 pax", "Heritage"],   verified: true,  hue: 140 },
  { name: "Manong Romy Trio",    cat: "Reception music",   loc: "Iloilo",        rating: 4.80, reviews: 22,  base: "from ₱32K",     tags: ["Acoustic", "OPM", "Standards"],        verified: true,  hue: 50  },
  { name: "Ilaya Coordinators",  cat: "Coordination",      loc: "Cebu",          rating: 4.91, reviews: 41,  base: "from ₱48K",     tags: ["Full plan", "Day-of", "Bilingual"],    verified: true,  hue: 110 },
  { name: "Hilom Make-up",       cat: "Hair & Make-up",    loc: "Davao",         rating: 0,    reviews: 0,   base: "from ₱22K",     tags: ["Bridal", "Airbrush", "Filipina skin"], verified: false, hue: 340 },
  { name: "Lakas Lights",        cat: "Lights & Sound",    loc: "Pampanga",      rating: 4.74, reviews: 12,  base: "from ₱58K",     tags: ["LED wall", "Live mix", "USB loops"],   verified: true,  hue: 270 },
];
// Expose for the global SearchOverlay.
window.MARKETPLACE_VENDORS_LIST = MARKETPLACE_VENDORS;

const MarketplacePreview = () => {
  const [cat, setCat] = useState("All");
  const [loc, setLoc] = useState("Everywhere");
  const [evt, setEvt] = useState("Wedding");
  const [q, setQ]     = useState("");
  const cats = ["All", "Catering", "Photography", "Florals", "Venue", "Coordination", "Reception music", "Lights & Sound", "Hair & Make-up", "+183 more"];
  const locs = ["Everywhere", "Metro Manila", "Tagaytay", "Cebu", "Davao", "Iloilo"];
  const evts = ["Wedding", "Debut", "Gender Reveal", "Birthday", "Baptism", "Corporate", "Reunion", "Homecoming", "Prom", "Anniversary"];

  // Combined filter — search query + category + location.
  const ql = q.trim().toLowerCase();
  const filtered = MARKETPLACE_VENDORS.filter(v => {
    if (cat !== "All" && v.cat !== cat) return false;
    if (loc !== "Everywhere" && !v.loc.toLowerCase().includes(loc.toLowerCase().split(" ")[0])) return false;
    if (!ql) return true;
    return (
      v.name.toLowerCase().includes(ql) ||
      v.cat.toLowerCase().includes(ql) ||
      v.loc.toLowerCase().includes(ql) ||
      v.tags.some(t => t.toLowerCase().includes(ql))
    );
  });
  const searching = ql.length > 0 || cat !== "All" || loc !== "Everywhere";

  return (
    <section style={{ padding: "120px 56px", background: "var(--paper)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Marketplace</div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", letterSpacing: "-0.02em", maxWidth: 1100, color: "var(--ink)", fontWeight: 400 }}>
            Every vendor your wedding will need,
            <br /><em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>found in an afternoon.</em>
          </h2>
          <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 19, color: "var(--slate)", maxWidth: 640, lineHeight: 1.55 }}>
            Browse without an account. Sign in to lock a date, message a vendor, and watch
            the whole conversation slip neatly into your dashboard.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost">Open marketplace →</button>
          <button className="btn btn-primary">Sign up to sync</button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginTop: 36, display: "flex", gap: 12, alignItems: "center", padding: "14px 20px", background: "var(--paper-2)", borderRadius: 14, border: "1px solid var(--line)" }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="var(--slate-2)" strokeWidth="1.7" />
          <path d="M13.5 13.5L17 17" stroke="var(--slate-2)" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 412 vendors across 192 categories — try “sampaguita”, “drone”, or “Tagaytay”…"
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontFamily: "var(--sans)", fontSize: 15, color: "var(--ink)",
          }}
        />
        {searching && (
          <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
          </span>
        )}
        {q && (
          <button onClick={() => setQ("")} style={{
            border: "none", background: "var(--paper)", borderRadius: 999,
            padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "var(--slate-2)",
            fontFamily: "var(--mono)",
          }}>Clear</button>
        )}
      </div>

      {/* Filters */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <FilterRow label="Event" options={evts} value={evt} onChange={setEvt} comingSoon={evts.slice(1)} />
        <FilterRow label="Category" options={cats} value={cat} onChange={setCat} />
        <FilterRow label="Location" options={locs} value={loc} onChange={setLoc} />
      </div>

      {/* Grid — top row of search results */}
      {filtered.length > 0 ? (
        <>
          <Stagger step={80} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 28 }}>
            {filtered.slice(0, 4).map((v) => <VendorCard key={v.name} v={v} />)}
          </Stagger>
          {filtered.length > 4 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 14, position: "relative" }}>
              <Stagger step={80} baseDelay={250} style={{ display: "contents" }}>
                {filtered.slice(4).map((v) => <VendorCard key={v.name} v={v} dim={!searching} />)}
              </Stagger>
              {!searching && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(180deg, rgba(251,248,242,0) 0%, rgba(251,248,242,0.92) 60%, var(--paper) 100%)",
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  padding: 24, pointerEvents: "none",
                }}>
                  <div className="card" style={{ padding: 22, display: "flex", alignItems: "center", gap: 20, pointerEvents: "auto", boxShadow: "var(--shadow-lg)" }}>
                    <div>
                      <div className="label-mono">Sign up to see all 412 vendors</div>
                      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", marginTop: 4 }}>
                        Free account · 30-second setup
                      </div>
                      <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 4 }}>
                        Lock dates, message vendors, save favourites — synced across every device.
                      </div>
                    </div>
                    <button className="btn btn-orange btn-lg">Create account</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 28, padding: "48px 24px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: 14 }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, color: "var(--ink)", textTransform: "uppercase" }}>
            No vendors match “{q || cat + " · " + loc}”
          </div>
          <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 8 }}>
            Try a broader category, a nearby city, or{" "}
            <a href="#" style={{ color: "var(--orange-2)" }}>tell us what you’re looking for</a> —
            we’ll source it.
          </div>
        </div>
      )}
    </section>
  );
};

const FilterRow = ({ label, options, value, onChange, comingSoon = [] }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
    <div className="label-mono" style={{ width: 80 }}>{label}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => {
        const on = o === value;
        const soon = comingSoon.includes(o);
        return (
          <button key={o} onClick={() => !soon && onChange(o)} disabled={soon} style={{
            border: "1px solid " + (on ? "var(--ink)" : "var(--line)"),
            background: on ? "var(--ink)" : "var(--paper)",
            color: on ? "var(--paper)" : (soon ? "var(--slate-3)" : "var(--slate)"),
            padding: "6px 12px", borderRadius: 999, fontSize: 12,
            cursor: soon ? "not-allowed" : "pointer", fontFamily: "var(--sans)",
            display: "inline-flex", alignItems: "center", gap: 6,
            opacity: soon ? 0.7 : 1,
            borderStyle: soon ? "dashed" : "solid",
          }}>
            {o}
            {soon && <span className="mono" style={{ fontSize: 9, color: "var(--orange-2)", letterSpacing: "0.06em" }}>SOON</span>}
            {on && o === "Wedding" && <span style={{ fontSize: 9, color: "var(--orange-3)", letterSpacing: "0.06em" }}>· LIVE</span>}
          </button>
        );
      })}
    </div>
  </div>
);

const VendorCard = ({ v, dim }) => (
  <div className="card" style={{ padding: 0, overflow: "hidden", opacity: dim ? 0.55 : 1, transition: "transform .2s", position: "relative" }}>
    <button onClick={(e) => { e.stopPropagation(); e.currentTarget.dataset.saved = e.currentTarget.dataset.saved === "1" ? "0" : "1"; }} data-saved="0" style={{
      position: "absolute", top: 10, right: 50, zIndex: 2,
      width: 32, height: 32, borderRadius: "50%",
      background: "rgba(251,248,242,0.94)", backdropFilter: "blur(8px)",
      border: "1px solid var(--line)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, color: "var(--orange-2)",
      transition: "transform .15s, background .15s",
    }} aria-label="Save to favorites (account-level)" title="Favorite · always at top of your search">★</button>
    <button onClick={(e) => { e.stopPropagation(); e.currentTarget.dataset.saved = e.currentTarget.dataset.saved === "1" ? "0" : "1"; }} data-saved="0" style={{
      position: "absolute", top: 10, right: 10, zIndex: 2,
      width: 32, height: 32, borderRadius: "50%",
      background: "rgba(251,248,242,0.94)", backdropFilter: "blur(8px)",
      border: "1px solid var(--line)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, color: "var(--orange-2)",
      transition: "transform .15s, background .15s",
    }} aria-label="Save to shortlist (this event)" title="Shortlist · save for this wedding">♡</button>
    <div style={{
      aspectRatio: "5/4",
      background: `linear-gradient(135deg, oklch(70% 0.10 ${v.hue}) 0%, oklch(85% 0.06 ${(v.hue + 40) % 360}) 100%)`,
      position: "relative",
    }}>
      <div style={{ position: "absolute", inset: "auto 12px 12px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span className="pill" style={{ background: "var(--paper)", fontSize: 10, padding: "4px 8px" }}>{v.cat}</span>
        {v.firstParty
          ? <span className="pill" style={{ background: "var(--ink)", color: "var(--orange-3)", borderColor: "transparent", fontSize: 10, padding: "4px 8px" }}>★ First-party</span>
          : v.verified
            ? <span className="pill pill-orange" style={{ fontSize: 10, padding: "4px 8px" }}>✓ Verified</span>
            : <span className="pill" style={{ background: "var(--paper)", borderStyle: "dashed", color: "var(--slate-3)", fontSize: 10, padding: "4px 8px" }}>Pending</span>
        }
      </div>
    </div>
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 500 }}>{v.name}</div>
        {v.rating > 0 && (
          <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)", flexShrink: 0 }}>
            ★ {v.rating.toFixed(2)}
          </span>
        )}
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)" }}>{v.loc} · {v.reviews || "—"} reviews</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
        {v.tags.slice(0, 3).map(t => (
          <span key={t} className="pill" style={{ fontSize: 10, padding: "3px 7px", background: "var(--paper-2)" }}>{t}</span>
        ))}
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>{v.base}</span>
        <a href="#" style={{ fontSize: 12, color: "var(--orange-2)", textDecoration: "none", fontWeight: 500 }}>
          {v.booked ? "Yours · ✓" : "View →"}
        </a>
      </div>
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Couple-side competitive comparison
const CoupleComparison = () => {
  const cols = [
    { name: "Spreadsheet + DMs",   sub: "What most couples use today",     stack: true },
    { name: "Foreign event apps",  sub: "US-built, no PH context"          },
    { name: "Setnayan",            sub: "Filipino-built · operating tools", us: true },
  ];
  const rows = [
    ["Proper PH receipts + tax handled",         [false, false, true]],
    ["Tagalog interface (Q1 2027)",               [false, false, true]],
    ["Reviews from real Setnayan couples",      [false, true,  true]],
    ["Personal QR invitations + RSVP",            [false, true,  true]],
    ["Day-of livestream + same-day highlight reel", [false, false, true]],
    ["Multi-host: invite parents + coordinator",  [true,  true,  true]],
    ["Verified Filipino vendor marketplace",      [false, false, true]],
    ["GCash / InstaPay / cards at checkout",      [true,  false, true]],
    ["Per-role privacy (vendor sees only what they need)", [false, false, true]],
    ["Subscription cost to plan",                  ["Spreadsheets free", "$15–30/mo", "Free forever"]],
  ];

  return (
    <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
      <div className="eyebrow">Why Setnayan vs. the rest</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", maxWidth: 1100, letterSpacing: "-0.02em", color: "var(--ink)", fontWeight: 400 }}>
        The only tool{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>built here.</em>
      </h2>
      <p style={{ fontSize: 17, color: "var(--slate)", maxWidth: 720, lineHeight: 1.55 }}>
        Most planning tools are either a spreadsheet you keep patching or a US app that doesn’t
        know what a BIR receipt is. Setnayan is the only platform with the operating tools your
        wedding actually needs — and the compliance the law actually requires.
      </p>

      <div className="card" style={{ marginTop: 56, padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.05fr",
          background: "var(--paper)",
        }}>
          <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid var(--line)" }}>
            <div className="label-mono">Feature</div>
          </div>
          {cols.map((c, i) => (
            <div key={c.name} style={{
              padding: "22px 22px 18px",
              borderBottom: "1px solid var(--line)",
              borderLeft: "1px solid var(--line-soft)",
              background: c.us ? "var(--ink)" : "var(--paper)",
              color: c.us ? "var(--paper)" : "var(--ink)",
            }}>
              <div className="label-mono" style={{ color: c.us ? "var(--orange-3)" : "var(--slate-2)" }}>
                {c.us ? "★ Us" : `Option ${i + 1}`}
              </div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, textTransform: "uppercase", marginTop: 4 }}>
                {c.name}
              </div>
              <div style={{ fontSize: 12, color: c.us ? "var(--slate-4)" : "var(--slate-2)", marginTop: 6, lineHeight: 1.4 }}>
                {c.sub}
              </div>
            </div>
          ))}

          {rows.map(([feature, values], rowIdx) => (
            <React.Fragment key={rowIdx}>
              <div style={{
                padding: "16px 22px",
                borderTop: rowIdx === 0 ? "none" : "1px solid var(--line-soft)",
                fontSize: 14, color: "var(--ink)",
                display: "flex", alignItems: "center",
              }}>
                {feature}
              </div>
              {values.map((v, ci) => {
                const us = ci === 2;
                return (
                  <div key={ci} style={{
                    padding: "16px 22px",
                    borderTop: rowIdx === 0 ? "none" : "1px solid " + (us ? "rgba(255,255,255,0.08)" : "var(--line-soft)"),
                    borderLeft: "1px solid " + (us ? "rgba(255,255,255,0.08)" : "var(--line-soft)"),
                    background: us ? "var(--ink)" : "var(--paper)",
                    color:      us ? "var(--paper)" : "var(--slate)",
                    fontSize: 14, display: "flex", alignItems: "center",
                  }}>
                    {typeof v === "boolean"
                      ? (v
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: us ? "var(--orange-3)" : "var(--sage-deep)", fontFamily: "var(--mono)", fontSize: 13 }}>
                            <span style={{ width: 18, height: 18, borderRadius: "50%", background: us ? "var(--orange)" : "var(--sage)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</span>
                            Included
                          </span>
                        : <span style={{ color: "var(--slate-3)", fontFamily: "var(--mono)", fontSize: 13 }}>—</span>)
                      : <span style={{ fontWeight: us ? 500 : 400, color: us ? "var(--paper)" : "var(--ink)", fontFamily: typeof v === "string" && v.startsWith("$") ? "var(--mono)" : "inherit" }}>{v}</span>}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 12 }}>
        <button className="btn btn-orange btn-lg">Start planning — free</button>
        <button className="btn btn-ghost btn-lg">Read the full feature list →</button>
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────
// Vendor-side deep-dive

const ForVendors = () => {
  const benefits = [
    { tag: "Lead capture",   title: "Couples find you, message you, book you — without leaving Setnayan.",
      body: "Show up in every couple’s vendor finder for your category. No third-party fees, no inboxes to juggle." },
    { tag: "BIR done for you", title: "Official Receipts, 2307s, and EWT generated on every payout.",
      body: "Stop hand-writing receipts. Setnayan stamps each payment with a proper BIR OR and emails the 2307 to the couple at year-end." },
    { tag: "Calendar that means something", title: "Agent-redacted booking calendar with team roles + per-service scoping.",
      body: "Your team sees what they need to see — service captains see crew counts, dispatch sees addresses, accounts sees the invoice. No more shared Google sheets." },
    { tag: "Bid pipeline", title: "Request bid → Chat → Quote → Accept in one rail.",
      body: "Couples request a bid through your microsite, you spend 1 token to open the thread, you chat and finalize pricing together, customer accepts. Reply-time stats show on your public profile — fast vendors get more bookings." },
    { tag: "Grow with the platform", title: "Wedding today. Debut, birthday, corporate, anniversaries — yours next.",
      body: "Every event type opens as our verified vendor count crosses the threshold in your area. Your verification, reviews, and CRM history carry into each one — no second listing, no second login." },
    { tag: "Sponsored boost",  title: "Pay-per-week visibility from 10km → 30km radius. Pause anytime.",
      body: "Ready to scale? Boost your profile across nearby cities for ₱1,200/week. Cancel mid-week, prorated refund." },
    { tag: "Crew-rate marketplace", title: "Coming soon — list your crew, earn from every booking they take.",
      body: "Service captains, photographers, AV ops can opt into Setnayan’s crew rates. You earn a referral cut on every gig your team picks up." },
  ];

  return (
    <section style={{ padding: "120px 56px", background: "var(--paper)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end", marginBottom: 64 }}>
        <div>
          <div className="eyebrow">For vendors · deep dive</div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 84, lineHeight: 1.04, margin: "20px 0 16px", letterSpacing: "-0.025em", color: "var(--ink)", fontWeight: 400 }}>
            Better tools,{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>more weddings.</em>
          </h2>
        </div>
        <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.55, maxWidth: 520 }}>
          You’re already great at the work. We just want fewer DMs, cleaner books, and more
          couples knowing you exist. Free to start — pay only when you opt into a boost.
        </p>
      </div>

      {/* Free vs Pro — the real comparison */}
      <div style={{ marginBottom: 14 }}>
        <div className="eyebrow" style={{ color: "var(--slate-2)" }}>Free vs Pro · what you get on each side</div>
        <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 8, maxWidth: 760, lineHeight: 1.5 }}>
          Free is designed to beat the patchwork stack you use today (Kasal + Google Calendar + WhatsApp + Wave). Pro is the stuff <em style={{ color: "var(--ink)" }}>only Setnayan can offer</em> — because we have the couples, the data, and the ops team.
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header row · 4 tiers */}
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1fr", background: "var(--paper)" }}>
          <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--line)" }}>
            <div className="label-mono">Capability</div>
          </div>
          {/* FREE */}
          <div style={{ padding: "22px 16px", borderBottom: "1px solid var(--line)", borderLeft: "1px solid var(--line-soft)" }}>
            <div className="label-mono">Free</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", marginTop: 4 }}>₱0 <span style={{ fontSize: 12, color: "var(--slate-2)" }}>/ mo</span></div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>no card needed</div>
          </div>
          {/* VERIFIED */}
          <div style={{ padding: "22px 16px", borderBottom: "1px solid var(--line)", borderLeft: "1px solid var(--line-soft)" }}>
            <div className="label-mono">✓ Verified</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", marginTop: 4 }}>₱1,499 <span style={{ fontSize: 12, color: "var(--slate-2)" }}>once</span></div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>lifetime verified badge</div>
          </div>
          {/* PRO (highlighted) */}
          <div style={{ padding: "22px 16px", borderBottom: "1px solid var(--line)", background: "var(--ink)", color: "var(--paper)", position: "relative" }}>
            <div className="label-mono" style={{ color: "var(--orange-3)" }}>★ Pro</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--paper)", marginTop: 4 }}>₱1,999 <span style={{ fontSize: 12, color: "var(--slate-4)" }}>/ mo</span></div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)", marginTop: 4 }}>1 category · 5 accounts</div>
          </div>
          {/* ENTERPRISE */}
          <div style={{ padding: "22px 16px", borderBottom: "1px solid var(--line)", borderLeft: "1px solid var(--line-soft)" }}>
            <div className="label-mono">⬢ Enterprise</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", marginTop: 4 }}>₱5,499 <span style={{ fontSize: 12, color: "var(--slate-2)" }}>/ mo</span></div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>multi-cat · unlimited team</div>
          </div>
        </div>

        {[
          {
            section: "The basics · every tier",
            note: "Free already matches the best free vendor stack on the market.",
            rows: [
              ["Verified vendor profile + microsite",         "Free",      "Free",         "Free",            "Free"],
              ["In-app chat (couple-initiated)",               "Free",      "Free",         "Free",            "Free"],
              ["Pipeline · Bid → Chat → Quote → Accept",       "Free",      "Free",         "Free",            "Free"],
              ["Create service packages",                      "Free",      "Free",         "Free",            "Free"],
              ["Photo portfolio",                              "Up to 15",  "Unlimited",    "Unlimited",       "Unlimited"],
              ["Calendar with .ics export",                    "Free",      "Free",         "Free",            "Free"],
            ],
          },
          {
            section: "🪙 Bidding · the per-action engine",
            note: "Vendors spend tokens to accept couple inquiries. Earn tokens by recommending Productions services that couples buy and use (handshake-confirmed).",
            rows: [
              ["Bids per week",                                "Up to 10",  "Unlimited",    "Unlimited",       "Unlimited"],
              ["Bidding token packs",                          "Buy packs", "Buy packs",    "Buy packs",       "Buy packs"],
              ["Founder bonus 100 tokens (until 31 Jan 2027)", "—",         "On verification", "On verification", "On verification"],
              ["Ongoing token bonus qualification",            false,       true,           true,              true],
              ["Earn tokens from Productions referrals",       "Free",      "Free",         "Free",            "Free"],
            ],
          },
          {
            section: "📡 Reach & visibility",
            note: "Boost radius scales by tier. Higher tiers also unlock paid ad placements and a shareable bid link for social.",
            rows: [
              ["Boost radius",                                 "10km",      "20km",         "50km",            "100km"],
              ["Sponsored Boost · top of category search",     false,       false,          true,              true],
              ["Boosted Ads · ₱1,200/wk add-on",               false,       false,          true,              true],
              ["Sharable bid link for social media",           false,       false,          false,             true],
            ],
          },
          {
            section: "🌐 Your vendor surfaces",
            note: "From a profile to a full custom microsite with a bid button. Higher tiers get more polish.",
            rows: [
              ["Public vendor website",                        "—",         "Website",      "Custom website",  "Custom website"],
              ["Custom slug · setnayan.com/v/yourname",        false,       false,          true,              true],
              ["Bid Button on your website",                   false,       false,          true,              true],
              ["Video call with couples",                      false,       true,           true,              true],
              ["Show star ratings on profile",                 false,       true,           true,              true],
              ["Show full reviews on profile",                 false,       false,          true,              true],
            ],
          },
          {
            section: "🗓 Schedule",
            note: "Manual on Free; Hybrid on Verified+ — pending bids show as white-marker holds, locked bids auto-block the date.",
            rows: [
              ["Scheduling mode",                              "Manual",    "Hybrid",       "Hybrid",          "Hybrid"],
              ["Multiple events per day",                      false,       false,          true,              true],
            ],
          },
          {
            section: "🛠 Pro tools",
            note: "Editorial tagging that auto-builds your \"successful weddings\" collection, category-specific toolkits, AI proposal drafts — the toolkit Pro+ vendors use to close more weddings.",
            rows: [
              ["Editorial Tagging · auto-featured in couples' editorials", false,       false,          true,              true],
              ["On Boarding Bundle Maker",                     false,       false,          true,              true],
              ["File sharing with couples",                    false,       false,          true,              true],
              ["Specialized Tools · per-category toolkit",     false,       false,          true,              true],
              ["AI Proposal Builder",                          false,       false,          true,              true],
              ["Category benchmark analytics",                 false,       false,          true,              true],
              ["Demand pulse · what couples are searching",    false,       false,          true,              true],
              ["Reverse-image portfolio theft monitoring",     false,       false,          true,              true],
              ["Crew-rate marketplace",                        false,       false,          true,              true],
              ["Co-listing with Setnayan Productions",         false,       false,          true,              true],
            ],
          },
          {
            section: "🏢 Scope (Enterprise difference)",
            note: "Pro is built for one team running one category. Enterprise opens it up — multiple categories, unlimited team accounts.",
            rows: [
              ["Categories you can list under",                "1",         "1",            "1",               "Multiple"],
              ["Team accounts",                                "1",         "1",            "Up to 5",         "Unlimited"],
            ],
          },
          {
            section: "🤝 Ops + support",
            note: "Every vendor gets Today's Focus matchmaking. Pro+ adds priority support; Enterprise adds a quarterly review.",
            rows: [
              ["Today's Focus matching",                  "Free",      "Free",         "Priority",        "Priority"],
              ["Priority support · sub-4h response",           false,       false,          true,              true],
              ["Quarterly business review",                    false,       false,          false,             true],
            ],
          },
        ].map((sec, si) => (
          <React.Fragment key={si}>
            {/* Section header */}
            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1fr", background: "var(--paper-2)" }}>
              <div style={{ padding: "18px 24px 6px", gridColumn: "1 / -1" }}>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  {sec.section}
                </div>
                <div style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 4, lineHeight: 1.45 }}>{sec.note}</div>
              </div>
            </div>
            {sec.rows.map(([feature, ...vals], ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1fr", borderTop: "1px solid var(--line-soft)" }}>
                <div style={{ padding: "14px 24px", fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center" }}>{feature}</div>
                {vals.map((v, ci) => {
                  const isPro = ci === 2;
                  return (
                    <div key={ci} style={{
                      padding: "14px 16px",
                      borderLeft: "1px solid " + (isPro ? "rgba(255,255,255,0.08)" : "var(--line-soft)"),
                      background: isPro ? "var(--ink)" : "var(--paper)",
                      color: isPro ? "var(--paper)" : "var(--slate)",
                      fontSize: 12, display: "flex", alignItems: "center",
                    }}>
                      {typeof v === "boolean"
                        ? (v
                          ? <span style={{ width: 16, height: 16, borderRadius: "50%", background: isPro ? "var(--orange)" : "var(--sage)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</span>
                          : <span style={{ color: "var(--slate-3)", fontFamily: "var(--mono)", fontSize: 12 }}>—</span>)
                        : v === "—"
                          ? <span style={{ color: "var(--slate-3)", fontFamily: "var(--mono)", fontSize: 12 }}>—</span>
                          : <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: isPro ? 500 : 400, color: isPro ? "var(--paper)" : "var(--ink)" }}>{v}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Why Pro is locked to Setnayan — 4 reasons */}
      <div style={{ marginTop: 28 }}>
        <div className="eyebrow">Why Pro can't be bought elsewhere</div>
        <h3 style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.06, margin: "12px 0 24px", color: "var(--ink)", fontWeight: 400, maxWidth: 760 }}>
          Four ecosystem locks. Each one is impossible to replicate{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>with any stack of SaaS.</em>
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { num: "1", tag: "🔗 The couples",   title: "Today's Focus matchmaking",        body: "We hand-curate couple → vendor matches from briefs already in the platform. Not lead-gen ads — actual ops-team intros." },
            { num: "2", tag: "📊 The data",      title: "Category benchmarks",          body: "Your funnel, your pricing, your reply-time — vs the median for your category. Know if you're under-priced before you lose a deal." },
            { num: "3", tag: "📊 The data",      title: "Reverse-image theft watch",     body: "Monthly scans of the open web for stolen versions of your portfolio. We surface the evidence — you decide what to do with it. Only possible because we see the marketplace." },
            { num: "4", tag: "🎬 First-party",   title: "Co-listing with Productions",   body: "Setnayan Productions is in every couple's bundle recommendation. Pro lets your service ride alongside ours." },
          ].map((c, i) => (
            <Reveal key={c.num} delay={i * 70}>
              <div className="card" style={{ padding: 22, height: "100%", display: "flex", flexDirection: "column", gap: 10, background: "var(--paper)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>{c.tag}</span>
                  <span className="display" style={{ fontSize: 22, color: "var(--orange-3)" }}>{c.num}</span>
                </div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.1, marginTop: 4 }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.5 }}>{c.body}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Founder bonus callout */}
      <div className="card" style={{ padding: 22, marginTop: 16, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center", background: "var(--ink)", color: "var(--paper)", border: "none" }}>
        <div className="display" style={{ fontSize: 36, color: "var(--orange-3)" }}>100×</div>
        <div>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>Founder bonus · 100 free bidding tokens on verification</div>
          <div style={{ fontSize: 14, color: "var(--paper)", marginTop: 4, lineHeight: 1.5 }}>
            Verify your business before <strong style={{ color: "var(--orange-3)" }}>31 January 2027</strong> and
            we drop <strong style={{ color: "var(--orange-3)" }}>100 free bidding tokens</strong> into your
            account — enough to chase ~100 couple inquiries without spending a peso on packs.
            After 31 Jan 2027, founder bonus ends.
          </div>
        </div>
        <button className="btn btn-orange" style={{ padding: "10px 18px" }}>Verify now →</button>
      </div>

      {/* 0% commission strip */}
      <div className="card" style={{ padding: 22, marginTop: 16, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center", background: "var(--ivory)" }}>
        <div className="display" style={{ fontSize: 36, color: "var(--orange-2)" }}>0%</div>
        <div>
          <div className="label-mono">0% commission · we never touch your transactions</div>
          <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 4, lineHeight: 1.5 }}>
            Vendor and couple agree on the price. Couple pays the vendor directly. Setnayan
            doesn't see the money, doesn't middleman the contract, doesn't take a cut.
            We make money on subscriptions, tokens, and our own Productions services — not on
            your bookings. Vendor keeps <strong style={{ color: "var(--ink)" }}>100%</strong>.
          </div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>vendor keeps 100%</span>
      </div>

      {/* Enterprise tier teaser */}
      <div className="card" style={{ padding: 22, marginTop: 16, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center", background: "var(--paper-2)" }}>
        <div className="display" style={{ fontSize: 36, color: "var(--orange-2)" }}>₱5,499</div>
        <div>
          <div className="label-mono">Enterprise · ₱5,499 / month</div>
          <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 4, lineHeight: 1.5 }}>
            Multi-category listing + unlimited team accounts. Same Pro feature set, scaled for
            full-service event houses running coordination, florals, photo, and catering under
            one roof. Verification still required.
          </div>
        </div>
        <button className="btn btn-ghost" style={{ padding: "10px 18px" }}>Talk to ops →</button>
      </div>

      {/* Benefit grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 28 }}>
        {benefits.map((b, i) => (
          <Reveal key={b.tag} delay={i * 70}>
            <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>{b.tag}</span>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.08 }}>
                {b.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>{b.body}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Vendor CTA strip */}
      <div className="card" style={{ marginTop: 28, padding: 32, background: "var(--ink)", color: "var(--paper)", border: "none", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "center" }}>
        <div>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>Ready to switch?</div>
          <div className="display" style={{ fontSize: 44, color: "var(--paper)", marginTop: 8, lineHeight: 1.02 }}>
            Register your business in three minutes.
          </div>
          <div style={{ fontSize: 14, color: "var(--slate-4)", marginTop: 10, lineHeight: 1.55, maxWidth: 520 }}>
            Profile, photos, services, calendar — get listed today. Verification in 24 hours.
            First proposal in your inbox by next week.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn btn-orange btn-lg" style={{ justifyContent: "center" }}>Register your business — free</button>
          <button className="btn btn-ghost btn-lg" style={{ justifyContent: "center", color: "var(--paper)", borderColor: "rgba(255,255,255,0.18)" }}>
            Book a 15-min vendor demo
          </button>
        </div>
      </div>
    </section>
  );
};

Object.assign(window, { MarketplacePreview, CoupleComparison, ForVendors });
