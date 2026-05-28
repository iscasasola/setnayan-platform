// Homepage middle: dashboard preview + four tabs + on-the-day add-ons

const DashboardPreview = ({ onOpenDashboard }) => (
  <section style={{ padding: "120px 56px", background: "var(--paper)" }}>
    <div className="eyebrow">See how it works</div>
    <h2 style={{ fontFamily: "var(--serif)", fontSize: 76, lineHeight: 1.04, margin: "20px 0 16px", maxWidth: 1100, letterSpacing: "-0.02em", color: "var(--ink)", fontWeight: 400 }}>
      Claire &amp; Ice:{" "}<em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>every moving piece,</em>{" "}<span style={{ color: "var(--orange-2)" }}>in one app.</span>
    </h2>
    <p style={{ fontSize: 17, color: "var(--slate)", maxWidth: 720, lineHeight: 1.55 }}>
      The dashboard a real couple sees while they plan. Toggle between roles, peek at what their
      photographer sees on the same data. A live walkthrough lands as we approach launch — December 1, 2026.
    </p>

    {/* Browser-frame preview */}
    <div style={{ marginTop: 56, position: "relative" }}>
      <BrowserFrame onOpenDashboard={onOpenDashboard} />
    </div>

    {/* Four tabs */}
    <div style={{ marginTop: 80 }}>
      <div className="eyebrow">Four tabs. Every moving piece of your event.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 24 }}>
        {[
          { tag: "Guest List", title: "From save-the-dates to seating charts.", body: "Track every guest, RSVP, plus-one, dietary preference, table assignment, and personal QR — all linked to the same database your invitations and gallery read from." },
          { tag: "Vendors", title: "Every vendor, every payment, one ledger.", body: "Track contracts, milestones, deadlines, and crew-meal counts. Calendar-export every payment + every vendor meeting. Vendors stay in sync — you stay in control." },
          { tag: "Schedule", title: "Every date, every reminder, auto-tracked.", body: "Wedding-day timeline, vendor meetings, payment deadlines, RSVP cutoffs — pulled from across the app into one calendar. Subscribe to .ics so it syncs to your phone." },
          { tag: "In-App Services", title: "The features other event apps haven’t maximized.", body: "Live stream on YouTube. Designated paparazzi. Custom monogram. Mood boards. LED backgrounds. Polished highlight reels." },
        ].map((t, i) => (
          <Reveal key={i} delay={i * 80}>
            <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12, height: "100%", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--orange-2)" }}>0{i+1} · {t.tag}</span>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", lineHeight: 1.1, textTransform: "uppercase", letterSpacing: "0.005em" }}>
                {t.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.55 }}>{t.body}</div>
              <a href="#" style={{ marginTop: "auto", color: "var(--orange-2)", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>
                Learn more →
              </a>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

// Mini browser frame containing a shrunken couple dashboard preview.
const BrowserFrame = ({ onOpenDashboard }) => (
  <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 16px", borderBottom: "1px solid var(--line-soft)",
      background: "var(--paper-2)",
    }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["#E28300", "#FFC061", "#C5D2BD"].map((c) => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginLeft: 12 }}>
        app.setnayan.com/claire-ice/dashboard
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <span className="pill" style={{ background: "var(--paper)", fontSize: 11 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--sage-deep)" }} />
          213 days to go
        </span>
        <button onClick={onOpenDashboard} className="btn btn-orange" style={{ padding: "6px 12px", fontSize: 12 }}>
          Open dashboard ↗
        </button>
      </div>
    </div>
    {/* mini dashboard layout */}
    <div style={{ padding: 28, display: "grid", gridTemplateColumns: "240px 1fr 280px", gap: 20, minHeight: 460, background: "var(--paper)" }}>
      <MiniSidebar />
      <MiniMain />
      <MiniRoleSwap />
    </div>
  </div>
);

const MiniSidebar = () => (
  <aside style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <LogoMark size={28} />
      <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, color: "var(--ink)", textTransform: "uppercase" }}>
        SET NA <span style={{ color: "var(--orange)" }}>‘</span>YAN
      </div>
    </div>
    <div className="label-mono" style={{ marginBottom: 4 }}>Couple home</div>
    {["Overview", "Guest list", "Vendors", "Schedule", "Invitations", "Mood board", "In-app services", "Payments"].map((l, i) => (
      <div key={l} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 10px", borderRadius: 6,
        background: i === 0 ? "var(--orange-4)" : "transparent",
        color: i === 0 ? "var(--orange-2)" : "var(--slate)",
        fontSize: 13, fontWeight: i === 0 ? 500 : 400,
      }}>
        <span>{l}</span>
        {i === 1 && <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>47/213</span>}
        {i === 2 && <span className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>9</span>}
      </div>
    ))}
  </aside>
);

