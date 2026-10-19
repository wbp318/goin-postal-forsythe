"""Put a "scan for directions" QR code on the program ads and the counter flyer.

Run from the repo root:  pip install segno  then  python scripts/add_qr.py
It replaces each design's decorative barcode with a real QR code that opens
the store's location in Google Maps. Running it again just refreshes the QR.
"""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parent))  # works under python -I too
import owner_guard  # noqa: E402,F401  stops on a clone that is not set up by an owner
import re
import sys
from pathlib import Path

import segno

ROOT = Path(__file__).resolve().parent.parent
DESIGNS = ROOT / "designs"

# Opens the Forsythe Ave & N 18th St intersection in Google Maps (works on iPhone and Android).
MAP_URL = "https://maps.google.com/?q=Forsythe+%26+N+18th+St+Monroe+LA"

# file: (x, y, size, label_x, first_label_baseline, label_font_size)
TARGETS = {
    "program-ad-half-page.svg": (640, 700, 188, 844, 760, 20),
    "st-frederick-program-ad.svg": (640, 700, 188, 844, 760, 20),
    "neville-jr-high-program-ad.svg": (640, 700, 188, 844, 760, 20),
    "counter-flyer.svg": (1196, 1910, 192, 1404, 1972, 22),
}

# What gets replaced: the barcode group and its "TRK ..." caption, or a QR block from an earlier run.
BARCODE = re.compile(r'\n\s*<g( fill="#17202d")?>\s*(<rect [^>]*/>\s*)+</g>\s*\n\s*<text [^>]*>TRK [^<]*</text>')
EARLIER = re.compile(r'\n\s*<g id="qr-directions">.*?</g><!-- /qr -->', re.S)


def qr_block(x, y, size, lx, ly, fs):
    qr = segno.make(MAP_URL, error="m")
    rows = list(qr.matrix_iter(border=2))
    n = len(rows)
    cell = size / n
    path = "".join(
        f"M{c},{r}h1v1h-1z"
        for r, row in enumerate(rows)
        for c, dark in enumerate(row)
        if dark
    )
    mono = 'font-family="\'IBM Plex Mono\', Consolas, \'SF Mono\', Menlo, \'DejaVu Sans Mono\', monospace" font-weight="500"'
    return (
        f'\n  <g id="qr-directions">'
        f'\n    <rect x="{x}" y="{y}" width="{size}" height="{size}" fill="#ffffff"/>'
        f'\n    <path transform="translate({x} {y}) scale({cell:.4f})" fill="#17202d" shape-rendering="crispEdges" d="{path}"/>'
        f'\n    <text x="{lx}" y="{ly}" {mono} font-size="{fs}" letter-spacing="2" fill="#1d4ed8">SCAN FOR</text>'
        f'\n    <text x="{lx}" y="{ly + fs * 1.4:.0f}" {mono} font-size="{fs}" letter-spacing="2" fill="#1d4ed8">DIRECTIONS</text>'
        f'\n  </g><!-- /qr -->'
    )


def main():
    changed = 0
    for name, spec in TARGETS.items():
        path = DESIGNS / name
        if not path.exists():
            print(f"skip {name}: not found")
            continue
        s = path.read_text(encoding="utf-8")
        block = qr_block(*spec)
        if EARLIER.search(s):
            s = EARLIER.sub(lambda m: block, s, count=1)
        elif BARCODE.search(s):
            s = BARCODE.sub(lambda m: block, s, count=1)
        else:
            print(f"FAIL {name}: no barcode or earlier QR found")
            return 1
        path.write_text(s, encoding="utf-8")
        changed += 1
        print(f"qr   {name}")
    print(f"{changed} designs now link to {MAP_URL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
