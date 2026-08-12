// Vendor public microsite — what couples see when they click a vendor in the marketplace.
// Showcases reviews, creations (portfolio), prices, packages. Ato Catering as the example.

const VendorMicrosite = () => {
  const [pkg, setPkg] = useState("classic");
  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--sans)" }}>
      {/* Quiet top bar */}
      <div style={{ padding: "14px 56px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LogoFull height={22} />
          <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>← Back to marketplace</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>♡ Save to shortlist</button>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>Share ↗</button>
        </div>
      </div>

      {/* Cover hero */}
      <section style={{ position: "relative" }}>
        <div className="photo-placeholder" style={{ aspectRatio: "32/10" }}>
          <span className="pp-label">cover · catering hero shot · 1920×600</span>
        </div>
      </section>

      {/* Vendor identity */}
      <section style={{ padding: "32px 56px 0", display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "flex-end", marginTop: -60, position: "relative", zIndex: 2 }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            <div style={{ width: 120, height: 120, borderRadius: 16, background: "var(--ink)", border: "4px solid var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--orange)", fontFamily: "var(--display)", fontSize: 48, fontWeight: 800, boxShadow: "var(--shadow-md)" }}>
              A
            </div>
            <div style={{ paddingBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Catering</span>
                <span className="pill pill-orange" style={{ fontSize: 10, padding: "3px 8px" }}>✓ Verified</span>
                <span className="pill" style={{ background: "var(--paper-2)", fontSize: 10, padding: "3px 8px" }}>Responds in ~2h</span>
              </div>
              <h1 className="display" style={{ fontSize: 64, margin: 0, lineHeight: 1, color: "var(--ink)" }}>
                ATO CATERING
              </h1>
              <div className="mono" style={{ fontSize: 12, color: "var(--slate-2)", marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>★ 4.92 · 38 reviews</span>
                <span>·</span>
                <span>Quezon City</span>
                <span>·</span>
                <span>14 weddings this year</span>
                <span>·</span>
                <span>since Aug 2026</span>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div style={{ display: "flex", gap: 10, paddingBottom: 8 }}>
            <button className="btn btn-ghost" style={{ padding: "12px 18px" }}>Check availability</button>
            <button className="btn btn-orange btn-lg">Send inquiry</button>
          </div>
        </Reveal>
      </section>

      {/* Quick nav */}
      <nav style={{ padding: "32px 56px 0", display: "flex", gap: 32, fontSize: 13, borderBottom: "1px solid var(--line-soft)" }}>
        {["About", "Packages", "Portfolio", "Reviews", "Availability", "FAQ"].map((t, i) => (
          <a key={t} href={"#" + t.toLowerCase()} style={{
            color: i === 0 ? "var(--ink)" : "var(--slate)", textDecoration: "none",
            paddingBottom: 12, borderBottom: i === 0 ? "2px solid var(--orange)" : "2px solid transparent",
            marginBottom: -1, fontFamily: "var(--sans)", fontWeight: i === 0 ? 500 : 400,
          }}>{t}</a>
        ))}
      </nav>

      {/* About */}
      <section id="about" style={{ padding: "64px 56px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 56 }}>
        <Reveal>
          <div className="label-mono">About</div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "10px 0 0", color: "var(--ink)", fontWeight: 400 }}>
            Filipino-leaning catering with{" "}
            <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>a deft hand on continental.</em>
          </h2>
          <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.65, marginTop: 22, maxWidth: 600 }}>
            Joey Castro started Ato in his lola's kitchen in 2019. Today it's a 28-person crew
            serving sit-down receptions of 80–400 across Luzon. Halal kitchen on-site, vegan
            menu by default, separate crew-meal kitchen so your photographers don't go hungry.
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Sit-down 80–400", "Buffet", "Cocktail hour", "Crew meals", "Halal kitchen", "Vegan menu", "Filipiniana", "Filipino-Spanish", "Continental"].map(t =>
              <span key={t} className="pill" style={{ background: "var(--paper-2)" }}>{t}</span>
            )}
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Weddings", "14 this year · 38 lifetime"],
              ["Avg rating", "4.92 ★ across 38 reviews"],
              ["Response time", "under 2 hours · M-F"],
              ["Repeat coordinators", "9 (out of 12 working with us)"],
              ["Setnayan Verified", "since Aug 2026"],
              ["BIR-registered", "TIN 240-441-882"],
              ["DTI", "BN 1841-2019"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 8, background: "var(--paper-2)" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)" }}>{k}</span>
                <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Packages */}
      <section id="packages" style={{ padding: "64px 56px", background: "var(--paper-2)" }}>
        <div className="label-mono">Packages · listed prices, all-in</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "10px 0 36px", color: "var(--ink)", fontWeight: 400 }}>
          Three ways to{" "}
          <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>feed your wedding.</em>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            {
              id: "classic",
              tag: "Everyday",
              title: "Buffet · classic Filipino",
              pax: "from 100 pax",
              price: "₱950 / head",
              body: "Classic Filipino buffet — soup, two mains (chicken or pork), rice, sides, fresh fruit dessert. Honest, abundant, no fuss.",
              includes: ["Crew of 14", "Open buffet", "Fresh-fruit dessert", "Wedding cake service", "Proper receipt"],
            },
            {
              id: "festival",
              tag: "Classic",
              title: "Sit-down · 4 courses",
              pax: "from 120 pax",
              price: "₱1,500 / head",
              body: "Filipino-Spanish menu. Soup or salad, two protein options (pork or fish), plated sides, dessert course. Lechon add-on optional.",
              includes: ["Crew of 18", "Sit-down service", "Plated dessert", "Lechon add-on ₱22K", "Halal / vegan mirror"],
            },
            {
              id: "intimate",
              tag: "Signature",
              title: "Family-style · long table",
              pax: "from 50 pax",
              price: "₱2,200 / head",
              body: "Long-table family-style. Lola's-kitchen menu with seasonal Filipino dishes. Two grazing tables, live carving station. Premium experience for intimate weddings.",
              includes: ["Crew of 14", "Long-table styling", "Live carving", "2 grazing tables", "Vegan + halal mirrors"],
            },
          ].map(p => {
            const on = pkg === p.id;
            return (
              <div key={p.id} onClick={() => setPkg(p.id)} className="card" style={{
                padding: 28, cursor: "pointer",
                background: on ? "var(--ink)" : "var(--paper)",
                color: on ? "var(--paper)" : "var(--ink)",
                border: on ? "1px solid var(--orange)" : "1px solid var(--line)",
                position: "relative",
              }}>
                {on && <span style={{ position: "absolute", top: -12, left: 22, padding: "4px 10px", background: "var(--orange)", color: "#fff", borderRadius: 999, fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Selected</span>}
                <div className="mono" style={{ fontSize: 10, color: on ? "var(--orange-3)" : "var(--orange-2)", letterSpacing: "0.10em", textTransform: "uppercase" }}>{p.tag}</div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: on ? "var(--paper)" : "var(--ink)", textTransform: "uppercase", marginTop: 6 }}>
                  {p.title}
                </div>
                <div className="mono" style={{ fontSize: 11, color: on ? "var(--slate-4)" : "var(--slate-2)", marginTop: 6 }}>{p.pax}</div>
                <div style={{ fontSize: 13, color: on ? "var(--slate-4)" : "var(--slate)", marginTop: 14, lineHeight: 1.55 }}>{p.body}</div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid " + (on ? "rgba(255,255,255,0.10)" : "var(--line)") }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {p.includes.map(inc => (
                      <div key={inc} style={{ fontSize: 12, color: on ? "var(--paper)" : "var(--ink)", display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="mono" style={{ fontSize: 10, color: on ? "var(--orange-3)" : "var(--orange-2)" }}>✓</span>
                        {inc}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div className="display" style={{ fontSize: 28, color: on ? "var(--orange)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{p.price}</div>
                  <span className="mono" style={{ fontSize: 10, color: on ? "var(--slate-4)" : "var(--slate-2)" }}>all-in · no surcharge</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 18, textAlign: "center" }}>
          Custom packages on request · vegan-only, breakfast-wedding, dessert-only, etc.
        </div>
      </section>

      {/* Portfolio */}
      <section id="portfolio" style={{ padding: "64px 56px" }}>
        <div className="label-mono">Portfolio · selected work</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "10px 0 36px", color: "var(--ink)", fontWeight: 400 }}>
          A few weddings{" "}
          <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>we've fed.</em>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
          <Reveal>
            <div className="photo-placeholder" style={{ height: 420, borderRadius: 8 }}>
              <span className="pp-label">hero · long-table family-style · QC · 7·26</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 12, height: "100%" }}>
              <div className="photo-placeholder" style={{ borderRadius: 8 }}>
                <span className="pp-label">grazing table · Tagaytay</span>
              </div>
              <div className="photo-placeholder" style={{ borderRadius: 8 }}>
                <span className="pp-label">plated · pre-nup tasting</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 12, height: "100%" }}>
              <div className="photo-placeholder" style={{ borderRadius: 8 }}>
                <span className="pp-label">lechon · garden setup</span>
              </div>
              <div className="photo-placeholder" style={{ borderRadius: 8 }}>
                <span className="pp-label">desserts spread · Bohol</span>
              </div>
            </div>
          </Reveal>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
          {[
            "candlelit reception · Cebu",
            "buffet station · QC",
            "tasting menu plate-up",
            "halal mirror table",
          ].map((t, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="photo-placeholder" style={{ height: 200, borderRadius: 8 }}>
                <span className="pp-label">{t}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" style={{ padding: "64px 56px", background: "var(--paper-2)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 56, alignItems: "start" }}>
          <div>
            <div className="label-mono">Reviews · 38 verified</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "10px 0 24px", color: "var(--ink)", fontWeight: 400 }}>
              <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>4.92 stars</em><br />from real couples.
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["5★", 32], ["4★", 5], ["3★", 1], ["2★", 0], ["1★", 0],
              ].map(([r, n]) => (
                <div key={r} style={{ display: "grid", gridTemplateColumns: "30px 1fr 30px", gap: 10, alignItems: "center", fontSize: 12 }}>
                  <span className="mono" style={{ color: "var(--slate-2)" }}>{r}</span>
                  <div style={{ height: 6, background: "var(--paper)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: (n / 32) * 100 + "%", height: "100%", background: "var(--orange)" }} />
                  </div>
                  <span className="mono" style={{ color: "var(--slate-2)", textAlign: "right" }}>{n}</span>
                </div>
              ))}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 20, lineHeight: 1.55 }}>
              Reviews open 24h after each event. Only couples who actually booked through Setnayan can review.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { who: "Patricia & Mark", venue: "Tagaytay · Sep 2026", quote: "Joey's team showed up at 1pm, set the long table by 4, and our crew was eating dinner before the reception even ended. Best money we spent on the wedding.", stars: 5 },
              { who: "Reyes wedding",   venue: "Bohol · Sep 2026",   quote: "We had 165 guests including a halal table and three vegans. Nobody asked twice. The food was the part everyone still talks about.", stars: 5 },
              { who: "Andrea Sy",       venue: "Cebu · Apr 2026",    quote: "I asked for a fish swap a week before. Done, no fee, no fuss. The crew meal kitchen was a real-life saver — my photographers were FED.", stars: 5 },
              { who: "The Lim family",  venue: "QC · Aug 2026",      quote: "Christening for 60 people in a tight garden. Ato made it look effortless. The kids loved the dessert spread.", stars: 5 },
            ].map((r, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="card" style={{ padding: 22, background: "var(--paper)", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>{"★".repeat(r.stars)}</div>
                  <p className="serif" style={{ fontSize: 17, fontStyle: "italic", lineHeight: 1.5, color: "var(--ink)", margin: 0 }}>
                    "{r.quote}"
                  </p>
                  <div style={{ marginTop: "auto" }}>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{r.who}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 2 }}>{r.venue}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Availability */}
      <section id="availability" style={{ padding: "64px 56px" }}>
        <div className="label-mono">Availability · December 2026</div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "10px 0 24px", color: "var(--ink)", fontWeight: 400 }}>
          <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>3 Saturdays</em> still open.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, maxWidth: 720 }}>
          {[..."SMTWTFS"].map((d, i) => (
            <div key={i} className="mono" style={{ padding: 6, fontSize: 9, color: "var(--slate-2)", textTransform: "uppercase", textAlign: "center" }}>{d}</div>
          ))}
          {Array.from({ length: 33 }, (_, i) => {
            const day = i - 1;
            const booked = [5, 12, 18, 27].includes(day);
            const open = day > 0 && day <= 31 && !booked;
            return (
              <div key={i} style={{
                aspectRatio: "1/1",
                background: booked ? "var(--ink)" : open ? "var(--sage)" : "transparent",
                color: booked ? "var(--paper)" : open ? "var(--sage-deep)" : "var(--slate-3)",
                borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontFamily: "var(--mono)",
                border: open ? "none" : booked ? "none" : "1px dashed var(--line)",
                cursor: open ? "pointer" : "default",
              }}>
                {day > 0 && day <= 31 ? day : ""}
              </div>
            );
          })}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 18, display: "flex", gap: 18 }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--sage)", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} /> Open</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--ink)", borderRadius: 2, verticalAlign: "middle", marginRight: 4 }} /> Booked</span>
        </div>
      </section>

      {/* Sticky inquiry CTA */}
      <section style={{ padding: "64px 56px", background: "var(--ink)", color: "var(--paper)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.2fr", gap: 56, alignItems: "center", maxWidth: 1200 }}>
          <div>
            <div className="label-mono" style={{ color: "var(--orange-3)" }}>Proposal builder</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "10px 0 16px", color: "var(--paper)", fontWeight: 400 }}>
              Fill in the brief.<br />Joey builds <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>your proposal.</em>
            </h2>
            <p style={{ fontSize: 15, color: "var(--slate-4)", lineHeight: 1.65, maxWidth: 460 }}>
              No chat-first ping-pong. You answer the structured brief once — date, headcount,
              dietary notes, style — Joey turns it into three menu options at three price points,
              usually within two hours. All proposals sync to your couple dashboard.
            </p>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Reply time",   "under 2 hours · M-F"],
                ["Where",        "in-app · private thread · no third-party DMs"],
                ["No commitment","message-first · book later"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, fontSize: 12, color: "var(--paper)" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--orange-3)", letterSpacing: "0.08em" }}>{k}</span>
                  <span style={{ color: "var(--slate-4)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick inquiry composer — couple writes a message right on the page */}
          <div className="card" style={{ padding: 28, background: "var(--paper)", color: "var(--ink)", border: "none" }}>
            <div className="label-mono" style={{ color: "var(--orange-2)" }}>Brief · 4 fields · ~90 seconds</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", marginTop: 8, lineHeight: 1.1 }}>
              Tell Joey about your day.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Wedding date</div>
                <input type="text" defaultValue="Dec 18, 2026" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "var(--sans)", background: "var(--paper-2)", color: "var(--ink)", outline: "none" }} />
              </div>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Headcount</div>
                <input type="text" defaultValue="≈ 213" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "var(--sans)", background: "var(--paper-2)", color: "var(--ink)", outline: "none" }} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Style + dietary notes (optional)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {["Sit-down", "Buffet", "Cocktail", "Halal", "Vegan", "Pescatarian"].map(t => (
                  <span key={t} className="pill" style={{ background: "var(--paper-2)", fontSize: 11, cursor: "pointer" }}>+ {t}</span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Your message</div>
              <textarea defaultValue="Hi Joey — we're planning a 213-pax sit-down reception in La Castellana on Dec 18, 2026. Would love your sample menu and pricing. We have a halal table for 8 and 2 vegan guests. Thanks!" rows={5} style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "var(--sans)", background: "var(--paper-2)", color: "var(--ink)", outline: "none", resize: "vertical", lineHeight: 1.5 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 14, flexWrap: "wrap" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)", lineHeight: 1.5 }}>
                Sign in or sign up · vendors can only reply,<br />they can't DM cold.
              </div>
              <button className="btn btn-orange btn-lg">Request proposal →</button>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ padding: "32px 56px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>
          Ato Catering · Quezon City · BIR-registered · operated by Joey Castro
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>
          Listed on Setnayan since Aug 2026 · 38 reviews · ✓ Verified
        </div>
      </footer>
    </div>
  );
};

Object.assign(window, { VendorMicrosite });
