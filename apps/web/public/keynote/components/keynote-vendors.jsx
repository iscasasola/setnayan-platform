// Setnayan for Vendors — WWDC-style keynote
// Cinematic, presenter-rotation feel. Each chapter is one theme.
// Voice: confident, technical, "for builders" — like Apple speaking to devs.

// ─── Nav ────────────────────────────────────────────────────────────────────
const VKNav = () => (
  <nav style={{
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
    padding: "18px 40px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "rgba(31, 26, 23, 0.92)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    color: "var(--paper)",
  }}>
    <a href="Setnayan For Vendors.html" style={{ textDecoration: "none", color: "var(--paper)", display: "flex", alignItems: "center", gap: 12 }}>
      <LogoMark size={26} />
      <span className="mono" style={{ fontSize: 12, letterSpacing: "0.16em", color: "var(--paper)" }}>SETNAYAN · VENDORS</span>
    </a>
    <div style={{ display: "flex", gap: 28, fontSize: 12, fontFamily: "var(--mono)", color: "var(--slate-4)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
      <span>Vendor Keynote · 2026</span>
      <a href="Setnayan For Vendors.html" style={{ color: "var(--orange-3)", textDecoration: "none" }}>← For vendors</a>
    </div>
  </nav>
);

// ─── Chapter wrapper ───────────────────────────────────────────────────────
const VChapter = ({ presenter, dark = false, children, style = {} }) => (
  <section style={{
    minHeight: "100vh",
    padding: "140px 96px 100px",
    background: dark ? "var(--ink)" : "var(--paper)",
    color:      dark ? "var(--paper)" : "var(--ink)",
    display: "flex", flexDirection: "column", justifyContent: "center",
    position: "relative",
    ...style,
  }}>
    {presenter && (
      <div style={{
        position: "absolute", top: 96, left: 96,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: dark ? "var(--orange-3)" : "var(--orange)",
          color: dark ? "var(--ink)" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--display)", fontWeight: 800, fontSize: 16,
        }}>{presenter.initials}</div>
        <div>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: "0.16em",
            color: dark ? "var(--orange-3)" : "var(--orange-2)",
            textTransform: "uppercase",
          }}>{presenter.role}</div>
          <div style={{ fontSize: 14, color: dark ? "var(--paper)" : "var(--ink)", marginTop: 2 }}>
            {presenter.name}
          </div>
        </div>
      </div>
    )}
    <div style={{ width: "100%" }}>
      {children}
    </div>
  </section>
);

const VH1 = ({ children, color = "var(--ink)", size = 88, sub = null }) => (
  <h2 style={{
    fontFamily: "var(--display)", fontWeight: 800,
    fontSize: size, lineHeight: 1.04, letterSpacing: "-0.025em",
    color, margin: 0, textTransform: "uppercase",
  }}>{children}{sub && (
    <span style={{
      display: "block",
      fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
      fontSize: Math.round(size * 0.45),
      textTransform: "none",
      color: color === "var(--paper)" ? "var(--orange-3)" : "var(--orange-2)",
      marginTop: 14, letterSpacing: "-0.02em",
    }}>{sub}</span>
  )}</h2>
);

const VBody = ({ children, dark = false, max = 760 }) => (
  <p style={{
    fontSize: 18, lineHeight: 1.65, marginTop: 28, maxWidth: max,
    color: dark ? "var(--slate-4)" : "var(--slate)",
    fontFamily: "var(--sans)",
  }}>
    {children}
  </p>
);

