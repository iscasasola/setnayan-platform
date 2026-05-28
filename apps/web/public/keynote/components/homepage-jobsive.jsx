// Jobs/Ive variant of the customer homepage.
// Six sections. Maximum restraint. Juan & Maria are the entire site.

// ─── Couple override · Juan & Maria become the demo couple on this page ────
// CoupleDashboard reads SETNAYAN_DATA.event globally; override it before mount.
if (typeof SETNAYAN_DATA !== "undefined" && SETNAYAN_DATA.event) {
  Object.assign(SETNAYAN_DATA.event, {
    couple:    "Maria & Juan",
    date:      "12 · 12 · 2026",
    dateShort: "Dec 12, 2026",
    daysOut:   207,
  });
}

const JobsIveNav = () => (
  <nav style={{
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    padding: "32px 56px", display: "flex", justifyContent: "space-between", alignItems: "center",
  }}>
    <LogoFull height={30} />
    <div style={{ display: "flex", gap: 28, alignItems: "center", fontFamily: "var(--sans)" }}>
      <a href="Setnayan Keynote (Ternus).html" style={{ fontSize: 14, color: "var(--orange-2)", textDecoration: "none" }}>
        Look deeper →
      </a>
      <a href="#" style={{ fontSize: 14, color: "var(--slate)", textDecoration: "none" }}>
        Sign in →
      </a>
    </div>
  </nav>
);

// ─── Section 1 · The moment ─────────────────────────────────────────────────
const Section1Moment = () => (
  <section style={{
    minHeight: "100vh", padding: "180px 56px 140px",
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center",
    background: "var(--paper)", color: "var(--ink)",
  }}>
    <Reveal>
      <h1 style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
        fontSize: 144, lineHeight: 1.0, letterSpacing: "-0.04em", margin: 0,
        maxWidth: 1200, textWrap: "balance",
      }}>
        Maria said yes<br />on a Tuesday.
      </h1>
    </Reveal>
    <Reveal delay={500}>
      <p style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 30, color: "var(--slate)",
        lineHeight: 1.35, margin: "64px 0 0", maxWidth: 720, fontWeight: 400,
      }}>
        By Saturday, she had a venue,
        a guest list, and a photographer.
      </p>
    </Reveal>
    <Reveal delay={1100}>
      <div className="mono" style={{
        fontSize: 13, color: "var(--orange-2)", letterSpacing: "0.20em",
        marginTop: 96, textTransform: "uppercase",
      }}>
        She used one app.
      </div>
    </Reveal>
  </section>
);

