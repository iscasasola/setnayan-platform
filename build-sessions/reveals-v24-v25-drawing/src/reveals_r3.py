"""Reveals round 3: every reveal on the shipped veil's motion rules. Writes out/rv4/artifact.html (+ index.html, _dark.html)."""
import sys, os, io, base64, json
sys.path.insert(0, os.path.dirname(__file__))
from lib import S
from PIL import Image
R4 = S + "/r4/"; OUT = S + "/out/rv4/"; os.makedirs(OUT, exist_ok=True)
def uri(im, q=78):
    b = io.BytesIO(); im.convert("RGB").save(b, "JPEG", quality=q, optimize=True); return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
def frame(n, k): return Image.open(R4 + "st/%s_%s.png" % (n, k)).crop((0, 0, 300, 520))
def strip(n, ks): return "".join('<img alt="" src="%s">' % uri(frame(n, k).resize((180, 312), Image.LANCZOS), 76) for k in ks)
def thumb(n): return uri(frame(n, "1").resize((152, 264), Image.LANCZOS), 72)

# name, key, cover, hint, drag?, what moves, built on / status
RV = [
 ("Veil", "veil", "cover3", "Tap, swipe up, or pinch the cloth and pull.", True,
  "The shipped veil’s cloth, solver and pinch. It unveils from where you tap: the cloth under your finger is taken up first and the rest follows. Then it stays, hanging as a soft fold along the top, as on your Event Hub.",
  "Live on cale-ice. Changed here: lifts from the tapped point, and slower."),
 ("Beach curtains", "curtains", "cover1", "Tap, swipe up, or take hold of a curtain.", True,
  "The veil’s cloth in a thicker thread, hung in two halves on a rod. The inner ring leads and the others stack behind it; the cloth swings in after its rings and settles.",
  "New, on the veil’s engine."),
 ("Envelope · classic", "envelope", "cover2", "Tap the seal.", False,
  "Made to read as a photograph: paper that takes the light across its embossing, a gold foil edge and a gold wax seal that mirror a room, soft shadows from one flap onto the next. The front flap bends as paper does while it unfolds upward, and the seal stays on its point and rises with it. The cover shows as soon as it opens, with a soft glow that passes.",
  "Rebuilt for realism, from your picture. Style 1 of 2."),
 ("Envelope · gatefold", "gatefold", "coverCale", "Tap the seal.", False,
  "Two tall panels of sculpted lilies, closed by a gold wax seal with your monogram on the seam. The seal is never cut in two: on one tap it lifts away whole with the left panel. The panels part slowly, like doors, and light comes from inside. You can choose a satin ribbon and bow in place of the seal: the bow comes undone, the ribbon is drawn off, and the panels part. It is one or the other, never both.",
  "Changed 23 Nov: a wax seal OR a ribbon, never both. The seal stays whole. Six more panel designs."),
 ("Fabric", "fabric", "cover6", "Tap, or take a fold and pull.", True,
  "One length of satin with a twist in it, lying on the cover like a cloth on a table. A pinch of it is taken where you tap and drawn down and off the screen. It does not fall: the rest follows the hand, and its corners draw together as it goes.",
  "Rebuilt: dragged off, not dropped."),
 ("Scratch", "scratch", "cover4", "Scratch with your finger. It opens at 60%.", True,
  "The gold comes off only where you rub and curls of foil fall. At 60% the rest crumbles away, slowly.",
  "As before, at the veil’s pace."),
 ("Smoke", "smoke", "cover5", "Tap anywhere. The ring starts under your finger.", True,
  "Dry-ice fog: slow, heavy, rolling. A tap sends a ring outward from the exact spot, the way a drop does in water, and a second, fainter ring follows. The fog thins behind them.",
  "Rebuilt: slower, low and rolling, opens in rings."),
 ("Cathedral doors", "doors", "cover2", "Tap the doors.", False,
  "Shut, with a thin seam of light. The leaves swing inward and light bursts through the gap. Then one unbroken glide: through the doorway and down a wide hall, over a polished marble floor that mirrors the chandeliers and the flowers, between round arrangements that line the aisle and tall ones on gold stands, under chiffon and flower arches, motes of light drifting past, into the white, and the cover is there. Near things stream by, far things grow slowly: a camera moving through a real space.",
  "Finish pass, 23 Nov: a floor that mirrors the hall, flowers at true scale with soft edges, a wider hall."),
 ("Petals", "petals", "cover5", "Tap anywhere. They lift from your finger.", False,
  "The cover lies under sampaguita and rose petals. A tap is a breath: they lift in a ring from the finger, tumble, and drift down slowly.", "New. Picked by you, 23 Nov. Now falling slower."),
 ("Fireworks", "fireworks", "cover4", "Tap anywhere. The rocket goes up from your finger.", False,
  "The cover waits under a night sky. One rocket climbs from your finger and bursts. Wherever the gold sparks fall, the night melts away. Two more bursts follow, and the last of the dark goes in glitter.", "New, from your own idea of sparkles. Picked by you, 23 Nov."),
]
NEW = [
 ("Gift box · redrawn", "gift", "coverCale", "Tap the bow.", False,
  "A wrapped box in one pool of warm light on a dark table. Deep green paper with your monogram in gold foil, the end folded the way a present is wrapped. A satin ribbon crosses it and is tied in a full bow. Around it lies an arrangement you choose: flowers, petals, pearls, diamonds, confetti, balloons or gold stars. A soft breeze moves the flowers, the petals and the loose ribbon; diamonds and gold stars sparkle. The box throws its shadow on the ground. One tap: the bow comes undone, and the four lengths of ribbon open outward and settle on the ground like a flower opening. Nothing is dragged across the box. Then the lid opens slowly, light comes up from inside over gold tissue, and the view comes over the box and down until the cover fills the screen.",
  "Held on 23 Nov. Redrawn five times. Not one of the nine until you say so."),
]
CSS = open(os.path.dirname(__file__) + "/reveals3d.css").read() + """
.shelf .sep{flex:none;align-self:stretch;width:1px;margin:0 4px;background:var(--ghost)}
.rules{display:grid;gap:12px;margin:0;padding:0;list-style:none}
.rules li{display:grid;grid-template-columns:28px 1fr;gap:12px;margin:0;font-size:14px}
.rules b{display:block}.rules span{color:var(--muted)}
.rules .no{width:28px;height:28px}
.fr.three{grid-template-columns:repeat(3,1fr);max-width:75%}
.cap3{display:grid;grid-template-columns:repeat(3,1fr);max-width:75%;gap:4px;font-size:11px;color:var(--faint);text-align:center;margin-top:-6px}
.pick3{background:var(--tint)}
.pills{display:flex;gap:4px;background:var(--ghost);border-radius:999px;padding:4px}
.pills button{min-height:36px;padding:0 12px;border:0;border-radius:999px;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}
.pills button[aria-pressed="true"]{background:var(--card);color:var(--ink);box-shadow:var(--lift)}
.cover{transform-origin:50% 50%}
.opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;width:100%;max-width:340px}
.opt{display:grid;gap:4px;font-size:12px;color:var(--muted);min-width:0}
.opt select{min-height:40px;width:100%;padding:0 10px;border:1px solid var(--ghost);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;font-size:14px;font-weight:600}
.optl{display:grid;gap:8px;margin:0;padding:0;list-style:none;font-size:14px}
.optl b{display:block}.optl span{color:var(--muted)}
.ndh{margin:24px 0 0}.flr{display:grid;gap:16px;margin-top:16px}.flc{display:grid;gap:16px;min-width:0}
@media (min-width:700px){.flr{grid-template-columns:1fr 1fr;align-items:start}}
.fl3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 8px}.fl3.fl2{grid-template-columns:repeat(2,1fr)}.fl3 img.st{display:none}@media (prefers-reduced-motion:reduce){.fl3 img.mo{display:none}.fl3 img.st{display:block}}.fl3 figure{margin:0;display:grid;gap:6px}.fl3 img{width:100%;display:block;border-radius:8px}.fl3 figcaption{font-size:12px;color:var(--muted);text-align:center}
.pk{background:var(--card);border-radius:14px;box-shadow:var(--lift);padding:8px 16px}
.pkr{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;font-size:14px}
.pkr b{font-weight:600}.pkr span{display:inline-flex;align-items:center;gap:6px;color:var(--muted)}.pkr.on span{color:var(--terra);font-weight:600}
.pkr svg,.pkm svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.pkm{list-style:none;margin:0 0 8px;padding:4px;border-radius:14px;background:var(--page);display:grid}
.pkm li{display:flex;align-items:center;gap:12px;min-height:48px;padding:4px 8px;border-radius:8px;font-size:14px;font-weight:600}
.pkm li.sel{background:var(--tint)}.pkm img{width:40px;height:40px;border-radius:8px;object-fit:cover;flex:none}.pkm svg{margin-left:auto;color:var(--terra)}
"""
JS = open(os.path.dirname(__file__) + "/reveals_r3.js").read()
def js(name): return open(R4 + name).read()
def tile(n, k): return '<button class="tile" type="button" data-r="%s" aria-pressed="false"><img alt="" src="%s"><span>%s</span></button>' % (k, thumb(k), n)
# the gift box's floor: the same box on three floors, and the picker (a dropdown, as every set of choices is) with a swatch per floor
AROUND = [("flowers", "Flowers"), ("petals", "Rose petals"), ("pearls", "Pearls"), ("diamonds", "Diamonds"), ("confetti", "Confetti"), ("balloons", "Balloons"), ("stars", "Gold stars"), ("none", "Nothing")]
def flimg(k, t="0"): return Image.open(R4 + "ar/%s_%s.png" % (k, t)).crop((0, 0, 300, 520))
def swatch(k): return uri(flimg(k).crop((0, 396, 104, 500)).resize((80, 80), Image.LANCZOS), 80)
CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'; CHEVUP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>'; TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
LINING = [("lame", "Gold lamé"), ("ivory", "Ivory satin"), ("blush", "Blush silk"), ("navy", "Navy velvet"), ("sage", "Sage linen"), ("card", "Plain card")]
def lnimg(k): return Image.open(R4 + "ln/%s.png" % k).crop((0, 0, 300, 520))
def fig(im, n): return '<figure><img alt="" src="%s"><figcaption>%s</figcaption></figure>' % (uri(im.resize((240, 416), Image.LANCZOS), 78), n)
floors = ('<div class="flr"><div class="flc"><section class="card"><div class="fl3" role="img" aria-label="The open gift box with three linings">%s</div></section>'
          '<section class="card"><div class="fl3" role="img" aria-label="The same gift box with six arrangements around it">%s</div></section></div>'
          '<div class="pk" role="img" aria-label="The gift box settings, with the Lining menu open">%s<div class="pkr on"><b>Lining</b><span>Gold lamé %s</span></div><ul class="pkm">%s</ul></div></div>') % (
    "".join(fig(lnimg(k), n) for k, n in (LINING[2], LINING[3], LINING[4])),
    "".join(fig(flimg(k), n) for k, n in (AROUND[0], AROUND[2], AROUND[3], AROUND[4], AROUND[5], AROUND[6])),
    "".join('<div class="pkr"><b>%s</b><span>%s %s</span></div>' % (a, b, CHEV) for a, b in [("Wrap colour", "Emerald"), ("Wrap print", "Your monogram"), ("Ribbon", "Champagne"), ("Bow", "Classic bow"), ("Floor", "Evening linen"), ("Around the box", "Flowers")]), CHEVUP,
    "".join('<li%s><img alt="" src="%s"><span>%s</span>%s</li>' % (' class="sel"' if i == 0 else "", uri(lnimg(k).crop((24, 36, 104, 116)), 80), n, TICK if i == 0 else "") for i, (k, n) in enumerate(LINING)))
