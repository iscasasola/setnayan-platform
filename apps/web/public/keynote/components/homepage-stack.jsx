// "The stack you can finally close" — consolidation pitch.
// Two variants:
//   StackCloseCouple   — used on /  (customer homepage)
//   StackCloseVendor   — used on /for-vendors  + homepage ForVendors section
//
// Both visualize ~25 apps a Filipino couple/vendor pieces together today,
// collapsing into a single Setnayan account. Stage-aware: pilot variant
// leans on "in beta", post-launch leans on aggregate savings.

// ─── Couple's current stack ─────────────────────────────────────────────────
// `c` is each brand's signature accent color (visual hint only — not a logo).
const COUPLE_STACK = [
  { name: "Google Sheets",    for: "guest list",            cat: "ledger",    c: "#0f9d58" },
  { name: "Excel",            for: "budget",                cat: "ledger",    c: "#217346" },
  { name: "iOS Notes",        for: "to-do",                 cat: "ledger",    c: "#fbb12d" },
  { name: "Pinterest",        for: "mood board",            cat: "creative",  c: "#e60023" },
  { name: "Canva",            for: "invitations",           cat: "creative",  c: "#00c4cc" },
  { name: "Kasal.com",        for: "vendor search",         cat: "discovery", c: "#d83e3e" },
  { name: "Bridestory PH",    for: "vendor search",         cat: "discovery", c: "#ff5a8a" },
  { name: "Themes & Motifs",  for: "vendor search",         cat: "discovery", c: "#8a5a3a" },
  { name: "FB Groups",        for: "asking around",         cat: "discovery", c: "#1877f2" },
  { name: "Instagram",        for: "vendor portfolios",     cat: "discovery", c: "#e4405f" },
  { name: "Messenger",        for: "vendor DMs",            cat: "comms",     c: "#0084ff" },
  { name: "WhatsApp",         for: "vendor DMs",            cat: "comms",     c: "#25d366" },
  { name: "Viber",            for: "tita group chat",       cat: "comms",     c: "#7360f2" },
  { name: "Email",            for: "proposals",             cat: "comms",     c: "#545860" },
  { name: "Google Forms",     for: "RSVPs",                 cat: "comms",     c: "#7248b9" },
  { name: "GCash",            for: "vendor payments",       cat: "money",     c: "#007cf0" },
  { name: "Maya",             for: "vendor payments",       cat: "money",     c: "#1eb87f" },
  { name: "BPI · BDO",        for: "wire transfers",        cat: "money",     c: "#a4191b" },
  { name: "InstaPay",         for: "split-pay vendors",     cat: "money",     c: "#ff8a00" },
  { name: "Google Drive",     for: "vendor PDFs",           cat: "files",     c: "#4285f4" },
  { name: "WeTransfer",       for: "photo handoff",         cat: "files",     c: "#409fff" },
  { name: "Dropbox",          for: "contracts",             cat: "files",     c: "#0061ff" },
  { name: "DocuSign",         for: "contracts",             cat: "files",     c: "#ffcc22" },
  { name: "YouTube Live",     for: "ceremony stream",       cat: "dayof",     c: "#ff0000" },
  { name: "Google Photos",    for: "guest album",           cat: "dayof",     c: "#4285f4" },
];

