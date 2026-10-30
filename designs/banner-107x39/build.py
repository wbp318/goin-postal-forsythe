"""Build the 107 x 39 in storefront banner from the plan below.

    python build.py            # writes banner-107x39.svg, banner-107x39.pdf and png/*
    python build.py --svg-only # just the SVG, for a quick look

The SVG is generated, not hand-edited: change the wording or the numbers here and
run the script again. The mascot and the five carrier logos are taken from
parts/*.svg, measured, and placed on the grid; only Impact-free font outlines are
drawn here, from the Windows fonts named in FONTS.

DESIGN PLAN (the tokens everything below is built from)
  Canvas    4158 x 1512 units for 107 x 39 in (38.86 units per inch), transparent.
  Colour    NAVY   #002060  headline line 1, dividers, bottom row
            RED    #ED1C24  headline line 2, swoosh
            KEY    #FFFFFF  keyline behind the headline so it stays legible where the
                            mascot's parcel overlaps the letters
            The carrier marks keep their own brand colours; the mascot keeps its trace.
  Type      Headline: Arial Black, compressed to 76 percent and sloped 12 degrees, as
            the original's heavy oblique was. Bottom row: Arial Narrow Bold, tracked.
            All text is outlined; the files carry no fonts.
  Layout    One margin, MARGIN, on both sides. Everything hangs on it:
              line 2 "SHIPPING CENTER" runs from the margin to the mascot column;
              line 1 "YOUR ONE-STOP" is centred over line 2 (as the original);
              the swoosh runs under both and tapers out before the mascot column;
              the logo row is five marks on one centre line, tall marks (UPS shield,
              USPS eagle plus wording as a single block) at TALL, wordmarks at their
              own heights, equal gaps, a divider bar centred in every gap;
              the bottom row is justified across the same margin-to-margin width
              with the same bars.
  Mascot    Traced from the original until corporate sends the vector (issue on
            GitHub). Own column top right; nothing overlaps it and it overlaps nothing.
"""
import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'scripts'))
import owner_guard  # noqa: E402,F401  stops unless the owner key is present

from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402

W, H = 4158, 1512
NAVY, RED, KEY = '#002060', '#ED1C24', '#FFFFFF'
MARGIN = 180
FONTS = {
    'display': 'C:/Windows/Fonts/ariblk.ttf',   # Arial Black
    'row': 'C:/Windows/Fonts/ARIALNB.TTF',      # Arial Narrow Bold
}

# Headline
LINE1, LINE2 = 'YOUR ONE-STOP', 'SHIPPING CENTER'
CAP1, CAP2 = 282, 272            # cap heights in canvas units
BASE1, BASE2 = 457, 768          # baselines
LINE2_RIGHT = 3270               # where line 2 ends; the mascot column starts past it, nothing overlaps
SLOPE = -12                      # degrees
KEYLINE = 26                     # white stroke width, half of it shows outside the letter

# Swoosh
SWOOSH = 'M 60 836 L 3300 824 C 2350 868, 1100 905, 60 905 Z'   # ends before the mascot column

# Mascot
MASCOT_HEIGHT = 870              # fills the top-right corner, above the logo row
MASCOT_LEFT, MASCOT_TOP = 3350, 20

# Logo row
ROW_CY = 1090
TALL = 365                       # UPS shield and the USPS block
ROW_HEIGHTS = {'ups': TALL, 'fedex': 230, 'usps': TALL, 'dhl': 180, 'meest': 233}
ROW_ORDER = ['ups', 'fedex', 'usps', 'dhl', 'meest']
BAR_W, BAR_H = 16, 290

# Bottom row
WORDS = ['DOMESTIC', 'INTERNATIONAL', 'PACK', 'SHIP', 'TRACK']
ROW_CAP = 87
ROW_BASE = 1405
ROW_TRACK = 0.10                 # letter spacing, em
ROW_BAR_W, ROW_BAR_H = 14, 100


