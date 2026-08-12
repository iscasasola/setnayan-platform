// Homepage — top half: promo bar, nav, hero, "live today", problem framing, two sides

const PromoBar = () => {
  const stage = useSnynStage();
  if (stage === "pilot") {
    return (
      <div style={{
        background: "var(--ink)", color: "var(--paper)",
        fontSize: 13, padding: "10px 24px",
        display: "flex", justifyContent: "center", alignItems: "center", gap: 18, flexWrap: "wrap",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange)", animation: "snyn-pulse 2s ease-in-out infinite" }} />
          <strong style={{ fontWeight: 500 }}>Pilot · December 2026.</strong> First wedding ships Dec 18 — Claire &amp; Ice's own.
        </span>
        <span style={{ color: "var(--slate-3)" }}>·</span>
        <a href="#" style={{ color: "var(--orange-3)", textDecoration: "underline", textUnderlineOffset: 3 }}>Apply to the pilot →</a>
        <style dangerouslySetInnerHTML={{ __html: "@keyframes snyn-pulse{0%,100%{opacity:1}50%{opacity:.4}}" }} />
      </div>
    );
  }
  if (stage === "debut") {
    return (
      <div style={{
        background: "var(--ink)", color: "var(--paper)",
        fontSize: 13, padding: "10px 24px",
        display: "flex", justifyContent: "center", alignItems: "center", gap: 18, flexWrap: "wrap",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="pill" style={{ background: "var(--orange)", color: "#fff", borderColor: "transparent", fontSize: 10, padding: "2px 8px", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}>NEW</span>
          Debut is now bookable on Setnayan — same playbook, all your wedding vendors carry over.
        </span>
        <span style={{ color: "var(--slate-3)" }}>·</span>
        <a href="#" style={{ color: "var(--orange-3)", textDecoration: "underline", textUnderlineOffset: 3 }}>Plan a debut →</a>
        <span style={{ color: "var(--slate-3)" }}>·</span>
        <a href="#" style={{ color: "var(--paper)", textDecoration: "underline", textUnderlineOffset: 3 }}>I'm a vendor →</a>
      </div>
    );
  }
  return (
    <div style={{
      background: "var(--ink)", color: "var(--paper)",
      fontSize: 13, padding: "10px 24px",
      display: "flex", justifyContent: "center", alignItems: "center", gap: 18, flexWrap: "wrap",
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--orange)" }}>●</span>
        Planning tools are free forever — sign up and invite your team.
      </span>
      <span style={{ color: "var(--slate-3)" }}>·</span>
      <a href="#" style={{ color: "var(--orange-3)", textDecoration: "underline", textUnderlineOffset: 3 }}>Start planning →</a>
      <span style={{ color: "var(--slate-3)" }}>·</span>
      <a href="#" style={{ color: "var(--paper)", textDecoration: "underline", textUnderlineOffset: 3 }}>I'm a vendor →</a>
    </div>
  );
};

const Nav = () => (
  <nav style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 56px", borderBottom: "1px solid var(--line-soft)",
    background: "var(--paper)", position: "sticky", top: 0, zIndex: 10,
  }}>
    <LogoFull height={32} />
    <div style={{ display: "flex", gap: 28, fontSize: 14, color: "var(--slate)" }}>
      {["Marketplace", "How it works", "Features", "For vendors", "Pricing", "Help"].map((l) => (
        <a key={l} href="#" style={{ color: "inherit", textDecoration: "none" }}>{l}</a>
      ))}
    </div>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button onClick={() => window.__openSearch && window.__openSearch()} style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "8px 12px 8px 14px", borderRadius: 999,
        background: "var(--paper-2)", border: "1px solid var(--line)",
        color: "var(--slate-2)", fontSize: 13, cursor: "pointer", fontFamily: "var(--sans)",
      }}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span style={{ marginRight: 60 }}>Search vendors, dates, help…</span>
        <kbd className="mono" style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--paper)", border: "1px solid var(--line)", color: "var(--slate-3)" }}>⌘K</kbd>
      </button>
      <a href="#" style={{ fontSize: 14, color: "var(--slate)", textDecoration: "none" }}>Sign in</a>
      <button className="btn btn-primary" style={{ padding: "10px 18px", fontSize: 13 }}>
        Start planning
      </button>
    </div>
  </nav>
);

