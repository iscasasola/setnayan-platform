// 10 hero / homepage direction variations, laid out side-by-side on one artboard
// for user comparison. Each is a self-contained <HeroVariation>.

const HV_W = 1440;   // hero width
const HV_H = 720;    // hero height (each card)

const HeroVariations = () => (
  <div style={{ background: "var(--paper-2)", padding: "32px 32px 64px", fontFamily: "var(--sans)" }}>
    <div style={{ borderTop: "1px solid var(--ink)", paddingTop: 14, marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)" }}>
          Ten directions · pick one
        </div>
        <h1 className="serif" style={{ fontSize: 64, lineHeight: 1.02, margin: "12px 0 0", color: "var(--ink)", letterSpacing: "-0.02em" }}>
          The same first impression, <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>ten ways.</em>
        </h1>
        <p style={{ fontSize: 14, color: "var(--slate)", marginTop: 10, maxWidth: 720, lineHeight: 1.55 }}>
          Each direction is a hero treatment — the first thing a couple sees on
          setnayan.com. They share the brand mark and orange accent. They diverge in
          typography, layout, photography, and tone. Tell me which lands.
        </p>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>
        Scroll ↓ · 10 cards · 1440×720 each
      </div>
    </div>

    {/* Each variation as a labelled card */}
    <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
      <Direction n="01" title="Bold Sans · confident" body="The current direction — Saira Condensed display, monospace numerics, product card right. Reads modern-confident, photography-led. Risk: feels like every tech-SaaS landing." render={<V01_BoldSans />} />
      <Direction n="02" title="Editorial Serif · magazine" body="Instrument Serif italic headline, dateline like a feature spread. Single large couple portrait. Reads premium-editorial. Risk: feels less like an app, more like a wedding magazine." render={<V02_EditorialSerif />} />
      <Direction n="03" title="Brutalist Type · all words" body="Massive type fills the screen. No image. One sentence carries everything. Reads confident-monolithic. Risk: cold if the wrong words." render={<V03_Brutalist />} />
      <Direction n="04" title="Photo Lifestyle · full-bleed" body="Cinematic full-bleed couple photo + minimal text overlay. Reads aspirational-emotional. Risk: depends entirely on the photo." render={<V04_PhotoLifestyle />} />
      <Direction n="05" title="Minimal Product · Linear-style" body="Almost no decoration. Big product dashboard screenshot is the hero. Reads as: this is a serious tool. Risk: less warm." render={<V05_MinimalProduct />} />
      <Direction n="06" title="Filipino Native · rooted" body="Capiz tile motif, banana-leaf texture, Tagalog headline with English subtitle. Reads deeply Filipino. Risk: leans traditional — may feel less premium." render={<V06_FilipinoNative />} />
      <Direction n="07" title="Pastel Romantic · classic bridal" body="Blush/cream palette, serif italic, ribbon flourishes, soft. Reads classic-wedding. Risk: feels conservative, blends with competitors." render={<V07_PastelRomantic />} />
      <Direction n="08" title="Asymmetric Editorial · newspaper" body="Multi-column, issue number, datelines, fragmented hierarchy. Reads as a real publication. Risk: information-heavy at first glance." render={<V08_AsymmetricEditorial />} />
      <Direction n="09" title="Marketplace First · search is hero" body="No headline — the big search bar IS the hero. Vendor cards float below. Reads as: pick a vendor in 30 seconds. Risk: skips the why." render={<V09_MarketplaceFirst />} />
      <Direction n="10" title="Story Chapter · narrative" body="Hero reads like the first page of a novel. Date stamp, italic prose, very intimate. Reads memoir-quality. Risk: too soft for product." render={<V10_StoryChapter />} />
    </div>
  </div>
);

const Direction = ({ n, title, body, render }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 14, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
      <div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--orange-2)", textTransform: "uppercase" }}>
          Direction {n}
        </div>
        <div className="display" style={{ fontSize: 28, marginTop: 4 }}>{title}</div>
        <p style={{ fontSize: 13, color: "var(--slate)", maxWidth: 720, marginTop: 6, lineHeight: 1.5 }}>{body}</p>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)" }}>{HV_W} × {HV_H}</div>
    </div>
    <div style={{ width: HV_W, height: HV_H, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
      {render}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V01 · Bold Sans (current direction)
const V01_BoldSans = () => (
  <div style={{ width: "100%", height: "100%", background: "var(--paper)", padding: "64px 64px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 64, alignItems: "center" }}>
    <div>
      <div className="mono" style={{ fontSize: 12, letterSpacing: "0.18em", color: "var(--slate-2)", marginBottom: 24 }}>SET NA ‘YAN · /sɛt na jan/</div>
      <h1 className="display" style={{ fontSize: 96, lineHeight: 1.02, margin: 0 }}>
        PLANNING<br />A WEDDING?<br /><span style={{ color: "var(--orange)" }}>WE’LL SET IT UP.</span>
      </h1>
      <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.55, maxWidth: 480, marginTop: 24 }}>
        Filipino-built. Real operating tools — guest list, vendors, livestream, same-day reel.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button className="btn btn-primary btn-lg">Start planning</button>
        <button className="btn btn-ghost btn-lg">I'm a vendor →</button>
      </div>
    </div>
    <div className="card" style={{ height: "85%", padding: 20, background: "var(--paper-2)" }}>
      <div className="label-mono">app · maria & juan</div>
      <div className="display" style={{ fontSize: 28, marginTop: 8 }}>CLAIRE & ICE</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14 }}>
        {[["166", "RSVPs"], ["9", "vendors"], ["62%", "budget"]].map(([v, k]) => (
          <div key={k} style={{ padding: 10, background: "var(--paper)", borderRadius: 8, border: "1px solid var(--line)" }}>
            <div className="display" style={{ fontSize: 22 }}>{v}</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--slate-2)" }}>{k}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: 14, background: "var(--ivory)", borderRadius: 10 }}>
        <div className="label-mono">Today's focus</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: "var(--ink)", marginTop: 4, textTransform: "uppercase" }}>Send 47 invites</div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V02 · Editorial Serif · magazine spread
const V02_EditorialSerif = () => (
  <div style={{ width: "100%", height: "100%", background: "var(--paper)", padding: "48px 64px", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 48 }}>
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--ink)", paddingTop: 12, marginBottom: 32 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--ink)" }}>SETNAYAN · ISSUE No. 01</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>Quezon City · 26 May 2026</span>
      </div>
      <h1 className="serif" style={{ fontSize: 88, lineHeight: 1.02, margin: 0, letterSpacing: "-0.025em", color: "var(--ink)" }}>
        Plan your<br />wedding the way<br /><em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>your Lola would —</em><br />only easier.
      </h1>
      <p className="serif" style={{ fontSize: 19, fontStyle: "italic", color: "var(--slate)", lineHeight: 1.55, marginTop: 28, maxWidth: 480 }}>
        A Filipino-built operating tool for the whole day, from save-the-date to the same-day highlight reel.
      </p>
      <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
        <button className="btn btn-primary btn-lg">Begin →</button>
        <span style={{ fontSize: 13, color: "var(--slate-2)", alignSelf: "center" }}>Free · no card needed</span>
      </div>
    </div>
    <div className="photo-placeholder" style={{ borderRadius: 4 }}>
      <span className="pp-label">portrait · 4×5 · maria · golden hour</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V03 · Brutalist · all type
const V03_Brutalist = () => (
  <div style={{ width: "100%", height: "100%", background: "var(--paper)", padding: "48px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <LogoFull height={32} />
      <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>EST. QUEZON CITY · 2026</span>
    </div>
    <h1 className="display" style={{ fontSize: 208, lineHeight: 0.92, margin: 0, color: "var(--ink)" }}>
      SET NA<br />
      <span style={{ color: "var(--orange)" }}>‘YAN.</span>
    </h1>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <p style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1.4, margin: 0, maxWidth: 480 }}>
        Filipino weddings. One platform. <span className="hi">Wedding today, every celebration tomorrow.</span>
      </p>
      <button className="btn btn-orange btn-lg">Plan yours →</button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V04 · Photo Lifestyle · full bleed
const V04_PhotoLifestyle = () => (
  <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
    <div className="photo-placeholder" style={{ position: "absolute", inset: 0 }}>
      <span className="pp-label" style={{ inset: "auto 24px 24px auto", left: "auto" }}>full-bleed · couple at the altar · 16×9</span>
    </div>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(45,48,56,0.65) 100%)" }} />
    <div style={{ position: "absolute", top: 40, left: 64 }}>
      <LogoFull height={32} />
    </div>
    <div style={{ position: "absolute", left: 64, bottom: 56, color: "var(--paper)", maxWidth: 720 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--orange-3)" }}>SET NA ‘YAN · /sɛt na jan/</div>
      <h1 className="serif" style={{ fontSize: 76, lineHeight: 1.02, marginTop: 16, color: "var(--paper)", letterSpacing: "-0.02em" }}>
        Every wedding has<br />a thousand moving pieces.<br />
        <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>We hold them.</em>
      </h1>
      <button className="btn btn-orange btn-lg" style={{ marginTop: 24 }}>Start planning — free</button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V05 · Minimal Product · Linear-style
const V05_MinimalProduct = () => (
  <div style={{ width: "100%", height: "100%", background: "var(--paper)", padding: "80px 64px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", overflow: "hidden" }}>
    <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--slate-2)" }}>SET NA ‘YAN — FILIPINO WEDDING OS</div>
    <h1 className="display" style={{ fontSize: 72, lineHeight: 1.02, margin: "20px 0 16px", maxWidth: 980 }}>
      The operating tool for <span style={{ color: "var(--orange)" }}>Filipino weddings.</span>
    </h1>
    <p style={{ fontSize: 17, color: "var(--slate)", maxWidth: 580, lineHeight: 1.55, margin: 0 }}>
      One database. Three doorways — couple, vendor, guest. Built in Quezon City.
    </p>
    <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
      <button className="btn btn-primary btn-lg">Start planning</button>
      <button className="btn btn-ghost btn-lg">See a demo</button>
    </div>
    <div className="card" style={{ marginTop: 36, width: 920, height: 280, padding: 20, boxShadow: "var(--shadow-lg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid var(--line-soft)" }}>
        <div style={{ display: "flex", gap: 5 }}>{["#E28300", "#FFC061", "#C5D2BD"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}</div>
        <span className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginLeft: 8 }}>app.setnayan.com</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, marginTop: 16, textAlign: "left" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {["Overview","Guest list","Vendors","Schedule","Invitations","Payments"].map((l, i) => (
            <div key={l} style={{ padding: "6px 10px", fontSize: 12, color: i === 0 ? "var(--orange-2)" : "var(--slate)", background: i === 0 ? "var(--orange-4)" : "transparent", borderRadius: 6 }}>{l}</div>
          ))}
        </div>
        <div style={{ background: "var(--ivory)", borderRadius: 10, padding: 18 }}>
          <div className="label-mono">Today's focus</div>
          <div className="display" style={{ fontSize: 26, marginTop: 6 }}>Send 47 invites</div>
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V06 · Filipino Native
const V06_FilipinoNative = () => (
  <div style={{ width: "100%", height: "100%", padding: "0", display: "grid", gridTemplateColumns: "1.1fr 1fr", position: "relative", overflow: "hidden", background: "#EFE6D2" }}>
    {/* Capiz tile pattern bg */}
    <div aria-hidden style={{
      position: "absolute", inset: 0, opacity: 0.4,
      backgroundImage: `
        radial-gradient(circle at 20px 20px, #E2D9C6 1.5px, transparent 2px),
        radial-gradient(circle at 60px 60px, #E2D9C6 1.5px, transparent 2px)`,
      backgroundSize: "80px 80px",
    }} />
    <div style={{ padding: "80px 64px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--slate-2)" }}>SET NA ‘YAN · /sɛt na jan/</div>
      <h1 className="serif" style={{ fontSize: 104, lineHeight: 1.0, margin: "12px 0 0", color: "var(--ink)", letterSpacing: "-0.025em" }}>
        Set na ‘yan.
      </h1>
      <div className="display" style={{ fontSize: 24, color: "var(--orange-2)", marginTop: 14 }}>
        Filipino weddings, in Filipino time.
      </div>
      <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.6, marginTop: 22, maxWidth: 480 }}>
        Built in Quezon City for couples planning Filipino weddings — Tagalog, Cebuano, Ilonggo. Mahabang kasal, ayos.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button className="btn btn-orange btn-lg">Simulan na</button>
        <button className="btn btn-ghost btn-lg">For vendors →</button>
      </div>
    </div>
    <div style={{ position: "relative", padding: 48 }}>
      <div className="photo-placeholder" style={{ width: "100%", height: "100%", borderRadius: 0, border: "8px solid var(--orange)" }}>
        <span className="pp-label">portrait · couple · capiz framed</span>
      </div>
      {/* sampaguita corners */}
      {[
        { t: 24, l: 24 }, { t: 24, r: 24 }, { b: 24, l: 24 }, { b: 24, r: 24 },
      ].map((p, i) => (
        <div key={i} style={{ position: "absolute", top: p.t, bottom: p.b, left: p.l, right: p.r, color: "var(--orange)", fontSize: 24 }}>✻</div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V07 · Pastel Romantic
const V07_PastelRomantic = () => (
  <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg, #FBF1ED 0%, #F6E0D5 100%)", padding: "80px 64px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden" }}>
    {/* Ribbon flourish SVG */}
    <svg width="200" height="40" viewBox="0 0 200 40" style={{ marginBottom: 16 }}>
      <path d="M0 20 Q50 0 100 20 T200 20" stroke="var(--orange)" strokeWidth="2" fill="none" />
      <circle cx="100" cy="20" r="3" fill="var(--orange)" />
    </svg>
    <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--slate-2)" }}>EST · QUEZON CITY · MMXXVI</div>
    <h1 className="serif" style={{ fontSize: 112, lineHeight: 1.0, margin: "20px 0 12px", color: "var(--blush-deep)", letterSpacing: "-0.025em", fontStyle: "italic" }}>
      Setnayan.
    </h1>
    <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--slate)", maxWidth: 580, lineHeight: 1.5, fontStyle: "italic" }}>
      A quiet operating tool for the loudest day of your life.
    </div>
    <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
      <button className="btn btn-primary btn-lg" style={{ background: "var(--blush-deep)" }}>Start planning</button>
      <button className="btn btn-ghost btn-lg">Browse vendors</button>
    </div>
    <div style={{ marginTop: 36, display: "flex", gap: 32 }}>
      {["Free forever", "BIR-compliant", "Filipino-built"].map(t => (
        <div key={t} className="mono" style={{ fontSize: 11, color: "var(--blush-deep)", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--blush-deep)" }} />
          {t}
        </div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V08 · Asymmetric Editorial · newspaper
const V08_AsymmetricEditorial = () => (
  <div style={{ width: "100%", height: "100%", background: "var(--paper)", padding: "32px 48px", display: "flex", flexDirection: "column" }}>
    <div style={{ borderTop: "2px solid var(--ink)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, borderBottom: "1px solid var(--ink)", paddingBottom: 10 }}>
      <LogoFull height={26} />
      <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        VOL. I · NO. 084 · TUESDAY, 26 MAY 2026 · QUEZON CITY
      </span>
      <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>Free · 8 sections</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr", gap: 28, flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <span className="label-mono">Lead story · 26 May</span>
          <h1 className="serif" style={{ fontSize: 80, lineHeight: 1.0, marginTop: 10, letterSpacing: "-0.025em", color: "var(--ink)" }}>
            How 1,840 Filipino couples are <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>planning their wedding</em> from one app.
          </h1>
          <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6, marginTop: 16, columnCount: 2, columnGap: 22, columnRule: "1px solid var(--line)" }}>
            Eighty-four weddings have shipped through Setnayan since the platform's
            launch. Four hundred and twelve vendors are now verified, with another
            sixty-four in the queue. The wedding industry — long fragmented across
            DMs, spreadsheets, and barangay group chats — is starting to consolidate
            in a single Filipino-built tool.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button className="btn btn-primary btn-lg">Start planning yours →</button>
          <button className="btn btn-ghost btn-lg">Read the feature</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="photo-placeholder" style={{ height: 280, borderRadius: 2 }}>
          <span className="pp-label">photo · maria + lola · QC</span>
        </div>
        <div>
          <span className="label-mono">By the numbers</span>
          {[["412", "verified vendors"], ["1,840", "active couples"], ["84", "weddings shipped"]].map(([v, k]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line-soft)", padding: "6px 0" }}>
              <span className="display" style={{ fontSize: 18 }}>{v}</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--slate-2)", alignSelf: "center" }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderLeft: "1px solid var(--line)", paddingLeft: 22 }}>
        <div>
          <span className="label-mono" style={{ color: "var(--orange-2)" }}>Opinion · From the founder</span>
          <p className="serif" style={{ fontSize: 18, fontStyle: "italic", lineHeight: 1.5, color: "var(--ink)", marginTop: 10 }}>
            "We bet on Filipino weddings because we couldn't find a tool we wanted to use at our own."
          </p>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            — Migs B., co-founder
          </div>
        </div>
        <div style={{ padding: 14, background: "var(--ivory)", borderRadius: 4 }}>
          <span className="label-mono">Weather · Quezon City</span>
          <div className="display" style={{ fontSize: 24, marginTop: 4 }}>28°C · Fair</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>perfect tasting weather</div>
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V09 · Marketplace First · search is hero
const V09_MarketplaceFirst = () => (
  <div style={{ width: "100%", height: "100%", background: "var(--paper)", padding: "56px 64px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
    <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--slate-2)" }}>SETNAYAN · 412 VERIFIED VENDORS · 84 WEDDINGS</div>
    <h1 className="display" style={{ fontSize: 64, lineHeight: 1.02, margin: "20px 0 32px", maxWidth: 980 }}>
      What kind of wedding <span style={{ color: "var(--orange)" }}>are you planning?</span>
    </h1>
    {/* Big search */}
    <div style={{ width: 720, padding: "18px 24px", background: "var(--paper-2)", border: "2px solid var(--ink)", borderRadius: 999, display: "flex", alignItems: "center", gap: 16, boxShadow: "var(--shadow-md)" }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="9" cy="9" r="6" stroke="var(--ink)" strokeWidth="2" />
        <path d="M13.5 13.5L17 17" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input placeholder="Try “garden wedding in Tagaytay for 150 guests in December”…" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 17, color: "var(--ink)" }} />
      <button className="btn btn-orange" style={{ padding: "10px 20px", fontSize: 13 }}>Search</button>
    </div>
    {/* Suggestion chips */}
    <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
      {["Catering · Manila", "Photographer · Tagaytay", "Garden venue · Cebu", "Florals · Sampaguita", "Coordinator · Davao"].map(s => (
        <span key={s} className="pill" style={{ background: "var(--paper-2)", fontSize: 12 }}>{s}</span>
      ))}
    </div>
    {/* Mini vendor row */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 36, width: 920 }}>
      {[
        { n: "Ato Catering", h: 80 },
        { n: "Studio Sereno", h: 200 },
        { n: "Bloom & Co.", h: 25 },
        { n: "La Castellana", h: 140 },
      ].map(v => (
        <div key={v.n} className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 80, background: `linear-gradient(135deg, oklch(75% 0.10 ${v.h}), oklch(88% 0.05 ${(v.h + 40) % 360}))` }} />
          <div style={{ padding: 10, fontSize: 12, color: "var(--ink)", textAlign: "left" }}>{v.n}</div>
        </div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// V10 · Story Chapter · narrative
const V10_StoryChapter = () => (
  <div style={{ width: "100%", height: "100%", background: "var(--paper)", padding: "80px 64px", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 80 }}>
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <LogoFull height={28} />
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", letterSpacing: "0.12em", marginTop: 32 }}>Chapter 01 · The first message</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.12em", marginTop: 4 }}>11:42 pm · a Tuesday in May</div>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)" }}>
        Read on · Chapter 02 → "Sino mag-pa-print ng QR?"
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.3, margin: 0, color: "var(--ink)", fontWeight: 400, letterSpacing: "-0.015em" }}>
        It started with one message in the family group chat. <em style={{ fontStyle: "italic", color: "var(--slate-2)" }}>"Anak,"</em> she wrote, <em style={{ fontStyle: "italic", color: "var(--slate-2)" }}>"sino magpa-print ng invitations?"</em>
      </h1>
      <h2 className="serif" style={{ fontSize: 32, lineHeight: 1.4, marginTop: 28, color: "var(--ink)", fontStyle: "italic", fontWeight: 400 }}>
        By morning the chat had 47 messages, three argument threads, and a Pinterest board nobody asked for.
      </h2>
      <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.7, marginTop: 28, maxWidth: 540 }}>
        That's how most Filipino weddings begin. <strong style={{ color: "var(--orange-2)", fontWeight: 500 }}>This is the tool that ends it</strong> — and gets you to the part where you actually get married.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
        <button className="btn btn-primary btn-lg">Begin yours →</button>
        <button className="btn btn-ghost btn-lg">Skip to Chapter 12 · the wedding</button>
      </div>
    </div>
  </div>
);

Object.assign(window, { HeroVariations });
