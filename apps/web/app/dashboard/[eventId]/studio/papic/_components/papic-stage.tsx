import { Images, Camera, Clock, Coins } from 'lucide-react';
import type { PapicStandings } from '@/lib/papic-standings';

/**
 * THE STAGE — the page opens on the library, in every state, including empty.
 *
 * ── WHY (owner, 2026-08-28) ─────────────────────────────────────────────────
 * *"it doesn't look like a photo app control center. it still feels like it is a
 * business page. with not much imagery and app feel UI."*
 *
 * The structure shipped 2026-08-27 was right and is unchanged below this panel.
 * What was wrong is what the page OPENED on: four cells of text, then rows. The
 * market answer is unanimous — Apple Photos deleted its tab bar so the grid is
 * the first paint; Google Photos lands on the grid with albums and settings
 * demoted; Frame.io puts state on the thumbnail. A photo product opens on
 * photographs. Design doc: `SERVICE_CONTROL_CENTERS_DESIGN_2026-08-28.md`,
 * drawing: `prototypes/service_control_center_pattern_2026-08-28.html`.
 *
 * ── THE EMPTY STATE IS THE POINT, NOT THE WEAK CASE ─────────────────────────
 * 🔢 Measured in production 2026-08-27: every celebration that exists has an
 * empty Papic library. **Empty is not the edge case; it is the only case any
 * couple has ever met.** A stage that only looks like a photo app once it is
 * full would therefore look like a photo app for nobody.
 *
 * So an empty library draws the frames it is going to fill — a roll of waiting
 * squares, when the cameras open, and one lit frame that starts it. That is the
 * rival category's strongest move (Lapse's darkroom, Dispo's develop clock,
 * Kuha's countdown), done with our own approved Gallery archetype.
 *
 * ⛔ AND IT SHOWS NO SAMPLE PHOTOGRAPHS. A stranger's wedding sitting in your
 * library is a lie, and the one thing this panel must never do is suggest you
 * have pictures you do not have. Flagged to the owner as his call; drawn the
 * honest way until he says otherwise.
 *
 * ── COLOUR, MEASURED ON THE DARK GROUND ─────────────────────────────────────
 * ⚠ The light-theme tokens do NOT survive here and this is where a light-only
 * check waves a failure straight through:
 *   · gold #A9834B on #17160F ....... 5.2:1  — the ONE place gold text is safe
 *   · white #FFFFFF on #17160F ..... 18.1:1
 *   · green #46A46C on #17160F ...... 5.3:1  (the light-ground #4F6B4A is 2.7:1 here — never)
 *   · accent #E5794E on #17160F ..... 5.7:1  (#C24E25 is 3.5:1 — button FILL only)
 * These are literals on purpose. Themed tokens flip with the page theme; this
 * panel is obsidian in BOTH themes, so a token would break exactly one of them.
 */
export function PapicStage({
  standings,
  windowIsSet,
  windowSummary,
  opensInDays,
  uploadsOpen,
  children,
  firstMemorySlot,
}: {
  standings: PapicStandings;
  windowIsSet: boolean;
  windowSummary: string;
  /** Whole days until the capture window opens; null when unset or already open. */
  opensInDays: number | null;
  uploadsOpen: boolean;
  /** The gallery, rendered only when the library has something in it. */
  children: React.ReactNode;
  /** The lit frame's control — the upload door. Omitted when uploads are shut. */
  firstMemorySlot?: React.ReactNode;
}) {
  const { inLibrary } = standings;
  // ⚠ null is NOT empty. An unread count draws the gallery's own unmeasured
  // state rather than a roll of waiting frames, because "we could not count your
  // photographs" and "you have none" are different sentences and only one of
  // them is alarming to be told wrongly.
  const isEmpty = inLibrary === 0;

  return (
    <section
      aria-label="Your library"
      className="overflow-hidden rounded-2xl"
      style={{ backgroundColor: '#17160F' }}
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p
            className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: '#A9834B' }}
          >
            Your library
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Every photo of your day lands here
          </h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.68)' }}>
            From your crew, your guests, your suppliers, and you.
          </p>
        </div>

        {isEmpty ? (
          <EmptyRoll
            opensInDays={opensInDays}
            windowIsSet={windowIsSet}
            windowSummary={windowSummary}
            uploadsOpen={uploadsOpen}
            firstMemorySlot={firstMemorySlot}
          />
        ) : (
          children
        )}
      </div>

      {/* ⚠ THE FACTS ARE FUSED ONTO THE STAGE'S LOWER EDGE, not floated above it
          on white. They are still the first TEXT a person reads about their own
          celebration, and still come before anything asks them to decide — the
          rule that survived from the approved 08-25 drawing. What changed is
          only that they now sit on the thing they describe. */}
      <StandingsStrip
        standings={standings}
        windowIsSet={windowIsSet}
        windowSummary={windowSummary}
      />
    </section>
  );
}