def fmt(x):
    return ('%.2f' % x).rstrip('0').rstrip('.')


class Face:
    def __init__(self, path):
        self.font = TTFont(path)
        self.upm = self.font['head'].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.hmtx = self.font['hmtx']
        os2 = self.font['OS/2']
        self.cap = getattr(os2, 'sCapHeight', 0) or self.glyph_height('H')
        self.kern = {}
        if 'kern' in self.font:
            for table in self.font['kern'].kernTables:
                self.kern.update(getattr(table, 'kernTable', {}))

    def glyph_height(self, ch):
        g = self.font['glyf'][self.cmap[ord(ch)]]
        return g.yMax

    def outline(self, ch):
        name = self.cmap[ord(ch)]
        pen = SVGPathPen(self.font.getGlyphSet())
        self.font.getGlyphSet()[name].draw(pen)
        return pen.getCommands()

    def layout(self, text, size, tracking=0.0):
        """Return (glyphs [(x, d)], total advance) in canvas units for text at size px."""
        s = size / self.upm
        x = 0.0
        out = []
        prev = None
        for ch in text:
            name = self.cmap[ord(ch)]
            if prev is not None:
                x += self.kern.get((prev, name), 0) * s
            d = self.outline(ch)
            if d:
                out.append((x, d))
            x += self.hmtx[name][0] * s + tracking * size
            prev = name
        if tracking:
            x -= tracking * size
        return out, x


def text_paths(face, text, size, sx=1.0, tracking=0.0):
    glyphs, adv = face.layout(text, size, tracking)
    s = size / face.upm
    paths = ''.join(
        '<path transform="translate(%s,0) scale(%s,%s)" d="%s"/>' % (fmt(x), fmt(s), fmt(-s), d)
        for x, d in glyphs)
    return paths, adv * sx


def headline(face):
    size1 = CAP1 / face.cap * face.upm
    size2 = CAP2 / face.cap * face.upm
    _, nat2 = text_paths(face, LINE2, size2)
    sx = (LINE2_RIGHT - MARGIN) / nat2
    p2, w2 = text_paths(face, LINE2, size2, sx)
    p1, w1 = text_paths(face, LINE1, size1, sx)
    x1 = MARGIN + (w2 - w1) / 2
    common = 'stroke="%s" stroke-width="%s" stroke-linejoin="round" paint-order="stroke"' % (KEY, KEYLINE)

    def line(paths, x, base, colour):
        return ('<g fill="%s" %s transform="translate(%s,%s) skewX(%s) scale(%s,1)">%s</g>'
                % (colour, common, fmt(x), base, SLOPE, fmt(sx), paths))
    return line(p1, x1, BASE1, NAVY) + line(p2, MARGIN, BASE2, RED)


def part(name):
    raw = open(os.path.join(HERE, 'parts', name + '.svg'), encoding='utf-8').read()
    bb = tuple(int(v) for v in re.search(r'bbox \((-?\d+), (-?\d+), (-?\d+), (-?\d+)\)', raw).groups())
    inner = raw[raw.index('>', raw.index('<svg')) + 1:raw.rindex('</svg>')]
    return inner, bb


def place(name, left, top, height):
    inner, (x0, y0, x1, y1) = part(name)
    s = height / (y1 - y0)
    width = (x1 - x0) * s
    g = '<g transform="translate(%s,%s) scale(%s) translate(%s,%s)">%s</g>' % (
        fmt(left), fmt(top), fmt(s), -x0, -y0, inner)
    return g, width


