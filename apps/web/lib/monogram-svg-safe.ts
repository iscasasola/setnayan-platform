/**
 * apps/web/lib/monogram-svg-safe.ts
 *
 * READ-TIME safety gate for the host-writable monogram SVG columns
 * (events.monogram_custom_svg · events.monogram_uploaded_svg).
 *
 * ── WHY THIS FILE EXISTS (SEC-3 · 2026-07-26) ──────────────────────────────
 * Both write paths already sanitize:
 *   • sanitizeBespokeSvg()  — lib/bespoke-monogram-engine.ts (AI + file upload)
 *   • sanitizeStudioSvg()   — lib/monogram-studio-shared.ts  (vector studio)
 *
 * But `events` UPDATE RLS is ROW-level, never column-level, and the Supabase
 * anon key is public. `monogram_custom_svg` is a legitimately host-written
 * column, so it stays in the column GRANT allow-list of
 * 20271005100000_events_column_update_privileges.sql — which means a host can
 *
 *     PATCH /rest/v1/events?event_id=eq.<their-own-event>
 *     { "monogram_custom_svg": "<svg …><script>…</script></svg>" }
 *
 * straight past PostgREST and never touch a server action. The write-time
 * sanitizer is simply not on that path. The stored value then reaches
 * `dangerouslySetInnerHTML` on OTHER people's screens — most severely the
 * vendor dashboard's client brief, which is a CROSS-TENANT execution context
 * (a couple's payload running in a vendor's authenticated session). There is
 * no `script-src` CSP to catch it (next.config.ts ships `frame-ancestors`
 * only), so the payload runs.
 *
 * The fix is therefore at the READ site, not the write site: nothing that came
 * out of the database is trusted, every consumer routes through
 * resolveEventMonogramSvg() / safeMonogramSvg(), and the gate is FAIL-CLOSED —
 * a mark that does not pass returns null and the surface falls back to the
 * typographic initials mark. Rejecting degrades the design; it never blanks a
 * page, and it never lets an untrusted mark render.
 *
 * ── HOW THIS LIST DIFFERS FROM THE WRITE-TIME ONE ──────────────────────────
 * The write-time list was authored against a *semi-trusted* producer (our own
 * vector engine / a vector API), so a few HTML-parser subtleties did not
 * matter there. They matter here, where the producer is an attacker:
 *
 *   1. EVENT-HANDLER SEPARATOR. The write-time rule is /\son[a-z]+\s*=/i —
 *      whitespace only. The HTML tokenizer re-enters "before attribute name"
 *      after `/` AND after a quoted attribute value, so BOTH of these parse
 *      `onload` as a live handler while sailing past a \s-only rule:
 *          <circle/onload=alert(1)>
 *          <circle fill="x"onload=alert(1)>
 *      The separator class here is [\s/"'] for exactly that reason.
 *
 *   2. NAMESPACED SPELLINGS. /<script/i does not match `<svg:script`. Every
 *      element rule here carries an optional `ns:` prefix.
 *
 *   3. HTML INTEGRATION POINTS. <desc>, <title> and <foreignObject> are the
 *      three points where the HTML parser resumes *HTML* parsing inside SVG.
 *      <foreignObject> was already blocked; <desc>/<title> were not, and they
 *      let an attacker reach plain-HTML sinks like <img onerror> — note
 *      /<image/i does NOT match `<img `. <desc>/<title> are left ALLOWED
 *      (a11y text; existing stored marks legitimately carry them) and the
 *      HTML sinks reachable through them are blocked individually instead:
 *      <img>, <a>, src=, formaction=, plus rules 1 and 2 above.
 *
 *   4. NUMERIC CHARACTER REFERENCES. `&#106;avascript:` style obfuscation.
 *      Neither engine emits `&#`, so it is rejected outright. Named entities
 *      (&amp; in a <text> mark) still pass.
 *
 *   5. DOCTYPE / ENTITY. sanitizeStudioSvg() tolerates a subset-free DOCTYPE
 *      because Illustrator exports one. That is a *write*-time affordance; a
 *      stored value has already been normalized, so a DOCTYPE surviving to
 *      read time means someone wrote around the server action. Rejected.
 *
 * ── THE ONE LEGITIMATE EXCEPTION: RASTER MARKS ─────────────────────────────
 * uploadMonogram() (dashboard/[eventId]/monogram/actions.ts) accepts PNG/JPEG/
 * WEBP, downscales through sharp, and stores the result as a machine-built
 * wrapper: `<svg …><image … href="data:image/webp;base64,…"/></svg>`. That
 * value legitimately contains <image>, href= and data: — three things this
 * gate otherwise rejects — so a blanket rule would silently blank every raster
 * monogram in production.
 *
 * It is admitted by RASTER_MARK below, which is a WHOLE-STRING anchored match
 * on the exact shape the server emits: every attribute is a literal, and the
 * payload charset is base64 only. A base64 run cannot contain `<`, `"`, `on…=`
 * or `javascript:`, so nothing can hide inside the exception — it is not a
 * relaxation of the element rules, it is a single provably-inert literal.
 *
 * ── DEFENCE IN DEPTH, NOT THE ONLY DEFENCE ─────────────────────────────────
 * Where a surface can render the mark as an inert data-URI <img> or a CSS
 * mask-image instead of inlining it, it should — an image context has no
 * script execution and no external fetches at all, so it does not depend on
 * this list being complete. That is already the house pattern
 * (BespokeMonogramMark, BespokeMonogramMotion, EventMonogram,
 * GoldMonogramReveal). This gate exists for the surfaces that genuinely need
 * the live DOM (stroke-tracing reveals, PDF embedding) and as a second layer
 * under the ones that don't.
 */

