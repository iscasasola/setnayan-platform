// Guest microsite — the public page each guest lands on when scanning their
// personal QR. /claire-ice-1212. Lives at app.setnayan.com/<event-slug>.
// This is THE magical surface — gets full motion treatment.

const GuestMicrosite = () => {
  const [rsvp, setRsvp] = useState("pending");
  const [tab, setTab] = useState("home");
  const tabs = ["home", "story", "schedule", "rsvp", "venue", "gallery", "livestream"];

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--sans)", minHeight: "100%" }}>
      {/* Top bar — quiet, just lang + brand */}
      <div style={{ padding: "14px 56px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line-soft)" }}>
        <LogoFull height={22} />
        <div style={{ display: "flex", gap: 14, alignItems: "center", fontFamily: "var(--mono)", fontSize: 11, color: "var(--slate-2)" }}>
          <span>You are · <span style={{ color: "var(--orange-2)" }}>Patricia Cruz</span></span>
          <span>·</span>
          <div style={{ display: "flex", gap: 4, background: "var(--paper-2)", borderRadius: 999, padding: 3, border: "1px solid var(--line)" }}>
            {["EN", "TL", "CEB"].map((l, i) => (
              <span key={l} style={{
                padding: "3px 9px", borderRadius: 999,
                background: i === 0 ? "var(--ink)" : "transparent",
                color: i === 0 ? "var(--paper)" : "var(--slate-2)",
                fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer",
              }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Hero — couple's name + date with gradient mesh */}
      <section style={{ position: "relative", padding: "64px 32px 56px", overflow: "hidden", textAlign: "center" }}>
        <Blob top={-40} left="20%" size={520} color="var(--orange)" opacity={0.16} />
        <Blob top={40} right="15%" size={420} color="var(--blush)" opacity={0.22} />
        <Reveal>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.20em", color: "var(--slate-2)", textTransform: "uppercase" }}>
            Save the date · A Saturday in December
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="serif" style={{
            fontSize: 132, lineHeight: 0.96, margin: "32px 0 0",
            color: "var(--ink)", letterSpacing: "-0.035em", fontStyle: "italic",
            fontWeight: 400,
          }}>
            Maria<br />
            <span style={{ fontStyle: "normal", fontSize: 64, color: "var(--orange-2)" }}>&amp;</span><br />
            Ice
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <div className="mono" style={{ fontSize: 14, letterSpacing: "0.20em", color: "var(--ink)", textTransform: "uppercase", marginTop: 36 }}>
            18 · 12 · 2026 · La Castellana
          </div>
        </Reveal>
        <Reveal delay={320}>
          <Countdown target="2026-12-12T16:00:00+08:00" />
        </Reveal>
      </section>

      {/* Tab nav (sticky-like in the design) */}
      <nav style={{ padding: "0 56px", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 0, position: "sticky", top: 0, background: "rgba(251,248,242,0.92)", backdropFilter: "blur(10px)", zIndex: 5 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "transparent", border: "none", cursor: "pointer",
            padding: "16px 22px", fontFamily: "var(--mono)", fontSize: 11,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: tab === t ? "var(--orange-2)" : "var(--slate-2)",
            borderBottom: tab === t ? "2px solid var(--orange)" : "2px solid transparent",
            marginBottom: -1,
          }}>{t}</button>
        ))}
      </nav>

      {/* RSVP card — anchor */}
      <section id="rsvp" style={{ padding: "clamp(40px, 8vw, 96px) clamp(16px, 5vw, 56px)", background: "var(--paper-2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: "clamp(28px, 4vw, 56px)", maxWidth: 1200, margin: "0 auto" }}>
          <Reveal>
            <div className="label-mono">Your invitation</div>
            <h2 className="serif" style={{ fontSize: 64, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "12px 0 0", color: "var(--ink)" }}>
              <em style={{ fontStyle: "italic" }}>Patricia,</em><br />we'd love<br />to have you.
            </h2>
            <p style={{ fontSize: 15, color: "var(--slate)", lineHeight: 1.6, marginTop: 22, maxWidth: 460 }}>
              Claire and Ice are getting married on December 12, 2026 at La Castellana Estate
              in Negros Occidental. The ceremony begins at 4 pm. Reception follows at 6 pm.
              Please confirm by November 28.
            </p>
            <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 18, letterSpacing: "0.06em" }}>
              Your seat · Table 6 · Bride's friends
            </div>
          </Reveal>
          <Reveal delay={180}>
            <div className="card" style={{ padding: "clamp(20px, 4vw, 32px)", background: "var(--paper)" }}>
              <div className="label-mono">RSVP · close 28 Nov</div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, color: "var(--ink)", textTransform: "uppercase", marginTop: 8 }}>
                Will you be there?
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 20 }}>
                {[
                  { id: "yes",     label: "Yes, I'll be there",  sub: "Maraming salamat 💛", bg: "var(--orange)" },
                  { id: "maybe",   label: "Tentatively",         sub: "We'll follow up",      bg: "var(--paper-2)" },
                  { id: "no",      label: "Can't make it",       sub: "We'll miss you",       bg: "var(--paper-2)" },
                ].map(opt => {
                  const on = rsvp === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setRsvp(opt.id)} style={{
                      background: on ? opt.bg : "var(--paper)",
                      border: "1px solid " + (on ? opt.bg : "var(--line)"),
                      color: on && opt.id === "yes" ? "#fff" : on ? "var(--ink)" : "var(--ink)",
                      padding: "16px 14px", borderRadius: 10, cursor: "pointer",
                      fontFamily: "var(--sans)", textAlign: "center",
                      transition: "transform .15s, background .15s, border-color .15s",
                      transform: on ? "translateY(-2px)" : "translateY(0)",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{opt.label}</div>
                      <div className="mono" style={{ fontSize: 10, marginTop: 4, opacity: 0.85 }}>{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
              {rsvp === "yes" && (
                <div style={{ marginTop: 18, padding: 18, background: "var(--orange-4)", borderRadius: 10 }}>
                  <div className="label-mono" style={{ color: "var(--orange-2)" }}>Quick details · 2 minutes</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                    {[
                      { k: "Bringing a +1?",       v: "Yes — Mark" },
                      { k: "Dietary preferences",  v: "No restrictions" },
                      { k: "Song request",         v: "Tadhana — Up Dharma Down" },
                    ].map(f => (
                      <div key={f.k} style={{ display: "grid", gridTemplateColumns: "minmax(0, 160px) 1fr", gap: 12, padding: "8px 12px", background: "var(--paper)", borderRadius: 6, fontSize: 13 }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>{f.k}</span>
                        <span style={{ color: "var(--ink)" }}>{f.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--sage-deep)", marginTop: 12 }}>✓ Saved · Claire & Ice can see this</div>
                </div>
              )}
              <div style={{ marginTop: 18, padding: 14, background: "var(--ivory)", borderRadius: 8, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, background: `repeating-conic-gradient(var(--ink) 0% 25%, var(--paper) 0% 50%) 50% / 6px 6px`, borderRadius: 4 }} />
                <div>
                  <div className="label-mono" style={{ fontSize: 9 }}>Personal QR · ci-014</div>
                  <div style={{ fontSize: 12, color: "var(--ink)", marginTop: 2 }}>Show at the door · maps to your seat</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>Add to Apple Wallet</button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Story section — serif, intimate */}
      <section id="story" style={{ padding: "96px 56px", maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <div className="label-mono">Our story</div>
          <h2 className="serif" style={{ fontSize: 56, lineHeight: 1.06, letterSpacing: "-0.02em", margin: "12px 0 0", color: "var(--ink)" }}>
            How <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>two architects</em> met in line for chicken.
          </h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 56, marginTop: 40 }}>
          <Reveal delay={120}>
            <div className="serif" style={{ fontSize: 19, color: "var(--ink)", lineHeight: 1.7 }}>
              <p style={{ margin: 0 }}>
                <span style={{ float: "left", fontSize: 64, lineHeight: 0.85, marginRight: 10, marginTop: 4, color: "var(--orange)" }}>M</span>
                aria was in line at Mang Inasal in QC, March 2021. Ice, also waiting, asked
                if she knew the trick to getting extra sauce. She did. They've been arguing
                about chicken ever since.
              </p>
              <p style={{ marginTop: 18 }}>
                Four years, two condo renovations, and one stray cat (Bisaya) later, here we
                are. Pastor Reyes will marry us at sunset, in the same garden where Ice's
                Lola was married in 1964.
              </p>
              <p className="serif" style={{ marginTop: 18, fontStyle: "italic", color: "var(--orange-2)" }}>
                We hope you'll be there.
              </p>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="photo-placeholder" style={{ aspectRatio: "4/5", borderRadius: 4 }}>
              <span className="pp-label">prenup · Antipolo · golden hour</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Schedule */}
      <section id="schedule" style={{ padding: "96px 56px", background: "var(--paper-2)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div className="label-mono">The day · 18 December 2026</div>
            <h2 className="serif" style={{ fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "12px 0 0", color: "var(--ink)" }}>
              <em style={{ fontStyle: "italic" }}>From four o'clock</em><br />until midnight.
            </h2>
          </Reveal>
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { t: "2:30 pm",  label: "Doors open · cocktail hour begins", venue: "East garden" },
              { t: "4:00 pm",  label: "Ceremony begins", venue: "Chapel · main lawn",       hero: true },
              { t: "5:00 pm",  label: "Pictorial · principal sponsors first", venue: "Garden steps" },
              { t: "6:30 pm",  label: "Reception · Filipino-Spanish menu", venue: "Heritage hall" },
              { t: "7:30 pm",  label: "Toasts + first dance", venue: "Heritage hall" },
              { t: "9:00 pm",  label: "Dancing · Manong Romy Trio", venue: "Garden stage" },
              { t: "11:30 pm", label: "Last call · sparkler send-off", venue: "Front lawn" },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 60}>
                <div style={{
                  display: "grid", gridTemplateColumns: "120px auto 1fr auto", gap: 18,
                  padding: "18px 0", alignItems: "center",
                  borderTop: i === 0 ? "1px solid var(--line)" : "none",
                  borderBottom: "1px solid var(--line)",
                  background: s.hero ? "var(--orange-4)" : "transparent",
                  paddingLeft: s.hero ? 18 : 0, paddingRight: s.hero ? 18 : 0,
                  borderRadius: s.hero ? 12 : 0,
                }}>
                  <div className="mono" style={{ fontSize: 14, color: s.hero ? "var(--orange-2)" : "var(--ink)", fontWeight: 500 }}>{s.t}</div>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.hero ? "var(--orange)" : "var(--line)" }} />
                  <div style={{ fontSize: s.hero ? 22 : 17, color: "var(--ink)", fontFamily: s.hero ? "var(--serif)" : "var(--sans)", fontStyle: s.hero ? "italic" : "normal", fontWeight: s.hero ? 400 : 400 }}>
                    {s.label}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>{s.venue}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Venue + livestream + dress code */}
      <section id="venue" style={{ padding: "96px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, maxWidth: 1200, margin: "0 auto" }}>
          <Reveal>
            <div className="label-mono">Venue · La Castellana Estate</div>
            <h2 className="serif" style={{ fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "12px 0 24px", color: "var(--ink)" }}>
              <em style={{ fontStyle: "italic" }}>A 1920s sugarbarón estate</em><br />in Negros Occidental.
            </h2>
            <div className="photo-placeholder" style={{ aspectRatio: "16/9", borderRadius: 8 }}>
              <span className="pp-label">venue · aerial · golden hour</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 14, lineHeight: 1.6 }}>
              Hacienda Rosalia · La Castellana, Negros Occidental, 6131 · 90 min from Bacolod Airport · valet parking from 2 pm
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" style={{ padding: "10px 16px", fontSize: 13 }}>Open in Maps</button>
              <button className="btn btn-ghost" style={{ padding: "10px 16px", fontSize: 13 }}>Drive directions →</button>
            </div>
          </Reveal>
          <Reveal delay={180}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 22 }}>
                <div className="label-mono">Dress code</div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", marginTop: 6 }}>
                  Filipiniana evening
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {["#F4ECD8", "#E28300", "#1E2229", "#FBFBFA"].map(c => (
                    <div key={c} style={{ width: 36, height: 36, borderRadius: "50%", background: c, border: "1px solid var(--line)" }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 10, lineHeight: 1.5 }}>
                  Bride's-side warm tones. Barong Tagalog encouraged for men. Floor-length for ladies.
                </div>
              </div>
              <div className="card" style={{ padding: 22, background: "var(--ink)", color: "var(--paper)", border: "none" }}>
                <div className="label-mono" style={{ color: "var(--orange-3)" }}>Can't be there?</div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--paper)", textTransform: "uppercase", marginTop: 6 }}>
                  We're livestreaming
                </div>
                <div style={{ fontSize: 12, color: "var(--slate-4)", marginTop: 10, lineHeight: 1.5 }}>
                  4 cameras · ceremony, walk-down, reception, dance floor. Subscribe and we'll
                  text you 10 minutes before we go live.
                </div>
                <button className="btn btn-orange" style={{ padding: "10px 16px", fontSize: 12, marginTop: 14 }}>
                  Subscribe to livestream →
                </button>
              </div>
              <div className="card" style={{ padding: 22 }}>
                <div className="label-mono">Gifts</div>
                <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 8, lineHeight: 1.6 }}>
                  Your presence is the gift. If you must — there's a registry at our home
                  fund, or send to GCash. We'd rather you take that taxi.
                </div>
                <a href="#" style={{ color: "var(--orange-2)", fontSize: 12, marginTop: 10, display: "inline-block", textDecoration: "none" }}>Open registry →</a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Camera access · activates on the wedding day */}
      <section id="papic" style={{ padding: "96px 56px", background: "var(--paper)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 56, maxWidth: 1200, margin: "0 auto", alignItems: "center" }}>
          <Reveal>
            <div className="label-mono" style={{ color: "var(--orange-2)" }}>On the day · 18 Dec 2026</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "10px 0 16px", color: "var(--ink)", fontWeight: 400 }}>
              Be one of <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>our paparazzi.</em>
            </h2>
            <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.65, maxWidth: 480 }}>
              On Claire &amp; Ice's wedding day, your phone camera can become part of the
              photo crew. Tap once, point and shoot — every photo lands instantly in their
              gallery, auto-tagged with your name and the table you're sitting at.
            </p>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { k: "Activates",    v: "T−1 hour · 3:00 pm" },
                { k: "Permission",   v: "Camera + Photos · revocable" },
                { k: "Privacy",      v: "Only photos you tap to send · nothing auto-uploads" },
                { k: "Auto-sorting", v: "Tagged by table + time · ceremony / reception" },
              ].map(d => (
                <div key={d.k} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 14, padding: "8px 12px", background: "var(--paper-2)", borderRadius: 6, fontSize: 12 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>{d.k}</span>
                  <span style={{ color: "var(--ink)" }}>{d.v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
              <button className="btn btn-primary" style={{ padding: "12px 20px", fontSize: 13 }}>I'll be Papic crew</button>
              <button className="btn btn-ghost" style={{ padding: "12px 20px", fontSize: 13 }}>Maybe later</button>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", marginTop: 14, lineHeight: 1.5 }}>
              Designed for friends &amp; family · no app download · works in your browser ·
              you control what gets sent
            </div>
          </Reveal>

          {/* Permission prompt mock */}
          <Reveal delay={150}>
            <div style={{ width: 320, margin: "0 auto", background: "var(--ink)", borderRadius: 36, padding: 8, boxShadow: "var(--shadow-lg)" }}>
              <div style={{ background: "var(--paper)", borderRadius: 28, overflow: "hidden", padding: "30px 18px 24px", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, margin: "0 auto 16px", background: "var(--orange-4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="4" y="9" width="24" height="17" rx="3" stroke="var(--orange-2)" strokeWidth="2" />
                    <circle cx="16" cy="17" r="4" stroke="var(--orange-2)" strokeWidth="2" />
                    <path d="M11 9 L13 6 L19 6 L21 9" stroke="var(--orange-2)" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", lineHeight: 1.1 }}>
                  Allow camera access
                </div>
                <div className="serif" style={{ fontStyle: "italic", fontSize: 15, color: "var(--slate)", marginTop: 6 }}>
                  for Claire &amp; Ice's wedding
                </div>
                <div style={{ fontSize: 12, color: "var(--slate)", lineHeight: 1.55, marginTop: 14, textAlign: "left", padding: "12px 14px", background: "var(--paper-2)", borderRadius: 10 }}>
                  Setnayan would like to use your camera so you can send photos directly to
                  Claire &amp; Ice's gallery during their wedding.
                  <div style={{ marginTop: 8 }}>
                    <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Nothing uploads automatically.</strong>{" "}
                    Every photo waits for you to tap Send.
                  </div>
                </div>
                <button style={{ width: "100%", marginTop: 16, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 14, fontFamily: "var(--sans)", fontWeight: 500 }}>
                  Allow camera
                </button>
                <button style={{ width: "100%", marginTop: 6, background: "transparent", color: "var(--slate)", border: "none", padding: "10px 16px", fontSize: 12, fontFamily: "var(--sans)" }}>
                  Not now
                </button>
                <div className="mono" style={{ fontSize: 9, color: "var(--slate-3)", marginTop: 10, lineHeight: 1.4 }}>
                  Permission can be revoked anytime in your browser settings · GDPR &amp; RA 10173 compliant
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Gallery — parallax photo strip */}
      <section id="gallery" style={{ padding: "96px 56px", background: "var(--ink)", color: "var(--paper)", overflow: "hidden" }}>
        <div className="label-mono" style={{ color: "var(--orange-3)" }}>Gallery</div>
        <h2 className="serif" style={{ fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "12px 0 32px", color: "var(--paper)" }}>
          Photos from <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>the day,</em><br />updated live.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {[
            { h: 260, t: "ceremony · 4:14" },
            { h: 320, t: "first kiss" },
            { h: 240, t: "lola + lolo" },
            { h: 300, t: "tita squad" },
            { h: 260, t: "first dance" },
            { h: 340, t: "send-off" },
          ].map((p, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="photo-placeholder" style={{ height: p.h, borderRadius: 6, filter: "brightness(0.9) sepia(0.1)" }}>
                <span className="pp-label">{p.t}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 24, display: "flex", justifyContent: "space-between" }}>
          <span>2,184 photos · uploaded by 4 Papic-tagged friends + Studio Sereno</span>
          <a href="#" style={{ color: "var(--orange-3)", textDecoration: "none" }}>Download full-res ↓</a>
        </div>
      </section>

      {/* Footer — quiet */}
      <footer style={{ padding: "48px 56px", textAlign: "center", borderTop: "1px solid var(--line)" }}>
        <div className="serif" style={{ fontSize: 24, fontStyle: "italic", color: "var(--orange-2)" }}>
          See you on the 12th.
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-3)", marginTop: 14, letterSpacing: "0.08em" }}>
          Made with Setnayan · Claire & Ice · app.setnayan.com/claire-ice-1212
        </div>
      </footer>
    </div>
  );
};

const Countdown = ({ target }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return (
    <div style={{ marginTop: 48, display: "inline-flex", gap: 24 }}>
      {[
        { v: d, k: "days" },
        { v: h, k: "hrs"  },
        { v: m, k: "min"  },
        { v: s, k: "sec"  },
      ].map(u => (
        <div key={u.k}>
          <div className="display" style={{ fontSize: 56, color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {String(u.v).padStart(2, "0")}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 4, letterSpacing: "0.16em", textTransform: "uppercase" }}>{u.k}</div>
        </div>
      ))}
    </div>
  );
};

const { useEffect } = React;

Object.assign(window, { GuestMicrosite });