const Hero = () => {
  const stage = useSnynStage();
  const isPilot = stage === "pilot";
  return (
  <section style={{ padding: "80px 56px 56px", position: "relative", overflow: "hidden" }}>
    <Blob top={-80}  left={-80}  size={620} color="var(--orange)" opacity={0.06} />
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, alignItems: "center", position: "relative" }}>
      <Reveal>
        <div className="mono" style={{ fontSize: 12, letterSpacing: "0.18em", color: "var(--slate-2)", marginBottom: 28 }}>
          SET NA ‘YAN · /sɛt na jan/
        </div>
        <h1 style={{
          fontFamily: "var(--serif)",
          fontSize: 152, lineHeight: 0.96, margin: 0,
          letterSpacing: "-0.035em", color: "var(--ink)",
          fontWeight: 400, fontStyle: "italic",
        }}>
          Set na ‘yan.
        </h1>
        <div style={{ marginTop: 14 }}>
          <span className="display" style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-0.005em", color: "var(--ink)", lineHeight: 1.0 }}>
            Plan your wedding<br />
            <span style={{ color: "var(--orange)" }}>the easy way.</span>
          </span>
        </div>
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="100" height="20" viewBox="0 0 100 20" style={{ flexShrink: 0 }}>
            <path d="M2 10 Q25 -2 50 10 T98 10" stroke="var(--orange)" strokeWidth="1.5" fill="none" />
            <circle cx="50" cy="10" r="2" fill="var(--orange)" />
          </svg>
          <span className="serif" style={{ fontSize: 22, fontStyle: "italic", color: "var(--slate)" }}>
            <span style={{ color: "var(--ink)" }}>"It's all set."</span> The whole wedding, in one app.
          </span>
        </div>
        <p style={{
          fontSize: 18, color: "var(--slate)", lineHeight: 1.65,
          maxWidth: 560, marginTop: 32, textWrap: "pretty", fontFamily: "var(--serif)",
          fontStyle: "italic", fontSize: 21,
        }}>
          A love letter, a guest list, a thousand tiny decisions, and a Saturday afternoon
          you'll remember forever.{" "}
          <span style={{ fontStyle: "normal", fontFamily: "var(--sans)", fontSize: 17, color: "var(--ink)" }}>
            Setnayan is the Filipino-built platform that holds all of it — guest list, vendors,
            invitations, livestream, same-day highlight reel — so you can spend less time
            arguing about chair colors and more time being engaged.
          </span>
        </p>
        <div style={{ marginTop: 18, padding: "10px 14px", borderRadius: 10, background: "var(--ivory)", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", gap: 12, maxWidth: 560 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)", flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>
            {stage === "debut" ? (
              <>
                <strong style={{ fontWeight: 500 }}>Wedding + Debut are live.</strong>{" "}
                <span style={{ color: "var(--slate)" }}>Birthday, baptism, corporate — opening next as our vendor base crosses each threshold.</span>
              </>
            ) : (
              <>
                <strong style={{ fontWeight: 500 }}>Wedding today. Every celebration tomorrow.</strong>{" "}
                <span style={{ color: "var(--slate)" }}>Debut, birthday, baptism, corporate — opening as our vendor base reaches each event type.</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-lg">
            {isPilot ? "Apply to the pilot" : "Start planning"}{" "}<span style={{ color: "var(--orange-3)" }}>· free</span>
          </button>
          <button className="btn btn-ghost btn-lg">I'm a vendor →</button>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 24, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span>Built in the Philippines</span>
          <span>·</span>
          <span>Proper receipts, automatic</span>
          <span>·</span>
          <span>English today, Tagalog soon</span>
          <span>·</span>
          {isPilot ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", background: "var(--orange-4)", color: "var(--orange-2)", borderRadius: 999, fontFamily: "var(--mono)", fontSize: 11 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--orange)" }} />
              Pilot · GCash / Maya QR
            </span>
          ) : (
            <>
              <span>GCash · Maya · InstaPay · cards</span>
              <span>·</span>
              <span style={{ color: "var(--ink)" }}>4.86★ average across {stage === "debut" ? "518" : "412"} verified vendors</span>
            </>
          )}
        </div>
      </Reveal>

      {/* Hero collage */}
      <HeroCollage />
    </div>

    {/* What's live today */}
    <div style={{ marginTop: 80 }}>
      <div className="eyebrow" style={{ marginBottom: 18 }}>What’s live today</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          "Proper receipts, automatic",
          "QR invitations",
          "Verified vendor marketplace",
          "Day‑of livestream",
          "Same‑day highlight reel",
          "Multi‑host event access",
          "In‑app chat with vendors",
          "Milestone‑protected payments",
        ].map((t) => (
          <span key={t} className="pill" style={{ background: "var(--paper)", padding: "8px 14px", fontSize: 13 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--sage-deep)" }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  </section>
);
};

const HeroCollage = () => (
  <div style={{ position: "relative", height: 600, display: "flex", alignItems: "stretch" }}>
    {/* Soft warm wash behind */}
    <Blob top={-40} right={-40} size={520} color="var(--orange)" opacity={0.14} />
    <Blob bottom={-60} left={-40} size={420} color="var(--blush)" opacity={0.20} />

    {/* Single clean product card — dashboard preview */}
    <Reveal delay={120} style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
      <div className="card" style={{
        width: "100%", height: "100%",
        padding: 0, overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
        background: "var(--paper)",
      }}>
        {/* mock browser chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line-soft)", background: "var(--paper-2)" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#E28300", "#FFC061", "#C5D2BD"].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginLeft: 8 }}>
            app.setnayan.com / claire-ice
          </div>
          <span className="pill" style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", background: "var(--paper)" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--sage-deep)" }} />
            213 days to go
          </span>
        </div>
        {/* mini dashboard body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="label-mono" style={{ fontSize: 10 }}>Good evening, Maria</div>
            <div className="display" style={{ fontSize: 28, marginTop: 2 }}>CLAIRE &amp; ICE</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { k: "RSVPs in",    v: "166/213" },
              { k: "Vendors",     v: "9/12"    },
              { k: "Budget",      v: "62%"     },
            ].map(s => (
              <div key={s.k} style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "var(--paper-2)" }}>
                <div className="label-mono" style={{ fontSize: 9 }}>{s.k}</div>
                <div className="display" style={{ fontSize: 22, marginTop: 2, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 14, background: "var(--ivory)", borderRadius: 10 }}>
            <div className="label-mono" style={{ fontSize: 9 }}>Next up</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 17, color: "var(--ink)", textTransform: "uppercase", marginTop: 4 }}>
              Send invites to 47 pending guests
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <span className="pill pill-orange" style={{ fontSize: 10, padding: "3px 9px" }}>Send all</span>
              <span className="pill" style={{ fontSize: 10, padding: "3px 9px" }}>Print QR sheet</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { d: "Nov 28", label: "Venue walkthrough · La Castellana" },
              { d: "Dec 5",  label: "Final headcount lock for caterer", hot: true },
              { d: "Dec 12", label: "Ceremony · 4:00pm",                hero: true },
            ].map((t, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 12, alignItems: "center",
                padding: "8px 10px", borderRadius: 6,
                background: t.hero ? "var(--orange-4)" : "transparent",
              }}>
                <span className="mono" style={{ fontSize: 11, color: t.hero ? "var(--orange-2)" : "var(--slate-2)" }}>{t.d}</span>
                <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: t.hero ? 500 : 400 }}>{t.label}</span>
                {t.hot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--orange)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>

    {/* Tiny floating live-stream pill — only ornament */}
    <Reveal delay={420} style={{ position: "absolute", right: -16, bottom: 32, zIndex: 2 }}>
      <div className="card" style={{ padding: "8px 14px", background: "var(--ink)", color: "var(--paper)", border: "none", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-lg)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)" }} />
        <span className="mono" style={{ fontSize: 11 }}>● Live · 1:24:18 · 218 watching</span>
      </div>
    </Reveal>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Problem framing

const ProblemSection = () => (
  <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
    <div className="eyebrow">Sounds familiar?</div>
    <h2 style={{
      fontFamily: "var(--serif)", fontSize: 84, lineHeight: 1.04,
      maxWidth: 1200, margin: "20px 0 28px", letterSpacing: "-0.025em",
      color: "var(--ink)", fontWeight: 400,
    }}>
      Six apps. Twelve spreadsheets.{" "}
      <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>Three Viber groups at 11 pm.</em>
    </h2>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "start" }}>
      <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.6, maxWidth: 540 }}>
        That’s how most Filipino couples plan a wedding today — bouncing between vendor messages,
        guest lists, budget spreadsheets, mood‑board screenshots, and a barangay full of people
        asking when the dress code drops.
      </p>
      <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.6, maxWidth: 540 }}>
        Vendors aren’t any better off. Bookings live in DMs. Calendars live in a notebook.
        Payments live wherever GCash receipts end up. Reviews don’t live anywhere.
      </p>
    </div>

    {/* Tight before/after — list of fragments resolves to a single Setnayan card */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 32, alignItems: "center", marginTop: 56 }}>
      {/* Before: stack of tools list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { tag: "WhatsApp · 11pm",       body: "“sino mag-pa-print ng QR?”" },
          { tag: "Budget.xlsx — v8",      body: "₱2M, mostly guessed" },
          { tag: "Notes · plus-ones",     body: "tito tito tito" },
          { tag: "Drive · vendor PDFs",   body: "14 PDFs, 6 versions" },
          { tag: "GCash · receipts",      body: "screenshots, somewhere" },
          { tag: "Pinterest · mood",      body: "3 boards, conflicting" },
        ].map((s, i) => (
          <Reveal key={s.tag} delay={i * 60}>
            <div className="card" style={{
              padding: "12px 16px", display: "grid", gridTemplateColumns: "150px 1fr", gap: 14, alignItems: "center",
            }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.tag}</span>
              <span style={{ fontSize: 13, color: "var(--ink)" }}>{s.body}</span>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Arrow */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <svg width="120" height="24" viewBox="0 0 120 24" style={{ overflow: "visible" }}>
          <path d="M 0 12 L 108 12" stroke="var(--orange)" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M 100 4 L 116 12 L 100 20" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <span className="label-mono" style={{ color: "var(--orange-2)" }}>One place</span>
      </div>

      {/* After: Setnayan card */}
      <Reveal delay={120}>
        <div className="card" style={{
          padding: 28, background: "var(--ink)", color: "var(--paper)",
          border: "none", boxShadow: "var(--shadow-lg)",
        }}>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>Setnayan</div>
          <div className="display" style={{ fontSize: 42, marginTop: 8, color: "var(--paper)" }}>
            Everything, <span style={{ color: "var(--orange)" }}>in one app.</span>
          </div>
          <div style={{ fontSize: 14, color: "var(--slate-4)", marginTop: 10, lineHeight: 1.55 }}>
            Guest list, vendors, budget, invitations, livestream, same-day reel — every moving
            piece in the same app you’ll use on the day.
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              ["166", "RSVPs"],
              ["9",   "Vendors"],
              ["62%", "Budget"],
            ].map(([v, k]) => (
              <div key={k} style={{ padding: 10, background: "rgba(255,255,255,0.06)", borderRadius: 8 }}>
                <div className="display" style={{ fontSize: 24, color: "var(--paper)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-4)", marginTop: 2 }}>{k}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

// ──────────────────────────────────────────────────────────────────
// Both sides

const TwoSides = () => {
  const couples = [
    "Free to plan. Guest list, RSVP, seating, budget, mood board. No subscription, no paywall.",
    "Personal QR invitations for every guest, with branded monogram if you want it.",
    "Day-of live broadcast so anyone who can't be there sees every moment.",
    "Paparazzi capture — your guests' phones become a coordinated photo crew.",
    "Same-day highlight reel delivered 30 minutes before the reception starts.",
    "One bill. Pay for what you book. No GCash screenshots, no chasing for receipts.",
  ];
  const vendors = [
    "Free listing. Profile, chat with couples, accept bookings — no monthly fee to start.",
    "Real calendar with team roles, agent privacy redaction, per-service scoping.",
    "In-app payments with BIR receipts and EWT / 2307 handled for you.",
    "Pipeline and proposals from inquiry to completed booking.",
    "Sponsored boost when you're ready to scale — 10km → 30km visibility.",
    "Crew-rate marketplace — coming soon. List your team and earn from every job.",
  ];
  return (
    <section style={{ padding: "120px 56px" }}>
      <div className="eyebrow">Built for both sides</div>
      <h2 style={{
        fontFamily: "var(--serif)", fontSize: 84, lineHeight: 1.04,
        maxWidth: 1200, margin: "20px 0 16px", letterSpacing: "-0.025em",
        color: "var(--ink)", fontWeight: 400,
      }}>
        Most event apps pick a side.{" "}
        <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>We chose both.</em>
      </h2>
      <p style={{ fontSize: 17, color: "var(--slate)", maxWidth: 720, lineHeight: 1.55 }}>
        Setnayan is the only Filipino events platform with real operating tools on both
        sides — so what the couple plans is what the vendor sees, and vice versa.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 56 }}>
        <Reveal delay={0}>
          <SideColumn audience="For couples" tone="paper" items={couples} headline="Plan it once. Together." />
        </Reveal>
        <Reveal delay={150}>
          <SideColumn audience="For vendors" tone="ink"   items={vendors} headline="Run your business, not your DMs." />
        </Reveal>
      </div>
    </section>
  );
};