// ─── Section 2 · The three promises ─────────────────────────────────────────
const Section2Promises = () => (
  <section style={{
    minHeight: "100vh", padding: "160px 96px",
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start",
    background: "var(--ivory)", color: "var(--ink)",
  }}>
    <div style={{ display: "flex", flexDirection: "column", maxWidth: 1100 }}>
      {[
        { line: "Find your people.",       hint: "" },
        { line: "Talk to every guest.",    hint: "" },
        { line: "Be there on the day.",    hint: "" },
      ].map((p, i) => (
        <Reveal key={p.line} delay={i * 320}>
          <div style={{
            fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
            fontSize: 120, lineHeight: 1.04, letterSpacing: "-0.035em",
            color: "var(--ink)",
            margin: "4px 0",
          }}>
            {p.line}
          </div>
        </Reveal>
      ))}
      <Reveal delay={1200}>
        <div style={{
          marginTop: 72, display: "flex", alignItems: "center", gap: 18,
        }}>
          <div style={{ width: 80, height: 1, background: "var(--ink)" }} />
          <div style={{
            fontFamily: "var(--display)", fontWeight: 800, fontSize: 28,
            color: "var(--ink)", letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            One Setnayan.
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

// ─── Section 3 · The demo ───────────────────────────────────────────────────
const Section3Demo = () => (
  <section style={{
    padding: "140px 56px",
    background: "var(--paper)",
    display: "flex", flexDirection: "column", alignItems: "center",
  }}>
    <Reveal>
      <div style={{ maxWidth: 880, textAlign: "center", marginBottom: 64 }}>
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
          fontSize: 56, color: "var(--ink)",
          lineHeight: 1.15, margin: 0, letterSpacing: "-0.02em",
        }}>
          This is Maria &amp; Juan's planner.<br />
          <span style={{ color: "var(--slate-2)" }}>December 12, 2026.</span>
        </p>
      </div>
    </Reveal>
    <Reveal delay={300}>
      <div style={{
        width: "100%", maxWidth: 1320,
        height: 760, overflow: "hidden",
        borderRadius: 18,
        border: "1px solid var(--line)",
        boxShadow: "0 40px 100px rgba(31, 26, 23, 0.14), 0 12px 32px rgba(31, 26, 23, 0.06)",
        background: "var(--paper-2)",
      }}>
        <div style={{ width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none", userSelect: "none" }}>
          <CoupleDashboard role="couple" setRole={() => {}} />
        </div>
      </div>
    </Reveal>
    <Reveal delay={700}>
      <div className="mono" style={{
        marginTop: 40, fontSize: 12, color: "var(--slate-3)", letterSpacing: "0.20em", textTransform: "uppercase",
      }}>
        Try it. The data is real.
      </div>
    </Reveal>
  </section>
);

// ─── Section 4 · Three averted catastrophes ────────────────────────────────
const Section4Florist = () => {
  const vignettes = [
    {
      before: <>Three days before the wedding,<br />Maria &amp; Juan's florist canceled.</>,
      after:  <>Setnayan rerouted to a backup.<br />They found out at the reception.</>,
    },
    {
      before: <>Two hours before the ceremony,<br />Lola's flight was canceled.</>,
      after:  <>She watched the vows from Manila.<br />The livestream was already booked.</>,
    },
    {
      before: <>Saturday morning, the photographer's<br />hard drive died.</>,
      after:  <>Papic stitched the same-day edit<br />from every guest's phone by dinner.</>,
    },
  ];

  return (
    <section style={{
      padding: "200px 96px",
      background: "var(--ink)", color: "var(--paper)",
      display: "flex", flexDirection: "column", gap: 200,
    }}>
      {vignettes.map((v, i) => (
        <div key={i} style={{ maxWidth: 1100 }}>
          <Reveal>
            <p style={{
              fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
              fontSize: 84, lineHeight: 1.06, color: "var(--paper)",
              letterSpacing: "-0.025em", margin: 0,
            }}>
              {v.before}
            </p>
          </Reveal>
          <div style={{ height: 96 }} />
          <Reveal delay={500}>
            <p style={{
              fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
              fontSize: 84, lineHeight: 1.06, color: "var(--orange-3)",
              letterSpacing: "-0.025em", margin: 0,
            }}>
              {v.after}
            </p>
          </Reveal>
        </div>
      ))}

      <Reveal delay={400}>
        <div style={{ maxWidth: 1100, display: "flex", alignItems: "center", gap: 18, marginTop: 40 }}>
          <div style={{ width: 80, height: 1, background: "var(--orange-3)" }} />
          <div className="mono" style={{
            fontSize: 13, color: "var(--orange-3)", letterSpacing: "0.20em",
            textTransform: "uppercase",
          }}>
            This is what we mean by &ldquo;set na &lsquo;yan.&rdquo;
          </div>
        </div>
      </Reveal>
    </section>
  );
};

// ─── Section 4½ · A moment, shared ────────────────────────────────────────
// Release valve after three catastrophes. Paper/cream, intimate, centered.
const Section4HalfKiss = () => (
  <section style={{
    minHeight: "85vh", padding: "200px 56px",
    background: "var(--paper)",
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center",
  }}>
    <div style={{ maxWidth: 1000 }}>
      <Reveal>
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
          fontSize: 116, lineHeight: 1.04, color: "var(--ink)",
          letterSpacing: "-0.035em", margin: 0,
        }}>
          A kiss, captured.
        </p>
      </Reveal>
      <div style={{ height: 64 }} />
      <Reveal delay={500}>
        <p style={{
          fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
          fontSize: 78, lineHeight: 1.12, color: "var(--orange-2)",
          letterSpacing: "-0.025em", margin: 0,
        }}>
          Two hundred guests saw it<br />
          before the bride sat down.
        </p>
      </Reveal>
    </div>
  </section>
);

// ─── Section 5 · The price ──────────────────────────────────────────────────
const Section5Price = () => (
  <section style={{
    minHeight: "90vh", padding: "180px 56px",
    background: "var(--paper)",
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center",
  }}>
    <Reveal>
      <div style={{
        fontFamily: "var(--display)", fontWeight: 800,
        fontSize: 260, lineHeight: 0.96, color: "var(--ink)",
        letterSpacing: "-0.045em", margin: 0,
      }}>
        Free.
      </div>
    </Reveal>
    <Reveal delay={500}>
      <p style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, color: "var(--slate)",
        lineHeight: 1.4, margin: "56px 0 0", maxWidth: 680, fontWeight: 400,
      }}>
        Vendor prices are all-in.
        You see what they list. You pay what you see.
      </p>
    </Reveal>
  </section>
);

