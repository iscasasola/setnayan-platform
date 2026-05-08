"use client";

import { useEffect, useState } from "react";

/**
 * Wedding countdown. Ticks once per second client-side. Auto-hides after the
 * wedding-start timestamp passes.
 */
export function Countdown({ eventDateIso }: { eventDateIso: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Server render placeholder — same height to avoid layout shift on hydrate.
    return <CountdownFrame d={null} h={null} m={null} s={null} />;
  }

  const target = new Date(eventDateIso).getTime();
  const diffMs = target - now.getTime();
  if (diffMs <= 0) return null; // wedding has begun — auto-hide

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs / 3_600_000) % 24);
  const mins = Math.floor((diffMs / 60_000) % 60);
  const secs = Math.floor((diffMs / 1_000) % 60);

  return <CountdownFrame d={days} h={hours} m={mins} s={secs} />;
}

function CountdownFrame({
  d,
  h,
  m,
  s,
}: {
  d: number | null;
  h: number | null;
  m: number | null;
  s: number | null;
}) {
  return (
    <section className="text-center">
      <p className="meta-label mb-4">Until we say "I do"</p>
      <div className="grid grid-cols-4 gap-2 lg:gap-3">
        {(
          [
            ["Days", d],
            ["Hours", h],
            ["Mins", m],
            ["Secs", s],
          ] as const
        ).map(([label, val]) => (
          <div
            key={label}
            className="rounded-2xl border border-rule bg-surface px-2 py-4 lg:px-3 lg:py-5"
          >
            <div className="font-serif text-[28px] font-medium leading-none text-ink lg:text-[44px]">
              {val == null ? "—" : pad(val)}
            </div>
            <div className="meta-label mt-2">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
