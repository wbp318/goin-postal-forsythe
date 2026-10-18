"""Export every design to PNG (for WhatsApp, texts, email) and the counter flyer to PDF (for printing).

Run from the repo root:  python scripts/export_designs.py [--out DIR] [--browser PATH]
The SVGs are the source files and are never changed. Needs Chrome or Edge.
Fonts load from Google Fonts, so run it online for the real typefaces.
"""
import owner_guard  # noqa: F401  stops on a clone that is not set up by an owner
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGNS = ROOT / "designs"
PRINT_PDFS = {"counter-flyer.svg": ("8.5in", "11in")}

CANDIDATES = [
    os.environ.get("BROWSER", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge",
]


def find_browser(explicit):
    for c in [explicit] + CANDIDATES:
        if not c:
            continue
        if Path(c).exists():
            return c
        found = shutil.which(c)
        if found:
            return found
    sys.exit("No Chrome or Edge found. Pass --browser PATH or set BROWSER.")


def run(browser, *args):
    cmd = [browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
           "--virtual-time-budget=8000", *args]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)


def design_files():
    """Every SVG under designs/, skipping the export folders."""
    return sorted(p for p in DESIGNS.rglob("*.svg") if p.relative_to(DESIGNS).parts[0] not in ("png", "pdf"))


def size_of(svg_text):
    m = re.search(r'<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"', svg_text)
    if not m:
        raise ValueError("SVG needs numeric width and height")
    return int(m.group(1)), int(m.group(2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DESIGNS), help="folder that gets png/ and pdf/ (default: designs/)")
    ap.add_argument("--browser", default="")
    a = ap.parse_args()
    browser = find_browser(a.browser)
    out = Path(a.out)
    (out / "png").mkdir(parents=True, exist_ok=True)
    (out / "pdf").mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        for svg in design_files():
            text = svg.read_text(encoding="utf-8")
            w, h = size_of(text)
            rel = svg.relative_to(DESIGNS).with_suffix(".png")
            png = (out / "png" / rel).resolve()
            png.parent.mkdir(parents=True, exist_ok=True)
            run(browser, "--default-background-color=00000000", f"--window-size={w},{h}",
                f"--screenshot={png}", svg.resolve().as_uri())
            print(f"png  {rel.as_posix()}")

            if svg.name in PRINT_PDFS:
                pw, ph = PRINT_PDFS[svg.name]
                # Inline the SVG so its web fonts load and embed in the PDF.
                inline = re.sub(r'width="\d+" height="\d+"', f'style="display:block;width:{pw};height:{ph}"', text, count=1)
                page = Path(tmp) / f"{svg.stem}.html"
                page.write_text(
                    f'<!doctype html><html><head><meta charset="utf-8"><style>@page{{size:{pw} {ph};margin:0}}'
                    f'html,body{{margin:0}}</style></head><body>{inline}</body></html>', encoding="utf-8")
                pdf = (out / "pdf" / (svg.stem + ".pdf")).resolve()
                run(browser, "--no-pdf-header-footer", f"--print-to-pdf={pdf}", page.as_uri())
                print(f"pdf  {pdf.name}")


if __name__ == "__main__":
    main()