// ─── Section 6 · Sign up ────────────────────────────────────────────────────
const Section6SignUp = () => (
  <section style={{
    minHeight: "90vh", padding: "180px 56px",
    background: "var(--ivory)",
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center",
  }}>
    <Reveal>
      <h2 style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
        fontSize: 144, lineHeight: 0.98, letterSpacing: "-0.04em", margin: 0,
        textWrap: "balance",
      }}>
        Plan a wedding.<br />
        <span style={{ color: "var(--orange)" }}>Be married.</span>
      </h2>
    </Reveal>
    <Reveal delay={500}>
      <div style={{ marginTop: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <button className="btn btn-primary" style={{
          padding: "20px 56px", fontSize: 18, fontFamily: "var(--sans)",
          fontWeight: 500, letterSpacing: "0.02em",
        }}>
          Start  →
        </button>
        <a href="#" style={{ fontSize: 13, color: "var(--slate-2)", textDecoration: "none", marginTop: 6 }}>
          Already on Setnayan? Sign in
        </a>
      </div>
    </Reveal>
  </section>
);

// ─── Section 6½ · Look deeper ─────────────────────────────────────────────
const SectionLookDeeper = () => (
  <section style={{
    padding: "140px 56px 160px",
    background: "var(--paper)",
    borderTop: "1px solid var(--line-soft)",
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  }}>
    <Reveal>
      <div className="mono" style={{
        fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.22em",
        textTransform: "uppercase", marginBottom: 24,
      }}>
        └ For the curious
      </div>
    </Reveal>
    <Reveal delay={200}>
      <p style={{
        fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400,
        fontSize: 72, lineHeight: 1.05, color: "var(--ink)",
        letterSpacing: "-0.03em", margin: 0, maxWidth: 1000,
      }}>
        Want to see how it all works?
      </p>
    </Reveal>
    <Reveal delay={500}>
      <a href="Setnayan Keynote (Ternus).html" style={{
        marginTop: 56, display: "inline-flex", alignItems: "center", gap: 14,
        padding: "18px 32px",
        background: "var(--ink)", color: "var(--paper)",
        borderRadius: 999, textDecoration: "none",
        fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500,
        letterSpacing: "0.01em",
        boxShadow: "0 20px 50px rgba(31, 26, 23, 0.18)",
      }}>
        <LogoMark size={22} />
        Look deeper on what Setnayan offers
        <span style={{ color: "var(--orange-3)" }}>→</span>
      </a>
    </Reveal>
    <Reveal delay={800}>
      <div className="mono" style={{
        fontSize: 11, color: "var(--slate-3)", letterSpacing: "0.16em",
        textTransform: "uppercase", marginTop: 28,
      }}>
        Engineering walkthrough · 13 chapters · ≈10 min read
      </div>
    </Reveal>
  </section>
);

// ─── Footer ─────────────────────────────────────────────────────────────────
const SectionTheName = () => (
  <section style={{
    padding: "160px 56px 180px",
    background: "var(--paper)",
    borderTop: "1px solid var(--line-soft)",
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
  }}>
    <Reveal>
      <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 28 }}>About the name</div>
    </Reveal>
    <Reveal delay={200}>
      <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 144, lineHeight: 1.0, color: "var(--ink)", letterSpacing: "-0.04em", margin: 0 }}>
        Set na &lsquo;yan.
      </p>
    </Reveal>
    <Reveal delay={500}>
      <div className="mono" style={{ fontSize: 14, color: "var(--slate-2)", letterSpacing: "0.16em", marginTop: 28 }}>/sɛt na jan/ · Filipino</div>
    </Reveal>
    <Reveal delay={800}>
      <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, color: "var(--slate)", lineHeight: 1.45, margin: "56px auto 0", maxWidth: 720, fontWeight: 400 }}>
        What you say when everything&apos;s finally been figured out — when the chairs are set, the guests are seated, the music&apos;s queued. When the work is done and you can exhale.
      </p>
    </Reveal>
    <Reveal delay={1200}>
      <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 36, color: "var(--orange-2)", lineHeight: 1.3, margin: "72px auto 0", maxWidth: 760, fontWeight: 400 }}>
        That&apos;s the feeling we built the app around.<br />That&apos;s the wedding you&apos;re about to have.
      </p>
    </Reveal>
  </section>
);

const JobsIveFooter = () => (
  <footer style={{
    padding: "32px 56px", borderTop: "1px solid var(--line-soft)", background: "var(--paper)",
    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
  }}>
    <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", letterSpacing: "0.10em" }}>
      © SETNAYAN 2026 · QUEZON CITY
    </div>
    <div style={{ display: "flex", gap: 28, fontSize: 12, color: "var(--slate-2)", fontFamily: "var(--sans)" }}>
      <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
      <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
      <a href="#" style={{ color: "inherit", textDecoration: "none" }}>For vendors</a>
    </div>
  </footer>
);

// ─── Compose ────────────────────────────────────────────────────────────────
window.JobsIveSite = function JobsIveSite() {
  return (
    <div style={{ position: "relative" }}>
      <JobsIveNav />
      <Section1Moment />
      <Section2Promises />
      <Section3Demo />
      <Section4Florist />
      <Section4HalfKiss />
      <Section5Price />
      <Section6SignUp />
      <SectionLookDeeper />
      <SectionTheName />
      <JobsIveFooter />
    </div>
  );
};
