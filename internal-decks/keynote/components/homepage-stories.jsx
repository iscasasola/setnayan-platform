// Editorial sections that break the SaaS rhythm: real-wedding spotlight,
// testimonials with specific Filipino names + details, and a founder note.

// ──────────────────────────────────────────────────────────────────
// Real wedding spotlight — magazine-style mini story

const WeddingSpotlight = () => (
  <section style={{ padding: "140px 56px 120px", background: "var(--paper)", position: "relative", overflow: "hidden" }}>
    <Blob top={20} right={-100} size={520} color="var(--blush)" opacity={0.16} />

    {/* Dateline */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--ink)", paddingTop: 16, marginBottom: 48 }}>
      <span className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)" }}>
        Real wedding · No. 084
      </span>
      <span className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--slate-2)", textTransform: "uppercase" }}>
        La Castellana · Negros Occidental · 18 December 2026
      </span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 64, alignItems: "start" }}>
      <Reveal>
        <h2 className="serif" style={{ fontSize: 84, lineHeight: 1.02, margin: 0, letterSpacing: "-0.025em", color: "var(--ink)" }}>
          <span style={{ fontStyle: "italic" }}>How Claire &amp; Ice</span><br />
          ran their entire<br />wedding from <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>one app.</em>
        </h2>
        <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.7, marginTop: 28, maxWidth: 480 }}>
          Claire Magsaysay, 31, an art director from Quezon City. Ice Buenaventura, 33,
          a structural engineer from Bacolod. They planned a 213-guest wedding across two
          islands in six months — using Setnayan from save-the-date to the same-day
          highlight reel that landed in their inbox 28 minutes after the first kiss.
        </p>
        <p style={{ fontSize: 17, color: "var(--slate)", lineHeight: 1.7, marginTop: 18, maxWidth: 480 }}>
          They never opened a spreadsheet. They never lost a receipt. Maria’s mother,
          who lives in San Mateo, RSVP’d for ten relatives without learning a new app —
          one personal QR did it.
        </p>

        <div style={{ marginTop: 32, padding: "24px 28px", borderLeft: "3px solid var(--orange)", background: "transparent" }}>
          <p className="serif" style={{ fontSize: 28, fontStyle: "italic", lineHeight: 1.35, color: "var(--ink)", margin: 0 }}>
            “The first time my Tita Cora opened the QR, she said
            <span style={{ color: "var(--orange-2)" }}> ‘ah, parang text lang.’ </span>
            That was the moment I knew this was going to work.”
          </p>
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            — Claire, the bride
          </div>
        </div>
      </Reveal>

      {/* Photo grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Reveal delay={100} style={{ gridColumn: "1 / -1" }}>
          <PhotoFrame label="01 · Ceremony · 4:14 pm · La Castellana East Garden" h={360} />
        </Reveal>
        <Reveal delay={200}>
          <PhotoFrame label="02 · Claire & Tita Cora · save-the-date" h={260} />
        </Reveal>
        <Reveal delay={260}>
          <PhotoFrame label="03 · The QR sheet, day-of" h={260} />
        </Reveal>
        <Reveal delay={320} style={{ gridColumn: "1 / -1" }}>
          <PhotoFrame label="04 · First dance · livestream cam 2" h={300} />
        </Reveal>
      </div>
    </div>

    {/* Their numbers */}
    <div style={{ marginTop: 80, padding: "28px 32px", border: "1px solid var(--line)", borderRadius: 16, background: "var(--paper-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--slate-2)", textTransform: "uppercase" }}>
          The wedding, by the numbers
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--slate-3)" }}>Setnayan · event #084</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
        {[
          { n: 173,    suffix: "",  k: "Days planned",          sub: "save-the-date to walking down the aisle" },
          { raw: "47→9",           k: "Vendors found",         sub: "47 searched · 9 kept · 0 lost in DMs" },
          { n: 213,    suffix: "",  k: "Personal QR invites",   sub: "one per guest · 166 opened, 158 RSVP’d" },
          { n: 6,      suffix: "",  k: "Co-hosts collaborating",sub: "both sets of parents · maid of honor · MC" },
        ].map((s, i) => (
          <div key={s.k} style={{
            padding: "16px 18px",
            borderLeft: i === 0 ? "none" : "1px solid var(--line)",
          }}>
            <div className="display" style={{ fontSize: 44, lineHeight: 1, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {s.raw ? s.raw : <Counter to={s.n} suffix={s.suffix || ""} />}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, marginTop: 6 }}>{s.k}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 3, lineHeight: 1.45 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 18 }}>
        {[
          { n: 2184, suffix: "",  k: "Photos captured",       sub: "by 4 Papic-tagged friends · auto-sorted by table", format: (n) => Math.round(n).toLocaleString() },
          { n: 14,   suffix: "h", k: "Livestream broadcast",  sub: "4 cams · peak 218 viewers · YouTube · 1080p" },
          { n: 1,    suffix: "",  k: "Highlight reel",        sub: "AI-edited · 4:14 long · delivered in 28 min" },
          { n: 0,    suffix: "",  k: "Spreadsheets opened",   sub: "they kept score, we just listened" },
        ].map((s, i) => (
          <div key={s.k} style={{
            padding: "16px 18px",
            borderLeft: i === 0 ? "none" : "1px solid var(--line)",
          }}>
            <div className="display" style={{ fontSize: 44, lineHeight: 1, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              <Counter to={s.n} suffix={s.suffix || ""} format={s.format} />
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, marginTop: 6 }}>{s.k}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--slate-2)", marginTop: 3, lineHeight: 1.45 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const PhotoFrame = ({ label, h }) => (
  <div className="photo-placeholder" style={{ height: h, borderRadius: 10, boxShadow: "var(--shadow-sm)" }}>
    <span className="pp-label">{label}</span>
  </div>
);

// ──────────────────────────────────────────────────────────────────
// Voices — couples + vendors with specific details

const Voices = () => {
  const featured = {
    quote: "We were the first wedding our caterer ever did through Setnayan. By the end, she was the one telling other vendors about it. We were just trying to get married — we accidentally became a referral program.",
    who: "Patricia Cruz",
    role: "Bride · 6 Sept 2026 · Tagaytay",
    detail: "Wedding #062 · 178 guests · 7 vendors · same-day reel in 31 min",
  };
  const others = [
    {
      quote: "I used to spend Tuesdays writing Official Receipts by hand. Setnayan does it the moment a payment clears. My accountant cried a little when I showed her.",
      who: "Joey Castro", role: "Owner, Ato Catering · Quezon City",
      kind: "vendor",
    },
    {
      quote: "My mom’s in San Mateo, my Lolo’s in Bacolod, my best friend lives in Sydney. Every one of them sent in their food order through their own phone. It just worked.",
      who: "Andrea Sy", role: "Bride · 22 April 2026 · Cebu",
      kind: "couple",
    },
    {
      quote: "Three weddings booked through the app in my first month. None of them found me on Instagram. That’s new for me.",
      who: "Mika Reyes", role: "Founder, Bloom & Co. Florals · Tagaytay",
      kind: "vendor",
    },
    {
      quote: "I’m a coordinator. I used to live in five WhatsApp groups per client. Now I live in one dashboard per wedding. I sleep again.",
      who: "Camille Lao", role: "Lead, Ilaya Coordinators · Cebu",
      kind: "vendor",
    },
  ];
  return (
    <section style={{ padding: "120px 56px", background: "var(--paper-2)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, marginBottom: 56, alignItems: "end" }}>
        <h2 className="serif" style={{ fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>
          The people who <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>actually used it.</em>
        </h2>
        <p style={{ fontSize: 16, color: "var(--slate)", lineHeight: 1.6, maxWidth: 480 }}>
          Eighty-four weddings in. Real names, real venues, real numbers. We invited every
          couple and every vendor on the platform to talk to you — these are the ones who said yes.
        </p>
      </div>

      <Reveal>
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1.2fr" }}>
          <div className="photo-placeholder" style={{ minHeight: 380 }}>
            <span className="pp-label">portrait · patricia · tagaytay 9·6·26</span>
          </div>
          <div style={{ padding: "40px 48px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
            <span className="label-mono" style={{ color: "var(--orange-2)" }}>★ Featured voice</span>
            <p className="serif" style={{ fontSize: 30, fontStyle: "italic", lineHeight: 1.4, color: "var(--ink)", margin: 0 }}>
              “{featured.quote}”
            </p>
            <div>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.005em" }}>
                {featured.who}
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 4, letterSpacing: "0.06em" }}>
                {featured.role}
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--orange-2)", marginTop: 10, letterSpacing: "0.06em" }}>
                {featured.detail}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 14 }}>
        {others.map((q, i) => (
          <Reveal key={i} delay={i * 90}>
            <div className="card" style={{ padding: 28, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20, cursor: "default" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}>
              <p className="serif" style={{ fontSize: 22, fontStyle: "italic", lineHeight: 1.45, color: "var(--ink)", margin: 0 }}>
                “{q.quote}”
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: q.kind === "vendor" ? "var(--orange-4)" : "var(--blush)", color: q.kind === "vendor" ? "var(--orange-2)" : "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--display)", fontWeight: 700, fontSize: 14 }}>
                  {q.who.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{q.who}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 2 }}>{q.role}</div>
                </div>
                <span className="pill" style={{ marginLeft: "auto", fontSize: 10, padding: "3px 9px", background: q.kind === "vendor" ? "var(--orange-4)" : "var(--paper)", color: q.kind === "vendor" ? "var(--orange-2)" : "var(--slate-2)", borderColor: "transparent" }}>
                  {q.kind === "vendor" ? "Vendor" : "Couple"}
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────
// Founder note — editorial, signed

const FounderNote = () => (
  <section style={{ padding: "140px 56px", background: "var(--paper)", position: "relative", overflow: "hidden" }}>
    <Blob bottom={-80} left={-80} size={520} color="var(--orange)" opacity={0.06} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 80, alignItems: "start", maxWidth: 1300, margin: "0 auto" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
          A note · written between vendor calls
        </div>
        <h2 className="serif" style={{ fontSize: 56, lineHeight: 1.04, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>
          Why we built <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>Setnayan.</em>
        </h2>
        <div style={{ marginTop: 32 }}>
          <PhotoFrame label="Indalecio II & Claire · engagement · 12 Dec 2025" h={220} />
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 12, letterSpacing: "0.06em", lineHeight: 1.6 }}>
          Indalecio S. Casasola II + Claire E. Buanhog<br />
          Engaged 12·12·2025 · Marrying 18·12·2026
        </div>
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1.6, color: "var(--ink)", letterSpacing: "-0.005em" }}>
        <p style={{ margin: 0 }}>
          <span style={{ float: "left", fontSize: 84, lineHeight: 0.85, marginRight: 12, marginTop: 4, color: "var(--orange)", fontWeight: 400 }}>I</span>
          got engaged to Claire on the 12<sup>th</sup> of December, 2025. We set our wedding
          for exactly a year later — December 18, 2026 — and the next morning, on Boxing Day,
          we sat down to plan.
        </p>
        <p style={{ marginTop: 22 }}>
          We searched for hours. Then days. We had <strong style={{ color: "var(--ink)", fontWeight: 500 }}>three
          messaging apps</strong> open at once, our chat groups bouncing between Viber, Messenger,
          and WhatsApp depending on which vendor preferred which. We scrolled Facebook, TikTok,
          and every wedding hashtag we could find — and still ended up <strong style={{ color: "var(--ink)", fontWeight: 500 }}>attending more
          than six wedding fairs in person</strong> just to find vendors we could trust. We made
          spreadsheets, we joined supplier-of-the-day group chats, we collected vendor PDFs in
          folders we still can't find. We learned the hard way that <strong style={{ color: "var(--ink)", fontWeight: 500 }}>there is no
          central hub for events in the Philippines</strong> — no place where what you tell your
          caterer is what your photographer also knows, no way for your coordinator to see the
          same calendar your Lola sees, no clean way to pay anyone without a screenshot.
        </p>
        <p style={{ marginTop: 22 }}>
          We had toasts to plan, suppliers to chase, concepts to make real on a budget the
          internet kept telling us was too small. We watched our vendors juggle three
          inboxes. We watched our coordinator type the same information into four different
          apps. <em style={{ fontStyle: "italic" }}>So we started building this — between meetings, between calls, between
          arguments about chairs.</em>
        </p>
        <p style={{ marginTop: 22 }}>
          We do not want the next couple to go through what we went through. We want them
          to find a vendor, message a coordinator, pay a caterer, and watch the highlight
          reel of their own ceremony — all from one place. We're using Setnayan for our own
          wedding. If it works for us, it'll work for you. And if it doesn't, you'll
          probably be the first to tell us — we'll fix it.
        </p>
        <div style={{ marginTop: 22, padding: "20px 24px", background: "var(--ivory)", border: "1px solid var(--orange-3)", borderRadius: 14, fontFamily: "var(--sans)", fontSize: 15, lineHeight: 1.6 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--orange-2)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
            The first proof
          </div>
          <p style={{ margin: 0, color: "var(--ink)", fontWeight: 500 }}>
            We started using the app on <span style={{ color: "var(--orange-2)", borderBottom: "1px dashed var(--orange-2)" }}>[ pilot start · TBD ]</span> when the pilot opened, and finished our wedding <span style={{ color: "var(--orange-2)", borderBottom: "1px dashed var(--orange-2)" }}>[ days ]</span> days later with the help of every feature in it.
          </p>
          <p style={{ marginTop: 10, margin: "10px 0 0", color: "var(--slate)" }}>
            Our wedding will be <strong style={{ color: "var(--ink)", fontWeight: 500 }}>the first wedding of the app</strong> — the first proof it works. We're betting our own day on it. You don't have to.
          </p>
        </div>
        <p style={{ marginTop: 22 }}>
          <em style={{ fontStyle: "italic", color: "var(--orange-2)" }}>Set na 'yan.</em>{" "}
          That's our wedding. We hope it'll be yours, too.
        </p>
        <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span className="serif" style={{ fontSize: 28, fontStyle: "italic", color: "var(--orange-2)", letterSpacing: "-0.02em" }}>
            — Indalecio &amp; Claire
          </span>
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Founders · the couple building this app while planning their own wedding
          </div>
        </div>
      </div>
    </div>

    {/* Trust strip */}
    <div style={{ marginTop: 96, paddingTop: 28, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
      {[
        ["BIR registered", "TIN 010-738-441-000"],
        ["DTI accredited", "BN 4180-2026"],
        ["NPC compliant",  "RA 10173 · Reg PIC-2026-0042"],
        ["PCI-DSS",        "Via Setnayan Pay · Xendit infra"],
        ["Office",         "Quezon City, Philippines"],
      ].map(([k, v]) => (
        <div key={k}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.10em", color: "var(--slate-3)", textTransform: "uppercase" }}>{k}</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink)", marginTop: 4 }}>{v}</div>
        </div>
      ))}
    </div>
  </section>
);

Object.assign(window, { WeddingSpotlight, Voices, FounderNote });
