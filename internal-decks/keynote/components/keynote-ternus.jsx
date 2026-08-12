// The Ternus Keynote — engineering walkthrough of Setnayan.
// Voice: confident, conversational, stat-driven. "Let me walk you through how
// this works." Each chapter: challenge → solution → numbers → why it matters.

if (typeof SETNAYAN_DATA !== "undefined" && SETNAYAN_DATA.event) {
  Object.assign(SETNAYAN_DATA.event, {
    couple:    "Maria & Juan",
    date:      "12 · 12 · 2026",
    dateShort: "Dec 12, 2026",
    daysOut:   207,
  });
}

// ─── Nav ────────────────────────────────────────────────────────────────────
const TernusNav = () => (
  <nav style={{
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
    padding: "18px 40px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "rgba(31, 26, 23, 0.92)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    color: "var(--paper)",
  }}>
    <a href="Setnayan Site (Jobs+Ive).html" style={{ textDecoration: "none", color: "var(--paper)", display: "flex", alignItems: "center", gap: 12 }}>
      <LogoMark size={26} />
      <span className="mono" style={{ fontSize: 12, letterSpacing: "0.16em", color: "var(--paper)" }}>SETNAYAN</span>
    </a>
    <div style={{ display: "flex", gap: 28, fontSize: 12, fontFamily: "var(--mono)", color: "var(--slate-4)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
      <span>Engineering walkthrough · v1</span>
      <a href="Setnayan Site (Jobs+Ive).html" style={{ color: "var(--orange-3)", textDecoration: "none" }}>← Home</a>
    </div>
  </nav>
);

// ─── Chapter wrapper ────────────────────────────────────────────────────────
const TChapter = ({ num, total = 13, eyebrow, dark = false, children, style = {} }) => (
  <section style={{
    minHeight: "100vh",
    padding: "140px 96px 100px",
    background: dark ? "var(--ink)" : "var(--paper)",
    color:      dark ? "var(--paper)" : "var(--ink)",
    display: "flex", flexDirection: "column", justifyContent: "center",
    position: "relative",
    ...style,
  }}>
    <div style={{ width: "100%" }}>
      {children}
    </div>
  </section>
);

// ─── Stat callouts ──────────────────────────────────────────────────────────
const StatRow = ({ stats, dark = false }) => (
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

// Display headline helper
const TH1 = ({ children, color = "var(--ink)", size = 76, sub = null }) => (
  <h2 style={{
    fontFamily: "var(--display)", fontWeight: 800,
    fontSize: size, lineHeight: 1.04, letterSpacing: "-0.025em",
    color, margin: 0, textTransform: "uppercase",
  }}>{children}{sub && <span style={{ display: "block", fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: Math.round(size * 0.55), textTransform: "none", color: color === "var(--paper)" ? "var(--orange-3)" : "var(--orange-2)", marginTop: 12, letterSpacing: "-0.02em" }}>{sub}</span>}</h2>
);

const TBody = ({ children, dark = false, max = 760 }) => (
  <p style={{
    fontSize: 18, lineHeight: 1.65, marginTop: 28, maxWidth: max,
    color: dark ? "var(--slate-4)" : "var(--slate)",
    fontFamily: "var(--sans)",
  }}>
    {children}
  </p>
);

// ─── 01 · Welcome ───────────────────────────────────────────────────────────
const T01 = () => (
  <TChapter num={1} eyebrow="Welcome">
    <Reveal>
      <TH1 size={108} sub="Set na 'yan. The Filipino wedding platform you've been waiting for.">
        YOUR WHOLE<br />WEDDING.<br />ONE APP.
      </TH1>
    </Reveal>
    <Reveal delay={400}>
      <TBody max={820}>
        There&apos;s a lot here. We&apos;ll go through it together — the architecture,
        the engineering choices, the numbers behind each decision. By the end, you&apos;ll
        understand why no one else has shipped this, and why it had to be us.
      </TBody>
    </Reveal>
  </TChapter>
);

// ─── 02 · The problem space ─────────────────────────────────────────────────
const T02 = () => (
  <TChapter num={2} eyebrow="The problem space">
    <Reveal>
      <TH1 size={88} sub="And the entire industry runs on Messenger and Google Sheets.">
        HALF A MILLION<br />WEDDINGS A YEAR.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody>
        The Philippines is the third-largest wedding market in Asia. It is also the only major
        wedding market in the world where there is <strong style={{ color: "var(--ink)" }}>no
        integrated platform.</strong> Every couple stitches together ~25 apps. Every vendor stitches
        together ~20 tools. Neither side talks to the other. We had to design around this from
        scratch.
      </TBody>
    </Reveal>
    <Reveal delay={600}>
      <StatRow stats={[
        { label: "PH weddings / year", value: "≈500K",     hint: "~₱500K–3M each" },
        { label: "Apps per couple",     value: "25",        hint: "before Setnayan" },
        { label: "Apps per vendor",     value: "20+",       hint: "+ ₱18K / year in subs" },
        { label: "Integrated platforms",value: "0",         hint: "until us" },
      ]} />
    </Reveal>
  </TChapter>
);

// ─── 03 · The architecture ─────────────────────────────────────────────────
const T03 = () => (
  <TChapter num={3} eyebrow="The architecture" dark>
    <Reveal>
      <TH1 color="var(--paper)" size={88} sub="One platform sitting between them — plus AI and ops on top.">
        THREE SIDES.<br />ONE PLATFORM.
      </TH1>
    </Reveal>
    <div style={{ marginTop: 60, padding: "32px", background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
      <Reveal delay={300}>
        <SetnayanArchitecture />
      </Reveal>
    </div>
    <Reveal delay={700}>
      <TBody dark max={900}>
        At the center sits the marketplace + planning engine — verification, AI proposal drafting,
        Today&apos;s Focus, calendar. AI runs above it. A 4-person ops team in Quezon City runs the
        trust layer (verification, vendor onboarding, content team). Every interaction is captured
        by this engine — that&apos;s what lets us guarantee outcomes.
      </TBody>
    </Reveal>
  </TChapter>
);

// System diagram — three columns (Couples · Engine · Vendors), AI on top, Ops below
const SetnayanArchitecture = () => (
  <svg viewBox="0 0 1000 420" style={{ width: "100%", height: "auto", display: "block" }}>
    <defs>
      <linearGradient id="aiglow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--orange-3)" stopOpacity="0.5" />
        <stop offset="100%" stopColor="var(--orange)" stopOpacity="0.5" />
      </linearGradient>
    </defs>
    {/* AI layer (top) */}
    <rect x="80" y="20" width="840" height="56" fill="rgba(255,255,255,0.04)" stroke="var(--orange-3)" strokeOpacity="0.5" rx="12" />
    <text x="500" y="55" textAnchor="middle" fill="var(--orange-3)" fontFamily="var(--mono)" fontSize="14" letterSpacing="0.20em">✦ CLAUDE AI · VERIFICATION · PROPOSAL DRAFTING · TODAY'S FOCUS · PAKULAY</text>

    {/* Three pillars */}
    {[
      { x: 80,  label: "COUPLES",   sub: "1,840 accounts",   color: "var(--blush)" },
      { x: 380, label: "ENGINE",    sub: "Marketplace · Planning · Productions",  color: "var(--orange)" },
      { x: 720, label: "VENDORS",   sub: "412 verified",      color: "var(--sage)" },
    ].map((c, i) => (
      <g key={c.label}>
        <rect x={c.x} y="120" width={i === 1 ? "240" : "200"} height="180" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" rx="14" />
        <text x={c.x + (i === 1 ? 120 : 100)} y="160" textAnchor="middle" fill="var(--paper)" fontFamily="var(--display)" fontWeight="800" fontSize="22" letterSpacing="0.04em">{c.label}</text>
        <text x={c.x + (i === 1 ? 120 : 100)} y="186" textAnchor="middle" fill="var(--slate-4)" fontFamily="var(--mono)" fontSize="11" letterSpacing="0.08em">{c.sub}</text>
        {i === 1 && (
          <>
            <text x="500" y="230" textAnchor="middle" fill="var(--paper)" fontFamily="var(--sans)" fontSize="11">
              <tspan x="500" dy="0">0% commission</tspan>
              <tspan x="500" dy="18">vendor-to-couple direct</tspan>
              <tspan x="500" dy="18">first-party Productions</tspan>
              <tspan x="500" dy="18">tokens · referrals</tspan>
            </text>
          </>
        )}
        {i === 0 && (
          <>
            <text x="180" y="220" textAnchor="middle" fill="var(--slate-4)" fontFamily="var(--sans)" fontSize="11">
              <tspan x="180" dy="0">guest list · budget</tspan>
              <tspan x="180" dy="16">vendor search</tspan>
              <tspan x="180" dy="16">per-guest QR</tspan>
              <tspan x="180" dy="16">Papic capture</tspan>
            </text>
          </>
        )}
        {i === 2 && (
          <>
            <text x="820" y="220" textAnchor="middle" fill="var(--slate-4)" fontFamily="var(--sans)" fontSize="11">
              <tspan x="820" dy="0">profile · inbox</tspan>
              <tspan x="820" dy="16">pipeline · calendar</tspan>
              <tspan x="820" dy="16">payouts · BIR ORs</tspan>
              <tspan x="820" dy="16">crew rate</tspan>
            </text>
          </>
        )}
      </g>
    ))}

    {/* Connecting arrows */}
    <line x1="280" y1="210" x2="380" y2="210" stroke="var(--orange-3)" strokeWidth="1.5" />
    <line x1="620" y1="210" x2="720" y2="210" stroke="var(--orange-3)" strokeWidth="1.5" />
    <polygon points="380,210 372,205 372,215" fill="var(--orange-3)" />
    <polygon points="720,210 712,205 712,215" fill="var(--orange-3)" />
    <polygon points="280,210 288,205 288,215" fill="var(--orange-3)" />
    <polygon points="620,210 628,205 628,215" fill="var(--orange-3)" />

    {/* Ops layer (bottom) */}
    <rect x="80" y="340" width="840" height="56" fill="rgba(255,255,255,0.04)" stroke="var(--sage)" strokeOpacity="0.4" rx="12" />
    <text x="500" y="375" textAnchor="middle" fill="var(--sage)" fontFamily="var(--mono)" fontSize="14" letterSpacing="0.20em">★ OPS TEAM · QC HQ · VERIFICATION · ONBOARDING · CONTENT</text>
  </svg>
);

// ─── 04 · Deep dive 01 · Vendor verification ────────────────────────────────
const T04 = () => (
  <TChapter num={4} eyebrow="Deep dive 01 · Vendor verification">
    <Reveal>
      <TH1 size={80} sub="Every vendor we list, we vouch for. Here's how that scales.">
        WE WON'T<br />AUTO-APPROVE.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody>
        Vendors pay <strong style={{ color: "var(--ink)" }}>₱1,499 once</strong> to be verified —
        not <strong style={{ color: "var(--ink)" }}>₱299 every month forever</strong>, the way
        other platforms charge to stay listed. Claude reads their three documents (DTI, BIR,
        Mayor&apos;s permit), extracts the fields, and runs a cross-document plausibility check.
        It generates a manual gov-DB lookup checklist for our admin — every link prefilled with
        the vendor&apos;s data. A human signs off.
        <strong style={{ color: "var(--ink)" }}> No auto-approve, ever.</strong>
      </TBody>
    </Reveal>
    <Reveal delay={600}>
      <StatRow stats={[
        { label: "One-time fee",     value: "₱1,499",    hint: "vs ₱299/mo elsewhere" },
        { label: "Target SLA",       value: "24h",       hint: "current avg 18h" },
        { label: "Human-approved",   value: "100%",      hint: "founder policy" },
        { label: "Auto-approve",     value: "Never",     hint: "by design" },
      ]} />
    </Reveal>
    <Reveal delay={900}>
      <div style={{ marginTop: 40, padding: "22px 28px", background: "var(--paper-2)", borderRadius: 14, border: "1px solid var(--line-soft)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "center" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.18em", textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          ☆ Premium · on-site
        </div>
        <div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 26, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
            On-site verification + content package
          </div>
          <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6, marginTop: 8, marginBottom: 0, maxWidth: 820 }}>
            For vendors who want the full Setnayan treatment, our team visits their HQ in person,
            films the service in action, photographs the team, and produces a professional content
            package plus service documentation — theirs to use anywhere. Priced separately.
          </p>
        </div>
      </div>
    </Reveal>
  </TChapter>
);

// ─── 05 · Deep dive 02 · Setnayan Pay ──────────────────────────────────────
const T05 = () => (
  <TChapter num={5} eyebrow="Deep dive 02 · 0% commission" dark>
    <Reveal>
      <TH1 color="var(--paper)" size={80} sub="We don't sit between you and your vendors. We bring you to each other, and stay out of the way.">
        0% COMMISSION.<br />ON EVERY BOOKING.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody dark>
        Every vendor booking on Setnayan is between the vendor and the couple — directly.
        We don't process the payment, we don't take a cut, we don't see the money. The vendor
        keeps <strong style={{ color: "var(--paper)" }}>100%</strong> of what they list (minus their own
        EWT). The couple pays exactly what they see. Setnayan earns from subscriptions, tokens,
        and our own Productions services — not from your wedding budget.
      </TBody>
    </Reveal>

    <Reveal delay={600}>
      <StatRow dark stats={[
        { label: "Commission",          value: "0%",     hint: "every vendor booking" },
        { label: "Vendor keeps",        value: "100%",   hint: "minus their own EWT" },
        { label: "Couple surcharge",    value: "₱0",     hint: "ever" },
        { label: "Money through us",    value: "None",   hint: "vendor-to-couple direct" },
      ]} />
    </Reveal>
  </TChapter>
);

// ─── 06 · Deep dive 03 · Personal Website ──────────────────────────────────
const T06 = () => (
  <TChapter num={6} eyebrow="Deep dive 03 · The personal wedding website">
    <Reveal>
      <TH1 size={80} sub="Five phases. One URL. The site evolves on the calendar.">
        EVERY GUEST,<br />THEIR OWN DOOR.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody>
        Every guest gets a personal QR — pre-loaded with their name, plus-one, dietary, table,
        and a unique link. The site they land on knows who they are and what phase the event is
        in. <strong style={{ color: "var(--ink)" }}>Save-the-date → invitation → logistics →
        day-of → after.</strong> No app install. Camera access activates T−1 hour before the
        event. Photos buffer locally until the guest hits Send.
      </TBody>
    </Reveal>
    <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "auto 1fr", gap: 48, alignItems: "center" }}>
      <Reveal delay={500}>
        <PhoneMock />
      </Reveal>
      <Reveal delay={700}>
        <StatRow stats={[
          { label: "Phases",          value: "5",     hint: "auto-evolves on date" },
          { label: "App install",     value: "0",     hint: "web-first" },
          { label: "Per-guest data",  value: "9 fields", hint: "name, plus-one, etc." },
          { label: "Languages",       value: "1 → 3", hint: "EN today, TL+CEB Q1 2027" },
        ]} />
      </Reveal>
    </div>
  </TChapter>
);

// ─── 07 · Deep dive 04 · Papic ──────────────────────────────────────────────
const T07 = () => (
  <TChapter num={7} eyebrow="Deep dive 04 · Papic" dark>
    <Reveal>
      <TH1 color="var(--paper)" size={80} sub="Real-time tagging. Three coordinates per photo. No pile.">
        PHOTOS SORT<br />THEMSELVES.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody dark>
        When a guest opens Papic, they&apos;re already authenticated via their personal QR.
        Every photo they take is tagged with three coordinates in the moment it&apos;s captured:
        <strong style={{ color: "var(--paper)" }}> who took it, who&apos;s in it, where they were
        sitting.</strong> Untagged photos still land in the gallery. The couple wakes up the
        next morning and every photo is already in the right album. Compare this to the
        category-leading alternatives — they dump everything into one shared bucket.
      </TBody>
    </Reveal>

    {/* Tagging visual */}
    <div style={{ marginTop: 56, padding: 32, background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 32, alignItems: "center" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.16em", marginBottom: 10 }}>OTHER WEDDING APPS</div>
          <div style={{
            padding: 18, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.20)", borderRadius: 10,
            color: "var(--slate-4)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} style={{ aspectRatio: "1", background: "rgba(255,255,255,0.10)", borderRadius: 4 }} />
              ))}
            </div>
            <div className="mono" style={{ fontSize: 11, marginTop: 12, color: "var(--blush-deep)" }}>📁 SHARED FOLDER · 600 PHOTOS · UNSORTED</div>
          </div>
        </div>
        <div style={{ fontFamily: "var(--display)", fontSize: 32, color: "var(--orange-3)" }}>→</div>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.16em", marginBottom: 10 }}>PAPIC</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { tag: "TABLE 4 · TITA ANA",    n: 47 },
              { tag: "TABLE 7 · KUYA JM",     n: 31 },
              { tag: "BRIDE'S SIDE",          n: 88 },
              { tag: "FIRST DANCE",           n: 22 },
            ].map((b) => (
              <div key={b.tag} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8 }}>
                <div className="mono" style={{ fontSize: 9, color: "var(--orange-3)", letterSpacing: "0.10em" }}>{b.tag}</div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "var(--paper)", marginTop: 4 }}>{b.n}<span style={{ fontSize: 12, color: "var(--slate-4)" }}> photos</span></div>
              </div>
            ))}
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 12, color: "var(--sage)" }}>✓ AUTO-SORTED · TAGGED IN REAL TIME</div>
        </div>
      </div>
    </div>

    <Reveal delay={600}>
      <StatRow dark stats={[
        { label: "Tags per photo",    value: "3",      hint: "guest · subjects · table" },
        { label: "Sort latency",      value: "live",   hint: "as photo is captured" },
        { label: "Avg photos / wed",  value: "~600",   hint: "200 guests · 3 each" },
        { label: "Pile to sort",      value: "0",      hint: "by design" },
      ]} />
    </Reveal>
  </TChapter>
);