const VStatRow = ({ stats, dark = false }) => (
  <div className="k-stat-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 14, marginTop: 40 }}>
    {stats.map((s, i) => (
      <div key={i} style={{
        padding: "20px 22px",
        background: dark ? "rgba(255,255,255,0.04)" : "var(--paper-2)",
        border: "1px solid " + (dark ? "rgba(255,255,255,0.08)" : "var(--line-soft)"),
        borderRadius: 12,
      }}>
        <div className="mono" style={{
          fontSize: 10, color: dark ? "var(--orange-3)" : "var(--orange-2)",
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}>{s.label}</div>
        <div style={{
          fontFamily: "var(--display)", fontWeight: 800, fontSize: 40,
          color: dark ? "var(--paper)" : "var(--ink)",
          lineHeight: 1.05, marginTop: 4, fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}>{s.value}</div>
        {s.hint && (
          <div className="mono" style={{
            fontSize: 11, color: dark ? "var(--slate-4)" : "var(--slate-2)",
            marginTop: 6,
          }}>{s.hint}</div>
        )}
      </div>
    ))}
  </div>
);

// ─── Presenters (rotation feel — different "speakers" introduce chapters) ──
const P = {
  ICE:   { initials: "IC", role: "Co-founder",          name: "Indalecio (Ice) Casasola II" },
  CLAIRE:{ initials: "CB", role: "Co-founder",          name: "Claire Buanhog" },
  MIGS:  { initials: "MB", role: "Head of Vendor Ops",  name: "Migs B." },
  ANA:   { initials: "AR", role: "Lead Engineer · Pay", name: "Ana R." },
  JOEY:  { initials: "JL", role: "Head of AI",         name: "Joey L." },
};

// ─── 01 · Welcome ──────────────────────────────────────────────────────────
const V01 = () => (
  <VChapter presenter={P.ICE} dark>
    <VH1 color="var(--paper)" size={120} sub="An ecosystem, not a listing. The platform Filipino vendors will be on in five years — and you can be early.">
      JOIN THE<br />WEDDING<br />OPERATING SYSTEM.
    </VH1>
    <VBody dark max={840}>
      Setnayan is becoming the default for Filipino weddings — and from there, every celebration
      that follows. You&apos;re being invited in early, while the seats at the table are still being
      set. <strong style={{ color: "var(--paper)" }}>Your business is the reason this works.
      We treat it that way.</strong> By the end of this keynote you&apos;ll understand the
      whole platform — how we bring couples to you, how the money flows, how the rules
      protect you, and why this is the ecosystem to be in before everyone else figures out
      they should be too.
    </VBody>
  </VChapter>
);

// ─── 02 · Platform overview ───────────────────────────────────────────────
const V02 = () => (
  <VChapter presenter={P.MIGS}>
    <VH1 size={92} sub="The vendor side of Setnayan, end-to-end.">
      ONE LOGIN.<br />FIVE SURFACES.
    </VH1>
    <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px,42vw), 1fr))", gap: 12 }}>
      {[
        { tag: "INBOX",     title: "Bid → Chat → Quote → Accept", body: "Couple requests a bid. You spend 1 token to accept. You chat, finalize the pricing together, customer accepts." },
        { tag: "CALENDAR",  title: "Schedules that scale", body: "Pro and Enterprise vendors can take multiple events per day. We keep your bookings, prep windows, and crew assignments in sync — so nothing slips between Saturday's ceremony and Sunday's reception." },
        { tag: "REPUTATION", title: "Reviews + verified badge", body: "Real Setnayan couples leave reviews on your profile. Your verified badge appears in every search and recommendation — the trust signal that gets you to the inquiry." },
        { tag: "PROFILE",   title: "Vendor microsite",     body: "Your portfolio, your packages, your exclusive perk. Search-optimized in the marketplace." },
        { tag: "INSIGHTS",  title: "Funnel + benchmarks",  body: "Views, inquiry rate, booking rate vs the median for your category. Know if you're priced right." },
      ].map((c) => (
        <div key={c.tag} className="card" style={{ padding: 22, height: "100%" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.16em" }}>{c.tag}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "var(--ink)", marginTop: 8, lineHeight: 1.15 }}>
            {c.title}
          </div>
          <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 10, lineHeight: 1.5, marginBottom: 0 }}>{c.body}</p>
        </div>
      ))}
    </div>
  </VChapter>
);

// ─── 03 · Setnayan Pay ────────────────────────────────────────────────────
const V03 = () => (
  <VChapter presenter={P.ANA} dark>
    <VH1 color="var(--paper)" size={92} sub="We bring you the couples. Everything they pay you stays with you. That's how much we value your business.">
      EVERY PESO<br />IS YOURS.
    </VH1>
    <VBody dark>
      Your business is the reason Setnayan exists — so we built it around one promise:
      <strong style={{ color: "var(--paper)" }}> every peso a couple pays you stays with you.</strong>{" "}
      We don't sit between you and your bookings. We don't process the payment. We don't take a cut.
      The money goes from the couple's hand to yours, on your terms, your books, your timing.
      Setnayan pays its bills with our own day-of services and the vendors who choose Pro —
      <strong style={{ color: "var(--paper)" }}> never with a percentage of your wedding work.</strong>{" "}
      We win when you grow, and we grow by being honest about how the math works.
    </VBody>
    <VStatRow dark stats={[
      { label: "Our cut",          value: "0%",     hint: "of every vendor booking" },
      { label: "You keep",         value: "100%",   hint: "of what the couple pays" },
      { label: "Couple surcharge", value: "₱0",     hint: "ever" },
      { label: "Money through us", value: "None",   hint: "vendor-to-couple, direct" },
    ]} />
  </VChapter>
);

