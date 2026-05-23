"""
Strip cream-background paths from Recraft SVGs · v2 with proper closing-tag match.

The Recraft path structure is:
  <path d="..." fill="..." transform="..." OTHER-ATTRS></path>

My v1 regex only matched the opening tag and left the closing </path>
dangling, breaking SVG validity. v2 uses a balanced-block match that
captures from <path to the matching </path>.
"""
import re
from pathlib import Path

ROOT = Path('/tmp/recraft-output')

def find_svgs():
    svgs = []
    for style_dir in ROOT.iterdir():
        if not style_dir.is_dir():
            continue
        for svg in style_dir.glob('*.svg'):
            if any(s in svg.name for s in ['.v2.', '.v3.', '.v4.', '.OLD.', '.preview.', '.withbg.']):
                continue
            svgs.append(svg)
    return svgs

def is_cream(rgb):
    r, g, b = rgb
    return r > 220 and g > 200 and b > 180 and r > b + 10

def parse_rgb(s):
    m = re.match(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', s)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    return None

def get_bounds(d):
    coords = re.findall(r'-?\d+\.?\d*', d)
    if len(coords) < 4:
        return None
    nums = [float(c) for c in coords]
    xs = nums[0::2]
    ys = nums[1::2]
    return (min(xs), min(ys), max(xs), max(ys)) if xs and ys else None

def get_viewbox(s):
    m = re.search(r'viewBox="([^"]+)"', s)
    if m:
        parts = m.group(1).split()
        if len(parts) == 4:
            return float(parts[2]), float(parts[3])
    return 2048, 2048

def strip(svg):
    vb_w, vb_h = get_viewbox(svg)
    canvas_area = vb_w * vb_h

    # Match: <path ATTRS></path>  with ATTRS that include both d=... and fill=...
    # The ATTRS section can NOT contain '>' (so we use [^>]*)
    # Then a literal '</path>' closes it.
    # Use non-greedy match for the body between > and </path> to handle nested children.
    path_re = re.compile(
        r'<path\b([^>]*)>(.*?)</path>',
        re.DOTALL,
    )

    removed = 0
    def maybe_strip(match):
        nonlocal removed
        attrs = match.group(1)
        d_m = re.search(r'd="([^"]*)"', attrs)
        fill_m = re.search(r'fill="([^"]+)"', attrs)
        if not d_m or not fill_m:
            return match.group(0)
        rgb = parse_rgb(fill_m.group(1))
        if rgb is None or not is_cream(rgb):
            return match.group(0)
        bounds = get_bounds(d_m.group(1))
        if not bounds:
            return match.group(0)
        path_area = (bounds[2] - bounds[0]) * (bounds[3] - bounds[1])
        if path_area > 0.3 * canvas_area:
            removed += 1
            return ''
        return match.group(0)

    new_svg = path_re.sub(maybe_strip, svg)
    return new_svg, removed

# ---- Run ----
svgs = sorted(find_svgs())
print(f"Processing {len(svgs)} SVGs")
total = 0
for svg_path in svgs:
    content = svg_path.read_text()
    cleaned, removed = strip(content)
    total += removed
    if removed > 0:
        # Backup if not yet backed up (we already have .withbg backups from v1)
        bk = svg_path.with_suffix('.withbg.svg')
        if not bk.exists():
            bk.write_text(content)
        svg_path.write_text(cleaned)
        rel = svg_path.relative_to(ROOT)
        diff = len(content) - len(cleaned)
        print(f"  {rel}: stripped {removed} bg paths · {diff:>7} bytes removed")

print(f"\nDONE · stripped {total} bg paths across {len(svgs)} SVGs")