const MiniMain = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div>
      <div className="label-mono">Good evening, Claire · 18 · 12 · 26</div>
      <div className="display" style={{ fontSize: 44, marginTop: 6 }}>
        CLAIRE &amp; ICE
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {["Dreaming", "Booking", "Inviting", "Finalizing", "Day", "After"].map((p, i) => (
          <span key={p} style={{
            fontSize: 11, padding: "3px 9px", borderRadius: 999,
            background: i === 2 ? "var(--orange)" : "var(--paper-2)",
            color: i === 2 ? "#fff" : "var(--slate-2)",
            border: i === 2 ? "none" : "1px solid var(--line)",
            fontWeight: i === 2 ? 500 : 400,
          }}>{p}</span>
        ))}
      </div>
    </div>

    <div className="card" style={{ padding: 18, background: "var(--ivory)", border: "1px solid var(--line)" }}>
      <div className="label-mono">Next up</div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", marginTop: 4 }}>
        Send invites to 47 pending guests
      </div>
      <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 6 }}>
        Print the QR sheet or share individual links.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-orange" style={{ padding: "8px 14px", fontSize: 12 }}>Send all</button>
        <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>Print QR sheet</button>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      {[
        { k: "RSVPs in", v: "166", t: "/ 213" },
        { k: "Vendors booked", v: "9", t: "/ 12" },
        { k: "Budget spent", v: "62%", t: "on pace · 3 milestones left" },
      ].map((s) => (
        <div key={s.k} style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 10, background: "var(--paper)" }}>
          <div className="label-mono" style={{ fontSize: 10 }}>{s.k}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, color: "var(--ink)", marginTop: 4 }}>{s.v}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--slate-3)" }}>{s.t}</div>
        </div>
      ))}
    </div>
  </div>
);

const MiniRoleSwap = () => (
  <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div className="card" style={{ padding: 14 }}>
      <div className="label-mono">Same booking · two views</div>
      <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 6, lineHeight: 1.5 }}>
        See what your photographer sees on the same data.
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <span style={{ padding: "5px 10px", fontSize: 11, background: "var(--ink)", color: "var(--paper)", borderRadius: 999 }}>You</span>
        <span style={{ padding: "5px 10px", fontSize: 11, background: "var(--paper-2)", color: "var(--slate)", borderRadius: 999, border: "1px solid var(--line)" }}>Photographer</span>
        <span style={{ padding: "5px 10px", fontSize: 11, background: "var(--paper-2)", color: "var(--slate)", borderRadius: 999, border: "1px solid var(--line)" }}>Caterer</span>
      </div>
    </div>
    <div className="card" style={{ padding: 14, background: "var(--ink)", color: "var(--paper)", border: "none" }}>
      <div className="label-mono" style={{ color: "var(--orange-3)" }}>● Live on the day</div>
      <div className="photo-placeholder" style={{ aspectRatio: "16/10", marginTop: 8, borderRadius: 6 }}>
        <span className="pp-label">livestream · ceremony cam 1</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 8 }}>
        4 cams · 218 watching · highlight reel in 28 min
      </div>
    </div>
    <div className="card" style={{ padding: 14 }}>
      <div className="label-mono">Vendors chat · 3 new</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {[
          { who: "Bloom & Co.", msg: "Sample swatches dropped to your dashboard 🌸" },
          { who: "Ato Catering", msg: "Headcount locked at 213. Crew meals: 28." },
        ].map((c) => (
          <div key={c.who} style={{ padding: 8, borderRadius: 8, background: "var(--paper-2)" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)" }}>{c.who}</div>
            <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>{c.msg}</div>
          </div>
        ))}
      </div>
    </div>
  </aside>
);