/** Same ceiling the write-time sanitizers use. */
const MAX_SVG_BYTES = 400_000;

/**
 * The ONE machine-built markup shape that legitimately carries <image>, href=
 * and a data: URI — the sharp-produced raster wrapper from uploadMonogram().
 * Whole-string anchored, every attribute a literal, payload restricted to the
 * base64 alphabet. See "THE ONE LEGITIMATE EXCEPTION" in the header.
 */
const RASTER_MARK =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d{1,5} \d{1,5}"><image width="\d{1,5}" height="\d{1,5}" href="data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}"\/><\/svg>$/;

/**
 * Optional XML namespace prefix, e.g. the `svg:` in `<svg:script>`. The HTML
 * tokenizer has no namespace handling, so `svg:script` is an unknown element
 * there — but the real XML parsers on our PDF / social-card paths treat it as
 * a script element.
 */
const NS = '(?:[a-z0-9_.-]+:)?';

/** An element name is terminated by whitespace, `/` or `>`. */
const END = '[\\s/>]';

function el(name: string): RegExp {
  return new RegExp(`<\\/?${NS}${name}${END}`, 'i');
}

/** Prefix match — covers <animate>, <animateTransform>, <animateMotion>. */
function elPrefix(name: string): RegExp {
  return new RegExp(`<\\/?${NS}${name}`, 'i');
}

/**
 * `javascript:` with any run of C0/space between the letters — the classic
 * `java&#9;script:` / `java\nscript:` obfuscation. Defence in depth: href= and
 * src= are already rejected outright, so there is no attribute left to carry
 * a scheme.
 */
const GAP = '[\\s\\u0000-\\u0020]*';
const SCRIPT_URI = new RegExp(`j${GAP}a${GAP}v${GAP}a${GAP}s${GAP}c${GAP}r${GAP}i${GAP}p${GAP}t${GAP}:`, 'i');

