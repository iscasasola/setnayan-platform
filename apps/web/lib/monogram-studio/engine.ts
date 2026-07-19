// @ts-nocheck
/**
 * monogram-studio-engine.ts — the Vector Monogram Studio engine (Phase 5).
 *
 * A faithful port of the verified `show_widget` prototype (v21). It is an
 * imperative canvas engine driving paper.js (boolean interlock, mirrored
 * fountain-pen frame, stamped symbols, ink-reveal animations) over real
 * opentype.js glyph outlines. The whole composition is vector, so the saved
 * mark is PURE PATHS (no webfonts) — it renders crisp via an inert data-URI
 * <img> on every Setnayan surface.
 *
 * `// @ts-nocheck`: paper.js objects are accessed dynamically and the engine is
 * ported working-as-is; re-deriving ~40 strict-mode signatures would risk
 * injecting behaviour bugs into verified logic. The public surface
 * (mountStudio's return) is consumed from the fully-typed studio.tsx wrapper.
 *
 * mountStudio({ root, paper, opentype, PaperOffset, initialConfig }) wires the
 * editor DOM inside `root`, loads the self-hosted OFL faces, restores
 * initialConfig if given, and returns:
 *   · getExport() → { svg, config } | null   (tight-viewBox pure-paths SVG +
 *     re-editable config; null when the mark is empty)
 *   · destroy()                               (tears down listeners + project)
 */

const FONT_BASE = '/monogram-studio/fonts/';
const FONTS = {
  cardo: 'Cardo-Italic.ttf',
  gilda: 'GildaDisplay-Regular.ttf',
  playfairsc: 'PlayfairDisplaySC-Regular.ttf',
  marcellus: 'Marcellus-Regular.ttf',
  yeseva: 'YesevaOne-Regular.ttf',
  cinzeldec: 'CinzelDecorative-Regular.ttf',
  script: 'GreatVibes-Regular.ttf',
  pinyon: 'PinyonScript-Regular.ttf',
};