// ─── 04 · Verification ────────────────────────────────────────────────────
const V04 = () => (
  <VChapter presenter={P.MIGS}>
    <VH1 size={84} sub="Verified once. No monthly listing fees. Ever.">
      ₱1,499 ONCE.<br />NOT ₱299/28D.
    </VH1>
    <VBody>
      One-time vendor verification fee — instead of the monthly listing subscriptions other
      platforms charge to stay visible. Our AI co-pilot reads your three documents (DTI, BIR,
      Mayor&apos;s permit), cross-checks the fields, and generates a gov-DB lookup checklist for
      our admin. A human signs off. <strong style={{ color: "var(--ink)" }}>No auto-approve, ever — every vendor
      we list, we vouch for.</strong> When your business documents change later, document updates
      cost <strong style={{ color: "var(--ink)" }}>₱499 per refresh</strong> — only when you need it.
      One-time, simple, and the cost is yours to control.
    </VBody>
    <VStatRow stats={[
      { label: "One-time fee",     value: "₱1,499",   hint: "vs ₱299/mo elsewhere" },
      { label: "Verification SLA", value: "24h",      hint: "current avg 18h" },
      { label: "Human-approved",   value: "100%",     hint: "founder policy" },
      { label: "Document updates", value: "₱499",   hint: "only when you change docs" },
    ]} />
    <div style={{ marginTop: 32, padding: "22px 28px", background: "var(--paper-2)", borderRadius: 14, border: "1px solid var(--line-soft)" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
        ☆ Premium · On-site verification + Content Package
      </div>
      <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6, margin: 0 }}>
        Want the full Setnayan treatment? Our team visits your HQ in person, films the service,
        photographs the team, and produces a professional content package + service documentation kit
        — yours to use anywhere. Priced separately.
      </p>
    </div>
  </VChapter>
);

// ─── 04b · What your subscription runs ──────────────────────────────────────────
const V_VALUE = () => (
  <VChapter presenter={P.ANA}>
    <VH1 size={84} sub="The infrastructure we run for you, every day.">
      WHAT YOUR<br />SUBSCRIPTION RUNS.
    </VH1>
    <VBody max={840}>
      Your verification fee + monthly subscription pay for everything Setnayan operates on your
      behalf — the work that used to be your weekly subscription stack, your accountant&apos;s
      extra hours, and the marketing budget you didn&apos;t have. Here&apos;s where it goes.
    </VBody>
    <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px,46vw), 1fr))", gap: 14 }}>
      {[
        { tag: "DATABASE",       title: "Bookings + history",     body: "Your couples, their guest lists, every proposal, every milestone payment. Encrypted, backed up, queryable from any device." },
        { tag: "FUNNELS + SEO",  title: "Couples come to you",     body: "Paid ads, organic search, content marketing, the marketplace itself. We bring the demand to your microsite." },
        { tag: "STORAGE",        title: "Photos + portfolios",     body: "Unlimited high-res portfolio shots, contracts, receipts, Papic feeds. CDN-cached so couples never wait for a load." },
        { tag: "REPUTATION",     title: "Reviews + verified badge", body: "The trust layer that gets you to the inquiry. Real reviews from real Setnayan couples; verified badge in every search result." },
        { tag: "APP",            title: "Maintained, updated",     body: "iOS + Android + web kept in sync. Security patches, new features, infrastructure scaling — you wake up to a better tool." },
        { tag: "PLATFORM SUPPORT", title: "We handle the app, you handle the work", body: "Couples and vendors get help with platform questions \u2014 payments, bookings, accounts, tech glitches. The expertise on your service stays with you, where it belongs." },
        { tag: "OPS TEAM",       title: "Verification + concierge", body: "The 4-person Quezon City team checks every DTI/BIR/permit by hand, runs the verified-badge SLA, and hand-pairs complex weddings with the right vendors." },
      ].map((c) => (
        <div key={c.tag} style={{ padding: 22, background: "var(--paper-2)", borderRadius: 12, border: "1px solid var(--line-soft)" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.16em" }}>{c.tag}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "var(--ink)", marginTop: 8, lineHeight: 1.15 }}>
            {c.title}
          </div>
          <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 10, lineHeight: 1.5, marginBottom: 0 }}>{c.body}</p>
        </div>
      ))}
    </div>
  </VChapter>
);