/**
 * The waiting roll. Twelve frames, because that reads as a strip of film rather
 * than a grid with holes — and one of them is lit.
 */
function EmptyRoll({
  opensInDays,
  windowIsSet,
  windowSummary,
  uploadsOpen,
  firstMemorySlot,
}: {
  opensInDays: number | null;
  windowIsSet: boolean;
  windowSummary: string;
  uploadsOpen: boolean;
  firstMemorySlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {windowIsSet ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#46A46C' }}
          >
            <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
            {opensInDays != null && opensInDays > 0
              ? `Opens in ${opensInDays} day${opensInDays === 1 ? '' : 's'}`
              : 'Your cameras are open'}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#E5794E' }}
          >
            <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
            Cameras — set the dates
          </span>
        )}
      </div>

      <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" aria-hidden>
        {Array.from({ length: 12 }).map((_, n) => (
          <li
            key={n}
            className="aspect-square rounded-md"
            style={{
              // The lit frame is the first one, so the eye lands on the thing
              // that can be pressed rather than hunting the row for it.
              backgroundColor: n === 0 && uploadsOpen ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
              border:
                n === 0 && uploadsOpen
                  ? '1px solid rgba(229,121,78,0.55)'
                  : '1px solid rgba(255,255,255,0.06)',
            }}
          />
        ))}
      </ul>

      {uploadsOpen && firstMemorySlot ? <div>{firstMemorySlot}</div> : null}

      <p className="max-w-prose text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {windowIsSet ? (
          <>These frames start filling {windowSummary.toLowerCase()}.</>
        ) : (
          <>These frames start filling when your cameras open — set the dates below.</>
        )}{' '}
        {uploadsOpen ? <>Older memories are welcome right now.</> : null}
      </p>
    </div>
  );
}

/** The four facts, on the stage's edge. */
function StandingsStrip({
  standings,
  windowIsSet,
  windowSummary,
}: {
  standings: PapicStandings;
  windowIsSet: boolean;
  windowSummary: string;
}) {
  const { inLibrary, cameras, credits } = standings;
  // ⚠ ONE SOURCE FOR THE CAMERA COUNT. A guest camera is also a seat, so adding
  // a separate guest-camera count to this would double-count every guest who has
  // one. Counting the seats once is the honest number.
  const waysIn =
    cameras !== null && cameras > 0 ? `${cameras} camera${cameras === 1 ? '' : 's'}` : null;

  return (
    <div
      className="grid grid-cols-2 gap-px sm:grid-cols-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
    >
      <Fact icon={<Images aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="In your library">
        {inLibrary === null ? (
          <Unmeasured />
        ) : inLibrary === 0 ? (
          <span style={{ color: 'rgba(255,255,255,0.72)' }}>Empty — yours to start</span>
        ) : (
          <>{inLibrary.toLocaleString('en-PH')} so far</>
        )}
      </Fact>

      <Fact icon={<Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Ways in">
        {cameras === null ? (
          <Unmeasured />
        ) : (
          (waysIn ?? <span style={{ color: 'rgba(255,255,255,0.72)' }}>Just you, for now</span>)
        )}
      </Fact>

      <Fact icon={<Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Still coming">
        {windowIsSet ? (
          windowSummary
        ) : (
          /* #E5794E measures 5.7:1 on obsidian. The light theme's action colour
             is 3.5:1 here and would fail — the exact swap a light-only contrast
             check waves through. */
          <span style={{ color: '#E5794E' }}>Cameras — set the dates</span>
        )}
      </Fact>

      <Fact icon={<Coins aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Credits">
        {credits === null ? <Unmeasured /> : <>{credits.toLocaleString('en-PH')} left</>}
      </Fact>
    </div>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3.5" style={{ backgroundColor: '#17160F' }}>
      <p
        className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        {icon}
        {label}
      </p>
      <p className="mt-1 font-mono text-[12.5px] leading-snug text-white">{children}</p>
    </div>
  );
}

/** A read that did not answer. NEVER rendered as 0 — see `papic-standings.ts`. */
function Unmeasured() {
  return (
    <span style={{ color: 'rgba(255,255,255,0.45)' }} title="We couldn’t read this just now">
      —
    </span>
  );
}