# ── more designs (23 Nov): flap shapes, gatefold panels, fabrics. Frames carry a name only. ──
def ndimg(n): return Image.open(R4 + "nd/%s.png" % n).crop((0, 0, 300, 520))
def stimg(n): return Image.open(R4 + "st/%s.png" % n).crop((0, 0, 300, 520))
def sw(im, box): return uri(im.crop(box).resize((80, 80), Image.LANCZOS), 80)
def picker(label, rows, open_key, items):
    out = ""
    for a, b in rows:
        if a == open_key: out += '<div class="pkr on"><b>%s</b><span>%s %s</span></div><ul class="pkm">%s</ul>' % (a, b, CHEVUP, "".join('<li%s><img alt="" src="%s"><span>%s</span>%s</li>' % (' class="sel"' if i == 0 else "", u, n, TICK if i == 0 else "") for i, (n, u) in enumerate(items)))
        else: out += '<div class="pkr"><b>%s</b><span>%s %s</span></div>' % (a, b, CHEV)
    return '<div class="pk" role="img" aria-label="%s">%s</div>' % (label, out)
def block(title, figs, pk): return '<h3 class="ndh">%s</h3><div class="flr"><section class="card"><div class="fl3" role="img" aria-label="%s">%s</div></section>%s</div>' % (title, title, figs, pk)
ENVF = [("scallop", "Scalloped"), ("deepv", "Deep V"), ("euro", "Pointed Euro"), ("round", "Rounded"), ("square", "Square"), ("double", "Double scallop"), ("deckle", "Deckle edge")]
GFD = [("Sculpted lilies", stimg("gatefold_1")), ("Damask", ndimg("gf_damask")), ("Plain with border", ndimg("gf_plain")), ("Art deco", ndimg("gf_deco")), ("Botanical line", ndimg("gf_botanical")), ("Lace", ndimg("gf_lace")), ("Geometric", ndimg("gf_geo")), ("Monogram field", ndimg("gf_monogram")), ("Pressed florals", ndimg("gf_pressed"))]
FABD = [("Plain satin", stimg("fabric_1")), ("Damask jacquard", ndimg("fab_jacquard")), ("Raw mulberry silk", ndimg("fab_mulberry")), ("Chiffon", ndimg("fab_chiffon")), ("Velvet", ndimg("fab_velvet")), ("Linen", ndimg("fab_linen")), ("Organza", ndimg("fab_organza")), ("Tulle", ndimg("fab_tulle")), ("Lace", ndimg("fab_lace"))]
moredesigns = "".join([
  block("Envelope · classic", "".join(fig(ndimg("env_" + k), n) for k, n in ENVF),
        picker("The classic envelope's settings, with the Flap shape menu open", [("Flap shape", "Scalloped"), ("Flap design", "Damask"), ("Paper colour", "Ivory"), ("Seal", "Gold")], "Flap shape", [(n, sw(ndimg("env_" + k), (50, 130, 250, 330))) for k, n in ENVF])),
  block("Envelope · gatefold", "".join(fig(im, n) for n, im in GFD[3:]) + fig(ndimg("gfr_deco"), "Art deco, with ribbon") + fig(ndimg("gfr_botanical"), "Botanical line, with ribbon"),
        picker("The gatefold envelope's settings, with the Panel design menu open", [("Closed with", "Wax seal"), ("Panel design", "Sculpted lilies"), ("Paper colour", "Ivory"), ("Ribbon", "Blush"), ("Seal", "Gold")], "Panel design", [(n, sw(im, (10, 250, 150, 390))) for n, im in GFD])),
  block("Fabric", "".join(fig(im, n) for n, im in FABD[3:]),
        picker("The fabric's settings, with the Fabric menu open", [("Fabric", "Plain satin"), ("Colour", "Champagne")], "Fabric", [(n, sw(im, (150, 40, 290, 180))) for n, im in FABD])),
])
# ── the gift box block, version 25: motion clips, the nine floors, the linings, the arrangements ──
def b64(path, mime): return "data:%s;base64,%s" % (mime, base64.b64encode(open(path, "rb").read()).decode())
def clip(n, name): return '<figure><img class="mo" alt="" src="%s"><img class="st" alt="" src="%s"><figcaption>%s</figcaption></figure>' % (b64(R4 + "v25/%s.webp" % n, "image/webp"), b64(R4 + "v25/%s_still.jpg" % n, "image/jpeg"), name)
FLOORS9 = [("evening", "Evening linen"), ("wood", "Warm wood"), ("marble", "Marble"), ("linen", "Ivory linen"), ("petals", "Stone"), ("sand", "Sand"), ("clouds", "Cotton clouds"), ("cotton", "Egyptian cotton"), ("clouds_ivory", "Ivory clouds")]
def f9(k): return Image.open(R4 + "fl/%s_0.png" % k).crop((0, 0, 300, 520))
GROWS = [("Wrap colour", "Emerald"), ("Wrap print", "Your monogram"), ("Ribbon", "Champagne"), ("Bow", "Classic bow"), ("Floor", "Evening linen"), ("Around the box", "Flowers"), ("Lining", "Gold lamé")]
floors = ('<div class="flr"><div class="flc">'
          '<section class="card"><div class="fl3 fl2" role="img" aria-label="The gift box in motion: the breeze, the sparkle and the opening">%s</div></section>'
          '<section class="card"><div class="fl3" role="img" aria-label="The gift box on the three cotton floors">%s</div></section>'
          '<section class="card"><div class="fl3" role="img" aria-label="The open gift box with three linings">%s</div></section>'
          '<section class="card"><div class="fl3" role="img" aria-label="The same gift box with six arrangements around it">%s</div></section></div>'
          '<div class="flc">%s%s</div></div>') % (
    clip("c_flowers", "Breeze") + clip("c_diamonds", "Diamonds") + clip("c_stars", "Gold stars") + clip("c_open", "Opening"),
    "".join(fig(f9(k), n) for k, n in FLOORS9[6:]),
    "".join(fig(lnimg(k), n) for k, n in (LINING[2], LINING[3], LINING[4])),
    "".join(fig(flimg(k), n) for k, n in (AROUND[0], AROUND[2], AROUND[3], AROUND[4], AROUND[5], AROUND[6])),
    picker("The gift box settings, with the Floor menu open", GROWS, "Floor", [(n, sw(f9(k), (36, 424, 126, 514))) for k, n in FLOORS9]),
    picker("The gift box settings, with the Lining menu open", GROWS, "Lining", [(n, uri(lnimg(k).crop((24, 36, 104, 116)), 80)) for k, n in LINING]))
