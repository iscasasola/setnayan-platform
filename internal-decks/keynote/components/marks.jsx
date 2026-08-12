// Brand marks — uses the clean circular mark PNG + typeset wordmark.

const LogoMark = ({ size = 40 }) => (
  <img
    src="brand/setnayan-mark.png"
    alt=""
    style={{
      width: size,
      height: size,
      display: "inline-block",
      verticalAlign: "middle",
      flexShrink: 0,
    }}
  />
);

const Wordmark = ({ size = 22, color = "var(--ink)" }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: size * 0.42,
    lineHeight: 1, color,
  }}>
    <LogoMark size={size * 1.25} />
    <span style={{
      fontFamily: "var(--display)",
      fontSize: size * 1.04,
      fontWeight: 800,
      letterSpacing: "0.005em",
      lineHeight: 1,
      textTransform: "uppercase",
    }}>
      SET NA <span style={{ color: "var(--orange)" }}>‘</span>YAN
    </span>
  </span>
);

const WordmarkLarge = ({ size = 64, color = "var(--ink)" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
    <LogoMark size={size * 1.18} />
    <div style={{
      fontFamily: "var(--display)",
      fontSize: size,
      fontWeight: 800,
      letterSpacing: "0.01em",
      color,
      lineHeight: 1,
      textTransform: "uppercase",
    }}>
      SET NA <span style={{ color: "var(--orange)" }}>‘</span>YAN
    </div>
  </div>
);

// Full lockup just wraps Wordmark at the right scale to act like a single asset.
const LogoFull = ({ height = 36 }) => <Wordmark size={Math.round(height * 0.7)} />;

Object.assign(window, { LogoFull, LogoMark, Wordmark, WordmarkLarge });
