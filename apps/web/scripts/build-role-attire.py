"""Build the per-role attire figures (owner 2026-10-16, DECISION_LOG "APPROVED — ALL 45 ROLE × DESIGN DRAWINGS").

Reads the 45 approved drawings (controller-2026-10-12/attire-figures/role-prompts/: 01-groom-v2.png + raw-02…45.png,
each ~1792×2400 on white) and writes, for each, into apps/web/public/attire/roles/:
  <art>.webp          the drawing, cut from its white ground, every recolourable zone neutralised to WHITE with its
                      shading kept (a multiply tint over it is then the couple's exact colour);
  <art>-<zone>.webp   one ALPHA mask per colour zone (approved zones rule, DECISION_LOG "ATTIRE COLOUR ZONES"):
                        a = the garment (coat & pants · jacket · barong · shirt · vest & pants · the gown)
                        t = tie / bow tie (+ pocket square)   s = shirt   v = vest (3-piece)   p = pants
  and prints the TS size + zone table for lib/attire-figures.ts.
Props (bouquet · fan · candle · veil · pillow · box · basket · clutch · boutonnière) are cut out of every zone: they
stay as drawn and are never recoloured. Skin, hair and shoes are never in a zone either.

Run:  python3 apps/web/scripts/build-role-attire.py <role-prompts dir> apps/web/public/attire/roles [preview-dir]
Pure PIL + numpy (no scipy / OpenCV on this Mac). Coordinates below are on the HALF-size drawing (896 × 1200).
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

H = 280  # every figure 280 px tall — twice the Studio's 132 px
T_CUT = 240  # a pixel darker than this (min channel) is ink: the white ground is flooded up to it
T_VEIL = 215  # the veil's own lines are fainter than this; the dress's are not
T_ZONE_INK = 190  # a paint-bucket zone stops at ink darker than this

# ── which drawing is which (verified by eye against the files, 2026-10-16) ──────────────────────────────────────
ART = {
    '01': 'groom-suit', '02': 'best_man-suit', '03': 'groomsman-suit', '04': 'ninong-barong_tagalog',
    '05': 'father-barong_tagalog', '06': 'sponsor_m-barong_tagalog', '07': 'bride-mermaid', '08': 'maid_of_honor-long_gown',
    '09': 'bridesmaid-long_gown', '10': 'ninang-filipiniana', '11': 'mother-filipiniana', '12': 'sponsor_w-long_gown',
    '13': 'ring_bearer-vest_and_bow_tie', '14': 'bible_bearer-barong_tagalog', '15': 'flower_girl-tulle_dress',
    '16': 'guest_m-barong_tagalog', '17': 'guest_w-cocktail_dress', '18': 'groom-three_piece_suit', '19': 'groom-barong_tagalog',
    '20': 'groom-tuxedo', '21': 'best_man-three_piece_suit', '22': 'best_man-barong_tagalog', '23': 'best_man-tuxedo',
    '24': 'groomsman-vest_and_tie', '25': 'groomsman-barong_tagalog', '26': 'ninong-suit', '27': 'father-suit',
    '28': 'sponsor_m-suit', '29': 'bride-ball_gown', '30': 'bride-a_line', '31': 'bride-filipiniana',
    '32': 'maid_of_honor-filipiniana', '33': 'maid_of_honor-cocktail_dress', '34': 'bridesmaid-cocktail_dress',
    '35': 'bridesmaid-filipiniana', '36': 'ninang-long_gown', '37': 'mother-long_gown', '38': 'sponsor_w-filipiniana',
    '39': 'ring_bearer-barong_tagalog', '40': 'bible_bearer-vest_and_bow_tie', '41': 'flower_girl-filipiniana',
    '42': 'guest_m-suit', '43': 'guest_m-smart_casual', '44': 'guest_w-long_gown', '45': 'guest_w-filipiniana',
    # 👔 THE GUESTS' FIVE DESIGNS A STYLE (owner 2026-10-21, "up to 5 different attires"; Higgsfield Nano Banana Pro, the
    # same 1792×2400 as the 45; prompts in shots-2026-10-21/attire-5-designs-proto/PROMPTS.md). Each is written into its
    # style's folder — `<role>-<style>/<variant>` — the registry key of `lib/attire-library.ts`, where its printed width goes.
    '46': 'guest_m-suit/double_breasted', '47': 'guest_m-suit/three_piece', '48': 'guest_m-suit/shawl', '49': 'guest_m-suit/slim',
    '50': 'guest_m-barong_tagalog/polo', '51': 'guest_m-barong_tagalog/jusi', '52': 'guest_m-barong_tagalog/modern', '53': 'guest_m-barong_tagalog/coat',
    '54': 'guest_m-smart_casual/linen', '55': 'guest_m-smart_casual/polo_slacks', '56': 'guest_m-smart_casual/blazer_tee', '57': 'guest_m-smart_casual/cuban',
    '58': 'guest_w-long_gown/aline', '59': 'guest_w-long_gown/wrap', '60': 'guest_w-long_gown/off_shoulder', '61': 'guest_w-long_gown/halter',
    '62': 'guest_w-cocktail_dress/sheath', '63': 'guest_w-cocktail_dress/fit_flare', '64': 'guest_w-cocktail_dress/off_shoulder_midi', '65': 'guest_w-cocktail_dress/slip',
    '66': 'guest_w-filipiniana/terno_gown', '67': 'guest_w-filipiniana/barot_saya', '68': 'guest_w-filipiniana/butterfly_midi', '69': 'guest_w-filipiniana/terno_pantsuit',
}

# ── per drawing: where the head ends, the props, and how each zone is found ─────────────────────────────────────
#   sheer: boxes of a sheer top — an arm seen through it is fabric (only strong skin is skin)
#   head: nothing above this line is ever a zone (hair, earrings, a flower crown)
#   below: nothing below this line is (legs and shoes under a short dress; light shoes)
#   props: [(x0,y0,x1,y1)] — the prop's ink inside the box, its holes filled (petals, a box's white sides)
#   veil:  a box the veil may be in — the veil is what the white ground floods through faint lines inside it
#   tie / bow: boxes where the grey tie (or a white bow tie, `bow_white`) is; `pocket`: pocket-square boxes
#   shirt: 'auto' (beside the tie) and/or seeds; shirt_polys: polygons that are shirt (sleeves, a V)
#   vest: seeds for the 3-piece vest · pants: ('grey', top_y) or ('poly', [...])
SUIT_TIES = {
    '01': (416, 199, 441, 373), '02': (426, 205, 461, 378), '03': (420, 208, 458, 388), '26': (427, 208, 467, 383),
    '27': (410, 214, 450, 393), '28': (429, 212, 469, 322), '42': (415, 188, 453, 373),
}
ANN = {
    '01': dict(shirt_clip=[(398, 196), (452, 196), (446, 290), (432, 368), (420, 368), (410, 290)], head=188, props=[(452, 220, 503, 282)], tie=[SUIT_TIES['01']], shirt='auto'),
    '02': dict(head=188, tie=[SUIT_TIES['02']], pocket=[(489, 265, 541, 295)], shirt='auto'),
    '03': dict(head=188, tie=[SUIT_TIES['03']], shirt='auto'),
    '26': dict(head=188, tie=[SUIT_TIES['26']], shirt='auto'),
    '27': dict(head=188, tie=[SUIT_TIES['27']], shirt='auto'),
    '28': dict(head=188, props=[(423, 300, 472, 482)], tie=[SUIT_TIES['28']], shirt='auto'),
    '42': dict(head=185, tie_poly=[[(424, 210), (441, 210), (446, 250), (444, 330), (433, 384), (422, 330), (420, 250)]], shirt='auto',
               shirt_seeds=[(415, 235), (450, 235), (417, 260), (448, 260), (418, 215), (452, 215)]),
    '18': dict(head=188, props=[(478, 236, 522, 302)], tie=[(422, 206, 465, 330)], shirt='auto',
               vest=[(427, 340), (457, 340), (422, 400), (462, 400), (417, 480), (467, 480)]),
    '21': dict(head=188, tie=[(427, 206, 465, 330)], pocket=[(498, 272, 542, 300)], shirt='auto',
               vest=[(430, 335), (460, 335), (425, 390), (465, 390), (420, 470), (470, 470)]),
    '20': dict(head=188, props=[(482, 256, 532, 324)], tie=[(405, 193, 493, 243)],
               shirt_seeds=[(450, 262), (450, 300), (450, 340), (450, 380), (432, 250), (468, 250)]),
    '23': dict(head=188, tie=[(406, 193, 487, 243)], pocket=[(501, 278, 545, 307)], below=1112,
               shirt_seeds=[(448, 262), (450, 300), (452, 340), (454, 380), (430, 250), (466, 250)]),
    '24': dict(head=185, tie=[(427, 206, 467, 333)], shirt='auto',
               shirt_polys=[[(276, 212), (352, 220), (358, 482), (276, 482)], [(548, 220), (628, 212), (628, 482), (552, 482)]]),
    '13': dict(head=245, props=[(381, 436, 520, 520)], tie=[(413, 258, 491, 297)], bow_white=True,
               shirt_polys=[[(408, 248), (502, 248), (495, 294), (457, 390), (417, 294)],
                            [(282, 278), (364, 284), (370, 545), (282, 545)], [(547, 284), (624, 278), (624, 545), (551, 545)]]),
    '40': dict(head=245, props=[(388, 438, 522, 514)], tie=[(417, 258, 491, 300)], bow_white=True,
               shirt_polys=[[(412, 248), (506, 248), (499, 294), (461, 390), (421, 294)],
                            [(286, 278), (368, 284), (374, 545), (286, 545)], [(549, 284), (626, 278), (626, 545), (553, 545)]]),
    '04': dict(head=188, pants=('grey', 570)),
    '05': dict(head=188, pants=('grey', 570)),
    '06': dict(head=188, props=[(438, 278, 480, 450)], pants=('grey', 575)),
    '14': dict(skin=32, head=225, props=[(383, 448, 517, 522)], pants=('grey', 595)),
    '16': dict(head=185, pants=('poly', [(290, 603), (575, 603), (575, 1135), (290, 1135)])),
    '19': dict(head=180, props=[[(466, 233), (490, 220), (520, 228), (523, 262), (500, 284), (478, 287), (467, 262)]], pants=('grey', 545)),
    '22': dict(head=188, pants=('grey', 570)),
    '25': dict(head=188, pants=('grey', 570)),
    '39': dict(head=258, props=[(383, 446, 517, 528)], pants=('grey', 612)),
    '43': dict(head=185, pants=('poly', [(290, 490), (625, 490), (625, 1110), (290, 1110)])),
    # women & girls — one colour
    '07': dict(head=170, props=[(362, 378, 473, 538)], veil=(0, 90, 896, 1200), veil_keep=[(345, 225, 515, 800)],
               veil_keep_poly=[[(355, 230), (505, 230), (512, 500), (520, 780), (600, 950), (860, 1010), (870, 1100), (800, 1168), (170, 1170), (190, 1050), (330, 800), (345, 500)]]),
    '08': dict(head=180, props=[[(447, 420), (470, 395), (520, 392), (560, 405), (560, 470), (530, 500), (480, 510), (470, 552), (452, 552), (452, 500), (445, 470)]]),
    '09': dict(head=160, props=[(283, 603, 382, 708)]),
    '10': dict(skin=30, head=170, props=[(393, 503, 522, 648)]),
    '11': dict(head=165, sheer=[(285, 185, 605, 335)]),
    '12': dict(head=165, veil=(495, 355, 610, 800)),
    '15': dict(head=200, props=[(232, 398, 408, 632)], below=1098),
    '17': dict(head=185, props=[(448, 532, 582, 625)], below=1052),
    '29': dict(head=150, props=[(473, 333, 622, 492)], veil=(0, 90, 896, 1200), veil_keep=[(320, 220, 560, 450)],
               veil_keep_poly=[[(330, 430), (520, 430), (835, 1100), (835, 1180), (60, 1180), (65, 1080)]]),
    '30': dict(head=160, props=[(488, 348, 637, 522)], veil=(0, 90, 896, 1200), veil_keep=[(360, 225, 560, 420)],
               veil_keep_poly=[[(362, 410), (552, 410), (735, 1080), (740, 1180), (125, 1180), (130, 1080)]]),
    '31': dict(head=170, props=[(262, 392, 408, 558)], veil=(0, 90, 896, 1200)),
    '32': dict(head=165, props=[(278, 398, 402, 558)]),
    '33': dict(head=150, props=[(443, 343, 577, 507)], below=1036),
    '34': dict(head=170, props=[[(445, 430), (470, 393), (530, 386), (567, 410), (562, 470), (530, 497), (500, 502), (470, 527), (438, 522), (455, 480), (445, 455)]], below=1078),
    '35': dict(head=165, props=[(328, 383, 417, 507)]),
    '36': dict(head=160, props=[(378, 333, 602, 492)]),
    '37': dict(head=165),
    '38': dict(head=160, veil=(0, 90, 896, 1200)),
    '41': dict(head=265, props=[(260, 628, 377, 772)], below=1028),
    '44': dict(head=165, props=[(493, 523, 592, 650)]),
    '45': dict(sheer=[(235, 185, 615, 350)], head=170, props=[(313, 508, 387, 632)], below=1110),
}
# 👔 The 24 new guest designs (2026-10-21). New keys, beside the shipped ones:
#   shirt_head: the shirt zone stops at the head line (a champagne shirt meets the neck)
#   never: boxes or polygons that are never a zone (arms drawn pale enough to read as fabric)
#   pants ('khaki', poly): the chinos by their own colour inside the polygon (khaki reads as skin to the garment rule)
#   pants ('none', None): the pants zone is empty — the slacks stay exactly as drawn
#   a_only: the colour zone is only inside this polygon, and the rest of the garment is in NO zone (stays as drawn)
#   a_poly: the garment's colour zone is only inside this polygon; the rest of the garment is pants (a grey coat over the
#           barong wears what the pants wear — it never takes the palette)
_M = dict(head=188, shirt='auto', shirt_head=True)
ANN.update({
    '46': dict(_M, tie=[(415, 198, 455, 322)]),
    '47': dict(_M, tie=[(428, 198, 468, 328)]),
    '48': dict(_M, tie=[(430, 198, 474, 395)]),
    '49': dict(_M, tie=[(415, 193, 450, 378)]),
    # a barong is sheer over a champagne undershirt: inside `sheer` only strong skin is skin, so the whole top takes the
    # colour; `a_poly` keeps the colour above the hem (the rest of the garment is pants — a sock, a cuff)
    # (the polo's short sleeves: its bare forearms are never sheer)
    '50': dict(head=185, pants=('grey', 590), sheer=[(350, 185, 545, 600), (255, 185, 645, 378)],
               a_poly=[(255, 180), (645, 180), (645, 378), (545, 378), (548, 560), (552, 600), (335, 600), (340, 560), (352, 378), (255, 378)]),
    '51': dict(head=185, pants=('grey', 590), sheer=[(250, 185, 650, 614)], a_poly=[(250, 180), (650, 180), (650, 612), (250, 612)]),
    '52': dict(head=185, pants=('grey', 590), sheer=[(250, 185, 650, 614)], a_poly=[(250, 180), (650, 180), (650, 612), (250, 612)]),
    '53': dict(head=185, pants=('grey', 590), sheer=[(380, 185, 525, 585)], a_poly=[(395, 170), (500, 170), (520, 300), (520, 580), (385, 580), (380, 300)]),
    # smart casual: nothing below the pants hem is a zone (an ankle drawn pale, a sock); the chinos traced between the
    # hands and, for the blazer, between its flaps
    '54': dict(head=185, below=1068, pants=('khaki', [(345, 505), (558, 505), (560, 1066), (345, 1066)]),
               never=[(288, 500, 345, 665), (560, 500, 614, 665)]),
    # (regenerated 2026-10-22, warm skin) the polo takes the colour; the light-grey slacks, belt and loafers stay as drawn
    '55': dict(head=185, below=1080, pants=('none', None),
               a_only=[(250, 180), (650, 180), (650, 362), (556, 362), (556, 482), (344, 482), (344, 362), (250, 362)]),
    '56': dict(head=185, below=1068, pants=('khaki', [(408, 515), (553, 515), (556, 600), (562, 640), (566, 1066), (345, 1066), (345, 600), (405, 600)])),
    '57': dict(head=185, below=1068, pants=('khaki', [(355, 478), (565, 478), (568, 1064), (352, 1064)]),
               never=[(292, 440, 352, 662), (568, 440, 618, 662)]),
    '58': dict(head=160, props=[(492, 420, 600, 515)]),
    # the wrap's skirt is shaded warm: below the hip only strong skin is skin, the leg in the slit traced as never
    '59': dict(head=160, props=[(305, 570, 360, 655)], sheer=[(355, 380, 545, 600), (300, 600, 620, 1180)],
               never=[[(452, 640), (468, 640), (488, 800), (498, 850), (492, 900), (484, 950), (473, 1000), (470, 1050), (470, 1100), (478, 1170), (420, 1170), (428, 1000), (437, 800)]]),
    '60': dict(head=160, props=[(290, 566, 358, 688)]),
    '61': dict(head=145, props=[(295, 555, 340, 670)]),
    # short and midi dresses: nothing below the hem is a zone (a vent's lining, the gap between the legs, nude shoes)
    '62': dict(head=160, below=782, props=[(458, 405, 540, 485)]),
    '63': dict(head=160, below=832, props=[[(555, 570), (586, 556), (592, 612), (540, 656), (522, 642), (524, 598), (540, 582)]],
               sheer=[(352, 175, 548, 400), (330, 400, 570, 560), (300, 560, 600, 832)]),
    '64': dict(head=160, below=914, props=[[(555, 598), (578, 596), (594, 660), (588, 694), (568, 694), (540, 642), (545, 610)]]),
    '65': dict(head=160, below=922, props=[[(325, 588), (340, 585), (352, 605), (358, 668), (352, 688), (335, 684), (314, 620), (316, 598)]]),
    '66': dict(head=160, props=[(295, 548, 358, 645)]),
    '67': dict(head=160, props=[[(485, 556), (547, 532), (572, 530), (588, 575), (562, 606), (503, 616), (487, 590)]], sheer=[(240, 200, 660, 470)]),
    '68': dict(head=160, below=948, props=[[(488, 536), (570, 515), (590, 577), (568, 590), (497, 604), (486, 585)]]),
    '69': dict(head=160, props=[[(506, 590), (538, 566), (582, 548), (592, 598), (562, 624), (522, 637), (506, 615)]]),
})

ZONES_OF = {  # design → its zones, in DOT ORDER (lib/attire-figures.ts holds the labels and defaults)
    'suit': 'ats', 'three_piece_suit': 'atsv', 'tuxedo': 'ats', 'vest_and_tie': 'ats', 'vest_and_bow_tie': 'ats',
    'barong_tagalog': 'ap', 'smart_casual': 'ap',
}


def half(src, num):
    f = '01-groom-v2.png' if num == '01' else f'raw-{num}.png'
    im = Image.open(os.path.join(src, f)).convert('RGB')
    return np.asarray(im.resize((im.width // 2, im.height // 2), Image.LANCZOS)).astype(int)


def as_img(m):
    return Image.fromarray((m * 255).astype(np.uint8))


def dil(m, r):
    return np.asarray(as_img(m).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


def ero(m, r):
    return np.asarray(as_img(m).filter(ImageFilter.MinFilter(2 * r + 1))) > 127


def close(m, r):
    return ero(dil(m, r), r)


def opn(m, r):
    return dil(ero(m, r), r)


def flood(cand, seed):
    """Everything in `cand` 4-connected to `seed`."""
    reach = seed & cand
    while True:
        n = reach
        for _ in range(8):
            m = n.copy()
            m[1:] |= n[:-1]; m[:-1] |= n[1:]; m[:, 1:] |= n[:, :-1]; m[:, :-1] |= n[:, 1:]
            n = m & cand
        if (n == reach).all():
            return n
        reach = n


def border(shape):
    s = np.zeros(shape, bool)
    s[0, :] = s[-1, :] = s[:, 0] = s[:, -1] = True
    return s


def box(shape, x0, y0, x1, y1):
    m = np.zeros(shape, bool)
    m[max(0, y0):y1, max(0, x0):x1] = True
    return m


def poly(shape, *ps):
    im = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(im)
    for p in ps:
        d.polygon(p, fill=255)
    return np.asarray(im) > 0


def points(shape, pts):
    m = np.zeros(shape, bool)
    for x, y in pts:
        m[y - 1:y + 2, x - 1:x + 2] = True
    return m


def build(src, num):
    a = half(src, num)
    shp = a.shape[:2]
    mn = a.min(2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sat = a.max(2) - mn
    ann = ANN[num]

    # 1 · the cut — flood the white ground up to the ink (closed by 2 px so faint gown lines hold), keep the body
    ink = mn < T_CUT
    bg = flood(~dil(ink, 2), border(shp))
    bg = dil(bg, 2) & ~ink
    fig = ~bg
    cy, cx = shp[0] // 2, int(np.median(np.where(fig)[1]))
    body_seed = np.zeros(shp, bool)
    ys = np.where(fig[:, cx])[0]
    body_seed[ys[len(ys) // 2], cx] = True
    fig = flood(fig, body_seed)

    # 2 · what is never a zone: skin · hair & shoes (dark) · the head · props · the veil · below the hem
    hands = dil((r - b >= 42) & (r >= g) & (g >= b), 1)  # strong skin only: a beige shirt is not a hand
    skin = (r - b >= ann.get('skin', 20)) & (r >= g) & (g >= b)
    for bx in ann.get('sheer', []):  # a sheer top: the arm seen through it is the fabric's, only strong skin is skin
        skin &= ~box(shp, *bx) | (r - b >= 45)
    skin = dil(skin & (r >= g) & (g >= b), 1)
    dark = mn < 110
    never = skin | dark | (sat > 34)
    never |= box(shp, 0, 0, shp[1], ann.get('head', 0))
    never |= box(shp, 0, 1060, shp[1], shp[0]) & (mn < 180)  # shoes and their shine
    if 'below' in ann:
        never |= box(shp, 0, ann['below'], shp[1], shp[0])
    props = np.zeros(shp, bool)
    for pr in ann.get('props', []):
        if isinstance(pr[0], tuple):  # a polygon: the prop exactly, as traced
            props |= poly(shp, pr) & ~skin
            continue
        bx = box(shp, *pr)
        pink = close((mn < 215) | skin | (sat > 12), 2) & bx
        # the prop's own holes (a petal, a box's white side): not reachable from the box edge without crossing its ink
        ring = bx & ~ero(bx, 1)
        outside = flood(bx & ~pink, ring) | ~bx
        props |= (pink | (~outside & bx)) & ~skin
    props = dil(props, 1)
    veil = np.zeros(shp, bool)
    if 'veil' in ann:
        vink = dil(mn < T_VEIL, 1)
        vbg = flood(~vink, border(shp))
        veil = fig & vbg & box(shp, *ann['veil'])
        keep = np.zeros(shp, bool)
        for k in ann.get('veil_keep', []):
            keep |= box(shp, *k)
        for p in ann.get('veil_keep_poly', []):
            keep |= poly(shp, p)
        veil = close(opn(veil, 2), 6) & fig & box(shp, *ann['veil'])
        veil &= ~keep
    never |= props | veil
    for nv in ann.get('never', []):
        never |= poly(shp, nv) if isinstance(nv[0], tuple) else box(shp, *nv)

    garment = fig & ~never
    garment = close(garment, 2) & fig & ~(props | veil | skin) & ~box(shp, 0, 0, shp[1], ann.get('head', 0))
    if 'below' in ann:
        garment &= ~box(shp, 0, ann['below'], shp[1], shp[0])
    garment &= ~(mn < 70) & ~(box(shp, 0, 1060, shp[1], shp[0]) & (mn < 180))

    design = ART[num].split('-', 1)[1].split('/')[0]
    zones = {}
    # tie / bow tie (+ pocket squares)
    if 't' in ZONES_OF.get(design, ''):
        t = np.zeros(shp, bool)
        for bx in ann.get('tie', []):
            m = box(shp, *bx) & garment
            if not ann.get('bow_white'):
                m &= mn < 238
                m = close(opn(m, 2), 3) & box(shp, *bx) & fig & ~skin
            t |= m
        for pp in ann.get('tie_poly', []):
            t |= poly(shp, pp) & garment
        for bx in ann.get('pocket', []):
            t |= close(box(shp, *bx) & garment & (mn < 240), 2) & box(shp, *bx) & garment
        zones['t'] = t & fig
    # shirt
    if 's' in ZONES_OF.get(design, ''):
        s = np.zeros(shp, bool)
        zink = dil(mn < ann.get('zink', T_ZONE_INK), 1)
        seeds = list(ann.get('shirt_seeds', []))
        if ann.get('shirt') == 'auto':
            t = zones['t']
            ty, tx = np.where(t)
            top, bot = ty.min(), ty.max()
            for dy in (14, 30, 46):
                row = top + dy
                cols = np.where(t[row])[0]
                if len(cols):
                    seeds += [(int(cols.min()) - 6, int(row)), (int(cols.max()) + 6, int(row))]
            for dx in (-14, 14):
                seeds.append((int(np.median(tx)) + dx, int(top) + 2))
            limit = box(shp, int(tx.min()) - 40, int(top) - 30, int(tx.max()) + 40, int(bot) + 10)
        else:
            limit = box(shp, 360, 180, 540, 460)
        if seeds:
            s |= flood(~zink & limit & fig, points(shp, seeds))
        s = close(s, 2) & limit
        if 'shirt_clip' in ann:
            s &= poly(shp, ann['shirt_clip'])
        for p in ann.get('shirt_polys', []):
            s |= poly(shp, p) & fig & (mn >= 150) & ~hands & ~dark & ~props
        if ann.get('shirt_head'):
            s &= ~box(shp, 0, 0, shp[1], ann['head'])
        zones['s'] = s & fig & ~hands & ~props & ~zones.get('t', np.zeros(shp, bool))
    # vest (3-piece)
    if 'v' in ZONES_OF.get(design, ''):
        zink = dil(mn < T_ZONE_INK, 1)
        v = flood(~zink & fig & box(shp, 380, 300, 520, 560), points(shp, ann['vest']))
        zones['v'] = close(v, 3) & garment & ~zones['s'] & ~zones['t']
    # pants (barong · smart casual)
    if 'p' in ZONES_OF.get(design, ''):
        kind, arg = ann['pants']
        if kind == 'grey':
            below = box(shp, 0, arg, shp[1], shp[0])
            cand = opn(garment & below & (mn < 236), 3)
            legs = cand & box(shp, 0, 950, shp[1], 1010)  # the legs, well under any hem
            p = flood(cand, legs)
            p = close(p, 5) & garment & below
        elif kind == 'none':
            p = np.zeros(shp, bool)
        elif kind == 'khaki':
            p = poly(shp, arg) & fig & (mn >= 110) & ((r - b) >= 12) & ~props
            p = close(p, 2) & poly(shp, arg) & fig & ~dark
        else:
            p = poly(shp, arg) & garment
        if 'a_poly' in ann:
            p |= garment & ~poly(shp, ann['a_poly']) & ~box(shp, 0, 0, shp[1], ann.get('head', 0))
        zones['p'] = p
    taken = np.zeros(shp, bool)
    for k in zones:
        taken |= zones[k]
    zones['a'] = garment & ~taken
    if 'a_only' in ann:
        zones['a'] &= poly(shp, ann['a_only'])
    for k in list(zones):
        zones[k] &= fig

    # 3 · neutralise every zone to white, shading kept
    L = 0.299 * r + 0.587 * g + 0.114 * b
    out = a.astype(float).copy()
    for k, m in zones.items():
        if m.sum() < 30:
            continue
        hi = np.percentile(L[m], 98)
        Ln = np.clip(L[m] * (255.0 / max(hi, 1)), 0, 255)
        out[m] = Ln[:, None]
    # 4 · crop to the figure, 280 tall
    ys, xs = np.where(fig)
    y0, y1 = max(0, ys.min() - 6), min(shp[0], ys.max() + 4)
    x0, x1 = max(0, xs.min() - 6), min(shp[1], xs.max() + 6)
    crop = (x0, y0, x1, y1)
    w = round((x1 - x0) * H / (y1 - y0))
    alpha = as_img(fig).filter(ImageFilter.GaussianBlur(0.6))
    draw = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert('RGBA')
    draw.putalpha(alpha)
    draw = draw.crop(crop).resize((w, H), Image.LANCZOS)
    masks = {}
    for k, m in zones.items():
        mm = as_img(m).filter(ImageFilter.GaussianBlur(0.8))
        mm = Image.fromarray(np.minimum(np.asarray(mm), np.asarray(alpha))).crop(crop).resize((w, H), Image.LANCZOS)
        masks[k] = mm
    return draw, masks, (w, H)


def main():
    src, out = sys.argv[1], sys.argv[2]
    prev = sys.argv[3] if len(sys.argv) > 3 else None
    only = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
    os.makedirs(out, exist_ok=True)
    report = {}
    for num, art in ART.items():
        if only and num not in only:
            continue
        draw, masks, size = build(src, num)
        os.makedirs(os.path.dirname(os.path.join(out, f'{art}.webp')), exist_ok=True)
        draw.save(os.path.join(out, f'{art}.webp'), 'WEBP', quality=82, method=6)
        sizes = {'draw': os.path.getsize(os.path.join(out, f'{art}.webp'))}
        for k, mm in masks.items():
            im = Image.new('RGBA', size, (0, 0, 0, 0))
            im.putalpha(mm)
            p = os.path.join(out, f'{art}-{k}.webp')
            im.save(p, 'WEBP', lossless=True, method=6)
            sizes[k] = os.path.getsize(p)
        report[art] = {'n': num, 'w': size[0], 'h': size[1], 'zones': sorted(masks), 'bytes': sizes}
        if prev:
            os.makedirs(prev, exist_ok=True)
            np.save(os.path.join(prev, f'{num}.npy'), np.zeros(1))
        print(num, art, size, sizes, flush=True)
    with open(os.path.join(prev or out, 'role-attire.json'), 'w') as f:
        json.dump(report, f, indent=1)


if __name__ == '__main__':
    main()