def logo_row():
    widths = {}
    for name in ROW_ORDER:
        _, bb = part(name)
        widths[name] = (bb[2] - bb[0]) * ROW_HEIGHTS[name] / (bb[3] - bb[1])
    gap = (W - 2 * MARGIN - sum(widths.values())) / (len(ROW_ORDER) - 1)
    out = []
    x = MARGIN
    for i, name in enumerate(ROW_ORDER):
        h = ROW_HEIGHTS[name]
        g, w = place(name, x, ROW_CY - h / 2, h)
        out.append(g)
        x += w
        if i < len(ROW_ORDER) - 1:
            out.append('<rect x="%s" y="%s" width="%d" height="%d" fill="%s"/>' % (
                fmt(x + gap / 2 - BAR_W / 2), ROW_CY - BAR_H / 2, BAR_W, BAR_H, NAVY))
            x += gap
    return ''.join(out)


def bottom_row(face):
    size = ROW_CAP / face.cap * face.upm
    rendered = [text_paths(face, w, size, 1.0, ROW_TRACK) for w in WORDS]
    gap = (W - 2 * MARGIN - sum(w for _, w in rendered)) / (len(WORDS) - 1)
    out = []
    x = MARGIN
    bar_top = ROW_BASE - ROW_CAP / 2 - ROW_BAR_H / 2
    for i, (paths, w) in enumerate(rendered):
        out.append('<g fill="%s" transform="translate(%s,%d)">%s</g>' % (NAVY, fmt(x), ROW_BASE, paths))
        x += w
        if i < len(WORDS) - 1:
            out.append('<rect x="%s" y="%s" width="%d" height="%d" fill="%s"/>' % (
                fmt(x + gap / 2 - ROW_BAR_W / 2), fmt(bar_top), ROW_BAR_W, ROW_BAR_H, NAVY))
            x += gap
    return ''.join(out)


def build_svg():
    display = Face(FONTS['display'])
    row = Face(FONTS['row'])
    mascot, _ = place('mascot', MASCOT_LEFT, MASCOT_TOP, MASCOT_HEIGHT)
    parts = [
        '<!-- Goin\' Postal Forsythe storefront banner, 107 x 39 in. Generated by build.py; edit that, not this. -->',
        '<g id="headline">' + headline(display) + '</g>',
        '<path id="swoosh" fill="%s" d="%s"/>' % (RED, SWOOSH),
        '<g id="mascot">' + mascot + '</g>',
        '<g id="carriers">' + logo_row() + '</g>',
        '<g id="services">' + bottom_row(row) + '</g>',
    ]
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" width="107in" height="39in" viewBox="0 0 %d %d">\n%s\n</svg>\n'
            % (W, H, '\n'.join(parts)))


def export(svg_path):
    import fitz
    pdf_path = os.path.join(HERE, 'banner-107x39.pdf')
    doc = fitz.open(svg_path)
    open(pdf_path, 'wb').write(doc.convert_to_pdf())
    pdf = fitz.open(pdf_path)
    page = pdf[0]
    print('PDF page %.1f x %.1f in, %d images' % (page.rect.width / 72, page.rect.height / 72, len(page.get_images())))
    png = os.path.join(HERE, 'png')
    os.makedirs(png, exist_ok=True)
    # Rasters are flattened on white: a transparent PNG goes dark in a dark-mode phone or chat viewer,
    # and the banner prints on white. Only the PDF keeps the transparent background.
    page.get_pixmap(matrix=fitz.Matrix(4000 / page.rect.width, 4000 / page.rect.width), alpha=False).save(os.path.join(png, 'banner-107x39-preview-4000px.png'))
    page.get_pixmap(dpi=150, alpha=False).save(os.path.join(png, 'banner-107x39-150dpi.png'))
    page.get_pixmap(dpi=150, alpha=False).save(os.path.join(png, 'banner-107x39-150dpi.jpg'), jpg_quality=92)
    print('wrote', pdf_path, 'and png/')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--svg-only', action='store_true')
    args = ap.parse_args()
    svg_path = os.path.join(HERE, 'banner-107x39.svg')
    open(svg_path, 'w', encoding='utf-8').write(build_svg())
    print('wrote', svg_path)
    if not args.svg_only:
        export(svg_path)


if __name__ == '__main__':
    main()
