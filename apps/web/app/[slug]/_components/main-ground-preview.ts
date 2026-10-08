/**
 * ⚡ LOOK › BACKGROUND, ON THE MAKER CANVAS NOW — the frame side.
 *
 * Owner, 2026-10-08, after picking a video card: *"took 8 seconds before a
 * background shows"*. MEASURED that day in the lab with production's latencies:
 * the files were never the wait (a 2.2 MB loop in ~0.6 s) — the PATH was: the
 * pick waited on its save (~1.5 s), the save owed a whole-Maker render (3–6 s),
 * and that render reloaded the canvas page (~2.5 s) before a pixel changed.
 *
 * Now the Maker posts the pick first (the editor bridge's own channel) and this
 * file LAYS it — on ONE layer the bridge itself draws over the page's ground
 * (`[data-main-ground-preview]`), never on anything a guest's page holds:
 *
 *   parent → frame  { source:'setnayan-editor', t:'mainGround', seq, lay }
 *     lay = { still, clip, position, color, image, size,    a picture (its still first, the clip when it can
 *             scrim, blur, vars }                           play) under the scrim and tint the page's own rules
 *                                                           measured for it; a colour, a blend, a pattern
 *     lay = null                                            take it off (the save was refused)
 *   parent → frame  { source:'setnayan-editor', t:'mainGround', seq, landed: true }   that pick's save has landed
 *   frame  → parent { source:'setnayan-site', t:'mainGround', seq, shown }   the still is on screen / could not load
 *   frame  → parent { source:'setnayan-site', t:'mainGround', seq, playing: true }  its clip is moving (the Maker's stopwatch)
 *   frame  → parent { source:'setnayan-site', t:'mainGround', redrawn: true } the page's own render is on screen
 *
 * 🔑 ONE WRITE, NO RENDER (owner rule 2026-10-08, "the minimum-request rules": a press costs one request; a canvas
 * reload is a whole guest-page render). A pick the client can draw EXACTLY — the picture, where it is held, its
 * blur, the scrim and the tint the page's own functions measure for it — is worn here and STAYS: its save asks the
 * server for nothing more. The layer steps aside only when this page next renders for another reason, and only for
 * a render ASKED AFTER the pick's save landed (`land` → `redrawStarted` → `redrawDone`): an older render must never
 * take a newer pick off the canvas — nothing would bring it back.
 * While it is worn: the ground it replaces is hidden (never two films decoding), that ground's own tint is lifted,
 * and Classic's opaque shell paper steps aside exactly as the server makes it when a ground is drawn.
 *
 * 🔒 NOTHING FROM THE MESSAGE BECOMES CSS UNCHECKED: an address must be this
 * origin's own path or an https URL with no quote, bracket or space; a colour a
 * 6-digit hex; a blend or pattern a gradient spelled in a closed alphabet (no
 * `url(`, no quote, no semicolon); a position one of three words. The bridge
 * also checks the message's origin. Tiny and dependency-free: it ships in the
 * guest page's bundle, behind the bridge.
 */

/** `lib/background-pick.ts` builds it (`backgroundLayOf`); a type only — nothing of the Maker's ships here. */
export type MainGroundLay = {
  still: string | null;
  clip: string | null;
  position: string;
  color: string | null;
  image: string | null;
  size: string | null;
  /** The page's paper over the picture, 0–1 — `resolveAdaptiveTheme(…).scrim`, what `MainGround` draws. */
  scrim: number | null;
  blur: string | null;
  /** `adaptiveThemeVars(…)` — the tint a picture lends the page, laid on the look scope exactly as `MainGround` lays it. */
  vars: Record<string, string>;
};
export type MainGroundPreview = { seq: number; lay: MainGroundLay | null } | { seq: number; landed: true };