// ─── 04b · Rules that protect you (new) ─────────────────────────────
const V_RULES = () => (
  <VChapter presenter={P.MIGS}>
    <VH1 size={80} sub="We actively defend your work, not just host it.">
      RULES THAT<br />PROTECT YOU.
    </VH1>
    <VBody max={840}>
      A platform that lets vendors do whatever they want isn&apos;t a platform — it&apos;s a
      bulletin board. Setnayan enforces specific rules at the data layer so your work, your time,
      and your reputation stay protected from the inside out.
    </VBody>
    <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px,46vw), 1fr))", gap: 14 }}>
      {[
        { tag: "01 · CAPACITY",      title: "Daily booking cap",        body: "Set 1, 2, 3, or unlimited events per day. Past your cap, dates grey out for couples automatically. Burnout protection enforced by the system, not your willpower." },
        { tag: "02 · NO COLD-DM",    title: "Couple-initiated only",    body: "Vendors cannot DM cold. You only reply to threads couples start. Backend rejects vendor-first messages — your inbox stays clean, your couples stay un-spammed." },
        { tag: "03 · EXCLUSIVE PERK", title: "One offer just for us",    body: "Every vendor declares one Setnayan-customer-only perk (free upgrade, complimentary add-on). Surfaced in marketplace cards. Couples see exactly why they should book through us." },
        { tag: "04 · THEFT WATCH",    title: "We watch for stolen work", body: "Monthly reverse-image scans of your portfolio across the open web. If we find a copy of your shot somewhere else, you get the alert and the evidence." },
        { tag: "05 · WATCHLIST",      title: "Re-applied bans flagged",  body: "Banned vendors trying to re-apply under a new name get flagged via cross-document analysis. Your category stays clean, your couples stay safe." },
      ].map((c) => (
        <div key={c.tag} style={{ padding: 22, background: "var(--paper-2)", borderRadius: 12, border: "1px solid var(--line-soft)" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.16em" }}>{c.tag}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "var(--ink)", marginTop: 8, lineHeight: 1.15 }}>
            {c.title}
          </div>
          <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 10, lineHeight: 1.5, marginBottom: 0 }}>{c.body}</p>
        </div>
      ))}
    </div>
  </VChapter>
);

// ─── 05 · The Pro tier ────────────────────────────────────────────────────
const V05 = () => (
  <VChapter presenter={P.MIGS} dark>
    <VH1 color="var(--paper)" size={80} sub="Free vendor profile is plenty for most. Pro is for vendors who want the ecosystem.">
      FREE FOREVER.<br />PRO AT ₱1,999/28D.
    </VH1>
    <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div style={{ padding: 28, background: "var(--paper)", borderRadius: 14 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.16em" }}>FREE</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 36, color: "var(--ink)", marginTop: 4 }}>FREE</div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Vendor profile + microsite",
            "Pipeline + calendar",
            "In-app couple chat (couple-initiated)",
            "Reviews from real Setnayan couples",
            "Up to 3 service packages",
            "Buy bidding tokens to send quotes",
          ].map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink)" }}>
              <span style={{ color: "var(--sage-deep)" }}>✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 28, background: "var(--ink)", border: "1px solid var(--orange-3)", borderRadius: 14 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.16em" }}>★ PRO</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 36, color: "var(--paper)", marginTop: 4 }}>₱1,999<span style={{ fontSize: 16, color: "var(--slate-4)" }}>/28d</span></div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Everything in Free",
            "1 category · up to 5 team accounts",
            "Today's Focus matchmaking",
            "Boosted Ads + Sponsored Boost",
            "AI Proposal Builder",
            "Category benchmarks + demand pulse",
            "Crew-rate marketplace",
            "Co-listing with Setnayan Productions",
          ].map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--paper)" }}>
              <span style={{ color: "var(--orange-3)" }}>✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="mono" style={{ fontSize: 12, color: "var(--slate-4)", marginTop: 24, textAlign: "center", letterSpacing: "0.10em" }}>
      Verified vendors only · Enterprise at ₱5,499/28d for multi-category + unlimited team accounts · Founder bonus 100 tokens on verification (until 31 Jan 2027)
    </div>
  </VChapter>
);