gateclip = '<h3 class="ndh">Envelope · gatefold, ribbon in the breeze</h3><div class="flr"><section class="card"><div class="fl3 fl2" role="img" aria-label="The gatefold ribbon tails moving in the breeze">%s</div></section></div>' % clip("c_gate", "Ribbon tails")
moredesigns = moredesigns + gateclip
shelf = "".join(tile(n, k) for n, k, *_ in RV) + '<span class="sep"></span>' + "".join(tile(n, k) for n, k, *_ in NEW)
def card(i, row, cls=""):
    n, k, c, hint, drag, moves, built = row
    hold = ('<div class="fr three" role="img" aria-label="%s held, let go, settled">%s</div><div class="cap3"><span>held</span><span>let go</span><span>settled</span></div>' % (n, strip(k, ["h1", "h2", "h3"]))) if k in ("veil", "curtains", "fabric") else ""
    return ('<article class="card rv %s"><div class="rvh"><span class="no">%s</span><h3>%s</h3></div><div class="fr" role="img" aria-label="Four moments of %s, closed to open">%s</div>%s'
            '<p>%s</p><dl><div><dt>You do</dt><dd>%s</dd></div><div><dt>Status</dt><dd>%s</dd></div></dl></article>') % (cls, i, n, n, strip(k, ["1", "2", "3", "4"]), hold, moves, hint, built)
