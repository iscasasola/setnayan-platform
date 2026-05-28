// Marketplace — couple-facing /vendors search + filter + grid
// Tier-aware cards (Free / Verified / Pro / Enterprise look different)
// 3 sponsored boosted slots up top, then organic results

const Marketplace = () => {
  const filters = [
    { label: "Catering",      active: true  },
    { label: "Tagaytay",      active: true  },
    { label: "Mar 14, 2027",  active: true  },
    { label: "180 pax",       active: true  },
    { label: "Sit-down",      active: false },
    { label: "Halal kitchen", active: false },
    { label: "Under ₱500K",   active: false },
    { label: "4.5+ stars",    active: false },
  ];

  const sponsored = [
    {
      name: "Ato Catering",
      tier: "★ Pro", tierColor: "var(--orange-2)",
      cat: "Catering", loc: "Quezon City",
      base: "from ₱950/head", rating: 4.92, reviews: 38,
      tags: ["Sit-down 80–400", "Halal kitchen", "Vegan menu"],
      perk: "Free crew meals (₱24K value)", hue: 24,
    },
    {
      name: "Studio Sereno",
      tier: "★ Enterprise", tierColor: "var(--orange-2)",
      cat: "Photography", loc: "Makati",
      base: "from ₱180K", rating: 4.96, reviews: 64,
      tags: ["Editorial", "Same-day reel", "Drone"],
      perk: "Free engagement shoot", hue: 200,
    },
    {
      name: "La Castellana Estate",
      tier: "★ Pro", tierColor: "var(--orange-2)",
      cat: "Venue", loc: "Negros Occ.",
      base: "from ₱350K", rating: 4.85, reviews: 19,
      tags: ["Garden", "200–400 pax", "Heritage"],
      perk: "Welcome cocktail hour included", hue: 50,
    },
  ];

  const organic = [
    {
      name: "Bloom & Co. Florals",
      tier: "✓ Verified", tierColor: "var(--sage-deep)",
      cat: "Florals", loc: "Tagaytay",
      base: "from ₱55K", rating: 4.88, reviews: 27,
      tags: ["Garden", "Tropical", "Sampaguita"],
      perk: "Free toss bouquet duplicate", hue: 340,
    },
    {
      name: "Tala Studio",
      tier: "✓ Verified", tierColor: "var(--sage-deep)",
      cat: "Photography", loc: "Quezon City",
      base: "from ₱65K", rating: 4.86, reviews: 31,
      tags: ["Documentary", "SDE", "Mid-budget"],
      perk: "Free pre-nup edit revision", hue: 180,
    },
    {
      name: "Glasshouse QC",
      tier: "✓ Verified", tierColor: "var(--sage-deep)",
      cat: "Venue", loc: "Quezon City",
      base: "from ₱120K", rating: 4.81, reviews: 24,
      tags: ["Indoor", "120–200 pax", "Modern"],
      perk: "Bridal suite included 4h", hue: 80,
    },
    {
      name: "Manong Romy Trio",
      tier: "✓ Verified", tierColor: "var(--sage-deep)",
      cat: "Reception music", loc: "Iloilo",
      base: "from ₱32K", rating: 4.80, reviews: 22,
      tags: ["Acoustic", "OPM", "Standards"],
      perk: "First-dance song polished", hue: 280,
    },
    {
      name: "Ilaya Coordinators",
      tier: "✓ Verified", tierColor: "var(--sage-deep)",
      cat: "Coordination", loc: "Cebu",
      base: "from ₱48K", rating: 4.91, reviews: 41,
      tags: ["Full plan", "Day-of", "Bilingual"],
      perk: "Free run-of-show drafting", hue: 140,
    },
    {
      name: "Bayanihan Catering",
      tier: "Free", tierColor: "var(--slate-3)",
      cat: "Catering", loc: "Bulacan",
      base: "from ₱720/head", rating: null, reviews: 0,
      tags: ["Buffet", "Filipino comfort"],
      perk: null, hue: 30,
    },
    {
      name: "Lakas Lights",
      tier: "✓ Verified", tierColor: "var(--sage-deep)",
      cat: "Lights & Sound", loc: "Pampanga",
      base: "from ₱58K", rating: 4.74, reviews: 12,
      tags: ["LED wall", "Live mix"],
      perk: "Free Live Background loop", hue: 260,
    },
    {
      name: "Hilom Make-up",
      tier: "Free", tierColor: "var(--slate-3)",
      cat: "Hair & Make-up", loc: "Davao",
      base: "from ₱22K", rating: null, reviews: 0,
      tags: ["Bridal", "Airbrush"],
      perk: null, hue: 320,
    },
  ];

  return (
    <div style={{ minHeight: 2400, background: "var(--paper)", fontFamily: "var(--sans)" }}>
      {/* Top nav */}
      <header style={{
        padding: "18px 56px", borderBottom: "1px solid var(--line-soft)",
        background: "var(--paper)", position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <LogoFull height={28} />
        <nav style={{ display: "flex", gap: 26, fontSize: 14, color: "var(--slate)" }}>
          <a href="#" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 500 }}>Marketplace</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Productions</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>For vendors</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Help</a>
        </nav>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="#" style={{ fontSize: 14, color: "var(--slate)", textDecoration: "none", alignSelf: "center" }}>Sign in</a>
          <button className="btn btn-primary" style={{ padding: "9px 16px", fontSize: 13 }}>Start planning</button>
        </div>
      </header>

      {/* Search bar */}
      <section style={{ padding: "32px 56px 16px", background: "var(--paper-2)" }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Setnayan marketplace</div>
        <h1 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 28px", maxWidth: 900 }}>
          Find your vendors.<br />
          <span style={{ color: "var(--slate-2)" }}>Bid as many as you want — free, forever.</span>
        </h1>
        <div style={{ display: "flex", gap: 8, padding: 8, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, padding: "12px 16px" }}>
            <span style={{ color: "var(--slate-3)", fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 15, color: "var(--ink)" }}>Catering · Tagaytay · Mar 14, 2027 · 180 pax</span>
          </span>
          <button className="btn btn-primary" style={{ padding: "12px 24px", fontSize: 14 }}>Search</button>
        </div>
        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {filters.map(f => (
            <span key={f.label} style={{
              padding: "6px 14px", fontSize: 12, fontFamily: "var(--mono)",
              borderRadius: 999,
              background: f.active ? "var(--ink)" : "var(--paper)",
              color: f.active ? "var(--paper)" : "var(--slate)",
              border: "1px solid " + (f.active ? "var(--ink)" : "var(--line)"),
              cursor: "pointer",
            }}>{f.label}{f.active ? " ×" : " +"}</span>
          ))}
          <span style={{ padding: "6px 14px", fontSize: 12, color: "var(--slate-2)", fontFamily: "var(--mono)" }}>· 4 of 8 filters applied</span>
        </div>
      </section>

      {/* Body grid: sidebar + results */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 32, padding: "32px 56px" }}>
        {/* Filter sidebar */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            { label: "Event type",   options: ["Wedding · 12", "Debut · soon", "Birthday · soon", "Baptism · soon"] },
            { label: "Budget per service", options: ["Under ₱50K", "₱50K–₱150K", "₱150K–₱500K", "Over ₱500K"] },
            { label: "Distance",     options: ["10 km", "20 km", "50 km", "100 km · Enterprise"] },
            { label: "Rating",       options: ["4.5+ stars", "4.8+ stars", "Top 10%"] },
            { label: "Tier",         options: ["Verified+", "Pro+", "Enterprise only", "All"] },
            { label: "Capacity",     options: ["80–200 pax", "200–400 pax", "400+ pax"] },
          ].map((sec) => (
            <div key={sec.label}>
              <div className="label-mono" style={{ marginBottom: 10 }}>{sec.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sec.options.map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)", cursor: "pointer" }}>
                    <input type="checkbox" style={{ accentColor: "var(--orange)" }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12, justifyContent: "center" }}>Clear all filters</button>
        </aside>

        {/* Results */}
        <main>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div>
              <div className="label-mono">12 verified vendors</div>
              <div style={{ fontSize: 13, color: "var(--slate-2)", marginTop: 2 }}>Catering · Tagaytay · Mar 14, 2027 available</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>Sort:</span>
              <select style={{ padding: "6px 12px", fontSize: 12, fontFamily: "var(--mono)", border: "1px solid var(--line)", borderRadius: 6, background: "var(--paper)", color: "var(--ink)" }}>
                <option>Best match</option>
                <option>Highest rated</option>
                <option>Lowest price</option>
                <option>Verified first</option>
              </select>
            </div>
          </div>

          {/* Sponsored slots */}
          <div style={{ marginBottom: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.18em", marginBottom: 10 }}>★ SPONSORED BOOST · TOP OF SEARCH</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {sponsored.map(v => <VendorCard key={v.name} v={v} featured={true} />)}
            </div>
          </div>

          {/* Organic results */}
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", letterSpacing: "0.18em", margin: "24px 0 10px" }}>ALL MATCHES · ORGANIC RESULTS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {organic.map(v => <VendorCard key={v.name} v={v} featured={false} />)}
          </div>

          {/* Pagination */}
          <div style={{ marginTop: 32, padding: "20px 0", display: "flex", justifyContent: "center", gap: 8 }}>
            {["1", "2", "3", "→"].map((p, i) => (
              <button key={p} style={{
                padding: "6px 12px", fontSize: 13, fontFamily: "var(--mono)",
                border: "1px solid var(--line)", borderRadius: 6,
                background: i === 0 ? "var(--ink)" : "var(--paper)",
                color: i === 0 ? "var(--paper)" : "var(--slate)",
                cursor: "pointer",
              }}>{p}</button>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

const VendorCard = ({ v, featured }) => (
  <div style={{
    background: "var(--paper)", borderRadius: 12, overflow: "hidden",
    border: "1px solid " + (featured ? "var(--orange)" : "var(--line)"),
    position: "relative", display: "flex", flexDirection: "column",
  }}>
    {featured && (
      <span style={{
        position: "absolute", top: 10, right: 10, zIndex: 1,
        padding: "3px 10px", background: "var(--orange)", color: "#fff",
        fontSize: 9, borderRadius: 4, fontFamily: "var(--mono)", letterSpacing: "0.08em",
      }}>★ BOOSTED</span>
    )}
    <div style={{
      aspectRatio: "5/4",
      background: `linear-gradient(135deg, oklch(72% 0.10 ${v.hue}) 0%, oklch(86% 0.06 ${(v.hue + 40) % 360}) 100%)`,
    }} />
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 500 }}>{v.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 2 }}>{v.cat} · {v.loc}</div>
        </div>
        <span className="mono" style={{ fontSize: 9, color: v.tierColor, letterSpacing: "0.10em", whiteSpace: "nowrap" }}>{v.tier}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono" style={{ fontSize: 13, color: "var(--orange-2)", fontWeight: 500 }}>{v.base}</span>
        <span style={{ fontSize: 11, color: "var(--slate-2)" }}>
          {v.rating ? `${v.rating} ★ (${v.reviews})` : <em style={{ color: "var(--slate-3)" }}>No reviews yet</em>}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {v.tags.slice(0, 3).map(t => (
          <span key={t} style={{ padding: "2px 8px", background: "var(--paper-2)", borderRadius: 999, fontSize: 10, color: "var(--slate)", fontFamily: "var(--mono)" }}>{t}</span>
        ))}
      </div>
      {v.perk && (
        <div style={{ padding: "8px 10px", background: "var(--orange-4)", borderRadius: 6, fontSize: 11, color: "var(--orange-2)", marginTop: 4 }}>
          ✦ Setnayan perk: <strong>{v.perk}</strong>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8 }}>
        <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 11, flex: 1, justifyContent: "center" }}>View profile</button>
        <button className="btn btn-primary" style={{ padding: "7px 12px", fontSize: 11, flex: 1, justifyContent: "center" }}>Send bid</button>
      </div>
    </div>
  </div>
);

Object.assign(window, { Marketplace, VendorCard });