// ─── Vendor's current stack ─────────────────────────────────────────────────
const VENDOR_STACK = [
  { name: "FB Page inbox",    for: "lead capture",          cat: "leads",       c: "#1877f2" },
  { name: "Messenger Biz",    for: "couple DMs",            cat: "leads",       c: "#0084ff" },
  { name: "Instagram DMs",    for: "inquiries",             cat: "leads",       c: "#e4405f" },
  { name: "WhatsApp Biz",     for: "coordination",          cat: "leads",       c: "#25d366" },
  { name: "Google Sheets",    for: "pipeline",              cat: "crm",         c: "#0f9d58" },
  { name: "Trello · Notion",  for: "to-do board",           cat: "crm",         c: "#0079bf" },
  { name: "Google Calendar",  for: "bookings",              cat: "schedule",    c: "#4285f4" },
  { name: "Paper notebook",   for: "bookings",              cat: "schedule",    c: "#8b6f47" },
  { name: "Calendly",         for: "consults",              cat: "schedule",    c: "#006bff" },
  { name: "GCash · Maya",     for: "receive payment",       cat: "money",       c: "#007cf0" },
  { name: "BPI · BDO app",    for: "deposits",              cat: "money",       c: "#a4191b" },
  { name: "Cash receipt book",for: "BIR ORs (manual)",      cat: "money",       c: "#c96b3a" },
  { name: "Bukku",            for: "bookkeeping ₱500/mo",   cat: "money",       c: "#0a7c7c" },
  { name: "Wave",             for: "free invoicing",        cat: "money",       c: "#1f9b9b" },
  { name: "Excel",            for: "payroll · crew",        cat: "money",       c: "#217346" },
  { name: "Kasal listing",    for: "paid ad ₱25K/yr",       cat: "marketing",   c: "#d83e3e" },
  { name: "Bridestory ads",   for: "paid ad",               cat: "marketing",   c: "#ff5a8a" },
  { name: "FB · IG ads",      for: "boosted posts",         cat: "marketing",   c: "#1877f2" },
  { name: "Wedding fairs",    for: "offline lead-gen",      cat: "marketing",   c: "#8a5a3a" },
  { name: "Pixieset",         for: "photographer portfolio",cat: "portfolio",   c: "#1ba0e2" },
  { name: "WordPress · Wix",  for: "vendor site",           cat: "portfolio",   c: "#21759b" },
  { name: "Word docs",        for: "contracts",             cat: "contracts",   c: "#2b579a" },
  { name: "Print · email",    for: "contract sign-off",     cat: "contracts",   c: "#545860" },
  { name: "Google Reviews",   for: "social proof",          cat: "reviews",     c: "#fbbc04" },
  { name: "Viber groups",     for: "crew comms",            cat: "team",        c: "#7360f2" },
];

