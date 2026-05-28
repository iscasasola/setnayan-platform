// The Setnayan Keynote — long-form scroll-deck pitching Setnayan as the new
// world standard for wedding creation. Apple-keynote rhythm: chapter numbers,
// single statements per screen, alternating paper/ink for cinematic pacing,
// demos and "one more thing" beats.
//
// Maria & Juan are the running couple — override SETNAYAN_DATA before mount.

if (typeof SETNAYAN_DATA !== "undefined" && SETNAYAN_DATA.event) {
  Object.assign(SETNAYAN_DATA.event, {
    couple:    "Maria & Juan",
    date:      "12 · 12 · 2026",
    dateShort: "Dec 12, 2026",
    daysOut:   207,
  });
}

// ─── Nav (minimal) ──────────────────────────────────────────────────────────
const KeynoteNav = () => (
  <nav style={{
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
    padding: "20px 40px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "rgba(251, 248, 242, 0.86)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(31, 26, 23, 0.06)",
  }}>
    <a href="Setnayan Site (Jobs+Ive).html" style={{ textDecoration: "none", color: "var(--ink)" }}>
      <LogoFull height={26} />
    </a>
    <div style={{ display: "flex", gap: 28, fontSize: 12, fontFamily: "var(--mono)", color: "var(--slate-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
      <span>The Setnayan Keynote</span>
      <a href="Setnayan Site (Jobs+Ive).html" style={{ color: "var(--orange-2)", textDecoration: "none" }}>← Home</a>
    </div>
  </nav>
);

// ─── Chapter wrapper ────────────────────────────────────────────────────────
const Chapter = ({ num, dark = false, center = false, children, style = {} }) => (
  <section style={{
    minHeight: "100vh",
    padding: "180px 96px 140px",
    background: dark ? "var(--ink)" : "var(--paper)",
    color: dark ? "var(--paper)" : "var(--ink)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: center ? "center" : "flex-start",
    textAlign: center ? "center" : "left",
    position: "relative",
    ...style,
  }}>
    <div style={{
      position: "absolute", top: 96, left: center ? "50%" : 96,
      transform: center ? "translateX(-50%)" : "none",
      fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.24em",
      color: dark ? "var(--orange-3)" : "var(--orange-2)",
      textTransform: "uppercase",
    }}>
      Chapter {num} of 13
    </div>
    <div style={{ width: "100%", maxWidth: center ? 1100 : 1200 }}>
      {children}
    </div>
  </section>
);

// Reusable typography
const big = (color = "var(--ink)") => ({
  fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
  fontSize: 116, lineHeight: 1.04, color, letterSpacing: "-0.035em",
  margin: 0,
});
const display = (color = "var(--ink)") => ({
  fontFamily: "var(--display)", fontWeight: 800,
  letterSpacing: "-0.025em", color,
  margin: 0,
});

// ─── 01 · Good morning ──────────────────────────────────────────────────────
const Ch01Greeting = () => (
  <Chapter num="01" center>
    <Reveal>
      <h1 style={{ ...big(), fontSize: 144 }}>Good morning.</h1>
    </Reveal>
    <Reveal delay={500}>
      <p style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 30, color: "var(--slate)",
        lineHeight: 1.4, margin: "56px auto 0", maxWidth: 760, fontWeight: 400,
      }}>
        We&apos;d like to show you something we&apos;ve been working on for a year.
      </p>
    </Reveal>
    <Reveal delay={1100}>
      <div className="mono" style={{
        fontSize: 13, color: "var(--orange-2)", letterSpacing: "0.20em",
        marginTop: 96, textTransform: "uppercase",
      }}>
        It is not a feature. It is a new way to get married.
      </div>
    </Reveal>
  </Chapter>
);

// ─── 02 · The state of weddings ────────────────────────────────────────────
const Ch02Problem = () => (
  <Chapter num="02" dark>
    <Reveal>
      <h2 style={{ ...big("var(--paper)"), fontSize: 96, maxWidth: 1300 }}>
        Today, getting married<br />takes <em style={{ color: "var(--orange-3)" }}>twenty-five apps.</em>
      </h2>
    </Reveal>
    <Reveal delay={500}>
      <p style={{
        fontSize: 18, color: "var(--slate-4)", lineHeight: 1.7, margin: "56px 0 0",
        maxWidth: 720,
      }}>
        Google Sheets for the guest list. Pinterest for the mood board.
        Three messenger apps for vendor DMs. Two e-wallets for payments. A Google
        Drive of PDFs nobody re-reads. Excel for the budget. None of them talk
        to each other.
      </p>
    </Reveal>
    <Reveal delay={1100}>
      <div style={{
        marginTop: 64,
        fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 36,
        color: "var(--orange-3)", lineHeight: 1.3, maxWidth: 900,
      }}>
        That&apos;s why weddings cost too much,<br />take too long, and break too often.
      </div>
    </Reveal>
  </Chapter>
);