cards = "".join(card(i + 1, r) for i, r in enumerate(RV))
newcards = "".join(card("+", r, "pick3") for i, r in enumerate(NEW))
meta = {k: {"name": n, "cover": "coverCale", "hint": hint, "drag": drag, "zoom": k in ("envelope", "gatefold")} for n, k, c, hint, drag, *_ in RV + NEW}

BODY = """<title>Ten reveals, made real</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;1,500&display=swap">
<style>@@css@@</style>
<header class="band"><div class="wrap">
  <p class="ctx">Drawing for the owner · 23 Nov 2026 · round 3</p>
  <h1>Reveals, at the veil’s pace</h1>
  <p class="lead">Every reveal now follows the rules of your veil: how it answers the finger, how slowly it starts, how softly it lands. Marble and burning paper are retired. Petals and Fireworks take their places, as you picked. The gift box was held back; it is redrawn here for your eye, last on the shelf. These are the nine.</p>
</div></header>
<main class="wrap">
  <section class="card stage" aria-label="Live reveal">
    <div class="shelf" id="shelf">@@shelf@@</div>
    <div class="phone" id="ph">
      <div class="cover" id="cover"></div>
      <canvas id="cv" aria-label="The reveal. Tap to open."></canvas>
    </div>
    <div class="pills" id="speed" role="group" aria-label="How slowly it opens"><button type="button" data-s="9">Slow · 9 s</button><button type="button" data-s="12" aria-pressed="true">Slower · 12 s</button><button type="button" data-s="16">Slowest · 16 s</button></div>
    <div class="opts" id="opts" aria-label="This reveal’s own options" hidden></div>
    <p class="state" id="state" aria-live="polite">Loading the live version…</p>
    <div class="acts"><button class="btn main" id="go" type="button" disabled>Open it</button></div>
    <p class="fallback" id="fallback" hidden>This viewer cannot run the live version. The frames below show the same reveals, moment by moment.</p>
    <noscript><p class="fallback">This viewer does not run scripts, so the live version is off. The frames below show the same reveals, moment by moment.</p></noscript>
  </section>

  <h2>Every reveal has its own options</h2>
  <p class="note">You asked that each one can be customised from a set of styles. Pick a reveal above; its options are the dropdowns under the phone. A change shows at once. These are the first sets: say what to add or drop.</p>
  <section class="card"><ul class="optl">
    <li><b>Veil</b><span>Logo pattern: small (now the default), tiny, large, none. Bottom edge: plain, lace scallops, embroidered vine, pearl beads.</span></li>
    <li><b>Beach curtains</b><span>Fabric: sheer voile, linen, lace, striped gauze. Colour: ivory, white, blush, sand, sage.</span></li>
    <li><b>Fabric</b><span>Fabric: plain satin, damask jacquard, raw mulberry silk, chiffon, velvet, linen, organza, tulle, lace. Colour: champagne, ivory, blush, mulberry, emerald, midnight.</span></li>
    <li><b>Scratch</b><span>Foil colour: gold, silver, rose gold, emerald, midnight.</span></li>
    <li><b>Smoke</b><span>Smoke colour: white, blush, gold, twilight.</span></li>
    <li><b>Petals</b><span>Petal: rose, sampaguita, cherry blossom. Two colours of your choice from eight; the petals are those two and the shades between.</span></li>
    <li><b>Fireworks</b><span>Colours: gold, rose gold, silver white, or gold with pink and blue. Burst: round, willow, rings, hearts.</span></li>
    <li><b>Envelope · classic</b><span>Flap shape: scalloped, deep V, pointed Euro, rounded, square, double scallop, deckle edge. Flap design: damask, lilies, plain with a gold edge. Paper colour: ivory, blush, sage, dusty blue, burgundy, navy. Seal: gold, rose gold, silver, burgundy wax, sage wax. The foil edge follows the seal.</span></li>
    <li><b>Envelope · gatefold</b><span>Closed with: a wax seal, or a ribbon and bow (never both). Panel design: sculpted lilies, damask, plain with a border, art deco, botanical line, lace, geometric, monogram field, pressed florals. The same six paper colours and five seals. Ribbon: blush, ivory, sage, dusty blue, burgundy, gold.</span></li>
    <li><b>Gift box (still held)</b><span>Wrap colour: emerald, ivory, blush, navy, burgundy, kraft. Wrap print: your monogram, gold dots, gold stripes, plain. Ribbon: six colours. Bow: classic or double. Floor: evening linen, warm wood, marble, ivory linen, stone, sand, cotton clouds, Egyptian cotton, ivory clouds. Around the box: flowers, rose petals, pearls, diamonds, confetti, balloons, gold stars, or nothing. Lining: gold lamé, ivory satin, blush silk, navy velvet, sage linen, plain card.</span></li>
    <li><b>Cathedral doors</b><span>Doors: carved wood, midnight blue, gold leaf. Flowers: white, blush, peach, lilac. New in the hall for everyone: pillar candles along the aisle, mirrored in the floor, and petals drifting down.</span></li>
  </ul></section>

  <h2>The veil’s motion rules</h2>
  <p class="note">Read from the shipped veil (the cloth solver, the reveal loop and the owner-locked numbers). Every reveal on this page uses these, from one shared rules file. None has timing of its own.</p>
  <section class="card"><ol class="rules">
    <li><span class="no">1</span><div><b>A tap opens it by itself, very slowly.</b><span>12 seconds here; your live veil takes 5. Try 9, 12 or 16 with the buttons under the phone. It starts at once and keeps an even, unhurried pace, as in your videos.</span></div></li>
    <li><span class="no">2</span><div><b>Nothing snaps.</b><span>Each frame the motion closes 5% of the distance left. So it starts slowly and lands softly, never at a stop.</span></div></li>
    <li><span class="no">3</span><div><b>It follows the finger.</b><span>Touch the cloth and the threads under your finger gather to it and come toward you. Move, and they move with you.</span></div></li>
    <li><span class="no">4</span><div><b>Let go, and it falls back on its own.</b><span>No animation is played. The cloth swings back by its weight, overshoots a little, and settles.</span></div></li>
    <li><span class="no">5</span><div><b>A quick swipe the way it opens throws it open.</b><span>Over 40 px in under half a second. The other way closes it again.</span></div></li>
    <li><span class="no">6</span><div><b>Heavy, well damped.</b><span>Each frame keeps about 98% of its speed, so a swing dies in two or three passes, not ten.</span></div></li>
    <li><span class="no">7</span><div><b>Cloth folds, it does not stretch.</b><span>It gives easily when pushed together, so folds form, and stops firmly at 1.2% longer than its length.</span></div></li>
    <li><span class="no">8</span><div><b>It gets lighter as it opens.</b><span>While lifting, the veil loses most of its weight, so it floats up instead of being yanked.</span></div></li>
    <li><span class="no">9</span><div><b>A breath of wind, more at the hem.</b><span>The top is still. The sway grows toward the free edge.</span></div></li>
    <li><span class="no">10</span><div><b>Light and shadow move with it.</b><span>Cloth turns whiter and more solid where it folds away from you. Solid things throw a soft moving shadow on the cover.</span></div></li>
    <li><span class="no">11</span><div><b>The view moves in, slowly.</b><span>While it opens, the camera travels toward the reveal and on past it, so you arrive at the cover.</span></div></li>
    <li><span class="no">12</span><div><b>The cover shows only at the very end.</b><span>“Open” is called at 98.5% of the motion. Then the reveal fades and the cover is plain.</span></div></li>
  </ol></section>

  <h2>The nine, with the envelope in two styles</h2>
  <p class="note">Four frames each, taken from the live version: closed, then about 4.5, 7 and 10 seconds after the tap, at the 12-second speed. Cloth ones also show held, let go, settled.</p>
  <div class="grid">@@cards@@</div>

  <h2>More designs to choose from</h2>
  @@moredesigns@@

  <h2>Held, and redrawn: the gift box</h2>
  <p class="note">You said it still needed work, so it is not one of the nine. This is the redraw. Frames: closed, then about 4, 7 and 9.5 seconds after the tap, at the 12-second speed.</p>
  <div class="grid">@@newcards@@</div>
  @@floors@@
  <section class="card"><ul>
    <li><b>What changed:</b> it is a box with a lid, seen from above and in front. Before it was two flat sheets.</li>
    <li><b>Paper:</b> fibre in the stock, gold foil that catches the light, the folded end and mitred corners.</li>
    <li><b>Ribbon:</b> lies on the lid and down the sides, and slides off over the edges when drawn.</li>
    <li><b>Second pass:</b> the ribbon stays flat as it leaves (no thin spikes), and the lid starts sooner and opens more slowly.</li>
    <li><b>Third pass, 23 Nov:</b> the set is dark with one pool of warm light, so the glow from inside the box does the reveal. The bow is a full tied bow with loops that lie face up. The paper is deeper and less shiny. The table cloth is finer.</li>
    <li><b>Fourth pass, 23 Nov:</b> the box is solid to the ribbon. No part of the ribbon can enter a face of the box or pass under it; it lies on the outside and slides off onto the floor. The floor is now your choice, from six.</li>
    <li><b>Fifth pass, 23 Nov:</b> the ribbon no longer pulls out. It is four lengths from the knot, wrapped tight to the box down to the ground; they open outward and come to rest on the ground. The box has a soft shadow under it. The ground carries an arrangement of your choice, for a wedding or any other event.</li>\n    <li><b>Sixth pass, 23 Nov:</b> the cloth inside the box is your choice too, from six. It lines the bed the card lies in and the inside walls. The light from inside is kept on every one.</li>\n    <li><b>Seventh pass, 23 Nov:</b> a soft breeze moves the flowers, the petals and every loose ribbon, as cloth moves. Diamonds and gold stars sparkle, a few at a time, as a light travels across; pearls take a moving sheen. The light is a key, a soft fill and a rim; the ground is softer toward the edges of the picture; the glow from inside falls on the lid and the ground. Three cotton floors are added. With reduced motion switched on, everything holds still.</li>\n    <li><b>Still short:</b> the diamonds and the balloons are the weakest of the seven. I have no video of a gift box from you to hold it against, and I checked stills, not the motion.</li>
  </ul></section>

  <h2>Doors: the finish pass</h2>
  <section class="card"><ul>
    <li><b>Floor:</b> polished marble that mirrors the hall. Every chandelier and every flower has its true reflection, and it moves correctly as you glide.</li>
    <li><b>Flowers:</b> separate round arrangements along the aisle and tall ones on gold stands, at their real size, each standing in its own shadow. Before they were one stretched strip.</li>
    <li><b>Edges:</b> the flowers are photographs cut out with a soft edge. The hard, jagged outline is gone.</li>
    <li><b>Hall:</b> wider, with pilastered walls, so the arches are grand and far and near things stream past.</li>
    <li><b>Added after your note that they must beat the video:</b> candles along the aisle with their reflections, petals drifting down, three door finishes and four flower colours.</li>
    <li><b>Still short:</b> the reflection is sharp, not softly blurred as on real marble; flowers do not cast dappled shadows across the floor; the door finishes are the same carved doors repainted, not new carvings.</li>
  </ul></section>

  <h2>Your logo, on every reveal</h2>
  <section class="card"><ul>
    <li><b>Veil and curtains:</b> woven into the cloth as a repeat.</li>
    <li><b>Envelopes:</b> pressed into the wax seal.</li>
    <li><b>Fabric:</b> embroidered large on the satin. <b>Scratch:</b> stamped into the foil. <b>Smoke:</b> hanging in the fog.</li>
    <li>Here it is the cale-ice monogram. In the app it is whatever logo the event has.</li>
  </ul></section>

  <h2>Kept from the locked rules</h2>
  <section class="card"><ul>
    <li>One tap or swipe opens any reveal. Scratch is the one exception: 60%.</li>
    <li>The reveal comes first, nothing behind it plays, and opening it starts the music.</li>
    <li>Event Pro and up. Once per visit. It opens itself after 12 seconds. Reduce motion skips it.</li>
  </ul></section>

  <h2>What this removes</h2>
  <section class="card"><ul>
    <li>Golden marble and Burning paper. Retired. Capiz window and Abaniko were not picked.</li>
    <li>The flat gift box, and the bright daylight table of the first rebuild. Replaced by the redraw shown above, which waits for your word.</li>
    <li>The round 2 veil look-alike. The veil here is the shipped one.</li>
    <li>Round 2’s fast timings, the ribbon on the fabric, the rising smoke, the doors that stopped at the doorway.</li>
  </ul></section>

  <h2>What I could not check</h2>
  <section class="card"><ul>
    <li>A real phone. Everything was run at phone size (300 by 520) in a desktop browser with a software graphics chip.</li>
    <li>Real fingers. Tap, swipe and pinch were driven by script.</li>
    <li>The veil’s exact tone. Its cloth, timing and touch are the shipped code; its sheerness was matched by eye to a capture of the live cale-ice page.</li>
    <li>The veil’s logo marks and petals are not drawn here.</li>
    <li>The veil lifting from the tapped point is new. It is not in the live app yet.</li>
    <li>Your videos were used for motion, light and pace only. None of their art, names or words is in this drawing.</li>
  </ul></section>

  <h2>Needs your decision</h2>
  <section class="card"><p class="ask">Which speed is the one you mean: 9, 12 or 16 seconds?</p><p class="note">Try the three buttons under the phone. I could not see your videos, so this is how you can show me the speed.</p></section>
  <p class="foot">The cover is your own cale-ice cover, and the seals carry its monogram. Other art is sample art. The live version loads three.js, which the app already ships and loads only when a reveal shows.</p>
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>@@tex@@</script>
<script>@@old@@</script>
<script>@@core@@</script>
<script>@@oldcloth@@</script>
<script>@@rigid@@</script>
<script>@@fx@@</script>
<script>@@drape@@</script>
<script>@@round3@@</script>
<script>var RV_META=@@meta@@;
@@js@@</script>
"""
for k, v in dict(css=CSS, shelf=shelf, cards=cards, newcards=newcards, floors=floors, moredesigns=moredesigns, tex=js("tex.js"), old=js("old.js"), core=js("core4.js"), oldcloth=js("oldcloth.js"), rigid=js("rigid.js"), fx=js("fx.js"), drape=js("drape.js"), round3=js("aisle.js") + js("ribbon.js") + js("round3.js") + js("env2.js") + js("gift3.js"), meta=json.dumps(meta), js=JS).items():
    BODY = BODY.replace("@@" + k + "@@", v)
open(OUT + "artifact.html", "w").write(BODY)
def doc(attr): return '<!doctype html><html' + attr + '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + BODY + "</body></html>"
open(OUT + "index.html", "w").write(doc("")); open(OUT + "_dark.html", "w").write(doc(' data-theme="dark"'))
print(len(BODY) // 1024, "KB")

for nm, attr, floors in (("_floors", "", floors), ("_floors_dark", ' data-theme="dark"', floors), ("_nd", "", moredesigns), ("_nd_dark", ' data-theme="dark"', moredesigns)):
    open(OUT + nm + ".html", "w").write('<!doctype html><html' + attr + '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap"><style>' + CSS + '</style></head><body><main class="wrap">' + floors + '</main></body></html>')
