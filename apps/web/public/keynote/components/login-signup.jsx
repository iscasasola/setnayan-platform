// Login + Signup screens · desktop and mobile, light + dark compatible

const LoginSignup = () => (
  <div style={{ background: "var(--paper)", padding: "32px 32px 64px", fontFamily: "var(--sans)" }}>
    <div style={{ borderTop: "1px solid var(--ink)", paddingTop: 14, marginBottom: 36, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--ink)", textTransform: "uppercase" }}>Auth · v 1.0</div>
        <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.02, margin: "12px 0 8px", color: "var(--ink)", letterSpacing: "-0.02em" }}>
          Sign in. <em style={{ fontStyle: "italic", color: "var(--blush-deep)" }}>Or sign up.</em>
        </h1>
        <p style={{ fontSize: 14, color: "var(--slate)", maxWidth: 720, margin: 0 }}>
          Two screens, two roles, two breakpoints. Light + dark adapt to device preference.
        </p>
      </div>
    </div>

    {/* Desktop login + signup side by side */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
      <Direction n="Desktop · light" w={680} h={520}><LoginScreen mode="light" /></Direction>
      <Direction n="Desktop · dark"  w={680} h={520} dark><LoginScreen mode="dark" /></Direction>
      <Direction n="Signup · light"  w={680} h={620}><SignupScreen mode="light" /></Direction>
      <Direction n="Signup · dark"   w={680} h={620} dark><SignupScreen mode="dark" /></Direction>
    </div>

    {/* Mobile */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 36 }}>
      <Direction n="Mobile login · light" mobile><LoginScreenMobile mode="light" /></Direction>
      <Direction n="Mobile login · dark"  mobile dark><LoginScreenMobile mode="dark" /></Direction>
      <Direction n="Mobile signup · light" mobile><SignupScreenMobile mode="light" /></Direction>
      <Direction n="Mobile signup · dark"  mobile dark><SignupScreenMobile mode="dark" /></Direction>
    </div>
  </div>
);