// ─── 08 · Deep dive 05 · Panood + Reel ─────────────────────────────────────
const T08 = () => (
  <TChapter num={8} eyebrow="Deep dive 05 · Panood + AI Reel">
    <Reveal>
      <TH1 size={80} sub="Five cameras. One broadcast. AI-cut reel before dinner ends.">
        THE WHOLE DAY<br />ON A FEED.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody>
        Panood gives the couple up to five cameras — broadcaster operates a single live mix to
        YouTube with a custom monogram and the chosen Broadcast Style Pack. Sub-5-second latency.
        After the ceremony, AI Highlight Reel pulls the best moments from Panood + Papic feeds,
        cuts a 90-second reel, delivers it to the couple before dinner ends. Optional content
        team (1–3 Setnayan personnel) attends for case-study documentation, disclosed to all
        vendors at booking.
      </TBody>
    </Reveal>
    <Reveal delay={600}>
      <StatRow stats={[
        { label: "Cameras",            value: "5",       hint: "Panood mix" },
        { label: "Stream latency",     value: "<5s",     hint: "1080p · YouTube" },
        { label: "Reel turnaround",    value: "≤30 min", hint: "after ceremony" },
        { label: "Content team",       value: "1–3",     hint: "optional · disclosed" },
      ]} />
    </Reveal>
  </TChapter>
);