// ─── Pricing · free baseline vs pay-on-demand (new) ────────────────────
const V_PRICING = () => (
  <VChapter presenter={P.ANA} dark>
    <VH1 color="var(--paper)" size={80} sub="Everything you need is free. A handful of add-ons are pay-on-demand.">
      PRICING.<br />FAIR AND SIMPLE.
    </VH1>
    <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* FREE column */}
      <div style={{ padding: 28, background: "var(--paper)", color: "var(--ink)", borderRadius: 14 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--sage-deep)", letterSpacing: "0.16em" }}>FREE · ALWAYS</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 36, color: "var(--ink)", marginTop: 4 }}>FREE</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "Vendor profile + microsite",
            "In-app chat (couple-initiated)",
            "Pipeline · calendar · daily-capacity cap",
            "0% commission on every vendor booking",
            "Reviews from real Setnayan couples",
            "Marketing across FB · IG · TikTok",
            "Today's Focus matching",
            "Boost radius 20km baseline",
            "Direct-line listing on your profile",
            "Crew-rate marketplace participation",
            "Reverse-image theft monitoring",
            "Productions referral · earn 1 token per converted recommend",
          ].map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink)" }}>
              <span style={{ color: "var(--sage-deep)", fontFamily: "var(--mono)" }}>✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PAY-ON-DEMAND column */}
      <div style={{ padding: 28, background: "var(--paper)", color: "var(--ink)", borderRadius: 14, border: "1px solid var(--orange-3)" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.16em" }}>★ BOOSTERS · PAY-ON-DEMAND</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 36, color: "var(--ink)", marginTop: 4 }}>BOOSTERS</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { name: "Vendor verification",          price: "₱1,499 once",       note: "one-time · lifetime verified badge · prerequisite for Pro" },
            { name: "Document update",              price: "₱499",              note: "only when your business docs change" },
            { name: "Pro subscription",             price: "₱1,999/28 days",      note: "1 category · up to 5 team accounts" },
            { name: "Enterprise subscription",      price: "₱5,499/28 days",      note: "multi-category · unlimited team accounts" },
            { name: "Bidding token packs",          price: "₱1,000–₱18,000",     note: "4 / 10 / 25 / 50 / 100 packs · ₱180–₱250 per token" },
            { name: "On-site verification + content kit", price: "vendor-set range", note: "film crew + photos + service docs · Request bid" },
            { name: "Boosted Ads · to 30km radius",  price: "₱1,200/wk",         note: "Pro+ · pausable anytime" },
            { name: "Sponsored Boost · top of search", price: "by category",      note: "Pro+ · quarterly or annual" },
            { name: "Setnayan Productions · resell", price: "wholesale rates",   note: "Pro+ · resell Panood/Papic/etc. at your markup" },
          ].map((row) => (
            <div key={row.name} style={{ padding: "10px 12px", background: "var(--paper-2)", borderRadius: 8, border: "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{row.name}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--orange-2)", fontWeight: 500 }}>{row.price}</span>
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>{row.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="mono" style={{ fontSize: 12, color: "var(--slate-4)", marginTop: 28, textAlign: "center", letterSpacing: "0.10em" }}>
      0% commission on vendor bookings. Setnayan never touches the money between you and the couple.
    </div>
  </VChapter>
);

// ─── 06 · AI tools ─────────────────────────────────────────────────────────
const V06 = () => (
  <VChapter presenter={P.JOEY}>
    <VH1 size={84} sub="Claude reads briefs, drafts proposals, and learns your style.">
      AI THAT WORKS<br />ON YOUR SIDE.
    </VH1>
    <VBody>
      The same AI that ships in your phone now helps you respond to couples. When a couple
      submits a brief through your microsite, Claude drafts the proposal from past quotes
      plus the structured fields. You edit and send. Average response time drops from
      <strong style={{ color: "var(--ink)" }}> 2 days to 30 seconds.</strong>
    </VBody>
    <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px,46vw), 1fr))", gap: 14 }}>
      {[
        { tag: "✦ PROPOSAL BUILDER",  title: "Reply in seconds", body: "Claude drafts your response from the couple's brief + your past proposals. You edit and send." },
        { tag: "✦ INSIGHTS",          title: "Pricing benchmarks", body: "See where your prices sit vs the median for your category. Know if you're under-priced before you lose the deal." },
        { tag: "✦ DEMAND PULSE",      title: "What's trending",    body: "What couples are searching this week in your area. Pop-up demand surfaces in your dashboard." },
        { tag: "✦ THEFT WATCH",       title: "Portfolio protection",body: "We scan the web monthly for stolen versions of your portfolio. You get notified." },
      ].map((c) => (
        <div key={c.tag} style={{ padding: 22, background: "var(--paper-2)", borderRadius: 12, border: "1px solid var(--line-soft)" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.16em" }}>{c.tag}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "var(--ink)", marginTop: 8, lineHeight: 1.15 }}>
            {c.title}
          </div>
          <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 10, lineHeight: 1.5, marginBottom: 0 }}>{c.body}</p>
        </div>
      ))}
    </div>
  </VChapter>
);