// ─── 03 · The insight ───────────────────────────────────────────────────────
const Ch03Insight = () => (
  <Chapter num="03" center>
    <Reveal>
      <p style={{ ...big(), fontSize: 88, lineHeight: 1.15 }}>
        What if a wedding<br />
        wasn&apos;t a project?
      </p>
    </Reveal>
    <Reveal delay={700}>
      <p style={{ ...big("var(--orange-2)"), fontSize: 88, lineHeight: 1.15, marginTop: 72 }}>
        What if it was<br />
        a platform?
      </p>
    </Reveal>
  </Chapter>
);

// ─── 04 · The name ──────────────────────────────────────────────────────────
const Ch04Name = () => (
  <Chapter num="04" center>
    <Reveal>
      <LogoMark size={120} />
    </Reveal>
    <Reveal delay={400}>
      <div style={{ ...display(), fontSize: 200, lineHeight: 1.0, marginTop: 40 }}>
        SETNAYAN.
      </div>
    </Reveal>
    <Reveal delay={900}>
      <p style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 32, color: "var(--slate)",
        lineHeight: 1.4, margin: "48px auto 0", maxWidth: 760, fontWeight: 400,
      }}>
        An operating system for Filipino weddings.<br />
        Built locally. Designed for the world.
      </p>
    </Reveal>
  </Chapter>
);

// ─── 05 · It does three things ──────────────────────────────────────────────
const Ch05Three = () => (
  <Chapter num="05">
    <div style={{ display: "flex", flexDirection: "column" }}>
      {[
        "Finds your people.",
        "Talks to every guest.",
        "Shows up on the day.",
      ].map((line, i) => (
        <Reveal key={line} delay={i * 320}>
          <div style={{
            fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
            fontSize: 124, lineHeight: 1.04, letterSpacing: "-0.035em",
            color: "var(--ink)",
            margin: "4px 0",
          }}>{line}</div>
        </Reveal>
      ))}
      <Reveal delay={1200}>
        <div style={{ marginTop: 80, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 80, height: 1, background: "var(--ink)" }} />
          <div style={{
            fontFamily: "var(--display)", fontWeight: 800, fontSize: 32,
            color: "var(--ink)", letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            And they&apos;re one app.
          </div>
        </div>
      </Reveal>
    </div>
  </Chapter>
);

// ─── 06 · Demo · the planner ────────────────────────────────────────────────
const Ch06DemoPlanner = () => (
  <Chapter num="06" center style={{ padding: "180px 56px 140px" }}>
    <Reveal>
      <p style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
        fontSize: 56, color: "var(--ink)", lineHeight: 1.15, margin: 0, letterSpacing: "-0.02em",
      }}>
        Maria &amp; Juan are getting married<br />
        <span style={{ color: "var(--slate-2)" }}>on December 12, 2026.</span>
      </p>
    </Reveal>
    <div style={{ height: 56 }} />
    <Reveal delay={300}>
      <div style={{
        width: "100%", maxWidth: 1320, height: 720,
        borderRadius: 18,
        border: "1px solid var(--line)",
        boxShadow: "0 40px 100px rgba(31, 26, 23, 0.14), 0 12px 32px rgba(31, 26, 23, 0.06)",
        background: "var(--paper-2)",
        overflow: "hidden",
      }}>
        <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
          <CoupleDashboard role="couple" setRole={() => {}} />
        </div>
      </div>
    </Reveal>
    <Reveal delay={700}>
      <div className="mono" style={{
        marginTop: 32, fontSize: 12, color: "var(--slate-3)", letterSpacing: "0.20em", textTransform: "uppercase",
      }}>
        Real data. Scrub it.
      </div>
    </Reveal>
  </Chapter>
);

