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
"""
import os
import shutil
from fontTools.ttLib import TTFont
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

# Basic Latin · Latin-1 · Latin Extended-A/B · Latin Extended Additional ·
# general punctuation · currency.
LATIN = [*range(0x20, 0x7F), *range(0xA0, 0x250), *range(0x1E00, 0x1F00), *range(0x2000, 0x2070), *range(0x20A0, 0x20D0)]

os.makedirs(OUT, exist_ok=True)
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
