// Brand system artboard — logo, color, type, components

const BrandSystem = () => (
  <div style={{ background: "var(--paper)", padding: "56px 64px", fontFamily: "var(--sans)" }}>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48, gap: 32 }}>
      <div>
        <div className="label-mono" style={{ marginBottom: 12 }}>v2 · brand system</div>
        <h1 className="display" style={{ fontSize: 88, margin: 0 }}>
          Setnayan, <span style={{ color: "var(--orange)" }}>restyled.</span>
        </h1>
        <p style={{ color: "var(--slate)", maxWidth: 620, marginTop: 16, fontSize: 16, lineHeight: 1.55 }}>
          A confident, friendly system anchored in the real brand — slate + a single
          warm orange, bold condensed display sans for headlines, the existing circular
          mark used as the only ornament. Light, easy, Filipino.
        </p>
      </div>
      <LogoFull height={70} />
    </div>

    {/* Logo */}
    <Block title="Logo" code="01">
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 20 }}>
        <Tile bg="var(--paper)">
          <LogoFull height={80} />
          <Caption>Primary — paper background</Caption>
        </Tile>
        <Tile bg="var(--ivory)">
          <Wordmark size={32} />
          <Caption>Ivory — cards & callouts</Caption>
        </Tile>
        <Tile bg="var(--ink)">
          <Wordmark size={32} color="var(--paper)" />
          <Caption color="var(--slate-3)">Inverse — footer & dark</Caption>
        </Tile>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 20 }}>
        {[28, 48, 72, 110].map((s) => (
          <Tile key={s} bg="var(--paper-2)" small>
            <LogoMark size={s} />
            <Caption>{s}px · mark only</Caption>
          </Tile>
        ))}
      </div>
    </Block>

    {/* Palette */}
    <Block title="Palette" code="02">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 12 }}>
        <Swatch name="Paper"  hex="#FBF8F2" color="var(--paper)" />
        <Swatch name="Cream"  hex="#F4EFE5" color="var(--paper-2)" />
        <Swatch name="Ivory"  hex="#EDE5D2" color="var(--ivory)" />
        <Swatch name="Slate-4"hex="#B7B9BE" color="var(--slate-4)" />
        <Swatch name="Slate-2"hex="#6E727A" color="var(--slate-2)" textColor="#fff" />
        <Swatch name="Slate"  hex="#545860 · brand" color="var(--slate)" textColor="#fff" />
        <Swatch name="Ink"    hex="#2D3038" color="var(--ink)" textColor="#fff" />
        <Swatch name="Orange" hex="#E28300 · brand" color="var(--orange)" textColor="#fff" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
        <Swatch name="Orange wash"  hex="#FFEACB" color="var(--orange-4)" />
        <Swatch name="Orange tint"  hex="#FFC061" color="var(--orange-3)" />
        <Swatch name="Blush"        hex="#F4D7C9" color="var(--blush)" />
        <Swatch name="Sage"         hex="#C5D2BD" color="var(--sage)" />
      </div>
    </Block>

    {/* Type */}
    <Block title="Type" code="03">
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <Tile bg="var(--paper)" align="flex-start">
          <div className="label-mono">Display · Saira Condensed 800</div>
          <div className="display" style={{ fontSize: 112, marginTop: 8 }}>
            SET NA <span style={{ color: "var(--orange)" }}>‘</span>YAN.
          </div>
          <div className="serif" style={{ fontSize: 24, color: "var(--slate-2)", marginTop: 8, fontStyle: "italic" }}>
            /sɛt na jan/ — “it’s all set.”
          </div>
        </Tile>
        <Tile bg="var(--paper)" align="flex-start">
          <div className="label-mono">UI · Geist</div>
          <div style={{ fontSize: 22, fontWeight: 500, marginTop: 8, letterSpacing: "-0.005em", color: "var(--ink)" }}>
            Plan a wedding the easy way.
          </div>
          <div style={{ fontSize: 14, color: "var(--slate)", marginTop: 8, lineHeight: 1.55, maxWidth: 360 }}>
            Body copy stays simple and warm. The display sans does the shouting; body sans
            keeps the page readable and grown-up.
          </div>
          <div className="label-mono" style={{ marginTop: 24 }}>Accent · italic serif + mono</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="serif" style={{ fontSize: 18, fontStyle: "italic", color: "var(--slate)" }}>
              “Sounds familiar?”
            </div>
            <div className="mono" style={{ fontSize: 13, color: "var(--slate-2)" }}>
              v 2026.05 · /sɛt na jan/
            </div>
          </div>
        </Tile>
      </div>
    </Block>

    {/* Components */}
    <Block title="Components" code="04">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-primary">Start planning</button>
        <button className="btn btn-orange">Get your quote</button>
        <button className="btn btn-ghost">I’m a vendor →</button>
        <span className="pill"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage-deep)" }} /> Live today</span>
        <span className="pill pill-orange"><LogoMark size={12} /> Verified vendor</span>
        <span className="pill" style={{ borderStyle: "dashed", color: "var(--slate-3)" }}>Coming soon</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16, marginTop: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="label-mono">Module · feature card</div>
          <div className="display-tight" style={{ fontSize: 30, marginTop: 10, fontFamily: "var(--display)", fontWeight: 700, textTransform: "uppercase", color: "var(--ink)" }}>
            From save-the-dates<br />to seating charts.
          </div>
          <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 12, lineHeight: 1.55 }}>
            Track every guest, RSVP, plus-one, dietary, table assignment, and personal QR.
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="photo-placeholder" style={{ aspectRatio: "4/3" }}>
            <span className="pp-label">photo · couple portrait</span>
          </div>
          <div style={{ padding: 18 }}>
            <div className="label-mono">Module · imagery</div>
            <div style={{ fontSize: 14, marginTop: 4, color: "var(--ink)" }}>Warm-stripe placeholders, mono labels.</div>
          </div>
        </div>
        <div className="card" style={{ padding: 24, background: "var(--ink)", color: "var(--paper)", border: "none" }}>
          <div className="label-mono" style={{ color: "var(--orange-3)" }}>Module · closing CTA</div>
          <div className="display" style={{ fontSize: 36, marginTop: 8, color: "var(--paper)" }}>
            SET NA <span style={{ color: "var(--orange)" }}>‘</span>YAN.
          </div>
          <div style={{ fontSize: 13, color: "var(--slate-4)", marginTop: 10, lineHeight: 1.55 }}>
            Dark slab for closing CTAs. Orange does the highlighting.
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-orange" style={{ padding: "10px 16px", fontSize: 13 }}>Apply now</button>
          </div>
        </div>
      </div>
    </Block>
  </div>
);

