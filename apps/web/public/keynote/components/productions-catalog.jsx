// Setnayan Productions Catalog — couple-facing /productions page
// 22 à-la-carte services grouped by delivery model (Direct / Token-Worthy)
// Bundles highlighted at the bottom

const ProductionsCatalog = () => {
  const direct = [
    { name: "Pakulay",                tag: "Mood board",          price: "FREE",       free: true, body: "Per-role + per-venue palettes with cultural conflict catching before print. Included with every Setnayan account." },
    { name: "Custom QR per Guest",    tag: "Personal QR",          price: "₱1,499",     body: "1 unique QR per guest, pre-loaded with name, plus-one, dietary, table. Up to 250 pax." },
    { name: "Today's Focus",          tag: "Assisted planning",    price: "₱1,499",     body: "The 65-step concierge planning process. We walk you through every step from yes to done." },
    { name: "Indoor Blueprint",       tag: "Entrance → table",     price: "₱1,499",     body: "An interactive floor plan that guides every guest from arrival to their seat." },
    { name: "Call-Time Escalator",    tag: "All-vendor SMS",       price: "₱1,999",     body: "Push one update from your dashboard — every vendor on the day gets the SMS in seconds." },
    { name: "Camera Bridge",          tag: "DSLR → Papic + Panood",price: "₱1,999",     body: "Connect a professional DSLR rig into the Papic and Panood pipelines. Frames join the guest stream in real time." },
    { name: "Pabati",                 tag: "300 short videos",     price: "₱999",       body: "Up to 300 5-second videos from guests, surfaced as a wishing-wall for the couple." },
    { name: "Guest Stories",          tag: "30-sec story maker",   price: "₱1,999",     body: "Add-on to Papic. Each guest gets a 30-second story template they can record and send." },
    { name: "High Res Archive",       tag: "Full-res cold storage",price: "₱2,999/yr",  body: "Annual archive of every full-resolution photo and video from the day. Cancel anytime; we never compress." },
  ];

  const tokenWorthy = [
    { name: "Animated Monogram",      tag: "Bespoke · animated",    price: "₱2,499",  body: "A monogram designed for your wedding, animated for screens, stage, and stream." },
    { name: "Pro Website",            tag: "Premium event page",    price: "₱5,499",  body: "Premium Invitation + Event Page + Editorial treatment — custom domain, music, gallery, the upgraded blocks on your personal site." },
    { name: "Panood",                 tag: "Live stream · per day", price: "₱3,499/day", body: "Up to five cameras, one broadcaster on YouTube, embedded on your event page. Calendar-day rate." },
    { name: "Patiktok",               tag: "TikTok-format booth",   price: "₱2,499",  body: "Up to 250 vertical clips at the booth. Next-morning compilation in your gallery." },
    { name: "Pakanta",                tag: "Custom wedding song",   price: "₱2,499",  body: "A song written for the couple — royalty-free, cleared for livestream + reel." },
    { name: "Papic Guest",            tag: "Disposable camera",     price: "₱2,999",  body: "Each guest gets 24 photos + 10 5-second videos. 3 months high-res on your Drive, auto-transferred." },
    { name: "Papic (5 Seats)",        tag: "Crew paparazzi · 5h",   price: "₱2,999",  body: "Unlimited photos and videos for 5 hours, tagged in real time. 3 months high-res, auto-transferred." },
    { name: "SDE",                    tag: "Same-day edit",         price: "₱3,499",  body: "3-minute compilation from the Papic feed, delivered before reception ends." },
    { name: "Thank You Video",        tag: "Post-event · 5 min",    price: "₱5,499",  body: "A 5-minute thank-you video from the couple to everyone who showed up." },
    { name: "Live Venue Photo Wall",  tag: "Live collage + count",  price: "₱2,499",  body: "Photos from the day collaging in real time on the venue wall, with a live count of frames captured." },
    { name: "Live Background",        tag: "LED wall design",       price: "₱2,499",  body: "Custom LED wall background, animated with your monogram. Replaces stock loops you'd otherwise rent." },
  ];

  const bundles = [
    { name: "Guided Pack",  price: "₱11,999", body: "A handpicked combination of the day-of services for couples who want the package. 3 months high-res + Drive included." },
    { name: "Media Pack",   price: "₱16,999", body: "Everything Setnayan ships in one package. The complete day, captured." },
  ];

  return (
    <div style={{ minHeight: 4000, background: "var(--paper)", fontFamily: "var(--sans)" }}>
      {/* Top nav */}
      <header style={{
        padding: "18px 56px", borderBottom: "1px solid var(--line-soft)",
        background: "var(--paper)", position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <LogoFull height={28} />
        <nav style={{ display: "flex", gap: 26, fontSize: 14, color: "var(--slate)" }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Marketplace</a>
          <a href="#" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 500 }}>Productions</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>For vendors</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Help</a>
        </nav>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="#" style={{ fontSize: 14, color: "var(--slate)", textDecoration: "none", alignSelf: "center" }}>Sign in</a>
          <button className="btn btn-primary" style={{ padding: "9px 16px", fontSize: 13 }}>Start planning</button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "96px 56px 56px", textAlign: "center", maxWidth: 980, margin: "0 auto" }}>
        <div className="eyebrow" style={{ justifyContent: "center" }}>Setnayan Productions</div>
        <h1 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 96, lineHeight: 1.04, letterSpacing: "-0.025em", color: "var(--ink)", margin: "24px 0 28px" }}>
          The day-of services we make.
        </h1>
        <p style={{ fontSize: 18, color: "var(--slate)", lineHeight: 1.55, maxWidth: 720, margin: "0 auto" }}>
          Twenty-two services for the day. Some free. Some à la carte. All first-party. Vendor-bookable
          via your dashboard, with one invoice and a proper receipt.
        </p>
        <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", marginTop: 28, letterSpacing: "0.20em" }}>
          ★ MOST ARE FREE DURING THE PILOT · UNTIL 31 MAR 2027
        </div>
      </section>

      {/* Direct services */}
      <section style={{ padding: "56px 56px 32px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
            <div>
              <div className="eyebrow">Direct services · 9</div>
              <h2 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", color: "var(--ink)", margin: "12px 0 0" }}>
                Built by us. Automated.
              </h2>
            </div>
            <div style={{ fontSize: 14, color: "var(--slate)", maxWidth: 380, textAlign: "right", lineHeight: 1.55 }}>
              Software-delivered. No vendor in the loop. Add to your event and it just runs.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {direct.map(s => <ServiceCard key={s.name} s={s} />)}
          </div>
        </div>
      </section>

      {/* Token-Worthy services */}
      <section style={{ padding: "64px 56px 32px", background: "var(--paper-2)" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
            <div>
              <div className="eyebrow">Crew-delivered · 11</div>
              <h2 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", color: "var(--ink)", margin: "12px 0 0" }}>
                Filmed, staged, sung,<br />delivered by humans.
              </h2>
            </div>
            <div style={{ fontSize: 14, color: "var(--slate)", maxWidth: 380, textAlign: "right", lineHeight: 1.55 }}>
              Setnayan-vetted crews show up at your venue. Vendors who recommend these earn a referral
              token if you book — fair to them, free to you.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {tokenWorthy.map(s => <ServiceCard key={s.name} s={s} tokenWorthy />)}
          </div>
        </div>
      </section>

      {/* Bundles */}
      <section style={{ padding: "72px 56px 56px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Bundles · save more</div>
          <h2 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 32px" }}>
            Two packages. Big day, settled.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {bundles.map((b, i) => (
              <div key={b.name} style={{
                padding: 32, background: i === 1 ? "var(--ink)" : "var(--orange-4)",
                color: i === 1 ? "var(--paper)" : "var(--ink)",
                borderRadius: 18, display: "flex", flexDirection: "column", gap: 16,
              }}>
                <div className="mono" style={{ fontSize: 11, color: i === 1 ? "var(--orange-3)" : "var(--orange-2)", letterSpacing: "0.18em" }}>
                  ★ BUNDLE
                </div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 56, color: i === 1 ? "var(--paper)" : "var(--ink)", lineHeight: 1, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
                  {b.name}
                </div>
                <div style={{ fontSize: 15, color: i === 1 ? "var(--slate-4)" : "var(--slate)", lineHeight: 1.55, maxWidth: 480 }}>{b.body}</div>
                <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 40, color: i === 1 ? "var(--orange-3)" : "var(--orange-2)" }}>{b.price}</div>
                  <button className="btn btn-orange" style={{ padding: "12px 22px", fontSize: 13 }}>Add to event →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 56px", background: "var(--ivory)", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontWeight: 400, fontSize: 72, lineHeight: 1.04, letterSpacing: "-0.02em", color: "var(--ink)", margin: 0 }}>
          Pick what you need.<br />
          <span style={{ color: "var(--orange-2)" }}>The rest is yours to make.</span>
        </h2>
        <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn btn-primary btn-lg">Start your event</button>
          <button className="btn btn-ghost btn-lg">Talk to ops →</button>
        </div>
      </section>
    </div>
  );
};

const ServiceCard = ({ s, tokenWorthy }) => (
  <div style={{
    padding: 22, background: "var(--paper)", border: "1px solid var(--line)",
    borderRadius: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 240,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div>
        <div className="mono" style={{ fontSize: 9, color: tokenWorthy ? "var(--orange-2)" : "var(--sage-deep)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {tokenWorthy ? "★ Crew-delivered" : "✦ Direct"}
        </div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", marginTop: 6, textTransform: "uppercase", letterSpacing: "-0.005em" }}>
          {s.name}
        </div>
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--slate-2)", whiteSpace: "nowrap" }}>{s.tag}</span>
    </div>
    <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.55, flex: 1 }}>{s.body}</div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
      <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, color: s.free ? "var(--sage-deep)" : "var(--orange-2)" }}>{s.price}</span>
      <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>Add →</button>
    </div>
  </div>
);

Object.assign(window, { ProductionsCatalog, ServiceCard });
