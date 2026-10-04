#!/usr/bin/env python3
"""
Build the Logo editor's OUTLINE faces — one TrueType file per Event Hub font
(`lib/hub-fonts.ts` HUB_FONTS) that the app does not already serve as a .ttf.

WHY: the Logo editor turns a text layer into paths in the browser with
opentype.js, which cannot read WOFF2 (it needs an external Brotli + glyf
decoder). The stage fonts ship as WOFF2 under apps/web/app/_fonts/, so each
one is decoded here, ONCE, from the very file the stages load — the same face
at the same weight — and pinned to that weight when the file is a variable
font (a variable font's outlines are its DEFAULT instance, which for
Cormorant is 300 and for Fraunces 900, not the 400 the stage draws).

Run from the repo root (needs python3 + fontTools + brotli):
    python3 scripts/make-logo-outline-fonts.py
`lib/logo-fonts.test.ts` fails when a stage font has no outline file.
All faces are SIL OFL 1.1 (see apps/web/public/logo-fonts/LICENSES.md).

⛔ RESERVED FONT NAMES (2026-10-04, the ten theme faces of PR #6332). A face
whose OFL.txt or name table reserves its name may NOT be subset or instanced
and keep that name (OFL §3; OFL-FAQ 2.6) — the rule
apps/web/scripts/build-theme-faces.py follows. So each `WHOLE` face below is the
stage's WOFF2 DECOMPRESSED and nothing else: every glyph, every table, a
variable font left variable (the Logo pins its weight at draw time —
`LOGO_FONT_VARIATION`, lib/logo-fonts.ts). The script refuses to cut an RFN
face, and proves the decompressed file has the source's glyph set.
"""
import io
import os
import shutil
import sys
from fontTools.ttLib import TTFont, woff2
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'apps', 'web')
FONTS = os.path.join(ROOT, 'app', '_fonts')
OUT = os.path.join(ROOT, 'public', 'logo-fonts')

# key -> (source relative to apps/web, weight the stage draws by default)
SOURCES = {
    'cormorant': ('app/_fonts/cormorant-garamond/cormorant-garamond-400.woff2', 400),
    'fraunces': ('app/_fonts/fraunces/fraunces-400.woff2', 400),
    'playfair': ('app/_fonts/playfair-display/playfair-display-400.woff2', 400),
    'caslon': ('app/_fonts/libre-caslon-display/libre-caslon-display-400.woff2', 400),
    'vidaloka': ('app/_fonts/vidaloka/vidaloka-400.woff2', 400),
    'cinzel': ('app/_fonts/cinzel/cinzel-400.woff2', 400),
    'tangerine': ('app/_fonts/tangerine/tangerine-400.woff2', 400),
    'luxurious': ('app/_fonts/luxurious-script/luxurious-script-400.woff2', 400),
    'cormorantsc': ('app/_fonts/cormorant-sc/cormorant-sc-400.woff2', 400),
    'bodoni': ('app/_fonts/bodoni-moda/bodoni-moda-600.woff2', 600),
    'prata': ('app/_fonts/prata/prata-400.woff2', 400),
    'instrument': ('app/_fonts/instrument-serif/instrument-serif-400.woff2', 400),
    'cardo': ('app/_fonts/cardo/cardo-400.woff2', 400),
    'italiana': ('app/_fonts/italiana/italiana-400.woff2', 400),
    'limelight': ('app/_fonts/limelight/limelight-400.woff2', 400),
    'alfaslab': ('app/_fonts/alfa-slab-one/alfa-slab-one-400.woff2', 400),
    'oswald': ('app/_fonts/oswald/oswald-500.woff2', 500),
    'syne': ('app/_fonts/syne/syne-400.woff2', 400),
    'poiret': ('app/_fonts/poiret-one/poiret-one-400.woff2', 400),
    'herrvon': ('assets/cipher-fonts/herr-von-muellerhoff.ttf', 400),
    'haviland': ('assets/cipher-fonts/mr-de-haviland.ttf', 400),
    'manrope': ('app/_fonts/manrope/manrope-400.woff2', 400),
    'hanken': ('app/_fonts/hanken-grotesk/hanken-grotesk-400.woff2', 400),
    'jost': ('app/_fonts/jost/jost-400.woff2', 400),
    'quicksand': ('app/_fonts/quicksand/quicksand-400.woff2', 400),
    'outfit': ('app/_fonts/outfit/outfit-400.woff2', 400),
    'schibsted': ('app/_fonts/schibsted-grotesk/schibsted-grotesk-600.woff2', 600),
    'poppins': ('app/_fonts/poppins/poppins-400.woff2', 400),
}

