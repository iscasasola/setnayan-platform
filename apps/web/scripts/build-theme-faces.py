#!/usr/bin/env python3
"""build-theme-faces.py — the ten Event Hub theme faces, from google/fonts, into app/_fonts.

WHY: every Event Hub theme in lib/invite-themes.ts names four faces. Ten of them
were not in the repo and were shown through a stand-in face (PR #6323). The owner
asked on 2026-10-04: "Can you add them for me?" This script downloads them from
the ONE source we accept, the official Google Fonts repository
(github.com/google/fonts, `ofl/<family>/`), pinned to a commit, with curl.
app/_fonts/choice-faces.ts loads the results with preload:false, so a face
downloads only on a page whose theme sets text in it.

⛔ RESERVED FONT NAMES DECIDE WHAT WE MAY DO TO A FILE. A face whose licence
(its OFL.txt, or its own name table) reserves its name may NOT be subset or
instanced and keep that name (OFL §3; OFL-FAQ 2.6: "subsetting … is considered
modification"). WOFF2 compression of the UNCHANGED font data is allowed
(OFL-FAQ 2.2.1). So:

  · RFN faces (8 of 10) → the upstream file, WOFF2-compressed and nothing else:
    every glyph, every table, every weight of a variable font. The script proves
    it by decompressing the result and comparing every table with the source.
    Bigger than a subset; paid only by a guest whose theme uses the face.
  · Faces with NO reserved name (Crimson Pro, Alex Brush) → the same latin range
    scripts/subset-shipped-fonts.py cuts (plus the peso sign), as .woff2; a
    variable source is instanced to the weights first (that script refuses fvar).

Each family's upstream OFL.txt is committed beside its files, unchanged.

Needs fontTools + brotli in a throwaway venv (never global):
    python3 -m venv /tmp/fonts-venv && /tmp/fonts-venv/bin/pip install fonttools brotli
    /tmp/fonts-venv/bin/python scripts/build-theme-faces.py      # from apps/web
"""
import io
import os
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont, woff2
from fontTools.varLib import instancer

GOOGLE_FONTS_SHA = '9710da1eacb3be272583c3224dcb70f9da6eadbb'  # google/fonts main, 2026-10-04
RAW = f'https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_SHA}/ofl'

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(WEB, 'app', '_fonts')
# The same range as scripts/subset-shipped-fonts.py — Google's `latin` block plus ₱.
LATIN = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,'
         'U+0329,U+2000-206F,U+20AC,U+20B1,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')

# (google/fonts dir, our dir, [(upstream file, our file, static weight or None)])
# A `None` weight keeps the file whole (RFN: a variable font stays variable).
JOBS = [
    ('lora', 'lora', [('Lora[wght].ttf', 'lora-variable.woff2', None),
                      ('Lora-Italic[wght].ttf', 'lora-variable-italic.woff2', None)]),
    ('librebaskerville', 'libre-baskerville', [
        ('LibreBaskerville[wght].ttf', 'libre-baskerville-variable.woff2', None),
        ('LibreBaskerville-Italic[wght].ttf', 'libre-baskerville-variable-italic.woff2', None)]),
    ('crimsonpro', 'crimson-pro', [('CrimsonPro[wght].ttf', 'crimson-pro-400.woff2', 400),
                                   ('CrimsonPro-Italic[wght].ttf', 'crimson-pro-400-italic.woff2', 400),
                                   ('CrimsonPro[wght].ttf', 'crimson-pro-700.woff2', 700)]),
    ('josefinsans', 'josefin-sans', [('JosefinSans[wght].ttf', 'josefin-sans-variable.woff2', None)]),
    ('kaushanscript', 'kaushan-script', [('KaushanScript-Regular.ttf', 'kaushan-script-400.woff2', None)]),
    ('alexbrush', 'alex-brush', [('AlexBrush-Regular.ttf', 'alex-brush-400.woff2', 400)]),
    ('parisienne', 'parisienne', [('Parisienne-Regular.ttf', 'parisienne-400.woff2', None)]),
    ('cookie', 'cookie', [('Cookie-Regular.ttf', 'cookie-400.woff2', None)]),
    ('mrssaintdelafield', 'mrs-saint-delafield', [
        ('MrsSaintDelafield-Regular.ttf', 'mrs-saint-delafield-400.woff2', None)]),
    ('monoton', 'monoton', [('Monoton-Regular.ttf', 'monoton-400.woff2', None)]),
]