const Direction = ({ n, w, h, dark, mobile, children }) => (
  <div>
    <div className="mono" style={{ fontSize: 11, color: dark ? "var(--slate)" : "var(--slate-2)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>{n}</div>
    <div style={{
      width: mobile ? 280 : "100%",
      height: mobile ? 600 : h,
      borderRadius: mobile ? 28 : 12,
      overflow: "hidden",
      border: "1px solid " + (dark ? "#1A1C20" : "var(--line)"),
      background: dark ? "#0F1115" : "var(--paper)",
      boxShadow: "var(--shadow-sm)",
    }}>{children}</div>
  </div>
);

// ─── LOGIN SCREEN ───────────────────────────────
const LoginScreen = ({ mode }) => {
  const dark = mode === "dark";
  const bg = dark ? "#0F1115" : "var(--paper)";
  const ink = dark ? "#FBFBFA" : "var(--ink)";
  const slate = dark ? "#9CA1AB" : "var(--slate)";
  const line = dark ? "#22252B" : "var(--line)";
  const field = dark ? "#1A1C20" : "var(--paper-2)";
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1.1fr", background: bg, color: ink }}>
      {/* Left: brand + welcome */}
      <div style={{ padding: 32, background: dark ? "linear-gradient(135deg, #1A0F0A 0%, #0F1115 100%)" : "linear-gradient(135deg, var(--ivory) 0%, var(--paper-2) 100%)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <LogoFull height={26} />
        <div>
          <div className="mono" style={{ fontSize: 10, color: slate, letterSpacing: "0.12em", textTransform: "uppercase" }}>Welcome back</div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 36, lineHeight: 1.04, margin: "10px 0 0", color: ink, fontWeight: 400, letterSpacing: "-0.02em" }}>
            Pick up <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>where you left off.</em>
          </h2>
          <p className="serif" style={{ fontStyle: "italic", fontSize: 15, color: slate, marginTop: 12, lineHeight: 1.55 }}>
            Your guest list is right where you saved it.
          </p>
        </div>
        <div className="mono" style={{ fontSize: 10, color: slate, letterSpacing: "0.06em" }}>setnayan.com</div>
      </div>
      {/* Right: form */}
      <div style={{ padding: 32, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: ink, textTransform: "uppercase" }}>Sign in</div>
        <FormField label="Email" mode={mode} placeholder="maria@example.com" />
        <FormField label="Password" mode={mode} placeholder="••••••••" type="password" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: slate, cursor: "pointer" }}>
            <input type="checkbox" /> Keep me signed in
          </label>
          <a href="#" style={{ color: "var(--orange-3)", textDecoration: "none" }}>Forgot password?</a>
        </div>
        <button className="btn btn-orange" style={{ padding: "12px 18px", fontSize: 14, marginTop: 4, justifyContent: "center" }}>Continue</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0", fontSize: 11, color: slate }}>
          <div style={{ flex: 1, height: 1, background: line }} />
          <span>or continue with</span>
          <div style={{ flex: 1, height: 1, background: line }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {["Google", "Apple", "GCash"].map(p => (
            <button key={p} style={{
              padding: "10px 12px", border: "1px solid " + line,
              background: field, color: ink, borderRadius: 8,
              fontSize: 12, fontFamily: "var(--sans)", cursor: "pointer",
            }}>{p}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: slate, textAlign: "center", marginTop: 8 }}>
          No account yet? <a href="#" style={{ color: "var(--orange-3)", textDecoration: "none", fontWeight: 500 }}>Create one — free</a>
        </div>
      </div>
    </div>
  );
};

// ─── SIGNUP SCREEN ──────────────────────────────
const SignupScreen = ({ mode }) => {
  const dark = mode === "dark";
  const bg = dark ? "#0F1115" : "var(--paper)";
  const ink = dark ? "#FBFBFA" : "var(--ink)";
  const slate = dark ? "#9CA1AB" : "var(--slate)";
  const line = dark ? "#22252B" : "var(--line)";
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1.1fr", background: bg, color: ink }}>
      <div style={{ padding: 32, background: dark ? "linear-gradient(135deg, #1A0F0A 0%, #0F1115 100%)" : "linear-gradient(135deg, var(--ivory) 0%, var(--paper-2) 100%)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <LogoFull height={26} />
        <div>
          <div className="mono" style={{ fontSize: 10, color: slate, letterSpacing: "0.12em", textTransform: "uppercase" }}>Start free · 90 seconds</div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 36, lineHeight: 1.04, margin: "10px 0 0", color: ink, fontWeight: 400, letterSpacing: "-0.02em" }}>
            Set your day <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>in motion.</em>
          </h2>
          <p className="serif" style={{ fontStyle: "italic", fontSize: 15, color: slate, marginTop: 12, lineHeight: 1.55 }}>
            No card. Free planning forever. Invite co-hosts later.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["Guest list + RSVP · free", "192 verified vendors", "BIR-stamped receipts", "Today's Focus AI"].map(b => (
            <div key={b} style={{ fontSize: 11, color: slate, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--orange-3)" }}>✓</span> {b}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 32, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: ink, textTransform: "uppercase" }}>Create account</div>
        <div style={{ display: "flex", gap: 6, padding: 3, background: dark ? "#1A1C20" : "var(--paper-2)", borderRadius: 999, border: "1px solid " + line }}>
          {["I'm a couple", "I'm a vendor"].map((r, i) => (
            <button key={r} style={{
              flex: 1, padding: "8px 14px", borderRadius: 999, fontSize: 12,
              background: i === 0 ? (dark ? "#FBFBFA" : "var(--ink)") : "transparent",
              color: i === 0 ? (dark ? "#0F1115" : "var(--paper)") : ink,
              border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontWeight: i === 0 ? 500 : 400,
            }}>{r}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FormField label="First name" mode={mode} placeholder="Maria" />
          <FormField label="Last name" mode={mode} placeholder="Magsaysay" />
        </div>
        <FormField label="Email" mode={mode} placeholder="maria@example.com" />
        <FormField label="Mobile" mode={mode} placeholder="+63 9XX XXX XXXX" />
        <FormField label="Wedding date (optional)" mode={mode} placeholder="Dec 12, 2026" />
        <button className="btn btn-orange" style={{ padding: "12px 18px", fontSize: 14, marginTop: 4, justifyContent: "center" }}>Create account · free</button>
        <div style={{ fontSize: 11, color: slate, textAlign: "center", lineHeight: 1.4 }}>
          By signing up, you agree to our <a href="#" style={{ color: "var(--orange-3)" }}>Terms</a> and <a href="#" style={{ color: "var(--orange-3)" }}>Privacy</a>.<br />
          We never sell your data — RA 10173 compliant.
        </div>
      </div>
    </div>
  );
};

// ─── MOBILE LOGIN ───────────────────────────────
const LoginScreenMobile = ({ mode }) => {
  const dark = mode === "dark";
  const bg = dark ? "#0F1115" : "var(--paper)";
  const ink = dark ? "#FBFBFA" : "var(--ink)";
  const slate = dark ? "#9CA1AB" : "var(--slate)";
  return (
    <div style={{ height: "100%", background: bg, color: ink, padding: "44px 22px 24px", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 24 }}><LogoFull height={22} /></div>
      <div className="mono" style={{ fontSize: 9, color: slate, letterSpacing: "0.10em", textTransform: "uppercase" }}>Welcome back</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1.04, margin: "8px 0 22px", color: ink, fontWeight: 400 }}>
        Pick up where you <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>left off.</em>
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FormField label="Email" mode={mode} placeholder="maria@example.com" />
        <FormField label="Password" mode={mode} placeholder="••••••••" type="password" />
      </div>
      <a href="#" style={{ fontSize: 11, color: "var(--orange-3)", textDecoration: "none", marginTop: 10, alignSelf: "flex-end" }}>Forgot password?</a>
      <button className="btn btn-orange" style={{ padding: "14px 18px", fontSize: 13, marginTop: 18, justifyContent: "center" }}>Sign in</button>
      <div style={{ marginTop: "auto", paddingTop: 14, fontSize: 11, color: slate, textAlign: "center" }}>
        No account yet?<br />
        <a href="#" style={{ color: "var(--orange-3)", textDecoration: "none", fontWeight: 500 }}>Create one — free</a>
      </div>
    </div>
  );
};

// ─── MOBILE SIGNUP ──────────────────────────────
const SignupScreenMobile = ({ mode }) => {
  const dark = mode === "dark";
  const bg = dark ? "#0F1115" : "var(--paper)";
  const ink = dark ? "#FBFBFA" : "var(--ink)";
  const slate = dark ? "#9CA1AB" : "var(--slate)";
  return (
    <div style={{ height: "100%", background: bg, color: ink, padding: "44px 22px 24px", display: "flex", flexDirection: "column", overflow: "auto" }}>
      <div style={{ marginBottom: 18 }}><LogoFull height={22} /></div>
      <div className="mono" style={{ fontSize: 9, color: slate, letterSpacing: "0.10em", textTransform: "uppercase" }}>Start free · 90 seconds</div>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.04, margin: "8px 0 18px", color: ink, fontWeight: 400 }}>
        Set your day <em style={{ fontStyle: "italic", color: "var(--orange-3)" }}>in motion.</em>
      </h2>
      <div style={{ display: "flex", gap: 4, padding: 3, background: dark ? "#1A1C20" : "var(--paper-2)", borderRadius: 999, fontSize: 11, marginBottom: 14 }}>
        <span style={{ flex: 1, padding: "6px 10px", borderRadius: 999, background: dark ? "#FBFBFA" : "var(--ink)", color: dark ? "#0F1115" : "var(--paper)", textAlign: "center", fontWeight: 500 }}>Couple</span>
        <span style={{ flex: 1, padding: "6px 10px", textAlign: "center", color: slate }}>Vendor</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FormField label="Name" mode={mode} placeholder="Maria Magsaysay" />
        <FormField label="Email" mode={mode} placeholder="maria@example.com" />
        <FormField label="Mobile" mode={mode} placeholder="+63 9XX" />
        <FormField label="Wedding date" mode={mode} placeholder="Dec 12, 2026" />
      </div>
      <button className="btn btn-orange" style={{ padding: "14px 18px", fontSize: 13, marginTop: 14, justifyContent: "center" }}>Create account · free</button>
      <div style={{ fontSize: 10, color: slate, textAlign: "center", lineHeight: 1.4, marginTop: 10 }}>
        Terms · Privacy · RA 10173 compliant
      </div>
    </div>
  );
};

// ─── form field
const FormField = ({ label, mode, placeholder, type = "text" }) => {
  const dark = mode === "dark";
  return (
    <div>
      <div className="mono" style={{ fontSize: 10, color: dark ? "#9CA1AB" : "var(--slate-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <input type={type} placeholder={placeholder} style={{
        width: "100%", padding: "10px 12px",
        background: dark ? "#1A1C20" : "var(--paper-2)",
        border: "1px solid " + (dark ? "#22252B" : "var(--line)"),
        borderRadius: 8, fontSize: 13, fontFamily: "var(--sans)",
        color: dark ? "#FBFBFA" : "var(--ink)", outline: "none",
      }} />
    </div>
  );
};

Object.assign(window, { LoginSignup });