const Block = ({ title, code, children }) => (
  <section style={{ marginTop: 48 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
      <span className="mono" style={{ fontSize: 12, color: "var(--slate-3)" }}>{code}</span>
      <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, textTransform: "uppercase", fontSize: 24, margin: 0, color: "var(--slate)", letterSpacing: "0.01em" }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
    {children}
  </section>
);

const Tile = ({ bg, children, small, align = "center" }) => (
  <div
    style={{
      background: bg,
      border: "1px solid var(--line)",
      borderRadius: "var(--r-md)",
      padding: small ? 20 : 28,
      display: "flex",
      flexDirection: "column",
      alignItems: align,
      justifyContent: "center",
      gap: 12,
      minHeight: small ? 130 : 170,
    }}
  >
    {children}
  </div>
);

const Caption = ({ children, color = "var(--slate-2)" }) => (
  <div className="label-mono" style={{ color }}>{children}</div>
);

const Swatch = ({ name, hex, color, textColor = "var(--ink)" }) => (
  <div style={{
    background: color, color: textColor,
    borderRadius: "var(--r-sm)", padding: "16px 14px 18px",
    minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between",
    border: "1px solid var(--line)",
  }}>
    <div style={{ fontFamily: "var(--display)", fontWeight: 700, textTransform: "uppercase", fontSize: 18, letterSpacing: "0.01em" }}>{name}</div>
    <div className="mono" style={{ fontSize: 10, opacity: 0.85 }}>{hex}</div>
  </div>
);

Object.assign(window, { BrandSystem });