// ─── 07 · Today's Focus + Boost ───────────────────────────────────────────────
const V07 = () => (
  <VChapter presenter={P.MIGS} dark>
    <VH1 color="var(--paper)" size={84} sub="The ops team brings couples to you. Boost expands your radius.">
      WE BRING THE<br />COUPLES TO YOU.
    </VH1>
    <VBody dark max={820}>
      <strong style={{ color: "var(--paper)" }}>Today's Focus</strong> hand-curates couple → vendor matches
      from briefs already in the platform. Not lead-gen ads — actual ops-team intros. <strong style={{ color: "var(--paper)" }}>Boosted
      Ads</strong> expand your visibility radius from 20km (your default) to 30km, pay-per-week,
      pausable anytime. And we run <strong style={{ color: "var(--paper)" }}>constant marketing across
      Facebook, Instagram, and TikTok</strong> — every couple our campaigns bring lands on Setnayan
      and can find your microsite. No effort on your side, no ad spend you have to fund.
      first-look on multi-event clients — when a couple plans a debut → wedding → anniversary
      on Setnayan, you get notified first.
    </VBody>
    <VStatRow dark stats={[
      { label: "Today's Focus",        value: "Hand-matched", hint: "ops-team intros" },
      { label: "Social channels",  value: "FB · IG · TikTok", hint: "constant boost on us" },
      { label: "Boost radius",     value: "20→30km",       hint: "₱1,200/wk" },
      { label: "Multi-event view", value: "First-look",    hint: "next event types" },
      { label: "ROI tracking",     value: "Built-in",      hint: "only on-platform conversions" },
    ]} />
  </VChapter>
);

// ─── 08 · Force-majeure + Crew Marketplace ────────────────────────────────
const V08 = () => (
  <VChapter presenter={P.MIGS}>
    <VH1 size={84} sub="We facilitate. You decide. Your contract stays yours.">
      THE NETWORK<br />HAS YOUR BACK.
    </VH1>
    <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px,46vw), 1fr))", gap: 14 }}>
      {[
        { tag: "CREW RATES",    title: "Earn from your team",    body: "Your service captains, photographers, AV crew can opt into Setnayan crew rates. You earn a cut on every gig your team picks up." },
        { tag: "WATCHLIST",     title: "Trust protection",       body: "We flag re-applied banned entities, suspicious pricing, off-platform solicitation. Your category stays clean." },
        { tag: "DIRECT LINE",   title: "Contact-number listing", body: "Add a phone number to your profile. Couples can call you directly when something needs to happen now — still routed through Setnayan so we know the conversation happened." },
      ].map((c) => (
        <div key={c.tag} style={{ padding: 22, background: "var(--paper-2)", borderRadius: 12, border: "1px solid var(--line-soft)" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.16em" }}>{c.tag}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "var(--ink)", marginTop: 8, lineHeight: 1.15 }}>
            {c.title}
          </div>
          <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 10, lineHeight: 1.5, marginBottom: 0 }}>{c.body}</p>
        </div>
      ))}
    </div>
  </VChapter>
);