export function mountStudio(opts) {
  const root = opts.root;
  const paper = opts.paper;
  const opentype = opts.opentype;
  const PaperOffset = opts.PaperOffset;
  const initialConfig = opts.initialConfig || null;
  const initialNames = opts.initialNames || null;
  // gold/molten reveal kinds are React components (CSS GoldMonogramReveal /
  // WebGL MoltenMonogramReveal), not paper.js — the host renders them in an
  // overlay over <canvas id=cv>. play() calls this with (kind, svg) for gold/
  // molten, and (null, null) to clear the overlay when a canvas kind plays.
  const onPreviewKind = opts.onPreviewKind || function () {};
  // Host capability: true when the host renders EVERY reveal kind in its
  // overlay (the StudioRevealPlayer portal) — the benchmark's one-implementation
  // preview. False/absent → the legacy canvas acts run for draw-on kinds.
  const portalPreview = Boolean(opts.portalPreview);
  // App-frame mode (owner 2026-07-17 "imagespace … draggable, like the
  // Photoshop app"): the editor fills a fixed frame, so there is no page
  // beneath the canvas to scroll — a background finger PANS the artboard
  // again, and the canvas owns every touch gesture.
  const appFrame = Boolean(opts.appFrame);

  const GOLD = '#C5A059';
  const CHECKER =
    'conic-gradient(#e4e4e4 90deg,#fbfbfa 0 180deg,#e4e4e4 0 270deg,#fbfbfa 0) 0 0/16px 16px';
  const $ = function (id) {
    return root.querySelector('#' + id);
  };
  const cv = $('cv'),
    load = $('load'),
    hint = $('hint'),
    ro = $('ro'),
    namesEl = $('names'),
    zoomEl = $('zoom'),
    crossBox = $('cross'),
    crossLab = $('crosslab'),
    crosstop = $('crosstop'),
    selBox = $('selbox'),
    penBox = $('penbox'),
    symBox = $('symbox'),
    undoBtn = $('undo'),
    redoBtn = $('redo');
  const cache = {};
  let font = null,
    fontKey = 'cardo',
    proj = null,
    zt = null,
    keyHandler = null,
    resizeObs = null,
    sizeRaf = 0;
  // Set true by destroy(). Every async font callback bails on it so a fetch
  // that resolves AFTER the component unmounted (e.g. a route nav away+back
  // before the boot fetch finishes) can never run start()/applyConfig against a
  // torn-down or replaced DOM — the very race that left the studio stuck on
  // "Loading the typeface…". Centralised here so all three loadFont call sites
  // (boot · applyConfig font · font-chip click) are covered at once.
  let destroyed = false;

  function loadFont(key, cb) {
    if (destroyed) return;
    if (cache[key]) {
      cb(cache[key]);
      return;
    }
    fetch(FONT_BASE + FONTS[key])
      .then(function (r) {
        return r.arrayBuffer();
      })
      .then(function (buf) {
        if (destroyed) return;
        try {
          const f = opentype.parse(buf);
          cache[key] = f;
          cb(f);
        } catch (e) {
          cb(null);
        }
      })
      .catch(function () {
        if (destroyed) return;
        cb(null);
      });
  }

  let view,
    layer,
    penLayer,
    frameLayer,
    FS,
    ink,
    inkHex,
    bgc,
    outlineHex,
    letters = [],
    base = [],
    st = [],
    order = [],
    pstate = {},
    sel = null,
    selPair = null,
    hit = [],
    regions = [];
  let drawMode = false,
    mirror = 'v',
    penW = 14,
    nibAngle = 40,
    nibStyle = 'broad',
    strokes = [],
    cur = null,
    animating = false,
    anim = 'handwriting',
    animDur = 6.0,
    animSmooth = 0.9,
    animDelay = 0.3;
  let syms = [],
    selSym = null,
    symHitPaths = [];
  // Parametric frame patterns (council verdict §4) — compact recipes rendered
  // to filled geometry on frameLayer (below the letters). lettersBounds feeds
  // the auto-fit; frameCacheKey skips rebuilds while nothing frame-relevant
  // changed (booleans like scallop are too dear to re-run per drag frame).
  let frames = [],
    selFrame = null,
    lettersBounds = null,
    frameCacheKey = '';
  // Starting-point provenance (§3) — which preset card seeded this design.
  // Analytics only; rendering never reads it.
  let presetKey = null;
  // Reveal tempo (§5.4): the lit chip. The stored dur/smooth/delay numbers
  // stay canonical — 'custom' after any fine-tune slider touch.
  const ANIM_TEMPOS = {
    quick: { dur: 3, delay: 0.15, smooth: 0.7 },
    classic: { dur: 6, delay: 0.3, smooth: 0.9 },
    ceremonial: { dur: 10, delay: 0.6, smooth: 1 },
  };
  let animTempo = 'classic';
  let pts = new Map(),
    mode = null,
    Bz = {},
    Bh = {},
    lastV = null,
    lastP = null,
    downV = null,
    moved = false,
    downPair = null;
  let undoStack = [],
    redoStack = [],
    preGesture = null,
    preSlider = null;
  // v2 markup handle (monogram_studio_v2 · council verdict §2) — set by bindUI
  // when the injected DOM carries the Letters·Frame·Reveal tabs (markup-v2).
  // Stays null on the v1 markup, where every v2 branch is inert.
  let v2 = null;

  function cpPts(a) {
    return a.map(function (q) {
      return { x: q.x, y: q.y, pr: q.pr };
    });
  }
  function cpFrames(a) {
    return (a || []).map(function (f) {
      return { kind: f.kind, c: f.c, inset: f.inset, scale: f.scale, tx: f.tx, ty: f.ty, thick: f.thick, count: f.count, gap: f.gap, dbl: !!f.dbl, weave: !!f.weave };
    });
  }
  function cpSyms(a) {
    return a.map(function (s) {
      return { kind: s.kind, tx: s.tx, ty: s.ty, scale: s.scale, rot: s.rot, mode: s.mode, c: s.c };
    });
  }
  function snap() {
    return {
      st: st.map(function (s) {
        const o = Object.assign({}, s);
        o.rot = (((o.rot || 0) % 360) + 540) % 360 - 180; // wrap like D8
        return o;
      }),
      order: order.slice(),
      pstate: Object.assign({}, pstate),
      strokes: strokes.map(function (s) {
        return { w: s.w, nib: s.nib, style: s.style, c: s.c, mode: s.mode, pts: cpPts(s.pts) };
      }),
      syms: cpSyms(syms),
      frames: cpFrames(frames),
    };
  }
  function restore(s) {
    st = s.st.map(function (o) {
      return Object.assign({}, o);
    });
    order = s.order.slice();
    pstate = Object.assign({}, s.pstate);
    strokes = s.strokes.map(function (o) {
      return { w: o.w, nib: o.nib, style: o.style, c: o.c, mode: o.mode, pts: cpPts(o.pts) };
    });
    syms = cpSyms(s.syms || []);
    frames = cpFrames(s.frames || []);
    sel = null;
    selPair = null;
    selSym = null;
    selFrame = null;
  }
  function pushUndo() {
    undoStack.push(snap());
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
    updU();
  }
  function updU() {
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
  }
  function doUndo() {
    if (!undoStack.length) return;
    redoStack.push(snap());
    restore(undoStack.pop());
    full();
    updU();
    reflectShelf();
  }
  function doRedo() {
    if (!redoStack.length) return;
    undoStack.push(snap());
    restore(redoStack.pop());
    full();
    updU();
    reflectShelf();
  }

  // Match the view's project-space size to the canvas host's rendered box so
  // the mark renders 1:1 (no vertical stretch) at whatever size the CSS gives
  // it. The mark is composed around the origin, so we keep view.center fixed
  // through the resize and just grow/shrink the visible window around it.
  function syncViewSize() {
    if (!view) return;
    const host = cv.parentElement || cv;
    const w = Math.max(1, Math.round(host.clientWidth || cv.clientWidth || 390));
    const h = Math.max(1, Math.round(host.clientHeight || cv.clientHeight || 300));
    const vs = view.viewSize;
    if (Math.abs(vs.width - w) < 1 && Math.abs(vs.height - h) < 1) return;
    const c = view.center;
    view.viewSize = new paper.Size(w, h);
    view.center = c;
    try {
      view.update();
    } catch (e) {}
  }

  function start() {
    paper.setup(cv);
    view = paper.view;
    proj = paper.project;
    layer = paper.project.activeLayer;
    penLayer = new paper.Layer();
    // Frames render BELOW the letters — letters win over rules (§4.4, the whole
    // point of open-ring); strokes/symbols stay ABOVE letters exactly as
    // before. Canonical export order: frames → letters → strokes → syms.
    frameLayer = new paper.Layer();
    proj.insertLayer(0, frameLayer);
    layer.activate();
    // Size the paper.js view to the canvas's ACTUAL rendered box (the .sw2
    // host obeys the CSS — full-width on mobile, a tall two-column preview on
    // desktop) instead of a hardcoded 300px. A ResizeObserver keeps the view in
    // sync as the layout reflows (breakpoint flips, window resize) so the mark
    // never stretches — the studio "takes up the space" the page gives it.
    syncViewSize();
    view.center = new paper.Point(0, 0);
    try {
      if (typeof ResizeObserver !== 'undefined') {
        resizeObs = new ResizeObserver(function () {
          if (sizeRaf) cancelAnimationFrame(sizeRaf);
          sizeRaf = requestAnimationFrame(syncViewSize);
        });
        resizeObs.observe(cv.parentElement || cv);
      }
    } catch (e) {}
    FS = 150;
    ink = new paper.Color('#5C2542');
    inkHex = '#5C2542';
    bgc = '#FBFBFA';
    outlineHex = '#C5A059';
    bindUI();
    // Seed from the event's initials (e.g. "A & B") on a FIRST open — when there
    // is no saved studio design to restore. Without this the editor falls back to
    // its built-in "Maria & Juan" placeholder, so a couple sees the wrong
    // initials and a save would replace their assigned monogram with a generic
    // one. A saved initialConfig (applyConfig) carries its own names, so skip then.
    if (!initialConfig && initialNames) namesEl.value = initialNames;
    derive();
  }
  function glyphPath(ch) {
    const d = font.getPath(ch, 0, 0, FS).toPathData(2);
    let it = paper.project.importSVG('<path d="' + d + '"/>', { insert: true });
    if (it && it.className === 'Group') {
      const k = it.children[0];
      it.remove();
      it = k;
    }
    return it;
  }
  function buildBase() {
    base.forEach(function (p) {
      if (p) p.remove();
    });
    layer.activate();
    base = letters.map(glyphPath);
    base.forEach(function (p) {
      if (p) p.remove();
    });
  }
  function computeLetters(value) {
    const v = (value || '').trim(),
      parts = v.split(/\s*(?:&|\+|\band\b)\s*/i).filter(Boolean);
    // Array.from splits by code point, so an emoji/surrogate-pair first
    // character stays one glyph instead of half a surrogate.
    const first = function (s, dflt) {
      const ch = Array.from(s || '')[0];
      return (ch || dflt).toUpperCase();
    };
    if (parts.length >= 2) return [first(parts[0], 'M'), '&', first(parts[1], 'J')];
    if (parts.length === 1) return [first(parts[0], 'M')];
    return ['M', '&', 'J'];
  }
  function derive() {
    letters = computeLetters(namesEl.value);
    buildBase();
    initState();
    undoStack = [];
    redoStack = [];
    updU();
    full();
    // The strip's card set depends on letters.length (duo vs solo presets), so
    // it must (re)build AFTER the letters exist — bindUI runs before the first
    // derive, when letters is still []. No-op on the v1 markup.
    buildPresetStrip();
  }
  function initState() {
    st = letters.map(function (_, i) {
      return { tx: offX(i), ty: 0, scale: i === 1 ? 0.62 : 1, gap: 6, outline: 3, clean: false, strength: 0.3, rot: 0, skew: 0, flipX: false };
    });
    order = letters.map(function (_, i) {
      return i;
    });
    pstate = {};
    sel = null;
    selPair = null;
  }
  function offX(i) {
    if (letters.length < 3) return 0;
    return (i - 1) * FS * 0.36;
  }
  function pkey(i, j) {
    return Math.min(i, j) + '-' + Math.max(i, j);
  }
  function pst(i, j) {
    return pstate[pkey(i, j)] || 'cut';
  }
  function topOf(i, j) {
    return order.indexOf(i) > order.indexOf(j) ? i : j;
  }
  function setTop(top, other) {
    order = order.filter(function (x) {
      return x !== top;
    });
    const oi = order.indexOf(other);
    order.splice(oi + 1, 0, top);
  }
  function lp(i) {
    if (!base[i]) return null;
    const p = base[i].clone();
    p.pivot = p.bounds.center;
    p.scale(st[i].scale);
    // Owner 2026-07-17 "flip, tilt in perspective, rotate" — all affine, so
    // they compose cleanly BEFORE the boolean pipeline sees the path.
    if (st[i].flipX) p.scale(-1, 1);
    if (st[i].skew) {
      try {
        p.shear(Math.tan((st[i].skew * Math.PI) / 180), 0);
      } catch (e) {}
    }
    if (st[i].rot) p.rotate(st[i].rot);
    p.position = new paper.Point(st[i].tx, st[i].ty);
    return p;
  }
  function dilate(p, g) {
    if (g <= 0) return p.clone();
    try {
      const a = PaperOffset.offset(p, g),
        b = PaperOffset.offset(p, -g);
      return Math.abs(a.area) >= Math.abs(b.area) ? a : b;
    } catch (e) {
      return p.clone();
    }
  }
  function cleanPath(p, strn) {
    try {
      if (p.className === 'CompoundPath') {
        const minA = FS * FS * 0.0004;
        p.children.slice().forEach(function (c) {
          if (Math.abs(c.area) < minA) c.remove();
        });
      }
      const kids = p.className === 'CompoundPath' ? p.children : [p],
        eps = FS * 0.004;
      kids.forEach(function (c) {
        try {
          c.curves.forEach(function (cu) {
            const a = cu.point1,
              b = cu.point2,
              m = cu.getPointAtTime(0.5),
              ab = b.subtract(a),
              Ln = ab.length || 1,
              t = m.subtract(a),
              d = Math.abs(t.x * ab.y - t.y * ab.x) / Ln;
            if (d < eps) {
              cu.segment1.handleOut = new paper.Point(0, 0);
              cu.segment2.handleIn = new paper.Point(0, 0);
            }
          });
        } catch (e) {}
        if (strn > 0) {
          try {
            c.simplify(eps * (1 + strn * 7));
          } catch (e) {}
        }
        try {
          c.reduce();
        } catch (e) {}
      });
    } catch (e) {}
    return p;
  }
  function symBuilder(kind, S) {
    const P = paper.Point;
    if (kind === 'dot') return new paper.Path.Circle({ center: [0, 0], radius: S * 0.2, insert: false });
    if (kind === 'ring') {
      const cp = new paper.CompoundPath({
        children: [
          new paper.Path.Circle({ center: [0, 0], radius: S * 0.46, insert: false }),
          new paper.Path.Circle({ center: [0, 0], radius: S * 0.31, insert: false }),
        ],
        insert: false,
      });
      cp.fillRule = 'evenodd';
      return cp;
    }
    if (kind === 'diamond') return new paper.Path.RegularPolygon({ center: [0, 0], sides: 4, radius: S * 0.5, insert: false });
    if (kind === 'triangle') return new paper.Path.RegularPolygon({ center: [0, 0], sides: 3, radius: S * 0.52, insert: false });
    if (kind === 'star') return new paper.Path.Star({ center: [0, 0], points: 5, radius1: S * 0.2, radius2: S * 0.5, insert: false });
    if (kind === 'sparkle') return new paper.Path.Star({ center: [0, 0], points: 4, radius1: S * 0.08, radius2: S * 0.52, insert: false });
    if (kind === 'heart') {
      const s = S * 0.42,
        p = new paper.Path({ insert: false });
      p.moveTo(new P(0, s * 0.92));
      p.cubicCurveTo(new P(-s * 1.3, s * 0.05), new P(-s * 0.78, -s * 0.95), new P(0, -s * 0.28));
      p.cubicCurveTo(new P(s * 0.78, -s * 0.95), new P(s * 1.3, s * 0.05), new P(0, s * 0.92));
      p.closePath();
      return p;
    }
    if (kind === 'leaf') {
      const s2 = S * 0.5,
        l = new paper.Path({ insert: false });
      l.moveTo(new P(0, -s2));
      l.cubicCurveTo(new P(s2 * 0.82, -s2 * 0.32), new P(s2 * 0.82, s2 * 0.32), new P(0, s2));
      l.cubicCurveTo(new P(-s2 * 0.82, s2 * 0.32), new P(-s2 * 0.82, -s2 * 0.32), new P(0, -s2));
      l.closePath();
      return l;
    }
    return new paper.Path.Circle({ center: [0, 0], radius: S * 0.2, insert: false });
  }
  function symBase(i) {
    const sm = syms[i];
    const p = symBuilder(sm.kind, 70);
    p.pivot = p.bounds.center;
    p.scale(sm.scale);
    p.rotate(sm.rot);
    p.position = new paper.Point(sm.tx, sm.ty);
    return p;
  }

  /* ── Parametric frame patterns (council verdict §4) ──────────────────────
   * frameBuilder-family: every pattern is generated from a compact recipe —
   * NEVER stored stroke data — as FILLED geometry (the export walk keeps only
   * filled children, §4.5), auto-fitted to the letter bounds. sampaguita +
   * laurel are the Filipino-identity keeps. */
  const FRAME_DEFS = [
    { kind: 'ring', label: 'Ring' },
    { kind: 'double-ring', label: 'Double ring' },
    { kind: 'open-ring', label: 'Open ring' },
    { kind: 'diamond', label: 'Diamond' },
    { kind: 'cartouche', label: 'Cartouche' },
    { kind: 'arch', label: 'Arch' },
    { kind: 'scallop', label: 'Scallop' },
    { kind: 'laurel', label: 'Laurel' },
    { kind: 'wreath', label: 'Wreath' },
    { kind: 'sampaguita', label: 'Sampaguita' },
    { kind: 'corner-lines', label: 'Corner lines' },
    { kind: 'corner-flourish', label: 'Corner flourish' },
    { kind: 'sprigs', label: 'Side sprigs' },
    { kind: 'cardinal-marks', label: 'Cardinal marks' },
    { kind: 'sparkle-duo', label: 'Sparkle pair' },
  ];
  const ACCENT_KINDS = ['sprigs', 'cardinal-marks', 'sparkle-duo'];
  // Band-shaped enclosures — the kinds whose crossings can WEAVE (owner
  // 2026-07-17 "frames that can intertwine"). Organic kinds (laurel/wreath/
  // sampaguita) just layer.
  const BAND_KINDS = ['ring', 'double-ring', 'open-ring', 'diamond', 'cartouche', 'arch', 'scallop'];
  function frameClass(kind) {
    if (kind.indexOf('corner-') === 0) return 'corner';
    if (ACCENT_KINDS.indexOf(kind) >= 0) return 'accent';
    return 'enclosure';
  }
  // Owner override 2026-07-17: two enclosures may stack (and weave); corners
  // and accents keep one slot each.
  const FRAME_CLASS_CAP = { enclosure: 2, corner: 1, accent: 1 };
  function frameDefaults(kind) {
    const f = { kind: kind, c: outlineHex && outlineHex !== 'none' ? outlineHex : GOLD, inset: 24, scale: 1, tx: 0, ty: 0, thick: 6, count: 12, gap: 24, dbl: false };
    if (kind === 'laurel') { f.count = 18; f.thick = 7; }
    if (kind === 'wreath') { f.count = 26; f.thick = 7; }
    if (kind === 'sampaguita') { f.count = 10; }
    if (kind === 'scallop') { f.count = 22; }
    if (kind === 'open-ring') { f.gap = 60; }
    if (kind === 'corner-lines' || kind === 'corner-flourish') { f.gap = 46; f.thick = 5; f.inset = 34; }
    if (kind === 'sprigs') { f.thick = 6; f.inset = 30; f.count = 3; }
    if (kind === 'cardinal-marks') { f.thick = 7; f.inset = 40; }
    if (kind === 'sparkle-duo') { f.thick = 8; f.inset = 36; }
    return f;
  }
  function annulus(cx, cy, ro, ri, col) {
    const cp = new paper.CompoundPath({
      children: [
        new paper.Path.Circle({ center: [cx, cy], radius: Math.max(1, ro), insert: false }),
        new paper.Path.Circle({ center: [cx, cy], radius: Math.max(0.5, ri), insert: false }),
      ],
      insert: false,
    });
    cp.fillRule = 'evenodd';
    cp.fillColor = col;
    cp.strokeColor = null;
    return cp;
  }
  function leafAt(x, y, deg, S, col) {
    const l = symBuilder('leaf', S);
    l.rotate(deg);
    l.position = new paper.Point(x, y);
    l.fillColor = col;
    l.strokeColor = null;
    return l;
  }
  function buildFramePaths(f, b) {
    const col = new paper.Color(f.c);
    const cx = b.center.x + f.tx,
      cy = b.center.y + f.ty;
    const base = Math.max(b.width, b.height) / 2;
    const R = Math.max(8, (base + f.inset) * f.scale);
    const th = Math.max(1, f.thick);
    const k = f.kind;
    const out = [];
    const fill = function (p) {
      p.fillColor = col;
      p.strokeColor = null;
      out.push(p);
    };
    if (k === 'ring') {
      out.push(annulus(cx, cy, R + th, R, col));
    } else if (k === 'double-ring') {
      out.push(annulus(cx, cy, R + th, R, col));
      const g2 = Math.max(2, f.gap * 0.15);
      out.push(annulus(cx, cy, R + th + g2 + Math.max(1, th * 0.5), R + th + g2, col));
    } else if (k === 'open-ring') {
      const ring = annulus(cx, cy, R + th, R, col);
      const ang = (Math.min(120, Math.max(12, f.gap)) * Math.PI) / 180;
      const far = (R + th) * 2;
      const wedge = new paper.Path({ insert: false });
      wedge.moveTo(new paper.Point(cx, cy));
      wedge.lineTo(new paper.Point(cx + far * Math.cos(-Math.PI / 2 - ang / 2), cy + far * Math.sin(-Math.PI / 2 - ang / 2)));
      wedge.lineTo(new paper.Point(cx + far * Math.cos(-Math.PI / 2 + ang / 2), cy + far * Math.sin(-Math.PI / 2 + ang / 2)));
      wedge.closePath();
      try {
        fill(ring.subtract(wedge));
      } catch (e) {
        out.push(ring);
      }
    } else if (k === 'diamond') {
      const cp = new paper.CompoundPath({
        children: [
          new paper.Path.RegularPolygon({ center: [cx, cy], sides: 4, radius: R * 1.3 + th, insert: false }),
          new paper.Path.RegularPolygon({ center: [cx, cy], sides: 4, radius: R * 1.3, insert: false }),
        ],
        insert: false,
      });
      cp.fillRule = 'evenodd';
      fill(cp);
    } else if (k === 'cartouche') {
      const inset = f.inset * f.scale;
      const ix = b.x - inset,
        iy = b.y - inset,
        iw = b.width + 2 * inset,
        ih = b.height + 2 * inset;
      const rad = Math.min(iw, ih) * 0.18;
      const cp = new paper.CompoundPath({
        children: [
          new paper.Path.Rectangle({ rectangle: new paper.Rectangle(ix - th, iy - th, iw + 2 * th, ih + 2 * th), radius: rad + th, insert: false }),
          new paper.Path.Rectangle({ rectangle: new paper.Rectangle(ix, iy, iw, ih), radius: rad, insert: false }),
        ],
        insert: false,
      });
      cp.fillRule = 'evenodd';
      fill(cp);
    } else if (k === 'arch') {
      const crown = cy - R * 0.18;
      const solid = function (r) {
        const c = new paper.Path.Circle({ center: [cx, crown], radius: r, insert: false });
        const rect = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(cx - r, crown, 2 * r, R * 1.18), insert: false });
        return c.unite(rect);
      };
      try {
        fill(solid(R + th).subtract(solid(R)));
      } catch (e) {
        out.push(annulus(cx, cy, R + th, R, col));
      }
    } else if (k === 'scallop') {
      const n = Math.max(6, Math.round(f.count));
      const rb = Math.max(3, ((Math.PI * R) / n) * 0.85);
      try {
        let solid = new paper.Path.Circle({ center: [cx, cy], radius: R, insert: false });
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          solid = solid.unite(new paper.Path.Circle({ center: [cx + R * Math.cos(a), cy + R * Math.sin(a)], radius: rb, insert: false }));
        }
        fill(solid.subtract(new paper.Path.Circle({ center: [cx, cy], radius: Math.max(1, R - th), insert: false })));
      } catch (e) {
        out.push(annulus(cx, cy, R + th, R, col));
      }
    } else if (k === 'laurel' || k === 'wreath') {
      const n = Math.max(6, Math.round(f.count));
      const S = Math.max(10, th * 2.6);
      const openTop = k === 'laurel'; // classic laurel breathes at the top
      const a0 = openTop ? -Math.PI / 2 + 0.55 : 0;
      const span = openTop ? Math.PI * 2 - 1.1 : Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / (openTop ? Math.max(1, n - 1) : n)) * span;
        const deg = (a * 180) / Math.PI + 90 + (i % 2 ? 24 : -24);
        out.push(leafAt(cx + R * Math.cos(a), cy + R * Math.sin(a), deg, S, col));
      }
      if (openTop) {
        const tie = new paper.Path.Circle({ center: [cx, cy + R], radius: Math.max(2, th * 0.6), insert: false });
        fill(tie);
      }
    } else if (k === 'sampaguita') {
      const n = Math.max(4, Math.round(f.count));
      const S = Math.max(8, th * 1.9 + 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = cx + R * Math.cos(a),
          y = cy + R * Math.sin(a);
        for (let p = 0; p < 5; p++) {
          const pdeg = (p / 5) * 360 + (a * 180) / Math.PI;
          const prad = (pdeg * Math.PI) / 180;
          const petal = new paper.Path.Ellipse({ center: [0, 0], radius: [S * 0.5, S * 0.2], insert: false });
          petal.rotate(pdeg);
          petal.position = new paper.Point(x + S * 0.42 * Math.cos(prad), y + S * 0.42 * Math.sin(prad));
          fill(petal);
        }
        fill(new paper.Path.Circle({ center: [x, y], radius: S * 0.16, insert: false }));
      }
    } else if (k === 'sprigs') {
      // mirrored three-leaf sprigs at the sides — fanning up and outward
      const S = Math.max(10, th * 2.4);
      const n = Math.max(2, Math.min(5, Math.round(f.count)));
      [-1, 1].forEach(function (sx) {
        const bx = cx + sx * (b.width / 2 + f.inset * f.scale);
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5 fan
          const deg = sx > 0 ? 35 + t * 60 : -35 - t * 60;
          out.push(leafAt(bx + sx * Math.abs(t) * S * 0.8, cy - t * S * 1.5, deg, S, col));
        }
        const d = new paper.Path.Circle({ center: [bx, cy + S * 0.95], radius: Math.max(1.5, th * 0.35), insert: false });
        fill(d);
      });
    } else if (k === 'cardinal-marks') {
      // small diamonds at N·E·S·W on the enclosure radius
      const S = Math.max(4, th * 1.5);
      [0, 90, 180, 270].forEach(function (deg) {
        const rad = (deg * Math.PI) / 180;
        const m = new paper.Path.RegularPolygon({
          center: [cx + R * Math.cos(rad), cy + R * Math.sin(rad)],
          sides: 4,
          radius: S,
          insert: false,
        });
        fill(m);
      });
    } else if (k === 'sparkle-duo') {
      // a four-point sparkle at NE + its echo at SW — asymmetric accent
      const S = Math.max(10, th * 2.6);
      const dx2 = b.width / 2 + f.inset * f.scale,
        dy2 = b.height / 2 + f.inset * f.scale;
      const s1 = symBuilder('sparkle', S);
      s1.position = new paper.Point(cx + dx2, cy - dy2);
      fill(s1);
      const s2 = symBuilder('sparkle', S * 0.6);
      s2.position = new paper.Point(cx - dx2, cy + dy2);
      fill(s2);
    } else if (k === 'corner-lines' || k === 'corner-flourish') {
      const inset = f.inset * f.scale;
      const ix = b.x - inset,
        iy = b.y - inset,
        iw = b.width + 2 * inset,
        ih = b.height + 2 * inset;
      const L = Math.max(10, f.gap * 0.8 + 12);
      const corners = [
        [ix, iy, 1, 1],
        [ix + iw, iy, -1, 1],
        [ix, iy + ih, 1, -1],
        [ix + iw, iy + ih, -1, -1],
      ];
      corners.forEach(function (c) {
        const x = c[0],
          y = c[1],
          sx = c[2],
          sy = c[3];
        if (k === 'corner-lines') {
          const hx = sx > 0 ? x : x - L;
          const vy = sy > 0 ? y : y - L;
          fill(new paper.Path.Rectangle({ rectangle: new paper.Rectangle(hx, y - th / 2, L, th), insert: false }));
          fill(new paper.Path.Rectangle({ rectangle: new paper.Rectangle(x - th / 2, vy, th, L), insert: false }));
          if (f.dbl) {
            const off = th * 2.5;
            const hx2 = sx > 0 ? x + off : x - L * 0.72 - off;
            const vy2 = sy > 0 ? y + off : y - L * 0.72 - off;
            fill(new paper.Path.Rectangle({ rectangle: new paper.Rectangle(hx2, y - th / 2 + sy * off, L * 0.72, th * 0.55), insert: false }));
            fill(new paper.Path.Rectangle({ rectangle: new paper.Rectangle(x - th / 2 + sx * off, vy2, th * 0.55, L * 0.72), insert: false }));
          }
        } else {
          // flourish: a quarter-arc band curling INTO the frame area + leaf + dot
          try {
            const band = annulus(x, y, L * 0.8, Math.max(1, L * 0.8 - th), col);
            const qx = sx > 0 ? x : x - L,
              qy = sy > 0 ? y : y - L;
            const quad = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(qx, qy, L, L), insert: false });
            fill(band.intersect(quad));
          } catch (e) {
            /* skip the arc, keep leaf + dot */
          }
          out.push(leafAt(x + sx * L * 0.95, y + sy * L * 0.4, sx * sy > 0 ? 45 : -45, Math.max(8, th * 2.2), col));
          fill(new paper.Path.Circle({ center: [x + sx * L * 0.4, y + sy * L * 0.95], radius: Math.max(1.5, th * 0.45), insert: false }));
        }
      });
    }
    return out;
  }
  function drawFrames() {
    if (!frameLayer) return;
    const b =
      lettersBounds ||
      new paper.Rectangle(new paper.Point(-FS * 0.8, -FS * 0.55), new paper.Point(FS * 0.8, FS * 0.55));
    // Rebuild only when a frame recipe or the (coarsely bucketed) letter bounds
    // changed — scallop/arch run real booleans and must not re-run per drag tick.
    const key =
      JSON.stringify(cpFrames(frames)) +
      '|' +
      [Math.round(b.x / 8), Math.round(b.y / 8), Math.round(b.width / 8), Math.round(b.height / 8)].join(',');
    if (key === frameCacheKey && (frames.length === 0 || frameLayer.children.length)) return;
    frameCacheKey = key;
    frameLayer.removeChildren();
    if (!frames.length) return;
    const built = frames.map(function (f) {
      try {
        return buildFramePaths(f, b);
      } catch (e) {
        return []; // a bad recipe never takes the canvas down
      }
    });
    // ── Intertwine (owner 2026-07-17): when two BAND enclosures overlap and
    // weave is on, alternate over/under at each crossing lobe — the letters'
    // dilate-and-subtract cut applied frame-to-frame.
    const bandIdx = [];
    frames.forEach(function (f, i) {
      if (frameClass(f.kind) === 'enclosure' && BAND_KINDS.indexOf(f.kind) >= 0) bandIdx.push(i);
    });
    if (bandIdx.length >= 2 && (frames[bandIdx[0]].weave || frames[bandIdx[1]].weave)) {
      try {
        const uniteAll = function (paths) {
          let u = null;
          paths.forEach(function (q) {
            u = u ? u.unite(q) : q;
          });
          return u;
        };
        let A = uniteAll(built[bandIdx[0]]);
        let B = uniteAll(built[bandIdx[1]]);
        if (A && B) {
          const inter = A.intersect(B, { insert: false });
          const lobes = (inter.className === 'CompoundPath' ? inter.children.slice() : [inter]).filter(function (l) {
            return l && Math.abs(l.area || 0) > 1;
          });
          if (lobes.length) {
            const mid = A.bounds.center.add(B.bounds.center).divide(2);
            lobes.sort(function (l1, l2) {
              return (
                Math.atan2(l1.bounds.center.y - mid.y, l1.bounds.center.x - mid.x) -
                Math.atan2(l2.bounds.center.y - mid.y, l2.bounds.center.x - mid.x)
              );
            });
            const gapW = Math.max(2.5, Math.min(frames[bandIdx[0]].thick, frames[bandIdx[1]].thick) * 0.55);
            lobes.forEach(function (lobe, i) {
              const cutter = dilate(lobe.clone(), gapW);
              try {
                if (i % 2 === 0) B = B.subtract(cutter);
                else A = A.subtract(cutter);
              } catch (e) {}
            });
            A.fillColor = new paper.Color(frames[bandIdx[0]].c);
            A.strokeColor = null;
            B.fillColor = new paper.Color(frames[bandIdx[1]].c);
            B.strokeColor = null;
            built[bandIdx[0]] = [A];
            built[bandIdx[1]] = [B];
          }
          try {
            inter.remove();
          } catch (e) {}
        }
      } catch (e) {
        /* weave failure degrades to the plain stack */
      }
    }
    built.forEach(function (paths, fi) {
      paths.forEach(function (p) {
        p.data = { fi: fi }; // frame-drag hit-testing (owner: "fixing the location of the frames")
        frameLayer.addChild(p);
      });
    });
  }
  function frameHit(pp) {
    if (!frameLayer || !frameLayer.children.length) return null;
    // Frame bands are thin (a 6-unit ring), so containment alone is a
    // fingertip-hostile target — and paper's fill hit-testing ignores
    // `tolerance` (it only applies to strokes). So: containment first, then a
    // nearest-point distance test gives real grab slack around the ink.
    const tol = 14 / view.zoom;
    for (let k = frameLayer.children.length - 1; k >= 0; k--) {
      const c = frameLayer.children[k];
      if (!c.data || c.data.fi == null) continue;
      try {
        if (c.contains(pp)) return c.data.fi;
      } catch (e) {}
    }
    let bestFi = null,
      bestD = tol;
    for (let k = frameLayer.children.length - 1; k >= 0; k--) {
      const c = frameLayer.children[k];
      if (!c.data || c.data.fi == null) continue;
      try {
        // cheap reject: outside the padded bounds → skip the curve math
        if (!c.bounds.expand(tol * 2).contains(pp)) continue;
        const loc = c.getNearestLocation ? c.getNearestLocation(pp) : null;
        if (loc) {
          const d = loc.point.getDistance(pp);
          if (d < bestD) {
            bestD = d;
            bestFi = c.data.fi;
          }
        }
      } catch (e) {}
    }
    return bestFi;
  }
  function decor() {
    if (drawMode || animating) return;
    if (selPair) {
      const rg = regions.filter(function (r) {
        return r.i === selPair.i && r.j === selPair.j;
      })[0];
      if (rg) {
        const hl = rg.r.clone();
        hl.fillColor = new paper.Color(0.77, 0.63, 0.35, 0.35);
        hl.strokeColor = new paper.Color(GOLD);
        hl.strokeWidth = 1.5 / view.zoom;
        hl.dashArray = [4 / view.zoom, 4 / view.zoom];
        layer.addChild(hl);
      }
    }
    if (sel == null || !hit[sel]) return;
    const b = hit[sel].bounds,
      iz = 1 / view.zoom;
    const box = new paper.Path.Rectangle(b);
    box.strokeColor = new paper.Color(GOLD);
    box.strokeWidth = iz;
    box.dashArray = [4 * iz, 4 * iz];
    layer.addChild(box);
    const h = new paper.Path.Circle(new paper.Point(b.right, b.bottom), 9 * iz);
    h.fillColor = new paper.Color(GOLD);
    h.strokeColor = new paper.Color('#FBFBFA');
    h.strokeWidth = 2 * iz;
    layer.addChild(h);
  }
  function drawShape(p, outline) {
    if (outline > 0 && outlineHex !== 'none') {
      try {
        const ring = dilate(p, outline);
        ring.fillColor = new paper.Color(outlineHex);
        ring.strokeColor = null;
        layer.addChild(ring);
      } catch (e) {}
    }
    p.fillColor = ink;
    p.strokeColor = null;
    layer.addChild(p);
  }
  function ribbonPath(s) {
    const P = s.pts,
      style = s.style || 'broad',
      n = P.length,
      col = new paper.Color(s.c);
    if (n < 2) {
      const c =
        style === 'broad'
          ? new paper.Path.Ellipse({ center: new paper.Point(P[0].x, P[0].y), radius: [s.w * 0.5, s.w * 0.16], insert: false })
          : new paper.Path.Circle({ center: new paper.Point(P[0].x, P[0].y), radius: s.w * 0.32, insert: false });
      if (style === 'broad') c.rotate(s.nib);
      c.fillColor = col;
      c.strokeColor = null;
      return c;
    }
    const rad = (s.nib * Math.PI) / 180,
      ex = Math.cos(rad),
      ey = Math.sin(rad),
      L = [],
      R = [];
    const doTaper = (style === 'pointed' || style === 'brush') && n >= 5;
    for (let i = 0; i < n; i++) {
      let f;
      if (style === 'monoline') {
        f = 1;
      } else if (P[i].pr >= 0) {
        f = 0.25 + 0.75 * P[i].pr;
      } else {
        const sp = i > 0 ? Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y) : Math.hypot(P[1].x - P[0].x, P[1].y - P[0].y);
        f = Math.max(0.25, Math.min(1, 1.18 - sp / (s.w * 1.5)));
      }
      if (doTaper) {
        const tp = Math.min(i, n - 1 - i);
        f *= Math.min(1, tp / 2.2);
      }
      if (style === 'brush') f = Math.pow(Math.max(f, 0.02), 0.85);
      const half = style === 'monoline' ? s.w * 0.5 : s.w * 0.5 * f;
      let dx, dy;
      if (style === 'broad') {
        dx = ex;
        dy = ey;
      } else {
        let ax, ay;
        if (i === 0) {
          ax = P[1].x - P[0].x;
          ay = P[1].y - P[0].y;
        } else if (i === n - 1) {
          ax = P[i].x - P[i - 1].x;
          ay = P[i].y - P[i - 1].y;
        } else {
          ax = P[i + 1].x - P[i - 1].x;
          ay = P[i + 1].y - P[i - 1].y;
        }
        const ln = Math.hypot(ax, ay) || 1;
        dx = -ay / ln;
        dy = ax / ln;
      }
      L.push(new paper.Point(P[i].x + dx * half, P[i].y + dy * half));
      R.push(new paper.Point(P[i].x - dx * half, P[i].y - dy * half));
    }
    const p = new paper.Path({ insert: false });
    L.forEach(function (pt, idx) {
      if (idx === 0) p.moveTo(pt);
      else p.lineTo(pt);
    });
    for (let k = R.length - 1; k >= 0; k--) p.lineTo(R[k]);
    p.closePath();
    if (style !== 'broad') {
      try {
        p.smooth({ type: 'continuous' });
      } catch (e) {}
    }
    p.fillColor = col;
    p.strokeColor = null;
    return p;
  }
  function mirCopies(m) {
    const c = [[1, 1]];
    if (m === 'v') c.push([-1, 1]);
    else if (m === 'h') c.push([1, -1]);
    else if (m === '4') c.push([-1, 1], [1, -1], [-1, -1]);
    return c;
  }
  function addStroke(s) {
    mirCopies(s.mode).forEach(function (sc) {
      const p = ribbonPath(s);
      if (sc[0] !== 1 || sc[1] !== 1) p.scale(sc[0], sc[1], new paper.Point(0, 0));
      penLayer.addChild(p);
    });
  }
  function drawStrokes() {
    penLayer.activate();
    penLayer.removeChildren();
    symHitPaths = [];
    if (drawMode && !animating && mirror !== 'off') {
      const b = view.bounds,
        iz = 1 / view.zoom,
        gc = new paper.Color(0.77, 0.63, 0.35, 0.55);
      if (mirror === 'v' || mirror === '4') {
        const lv = new paper.Path.Line(new paper.Point(0, b.top), new paper.Point(0, b.bottom));
        lv.strokeColor = gc;
        lv.strokeWidth = iz;
        lv.dashArray = [6 * iz, 5 * iz];
        penLayer.addChild(lv);
      }
      if (mirror === 'h' || mirror === '4') {
        const lh = new paper.Path.Line(new paper.Point(b.left, 0), new paper.Point(b.right, 0));
        lh.strokeColor = gc;
        lh.strokeWidth = iz;
        lh.dashArray = [6 * iz, 5 * iz];
        penLayer.addChild(lh);
      }
    }
    strokes.forEach(addStroke);
    syms.forEach(function (sm, idx) {
      const bp = symBase(idx);
      symHitPaths[idx] = bp;
      mirCopies(sm.mode).forEach(function (sc, ci) {
        const q = ci === 0 ? bp : bp.clone();
        if (sc[0] !== 1 || sc[1] !== 1) q.scale(sc[0], sc[1], new paper.Point(0, 0));
        q.fillColor = new paper.Color(sm.c || inkHex);
        q.strokeColor = null;
        penLayer.addChild(q);
      });
    });
    if (drawMode && !animating && selSym != null && symHitPaths[selSym]) {
      const bb = symHitPaths[selSym].bounds,
        iz2 = 1 / view.zoom;
      const box = new paper.Path.Rectangle(bb);
      box.strokeColor = new paper.Color(GOLD);
      box.strokeWidth = iz2;
      box.dashArray = [4 * iz2, 4 * iz2];
      penLayer.addChild(box);
      const hh = new paper.Path.Circle(new paper.Point(bb.right, bb.bottom), 9 * iz2);
      hh.fillColor = new paper.Color(GOLD);
      hh.strokeColor = new paper.Color('#FBFBFA');
      hh.strokeWidth = 2 * iz2;
      penLayer.addChild(hh);
    }
    layer.activate();
    view.update();
  }
  function fast() {
    layer.activate();
    layer.removeChildren();
    hit = [];
    order.forEach(function (i) {
      const p = lp(i);
      hit[i] = p;
      if (!p) return; // a glyph the face can't render — skip, never throw
      const c = p.clone();
      c.fillColor = ink;
      c.strokeColor = null;
      layer.addChild(c);
    });
    // fast() runs on EVERY drag tick — never rebuild frames here. A letter
    // drag with a weave/scallop applied was re-running boolean geometry per
    // pixel ("dragging ink is lagging"). Frames hold still during the gesture
    // and re-fit once on release (full() → drawFrames).
    decor();
    drawStrokes();
    zoomEl.textContent = Math.round(view.zoom * 100) + '%';
  }
  function updateLettersBounds() {
    lettersBounds = null;
    hit.forEach(function (p) {
      if (!p) return;
      lettersBounds = lettersBounds ? lettersBounds.unite(p.bounds) : p.bounds.clone();
    });
  }
  function full() {
    layer.activate();
    layer.removeChildren();
    hit = [];
    regions = [];
    order.forEach(function (i) {
      hit[i] = lp(i);
    });
    let i, j;
    const n = letters.length;
    for (i = 0; i < n; i++)
      for (j = i + 1; j < n; j++) {
        try {
          const it = hit[i].intersect(hit[j]);
          if (it && it.bounds.width > 0.5) regions.push({ i: i, j: j, r: it });
        } catch (e) {}
      }
    const parent = letters.map(function (_, k) {
      return k;
    });
    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (pst(i, j) === 'merge') parent[find(i)] = find(j);
    const gmap = {};
    for (i = 0; i < n; i++) {
      const r = find(i);
      (gmap[r] = gmap[r] || []).push(i);
    }
    const groupList = [];
    Object.keys(gmap).forEach(function (r) {
      // Drop members whose glyph failed to build (hit[m] null) — an exotic
      // character must degrade to "that letter is missing", not a blank canvas.
      const mem = gmap[r].filter(function (m) {
        return hit[m];
      });
      if (!mem.length) return;
      let path = hit[mem[0]].clone();
      for (let m = 1; m < mem.length; m++) {
        try {
          path = path.unite(hit[mem[m]]);
        } catch (e) {}
      }
      const z = Math.max.apply(
        null,
        mem.map(function (x) {
          return order.indexOf(x);
        }),
      );
      let fr = mem[0];
      mem.forEach(function (x) {
        if (order.indexOf(x) > order.indexOf(fr)) fr = x;
      });
      groupList.push({ mem: mem, path: path, z: z, front: fr });
    });
    const groups = groupList;
    const groupOf = {};
    groups.forEach(function (g) {
      g.mem.forEach(function (m) {
        groupOf[m] = g;
      });
    });
    groups.forEach(function (g) {
      g.fp = g.path.clone();
    });
    for (i = 0; i < n; i++)
      for (j = i + 1; j < n; j++) {
        if (pst(i, j) === 'delete') {
          const gi = groupOf[i],
            gj = groupOf[j];
          if (gi !== gj) {
            try {
              const reg = hit[i].intersect(hit[j]);
              gi.fp = gi.fp.subtract(reg);
              gj.fp = gj.fp.subtract(reg.clone());
            } catch (e) {}
          }
        }
      }
    groups.forEach(function (gi) {
      groups.forEach(function (gj) {
        if (gj === gi || gj.z <= gi.z) return;
        let rel = 'cut';
        gi.mem.forEach(function (a) {
          gj.mem.forEach(function (b) {
            if (pst(a, b) === 'delete') rel = 'delete';
          });
        });
        if (rel !== 'cut') return;
        try {
          if (gi.fp.bounds.intersects(gj.path.bounds)) gi.fp = gi.fp.subtract(dilate(gj.path, st[gj.front].gap));
        } catch (e) {}
      });
    });
    groups.forEach(function (g) {
      if (st[g.front].clean) g.fp = cleanPath(g.fp, st[g.front].strength);
    });
    groups.sort(function (a, b) {
      return a.z - b.z;
    });
    groups.forEach(function (g) {
      drawShape(g.fp, st[g.front].outline);
    });
    updateLettersBounds();
    drawFrames();
    decor();
    drawStrokes();
    zoomEl.textContent = Math.round(view.zoom * 100) + '%';
    syncUI();
  }
  function mainContour(it) {
    if (it.className === 'CompoundPath') {
      let best = it.children[0],
        bl = best ? best.length : 0;
      it.children.forEach(function (c) {
        if (c.length > bl) {
          bl = c.length;
          best = c;
        }
      });
      return best;
    }
    return it;
  }
  function endAnim(stuff) {
    try {
      view.onFrame = null;
    } catch (e) {}
    if (stuff) stuff();
    animating = false;
  }
  function smoothstep(p) {
    p = Math.min(1, Math.max(0, p));
    return p * p * p * (p * (p * 6 - 15) + 10);
  }
  function eased(p) {
    p = Math.min(1, Math.max(0, p));
    return p + (smoothstep(p) - p) * animSmooth;
  }
  function play(preset) {
    preset = preset || anim;
    // Universal portal preview (benchmark §3: "the preview becomes a promise"):
    // when the host can render the IDENTICAL live-site player over the canvas,
    // hand every kind to the overlay — one implementation, zero studio-vs-live
    // drift. The paper.js canvas acts survive as the reduced-motion fallback.
    let reduced = false;
    try {
      reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (portalPreview && !reduced) {
      anim = preset;
      const ex = getExport();
      onPreviewKind(preset, ex && ex.svg ? ex.svg : null, { kind: preset, dur: animDur, smooth: animSmooth, delay: animDelay });
      return;
    }
    // gold/molten are React components → hand off to the host overlay, never run
    // the paper.js loop for them (it can't render a CSS turn or a WebGL shader).
    if (preset === 'gold' || preset === 'molten') {
      anim = preset;
      const ex = getExport();
      onPreviewKind(preset, ex && ex.svg ? ex.svg : null);
      return;
    }
    if (animating || !view) return;
    anim = preset;
    onPreviewKind(null, null); // a canvas kind → clear any React overlay
    sel = null;
    selPair = null;
    selSym = null;
    full();
    const frm = [],
      lyr = [],
      pen = [];
    frameLayer.children.forEach(function (c) {
      if (c.fillColor) frm.push(c);
    });
    layer.children.forEach(function (c) {
      if (c.fillColor) lyr.push(c);
    });
    penLayer.children.forEach(function (c) {
      if (c.fillColor) pen.push(c);
    });
    // Frames draw first, then letters, then pen/symbols — the reveal builds the
    // stage before the initials arrive (frame-first choreography as the default
    // order; the full seq/acts model stays P2).
    const items = frm.concat(lyr).concat(pen);
    if (!items.length) return;
    animating = true;
    let t0 = null;
    const D = animDur,
      DL = animDelay;
    if (preset === 'droplet') {
      layer.activate();
      const sorted = items.slice().sort(function (a, b) {
        return a.bounds.center.x - b.bounds.center.x;
      });
      const recs = sorted.map(function (it) {
        const c = it.bounds.center;
        const R = Math.max(it.bounds.width, it.bounds.height) * 0.65 + 10;
        const grp = new paper.Group([new paper.Path.Circle({ center: c, radius: 0.01, insert: false }), it]);
        grp.clipped = true;
        return { grp: grp, c: c, R: R };
      });
      const nn = recs.length;
      const dur = nn > 1 ? D * 0.45 : D;
      // Delay = seconds AFTER one element STARTS before the next starts (a pure
      // start-to-start stagger), not after it finishes. DL=0 → all start together.
      // D4 cap: the stagger shrinks when many items would blow the budget, so
      // the WHOLE run always lands within the chosen duration — a mirrored
      // frame of 160 paths can no longer stretch a 6s reveal into ~50s.
      const stag = nn > 1 ? Math.min(DL, (D - dur) / (nn - 1)) : 0;
      view.onFrame = function (ev) {
        try {
          if (t0 === null) t0 = ev.time;
          const t = ev.time - t0;
          let done = true;
          recs.forEach(function (r, i) {
            const p = (t - i * stag) / dur,
              e = eased(p);
            if (p < 1) done = false;
            if (r.grp.firstChild) r.grp.firstChild.remove();
            const cir = new paper.Path.Circle({ center: r.c, radius: Math.max(0.01, e * r.R), insert: false });
            r.grp.insertChild(0, cir);
            r.grp.clipped = true;
          });
          if (done || t > D + 4) {
            endAnim(function () {
              full();
            });
          }
        } catch (x) {
          endAnim(function () {
            full();
          });
        }
      };
      return;
    }
    if (preset === 'petalfall') {
      // owner 2026-07-17 "like the wreath falling in like petals into place" —
      // every piece drifts down with a little spin and settles, staggered.
      layer.activate();
      const nnp = items.length;
      const per = nnp > 1 ? D * 0.45 : D;
      const stag = nnp > 1 ? Math.min(DL, (D - per) / (nnp - 1)) : 0;
      const precs = items.map(function (it, i) {
        const fin = it.position.clone();
        const seed = ((i * 137.5) % 100) / 100; // deterministic per-piece jitter
        it.opacity = 0;
        return { it: it, fin: fin, drop: 110 + seed * 170, dx: (seed - 0.5) * 90, rot: (seed - 0.5) * 100, prev: 0 };
      });
      view.onFrame = function (ev) {
        try {
          if (t0 === null) t0 = ev.time;
          const t = ev.time - t0;
          let done = true;
          precs.forEach(function (r, i) {
            const local = (t - i * stag) / per;
            if (local < 1) done = false;
            const ec = eased(Math.min(1, Math.max(0, local)));
            r.it.opacity = Math.min(1, ec * 1.6);
            r.it.position = new paper.Point(r.fin.x + r.dx * (1 - ec), r.fin.y - r.drop * (1 - ec));
            const target = r.rot * (1 - ec);
            r.it.rotate(target - r.prev);
            r.prev = target;
          });
          if (done || t > D + 4) {
            endAnim(function () {
              full();
            });
          }
        } catch (x) {
          endAnim(function () {
            full();
          });
        }
      };
      return;
    }
    if (preset === 'flip3d') {
      // owner 2026-07-17 "3D doesn't feel 3D enough" — the 2D canvas can't do
      // real perspective, so it sells the illusion with the classic trio:
      // cosine scaleX (the turn) + a decaying shear (the off-axis lean) + a
      // zoom-in (depth), topped with a specular light sweep as the mark lands.
      // The LIVE player does true CSS rotate3d with perspective + shadow.
      layer.activate();
      const grp = new paper.Group(items);
      const gb = grp.bounds.clone();
      const gc = gb.center;
      let prevS = 1,
        prevSh = 0,
        prevZ = 1;
      const sweep = new paper.Path.Rectangle({
        rectangle: new paper.Rectangle(gb.x - gb.width, gb.y - 60, Math.max(30, gb.width * 0.22), gb.height + 120),
        insert: true,
      });
      sweep.fillColor = new paper.Color(1, 1, 1, 0);
      sweep.rotate(16);
      view.onFrame = function (ev) {
        try {
          if (t0 === null) t0 = ev.time;
          const p = Math.min(1, (ev.time - t0) / D);
          const e = eased(p);
          const theta = (1 - e) * Math.PI * 2.5; // 450° spin-in
          let sx = Math.cos(theta);
          if (Math.abs(sx) < 0.05) sx = sx < 0 ? -0.05 : 0.05;
          const sh = Math.sin(theta) * 0.14 * (1 - e); // perspective lean, decays to 0
          const z = 0.8 + 0.2 * e; // depth zoom
          grp.scale(sx / prevS, 1, gc);
          try {
            grp.shear(sh - prevSh, 0, gc);
          } catch (x2) {}
          grp.scale(z / prevZ, z / prevZ, gc);
          prevS = sx;
          prevSh = sh;
          prevZ = z;
          grp.opacity = Math.min(1, 0.15 + e);
          // specular sweep: a soft light bar crosses the mark as it lands
          const w = (p - 0.55) / 0.3;
          if (w > 0 && w < 1) {
            sweep.opacity = Math.sin(w * Math.PI) * 0.22;
            sweep.position = new paper.Point(gb.x + gb.width * w, gc.y);
          } else {
            sweep.opacity = 0;
          }
          sweep.fillColor = new paper.Color(1, 1, 1, 1);
          if (p >= 1) {
            endAnim(function () {
              try {
                sweep.remove();
              } catch (x3) {}
              full();
            });
          }
        } catch (x) {
          endAnim(function () {
            try {
              sweep.remove();
            } catch (x3) {}
            full();
          });
        }
      };
      return;
    }
    const recs = items.map(function (o) {
      const tr = o.clone();
      tr.fillColor = null;
      tr.strokeColor = new paper.Color(preset === 'trace' ? GOLD : inkHex);
      tr.strokeWidth = Math.max(1.5, (preset === 'trace' ? 3 : 2.2) / view.zoom);
      const mc = mainContour(o);
      let Ln = 2000;
      try {
        Ln = mc.length || 2000;
      } catch (x) {}
      tr.dashArray = [Ln + 60, Ln + 60];
      tr.dashOffset = Ln + 60;
      o.opacity = 0;
      return { o: o, tr: tr, mc: mc, L: Ln };
    });
    if (preset === 'trace') {
      view.onFrame = function (ev) {
        try {
          if (t0 === null) t0 = ev.time;
          const p = Math.min(1, (ev.time - t0) / D),
            e = eased(p);
          recs.forEach(function (r) {
            r.tr.dashOffset = (r.L + 60) * (1 - e);
          });
          const fa = eased((p - 0.42) / 0.55);
          recs.forEach(function (r) {
            r.o.opacity = fa;
          });
          if (p >= 1 || ev.time - t0 > D + 3) {
            endAnim(function () {
              recs.forEach(function (r) {
                try {
                  r.tr.remove();
                } catch (x) {}
                r.o.opacity = 1;
              });
            });
          }
        } catch (x) {
          endAnim(function () {
            full();
          });
        }
      };
    } else {
      const nib = new paper.Path.Circle({ center: new paper.Point(0, 0), radius: Math.max(3, 5 / view.zoom), insert: true });
      nib.fillColor = new paper.Color(GOLD);
      nib.strokeColor = new paper.Color('#FBFBFA');
      nib.strokeWidth = Math.max(1, 1.5 / view.zoom);
      nib.visible = false;
      const nn2 = recs.length;
      const per = nn2 > 1 ? D * 0.4 : D;
      // Delay = seconds AFTER one letter STARTS before the next starts (a pure
      // start-to-start stagger), not after it finishes. DL=0 → all draw together.
      // D4 cap: shrink the stagger when the item count would blow the budget so
      // the whole run stays within the chosen duration (see droplet above).
      const step = nn2 > 1 ? Math.min(DL, (D - per) / (nn2 - 1)) : 0;
      view.onFrame = function (ev) {
        try {
          if (t0 === null) t0 = ev.time;
          const t = ev.time - t0;
          let done = true,
            shown = false;
          recs.forEach(function (r, i) {
            const s0 = i * step,
              local = (t - s0) / per,
              e = eased(local);
            r.tr.dashOffset = (r.L + 60) * (1 - e);
            r.o.opacity = eased(local);
            if (local > 0.02 && local < 1 && !shown) {
              try {
                const loc = r.mc.getLocationAt(Math.min(r.L - 0.5, e * r.L));
                if (loc) {
                  nib.position = loc.point;
                  nib.visible = true;
                  shown = true;
                }
              } catch (x) {}
            }
            if (local < 1) done = false;
          });
          if (!shown) nib.visible = false;
          if (done || t > D + 4) {
            endAnim(function () {
              recs.forEach(function (r) {
                try {
                  r.tr.remove();
                } catch (x) {}
                r.o.opacity = 1;
              });
              try {
                nib.remove();
              } catch (x) {}
            });
          }
        } catch (x) {
          endAnim(function () {
            full();
          });
        }
      };
    }
  }
  function syncUI() {
    const eh = $('edithint');
    if (eh) eh.style.display = 'none';
    if (drawMode) {
      penBox.style.display = '';
      crossBox.style.display = 'none';
      selBox.style.display = 'none';
      $('nibrow').style.display = nibStyle === 'broad' ? '' : 'none';
      if (selSym != null) {
        symBox.style.display = '';
        [].forEach.call($('symmirror').querySelectorAll('[data-sm]'), function (b) {
          b.classList.toggle('on', b.dataset.sm === syms[selSym].mode);
        });
      } else symBox.style.display = 'none';
      if (ro)
        ro.textContent = selSym != null ? 'Symbol selected · drag / size / delete' : 'Fountain pen (' + nibStyle + ') · draw, or stamp a symbol';
      return;
    }
    penBox.style.display = 'none';
    symBox.style.display = 'none';
    if (selPair) {
      crossBox.style.display = '';
      selBox.style.display = 'none';
      const s3 = pst(selPair.i, selPair.j);
      crossLab.textContent = 'Crossing · ' + letters[selPair.i] + ' & ' + letters[selPair.j];
      [].forEach.call(crossBox.querySelectorAll('[data-act]'), function (b) {
        b.classList.toggle('on', b.dataset.act === s3);
      });
      if (s3 === 'merge') {
        crosstop.style.display = 'none';
      } else {
        crosstop.style.display = '';
        const t = topOf(selPair.i, selPair.j);
        crosstop.innerHTML = '<span class="lab2" style="margin-right:2px">On top</span>';
        [selPair.i, selPair.j].forEach(function (k) {
          const b = document.createElement('button');
          b.className = 'tg lg' + (k === t ? ' on' : '');
          b.textContent = letters[k];
          b.dataset.topk = k;
          crosstop.appendChild(b);
        });
      }
      const cgw = $('crossgap');
      if (s3 === 'cut') {
        cgw.style.display = '';
        const tt = topOf(selPair.i, selPair.j);
        $('cg').value = st[tt].gap;
        $('cg_v').textContent = st[tt].gap;
        $('cg_name').textContent = letters[tt];
      } else cgw.style.display = 'none';
      if (ro) ro.textContent = 'Crossing ' + letters[selPair.i] + '·' + letters[selPair.j] + ' — ' + s3;
    } else if (sel != null) {
      selBox.style.display = '';
      crossBox.style.display = 'none';
      const s = st[sel];
      $('selname').textContent = letters[sel];
      $('s_outline').value = s.outline;
      $('o_out').textContent = s.outline;
      $('s_gap').value = s.gap;
      $('o_gap').textContent = s.gap;
      $('s_strength').value = Math.round(s.strength * 100);
      const cb = $('s_clean');
      cb.classList.toggle('on', s.clean);
      cb.textContent = s.clean ? 'Auto-clean ✓' : 'Auto-clean ✗';
      const rotEl = $('s_rot');
      if (rotEl) {
        const rw = Math.round((((s.rot || 0) % 360) + 540) % 360 - 180);
        rotEl.value = rw;
        $('o_rot').textContent = rw + '°';
      }
      const skEl = $('s_skew');
      if (skEl) {
        skEl.value = Math.round(s.skew || 0);
        $('o_skew').textContent = Math.round(s.skew || 0) + '°';
      }
      const flEl = $('s_flip');
      if (flEl) flEl.classList.toggle('on', Boolean(s.flipX));
      if (ro) ro.textContent = 'Editing ' + letters[sel] + ' · ' + Math.round(s.scale * 100) + '%';
    } else {
      crossBox.style.display = 'none';
      selBox.style.display = 'none';
      if (eh) eh.style.display = '';
      if (ro) ro.textContent = 'Tap a letter · tap a crossing · pick a reveal to animate.';
    }
  }
  function toV(e) {
    const r = cv.getBoundingClientRect();
    return new paper.Point((e.clientX - r.left) * (view.viewSize.width / r.width), (e.clientY - r.top) * (view.viewSize.height / r.height));
  }
  function topHit(pp) {
    for (let k = order.length - 1; k >= 0; k--) {
      const i = order[k];
      if (hit[i] && hit[i].contains(pp)) return i;
    }
    return null;
  }
  function symHit(pp) {
    for (let k = syms.length - 1; k >= 0; k--) {
      if (symHitPaths[k] && symHitPaths[k].contains(pp)) return k;
    }
    return null;
  }
  function pairAt(pp) {
    let best = null,
      bz = -1;
    regions.forEach(function (rg) {
      if (rg.r.contains(pp)) {
        const z = Math.max(order.indexOf(rg.i), order.indexOf(rg.j));
        if (z > bz) {
          bz = z;
          best = rg;
        }
      }
    });
    return best;
  }
  function corner() {
    const b = hit[sel].bounds;
    return new paper.Point(b.right, b.bottom);
  }
  function symCorner() {
    const b = symHitPaths[selSym].bounds;
    return new paper.Point(b.right, b.bottom);
  }
  function arrV() {
    const a = [];
    pts.forEach(function (v) {
      a.push(v.v);
    });
    return a;
  }
  function zoomAt(nz, vpt) {
    nz = Math.max(0.25, Math.min(8, nz));
    const pre = view.viewToProject(vpt);
    view.zoom = nz;
    const post = view.viewToProject(vpt);
    view.center = view.center.add(pre.subtract(post));
  }
  function wireSlider(el) {
    el.addEventListener('pointerdown', function () {
      preSlider = snap();
    });
    el.addEventListener('change', function () {
      if (preSlider) {
        undoStack.push(preSlider);
        if (undoStack.length > 80) undoStack.shift();
        redoStack = [];
        preSlider = null;
        updU();
      }
    });
  }

  // ── colour-control helpers ──
  function selSwatch(container, btn) {
    if (!container) return;
    [].forEach.call(container.children, function (c) {
      if (c.classList && (c.classList.contains('sw') || c.classList.contains('bg'))) c.classList.toggle('sel', c === btn);
    });
  }
  function syncColorInput(id, hexVal) {
    const el = $(id);
    if (el && /^#[0-9a-fA-F]{6}$/.test(hexVal)) el.value = hexVal;
  }

  // ── reflect helpers (config restore → UI selection state) ──
  function reflectFontChip(key) {
    [].forEach.call($('fonts').children, function (c) {
      c.classList.toggle('sel', c.dataset.f === key);
    });
  }
  function reflectSwatch(containerId, value, cls) {
    [].forEach.call($(containerId).children, function (c) {
      if (c.dataset && c.dataset.c != null) c.classList.toggle('sel', c.dataset.c === value);
    });
  }
  function reflectAnimUI() {
    // Menu merge (benchmark §4): saved 'trace' configs light Handwriting,
    // saved 'gold' configs light the Medallion Turn — wire keys unchanged.
    const disp = anim === 'trace' ? 'handwriting' : anim === 'gold' ? 'flip3d' : anim;
    [].forEach.call($('animbox').querySelectorAll('[data-an]'), function (c) {
      c.classList.toggle('on', c.dataset.an === disp);
    });
    $('dur').value = Math.round(animDur * 10);
    $('dur_v').textContent = animDur.toFixed(1) + 's';
    $('dl').value = Math.round(animDelay * 10);
    $('dl_v').textContent = animDelay.toFixed(1) + 's';
    $('smooth').value = Math.round(animSmooth * 100);
    $('sm_v').textContent = Math.round(animSmooth * 100) + '%';
    reflectTempoUI();
  }
  function inferTempo() {
    // A saved config without the marker: light the chip whose numbers match.
    for (const key in ANIM_TEMPOS) {
      const t = ANIM_TEMPOS[key];
      if (Math.abs(t.dur - animDur) < 0.01 && Math.abs(t.delay - animDelay) < 0.01 && Math.abs(t.smooth - animSmooth) < 0.01) return key;
    }
    return 'custom';
  }
  function reflectTempoUI() {
    const tempoEl = $('tempo');
    if (tempoEl)
      [].forEach.call(tempoEl.querySelectorAll('[data-tp]'), function (c) {
        c.classList.toggle('on', c.dataset.tp === animTempo);
      });
    const note = $('moltennote');
    if (note) note.classList.toggle('off', anim !== 'molten'); // §5.6 — disclose the degrade
  }

  /* ── Frame shelf UI (v2 Frame tab · #frameshelf) ─────────────────────────
   * Engine-owned DOM like the rest of the inert editor. Tap a pattern card to
   * apply it auto-fitted; tap it again to remove. Stack rule (§4.4): ≤2 frames
   * — one enclosure + one corner set; a new frame replaces its class slot.
   * Thumbnails are generated procedurally from the same builders around a
   * canned two-bar "M·J" silhouette, lazily on idle. Absent on v1 → all no-op. */
  /* ── Starting points (council verdict §3 · PR-5) ─────────────────────────
   * Each preset is a GENERATOR computed from the couple's actual letters —
   * overlays on a fresh initState() (exactly the shape applyConfig restores).
   * At least three ship with a crossing decision already applied so the
   * interlock engine is visible before anyone has to understand it. */
  // 12 named, art-directed Styles (benchmark verdict §1 — "the Minted/Zola
  // named-style pattern: font pairing, optical spacing, weave gaps, frame
  // stack, and palette PRE-SOLVED per style"). Filipino names, one tap each.
  // Legacy preset keys stay valid for saved `preset` provenance.
  const PRESET_DEFS = [
    { key: 'alon', label: 'Alon', three: true, font: 'script', ink: '#1E2229', outline: 'none', base: 'interlocked' },
    { key: 'sampaguita-style', label: 'Sampaguita', three: true, font: 'cardo', ink: '#5C2542', outline: '#C5A059', base: 'duo', frames: ['sampaguita'] },
    { key: 'habi', label: 'Habi', three: true, font: 'cardo', ink: '#1E2229', outline: '#C5A059', base: 'interlocked', frames: ['ring', 'diamond'], weave: true },
    { key: 'balangay', label: 'Balangay', three: true, font: 'cinzeldec', ink: '#1E2229', outline: '#8C6932', base: 'duo', frames: ['diamond'] },
    { key: 'araw', label: 'Araw', three: true, font: 'yeseva', ink: '#8C6932', outline: '#C5A059', base: 'duo', frames: ['open-ring', 'cardinal-marks'] },
    { key: 'kapilya', label: 'Kapilya', three: true, font: 'playfairsc', ink: '#5C2542', outline: '#E6D2A2', base: 'stacked', frames: ['arch'] },
    { key: 'perlas', label: 'Perlas', three: true, font: 'marcellus', ink: '#1E2229', outline: '#C9CDD2', base: 'duo', frames: ['double-ring'] },
    { key: 'hardin', label: 'Hardin', three: true, font: 'gilda', ink: '#6E7B66', outline: '#C5A059', base: 'duo', frames: ['wreath'] },
    { key: 'lazo', label: 'Lazo', three: true, font: 'pinyon', ink: '#5C2542', outline: 'none', base: 'interlocked', frames: ['sparkle-duo'] },
    { key: 'tala', label: 'Tala', three: true, font: 'cinzeldec', ink: '#2A3A5E', outline: '#E6D2A2', base: 'duo', frames: ['ring', 'sparkle-duo'] },
    { key: 'payneta', label: 'Payneta', three: true, font: 'playfairsc', ink: '#B07A86', outline: '#1E2229', base: 'duo', frames: ['cartouche', 'corner-flourish'] },
    { key: 'kandila', label: 'Kandila', three: true, font: 'gilda', ink: '#1E2229', outline: '#C5A059', base: 'stacked', frames: ['corner-lines'] },
    { key: 'solo-ring', label: 'Solo ring', three: false, font: 'cardo', ink: '#5C2542', outline: '#C5A059', base: 'solo', frames: ['ring'] },
    { key: 'blank', label: 'Blank', three: null, base: 'blank' }, // fits both — start from scratch, last
  ];
  // legacy provenance keys (pre-Styles saves) → nearest style geometry
  const LEGACY_PRESET_BASE = { duo: 'duo', interlocked: 'interlocked', stacked: 'stacked', 'framed-duo': 'duo' };
  // 8 pre-balanced palette moods (benchmark §2): couples pick a MOOD, not a
  // hex — ink + outline solved together so contrast always lands. The custom
  // colour dots stay as the fine layer below.
  const MOODS = [
    { key: 'inkgold', label: 'Ink & Gold', ink: '#1E2229', outline: '#C5A059' },
    { key: 'winecream', label: 'Wine & Cream', ink: '#5C2542', outline: '#E6D2A2' },
    { key: 'mulberrygold', label: 'Mulberry & Gold', ink: '#5C2542', outline: '#C5A059' },
    { key: 'forestbrass', label: 'Forest & Brass', ink: '#6E7B66', outline: '#8C6932' },
    { key: 'navychampagne', label: 'Navy & Champagne', ink: '#2A3A5E', outline: '#E6D2A2' },
    { key: 'roseink', label: 'Rose & Ink', ink: '#B07A86', outline: '#1E2229' },
    { key: 'obsidiansilver', label: 'Obsidian & Silver', ink: '#1E2229', outline: '#C9CDD2' },
    { key: 'allgold', label: 'All Gold', ink: '#8C6932', outline: '#C5A059' },
  ];
  function buildMoods() {
    const slot = $('moods');
    if (!slot) return;
    slot.innerHTML =
      '<div class="moodrow">' +
      MOODS.map(function (mo) {
        return (
          '<button type="button" class="mood" data-mood="' +
          mo.key +
          '"><span class="dots"><i style="background:' +
          mo.ink +
          '"></i><i style="background:' +
          mo.outline +
          '"></i></span>' +
          mo.label +
          '</button>'
        );
      }).join('') +
      '</div>';
    slot.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-mood]');
      if (!b || animating) return;
      const mo = MOODS.filter(function (x) {
        return x.key === b.dataset.mood;
      })[0];
      if (!mo) return;
      inkHex = mo.ink;
      ink = new paper.Color(inkHex);
      outlineHex = mo.outline;
      reflectSwatch('inks', inkHex);
      reflectSwatch('outs', outlineHex);
      syncColorInput('ink_custom', inkHex);
      syncColorInput('out_custom', outlineHex);
      // frames follow the mood's metal by default
      frames.forEach(function (f) {
        f.c = mo.outline === 'none' ? f.c : mo.outline;
      });
      drawFrames();
      full();
      reflectMoods();
      reflectShelf();
    });
    reflectMoods();
  }
  function reflectMoods() {
    const slot = $('moods');
    if (!slot) return;
    [].forEach.call(slot.querySelectorAll('[data-mood]'), function (b) {
      const mo = MOODS.filter(function (x) {
        return x.key === b.dataset.mood;
      })[0];
      b.classList.toggle('on', Boolean(mo && mo.ink === inkHex && mo.outline === outlineHex));
    });
  }
  /** Deterministic interlock bisect (§3.1): nudge the letters' half-offset
   *  until the overlap area lands in an 8–14% band of the union area — font-
   *  proof, using the same intersect the render pipeline runs. */
  function interlockOffset() {
    if (!base[0] || !base[2]) return FS * 0.22;
    let a = null,
      c = null;
    let best = FS * 0.22;
    try {
      a = base[0].clone();
      a.pivot = a.bounds.center;
      c = base[2].clone();
      c.pivot = c.bounds.center;
      const areaA = Math.abs(a.area),
        areaC = Math.abs(c.area);
      let lo = 2,
        hi = ((a.bounds.width + c.bounds.width) / 2) * 0.95;
      for (let it = 0; it < 14; it++) {
        const dx = (lo + hi) / 2;
        a.position = new paper.Point(-dx, 0);
        c.position = new paper.Point(dx, 0);
        let ratio = 0;
        try {
          const inter = a.intersect(c, { insert: false });
          const ia = Math.abs(inter.area || 0);
          inter.remove();
          ratio = ia / Math.max(1, areaA + areaC - ia);
        } catch (e) {}
        best = dx;
        if (ratio > 0.14) lo = dx; // too deep — pull apart
        else if (ratio < 0.08) hi = dx; // barely touching — push together
        else break;
      }
    } catch (e) {}
    try {
      if (a) a.remove();
      if (c) c.remove();
    } catch (e) {}
    return best;
  }
  function baseLayout(base, three) {
    // Can't-leave-ugly invariant (verdict §2): the weave cut-gap scales with
    // the letters' visual weight (glyph scale is the deterministic proxy) —
    // computed at build, never a slider.
    const gapFor = function (scale) {
      return Math.max(4, Math.min(10, Math.round(6 * scale)));
    };
    if (base === 'interlocked' && three) {
      const dx = interlockOffset();
      return {
        st: [{ tx: -dx, gap: gapFor(1) }, { scale: 0.32, ty: FS * 0.44 }, { tx: dx, gap: gapFor(1) }],
        pstate: { '0-2': 'cut' },
      };
    }
    if (base === 'stacked' && three) {
      return {
        st: [
          { tx: 0, ty: -FS * 0.3, scale: 0.85, gap: gapFor(0.85) },
          { scale: 0.4 },
          { tx: 0, ty: FS * 0.3, scale: 0.85, gap: gapFor(0.85) },
        ],
        pstate: { '0-1': 'merge', '1-2': 'merge' },
      };
    }
    if (base === 'duo' && three) {
      return { st: [{ tx: -FS * 0.3 }, { scale: 0.52, ty: FS * 0.02 }, { tx: FS * 0.3 }] };
    }
    return {}; // solo / blank
  }
  function presetState(key) {
    const three = letters.length === 3;
    const def = PRESET_DEFS.filter(function (d) {
      return d.key === key;
    })[0];
    const base = def ? def.base : LEGACY_PRESET_BASE[key] || 'blank';
    const ps = baseLayout(base, three);
    if (def && def.frames) {
      ps.frames = def.frames.map(function (fk) {
        return frameDefaults(fk);
      });
      if (def.weave && ps.frames.length >= 2) {
        // the Habi showcase: two offset band enclosures, pre-woven
        const spread = FS * 0.5;
        ps.frames[0].tx = -spread * 0.4;
        ps.frames[1].tx = spread * 0.4;
        ps.frames[0].weave = true;
        ps.frames[1].weave = true;
      }
    }
    if (def && def.font) ps.font = def.font;
    if (def && def.ink) ps.ink = def.ink;
    if (def && typeof def.outline !== 'undefined') ps.outline = def.outline;
    return ps;
  }
  function applyPresetState(ps) {
    initState();
    strokes = [];
    syms = [];
    selSym = null;
    frames = [];
    selFrame = null;
    if (ps.st) {
      st = st.map(function (sSt, i) {
        return ps.st[i] ? Object.assign({}, sSt, ps.st[i]) : sSt;
      });
    }
    if (ps.pstate) pstate = Object.assign({}, ps.pstate);
    if (ps.frames) frames = cpFrames(ps.frames);
    if (ps.ink) {
      inkHex = ps.ink;
      ink = new paper.Color(inkHex);
      reflectSwatch('inks', inkHex);
      syncColorInput('ink_custom', inkHex);
    }
    if (typeof ps.outline !== 'undefined') {
      outlineHex = ps.outline;
      reflectSwatch('outs', outlineHex);
      if (outlineHex !== 'none') syncColorInput('out_custom', outlineHex);
    }
  }
  function applyPreset(key) {
    pushUndo();
    const ps = presetState(key);
    const finish = function () {
      applyPresetState(ps);
      presetKey = key;
      full();
      reflectShelf();
      reflectPresetStrip();
      reflectMoods();
    };
    // styles pre-solve the FACE too — swap it before the layout applies
    if (ps.font && ps.font !== fontKey && FONTS[ps.font]) {
      loadFont(ps.font, function (f) {
        if (!f) {
          finish();
          return;
        }
        font = f;
        fontKey = ps.font;
        reflectFontChip(fontKey);
        buildBase();
        finish();
      });
      return;
    }
    finish();
  }
  function buildPresetStrip() {
    const strip = $('presetstrip');
    if (!strip) return;
    const three = letters.length === 3;
    const defs = PRESET_DEFS.filter(function (d) {
      return d.three === null || d.three === three;
    });
    strip.innerHTML =
      '<p class="lab" style="margin:0 0 2px">Styles · your initials, twelve ways</p><div class="pstrip">' +
      defs
        .map(function (d) {
          return (
            '<button type="button" class="pcard" data-pk="' +
            d.key +
            '"><span class="pthumb" data-pt="' +
            d.key +
            '"></span><span class="fname">' +
            d.label +
            '</span></button>'
          );
        })
        .join('') +
      '</div>';
    if (!strip.dataset.wired) {
      strip.dataset.wired = '1';
      strip.addEventListener('click', function (e) {
        if (animating) return;
        const b2 = e.target.closest('.pcard');
        if (!b2) return;
        applyPreset(b2.dataset.pk);
      });
    }
    schedulePresetThumbs();
    reflectPresetStrip();
  }
  function reflectPresetStrip() {
    const strip = $('presetstrip');
    if (!strip) return;
    [].forEach.call(strip.querySelectorAll('.pcard'), function (c) {
      c.classList.toggle('on', c.dataset.pk === presetKey);
    });
  }
  function schedulePresetThumbs() {
    const run = function () {
      try {
        buildPresetThumbs();
      } catch (e) {}
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 600);
  }
  function buildPresetThumbs() {
    const strip = $('presetstrip');
    if (destroyed || !strip || !view || !font) return;
    // Thumbnails render the couple's ACTUAL initials in each style's OWN face
    // (§3.1). Cards are grouped by typeface; each chunk loads its face once,
    // then runs the synchronous transient apply → export → restore (paper
    // paints on rAF, so intermediate states never reach the screen). Chunks
    // chain on idle so a slow face never blocks the editor.
    const cards = [].slice.call(strip.querySelectorAll('.pcard'));
    const byFont = {};
    cards.forEach(function (card) {
      const def = PRESET_DEFS.filter(function (d) {
        return d.key === card.dataset.pk;
      })[0];
      const fk = def && def.font && FONTS[def.font] ? def.font : fontKey;
      (byFont[fk] = byFont[fk] || []).push(card);
    });
    const homeFont = fontKey;
    const chunks = Object.keys(byFont);
    const runChunk = function (idx) {
      if (destroyed || idx >= chunks.length) return;
      const fk = chunks[idx];
      loadFont(fk, function (f) {
        if (destroyed) return;
        if (f) {
          const keep = snap();
          const keepPreset = presetKey;
          const keepSel = sel,
            keepPair = selPair;
          const keepFont = font,
            keepKey = fontKey;
          font = f;
          fontKey = fk;
          buildBase();
          byFont[fk].forEach(function (card) {
            applyPresetState(presetState(card.dataset.pk));
            const svg = buildExportSVG();
            const slot = card.querySelector('.pthumb');
            if (svg && slot) slot.style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
          });
          font = keepFont;
          fontKey = keepKey;
          buildBase();
          restore(keep);
          presetKey = keepPreset;
          sel = keepSel;
          selPair = keepPair;
          full();
          reflectShelf();
          reflectPresetStrip();
          reflectMoods();
        }
        if (typeof requestIdleCallback === 'function') requestIdleCallback(function () { runChunk(idx + 1); }, { timeout: 2500 });
        else setTimeout(function () { runChunk(idx + 1); }, 250);
      });
    };
    // home-font chunk first so the visible default cards fill immediately
    chunks.sort(function (a, b) {
      return a === homeFont ? -1 : b === homeFont ? 1 : 0;
    });
    runChunk(0);
  }

  function buildShelf() {
    const shelf = $('frameshelf');
    if (!shelf) return;
    shelf.innerHTML =
      '<p class="lab" style="margin:0 0 2px">Frame patterns · tap to apply</p>' +
      '<div class="fcards">' +
      FRAME_DEFS.map(function (d) {
        return (
          '<button type="button" class="fcard" data-fk="' +
          d.kind +
          '"><span class="fthumb" data-ft="' +
          d.kind +
          '"></span><span class="fname">' +
          d.label +
          '</span></button>'
        );
      }).join('') +
      '</div><div id="fapplied"></div>';
    shelf.addEventListener('click', onShelfClick);
    scheduleThumbs();
    reflectShelf();
  }
  function onShelfClick(e) {
    if (animating) return;
    const del = e.target.closest('[data-fdel]');
    if (del) {
      pushUndo();
      frames.splice(+del.dataset.fdel, 1);
      selFrame = null;
      drawFrames();
      try {
        view.update();
      } catch (x) {}
      reflectShelf();
      return;
    }
    const selBtn = e.target.closest('[data-fsel]');
    if (selBtn) {
      selFrame = +selBtn.dataset.fsel;
      reflectShelf();
      return;
    }
    const card = e.target.closest('.fcard');
    if (!card) return;
    const kind = card.dataset.fk;
    pushUndo();
    let existing = -1;
    frames.forEach(function (f, i) {
      if (f.kind === kind) existing = i;
    });
    if (existing >= 0) {
      frames.splice(existing, 1); // tap the applied pattern again → remove (§4.6)
      selFrame = null;
    } else {
      const cls = frameClass(kind);
      const cap = FRAME_CLASS_CAP[cls] || 1;
      const sameClass = [];
      frames.forEach(function (f, i) {
        if (frameClass(f.kind) === cls) sameClass.push(i);
      });
      // at cap → the OLDEST of the class makes room
      while (sameClass.length >= cap) frames.splice(sameClass.shift(), 1);
      const nf = frameDefaults(kind);
      // Owner 2026-07-17 "frames that can intertwine": a SECOND band enclosure
      // lands offset from the first and pre-woven — instantly interlocked;
      // pull the Offset slider to 0 for a concentric stack instead.
      const other = frames.filter(function (f) {
        return frameClass(f.kind) === 'enclosure' && BAND_KINDS.indexOf(f.kind) >= 0;
      })[0];
      if (other && BAND_KINDS.indexOf(kind) >= 0) {
        const spread = Math.max(30, (lettersBounds ? Math.max(lettersBounds.width, lettersBounds.height) : FS) * 0.28);
        if (!other.tx && !nf.tx) {
          other.tx = -spread;
          nf.tx = spread;
        }
        other.weave = true;
        nf.weave = true;
      }
      frames.push(nf);
      selFrame = frames.length - 1;
    }
    drawFrames();
    try {
      view.update();
    } catch (x) {}
    reflectShelf();
  }
  function reflectShelf() {
    const shelf = $('frameshelf');
    if (!shelf) return;
    [].forEach.call(shelf.querySelectorAll('.fcard'), function (c) {
      c.classList.toggle(
        'on',
        frames.some(function (f) {
          return f.kind === c.dataset.fk;
        }),
      );
    });
    const ap = $('fapplied');
    if (!ap) return;
    if (!frames.length) {
      ap.innerHTML = '<p class="cap" style="margin:6px 0 0">No frame yet — tap a pattern above, then fine-tune it here. Add "✎ Draw your own" strokes on top anytime.</p>';
      return;
    }
    if (selFrame == null || selFrame >= frames.length) selFrame = frames.length - 1;
    const f = frames[selFrame];
    const label = FRAME_DEFS.filter(function (d) {
      return d.kind === f.kind;
    })[0];
    const showCount = ['laurel', 'wreath', 'sampaguita', 'scallop', 'sprigs'].indexOf(f.kind) >= 0;
    const showGap = ['open-ring', 'double-ring', 'corner-lines', 'corner-flourish'].indexOf(f.kind) >= 0;
    const bandEnclosures = frames.filter(function (g) {
      return frameClass(g.kind) === 'enclosure' && BAND_KINDS.indexOf(g.kind) >= 0;
    });
    const twoBands = bandEnclosures.length >= 2;
    const showWeave = twoBands && BAND_KINDS.indexOf(f.kind) >= 0;
    const weaveOn = twoBands && bandEnclosures.every(function (g) { return g.weave; });
    ap.innerHTML =
      '<div class="box" style="margin-top:10px">' +
      '<div class="row">' +
      frames
        .map(function (g, i) {
          const gl = FRAME_DEFS.filter(function (d) {
            return d.kind === g.kind;
          })[0];
          return (
            '<button type="button" class="tg' +
            (i === selFrame ? ' on' : '') +
            '" data-fsel="' +
            i +
            '">' +
            (gl ? gl.label : g.kind) +
            ' <b data-fdel="' +
            i +
            '" aria-label="Remove this frame">×</b></button>'
          );
        })
        .join('') +
      '</div>' +
      '<div><div class="lab2"><span>Size · ' +
      (label ? label.label : f.kind) +
      '</span><span id="ff_scale_v">' +
      Math.round(f.scale * 100) +
      '%</span></div><input type="range" id="ff_scale" min="50" max="220" step="1" value="' +
      Math.round(f.scale * 100) +
      '" aria-label="Frame size"></div>' +
      '<div><div class="lab2"><span>Thickness</span><span id="ff_th_v">' +
      f.thick +
      '</span></div><input type="range" id="ff_th" min="1" max="40" step="1" value="' +
      f.thick +
      '" aria-label="Frame thickness"></div>' +
      (showCount
        ? '<div><div class="lab2"><span>Repeats</span><span id="ff_ct_v">' +
          f.count +
          '</span></div><input type="range" id="ff_ct" min="3" max="48" step="1" value="' +
          f.count +
          '" aria-label="Frame repeats"></div>'
        : '') +
      (showGap
        ? '<div><div class="lab2"><span>Opening / spread</span><span id="ff_gp_v">' +
          f.gap +
          '</span></div><input type="range" id="ff_gp" min="0" max="160" step="1" value="' +
          f.gap +
          '" aria-label="Frame opening"></div>'
        : '') +
      (showWeave
        ? '<div class="row"><button type="button" class="tg' +
          (weaveOn ? ' on' : '') +
          '" id="ff_weave">⤫ Weave the two frames</button></div>'
        : '') +
      '<div><div class="lab2"><span>Position ↔</span><span id="ff_off_v">' +
      Math.round(f.tx) +
      '</span></div><input type="range" id="ff_off" min="-300" max="300" step="2" value="' +
      Math.max(-300, Math.min(300, Math.round(f.tx))) +
      '" aria-label="Frame horizontal position"></div>' +
      '<div><div class="lab2"><span>Position ↕</span><span id="ff_offy_v">' +
      Math.round(f.ty) +
      '</span></div><input type="range" id="ff_offy" min="-300" max="300" step="2" value="' +
      Math.max(-300, Math.min(300, Math.round(f.ty))) +
      '" aria-label="Frame vertical position"></div>' +
      '<div class="crow"><span class="ckey">Colour</span><div class="row swrow" id="ff_cols">' +
      ['#C5A059', '#E6D2A2', '#8C6932', '#C9CDD2', '#5C2542', '#1E2229', '#B07A86']
        .map(function (cH) {
          return (
            '<button type="button" class="sw' +
            (f.c.toLowerCase() === cH.toLowerCase() ? ' sel' : '') +
            '" data-fc="' +
            cH +
            '" style="background:' +
            cH +
            '" aria-label="Frame colour ' +
            cH +
            '"></button>'
          );
        })
        .join('') +
      '</div><label class="cust" title="Custom frame colour"><input type="color" id="ff_cust" value="' +
      (/^#[0-9a-fA-F]{6}$/.test(f.c) ? f.c : '#C5A059') +
      '" aria-label="Custom frame colour"></label></div>' +
      '<p class="cap" style="margin:0">Auto-fits your letters · sits behind the letters · drag the frame on the canvas to place it.</p>' +
      '</div>';
    wireFrameSlider('ff_scale', f, function (g, v) {
      g.scale = v / 100;
    }, 'ff_scale_v', function (v) {
      return v + '%';
    });
    wireFrameSlider('ff_th', f, function (g, v) {
      g.thick = v;
    }, 'ff_th_v');
    if (showCount)
      wireFrameSlider('ff_ct', f, function (g, v) {
        g.count = v;
      }, 'ff_ct_v');
    if (showGap)
      wireFrameSlider('ff_gp', f, function (g, v) {
        g.gap = v;
      }, 'ff_gp_v');
    if (showWeave) {
      const wv = $('ff_weave');
      if (wv)
        wv.addEventListener('click', function () {
          pushUndo();
          const on = !weaveOn;
          bandEnclosures.forEach(function (g) {
            g.weave = on;
          });
          drawFrames();
          try {
            view.update();
          } catch (x) {}
          reflectShelf();
        });
    }
    wireFrameSlider('ff_off', f, function (g, v) {
      g.tx = v;
    }, 'ff_off_v');
    wireFrameSlider('ff_offy', f, function (g, v) {
      g.ty = v;
    }, 'ff_offy_v');
    const cols = $('ff_cols');
    if (cols)
      cols.addEventListener('click', function (e) {
        const b = e.target.closest('[data-fc]');
        if (!b) return;
        pushUndo();
        f.c = b.dataset.fc;
        drawFrames();
        try {
          view.update();
        } catch (x) {}
        reflectShelf();
      });
    const cust = $('ff_cust');
    if (cust)
      cust.addEventListener('input', function () {
        f.c = this.value;
        drawFrames();
        try {
          view.update();
        } catch (x) {}
      });
  }
  function wireFrameSlider(id, f, set, vid, fmt) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', function () {
      const v = parseInt(this.value, 10);
      set(f, v);
      const lv = $(vid);
      if (lv) lv.textContent = fmt ? fmt(v) : String(v);
      drawFrames();
      try {
        view.update();
      } catch (x) {}
    });
    wireSlider(el); // one undo entry per slider gesture (snap() carries frames)
  }
  function scheduleThumbs() {
    const run = function () {
      try {
        buildThumbs();
      } catch (e) {}
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 500);
  }
  function buildThumbs() {
    const shelf = $('frameshelf');
    if (destroyed || !shelf || !paper.project) return;
    // Canned "M·J" silhouette bounds — thumbnails show the pattern's shape, not
    // the live mark (live-mark thumbs are P2 polish per the verdict).
    const b = new paper.Rectangle(new paper.Point(-55, -40), new paper.Point(55, 40));
    FRAME_DEFS.forEach(function (d) {
      const slot = shelf.querySelector('[data-ft="' + d.kind + '"]');
      if (!slot) return;
      const f = frameDefaults(d.kind);
      f.c = '#8C6932';
      const tmp = new paper.Group({ insert: false });
      const s1 = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(-38, -22, 30, 44), radius: 6, insert: false });
      const s2 = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(8, -22, 30, 44), radius: 6, insert: false });
      s1.fillColor = new paper.Color('#D9D2C4');
      s2.fillColor = new paper.Color('#D9D2C4');
      tmp.addChild(s1);
      tmp.addChild(s2);
      try {
        buildFramePaths(f, b).forEach(function (p) {
          tmp.addChild(p);
        });
      } catch (e) {}
      let inner = '';
      try {
        inner = new XMLSerializer().serializeToString(tmp.exportSVG({ asString: false }));
      } catch (e) {}
      const bb = tmp.bounds;
      tmp.remove();
      if (!inner) return;
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
        [Math.round(bb.x - 6), Math.round(bb.y - 6), Math.round(bb.width + 12), Math.round(bb.height + 12)].join(' ') +
        '">' +
        inner +
        '</svg>';
      slot.style.backgroundImage = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    });
  }

  function bindUI() {
    cv.addEventListener('pointerdown', function (e) {
      if (animating) {
        // D4 tap-to-skip: a reveal must never hold the editor hostage — any
        // tap finishes it instantly (full() rebuilds the final frame).
        endAnim(function () {
          full();
        });
        return;
      }
      cv.setPointerCapture(e.pointerId);
      const vp = toV(e),
        pp = view.viewToProject(vp);
      pts.set(e.pointerId, { v: vp, hitSel: false });
      downV = vp;
      moved = false;
      if (drawMode) {
        if (pts.size === 1) {
          if (selSym != null && symHitPaths[selSym] && pp.getDistance(symCorner()) < 14 / view.zoom) {
            // D7: snapshot now, push only if the handle actually moves —
            // grabbing without dragging must not mint a no-op undo entry.
            preGesture = snap();
            mode = 'symhandle';
            const sc = symHitPaths[selSym].bounds.center,
              sv = pp.subtract(sc);
            Bh = { c: sc, r0: sv.length || 1, a0: Math.atan2(sv.y, sv.x), s0: syms[selSym].scale, rot0: syms[selSym].rot };
            e.preventDefault();
            return;
          }
          const sh = symHit(pp);
          if (sh != null) {
            // D7: selecting a symbol isn't a modification — defer the undo
            // push to pointerup, and only when the symbol actually moved.
            preGesture = snap();
            selSym = sh;
            mode = 'symmove';
            lastP = pp;
            drawStrokes();
            syncUI();
            e.preventDefault();
            return;
          }
          selSym = null;
          pushUndo();
          const pr = e.pointerType === 'pen' ? e.pressure || 0.5 : -1;
          cur = { w: penW, nib: nibAngle, style: nibStyle, c: inkHex, mode: mirror, pts: [{ x: pp.x, y: pp.y, pr: pr }] };
          strokes.push(cur);
          mode = 'draw';
          hint.style.opacity = '0';
          drawStrokes();
          syncUI();
        } else if (pts.size === 2) {
          if (cur) {
            strokes.pop();
            cur = null;
            undoStack.pop();
            updU();
          }
          mode = 'zoom';
          const a0 = arrV();
          Bz = { d0: a0[0].getDistance(a0[1]) || 1 };
        }
        e.preventDefault();
        return;
      }
      downPair = pairAt(pp);
      preGesture = snap();
      if (sel != null && hit[sel] && pp.getDistance(corner()) < 14 / view.zoom && pts.size === 1) {
        mode = 'resize';
        pts.get(e.pointerId).hitSel = true; // D6: the handle counts as the letter
        const c = hit[sel].bounds.center;
        const sv = pp.subtract(c);
        Bh = { c: c, r0: pp.getDistance(c) || 1, s0: st[sel].scale, a0: Math.atan2(sv.y, sv.x), rot0: st[sel].rot || 0 };
        e.preventDefault();
        return;
      }
      if (pts.size === 1) {
        const hi = topHit(pp);
        if (hi != null && !downPair) {
          sel = hi;
          selPair = null;
          mode = 'move';
          lastP = pp;
          pts.get(e.pointerId).hitSel = true; // D6: this finger owns the letter
          hint.style.opacity = '0';
          fast();
        } else if (hi != null) {
          mode = 'move';
          sel = hi;
          lastP = pp;
          pts.get(e.pointerId).hitSel = true;
        } else {
          const fh = frameHit(pp);
          if (fh != null) {
            // Drag a frame to place it (owner 2026-07-17 "fixing the location
            // of the frames"). Letters keep tap priority; the frame body is
            // grabbable anywhere its ink is.
            sel = null;
            selPair = null;
            selFrame = fh;
            mode = 'framemove';
            lastP = pp;
            hint.style.opacity = '0';
          } else {
            sel = null;
            // In the app frame the canvas IS the surface — a background finger
            // pans the imagespace (Photoshop grammar). Outside it (v1 page
            // flow), touch background stays the page's scroll surface (D5).
            mode = e.pointerType === 'touch' && !appFrame ? 'bgtap' : 'pan';
            lastV = vp;
            hint.style.opacity = '0';
          }
        }
      } else if (pts.size === 2) {
        mode = 'zoom';
        const a = arrV();
        Bz = { d0: a[0].getDistance(a[1]) || 1 };
      }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) {
      if (animating || !pts.has(e.pointerId)) return;
      const vp = toV(e);
      pts.get(e.pointerId).v = vp;
      if (downV && vp.getDistance(downV) > 3) moved = true;
      if (mode === 'symmove' && selSym != null) {
        const pp = view.viewToProject(vp);
        syms[selSym].tx += pp.x - lastP.x;
        syms[selSym].ty += pp.y - lastP.y;
        lastP = view.viewToProject(vp);
        drawStrokes();
      } else if (mode === 'symhandle' && selSym != null) {
        const v2 = view.viewToProject(vp).subtract(Bh.c);
        syms[selSym].scale = Math.max(0.2, Math.min(6, Bh.s0 * (v2.length / Bh.r0)));
        syms[selSym].rot = Bh.rot0 + (Math.atan2(v2.y, v2.x) - Bh.a0) * 180 / Math.PI;
        drawStrokes();
      } else if (mode === 'draw' && cur) {
        const pp3 = view.viewToProject(vp);
        const last = cur.pts[cur.pts.length - 1];
        if (Math.abs(pp3.x - last.x) + Math.abs(pp3.y - last.y) > 1.4) {
          const pr = e.pointerType === 'pen' ? e.pressure || 0.5 : -1;
          cur.pts.push({ x: pp3.x, y: pp3.y, pr: pr });
          drawStrokes();
        }
      } else if (mode === 'move' && sel != null) {
        const pp1 = view.viewToProject(vp);
        st[sel].tx += pp1.x - lastP.x;
        st[sel].ty += pp1.y - lastP.y;
        lastP = view.viewToProject(vp);
        fast();
      } else if (mode === 'framemove' && selFrame != null && frames[selFrame]) {
        const ppf = view.viewToProject(vp);
        const fdx = ppf.x - lastP.x,
          fdy = ppf.y - lastP.y;
        frames[selFrame].tx += fdx;
        frames[selFrame].ty += fdy;
        // translate the painted paths directly while dragging — the full
        // rebuild (booleans + weave) waits for pointerup, so scallop/weave
        // never re-run per move tick.
        frameLayer.children.forEach(function (c) {
          if (c.data && c.data.fi === selFrame) c.position = c.position.add(new paper.Point(fdx, fdy));
        });
        lastP = ppf;
        try {
          view.update();
        } catch (x) {}
      } else if (mode === 'pan') {
        const d = vp.subtract(lastV);
        view.center = view.center.subtract(d.divide(view.zoom));
        lastV = vp;
        fast();
      } else if (mode === 'resize' && sel != null) {
        const pp2 = view.viewToProject(vp);
        st[sel].scale = Math.max(0.3, Math.min(5, Bh.s0 * (pp2.getDistance(Bh.c) / Bh.r0)));
        // the gold dot now also ROTATES, exactly like the symbol handle —
        // finally making the old copy's promise true (owner 2026-07-17)
        const v2r = pp2.subtract(Bh.c);
        st[sel].rot = Bh.rot0 + ((Math.atan2(v2r.y, v2r.x) - Bh.a0) * 180) / Math.PI;
        fast();
      } else if (mode === 'zoom' && pts.size >= 2) {
        const a = arrV();
        const d2 = a[0].getDistance(a[1]);
        const mid = a[0].add(a[1]).divide(2);
        zoomAt(view.zoom * (d2 / Bz.d0), mid);
        Bz.d0 = d2;
        fast();
      }
      e.preventDefault();
    });
    function up(e) {
      if (animating) return;
      const had = pts.delete(e.pointerId);
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch (x) {}
      // A pointer we never tracked (e.g. the tap-to-skip tap above) must not
      // replay stale gesture state as a selection or an undo entry.
      if (!had) return;
      if (drawMode) {
        if (mode === 'draw') {
          cur = null;
          drawStrokes();
        } else if (mode === 'symmove' || mode === 'symhandle') {
          // D7: the symbol gesture becomes an undo entry only if it moved.
          if (moved && preGesture) {
            undoStack.push(preGesture);
            if (undoStack.length > 80) undoStack.shift();
            redoStack = [];
            updU();
          }
          drawStrokes();
        }
        preGesture = null;
        if (pts.size === 0) mode = null;
        return;
      }
      const didModify = moved && (mode === 'move' || mode === 'resize' || mode === 'framemove');
      if (!moved) {
        if (downPair) {
          selPair = { i: downPair.i, j: downPair.j };
          sel = null;
        } else if (mode === 'move' && sel != null) {
          selPair = null;
        } else if (mode === 'pan' || mode === 'bgtap') {
          selPair = null;
          sel = null;
        }
      }
      // v2: a tap-select surfaces the letter/crossing editor — its boxes live
      // in the Letters tab, so jump there with the selection kept (inert on v1).
      if (!moved && v2 && !drawMode && (sel != null || selPair)) v2.ensureLetters();
      // …and tapping a frame surfaces ITS controls in the Frame tab.
      if (v2 && mode === 'framemove') v2.ensureFrame();
      if (mode === 'framemove') reflectShelf(); // sliders reflect the new spot
      if (didModify && preGesture) {
        undoStack.push(preGesture);
        if (undoStack.length > 80) undoStack.shift();
        redoStack = [];
        updU();
      }
      preGesture = null;
      if (pts.size === 0) {
        mode = null;
        full();
      } else if (pts.size === 1 && sel != null) {
        // D6: after a staggered pinch-lift, only re-enter letter-drag when the
        // surviving finger is the one that actually started on the selected
        // letter — otherwise the letter jumped under an innocent zoom finger.
        const rem = pts.values().next().value;
        if (rem && rem.hitSel) {
          mode = 'move';
          lastP = view.viewToProject(arrV()[0]);
        } else {
          mode = null;
        }
      }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener(
      'wheel',
      function (e) {
        if (animating) return;
        // D5: plain wheel/two-finger-swipe keeps scrolling the PAGE — the tall
        // desktop canvas was a scroll trap. Zoom only on Ctrl/Cmd+wheel (which
        // is also what a trackpad pinch emits).
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        zoomAt(view.zoom * (1 - e.deltaY * 0.0015), toV(e));
        if (zt) clearTimeout(zt);
        fast();
        zt = setTimeout(full, 180);
      },
      { passive: false },
    );
    // D5 (touch): the canvas CSS is now touch-action:pan-y, so a background
    // swipe scrolls the page like anywhere else. This non-passive touchstart
    // claims the gesture (preventDefault → no scroll) ONLY when the touch
    // lands on something the studio drags — a letter, a crossing, a handle, a
    // symbol, any multi-touch pinch, or anything at all in draw mode.
    cv.addEventListener(
      'touchstart',
      function (e) {
        if (!view || animating) return;
        if (appFrame) {
          // the frame owns every gesture — nothing beneath to scroll
          e.preventDefault();
          return;
        }
        if (e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const t = e.touches[0];
        if (!t) return;
        const pp = view.viewToProject(toV(t));
        let claim = drawMode; // draw mode: every touch is a stroke/symbol interaction
        if (!claim && sel != null && hit[sel] && pp.getDistance(corner()) < 20 / view.zoom) claim = true;
        if (!claim && (topHit(pp) != null || pairAt(pp))) claim = true;
        if (!claim && frameHit(pp) != null) claim = true;
        if (claim) e.preventDefault();
      },
      { passive: false },
    );
    cv.addEventListener('dblclick', function (e) {
      if (drawMode || animating) return;
      const hi = topHit(view.viewToProject(toV(e)));
      if (hi == null) return;
      pushUndo();
      const s = st[hi];
      s.tx = offX(hi);
      s.ty = 0;
      s.scale = hi === 1 ? 0.62 : 1;
      s.rot = 0;
      s.skew = 0;
      s.flipX = false;
      full();
    });
    // v1-only chrome: the Arrange|Draw toggle + the collapsible animate header.
    // Absent on the v2 markup (tabs replace both) — feature-detect, never assume.
    const modesEl = $('modes');
    if (modesEl)
      modesEl.addEventListener('click', function (e) {
        const b = e.target.closest('.tg');
        if (!b || animating) return;
        drawMode = b.dataset.m === 'draw';
        [].forEach.call(this.children, function (c) {
          c.classList.toggle('on', c === b);
        });
        sel = null;
        selPair = null;
        selSym = null;
        // D3: switching modes dismisses the gold/molten React overlay — before
        // this, the WebGL preview sat over the canvas with no way out.
        onPreviewKind(null, null);
        full();
      });
    const animHdr = $('animhdr');
    if (animHdr)
      animHdr.addEventListener('click', function () {
        $('animbox').classList.toggle('open');
      });
    // ── v2 markup (monogram_studio_v2 · council verdict §2): Letters · Frame ·
    // Reveal section tabs. drawMode is true ONLY while "✎ Draw your own" is
    // open inside the Frame tab — Letters/Reveal canvas taps arrange, never
    // stroke. On the v1 markup (#vtabs absent) this whole block is inert.
    const vtabs = $('vtabs');
    if (vtabs) {
      let curTab = 'letters';
      let drawOpen = false;
      const showTab = function (t, keepSel) {
        curTab = t;
        [].forEach.call(vtabs.querySelectorAll('[data-vt]'), function (b) {
          const on = b.dataset.vt === t;
          b.classList.toggle('on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        ['letters', 'frame', 'reveal'].forEach(function (k) {
          const p = $('tab-' + k);
          if (p) p.classList.toggle('off', k !== t);
        });
        drawMode = t === 'frame' && drawOpen;
        if (!keepSel) {
          sel = null;
          selPair = null;
        }
        selSym = null;
        onPreviewKind(null, null); // D3: leaving a tab dismisses the gold/molten overlay
        full();
        // §5.7 — the Reveal tab is the Finish step: entering it plays the
        // current reveal once (tap-to-skip shipped in PR-1 makes this safe),
        // and the on-canvas Replay shows only here.
        const rp = $('replay');
        if (rp) rp.classList.toggle('off', t !== 'reveal');
        if (t === 'reveal') play(anim);
      };
      v2 = {
        // Tap-selecting a letter/crossing surfaces its editor boxes, which live
        // in the Letters tab — jump there, keeping the selection. No-op when
        // the couple is already on Letters.
        ensureLetters: function () {
          if (curTab !== 'letters') showTab('letters', true);
        },
        // Tapping/dragging a frame surfaces its controls in the Frame tab.
        ensureFrame: function () {
          if (curTab !== 'frame') showTab('frame', true);
        },
      };
      vtabs.addEventListener('click', function (e) {
        const b = e.target.closest('[data-vt]');
        if (!b || animating) return;
        showTab(b.dataset.vt, false);
      });
      const dt = $('drawtoggle');
      const tools = $('drawtools');
      if (dt)
        dt.addEventListener('click', function () {
          if (animating) return;
          drawOpen = !drawOpen;
          dt.classList.toggle('on', drawOpen);
          if (tools) tools.classList.toggle('off', !drawOpen);
          drawMode = curTab === 'frame' && drawOpen;
          selSym = null;
          full();
        });
      const more = $('more');
      const morebox = $('morebox');
      if (more && morebox)
        more.addEventListener('click', function () {
          morebox.classList.toggle('off');
        });
      const refineHdr = $('refinehdr');
      if (refineHdr)
        refineHdr.addEventListener('click', function () {
          $('refine').classList.toggle('open');
        });
      buildMoods(); // the 8 pre-balanced palette moods (§2)
      buildShelf(); // the Frame tab's pattern shelf (§4)
      // (the starting-points strip builds at the end of derive() — it needs
      // the letters, which don't exist yet at bindUI time)
      // ── Reveal tempo chips (§5.4): each writes dur/smooth/delay and plays.
      const tempoEl = $('tempo');
      if (tempoEl)
        tempoEl.addEventListener('click', function (e) {
          const b = e.target.closest('[data-tp]');
          if (!b || animating) return;
          const t = ANIM_TEMPOS[b.dataset.tp];
          if (!t) return;
          animTempo = b.dataset.tp;
          animDur = t.dur;
          animDelay = t.delay;
          animSmooth = t.smooth;
          reflectAnimUI();
          play(anim);
        });
      const fthdr = $('fthdr');
      if (fthdr)
        fthdr.addEventListener('click', function () {
          $('finetune').classList.toggle('open');
        });
      const replay = $('replay');
      if (replay)
        replay.addEventListener('click', function () {
          if (!animating) play(anim);
        });
    }
    $('animbox').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'play') {
        play(anim);
        return;
      }
      if (b.dataset.an) {
        anim = b.dataset.an;
        [].forEach.call(this.querySelectorAll('[data-an]'), function (c) {
          c.classList.toggle('on', c === b);
        });
        reflectTempoUI(); // molten note visibility tracks the picked kind
        play(anim);
      }
    });
    $('dur').addEventListener('input', function () {
      animDur = parseInt(this.value, 10) / 10;
      $('dur_v').textContent = animDur.toFixed(1) + 's';
      animTempo = 'custom'; // fine-tuned by hand → no chip stays lit
      reflectTempoUI();
    });
    $('dl').addEventListener('input', function () {
      animDelay = parseInt(this.value, 10) / 10;
      $('dl_v').textContent = animDelay.toFixed(1) + 's';
      animTempo = 'custom';
      reflectTempoUI();
    });
    $('smooth').addEventListener('input', function () {
      animSmooth = parseInt(this.value, 10) / 100;
      $('sm_v').textContent = this.value + '%';
      animTempo = 'custom';
      reflectTempoUI();
    });
    $('palette').addEventListener('click', function (e) {
      const b = e.target.closest('[data-sym]');
      if (!b) return;
      pushUndo();
      syms.push({ kind: b.dataset.sym, tx: view.center.x, ty: view.center.y, scale: 1, rot: 0, mode: mirror, c: inkHex });
      selSym = syms.length - 1;
      drawStrokes();
      syncUI();
    });
    $('symmirror').addEventListener('click', function (e) {
      const b = e.target.closest('[data-sm]');
      if (!b || selSym == null) return;
      pushUndo();
      syms[selSym].mode = b.dataset.sm;
      drawStrokes();
      syncUI();
    });
    $('symdel').addEventListener('click', function () {
      if (selSym == null) return;
      pushUndo();
      syms.splice(selSym, 1);
      selSym = null;
      drawStrokes();
      syncUI();
    });
    $('symdone').addEventListener('click', function () {
      selSym = null;
      drawStrokes();
      syncUI();
    });
    $('nibstyle').addEventListener('click', function (e) {
      const b = e.target.closest('.tg');
      if (!b) return;
      nibStyle = b.dataset.ns;
      [].forEach.call(this.children, function (c) {
        if (c.dataset.ns) c.classList.toggle('on', c === b);
      });
      $('nibrow').style.display = nibStyle === 'broad' ? '' : 'none';
    });
    $('mirror').addEventListener('click', function (e) {
      const b = e.target.closest('.tg');
      if (!b) return;
      mirror = b.dataset.mir;
      [].forEach.call(this.children, function (c) {
        if (c.dataset.mir) c.classList.toggle('on', c === b);
      });
      drawStrokes();
    });
    $('nib').addEventListener('input', function () {
      nibAngle = parseInt(this.value, 10);
      $('nib_v').textContent = this.value + '°';
    });
    $('pw').addEventListener('input', function () {
      penW = parseInt(this.value, 10);
      $('pw_v').textContent = this.value;
    });
    $('clearpen').addEventListener('click', function () {
      if (!strokes.length && !syms.length) return;
      pushUndo();
      strokes = [];
      syms = [];
      selSym = null;
      drawStrokes();
      syncUI();
    });
    // The ONE branded micro-interaction (benchmark §1): flipping a weave gets a
    // 120ms gold glint at the crossing + a haptic tick — and nothing else does.
    function weaveGlint() {
      try {
        if (!selPair || !view) return;
        const rg = regions.filter(function (r) {
          return selPair && r.i === selPair.i && r.j === selPair.j;
        })[0];
        if (!rg) return;
        const vp = view.projectToView(rg.r.bounds.center);
        const hostEl = cv.parentElement;
        if (!hostEl) return;
        const g = document.createElement('div');
        g.className = 'weaveglint';
        g.style.left = vp.x + 'px';
        g.style.top = vp.y + 'px';
        hostEl.appendChild(g);
        const a = g.animate(
          [
            { opacity: 0, transform: 'scale(0.35)' },
            { opacity: 1, transform: 'scale(1.25)', offset: 0.45 },
            { opacity: 0, transform: 'scale(1.6)' },
          ],
          { duration: 120, easing: 'ease-out', fill: 'both' },
        );
        const done = function () {
          try {
            g.remove();
          } catch (x) {}
        };
        a.onfinish = done;
        a.oncancel = done;
        if (navigator.vibrate) navigator.vibrate(10);
      } catch (e) {}
    }
    crossBox.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || !selPair) return;
      if (b.dataset.act) {
        pushUndo();
        pstate[pkey(selPair.i, selPair.j)] = b.dataset.act;
        full();
        weaveGlint();
      } else if (b.dataset.topk) {
        const top = +b.dataset.topk;
        const other = top === selPair.i ? selPair.j : selPair.i;
        pushUndo();
        setTop(top, other);
        full();
      }
    });
    $('cg').addEventListener('input', function () {
      if (!selPair) return;
      const t = topOf(selPair.i, selPair.j);
      st[t].gap = parseInt(this.value, 10);
      $('cg_v').textContent = this.value;
      full();
    });
    wireSlider($('cg'));
    $('s_outline').addEventListener('input', function () {
      if (sel == null) return;
      st[sel].outline = parseInt(this.value, 10);
      $('o_out').textContent = this.value;
      full();
    });
    wireSlider($('s_outline'));
    $('s_gap').addEventListener('input', function () {
      if (sel == null) return;
      st[sel].gap = parseInt(this.value, 10);
      $('o_gap').textContent = this.value;
      full();
    });
    wireSlider($('s_gap'));
    $('s_strength').addEventListener('input', function () {
      if (sel == null) return;
      st[sel].strength = parseInt(this.value, 10) / 100;
      full();
    });
    wireSlider($('s_strength'));
    $('s_clean').addEventListener('click', function () {
      if (sel == null) return;
      pushUndo();
      st[sel].clean = !st[sel].clean;
      full();
    });
    // Letter transforms (v2 selbox only — elements absent on v1)
    const sRot = $('s_rot');
    if (sRot) {
      sRot.addEventListener('input', function () {
        if (sel == null) return;
        st[sel].rot = parseInt(this.value, 10);
        $('o_rot').textContent = this.value + '°';
        full();
      });
      wireSlider(sRot);
    }
    const sSkew = $('s_skew');
    if (sSkew) {
      sSkew.addEventListener('input', function () {
        if (sel == null) return;
        st[sel].skew = parseInt(this.value, 10);
        $('o_skew').textContent = this.value + '°';
        full();
      });
      wireSlider(sSkew);
    }
    const sFlip = $('s_flip');
    if (sFlip)
      sFlip.addEventListener('click', function () {
        if (sel == null) return;
        pushUndo();
        st[sel].flipX = !st[sel].flipX;
        full();
      });
    $('s_front').addEventListener('click', function () {
      if (sel == null) return;
      pushUndo();
      order = order.filter(function (x) {
        return x !== sel;
      });
      order.push(sel);
      full();
    });
    $('s_back').addEventListener('click', function () {
      if (sel == null) return;
      pushUndo();
      order = order.filter(function (x) {
        return x !== sel;
      });
      order.unshift(sel);
      full();
    });
    undoBtn.addEventListener('click', doUndo);
    redoBtn.addEventListener('click', doRedo);
    keyHandler = function (e) {
      // D11: typing in the Names field (or any input) keeps its NATIVE text
      // undo — the canvas only owns Cmd/Ctrl+Z outside form fields.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const m = e.metaKey || e.ctrlKey;
      if (m && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (m && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        doRedo();
      }
    };
    document.addEventListener('keydown', keyHandler);
    $('fit').addEventListener('click', function () {
      if (animating) return;
      view.zoom = 1;
      view.center = new paper.Point(0, 0);
      full();
    });
    $('reset').addEventListener('click', function () {
      if (animating) return;
      pushUndo();
      initState();
      strokes = [];
      syms = [];
      selSym = null;
      frames = [];
      selFrame = null;
      presetKey = null;
      view.zoom = 1;
      view.center = new paper.Point(0, 0);
      full();
      reflectShelf();
      reflectPresetStrip();
    });
    $('inks').addEventListener('click', function (e) {
      const b = e.target.closest('.sw');
      if (!b) return;
      inkHex = b.dataset.c;
      ink = new paper.Color(inkHex);
      selSwatch(this, b);
      syncColorInput('ink_custom', inkHex);
      full();
      reflectMoods();
    });
    $('ink_custom').addEventListener('input', function () {
      inkHex = this.value;
      ink = new paper.Color(inkHex);
      selSwatch($('inks'), null);
      full();
    });
    $('outs').addEventListener('click', function (e) {
      const b = e.target.closest('.sw');
      if (!b) return;
      outlineHex = b.dataset.c; // a hex, or 'none' (Clear → no outline drawn)
      selSwatch(this, b);
      if (outlineHex !== 'none') syncColorInput('out_custom', outlineHex);
      full();
    });
    $('out_custom').addEventListener('input', function () {
      outlineHex = this.value;
      selSwatch($('outs'), null);
      full();
    });
    $('bgs').addEventListener('click', function (e) {
      const b = e.target.closest('.bg');
      if (!b) return;
      bgc = b.dataset.c;
      cv.style.background = bgc === 'transparent' ? CHECKER : bgc;
      selSwatch(this, b);
      if (bgc !== 'transparent') syncColorInput('bg_custom', bgc);
    });
    $('bg_custom').addEventListener('input', function () {
      bgc = this.value;
      cv.style.background = bgc;
      selSwatch($('bgs'), null);
    });
    $('fonts').addEventListener('click', function (e) {
      const b = e.target.closest('.chip');
      if (!b) return;
      const self = this;
      load.classList.remove('off');
      load.textContent = 'Loading ' + b.textContent + '…';
      loadFont(b.dataset.f, function (f) {
        load.classList.add('off');
        if (!f) return;
        font = f;
        fontKey = b.dataset.f;
        [].forEach.call(self.children, function (c) {
          c.classList.toggle('sel', c === b);
        });
        buildBase();
        full();
        schedulePresetThumbs(); // new face → the starting points re-render in it
      });
    });
    // D1 guard: derive() hard-resets every letter's state AND the undo history,
    // which turned any Names keystroke (a typo fix, a trailing space) into
    // unrecoverable data loss. The guard lives HERE, not inside derive() —
    // applyConfig() deliberately calls derive() and depends on its full reset.
    namesEl.addEventListener('input', function () {
      const next = computeLetters(namesEl.value);
      if (
        next.length === letters.length &&
        next.every(function (ch, i) {
          return ch === letters[i];
        })
      )
        return; // same initials — typing elsewhere in the names never rebuilds
      pushUndo(); // ONE undoable step (the pre-change design), stacks survive
      const prevLetters = letters,
        prevSt = st,
        prevOrder = order,
        prevPstate = pstate,
        sameShape = next.length === prevLetters.length;
      letters = next;
      buildBase();
      initState();
      // Keep each surviving letter's arrangement: same index + same glyph →
      // the couple's placement/scale/weave work persists across the rename.
      st = letters.map(function (ch, i) {
        return prevLetters[i] === ch && prevSt[i] ? Object.assign({}, prevSt[i]) : st[i];
      });
      if (sameShape) {
        // Same letter count → indices (and so crossing keys) still mean the
        // same pairs; keep z-order and weave/merge decisions too.
        order = prevOrder.slice();
        pstate = Object.assign({}, prevPstate);
      }
      full();
      buildPresetStrip(); // new initials → refit the cards + regenerate thumbs
    });
  }

  // ── config restore ──
  function applyConfig(cfg) {
    try {
      if (typeof cfg.text === 'string') namesEl.value = cfg.text;
      if (cfg.ink) {
        inkHex = cfg.ink;
        ink = new paper.Color(inkHex);
        reflectSwatch('inks', inkHex);
        syncColorInput('ink_custom', inkHex);
      }
      if (cfg.outlineColor) {
        outlineHex = cfg.outlineColor;
        reflectSwatch('outs', outlineHex);
        if (outlineHex !== 'none') syncColorInput('out_custom', outlineHex);
      }
      if (cfg.bg) {
        bgc = cfg.bg;
        cv.style.background = bgc === 'transparent' ? CHECKER : bgc;
        reflectSwatch('bgs', bgc);
        if (bgc !== 'transparent') syncColorInput('bg_custom', bgc);
      }
      if (cfg.anim) {
        anim = cfg.anim.kind || anim;
        animDur = cfg.anim.dur ?? animDur;
        animSmooth = cfg.anim.smooth ?? animSmooth;
        animDelay = cfg.anim.delay ?? animDelay;
        animTempo = cfg.anim.preset || inferTempo();
        reflectAnimUI();
      }
      const apply2 = function () {
        reflectFontChip(fontKey);
        derive();
        if (Array.isArray(cfg.st) && cfg.st.length) {
          st = letters.map(function (_, i) {
            return cfg.st[i] ? Object.assign({}, st[i], cfg.st[i]) : st[i];
          });
        }
        if (Array.isArray(cfg.order) && cfg.order.length === letters.length) order = cfg.order.slice();
        pstate = cfg.pstate ? Object.assign({}, cfg.pstate) : {};
        strokes = Array.isArray(cfg.strokes)
          ? cfg.strokes.map(function (s) {
              return { w: s.w, nib: s.nib, style: s.style, c: s.c, mode: s.mode, pts: cpPts(s.pts) };
            })
          : [];
        syms = Array.isArray(cfg.syms) ? cpSyms(cfg.syms) : [];
        frames = Array.isArray(cfg.frames) ? cpFrames(cfg.frames) : [];
        selFrame = null;
        presetKey = typeof cfg.preset === 'string' ? cfg.preset : null;
        undoStack = [];
        redoStack = [];
        updU();
        full();
        reflectShelf();
        reflectPresetStrip();
      };
      if (cfg.font && cfg.font !== fontKey && FONTS[cfg.font]) {
        fontKey = cfg.font;
        loadFont(cfg.font, function (f) {
          if (f) font = f;
          apply2();
        });
      } else {
        apply2();
      }
    } catch (e) {}
  }

  // ── export (Save as my monogram) ──
  function serialize() {
    return {
      text: namesEl.value || '',
      font: fontKey,
      ink: inkHex,
      outlineColor: outlineHex,
      bg: bgc,
      st: st.map(function (s) {
        return Object.assign({}, s);
      }),
      order: order.slice(),
      pstate: Object.assign({}, pstate),
      strokes: strokes.map(function (s) {
        return { w: s.w, nib: s.nib, style: s.style, c: s.c, mode: s.mode, pts: cpPts(s.pts) };
      }),
      syms: cpSyms(syms).map(function (s) {
        // D8: the drag handle accumulates turns; wrap to (-180, 180] so the
        // sanitizer's [-360, 360] clamp can never rotate a reloaded symbol.
        s.rot = ((s.rot % 360) + 540) % 360 - 180;
        return s;
      }),
      frames: cpFrames(frames),
      preset: presetKey || undefined,
      anim: { kind: anim, dur: animDur, smooth: animSmooth, delay: animDelay, preset: animTempo },
    };
  }
  function buildExportSVG() {
    if (!view) return null;
    const hs = sel,
      hp = selPair,
      hy = selSym,
      hd = drawMode;
    sel = null;
    selPair = null;
    selSym = null;
    drawMode = false;
    full();
    // Canonical export order (§4.4): frames → letters → strokes → syms — now
    // exported as THREE <g data-mlayer> groups so the Medallion Turn can give
    // frames/letters/accents different depths (intra-mark parallax, benchmark
    // verdict §3.8). Pure structure: <g> + data-* pass the SVG sanitizer;
    // pre-group saved marks simply render without parallax.
    const collect = function (lyr) {
      const arr = [];
      lyr.children.forEach(function (c) {
        if (c.fillColor) arr.push(c);
      });
      return arr;
    };
    const layers = [
      { name: 'frames', items: collect(frameLayer) },
      { name: 'letters', items: collect(layer) },
      { name: 'pen', items: collect(penLayer) },
    ];
    let out = null;
    const total = layers.reduce(function (n, L) {
      return n + L.items.length;
    }, 0);
    if (total) {
      const groups = layers.map(function (L) {
        return { name: L.name, grp: new paper.Group(L.items.map(function (c) { return c.clone(); })) };
      });
      const allGrp = new paper.Group(groups.map(function (g) { return g.grp; }));
      const b = allGrp.bounds;
      const pad = Math.max(b.width, b.height) * 0.06 + 6;
      const x = b.x - pad,
        y = b.y - pad,
        w = b.width + 2 * pad,
        h = b.height + 2 * pad;
      let inner = '';
      try {
        groups.forEach(function (g) {
          if (!g.grp.children.length) return;
          const node = g.grp.exportSVG({ asString: false });
          inner +=
            '<g data-mlayer="' + g.name + '">' + new XMLSerializer().serializeToString(node) + '</g>';
        });
      } catch (e) {
        inner = '';
      }
      allGrp.remove();
      if (inner && w > 0 && h > 0) {
        const R = function (v) {
          return Math.round(v * 100) / 100;
        };
        out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + R(x) + ' ' + R(y) + ' ' + R(w) + ' ' + R(h) + '">' + inner + '</svg>';
      }
    }
    sel = hs;
    selPair = hp;
    selSym = hy;
    drawMode = hd;
    full();
    return out;
  }
  function getExport() {
    const svg = buildExportSVG();
    return svg ? { svg: svg, config: serialize() } : null;
  }

  function destroy() {
    destroyed = true;
    try {
      if (view) view.onFrame = null;
    } catch (e) {}
    try {
      if (resizeObs) resizeObs.disconnect();
      resizeObs = null;
    } catch (e) {}
    try {
      if (sizeRaf) cancelAnimationFrame(sizeRaf);
      sizeRaf = 0;
    } catch (e) {}
    try {
      if (zt) clearTimeout(zt);
    } catch (e) {}
    try {
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
    } catch (e) {}
    try {
      if (proj) proj.remove();
    } catch (e) {}
  }

  // boot
  loadFont('cardo', function (f) {
    if (!f) {
      load.textContent = 'Could not load the typeface.';
      return;
    }
    font = f;
    fontKey = 'cardo';
    load.classList.add('off');
    start();
    if (initialConfig) applyConfig(initialConfig);
  });

  return { getExport: getExport, destroy: destroy };
}