const POSITIONS = ['center', 'center top', 'center bottom'];
const BLURS = ['soft', 'strong'];
const HEX = /^#[0-9a-f]{6}$/i;
const TRIPLET = /^\d{1,3} \d{1,3} \d{1,3}$/;
/** The ONLY variables a picture may move — the names `adaptiveThemeVars` writes (`lib/adaptive-theme.ts`). */
const VARS = [
  '--color-mulberry', '--color-mulberry-600', '--color-mulberry-700',
  '--color-gild', '--color-gild-text', '--color-terracotta', '--color-terracotta-600', '--color-terracotta-700',
  '--hub-accent', '--hub-accent-ink', '--accent',
];
/** Gradients only — letters, digits and the punctuation a gradient or a `var(--…)` needs. */
const PAINT = /^[a-z0-9#(),.%\s/-]{1,1200}$/i;
const UNSAFE_URL = /[\s"'()<>\\]/;

function addressOk(u: unknown, origin: string): u is string {
  if (typeof u !== 'string' || u.length === 0 || u.length > 2048 || UNSAFE_URL.test(u)) return false;
  if (u.startsWith('/')) return !u.startsWith('//');
  return u.startsWith('https://') || u.startsWith(`${origin}/`);
}
const paintOk = (v: unknown): v is string => typeof v === 'string' && PAINT.test(v) && !/url|image|expression/i.test(v);

/** The message's payload, or null when any part of it is not what the Maker's own builder writes. */
export function sanitizeMainGroundPreview(data: unknown, origin: string): MainGroundPreview | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { seq?: unknown; lay?: unknown; landed?: unknown };
  if (typeof d.seq !== 'number' || !Number.isSafeInteger(d.seq) || d.seq < 1) return null;
  if (d.landed === true) return { seq: d.seq, landed: true };
  if (d.lay === null) return { seq: d.seq, lay: null };
  if (!d.lay || typeof d.lay !== 'object') return null;
  const l = d.lay as Record<string, unknown>;
  const opt = <T,>(v: unknown, ok: (x: unknown) => x is T): T | null | undefined => (v === null || v === undefined ? null : ok(v) ? v : undefined);
  const still = opt(l.still, (x): x is string => addressOk(x, origin));
  const clip = opt(l.clip, (x): x is string => addressOk(x, origin));
  const color = opt(l.color, (x): x is string => typeof x === 'string' && HEX.test(x));
  const image = opt(l.image, paintOk);
  const size = opt(l.size, paintOk);
  const scrim = opt(l.scrim, (x): x is number => typeof x === 'number' && x >= 0 && x <= 1);
  const blur = opt(l.blur, (x): x is string => typeof x === 'string' && BLURS.includes(x));
  const position = typeof l.position === 'string' && POSITIONS.includes(l.position) ? l.position : null;
  const rawVars = l.vars === null || l.vars === undefined ? {} : l.vars;
  if (typeof rawVars !== 'object' || Array.isArray(rawVars)) return null;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawVars as Record<string, unknown>)) {
    if (!VARS.includes(k) || typeof v !== 'string' || !(HEX.test(v) || TRIPLET.test(v))) return null;
    vars[k] = v;
  }
  if (still === undefined || clip === undefined || color === undefined || image === undefined || size === undefined || scrim === undefined || blur === undefined || !position) return null;
  return { seq: d.seq, lay: { still, clip, position, color, image, size, scrim, blur, vars } };
}

export type MainGroundPreviewer = {
  lay(preview: { seq: number; lay: MainGroundLay | null }): void;
  /** That pick's save has landed: a render asked from now on holds it. */
  land(seq: number): void;
  /** The page was just asked to re-render itself. */
  redrawStarted(): void;
  /** …and that render is on screen: where it holds the pick laid here, the server's own ground is the truth now. */
  redrawDone(): void;
};

/** The ground a preview replaces, hidden while it is worn — and the theme's own loop with it: never two films decoding. */
const UNDER =
  '[data-guest-ground] [data-theme-loop],[data-guest-ground] [data-theme-poster],[data-main-ground],[data-main-ground-pattern]{display:none}';
/**
 * Classic's shell paints an OPAQUE paper over everything behind it (`invitation-shell.tsx`, `bg-cream`); the server
 * drops it whenever a ground is drawn. While a preview is worn the shell is MARKED and this rule clears it — never a
 * class React owns, so whatever the next render makes of the shell is untouched.
 */
const SHELL = '[data-ground-preview-shell]{background-color:transparent !important}';

/**
 * The previewer for ONE canvas document. `layer` is the bridge's own element
 * (`fixed inset-0 -z-10`, after every ground the page draws, `hidden` at rest);
 * `tell` posts to the Maker.
 */
