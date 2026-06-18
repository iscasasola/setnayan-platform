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
    keyHandler = null;

  function loadFont(key, cb) {
    if (cache[key]) {
      cb(cache[key]);
      return;
    }
    fetch(FONT_BASE + FONTS[key])
      .then(function (r) {
        return r.arrayBuffer();
      })
      .then(function (buf) {
        try {
          const f = opentype.parse(buf);
          cache[key] = f;
          cb(f);
        } catch (e) {
          cb(null);
        }
      })
      .catch(function () {
        cb(null);
      });
  }

  let view,
    layer,
    penLayer,
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

  function cpPts(a) {
    return a.map(function (q) {
      return { x: q.x, y: q.y, pr: q.pr };
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
        return Object.assign({}, s);
      }),
      order: order.slice(),
      pstate: Object.assign({}, pstate),
      strokes: strokes.map(function (s) {
        return { w: s.w, nib: s.nib, style: s.style, c: s.c, mode: s.mode, pts: cpPts(s.pts) };
      }),
      syms: cpSyms(syms),
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
    sel = null;
    selPair = null;
    selSym = null;
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
  }
  function doRedo() {
    if (!redoStack.length) return;
    undoStack.push(snap());
    restore(redoStack.pop());
    full();
    updU();
  }

  function start() {
    paper.setup(cv);
    view = paper.view;
    proj = paper.project;
    layer = paper.project.activeLayer;
    penLayer = new paper.Layer();
    layer.activate();
    const rw = cv.clientWidth || 390;
    view.viewSize = new paper.Size(rw, 300);
    view.center = new paper.Point(0, 0);
    FS = 150;
    ink = new paper.Color('#5C2542');
    inkHex = '#5C2542';
    bgc = '#FBFBFA';
    outlineHex = '#C5A059';
    bindUI();
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
  function derive() {
    const v = (namesEl.value || '').trim(),
      parts = v.split(/\s*(?:&|\+|\band\b)\s*/i).filter(Boolean);
    let L = 'M',
      R = 'J';
    if (parts.length >= 2) {
      L = parts[0][0];
      R = parts[1][0];
      letters = [(L || 'M').toUpperCase(), '&', (R || 'J').toUpperCase()];
    } else if (parts.length === 1) {
      L = parts[0][0] || 'M';
      letters = [L.toUpperCase()];
    } else letters = ['M', '&', 'J'];
    buildBase();
    initState();
    undoStack = [];
    redoStack = [];
    updU();
    full();
  }
  function initState() {
    st = letters.map(function (_, i) {
      return { tx: offX(i), ty: 0, scale: i === 1 ? 0.62 : 1, gap: 6, outline: 3, clean: false, strength: 0.3 };
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
      const c = p.clone();
      c.fillColor = ink;
      c.strokeColor = null;
      layer.addChild(c);
    });
    decor();
    drawStrokes();
    zoomEl.textContent = Math.round(view.zoom * 100) + '%';
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
    const groups = Object.keys(gmap).map(function (r) {
      const mem = gmap[r];
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
      return { mem: mem, path: path, z: z, front: fr };
    });
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
    if (animating || !view) return;
    preset = preset || anim;
    anim = preset;
    sel = null;
    selPair = null;
    selSym = null;
    full();
    const lyr = [],
      pen = [];
    layer.children.forEach(function (c) {
      if (c.fillColor) lyr.push(c);
    });
    penLayer.children.forEach(function (c) {
      if (c.fillColor) pen.push(c);
    });
    const items = lyr.concat(pen);
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
      const stag = (nn > 1 ? (D * 0.55) / (nn - 1) : 0) + DL;
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
          if (done || t > D + nn * DL + 4) {
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
      const step = (nn2 > 1 ? (D * 0.6) / (nn2 - 1) : 0) + DL;
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
          if (done || t > D + nn2 * DL + 4) {
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
      if (ro) ro.textContent = 'Editing ' + letters[sel] + ' · ' + Math.round(s.scale * 100) + '%';
    } else {
      crossBox.style.display = 'none';
      selBox.style.display = 'none';
      if (eh) eh.style.display = '';
      if (ro) ro.textContent = 'Tap a letter · tap a crossing · open Preview to animate.';
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
    [].forEach.call($('animbox').querySelectorAll('[data-an]'), function (c) {
      c.classList.toggle('on', c.dataset.an === anim);
    });
    $('dur').value = Math.round(animDur * 10);
    $('dur_v').textContent = animDur.toFixed(1) + 's';
    $('dl').value = Math.round(animDelay * 10);
    $('dl_v').textContent = animDelay.toFixed(1) + 's';
    $('smooth').value = Math.round(animSmooth * 100);
    $('sm_v').textContent = Math.round(animSmooth * 100) + '%';
  }

  function bindUI() {
    cv.addEventListener('pointerdown', function (e) {
      if (animating) return;
      cv.setPointerCapture(e.pointerId);
      const vp = toV(e),
        pp = view.viewToProject(vp);
      pts.set(e.pointerId, { v: vp });
      downV = vp;
      moved = false;
      if (drawMode) {
        if (pts.size === 1) {
          if (selSym != null && symHitPaths[selSym] && pp.getDistance(symCorner()) < 14 / view.zoom) {
            pushUndo();
            mode = 'symhandle';
            const sc = symHitPaths[selSym].bounds.center,
              sv = pp.subtract(sc);
            Bh = { c: sc, r0: sv.length || 1, a0: Math.atan2(sv.y, sv.x), s0: syms[selSym].scale, rot0: syms[selSym].rot };
            e.preventDefault();
            return;
          }
          const sh = symHit(pp);
          if (sh != null) {
            pushUndo();
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
        const c = hit[sel].bounds.center;
        Bh = { c: c, r0: pp.getDistance(c) || 1, s0: st[sel].scale };
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
          hint.style.opacity = '0';
          fast();
        } else if (hi != null) {
          mode = 'move';
          sel = hi;
          lastP = pp;
        } else {
          sel = null;
          mode = 'pan';
          lastV = vp;
          hint.style.opacity = '0';
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
      } else if (mode === 'pan') {
        const d = vp.subtract(lastV);
        view.center = view.center.subtract(d.divide(view.zoom));
        lastV = vp;
        fast();
      } else if (mode === 'resize' && sel != null) {
        const pp2 = view.viewToProject(vp);
        st[sel].scale = Math.max(0.3, Math.min(5, Bh.s0 * (pp2.getDistance(Bh.c) / Bh.r0)));
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
      pts.delete(e.pointerId);
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch (x) {}
      if (drawMode) {
        if (mode === 'draw') {
          cur = null;
          drawStrokes();
        } else if (mode === 'symmove' || mode === 'symhandle') {
          drawStrokes();
        }
        if (pts.size === 0) mode = null;
        return;
      }
      const didModify = moved && (mode === 'move' || mode === 'resize');
      if (!moved) {
        if (downPair) {
          selPair = { i: downPair.i, j: downPair.j };
          sel = null;
        } else if (mode === 'move' && sel != null) {
          selPair = null;
        } else if (mode === 'pan') {
          selPair = null;
          sel = null;
        }
      }
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
        mode = 'move';
        lastP = view.viewToProject(arrV()[0]);
      }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener(
      'wheel',
      function (e) {
        if (animating) return;
        e.preventDefault();
        zoomAt(view.zoom * (1 - e.deltaY * 0.0015), toV(e));
        if (zt) clearTimeout(zt);
        fast();
        zt = setTimeout(full, 180);
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
      full();
    });
    $('modes').addEventListener('click', function (e) {
      const b = e.target.closest('.tg');
      if (!b || animating) return;
      drawMode = b.dataset.m === 'draw';
      [].forEach.call(this.children, function (c) {
        c.classList.toggle('on', c === b);
      });
      sel = null;
      selPair = null;
      selSym = null;
      full();
    });
    $('animhdr').addEventListener('click', function () {
      $('animbox').classList.toggle('open');
    });
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
        play(anim);
      }
    });
    $('dur').addEventListener('input', function () {
      animDur = parseInt(this.value, 10) / 10;
      $('dur_v').textContent = animDur.toFixed(1) + 's';
    });
    $('dl').addEventListener('input', function () {
      animDelay = parseInt(this.value, 10) / 10;
      $('dl_v').textContent = animDelay.toFixed(1) + 's';
    });
    $('smooth').addEventListener('input', function () {
      animSmooth = parseInt(this.value, 10) / 100;
      $('sm_v').textContent = this.value + '%';
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
    crossBox.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || !selPair) return;
      if (b.dataset.act) {
        pushUndo();
        pstate[pkey(selPair.i, selPair.j)] = b.dataset.act;
        full();
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
      view.zoom = 1;
      view.center = new paper.Point(0, 0);
      full();
    });
    $('inks').addEventListener('click', function (e) {
      const b = e.target.closest('.sw');
      if (!b) return;
      inkHex = b.dataset.c;
      ink = new paper.Color(inkHex);
      selSwatch(this, b);
      syncColorInput('ink_custom', inkHex);
      full();
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
      });
    });
    namesEl.addEventListener('input', derive);
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
        undoStack = [];
        redoStack = [];
        updU();
        full();
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
      syms: cpSyms(syms),
      anim: { kind: anim, dur: animDur, smooth: animSmooth, delay: animDelay },
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
    const items = [];
    layer.children.forEach(function (c) {
      if (c.fillColor) items.push(c);
    });
    penLayer.children.forEach(function (c) {
      if (c.fillColor) items.push(c);
    });
    let out = null;
    if (items.length) {
      const clones = items.map(function (c) {
        return c.clone();
      });
      const grp = new paper.Group(clones);
      const b = grp.bounds;
      const pad = Math.max(b.width, b.height) * 0.06 + 6;
      const x = b.x - pad,
        y = b.y - pad,
        w = b.width + 2 * pad,
        h = b.height + 2 * pad;
      let inner = '';
      try {
        const node = grp.exportSVG({ asString: false });
        inner = new XMLSerializer().serializeToString(node);
      } catch (e) {
        inner = '';
      }
      grp.remove();
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
    try {
      if (view) view.onFrame = null;
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