// ─── 09 · Setnayan Productions co-listing ─────────────────────────────────
const V09 = () => (
  <VChapter presenter={P.CLAIRE} dark>
    <VH1 color="var(--paper)" size={84} sub="When couples bundle, you're in the bundle.">
      CO-LISTED WITH<br />SETNAYAN PRODUCTIONS.
    </VH1>
    <VBody dark max={840}>
      Setnayan Productions runs Panood (multi-cam livestream), Papic (guest paparazzi app),
      AI Highlight Reel, Pailaw (LED loops), and Pakanta (AI wedding song). These show up in
      every couple&apos;s bundle recommendation. <strong style={{ color: "var(--paper)" }}>Pro vendors get co-listed alongside them.</strong>
      Your service becomes part of the recommended package, not a separate booking the couple has to remember.
    </VBody>
    <div style={{ marginTop: 40, padding: 28, background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
        Apply to operate Setnayan Productions services
      </div>
      <p style={{ fontSize: 15, color: "var(--slate-4)", lineHeight: 1.6, margin: 0 }}>
        Videographers, photographers, and broadcasters can apply to the e-prod roster.
        Approved operators run Panood gigs, Papic crew leads, AI Reel deliveries — paid per
        gig at the platform rate. Equipment ledger and scheduling handled by ops.
      </p>
    </div>

    <div style={{ marginTop: 16, padding: 28, background: "var(--orange-4)", color: "var(--ink)", borderRadius: 14 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
        ✦ Resell our services in your packages
      </div>
      <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.6, margin: 0 }}>
        Vendors can purchase Setnayan Productions services (Panood, Papic, AI Reel, Pailaw,
        Pakanta) at the platform rate and resell them as part of their own package.
        Bundle a livestream into your venue deal, a same-day reel into your photography contract,
        a custom song into your coordination plan — <strong style={{ color: "var(--ink)" }}>you keep the markup, we deliver the service.</strong>
      </p>
    </div>
  </VChapter>
);

// ─── 10 · How to start ────────────────────────────────────────────────────
const V10 = () => (
  <VChapter presenter={P.ICE} style={{ background: "var(--ivory)" }}>
    <VH1 size={104} sub="A safe haven for your expertise. A central hub for your hardwork. And a wedding software designed, from day one, to be searchable.">
      OUR PROMISE<br />TO YOU.
    </VH1>
    <VBody max={860}>
      We&apos;re building Setnayan because Filipino wedding vendors deserve better than
      Messenger and Google Sheets. Our promise is simple: we&apos;ll fight for your business
      like it&apos;s our own — because in a year, one of those weddings will be ours.
    </VBody>
    <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px,46vw), 1fr))", gap: 14 }}>
      {[
        { tag: "01", title: "Almost everything is free",   body: "Profile, pipeline, calendar, in-app chat, verified badge, real reviews, marketing reach — all included. Only a handful of premium services (on-site verification, content package) are pay-on-demand." },
        { tag: "02", title: "0% commission, always",        body: "Couples pay you directly. Setnayan doesn't middleman the contract, doesn't see the money, doesn't take a cut. Vendor keeps 100%." },
        { tag: "03", title: "We bring couples to you",         body: "Today's Focus matching, boosted reach, SEO funnels, paid acquisition — the marketing budget you didn&apos;t have, we run on your behalf." },
        { tag: "04", title: "We connect, you contract",  body: "Your agreement with the couple is yours. We connect you, host the conversation, surface backup options if a partner falls through — the delivery and the contract stay between you and them." },
        { tag: "05", title: "You set the price, we follow",    body: "No platform pricing pressure. Want premium, go premium. Want budget, list budget. Your category, your call." },
        { tag: "06", title: "The founder couple is here",       body: "Claire and Ice are getting married through this app in December 2026. If it&apos;s good enough for our wedding, it&apos;s good enough for yours." },
        { tag: "07", title: "The platform that will be everywhere", body: "Wedding today. Debut, baptism, anniversary, vow renewal next. Setnayan is becoming a staple of every Filipino life — and you&apos;re early enough to grow with it, not catch up to it." },
        { tag: "08", title: "A safe haven for your expertise",      body: "Your craft, your portfolio, your reputation — protected, defended, and elevated. Verified badge, theft watch, watchlist, exclusive perk — all working in the background so your work stays your work." },
        { tag: "09", title: "Built to be searchable",                  body: "Every Setnayan wedding feeds the search index. Every editorial tags every vendor who showed up. Every couple landing on the app is one search away from finding you. Discoverability isn&apos;t a paid add-on — it&apos;s the architecture." },
      ].map((c) => (
        <div key={c.tag} style={{ padding: 22, background: "var(--paper)", border: "1px solid var(--line-soft)", borderRadius: 12 }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 32, color: "var(--orange-2)", lineHeight: 1 }}>{c.tag}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 20, color: "var(--ink)", marginTop: 10, lineHeight: 1.15, textTransform: "uppercase" }}>
            {c.title}
          </div>
          <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>{c.body}</p>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 40, display: "flex", gap: 14, flexWrap: "wrap" }}>
      <button className="btn btn-primary" style={{ padding: "18px 38px", fontSize: 16 }}>
        Pre-register · lock founder-vendor badge →
      </button>
      <a href="Setnayan For Vendors.html" style={{
        display: "inline-flex", alignItems: "center", padding: "18px 24px",
        fontSize: 13, color: "var(--slate)", fontFamily: "var(--mono)",
        letterSpacing: "0.08em", textDecoration: "none", textTransform: "uppercase",
      }}>
        ← Back to /for-vendors
      </a>
    </div>
  </VChapter>
);

