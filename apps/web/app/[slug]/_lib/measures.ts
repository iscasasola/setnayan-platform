/**
 * THE EVENT HUB'S SANCTIONED MEASURES — how wide a column may ever be.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * Measured 2026-08-17: the guest tree used **eight** different content widths
 * between its rooms (`prose` 36 · `md` 20 · `3xl` 19 · `xs` 7 · `sm` 6 · `xl` 5
 * · `2xl` 3 · `5xl` 2). On a phone you cannot see it — everything is narrow.
 * The wider the screen, the more obvious it gets, which is why it surfaced the
 * moment the owner asked for tablet and desktop. **A column that knows its
 * measure cannot be stretched**, which is also why the tablet needs no new
 * breakpoint.
 *
 * ── FOUR, NOT THREE — A CORRECTION TO THE STUDY ─────────────────────────────
 * `event_hub_three_widths_2026-08-17.html` § 02 says three measures replace
 * eight and recommends retiring the other five. **Retiring `max-w-md` would
 * break the bottom bar.** Measured: of its 20 uses, 17 are page-level, and they
 * are not strays — they are the PHONE COLUMN, deliberately chosen for the
 * surfaces that are phone-shaped by design: the bottom bar's own tab group
 * (`site-menu-bar.tsx`), the Live hub's panels, the day-of bar, the lock
 * screen, the not-found plate. Widening those is not tidying, it is a redesign
 * of an owner-locked shape. So the sanctioned set is FOUR.
 *
 * ── WHAT EACH IS FOR ────────────────────────────────────────────────────────
 * The order below is the order of a page: the widest frame, then the plate
 * inside it, then the sentence inside that.
 */

/**
 * THE STAGE — the widest anything may ever be. The Live hub's wall, the
 * editorial's full-bleed spreads, the 3D room. Nothing on any screen goes
 * wider than this.
 */
export const STAGE = 'max-w-5xl' as const; // 64rem

/**
 * THE PLATE — photos, venue plates, galleries, and the default column of every
 * ROOM (the seat pass, the seat finder, the table map, the recap). This is
 * already the de-facto page column: 19 of its 19 uses are page-level.
 */
export const PLATE = 'max-w-3xl' as const; // 48rem

/**
 * THE READING MEASURE — every sentence a guest actually reads.
 *
 * 🔑 It is `ch`-based ON PURPOSE and that is not interchangeable with a rem
 * width. `max-w-prose` is 65 CHARACTERS, so it scales with the type set on the
 * element — a large italic standfirst gets a physically wider line than a
 * caption and both stay at ~65 characters, which is the thing that actually
 * governs legibility. Swapping a rem width here for "tidiness" changes the
 * line length in the opposite direction from what you expect.
 */
export const READING = 'max-w-prose' as const; // 65ch

/**
 * THE PHONE COLUMN — surfaces that are phone-shaped by design and must NOT
 * widen with the screen. The bottom bar's tab group is the load-bearing case:
 * the bar is `fixed` at every width, so on a 1440px screen this is what keeps
 * the five tabs a thumb's reach apart instead of stretched across a metre of
 * glass. (What the bar BECOMES on a desktop is the next slice, not this one.)
 */
export const PHONE = 'max-w-md' as const; // 28rem

/** The whole sanctioned set. A page-level column outside this is a defect. */
export const MEASURES = [STAGE, PLATE, READING, PHONE] as const;
export type Measure = (typeof MEASURES)[number];