const SideColumn = ({ audience, tone, items, headline }) => {
  const dark = tone === "ink";
  return (
    <div style={{
      background: dark ? "var(--ink)" : "var(--paper)",
      color: dark ? "var(--paper)" : "var(--ink)",
      borderRadius: "var(--r-xl)",
      padding: "40px 36px",
      border: dark ? "none" : "1px solid var(--line)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div className="label-mono" style={{ color: dark ? "var(--orange-3)" : "var(--slate-2)" }}>
        {audience}
      </div>
      <div className="display" style={{ fontSize: 44, marginTop: 10, color: dark ? "var(--paper)" : "var(--ink)", lineHeight: 1.04 }}>
        {headline}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "32px 0 0", display: "grid", gap: 16 }}>
        {items.map((t, i) => (
          <li key={i} style={{
            display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start",
            paddingBottom: 14, borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "var(--line-soft)"}`,
          }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--orange)", paddingTop: 2 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: dark ? "var(--paper)" : "var(--slate)" }}>{t}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 28 }}>
        <button className={dark ? "btn btn-orange" : "btn btn-primary"}>
          {dark ? "Register your business — free" : "Start planning — free"}
        </button>
      </div>
    </div>
  );
};

Object.assign(window, { PromoBar, Nav, Hero, ProblemSection, TwoSides });