def fetch(gf_dir: str, name: str) -> bytes:
    url = f'{RAW}/{gf_dir}/{name.replace("[", "%5B").replace("]", "%5D")}'
    data = subprocess.run(['curl', '-fsSL', url], check=True, capture_output=True).stdout
    if len(data) < 1000:
        raise SystemExit(f'{url}: suspiciously small ({len(data)} B)')
    return data


def reserved(ofl: str, font: TTFont) -> bool:
    notice = (font['name'].getDebugName(0) or '') + (font['name'].getDebugName(13) or '')
    head = ofl[: ofl.index('This Font Software is licensed')]
    return 'Reserved' in notice or 'Reserved' in head


def same_font(src: bytes, out_path: str) -> None:
    """The WOFF2 decompresses to the source's tables — nothing but compression happened."""
    a = TTFont(io.BytesIO(src), recalcBBoxes=False, recalcTimestamp=False)
    b = TTFont(out_path, recalcBBoxes=False, recalcTimestamp=False)
    # A digital signature cannot survive any re-packaging, so the WOFF2 encoder drops
    # `DSIG` (W3C WOFF2 §5.1); every other table must come through.
    if sorted(t for t in a.keys() if t != 'DSIG') != sorted(b.keys()):
        raise SystemExit(f'{out_path}: table set changed')
    for tag in a.keys():
        if tag in ('GlyphOrder', 'loca', 'head', 'DSIG'):
            continue
        if tag == 'glyf':
            for g in a.getGlyphOrder():
                if a['glyf'][g].compile(a['glyf']) != b['glyf'][g].compile(b['glyf']):
                    raise SystemExit(f'{out_path}: glyph {g} changed')
        elif a.reader[tag] != b.reader[tag]:
            raise SystemExit(f'{out_path}: table {tag} changed')
    # `head` differs only in the WOFF2 flag bit 11 ("font data has been losslessly transformed").
    ha, hb = a['head'], b['head']
    for f in ('fontRevision', 'checkSumAdjustment', 'magicNumber', 'unitsPerEm', 'created', 'modified',
              'xMin', 'yMin', 'xMax', 'yMax', 'macStyle', 'indexToLocFormat'):
        if f != 'checkSumAdjustment' and getattr(ha, f) != getattr(hb, f):
            raise SystemExit(f'{out_path}: head.{f} changed')


def main() -> int:
    for gf_dir, our_dir, files in JOBS:
        ofl = fetch(gf_dir, 'OFL.txt').decode('utf8')
        os.makedirs(os.path.join(OUT, our_dir), exist_ok=True)
        with open(os.path.join(OUT, our_dir, 'OFL.txt'), 'w', encoding='utf8') as fh:
            fh.write(ofl)
        for src_name, name, weight in files:
            src = fetch(gf_dir, src_name)
            font = TTFont(io.BytesIO(src))
            out_path = os.path.join(OUT, our_dir, name)
            if reserved(ofl, font):
                if weight is not None:
                    print(f'refusing {src_name}: a Reserved Font Name may not be instanced or subset', file=sys.stderr)
                    return 1
                woff2.compress(io.BytesIO(src), out_path)
                same_font(src, out_path)
                how = 'whole (RFN)'
            else:
                if weight is None:
                    print(f'refusing {src_name}: no RFN, so cut it like every other subset', file=sys.stderr)
                    return 1
                if 'fvar' in font:
                    font = instancer.instantiateVariableFont(font, {'wght': weight}, updateFontNames=False)
                    font['OS/2'].usWeightClass = weight
                opts = subset.Options()
                opts.flavor = 'woff2'
                opts.layout_features = ['*']
                opts.name_IDs = ['*']
                opts.name_languages = ['*']
                opts.notdef_outline = True
                subsetter = subset.Subsetter(options=opts)
                subsetter.populate(unicodes=subset.parse_unicodes(LATIN))
                subsetter.subset(font)
                subset.save_font(font, out_path, opts)
                how = f'latin subset @{weight}'
            print(f'{len(src):>8} -> {os.path.getsize(out_path):>7}  app/_fonts/{our_dir}/{name}  {how}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