// ─── 07 · Watch the day ─────────────────────────────────────────────────────
const Ch07Day = () => (
  <Chapter num="07" dark>
    <Reveal>
      <div className="mono" style={{ fontSize: 12, color: "var(--orange-3)", letterSpacing: "0.20em", marginBottom: 28, textTransform: "uppercase" }}>
        And on the wedding day —
      </div>
      <h2 style={{ ...big("var(--paper)"), fontSize: 92, maxWidth: 1200 }}>
        Three things happen<br />that <em style={{ color: "var(--orange-3)" }}>no one else can do.</em>
      </h2>
    </Reveal>
    <div style={{
      marginTop: 96,
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, maxWidth: 1400,
    }}>
      {[
        { tag: "PAPIC",  title: "Your guests become<br />the camera crew.",      body: "Every photo lands tagged in real time — to the guest who took it, the table they're sitting at, and the people in the frame. Not dumped into a pile to sort later." },
        { tag: "PANOOD", title: "Your far-away family<br />is in the room.",     body: "Four cameras. One broadcast. Lola streams the vows from Manila in 4K, on her TV." },
        { tag: "REEL",   title: "The wedding video<br />ships before dessert.",  body: "AI cuts the highlight reel from Papic + Panood feeds. Plays on the reception screen. Goes to socials before dinner ends." },
      ].map((c, i) => (
        <Reveal key={c.tag} delay={300 + i * 200}>
          <div style={{ padding: 24, background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", height: "100%" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--orange-3)", letterSpacing: "0.20em" }}>{c.tag}</div>
            <h3 style={{
              fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
              fontSize: 34, color: "var(--paper)", lineHeight: 1.15,
              marginTop: 14, marginBottom: 18,
              letterSpacing: "-0.02em",
            }} dangerouslySetInnerHTML={{ __html: c.title }} />
            <p style={{ fontSize: 14, color: "var(--slate-4)", lineHeight: 1.6, margin: 0 }}>{c.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  </Chapter>
);

// ─── 08 · One more thing · catastrophes averted ─────────────────────────────
const Ch08Catastrophes = () => {
  const vignettes = [
    {
      before: <>Three days before the wedding,<br />Maria &amp; Juan&apos;s florist canceled.</>,
      after:  <>Setnayan rerouted to a backup.<br />They found out at the reception.</>,
    },
    {
      before: <>Two hours before the ceremony,<br />Lola&apos;s flight was canceled.</>,
      after:  <>She watched the vows from Manila.<br />The livestream was already booked.</>,
    },
    {
      before: <>Saturday morning, the photographer&apos;s<br />hard drive died.</>,
      after:  <>Papic stitched the same-day edit<br />from every guest&apos;s phone by dinner.</>,
    },
  ];
  return (
    <Chapter num="08" dark style={{ padding: "200px 96px", gap: 0 }}>
      <Reveal>
        <div className="mono" style={{ fontSize: 12, color: "var(--orange-3)", letterSpacing: "0.20em", marginBottom: 28, textTransform: "uppercase" }}>
          One more thing.
        </div>
      </Reveal>
      <div style={{ display: "flex", flexDirection: "column", gap: 200 }}>
        {vignettes.map((v, i) => (
          <div key={i} style={{ maxWidth: 1100 }}>
            <Reveal>
              <p style={{ ...big("var(--paper)"), fontSize: 80 }}>{v.before}</p>
            </Reveal>
            <div style={{ height: 84 }} />
            <Reveal delay={400}>
              <p style={{ ...big("var(--orange-3)"), fontSize: 80 }}>{v.after}</p>
            </Reveal>
          </div>
        ))}
      </div>
      <Reveal delay={400}>
        <div style={{ marginTop: 80, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 80, height: 1, background: "var(--orange-3)" }} />
          <div className="mono" style={{
            fontSize: 13, color: "var(--orange-3)", letterSpacing: "0.20em",
            textTransform: "uppercase",
          }}>
            This is what we mean by &ldquo;set na &lsquo;yan.&rdquo;
          </div>
        </div>
      </Reveal>
    </Chapter>
  );
};

// ─── 09 · Why no one has done this ─────────────────────────────────────────
const Ch09WhyUs = () => (
  <Chapter num="09">
    <Reveal>
      <h2 style={{ ...big(), fontSize: 92, maxWidth: 1300 }}>
        No one has done this before<br />for a reason.
      </h2>
    </Reveal>
    <div style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, maxWidth: 1400 }}>
      {[
        { tag: "01 · COUPLES", body: "It needs the couples — actually planning a wedding inside it. Not a directory." },
        { tag: "02 · VENDORS", body: "It needs the vendors — making a living through it. Not a listing fee." },
        { tag: "03 · OPS TEAM", body: "It needs a Filipino ops team — hand-verifying every vendor, mediating disputes, scrambling backups." },
      ].map((c, i) => (
        <Reveal key={c.tag} delay={300 + i * 200}>
          <div style={{ padding: 28, background: "var(--paper-2)", borderRadius: 14, border: "1px solid var(--line-soft)", height: "100%" }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.10em" }}>{c.tag}</div>
            <p style={{ fontSize: 17, color: "var(--ink)", lineHeight: 1.55, margin: "16px 0 0", fontWeight: 400 }}>{c.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
    <Reveal delay={1100}>
      <div style={{
        marginTop: 72,
        fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 42,
        color: "var(--slate)", lineHeight: 1.3, maxWidth: 1000,
      }}>
        Most companies pick one. <span style={{ color: "var(--orange-2)" }}>We chose to do all three.</span>
      </div>
    </Reveal>
  </Chapter>
);

// ─── 10 · The new standard ─────────────────────────────────────────────────
const Ch10World = () => (
  <Chapter num="10">
    <Reveal>
      <h2 style={{ ...big(), fontSize: 92, maxWidth: 1300 }}>
        The Philippines hosts<br /><em style={{ color: "var(--orange-2)" }}>half a million weddings</em> a year.
      </h2>
    </Reveal>
    <Reveal delay={500}>
      <p style={{ fontSize: 22, color: "var(--slate)", lineHeight: 1.6, margin: "56px 0 0", maxWidth: 880 }}>
        It is the only major wedding market in the world that still runs entirely on
        Messenger, Google Sheets, and word of mouth — because no platform has put all
        three sides together.
      </p>
    </Reveal>
    <Reveal delay={1100}>
      <div style={{
        marginTop: 64, padding: "32px 40px",
        background: "var(--ink)", color: "var(--paper)",
        borderRadius: 16, maxWidth: 1000,
        display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center",
      }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.18em", textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          The new standard
        </div>
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 32,
          color: "var(--paper)", lineHeight: 1.35, margin: 0,
        }}>
          Setnayan is the first integrated platform for wedding creation —
          <span style={{ color: "var(--orange-3)" }}> built locally, designed for the world.</span>
        </p>
      </div>
    </Reveal>
  </Chapter>
);

// ─── 11 · The price · what's free ───────────────────────────────────────────
const Ch11Price = () => {
  const groups = [
    {
      tag: "Plan it",
      title: "Plan the wedding.",
      items: [
        "Guest List Maker",
        "Seat Plan",
        "Budget Tracker",
        "Scheduler",
        "Checklist · never miss a thing",
        "Inspiration Board",
        "Your personal monogram",
        "Your own wedding website",
      ],
    },
    {
      tag: "Find your vendors",
      title: "Find your people.",
      items: [
        "Recommended vendors for you",
        "Compare every quotation, side-by-side",
        "Bid to as many vendors as you want",
        "Chat directly with vendors",
        "Video call directly with vendors",
        "Invite outside vendors (Tita's florist welcome)",
        "Pick what best suits you",
      ],
    },
    {
      tag: "Trust comes free",
      title: "Plan with confidence.",
      items: [
        "Verified Badge on every vendor",
        "Real reviews from real Setnayan weddings",
        "Get notified when another bidder enters your schedule",
      ],
    },
  ];
  return (
    <Chapter num="11" center>
      <Reveal>
        <div style={{ ...display(), fontSize: 200, lineHeight: 0.96 }}>
          Free.
        </div>
      </Reveal>
      <Reveal delay={500}>
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 32, color: "var(--slate)",
          lineHeight: 1.35, margin: "40px auto 0", maxWidth: 820, fontWeight: 400,
        }}>
          Almost everything you need to plan a wedding,<br />
          <span style={{ color: "var(--ink)" }}>we give away.</span>
        </p>
      </Reveal>
      <Reveal delay={900}>
        <div className="mono" style={{
          fontSize: 12, color: "var(--orange-2)", margin: "32px auto 0", maxWidth: 700,
          letterSpacing: "0.20em", textTransform: "uppercase",
        }}>
          Eighteen things. All free, all forever.
        </div>
      </Reveal>

      <div style={{
        marginTop: 64, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
        maxWidth: 1320, width: "100%", margin: "64px auto 0",
      }}>
        {groups.map((g, i) => (
          <Reveal key={g.tag} delay={1100 + i * 200}>
            <div style={{
              padding: "30px 26px", background: "var(--paper-2)", borderRadius: 18,
              border: "1px solid var(--line-soft)",
              display: "flex", flexDirection: "column",
              minHeight: 480, textAlign: "left",
              position: "relative",
            }}>
              <div className="mono" style={{
                fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.18em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                ✓ {g.tag}
              </div>
              <div style={{
                fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
                fontSize: 36, color: "var(--ink)", lineHeight: 1.1,
                marginTop: 16, marginBottom: 24, letterSpacing: "-0.02em",
              }}>
                {g.title}
              </div>
              <ul style={{
                listStyle: "none", padding: 0, margin: 0,
                display: "flex", flexDirection: "column", gap: 12,
                fontFamily: "var(--sans)",
              }}>
                {g.items.map((item) => (
                  <li key={item} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    fontSize: 14, color: "var(--ink)", lineHeight: 1.45,
                  }}>
                    <span style={{
                      flex: "0 0 auto",
                      width: 6, height: 6, marginTop: 8,
                      borderRadius: "50%", background: "var(--orange)",
                    }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div style={{
                marginTop: "auto", paddingTop: 24,
                fontFamily: "var(--display)", fontWeight: 800, fontSize: 28,
                color: "var(--orange-2)", letterSpacing: "0.02em",
              }}>
                FREE.
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={2000}>
        <p style={{
          fontSize: 17, color: "var(--slate-2)", lineHeight: 1.7, margin: "72px auto 0",
          maxWidth: 800, fontFamily: "var(--sans)",
        }}>
          We created this app so we can lessen the burden of the small things that will eat up your
          time. And when you book your vendor, we have <strong style={{ color: "var(--ink)" }}>0% commission</strong>{" "}
          from them. We just want to make sure you get the best wedding for you.
        </p>
      </Reveal>
    </Chapter>
  );
};

// ─── 12 · One more thing · the founder reveal ──────────────────────────────
const Ch12Founder = () => (
  <Chapter num="12" dark center>
    <Reveal>
      <div className="mono" style={{ fontSize: 12, color: "var(--orange-3)", letterSpacing: "0.20em", marginBottom: 40, textTransform: "uppercase" }}>
        And one more thing.
      </div>
    </Reveal>
    <Reveal delay={400}>
      <h2 style={{ ...big("var(--paper)"), fontSize: 88, lineHeight: 1.1 }}>
        Our first wedding<br />
        ships <em style={{ color: "var(--orange-3)" }}>December 18, 2026.</em>
      </h2>
    </Reveal>
    <Reveal delay={1100}>
      <p style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 36, color: "var(--slate-4)",
        lineHeight: 1.4, margin: "64px auto 0", maxWidth: 760, fontWeight: 400,
      }}>
        It is ours.
      </p>
    </Reveal>
    <Reveal delay={1600}>
      <div className="mono" style={{
        fontSize: 13, color: "var(--orange-3)", letterSpacing: "0.20em",
        marginTop: 40, textTransform: "uppercase",
      }}>
        Claire &amp; Ice · Quezon City · the first wedding on Setnayan
      </div>
    </Reveal>
  </Chapter>
);

// ─── 13 · CTA ──────────────────────────────────────────────────────────────
const Ch13Sign = () => (
  <Chapter num="13" center style={{ background: "var(--ivory)" }}>
    <Reveal>
      <h2 style={{ ...big(), fontSize: 144 }}>
        Plan a wedding.<br />
        <span style={{ color: "var(--orange)" }}>Be married.</span>
      </h2>
    </Reveal>
    <Reveal delay={500}>
      <div style={{ marginTop: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <button className="btn btn-primary" style={{
          padding: "22px 64px", fontSize: 19, fontFamily: "var(--sans)",
          fontWeight: 500, letterSpacing: "0.02em",
        }}>
          Start  →
        </button>
        <a href="#" style={{ fontSize: 13, color: "var(--slate-2)", textDecoration: "none", marginTop: 6 }}>
          Apply to the pilot →
        </a>
      </div>
    </Reveal>
  </Chapter>
);

// ─── Footer ─────────────────────────────────────────────────────────────────
const KeynoteFooter = () => (
  <footer style={{
    padding: "40px 56px", borderTop: "1px solid var(--line-soft)", background: "var(--paper)",
    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
  }}>
    <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", letterSpacing: "0.10em" }}>
      © SETNAYAN 2026 · QUEZON CITY · THE KEYNOTE
    </div>
    <a href="Setnayan Site (Jobs+Ive).html" style={{ fontSize: 12, color: "var(--slate-2)", textDecoration: "none" }}>
      ← Back to home
    </a>
  </footer>
);

// ─── Compose ────────────────────────────────────────────────────────────────
window.KeynoteSite = function KeynoteSite() {
  return (
    <div style={{ position: "relative" }}>
      <KeynoteNav />
      <Ch01Greeting />
      <Ch02Problem />
      <Ch03Insight />
      <Ch04Name />
      <Ch05Three />
      <Ch06DemoPlanner />
      <Ch07Day />
      <Ch08Catastrophes />
      <Ch09WhyUs />
      <Ch10World />
      <Ch11Price />
      <Ch12Founder />
      <Ch13Sign />
      <KeynoteFooter />
    </div>
  );
};