// ─── 09 · The AI layer ─────────────────────────────────────────────────────
const T09 = () => (
  <TChapter num={9} eyebrow="The AI layer" dark>
    <Reveal>
      <TH1 color="var(--paper)" size={80} sub="Quiet copilots running in the background as you plan.">
        AI HELPS<br />YOU PLAN.
      </TH1>
    </Reveal>
    <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {[
        { tag: "PAKULAY",         title: "Mood-board sanity check", body: "Claude scans your mood board for contrast, cultural conflicts, and print-readiness issues before you spend a peso on printers." },
        { tag: "TODAY'S FOCUS",    title: "Your daily co-pilot",    body: "Surfaces the one decision that matters today based on upcoming milestones. Sends the email, prints the QR sheet, locks the count." },
        { tag: "AI HIGHLIGHT REEL", title: "Same-day wedding video",  body: "Cuts a 90-second highlight from Papic + Panood feeds before the reception ends. Goes to your socials before dessert." },
        { tag: "PAKANTA",          title: "Your wedding's song",     body: "AI composes a custom first-dance song from your vows + story. Cleared license, ready for the livestream and the highlight reel." },
      ].map((c, i) => (
        <Reveal key={c.tag} delay={i * 150}>
          <div style={{ padding: 26, background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", height: "100%" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.16em" }}>✦ {c.tag}</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 26, color: "var(--paper)", marginTop: 8, lineHeight: 1.1 }}>{c.title}</div>
            <p style={{ fontSize: 14, color: "var(--slate-4)", lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>{c.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
    <Reveal delay={700}>
      <StatRow dark stats={[
        { label: "Claude model",       value: "Haiku 4.5",  hint: "speed + cost" },
        { label: "Verification SLA",   value: "24h",        hint: "avg 18h" },
        { label: "Proposal drafts",    value: "≈30s",       hint: "from couple's brief" },
        { label: "Auto-approve",       value: "Never",      hint: "founder policy" },
      ]} />
    </Reveal>
  </TChapter>
);

// ─── 10 · The ops layer ────────────────────────────────────────────────────
const T10 = () => (
  <TChapter num={10} eyebrow="The ops layer">
    <Reveal>
      <TH1 size={80} sub="Four humans in Quezon City. Plus the founder couple.">
        REAL PEOPLE.<br />ON CALL.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody>
        Software can&apos;t fully automate the parts of a wedding platform that matter most. Our
        4-person ops team in Quezon City owns three of them: <strong style={{ color: "var(--ink)" }}>vendor
        verification</strong> (every DTI, BIR, and mayor&apos;s permit checked by hand — no auto-approve,
        ever), <strong style={{ color: "var(--ink)" }}>concierge couple-matching</strong> (we
        hand-pair complex weddings with the right verified vendors), and the{" "}
        <strong style={{ color: "var(--ink)" }}>content team</strong> (1–3 Setnayan personnel attend
        opt-in weddings to capture case-study material). Real humans, on call, who answer the
        phone.
      </TBody>
    </Reveal>
    <Reveal delay={600}>
      <StatRow stats={[
        { label: "Team size",          value: "4",        hint: "Quezon City HQ" },
        { label: "Verification SLA",   value: "24h",      hint: "avg 18h" },
        { label: "Auto-approve",       value: "Never",    hint: "founder policy" },
        { label: "Content team",       value: "1–3",      hint: "opt-in · disclosed" },
      ]} />
    </Reveal>
  </TChapter>
);

// ─── 11 · The proof — catastrophes averted ─────────────────────────────────
const T11 = () => {
  const vignettes = [
    {
      tag: "MARKETPLACE",
      before: "Maria & Juan didn&apos;t know who to trust for catering in Tagaytay.",
      after:  "Setnayan&apos;s verified caterer list narrowed it to three. They booked one in a week.",
    },
    {
      tag: "PANOOD",
      before: "Two hours before the ceremony, Lola's flight was canceled.",
      after:  "She watched the vows from Manila. The livestream was already booked.",
    },
    {
      tag: "PAPIC",
      before: "Saturday morning, the photographer's hard drive died.",
      after:  "Papic stitched the same-day edit from every guest's phone by dinner.",
    },
  ];
  return (
    <TChapter num={11} eyebrow="The proof — system in practice">
      <Reveal>
        <TH1 size={80} sub="This is what every chapter above looks like, joined together.">
          WHAT IT DOES<br />TO A WEDDING.
        </TH1>
      </Reveal>
      <div style={{ marginTop: 64, display: "flex", flexDirection: "column", gap: 28 }}>
        {vignettes.map((v, i) => (
          <Reveal key={i} delay={i * 200}>
            <div style={{ padding: 28, background: "var(--ink)", color: "var(--paper)", borderRadius: 14, display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.18em", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                ✦ {v.tag}
              </div>
              <div>
                <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 32, color: "var(--paper)", lineHeight: 1.3, margin: 0 }}>
                  {v.before}
                </p>
                <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 32, color: "var(--orange-3)", lineHeight: 1.3, margin: "20px 0 0" }}>
                  {v.after}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </TChapter>
  );
};

// ─── Pricing · transparency for customers (new) ─────────────────────
const T_PRICING = () => (
  <TChapter num={12} eyebrow="Transparent pricing" dark>
    <TH1 color="var(--paper)" size={80} sub="Everything you need to plan a wedding is free. The day-of services we make are pay-as-you-want.">
      WHAT&apos;S FREE.<br />WHAT&apos;S OPTIONAL.
    </TH1>
    <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* FREE column */}
      <div style={{ padding: 28, background: "var(--paper)", color: "var(--ink)", borderRadius: 14 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--sage-deep)", letterSpacing: "0.16em" }}>FREE · ALWAYS</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 36, color: "var(--ink)", marginTop: 4 }}>₱0</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "The planning hub (guest list · RSVP · budget · schedule)",
            "Personal wedding website + per-guest QR",
            "Pakulay mood-board with cultural sanity check",
            "Vendor marketplace browsing + shortlist",
            "Today's Focus couple-matching (we pair you up)",
            "0% commission on every vendor booking — vendor keeps 100%",
            "Reviews from real Setnayan couples",
            "Setnayan ops team on call",
          ].map((line) => (
            <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink)" }}>
              <span style={{ color: "var(--sage-deep)", fontFamily: "var(--mono)" }}>✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Setnayan Productions menu */}
      <div style={{ padding: 28, background: "var(--paper)", color: "var(--ink)", borderRadius: 14, border: "1px solid var(--orange-3)" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.16em" }}>☆ SETNAYAN PRODUCTIONS · PAY-PER-USE</div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 36, color: "var(--ink)", marginTop: 4 }}>à LA CARTE</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { name: "Pakulay · Mood board",            price: "FREE",          note: "included · cultural conflict catcher" },
            { name: "Invitation Widgets · Pro",        price: "from ₱1,500",   note: "premium themes, custom domain, audio" },
            { name: "Photo Delivery · full-res handoff", price: "from ₱3,500", note: "photographer&apos;s Drive → your gallery" },
            { name: "Pakanta · AI wedding song",        price: "from ₱4,500",   note: "royalty-free, cleared for stream + reel" },
            { name: "Pailaw · LED background loops",    price: "from ₱6,000",   note: "8K, USB-deliverable for offline" },
            { name: "Patiktok · vertical photo booth",  price: "from ₱6,500",   note: "30-sec clips, next-day compilation" },
            { name: "Papic · paparazzi app for guests", price: "from ₱8,000",   note: "real-time tagged photos, no app install" },
            { name: "AI Highlight Reel · same-day",     price: "from ₱12,000",  note: "90-sec edit before reception ends" },
            { name: "Panood · multi-cam livestream",    price: "from ₱18,000",  note: "4K · 5 cameras · broadcast style pack" },
            { name: "Supplies · vetted vendors",        price: "vendor-set",    note: "prints, rentals, decor · one invoice" },
          ].map((row) => (
            <div key={row.name} style={{ padding: "10px 12px", background: "var(--paper-2)", borderRadius: 8, border: "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{row.name}</span>
                <span className="mono" style={{ fontSize: 12, color: row.price === "FREE" ? "var(--sage-deep)" : "var(--orange-2)", fontWeight: 500 }}>{row.price}</span>
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4 }}>{row.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="mono" style={{ fontSize: 12, color: "var(--slate-4)", marginTop: 28, textAlign: "center", letterSpacing: "0.10em" }}>
      No subscription. No per-guest fee. You only pay for the day-of services you choose to add.
    </div>
  </TChapter>
);

// ─── PH · Built for Filipino weddings (new) ───────────────────────────
const T_PH = () => (
  <TChapter num={11} eyebrow="Built for the Philippines">
    <TH1 size={80} sub="Traditional ceremonies. Multi-event accounts. Your Tita's florist welcome.">
      BUILT FOR<br />FILIPINO WEDDINGS.
    </TH1>
    <TBody>
      Setnayan ships with the things a Filipino wedding actually needs — not a Western retrofit.
      Tea-ceremony, ancestor-altar, and double-happiness layouts are bundled. Your account opens
      debut, baptism, and anniversary surfaces with the same vendors and reviews already in place.
      And when Tita already has a florist, you can still bring her in.
    </TBody>
    <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px,46vw), 1fr))", gap: 14 }}>
      {[
        { tag: "TRADITIONS",     title: "Ceremony presets",         body: "Tea ceremony, ancestor altar, double-happiness layouts — bundled. Filipiniana attire, sampaguita styling, lechon math built into catering quotes." },
        { tag: "ONE ACCOUNT",    title: "Wedding → debut → forever",  body: "Your wedding account opens debut, baptism, anniversary, vow renewal. Same vendors, same reviews, same CRM follow you across every milestone." },
        { tag: "BRING YOUR OWN", title: "Tita's florist welcome",    body: "Got a vendor outside Setnayan? Send them a 14-day invite. They join free, lined up alongside our verified network. Off-platform bookings get an honest warning chip." },
        { tag: "SHORTLIST PULSE",title: "Your dates, on watch",      body: "When another couple shortlists the same vendor on your date, you both get a soft heads-up. Book before someone else does — or take your time and watch the pulse." },
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
  </TChapter>
);

// ─── 12 · Where we are today ───────────────────────────────────────────────
const T12 = () => (
  <TChapter num={12} eyebrow="Performance · where we are today">
    <Reveal>
      <TH1 size={80} sub="The pilot has not started yet. These numbers are honest.">
        DECEMBER 2026.<br />THE PILOT.
      </TH1>
    </Reveal>
    <Reveal delay={300}>
      <TBody>
        We are pre-launch. The numbers below are what the platform has today — every vendor
        hand-verified, every couple hand-onboarded. Apple shipped the first iPhone to 6M users
        in year one. Our year-one target is 600 weddings — about 0.12% of the Philippine market.
        At 1% market share, that&apos;s ₱2.5B in annual GMV. We have a year to find out if the
        thesis works.
      </TBody>
    </Reveal>
    <Reveal delay={600}>
      <StatRow stats={[
        { label: "Verified vendors",   value: "42",       hint: "hand-checked in QC" },
        { label: "Pilot couples",      value: "6",        hint: "all Dec 2026 → Q1 2027" },
        { label: "First wedding",      value: "Dec 18",   hint: "Claire & Ice · ours" },
        { label: "Y1 target",          value: "600",      hint: "weddings shipped" },
      ]} />
    </Reveal>
  </TChapter>
);

// ─── 13 · Availability ─────────────────────────────────────────────────────
const T13 = () => (
  <TChapter num={13} eyebrow="Availability" dark>
    <Reveal>
      <TH1 color="var(--paper)" size={108} sub="Apply to be next.">
        THE FIRST WEDDING<br />SHIPS DECEMBER 18.
      </TH1>
    </Reveal>
    <Reveal delay={500}>
      <div style={{ marginTop: 72, display: "flex", gap: 16, alignItems: "center" }}>
        <button className="btn btn-orange" style={{ padding: "18px 38px", fontSize: 16 }}>
          Apply to the pilot →
        </button>
        <a href="Setnayan Keynote.html" style={{ fontSize: 13, color: "var(--slate-4)", textDecoration: "none", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}>
          ▷ Watch the consumer keynote
        </a>
        <a href="Setnayan Site (Jobs+Ive).html" style={{ fontSize: 13, color: "var(--slate-4)", textDecoration: "none", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}>
          ↑ Back to home
        </a>
      </div>
    </Reveal>
  </TChapter>
);

// ─── At-a-glance collage · iPhone-12-style summary grid ──────────────────
const CTile = ({ tag, title, sub, tone = "paper" }) => {
  const tones = {
    paper:  { bg: "var(--paper)",    fg: "var(--ink)",   acc: "var(--orange-2)",   border: "1px solid var(--line-soft)" },
    blush:  { bg: "var(--blush)",    fg: "var(--ink)",   acc: "var(--blush-deep)", border: "none" },
    cream:  { bg: "var(--ivory)",    fg: "var(--ink)",   acc: "var(--orange-2)",   border: "1px solid var(--line-soft)" },
    sage:   { bg: "var(--sage)",     fg: "var(--ink)",   acc: "var(--sage-deep)",  border: "none" },
    ink:    { bg: "var(--ink)",      fg: "var(--paper)", acc: "var(--orange-3)",   border: "none" },
    orange: { bg: "var(--orange-4)", fg: "var(--ink)",   acc: "var(--orange-2)",   border: "none" },
  };
  const t = tones[tone] || tones.paper;
  return (
    <div style={{
      padding: "20px 22px",
      background: t.bg, color: t.fg, border: t.border,
      borderRadius: 14,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      minHeight: 150,
    }}>
      <div className="mono" style={{
        fontSize: 10, color: t.acc, letterSpacing: "0.16em", textTransform: "uppercase",
      }}>{tag}</div>
      <div>
        <div style={{
          fontFamily: "var(--display)", fontWeight: 800,
          fontSize: 26, lineHeight: 1.0, color: t.fg,
          textTransform: "uppercase", letterSpacing: "-0.005em",
        }}>{title}</div>
        <div style={{
          fontSize: 12, color: t.fg, opacity: 0.7,
          marginTop: 6, lineHeight: 1.45,
        }}>{sub}</div>
      </div>
    </div>
  );
};

const CHero = () => (
  <div style={{
    gridColumn: "2 / 4", gridRow: "2 / 4",
    padding: 32,
    background: "var(--ink)", color: "var(--paper)",
    borderRadius: 14, position: "relative", overflow: "hidden",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    textAlign: "center", gap: 12,
  }}>
    <div aria-hidden style={{
      position: "absolute", inset: "-80px -120px",
      background: "radial-gradient(circle, var(--orange) 0%, transparent 60%)",
      opacity: 0.18,
    }} />
    <div style={{ position: "relative" }}>
      <LogoMark size={84} />
      <div style={{
        fontFamily: "var(--display)", fontWeight: 800,
        fontSize: 56, color: "var(--paper)", textTransform: "uppercase",
        letterSpacing: "-0.02em", marginTop: 16,
      }}>SETNAYAN.</div>
      <div className="mono" style={{
        fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.20em",
        marginTop: 12, textTransform: "uppercase",
      }}>An operating system for weddings</div>
    </div>
  </div>
);

const SetnayanCollage = () => (
  <section style={{
    minHeight: "100vh", padding: "100px 56px 80px",
    background: "var(--ivory)",
    display: "flex", flexDirection: "column", justifyContent: "center",
  }}>
    <div style={{ maxWidth: 1400, margin: "0 auto 36px", textAlign: "center" }}>
      <div className="mono" style={{
        fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.22em",
        textTransform: "uppercase", marginBottom: 14,
      }}>At a glance</div>
      <h2 style={{
        fontFamily: "var(--display)", fontWeight: 800,
        fontSize: 72, lineHeight: 1.0, color: "var(--ink)",
        letterSpacing: "-0.025em", margin: 0, textTransform: "uppercase",
      }}>
        Twelve things<br />Setnayan does.
      </h2>
    </div>

    <div className="k-collage-grid" style={{
      maxWidth: 1400, margin: "0 auto", width: "100%",
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridAutoRows: "minmax(150px, auto)", gap: 12,
    }}>
      <CTile tone="blush"  tag="01 · Per-guest QR"  title="Every guest"     sub="lands on their own door." />
      <CTile tone="paper"  tag="02 · Papic"          title="Photos sort"     sub="themselves, in real time." />
      <CTile tone="orange" tag="03 · Panood"         title="5-cam 4K"        sub="livestream to YouTube." />
      <CTile tone="ink"    tag="04 · AI Reel"        title="Same-day"        sub="reel before dinner ends." />

      <CTile tone="sage"   tag="05 · Pakulay"        title="Mood-board"      sub="catches cultural conflicts." />
      <CHero />
      <CTile tone="paper"  tag="06 · Productions"     title="22 services"     sub="à-la-carte for the day." />

      <CTile tone="cream"  tag="07 · Verified"       title="192 cats"        sub="each one hand-checked." />
      <CTile tone="blush"  tag="08 · 0% commission"   title="₱0 cut"           sub="vendor keeps 100%." />

      <CTile tone="orange" tag="09 · Reviews"          title="Real verdicts"    sub="from real Setnayan couples." />
      <CTile tone="ink"    tag="10 · Today's Focus"       title="Hand-matched"     sub="couples to vendors." />
      <CTile tone="sage"   tag="11 · Microsite"      title="5 phases"        sub="auto-evolve on the date." />
      <CTile tone="paper"  tag="12 · Tokens"         title="₱180–₱250"       sub="vendor bidding currency." />
    </div>

    <div style={{ maxWidth: 1400, margin: "36px auto 0", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 60, height: 1, background: "var(--ink)" }} />
        <div className="mono" style={{
          fontSize: 12, color: "var(--ink)", letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          And it's all <span style={{ color: "var(--orange-2)" }}>in one app.</span>
        </div>
        <div style={{ width: 60, height: 1, background: "var(--ink)" }} />
      </div>
    </div>
  </section>
);

// ─── Slide-presentation wrapper · natural scroll + smooth bg cross-fade ──
// ─── Slide-presentation wrapper · standard scrollable page ─────────────────
// Effects/scrub/animation will be revisited later. For now: simple vertical
// scroll, each chapter a section with its own background.
const KeynoteSlides = ({ slides, slideBgs = [] }) => {
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
        ".k-slide{min-height:100vh;display:flex;align-items:stretch;position:relative;overflow:hidden;}" +
        ".k-slide > section{width:100%;min-height:100vh;display:flex;flex-direction:column;justify-content:center;" +
        "padding:clamp(72px,9vh,140px) clamp(20px,6vw,96px) clamp(48px,7vh,100px)!important;" +
        "box-sizing:border-box;background:transparent!important;}" +
        ".k-stat-grid{grid-template-columns:repeat(auto-fit,minmax(min(220px,42vw),1fr))!important;}" +
        ".k-collage-grid{grid-template-columns:repeat(4,1fr)!important;}" +
        "@media (max-width:780px),(orientation:portrait){" +
          ".k-slide > section{padding:64px 16px 48px!important;}" +
          ".k-slide > section h1,.k-slide > section h2{font-size:clamp(34px,9vw,64px)!important;line-height:1.04!important;}" +
          ".k-slide > section p{font-size:clamp(14px,3.6vw,18px)!important;}" +
        "}"
      }} />
      {slides.map((s, idx) => (
        <div key={idx} data-idx={idx} className="k-slide" style={{
          background: slideBgs[idx] || "var(--paper)",
        }}>
          {s}
        </div>
      ))}
    </>
  );
};

// ─── Compose ────────────────────────────────────────────────────────────────
// Background per slide — keeps .k-slide visually full-bleed (no cream margin)
// when the scaled section is letterboxed by --k-scale.
const SLIDE_BGS = [
  "var(--paper)",  // 01 Welcome
  "var(--ink)",    // 02 0% commission (T05)
  "var(--paper)",  // 03 Personal website (T06)
  "var(--ink)",    // 04 Papic (T07)
  "var(--paper)",  // 05 Panood + Reel (T08)
  "var(--ink)",    // 06 AI layer (T09, customer-only)
  "var(--paper)",  // 07 Ops layer (T10, customer reassurance)
  "var(--ivory)",  // 08 Built for Filipino weddings (T_PH)
  "var(--ink)",    // 09 Pricing transparency (T_PRICING)
  "var(--paper)",  // 10 Performance (T12)
  "var(--ivory)",  // 11 Collage
  "var(--ink)",    // 12 Availability (T13)
];

window.KeynoteTernus = function KeynoteTernus() {
  const slides = [
    <T01 key="1" />,
    <T05 key="5" />,  <T06 key="6" />,  <T07 key="7" />,  <T08 key="8" />,
    <T09 key="9" />,  <T10 key="10" />, <T_PH key="ph" />, <T_PRICING key="pricing" />, <T12 key="12" />,
    <SetnayanCollage key="collage" />,
    <T13 key="13" />,
  ];
  return (
    <>
      <TernusNav />
      <KeynoteSlides slides={slides} slideBgs={SLIDE_BGS} />
    </>
  );
};
