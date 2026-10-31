"""Vectorize the original banner picture, as it is, for the print shop.

    python vectorize.py        # writes banner-107x39.svg, banner-107x39.pdf and png/

Takes the picture out of original-raster.pdf (2079 x 756 px with transparency), scales it
up 4x, snaps every pixel to the colours that actually cover area in the picture (which
removes the JPEG halos around edges without losing a real colour), traces each colour to
smooth vector shapes with VTracer, and puts the result on a 107 x 39 in page. Nothing is
moved, redrawn or recoloured: this is the original, sharp.

Needs: pymupdf, pillow, vtracer (pip install vtracer).
"""
import os
import re
import sys
import time
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'scripts'))
import owner_guard  # noqa: E402,F401

import fitz  # noqa: E402
import vtracer  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

SCALE = 4
MIN_SHARE = 0.0025      # a colour must cover this share of the picture to be kept
# Colours that must survive exactly, sampled from the original: the parcel's two light blues and its cyan.
# The median cut had been averaging the light blues into a grey-blue.
PINNED = [(217, 234, 246), (200, 229, 246), (135, 225, 244)]
WORK = os.path.join(HERE, 'png')


def extract():
    doc = fitz.open(os.path.join(HERE, 'original-raster.pdf'))
    page = doc[0]
    (xref, smask) = [(i[0], i[1]) for i in page.get_images(full=True)][0]
    rgb = fitz.Pixmap(doc, xref)
    if rgb.n >= 4:
        rgb = fitz.Pixmap(fitz.csRGB, rgb)
    pix = fitz.Pixmap(rgb, fitz.Pixmap(doc, smask)) if smask else rgb
    path = os.path.join(WORK, 'original-extracted.png')
    pix.save(path)
    return path


def clean(src):
    im = Image.open(src).convert('RGBA')
    rgb, alpha = im.convert('RGB'), im.getchannel('A')
    opaque = alpha.point(lambda v: 255 if v > 128 else 0)
    q = rgb.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[:64 * 3]
    counts = Counter(i for i, m in zip(q.getdata(), opaque.getdata()) if m)
    total = sum(counts.values())
    cols = [tuple(pal[i * 3:i * 3 + 3]) for i, n in counts.items() if n / total > MIN_SHARE]
    cols = [c for c in cols if all(sum((a - b) ** 2 for a, b in zip(c, pin)) > 24 ** 2 for pin in PINNED)] + PINNED
    pimg = Image.new('P', (1, 1))
    flat = [v for c in cols for v in c]
    pimg.putpalette(flat + [0] * (768 - len(flat)))
    size = (im.width * SCALE, im.height * SCALE)
    big = rgb.resize(size, Image.LANCZOS)
    big_alpha = alpha.resize(size, Image.LANCZOS).point(lambda v: 255 if v > 128 else 0)
    snapped = big.quantize(palette=pimg, dither=Image.Dither.NONE).convert('RGB').filter(ImageFilter.ModeFilter(5))
    out = Image.new('RGBA', size, (0, 0, 0, 0))
    out.paste(snapped, (0, 0), big_alpha)
    path = os.path.join(WORK, 'original-clean-4x.png')
    out.save(path)
    print('%d colours kept, cleaned picture %d x %d' % (len(cols), *size))
    return path, size


def trace(src, size):
    svg = os.path.join(HERE, 'banner-107x39.svg')
    t = time.time()
    vtracer.convert_image_to_svg_py(
        src, svg, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=20,
        color_precision=8, layer_difference=48, corner_threshold=70, length_threshold=5.0,
        max_iterations=10, splice_threshold=45, path_precision=2)
    s = open(svg, encoding='utf-8').read()
    s = re.sub(r'<svg[^>]*>', '<svg xmlns="http://www.w3.org/2000/svg" width="107in" height="39in" viewBox="0 0 %d %d">' % size, s, count=1)
    s = s.replace('<!-- Generator: visioncortex VTracer', '<!-- The original banner picture traced to vectors by vectorize.py. Generator: visioncortex VTracer', 1)
    open(svg, 'w', encoding='utf-8').write(s)
    print('traced in %.0f s: %d shapes' % (time.time() - t, s.count('<path')))
    return svg


def export(svg):
    pdf_path = os.path.join(HERE, 'banner-107x39.pdf')
    open(pdf_path, 'wb').write(fitz.open(svg).convert_to_pdf())
    page = fitz.open(pdf_path)[0]
    print('PDF %.0f x %.0f in, %d images, %d fonts, %d vector shapes' % (
        page.rect.width / 72, page.rect.height / 72, len(page.get_images()), len(page.get_fonts()), len(page.get_drawings())))
    m = 4000 / page.rect.width
    page.get_pixmap(matrix=fitz.Matrix(m, m), alpha=False).save(os.path.join(WORK, 'banner-107x39-preview-4000px.png'))
    page.get_pixmap(dpi=150, alpha=False).save(os.path.join(WORK, 'banner-107x39-150dpi.png'))
    page.get_pixmap(dpi=150, alpha=False).save(os.path.join(WORK, 'banner-107x39-150dpi.jpg'), jpg_quality=92)


def main():
    os.makedirs(WORK, exist_ok=True)
    src = extract()
    cleaned, size = clean(src)
    export(trace(cleaned, size))
    for f in ('original-extracted.png', 'original-clean-4x.png'):
        os.remove(os.path.join(WORK, f))


if __name__ == '__main__':
    main()