export function createMainGroundPreviewer(
  layer: HTMLElement,
  tell: (m: { seq: number; shown: boolean } | { seq: number; playing: true } | { redrawn: true }) => void,
): MainGroundPreviewer {
  const doc = layer.ownerDocument;
  const win = doc.defaultView;
  let seq = 0;
  let landed = 0;
  let atRedraw = 0;
  let shell: Element | null = null;
  /** The style the preview owns: what it hides, and the tint it lends. A sibling of the layer's pictures, kept across lays. */
  let rule: HTMLStyleElement | null = null;
  const lifted: HTMLStyleElement[] = [];
  const wear = (l: MainGroundLay) => {
    const tint = Object.entries(l.vars).map(([k, v]) => `${k}:${v} !important;`).join('');
    if (!rule) rule = doc.createElement('style');
    rule.textContent = SHELL + UNDER + (tint ? `[data-guest-look]{${tint}}` : '');
    if (!rule.parentNode) doc.head.append(rule);
    /* The tint of the ground being replaced is the server's own stylesheet — lifted while the preview is worn. */
    if (lifted.length === 0) {
      for (const s of doc.querySelectorAll<HTMLStyleElement>('style[data-main-ground-style]')) {
        s.media = 'not all';
        lifted.push(s);
      }
    }
    if (!shell) {
      shell = layer.closest('main');
      shell?.setAttribute('data-ground-preview-shell', '');
    }
  };
  /** The ground underneath comes back (still covered by the layer) — its own tint and its own film, ready to take over. */
  const uncover = () => {
    if (rule) rule.textContent = SHELL;
    for (const s of lifted.splice(0)) s.removeAttribute('media');
  };
  const off = () => {
    layer.hidden = true;
    layer.replaceChildren();
    layer.removeAttribute('style');
    uncover();
    rule?.remove();
    shell?.removeAttribute('data-ground-preview-shell');
    shell = null;
  };
  const paint = (l: MainGroundLay) => {
    /* No colour of its own = the page's own paper, which lies under this layer (the ground it replaces is hidden). */
    layer.style.backgroundColor = l.color ?? '';
    layer.style.backgroundImage = l.image ?? '';
    layer.style.backgroundSize = l.size ?? '';
  };
  const calm = () =>
    Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) ||
    (win?.navigator as { connection?: { saveData?: boolean } } | undefined)?.connection?.saveData === true;
  return {
    lay({ seq: n, lay: l }) {
      if (n < seq) return; // an older pick's message, late
      seq = n;
      if (!l) return off();
      if (!l.still) {
        /* A colour, a blend, a pattern: nothing to fetch. */
        layer.replaceChildren();
        paint(l);
        wear(l);
        layer.hidden = false;
        tell({ seq: n, shown: true });
        return;
      }
      /* A picture: its still first — and the layer keeps what it showed until this one is READY, so a second pick
         never flashes back to the saved background on its way to the new one. */
      const img = new (win?.Image ?? Image)();
      img.onload = () => {
        if (seq !== n) return;
        /* A blur's soft edge would show the page through it — drawn a little larger (the guest page's own numbers). */
        const soften = (el: HTMLElement) => {
          if (!l.blur) return;
          el.style.filter = `blur(${l.blur === 'strong' ? 14 : 5}px)`;
          el.style.transform = 'scale(1.08)';
        };
        const still = doc.createElement('div');
        still.className = 'absolute inset-0 bg-cover';
        still.style.backgroundImage = `url(${JSON.stringify(l.still)})`;
        still.style.backgroundPosition = l.position;
        soften(still);
        /* The scrim the page measures for this picture: its own paper, at that strength — over the still AND the clip. */
        const scrim = doc.createElement('div');
        scrim.className = 'absolute inset-0';
        scrim.style.backgroundColor = `rgb(var(--color-cream) / ${(l.scrim ?? 0).toFixed(2)})`;
        layer.replaceChildren(still, scrim);
        paint(l);
        wear(l);
        layer.hidden = false;
        (win?.requestAnimationFrame ?? ((f: () => void) => f()))(() => seq === n && tell({ seq: n, shown: true }));
        if (!l.clip || calm()) return;
        /* …then the clip, invisible until it MOVES (the guest page's own rule): a clip that cannot play leaves the still. */
        const clip = doc.createElement('video');
        clip.muted = true;
        clip.loop = true;
        clip.playsInline = true;
        clip.preload = 'auto';
        clip.setAttribute('aria-hidden', 'true');
        clip.className = 'absolute inset-0 h-full w-full object-cover';
        clip.style.objectPosition = l.position;
        soften(clip);
        clip.style.opacity = '0';
        clip.style.transition = 'opacity 200ms';
        clip.addEventListener(
          'playing',
          () => {
            clip.style.opacity = '1';
            if (seq === n) tell({ seq: n, playing: true });
          },
          { once: true },
        );
        clip.addEventListener('error', () => clip.remove(), { once: true });
        clip.src = l.clip;
        scrim.before(clip);
        void clip.play().catch(() => {});
      };
      img.onerror = () => seq === n && tell({ seq: n, shown: false });
      img.src = l.still;
    },
    land(n) {
      if (n > landed) landed = n;
    },
    redrawStarted() {
      atRedraw = landed;
    },
    redrawDone() {
      tell({ redrawn: true });
      /* Only a render asked AFTER this pick's save landed holds it. An older one leaves the pick where it is. */
      if (layer.hidden || seq > atRedraw) return;
      const n = seq;
      const drop = () => seq === n && off();
      /* A moving preview waits (briefly) for the page's own clip to move, so the swap is not a still frame between two films. */
      const mine = layer.querySelector('video');
      uncover();
      const theirs = [...doc.querySelectorAll<HTMLVideoElement>('[data-main-ground] video, [data-guest-ground] video')].find((v) => !layer.contains(v));
      if (mine && !mine.paused && theirs && (theirs.paused || theirs.currentTime === 0)) {
        theirs.addEventListener('playing', drop, { once: true });
        win?.setTimeout(drop, 2500);
      } else drop();
    },
  };
}
