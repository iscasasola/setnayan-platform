// Global search overlay — Cmd/Ctrl+K opens it; types filter vendors live.
// Posts results to a callable opener so the Nav button can trigger it.

const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

const SearchOverlay = ({ open, onClose }) => {
  const [q, setQ] = useStateS("");
  const inputRef = useRefS(null);

  useEffectS(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffectS(() => {
    const handler = (e) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const ql = q.trim().toLowerCase();
  const vendors = window.MARKETPLACE_VENDORS_LIST || [];
  const vMatch = ql
    ? vendors.filter(v =>
        v.name.toLowerCase().includes(ql) ||
        v.cat.toLowerCase().includes(ql) ||
        v.loc.toLowerCase().includes(ql) ||
        v.tags.some(t => t.toLowerCase().includes(ql))
      )
    : vendors.slice(0, 5);

  const suggestions = [
    { kind: "Category", label: "Catering",       hint: "38 vendors" },
    { kind: "Category", label: "Photography",    hint: "47 vendors" },
    { kind: "Location", label: "Tagaytay",       hint: "garden weddings" },
    { kind: "Location", label: "Cebu",           hint: "destination" },
    { kind: "Date",     label: "December 2026",  hint: "12 Saturdays open" },
    { kind: "Help",     label: "How receipts work on Setnayan", hint: "explainer · 2 min" },
  ];
  const sMatch = ql
    ? suggestions.filter(s => (s.kind + " " + s.label).toLowerCase().includes(ql))
    : suggestions;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(45,48,56,0.40)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "80px 24px 24px",
      animation: "fade-in .15s ease-out",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640,
        background: "var(--paper)",
        borderRadius: 16,
        boxShadow: "var(--shadow-lg), 0 0 0 1px var(--line)",
        overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px", borderBottom: "1px solid var(--line-soft)" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="var(--slate-2)" strokeWidth="1.7" />
            <path d="M13.5 13.5L17 17" stroke="var(--slate-2)" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendors, locations, dates, or help…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: "var(--sans)", fontSize: 17, color: "var(--ink)",
            }}
          />
          <kbd className="mono" style={{
            fontSize: 11, padding: "3px 7px", borderRadius: 4,
            background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--slate-2)",
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 480, overflow: "auto" }}>
          {/* Vendors */}
          {vMatch.length > 0 && (
            <div style={{ padding: "12px 0" }}>
              <div className="label-mono" style={{ padding: "6px 22px" }}>
                {ql ? `Vendors · ${vMatch.length} match${vMatch.length === 1 ? "" : "es"}` : "Featured vendors"}
              </div>
              {vMatch.slice(0, 6).map((v) => (
                <a key={v.name} href="#" style={{
                  display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 14, alignItems: "center",
                  padding: "10px 22px", textDecoration: "none", color: "inherit",
                  transition: "background .12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: `linear-gradient(135deg, oklch(75% 0.10 ${v.hue}) 0%, oklch(88% 0.05 ${(v.hue + 40) % 360}) 100%)`,
                  }} />
                  <div>
                    <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{v.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--slate-2)", marginTop: 2 }}>
                      {v.cat} · {v.loc} {v.verified && <span style={{ color: "var(--orange-2)" }}>· ✓ verified</span>}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>{v.base}</span>
                </a>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {sMatch.length > 0 && (
            <div style={{ padding: "12px 0", borderTop: vMatch.length > 0 ? "1px solid var(--line-soft)" : "none" }}>
              <div className="label-mono" style={{ padding: "6px 22px" }}>
                {ql ? "Other suggestions" : "Quick searches"}
              </div>
              {sMatch.map((s, i) => (
                <a key={i} href="#" style={{
                  display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 14, alignItems: "center",
                  padding: "10px 22px", textDecoration: "none", color: "inherit",
                  transition: "background .12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <span className="pill" style={{ fontSize: 10, padding: "2px 8px", justifySelf: "start" }}>{s.kind}</span>
                  <div style={{ fontSize: 14, color: "var(--ink)" }}>{s.label}</div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--slate-3)" }}>{s.hint}</span>
                </a>
              ))}
            </div>
          )}

          {/* Empty state */}
          {vMatch.length === 0 && sMatch.length === 0 && (
            <div style={{ padding: "48px 22px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "var(--ink)", textTransform: "uppercase" }}>
                No matches for “{q}”
              </div>
              <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 6 }}>
                Try a category, a city, or a vendor name. Or{" "}
                <a href="#" style={{ color: "var(--orange-2)" }}>ask a human →</a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 22px", borderTop: "1px solid var(--line-soft)", background: "var(--paper-2)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "var(--mono)", color: "var(--slate-2)", letterSpacing: "0.06em" }}>
          <span><kbd style={{ background: "var(--paper)", padding: "2px 5px", borderRadius: 3, border: "1px solid var(--line)" }}>↵</kbd> open · <kbd style={{ background: "var(--paper)", padding: "2px 5px", borderRadius: 3, border: "1px solid var(--line)" }}>↑↓</kbd> navigate</span>
          <span>Setnayan · 412 vendors · 192 categories indexed</span>
        </div>
      </div>
    </div>
  );
};

// Custom hook to wire keyboard shortcut + opener.
function useGlobalSearch() {
  const [open, setOpen] = useStateS(false);
  useEffectS(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return { open, openIt: () => setOpen(true), closeIt: () => setOpen(false) };
}

Object.assign(window, { SearchOverlay, useGlobalSearch });
