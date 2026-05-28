// "By the numbers" social-proof strip — live wedding stats today, ready to
// slot in additional event types when they unlock. Placeholder numbers; swap
// once live data exists. Designed to be the same component for all event
// types so the visual rhythm carries forward.

const SocialProof = () => {
  const stage = useSnynStage();
  const isPilot = stage === "pilot";
  const isDebut = stage === "debut";

  // Three different stories told by three sets of numbers.
  const figures = isPilot
    ? [
        { to: 42,   k: "Verified vendors",   sub: "each one hand-checked by us in Quezon City" },
        { to: 6,    k: "Couples in the pilot", sub: "all booking through to Dec 18 + Q1 2027" },
        { to: 1,    k: "First wedding",       sub: "Dec 18, 2026 · Claire & Ice · the first one shipped on Setnayan" },
        { to: 100,  suffix: "%", k: "Personally onboarded", sub: "every founder-pilot vendor met or video-called" },
      ]
    : isDebut
      ? [
          { to: 518,    k: "Verified vendors",   sub: "wedding + debut categories combined" },
          { to: 2390,   k: "Accounts created",   sub: "couples, debutantes, co-hosts" },
          { to: 132,    k: "Events shipped",     sub: "Sep 2026 → today, all on-platform" },
          { to: 84200,  k: "Photos delivered",  sub: "via Papic crew + photographer Drive handoff", format: (n) => Math.round(n).toLocaleString() },
        ]
      : [
          { to: 412,    k: "Verified vendors",   sub: "across 8 service categories" },
          { to: 1840,   k: "Accounts created",   sub: "couples + co-hosts planning today" },
          { to: 84,     k: "Weddings shipped",   sub: "Sep 2026 → today, all on-platform" },
          { to: 62400,  k: "Photos delivered",  sub: "via Papic crew + photographer Drive handoff", format: (n) => Math.round(n).toLocaleString() },
        ];

  const eyebrow = isPilot
    ? "By the numbers · the pilot, today"
    : isDebut
      ? "By the numbers · weddings + debuts"
      : "By the numbers · weddings, today";

  const headline = isPilot
    ? <>A small platform <span style={{ color: "var(--orange)" }}>built with care.</span></>
    : isDebut
      ? <>The playbook <span style={{ color: "var(--orange)" }}>carries forward.</span></>
      : <>A small platform <span style={{ color: "var(--orange)" }}>growing fast.</span></>;

  return (
  <section style={{ padding: "80px 56px", background: "var(--ink)", color: "var(--paper)" }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "flex-end", marginBottom: 36 }}>
      <div>
        <div className="eyebrow" style={{ color: "var(--orange-3)" }}>{eyebrow}</div>
        <h2 className="display" style={{ fontSize: 56, color: "var(--paper)", lineHeight: 1.02, margin: "16px 0 0" }}>
          {headline}
        </h2>
      </div>
      <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999 }}>
        {[
          { label: "Wedding",        live: true },
          { label: "Debut",          live: isDebut },
          { label: "Gender Reveal",  live: false },
          { label: "Corporate",      live: false },
        ].map((e, i) => {
          const isActive = e.live && (i === 0 || (e.label === "Debut" && isDebut));
          return (
            <span key={e.label} style={{
              padding: "6px 14px", fontSize: 12, borderRadius: 999,
              background: isActive ? "var(--orange)" : "transparent",
              color: isActive ? "#fff" : "var(--slate-4)",
              fontFamily: "var(--sans)", fontWeight: isActive ? 500 : 400,
              display: "inline-flex", alignItems: "center", gap: 6,
              cursor: e.live ? "default" : "not-allowed", opacity: e.live ? 1 : 0.6,
            }}>
              {e.label}
              {!e.live && <span className="mono" style={{ fontSize: 9, color: "var(--orange-3)" }}>SOON</span>}
              {e.label === "Debut" && isDebut && <span className="mono" style={{ fontSize: 9, color: "var(--ink)", background: "var(--orange-3)", padding: "0 5px", borderRadius: 3 }}>NEW</span>}
            </span>
          );
        })}
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
      {figures.map((s, i) => (
        <Reveal key={s.k} delay={i * 80} style={{
          padding: "32px 24px",
          borderRight: i === 3 ? "none" : "1px solid rgba(255,255,255,0.10)",
        }}>
          <div className="display" style={{ fontSize: 72, color: "var(--paper)", lineHeight: 1, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
            <Counter to={s.to} prefix={s.prefix || ""} suffix={s.suffix || ""} format={s.format} />
          </div>
          <div style={{ fontSize: 14, color: "var(--paper)", fontWeight: 500, marginTop: 6 }}>{s.k}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 4, lineHeight: 1.5 }}>{s.sub}</div>
        </Reveal>
      ))}
    </div>

    <div className="mono" style={{ fontSize: 11, color: "var(--slate-4)", marginTop: 32, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
      <span>{isPilot
        ? "● Pilot · December 2026. Numbers are real, not extrapolated. We onboard every vendor by hand."
        : "● Live counter · refreshes weekly. Placeholder figures shown until launch."}</span>
      <span>{isDebut ? "Wedding + Debut live · Birthday opens next" : "Tagalog interface · Q1 2027 · regions opening in waves"}</span>
    </div>
  </section>
  );
};

Object.assign(window, { SocialProof });