// ─── Footer ─────────────────────────────────────────────────────────────────
const VKFooter = () => (
  <footer style={{
    padding: "40px 56px", borderTop: "1px solid var(--line-soft)",
    background: "var(--paper)",
    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
  }}>
    <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", letterSpacing: "0.10em" }}>
      © SETNAYAN 2026 · QUEZON CITY · VENDOR KEYNOTE · v1
    </div>
    <a href="Setnayan For Vendors.html" style={{ fontSize: 12, color: "var(--slate-2)", textDecoration: "none" }}>
      ← Back to /for-vendors
    </a>
  </footer>
);

// ─── Compose ────────────────────────────────────────────────────────────────
const VK_BGS = [
  "var(--ink)",    // 01 Welcome
  "var(--paper)",  // 02 Platform overview
  "var(--ink)",    // 03 0% commission
  "var(--ivory)",  // 04 What your subscription runs
  "var(--paper)",  // 05 Rules that protect you
  "var(--ink)",    // 06 Today's Focus + Boost
  "var(--paper)",  // 07 Network has your back
  "var(--ink)",    // 08 Productions
  "var(--ink)",    // 09 Pricing
  "var(--ivory)",  // 10 Our promise
];

const VK_SLIDES = [
  <V01 key="1" />, <V02 key="2" />, <V03 key="3" />,
  <V_VALUE key="value" />,
  <V_RULES key="rules" />,
  <V07 key="7" />, <V08 key="8" />,
  <V09 key="9" />,
  <V_PRICING key="pricing" />,
  <V10 key="10" />,
];

// Reuse the simple-scroll wrapper pattern from KeynoteSlides — but localized.
window.VendorKeynote = function VendorKeynote() {
  React.useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
    document.body.style.margin = "0";
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html:
        "html,body{margin:0;overflow:auto;height:auto;}" +
        ".vk-slide{min-height:100vh;display:flex;align-items:stretch;position:relative;overflow:hidden;}" +
        ".vk-slide > section{width:100%;min-height:100vh;display:flex;flex-direction:column;justify-content:center;" +
        "padding:clamp(72px,9vh,140px) clamp(20px,6vw,96px) clamp(48px,7vh,100px)!important;" +
        "box-sizing:border-box;background:transparent!important;}" +
        ".k-stat-grid{grid-template-columns:repeat(auto-fit,minmax(min(220px,42vw),1fr))!important;}" +
        "@media (max-width:780px),(orientation:portrait){" +
          ".vk-slide > section{padding:64px 16px 48px!important;}" +
          ".vk-slide > section h1,.vk-slide > section h2{font-size:clamp(34px,9vw,64px)!important;line-height:1.04!important;}" +
          ".vk-slide > section p{font-size:clamp(14px,3.6vw,18px)!important;}" +
        "}"
      }} />
      <VKNav />
      {VK_SLIDES.map((s, idx) => (
        <div key={idx} className="vk-slide" style={{ background: VK_BGS[idx] || "var(--paper)" }}>
          {s}
        </div>
      ))}
      <VKFooter />
    </>
  );
};