// ──────────────────────────────────────────────────────────────────
// On the day add-ons

const OnTheDay = () => {
  const stage = useSnynStage();
  const inLaunch = stage === "pilot";
  // v2.1 Setnayan Productions catalog — 21 services across two delivery models.
  // tokenWorthy = vendor-delivered (couple inquires → vendor pays 1 token to bid;
  // vendors earn tokens by recommending these services to their customers).
  // direct = Setnayan-delivered, automated/software, no vendor bid required.
  const addons = [
    // ── Token-Worthy · vendor-delivered ───────────────────────────────
    { name: "Animated Monogram",  sub: "Bespoke · animated",        body: "A monogram designed for your wedding, animated for screens, stage, and stream. Drops into every Setnayan surface that carries your name.",                                                  price: "₱2,499",         tokenWorthy: true },
    { name: "Pro Website",        sub: "Premium event page",        body: "Premium Invitation + Event Page + Editorial treatment — custom domain, music, gallery, the upgraded blocks on your personal site.",                                                          price: "₱5,499",         tokenWorthy: true },
    { name: "Panood",             sub: "Live stream · per day",     body: "Up to five cameras, one broadcaster on YouTube, embedded directly on your event page. Calendar-day rate (12am → 12mn). Multi-day events scale by the day.",                                  price: "₱3,499 / day",   tokenWorthy: true },
    { name: "Patiktok",           sub: "TikTok-format booth",       body: "Up to 250 vertical clips at the booth. Next-morning compilation in your gallery.",                                                                                                            price: "₱2,499",         tokenWorthy: true },
    { name: "Pakanta",            sub: "Custom wedding song",       body: "A song written for the couple — royalty-free, cleared for livestream + reel.",                                                                                                                price: "₱2,499",         tokenWorthy: true },
    { name: "Papic Guest",        sub: "Disposable camera",         body: "Each guest gets 24 photos + 10 5-second videos. 3 months high-res on your Drive, auto-transferred.",                                                                                          price: "₱2,999",         tokenWorthy: true },
    { name: "Papic (5 Seats)",    sub: "Crew paparazzi · 5h",       body: "Unlimited photos and videos for 5 hours, tagged in real time. 3 months high-res, auto-transferred to your Drive.",                                                                            price: "₱2,999",         tokenWorthy: true },
    { name: "SDE",                sub: "Same-day edit",             body: "3-minute compilation from the Papic feed, delivered before reception ends.",                                                                                                                  price: "₱3,499",         tokenWorthy: true },
    { name: "Thank You Video",    sub: "Post-event · 5 min",        body: "A 5-minute thank-you video from the couple to everyone who showed up, cut from the day's footage.",                                                                                           price: "₱5,499",         tokenWorthy: true },
    { name: "Live Venue Photo Wall", sub: "Live collage + count",   body: "Photos from the day collaging in real time on the venue wall, with a live count of frames captured.",                                                                                         price: "₱2,499",         tokenWorthy: true },
    { name: "Live Background",    sub: "LED wall design",           body: "Custom LED wall background, animated with your monogram. Replaces stock loops you'd otherwise rent.",                                                                                          price: "₱2,499",         tokenWorthy: true },
    { name: "Guided Pack",        sub: "Curated bundle",            body: "A handpicked combination of the day-of services for couples who want the package. 3 months high-res + Drive included.",                                                                       price: "₱11,999",        tokenWorthy: true, bundle: true },
    { name: "Media Pack",         sub: "Full bundle",               body: "Everything Setnayan ships in one package. The complete day, captured.",                                                                                                                        price: "₱16,999",        tokenWorthy: true, bundle: true },

    // ── Direct · Setnayan-delivered, no vendor bid ────────────────────
    { name: "Pakulay",            sub: "Mood board · free",         body: "Per-role + per-venue palettes with cultural conflict catching before print. Free with every Setnayan account.",                                                                              price: "FREE",           free: true },
    { name: "Custom QR per Guest",sub: "Personal QR · up to 250",   body: "One unique QR per guest, pre-loaded with name, plus-one, dietary, table. Personal arrival, no app to install.",                                                                              price: "₱1,499" },
    { name: "Today's Focus",      sub: "65-step assisted planning", body: "Hand-curated planning. We walk you through the 65 steps from \"yes\" to \"done\" — the same checklist we use for our own pilot couples.",                                                       price: "₱1,499" },
    { name: "Indoor Blueprint",   sub: "Entrance → table guide",    body: "An interactive floor plan that guides every guest from arrival to their seat. No more cousins lost in the lobby.",                                                                            price: "₱1,499" },
    { name: "Call-Time Escalator",sub: "All-vendor SMS push",       body: "Push one update from your dashboard — every vendor on the day gets the SMS in seconds. Caterer, lights, photographer, all of them.",                                                          price: "₱1,999" },
    { name: "Camera Bridge",      sub: "DSLR → Papic + Panood",     body: "Connect a professional DSLR rig into the Papic and Panood pipelines. The photographer's frames join the guest stream in real time.",                                                          price: "₱1,999" },
    { name: "Pabati",             sub: "300 short videos",          body: "Up to 300 5-second videos from guests, surfaced as a wishing-wall for the couple.",                                                                                                            price: "₱999" },
    { name: "Guest Stories",      sub: "30-sec story maker",        body: "Add-on to Papic. Each guest gets a 30-second \"story\" template they can record + send. Threaded into the gallery.",                                                                          price: "₱1,999" },
    { name: "High Res Archive",   sub: "Full-res cold storage",     body: "Year-on-year archive of every full-resolution photo and video from the day. Cancel anytime; we never compress.",                                                                              price: "₱2,999 / year" },
  ];
  return (
    <section style={{ padding: "120px 56px", background: "var(--ink)", color: "var(--paper)" }}>
      <div className="eyebrow" style={{ color: "var(--orange-3)" }}>On the day</div>
      <h2 className="display" style={{ fontSize: 80, color: "var(--paper)", margin: "20px 0 16px", maxWidth: 1100, lineHeight: 1 }}>
        When the day comes, <span style={{ color: "var(--orange)" }}>we bring the gear.</span>
      </h2>
      <p style={{ fontSize: 17, color: "var(--slate-4)", maxWidth: 760, lineHeight: 1.55 }}>
        Twenty-two services for the day — from the live broadcast and the same-day reel to the
        guest QRs, the planning concierge, and the LED wall behind the stage. All in-house, all
        first-party, listed under <strong style={{ color: "var(--paper)", fontWeight: 500 }}>Setnayan
        Productions</strong>. Book any of them like any vendor booking — all-in price, proper
        receipt, BIR-stamped.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginTop: 56 }}>
        {addons.map((a, i) => (
          <Reveal key={a.name} delay={i * 80}>
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "var(--r-md)",
              padding: 18,
              display: "flex", flexDirection: "column", gap: 10,
              minHeight: 280,
              transition: "transform .25s cubic-bezier(.2,.7,.2,1), background .2s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}>
              <div className="photo-placeholder" style={{ aspectRatio: "5/3", borderRadius: 8, filter: "brightness(0.85) sepia(0.1)" }}>
                <span className="pp-label">photo · {a.name.toLowerCase()}</span>
              </div>
              <div>
                <div className="label-mono" style={{ color: "var(--orange-3)" }}>{a.sub}</div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--paper)", marginTop: 4, textTransform: "uppercase" }}>
                  {a.name}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--slate-4)", lineHeight: 1.5 }}>{a.body}</div>
              <div style={{ marginTop: "auto" }}>
                <div className="mono" style={{ fontSize: 10, color: a.free ? "var(--sage)" : "var(--orange-3)" }}>
                  {inLaunch ? a.price : a.price.replace(/ · free during launch$/, "")}
                </div>
                {!a.free && (
                  <div className="mono" style={{ fontSize: 9, color: "var(--slate-4)", marginTop: 3, letterSpacing: "0.06em" }}>
                    Sold by Setnayan Productions
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

Object.assign(window, { DashboardPreview, OnTheDay });