// ─── Chip cluster (the chaotic-but-orderly visualization) ───────────────────
const StackChips = ({ items, dark = false }) => (
  <div style={{
    display: "flex", flexWrap: "wrap", gap: 8,
    alignContent: "flex-start",
  }}>
    {items.map((a, i) => {
      const rot = ((i * 13) % 9) - 4;          // pseudo-random small rotation
      const isBig = (i % 5 === 0);
      const isMid = (i % 3 === 0);
      const size = isBig ? "lg" : isMid ? "md" : "sm";
      return (
        <span key={a.name} style={{
          transform: `rotate(${rot * 0.4}deg)`,
          background: dark ? "rgba(255,255,255,0.06)" : "var(--paper-2)",
          border: dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid var(--line-soft)",
          borderRadius: 999,
          padding: size === "lg" ? "9px 14px" : size === "md" ? "7px 12px" : "5px 11px",
          fontSize:  size === "lg" ? 13      : size === "md" ? 12       : 11,
          color: dark ? "var(--paper)" : "var(--ink)",
          display: "inline-flex", alignItems: "center", gap: 7,
          fontFamily: "var(--sans)",
          transition: "transform .25s, background .2s",
          cursor: "default",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${rot * 0.4}deg)`; }}>
          <span style={{ fontWeight: 500 }}>{a.name}</span>
          <span style={{ color: dark ? "var(--slate-4)" : "var(--slate-2)", fontFamily: "var(--mono)", fontSize: size === "lg" ? 10 : 9 }}>
            · {a.for}
          </span>
        </span>
      );
    })}
  </div>
);

// ─── COUPLE variant ─────────────────────────────────────────────────────────
const StackCloseCouple = () => {
  const stage = useSnynStage();
  const isPilot = stage === "pilot";

  return (
    <section style={{ padding: "120px 56px", background: "var(--paper)" }}>
      {/* ─── iPhone-keynote reveal · "three apps, one Setnayan" ──────────── */}
      <div style={{ maxWidth: 1100, marginBottom: 72 }}>
        <div className="eyebrow">Filipino weddings · a new operating system</div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { idx: "01", phrase: "A vendor marketplace.",        sub: "192 verified categories · the Kasal · Bridestory replacement" },
            { idx: "02", phrase: "A personal wedding website.",  sub: "per-guest QR · RSVP microsite · guest photo pool · save-the-date through after" },
            { idx: "03", phrase: "A live-share studio.",         sub: "livestream for far-away titos · guest paparazzi · same-day social reel · adds to your photographer" },
          ].map((line, i) => (
            <Reveal key={line.idx} delay={i * 220}>
              <div style={{
                display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "baseline",
                padding: "10px 0", borderTop: i === 0 ? "1px solid var(--line)" : "1px solid var(--line-soft)",
              }}>
                <span className="mono" style={{ fontSize: 14, color: "var(--orange)", fontFamily: "var(--mono)" }}>
                  {line.idx}
                </span>
                <div>
                  <span style={{
                    fontFamily: "var(--serif)", fontSize: 84, lineHeight: 1.02,
                    color: "var(--ink)", fontWeight: 400, fontStyle: "italic",
                    letterSpacing: "-0.025em",
                  }}>{line.phrase}</span>
                  <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 4, letterSpacing: "0.04em" }}>
                    {line.sub}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={780}>
            <div style={{
              display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "baseline",
              padding: "18px 0 10px", borderTop: "1px solid var(--ink)",
            }}>
              <span className="mono" style={{ fontSize: 14, color: "var(--slate-3)" }}>
                =
              </span>
              <div>
                <span className="display" style={{
                  fontSize: 96, lineHeight: 0.98, color: "var(--ink)", fontWeight: 800,
                  letterSpacing: "-0.01em",
                }}>
                  ONE SETNAYAN.
                </span>
                <div style={{ fontSize: 16, color: "var(--slate)", marginTop: 8, fontStyle: "italic", fontFamily: "var(--serif)" }}>
                  Are you getting it? <span style={{ color: "var(--orange-2)" }}>These are not three apps.</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ─── Stack-collapse proof ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "end", marginBottom: 40 }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--slate-2)" }}>The receipt</div>
          <h3 style={{
            fontFamily: "var(--serif)", fontSize: 44, lineHeight: 1.06,
            margin: "16px 0 0", color: "var(--ink)", fontWeight: 400, letterSpacing: "-0.02em",
          }}>
            Three categories. <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>{COUPLE_STACK.length} actual apps.</em>
          </h3>
        </div>
        <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.55, maxWidth: 520 }}>
          Here's what each of those three categories looks like in a Filipino couple's phone today.
          Kasal + Bridestory tabs for the vendor hunt. GCash + Maya + BPI for the payments. YouTube
          Live + WeTransfer + Google Drive for the day-of. The planning bits — guest list, budget,
          mood board — are just spreadsheets and Pinterest.{" "}{isPilot
            ? <em style={{ color: "var(--orange-2)" }}>Our pilot couples have already closed an average of 13 of these.</em>
            : <em style={{ color: "var(--orange-2)" }}>Couples on Setnayan close an average of 17 of these in their first month.</em>}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.65fr auto 1fr", gap: 32, alignItems: "stretch" }}>
        {/* LEFT — chaotic chip cluster */}
        <div style={{
          background: "var(--ivory)",
          border: "1px dashed var(--line)",
          borderRadius: "var(--r-md)",
          padding: 28,
          position: "relative",
        }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", letterSpacing: "0.10em", marginBottom: 18 }}>
            BEFORE · YOUR CURRENT STACK
          </div>
          <StackChips items={COUPLE_STACK} />
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 22, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
            <span>{COUPLE_STACK.length} apps · 7 logins · 3 group chats · 0 tax receipts</span>
            <span style={{ color: "var(--blush-deep)" }}>~14 lost screenshots</span>
          </div>
        </div>

        {/* MIDDLE — collapse arrow */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)", letterSpacing: "0.10em", marginBottom: 12, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            COLLAPSES INTO
          </span>
          <svg width="48" height="120" viewBox="0 0 48 120" style={{ display: "block" }}>
            <path d="M24 6 L24 96 M14 86 L24 96 L34 86" stroke="var(--orange)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="108" r="4" fill="var(--orange)" />
          </svg>
        </div>

        {/* RIGHT — single Setnayan card */}
        <div style={{
          background: "var(--ink)", color: "var(--paper)",
          border: "1px solid var(--orange-3)",
          borderRadius: "var(--r-md)",
          padding: 28, position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div aria-hidden style={{ position: "absolute", right: -80, top: -80, width: 280, height: 280, borderRadius: "50%", background: "var(--orange)", opacity: 0.08, filter: "blur(40px)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.10em" }}>AFTER · ONE ACCOUNT</div>
            <LogoMark size={56} />
            <div className="display" style={{ fontSize: 36, lineHeight: 0.98, color: "var(--paper)" }}>
              All of it.<br />In one place.
            </div>
            <div style={{ fontSize: 13, color: "var(--slate-4)", lineHeight: 1.55 }}>
              Guest list, RSVP, budget, vendors, contracts, payments, livestream, photos,
              receipts. Same data across desktop + iOS + Android. <strong style={{ color: "var(--paper)" }}>Free forever.</strong>
            </div>
            <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
              <div>
                <div className="display" style={{ fontSize: 28, color: "var(--orange-3)" }}>1</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)" }}>login</div>
              </div>
              <div>
                <div className="display" style={{ fontSize: 28, color: "var(--orange-3)" }}>₱0</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)" }}>to plan</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 28 }}>
        {[
          ["No more screenshot folders", "Receipts live where the booking lives."],
          ["No more group-chat tally",   "Every RSVP cycles in the dashboard."],
          ["No more GCash hunt",         "Vendor and couple settle directly. We don't middleman."],
          ["No more Pinterest sprawl",   "Pakulay catches mood-board mistakes."],
          ["No more 'sino-na-magprint'", "QR sheet prints with one tap."],
        ].map(([k, v]) => (
          <div key={k} className="card" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</div>
            <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 6, lineHeight: 1.45 }}>{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── VENDOR variant ─────────────────────────────────────────────────────────
const StackCloseVendor = () => {
  const stage = useSnynStage();
  const isPilot = stage === "pilot";

  return (
    <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
      {/* ─── App-Store-style reveal · "three platforms, one Setnayan" ─────── */}
      <div style={{ maxWidth: 1100, marginBottom: 72 }}>
        <div className="eyebrow">For vendors · the wedding ecosystem</div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { idx: "01", phrase: "A discovery engine.",    sub: "couples find you · 192 verified categories · search across PH" },
            { idx: "02", phrase: "A planning hub.",       sub: "guest list · RSVP · budget · schedule · mood board" },
            { idx: "03", phrase: "A reputation system.",  sub: "verified vendor badge · real reviews from real Setnayan couples" },
          ].map((line, i) => (
            <Reveal key={line.idx} delay={i * 220}>
              <div style={{
                display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "baseline",
                padding: "10px 0", borderTop: i === 0 ? "1px solid var(--line)" : "1px solid var(--line-soft)",
              }}>
                <span className="mono" style={{ fontSize: 14, color: "var(--orange)", fontFamily: "var(--mono)" }}>
                  {line.idx}
                </span>
                <div>
                  <span style={{
                    fontFamily: "var(--serif)", fontSize: 84, lineHeight: 1.02,
                    color: "var(--ink)", fontWeight: 400, fontStyle: "italic",
                    letterSpacing: "-0.025em",
                  }}>{line.phrase}</span>
                  <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 4, letterSpacing: "0.04em" }}>
                    {line.sub}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={780}>
            <div style={{
              display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "baseline",
              padding: "18px 0 10px", borderTop: "1px solid var(--ink)",
            }}>
              <span className="mono" style={{ fontSize: 14, color: "var(--slate-3)" }}>
                =
              </span>
              <div>
                <span className="display" style={{
                  fontSize: 96, lineHeight: 0.98, color: "var(--ink)", fontWeight: 800,
                  letterSpacing: "-0.01em",
                }}>
                  ONE SETNAYAN.
                </span>
                <div style={{ fontSize: 16, color: "var(--slate)", marginTop: 8, fontStyle: "italic", fontFamily: "var(--serif)" }}>
                  You run the wedding service. <span style={{ color: "var(--orange-2)" }}>We handle everything else.</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", marginTop: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  What iPhone did for software, Setnayan does for Filipino wedding services
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ─── Stack-collapse proof ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "end", marginBottom: 40 }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--slate-2)" }}>The receipt</div>
          <h3 style={{
            fontFamily: "var(--serif)", fontSize: 44, lineHeight: 1.06,
            margin: "16px 0 0", color: "var(--ink)", fontWeight: 400, letterSpacing: "-0.02em",
          }}>
            Three things bundled. <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>{VENDOR_STACK.length} apps replaced.</em>
          </h3>
        </div>
        <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.55, maxWidth: 520 }}>
          Most vendors run their business on a Frankenstein stack — a Kasal listing here, a
          Pixieset there, an accountant who does the BIR forms by hand. Setnayan's free tier
          replaces every tool below.{" "}
          <strong style={{ color: "var(--ink)" }}>Average PH vendor saves ₱18,400/year</strong>{" "}
          on subscriptions alone, plus ₱2-5K per event in BIR receipt prep.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.65fr auto 1fr", gap: 32, alignItems: "stretch" }}>
        {/* LEFT — vendor stack chaos */}
        <div style={{
          background: "var(--paper)",
          border: "1px dashed var(--line)",
          borderRadius: "var(--r-md)",
          padding: 28,
          position: "relative",
        }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", letterSpacing: "0.10em", marginBottom: 18 }}>
            BEFORE · WHAT YOU PIECE TOGETHER
          </div>
          <StackChips items={VENDOR_STACK} />
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 22, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line-soft)", paddingTop: 14, flexWrap: "wrap", gap: 10 }}>
            <span>{VENDOR_STACK.length} tools · ~₱18,400/yr in subs · BIR forms by hand</span>
            <span style={{ color: "var(--blush-deep)" }}>1 missed lead = 1 lost wedding</span>
          </div>
        </div>

        {/* MIDDLE — collapse */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)", letterSpacing: "0.10em", marginBottom: 12, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            COLLAPSES INTO
          </span>
          <svg width="48" height="120" viewBox="0 0 48 120" style={{ display: "block" }}>
            <path d="M24 6 L24 96 M14 86 L24 96 L34 86" stroke="var(--orange)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="108" r="4" fill="var(--orange)" />
          </svg>
        </div>

        {/* RIGHT — Setnayan vendor card */}
        <div style={{
          background: "var(--ink)", color: "var(--paper)",
          border: "1px solid var(--orange-3)",
          borderRadius: "var(--r-md)",
          padding: 28, position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div aria-hidden style={{ position: "absolute", right: -80, top: -80, width: 280, height: 280, borderRadius: "50%", background: "var(--orange)", opacity: 0.08, filter: "blur(40px)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.10em" }}>AFTER · ONE DASHBOARD</div>
            <LogoMark size={56} />
            <div className="display" style={{ fontSize: 36, lineHeight: 0.98, color: "var(--paper)" }}>
              Ship your<br />service. Done.
            </div>
            <div style={{ fontSize: 13, color: "var(--slate-4)", lineHeight: 1.55 }}>
              Profile, inbox, pipeline, calendar, contracts, payments, BIR receipts, reviews —
              one login. <strong style={{ color: "var(--paper)" }}>Free forever; Pro at ₱1,999/month</strong> for ecosystem-locked extras.
            </div>
            <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
              <div>
                <div className="display" style={{ fontSize: 28, color: "var(--orange-3)" }}>₱18.4K</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)" }}>saved / year</div>
              </div>
              <div>
                <div className="display" style={{ fontSize: 28, color: "var(--orange-3)" }}>₱0</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)" }}>to start</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Annual savings — rendered as a "retired" receipt */}
      <div style={{
        marginTop: 28, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 14, alignItems: "stretch",
      }}>
        {/* LEFT — the old receipt, marked retired */}
        <div style={{
          position: "relative",
          background: "var(--ivory)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          padding: "28px 32px 24px",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
          fontFamily: "var(--mono)",
        }}>
          {/* Top serration — receipt feel */}
          <div aria-hidden style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 8,
            background: `radial-gradient(circle at 8px 0, transparent 4px, var(--ivory) 4.5px), radial-gradient(circle at 8px 0, transparent 4px, var(--paper-2) 4.5px)`,
            backgroundSize: "16px 8px, 16px 8px",
            backgroundPosition: "0 0, 0 0",
          }} />
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
              Annual subscriptions
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>
              FY 2026 · TYPICAL VENDOR
            </div>
          </div>

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Kasal.com listing",      "8,000.00"],
              ["Bridestory PH ads",      "4,500.00"],
              ["Pixieset · portfolio",   "3,400.00"],
              ["Bukku · bookkeeping",    "1,800.00"],
              ["Calendly · consults",      "700.00"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, color: "var(--ink)" }}>
                <span>{k}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--slate)" }}>₱ {v}</span>
              </div>
            ))}
          </div>

          {/* Dashed divider */}
          <div aria-hidden style={{
            margin: "14px 0",
            borderTop: "1.5px dashed var(--line)",
          }} />

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, color: "var(--slate-3)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Total · per year</span>
            <span style={{ fontFamily: "var(--display)", fontSize: 40, color: "var(--ink)", fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
              ₱18,400
            </span>
          </div>

          {/* Hand-stamp · "RETIRED BY SETNAYAN" */}
          <div aria-hidden style={{
            position: "absolute",
            right: 26, top: 78,
            transform: "rotate(-8deg)",
            border: "3px double var(--blush-deep)",
            color: "var(--blush-deep)",
            padding: "8px 14px",
            fontFamily: "var(--mono)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            opacity: 0.88,
            background: "rgba(196, 73, 73, 0.04)",
            pointerEvents: "none",
            lineHeight: 1.0,
            boxShadow: "0 0 0 6px var(--ivory) inset",
          }}>
            Retired · paid in full<br />
            <span style={{ fontSize: 10, color: "var(--blush-deep)" }}>by Setnayan · 2026</span>
          </div>

          {/* Bottom serration */}
          <div aria-hidden style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
            background: `radial-gradient(circle at 8px 8px, transparent 4px, var(--paper-2) 4.5px)`,
            backgroundSize: "16px 8px",
          }} />
        </div>

        {/* RIGHT — the new receipt: ₱0 */}
        <div style={{
          position: "relative",
          background: "var(--ink)",
          color: "var(--paper)",
          border: "1px solid var(--orange-3)",
          borderRadius: "var(--r-md)",
          padding: "28px 32px 24px",
          overflow: "hidden",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div aria-hidden style={{ position: "absolute", right: -100, top: -100, width: 280, height: 280, borderRadius: "50%", background: "var(--orange)", opacity: 0.10, filter: "blur(50px)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                Setnayan · annual cost
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)" }}>
                FY 2026
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "10px 0" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 80, color: "var(--orange-3)", lineHeight: 0.96, fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
                ₱0
              </div>
              <div style={{ fontSize: 14, color: "var(--slate-4)", lineHeight: 1.55, maxWidth: 380 }}>
                Free vendor profile, free chat, free pipeline, free BIR receipts —{" "}
                <strong style={{ color: "var(--paper)" }}>forever.</strong>{" "}
                Pro at ₱1,999/month only if you want the ecosystem-locked stuff.
              </div>
            </div>

            <div style={{ paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.10)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, color: "var(--slate-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}>
                NET ANNUAL SAVINGS
              </div>
              <div className="display" style={{ fontSize: 28, color: "var(--orange-3)", fontVariantNumeric: "tabular-nums" }}>
                +₱18,400 /yr
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Small footer note */}
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", textAlign: "center", marginTop: 14, letterSpacing: "0.04em" }}>
        Tool subscriptions only · ₱2-5K per event in BIR receipt prep saved separately
      </div>
    </section>
  );
};

Object.assign(window, { StackCloseCouple, StackCloseVendor });
