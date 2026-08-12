// Setnayan platform stage — shared across redesign canvas + active marketing pages.
// Three states the website reshapes around:
//   • "pilot"  — pre-launch, founder-led, scarce vendor count, qr-only payments
//   • "live"   — post-launch, scaled, "412 verified vendors", coverage map, Boost live
//   • "debut"  — post-launch + Debut event-type unlocked, marketplace gains chips
// Components subscribe with useSnynStage(); the design-canvas Tweaks panel sets it.

(function () {
  if (window.useSnynStage) return; // idempotent — guard against double-load
  window.__SNYN_STAGE_VAL = window.__SNYN_STAGE_VAL || "pilot";

  window.useSnynStage = function () {
    const [s, set] = React.useState(window.__SNYN_STAGE_VAL || "pilot");
    React.useEffect(() => {
      const h = (e) => set(e.detail);
      window.addEventListener("snyn:stage", h);
      if (window.__SNYN_STAGE_VAL !== s) set(window.__SNYN_STAGE_VAL);
      return () => window.removeEventListener("snyn:stage", h);
    }, []);
    return s;
  };

  window.setSnynStage = function (s) {
    window.__SNYN_STAGE_VAL = s;
    window.dispatchEvent(new CustomEvent("snyn:stage", { detail: s }));
  };
})();
