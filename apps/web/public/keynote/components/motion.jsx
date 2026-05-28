// Motion primitives — scroll-reveal hook + animated counter.
// Keep them dependency-free so the rest of the app can import naturally.

const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

// useInView — returns [ref, inView]. Marks once-only by default.
function useInView({ threshold = 0.15, once = true } = {}) {
  const ref = useRefM(null);
  const [seen, setSeen] = useStateM(false);
  useEffectM(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        if (once) obs.disconnect();
      } else if (!once) {
        setSeen(false);
      }
    }, { threshold });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, seen];
}

// Reveal — drop content in a wrapper that fades + slides in once on scroll.
const Reveal = ({ children, delay = 0, y = 14, as: As = "div", style, ...rest }) => {
  const [ref, seen] = useInView();
  return (
    <As ref={ref} style={{
      opacity: seen ? 1 : 0,
      transform: seen ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity .6s ease ${delay}ms, transform .7s cubic-bezier(.2,.7,.2,1) ${delay}ms`,
      ...style,
    }} {...rest}>
      {children}
    </As>
  );
};

// Counter — animates from 0 (or `from`) to `to` over `duration` ms.
// Format the value with `format(n)` for prefixes like ₱ or “M”.
const Counter = ({
  to, from = 0, duration = 1400, decimals = 0, prefix = "", suffix = "",
  format,
}) => {
  const [ref, seen] = useInView();
  const [val, setVal] = useStateM(from);
  useEffectM(() => {
    if (!seen) return;
    let raf = 0; const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3); // ease-out cubic
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      setVal(from + (to - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen]);
  const shown = format
    ? format(val)
    : prefix + (decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
  return <span ref={ref}>{shown}</span>;
};

// Soft gradient blob background — fixed in absolutely-positioned container.
const Blob = ({ top, left, right, bottom, size = 480, color = "var(--orange)", opacity = 0.10 }) => (
  <div aria-hidden style={{
    position: "absolute",
    top, left, right, bottom,
    width: size, height: size,
    pointerEvents: "none",
    background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
    opacity,
    filter: "blur(40px)",
    transform: "translate3d(0,0,0)",
  }} />
);

// Stagger — wraps a list of children and reveals each with an incremental delay.
const Stagger = ({ children, step = 70, baseDelay = 0, y, as: As = "div", ...rest }) => {
  const items = React.Children.toArray(children);
  return (
    <As {...rest}>
      {items.map((c, i) => (
        <Reveal key={c.key ?? i} delay={baseDelay + i * step} y={y}>
          {c}
        </Reveal>
      ))}
    </As>
  );
};

// Parallax — translates a child as the viewport scrolls past it.
const Parallax = ({ children, speed = 0.15, style, ...rest }) => {
  const ref = useRefM(null);
  const [y, setY] = useStateM(0);
  useEffectM(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const offset = (window.innerHeight / 2 - center) * speed;
        setY(offset);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={ref} style={{ ...style, transform: `translate3d(0, ${y}px, 0)`, willChange: "transform" }} {...rest}>
      {children}
    </div>
  );
};

Object.assign(window, { useInView, Reveal, Counter, Blob, Stagger, Parallax });