/**
 * The security-critical rule set, exported so the two WRITE-time sanitizers
 * enforce exactly the same thing.
 *
 * They must agree. If write accepted something read rejects, a couple would
 * save a monogram and it would silently never appear anywhere — an invisible
 * bug that looks like data loss. And the write lists were genuinely weaker:
 * `<circle/onload=…>`, `<circle fill="x"onload=…>`, `<svg:script>` and
 * `<desc><img/onerror=…>` are all ACCEPTED by both sanitizeBespokeSvg() and
 * sanitizeStudioSvg() as shipped, so the stored-XSS did not even require the
 * PostgREST bypass the audit described — a crafted .svg through the normal
 * upload button was enough.
 */
export const HOSTILE_SVG_PATTERNS: RegExp[] = [
  // ── executable / embedding elements ──────────────────────────────────────
  elPrefix('script'),
  elPrefix('foreignobject'),
  el('iframe'),
  el('embed'),
  el('object'),
  el('image'),
  el('img'), // reachable via the <desc>/<title> HTML integration points
  el('use'),
  el('style'),
  el('a'), // no monogram needs a link; closes <a href> and <a onclick> at once
  el('handler'),
  el('listener'),
  elPrefix('animate'),
  el('set'),

  // ── event handlers ───────────────────────────────────────────────────────
  // Separator class is [\s/"'] — see note 1 in the header. A tag name is
  // always followed by whitespace or `/`, so the first attribute of a tag is
  // covered by the same class.
  /[\s/"']on[a-z]+\s*=/i,

  // ── URL-bearing attributes ───────────────────────────────────────────────
  /href\s*=/i, // catches xlink:href= too
  /\bsrc\s*=/i,
  /\bformaction\s*=/i,

  // ── script URIs ──────────────────────────────────────────────────────────
  SCRIPT_URI,
  /vbscript\s*:/i,

  // ── external references ──────────────────────────────────────────────────
  // url(...) is allowed ONLY as a same-document fragment (fill="url(#grad)").
  /url\s*\(\s*(?!#)/i,
  /data:/i,

  // ── obfuscation / parser tricks ──────────────────────────────────────────
  /&#/, // numeric character references — see note 4
  /<!\s*doctype/i,
  /<!\s*entity/i,
  /<!\[cdata\[/i,
];

/**
 * Gate a stored monogram SVG for rendering. Returns the markup unchanged when
 * it passes, or null when it does not.
 *
 * REJECT, don't repair: a repairing sanitizer has to out-parse the browser,
 * and any disagreement between the two parsers is a bypass. A monogram is a
 * decorative mark with an initials fallback, so rejecting costs nothing.
 */
export function safeMonogramSvg(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const svg = raw.trim();
  if (!svg || svg.length > MAX_SVG_BYTES) return null;

  // The machine-built raster wrapper is the single admitted exception.
  if (RASTER_MARK.test(svg)) return svg;

  const lower = svg.toLowerCase();
  if (!lower.startsWith('<svg')) return null;
  if (!lower.endsWith('</svg>')) return null;

  for (const re of HOSTILE_SVG_PATTERNS) {
    if (re.test(svg)) return null;
  }

  // A viewBox is required — every legitimate producer emits one, and its
  // absence means the markup did not come from our engines.
  if (!/viewBox\s*=\s*"[^"]*"/i.test(svg)) return null;

  return svg;
}

/**
 * The canonical monogram-mark resolution, with the read-time gate applied to
 * BOTH columns.
 *
 * Precedence is `uploaded ?? custom` — an explicit upload outranks a generated
 * mark (see lib/events.ts). A column that fails the gate is skipped rather
 * than failing the whole resolution, so a poisoned `monogram_uploaded_svg`
 * falls through to a clean `monogram_custom_svg` instead of blanking the mark.
 */
export function resolveEventMonogramSvg(
  event:
    | {
        monogram_uploaded_svg?: string | null;
        monogram_custom_svg?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!event) return null;
  return safeMonogramSvg(event.monogram_uploaded_svg) ?? safeMonogramSvg(event.monogram_custom_svg);
}
