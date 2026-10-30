"""Check the ad designs before they go out.

Run from the repo root:  python scripts/check_designs.py
Exits non-zero and lists every problem found.
"""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parent))  # works under python -I too
import owner_guard  # noqa: E402,F401  stops on a clone that is not set up by an owner
import re
import struct
import sys
import xml.dom.minidom
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGNS = ROOT / "designs"
PNG_DIR = DESIGNS / "png"

# Designs that are store-campaign marks rather than ads, so they carry no logo slot.
NO_LOGO_SLOT = {"sponsor-badge.svg"}
PHONE = re.compile(r"\(?\b\d{3}\)?[-.\s]\d{3}[-.]\d{4}\b")
PRICE = re.compile(r"\$\s?\d")


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def check_svg(path, problems):
    name = path.relative_to(DESIGNS).as_posix()
    try:
        doc = xml.dom.minidom.parse(str(path))
    except Exception as e:  # noqa: BLE001 - report any parse failure
        problems.append(f"{name}: not valid XML ({e})")
        return
    svg = doc.documentElement
    if svg.tagName != "svg":
        problems.append(f"{name}: root element is <{svg.tagName}>, expected <svg>")
        return
    for attr in ("viewBox", "width", "height"):
        if not svg.getAttribute(attr):
            problems.append(f"{name}: <svg> is missing {attr}")
    if svg.getAttribute("text-rendering") != "geometricPrecision":
        problems.append(f"{name}: add text-rendering=\"geometricPrecision\" so small text stays readable when scaled down")

    text = " ".join(t.firstChild.data if t.firstChild and t.firstChild.nodeType == t.TEXT_NODE else t.toxml()
                    for t in doc.getElementsByTagName("text"))
    if path.name not in NO_LOGO_SLOT and "OFFICIAL LOGO" not in text:
        problems.append(f"{name}: no OFFICIAL LOGO slot for corporate's logo")
    if PHONE.search(text):
        problems.append(f"{name}: contains a phone number; leave phone numbers off the designs")
    if PRICE.search(text):
        problems.append(f"{name}: contains a dollar price; set offer terms with corporate first")

    rel = path.relative_to(DESIGNS).with_suffix(".png")
    png = PNG_DIR / rel
    if not png.exists():
        problems.append(f"{name}: missing designs/png/{rel.as_posix()} (run scripts/export_designs.py)")
    else:
        size = png_size(png)
        want = (int(float(svg.getAttribute("width") or 0)), int(float(svg.getAttribute("height") or 0)))
        if size != want:
            problems.append(f"{name}: png/{rel.as_posix()} is {size}, expected {want} (re-run the export)")


def main():
    problems = []
    svgs = sorted(p for p in DESIGNS.rglob("*.svg") if p.relative_to(DESIGNS).parts[0] not in ("png", "pdf", "banner-107x39"))
    if not svgs:
        problems.append("designs/: no SVG files found")
    for path in svgs:
        check_svg(path, problems)

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    gallery = (DESIGNS / "index.html").read_text(encoding="utf-8")
    for path in svgs:
        rel = path.relative_to(DESIGNS)
        if len(rel.parts) > 1:
            # Files in a subfolder (game-day posts, promo kit) only need their folder listed.
            folder = "designs/" + rel.parts[0] + "/"
            if folder not in readme:
                problems.append(f"README.md: does not mention {folder}")
            if rel.parts[0] + "/" not in gallery:
                problems.append(f"designs/index.html: gallery does not link {rel.parts[0]}/")
            continue
        if path.name not in readme:
            problems.append(f"README.md: does not list designs/{path.name}")
        if path.name not in gallery:
            problems.append(f"designs/index.html: gallery does not show {path.name}")

    if not (DESIGNS / "pdf" / "counter-flyer.pdf").exists():
        problems.append("designs/pdf/counter-flyer.pdf is missing (run scripts/export_designs.py)")

    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"All {len(svgs)} designs passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