# The ten theme faces (2026-10-04). key -> (source, weight the stage draws, whole?)
# `whole=True` — a Reserved Font Name: decompressed only, never cut. Crimson Pro
# and Alex Brush reserve nothing; their stage files are already latin cuts.
THEME_FACES = {
    'lora': ('app/_fonts/lora/lora-variable.woff2', 400, True),
    'baskerville': ('app/_fonts/libre-baskerville/libre-baskerville-variable.woff2', 400, True),
    'crimson': ('app/_fonts/crimson-pro/crimson-pro-400.woff2', 400, False),
    'josefin': ('app/_fonts/josefin-sans/josefin-sans-variable.woff2', 400, True),
    'kaushan': ('app/_fonts/kaushan-script/kaushan-script-400.woff2', 400, True),
    'alexbrush': ('app/_fonts/alex-brush/alex-brush-400.woff2', 400, False),
    'parisienne': ('app/_fonts/parisienne/parisienne-400.woff2', 400, True),
    'cookie': ('app/_fonts/cookie/cookie-400.woff2', 400, True),
    'delafield': ('app/_fonts/mrs-saint-delafield/mrs-saint-delafield-400.woff2', 400, True),
    'monoton': ('app/_fonts/monoton/monoton-400.woff2', 400, True),
}


def reserved(src_path: str) -> bool:
    """The family reserves its name — in its OFL.txt or its own name table."""
    ofl = open(os.path.join(os.path.dirname(src_path), 'OFL.txt'), encoding='utf8').read()
    font = TTFont(src_path)
    notice = (font['name'].getDebugName(0) or '') + (font['name'].getDebugName(13) or '')
    return 'Reserved' in notice or 'Reserved' in ofl[: ofl.index('This Font Software is licensed')]


# Basic Latin · Latin-1 · Latin Extended-A/B · Latin Extended Additional ·
# general punctuation · currency.
LATIN = [*range(0x20, 0x7F), *range(0xA0, 0x250), *range(0x1E00, 0x1F00), *range(0x2000, 0x2070), *range(0x20A0, 0x20D0)]

os.makedirs(OUT, exist_ok=True)
for key, (src, weight, whole) in THEME_FACES.items():
    path = os.path.join(ROOT, src)
    dest = os.path.join(OUT, f'{key}.ttf')
    if reserved(path) != whole:
        print(f'refusing {key}: reserved={reserved(path)} but whole={whole}', file=sys.stderr)
        sys.exit(1)
    if whole:
        woff2.decompress(path, dest)
        a, b = TTFont(path), TTFont(dest)
        if a.getGlyphOrder() != b.getGlyphOrder() or sorted(a.keys()) != sorted(b.keys()):
            print(f'{key}: decompression changed the font', file=sys.stderr)
            sys.exit(1)
        print(f'{key:12s} {os.path.getsize(dest):>7d}  <- {src} (whole, RFN)')
        continue
    SOURCES[key] = (src, weight)

for key, (src, weight) in SOURCES.items():
    path = os.path.join(ROOT, src)
    dest = os.path.join(OUT, f'{key}.ttf')
    if src.endswith('.ttf'):
        shutil.copyfile(path, dest)
    else:
        font = TTFont(path)
        if 'fvar' in font:
            axes = {a.axisTag: a for a in font['fvar'].axes}
            pins = {'wght': max(axes['wght'].minValue, min(axes['wght'].maxValue, weight))} if 'wght' in axes else {}
            font = instancer.instantiateVariableFont(font, pins)
        font.flavor = None
        font.save(dest)
    # Latin only (every name this product sets — accents, ñ, the ampersand), no
    # hinting: outlines are identical, and Cormorant SC drops from 740 KB.
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.hinting = False
    opts.notdef_outline = True
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.glyph_names = True
    f = TTFont(dest)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=LATIN)
    sub.subset(f)
    f.save(dest)
    print(f'{key:12s} {os.path.getsize(dest):>7d}  <- {src}')
