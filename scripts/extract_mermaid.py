"""Pull every Mermaid diagram out of the README, agenda, docs, research folder and plan page into .mmd files.

Run from the repo root:  python scripts/extract_mermaid.py OUT_DIR
CI renders each file with mermaid-cli, so a broken chart fails the build.
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MD = re.compile(r"```mermaid\n(.*?)```", re.S)
SOURCES = {
    "README.md": MD,
    "AGENDA.md": MD,
    "docs/promo-night-kit.md": MD,
    "docs/claude-code-setup.md": MD,
    "launch-book.html": re.compile(r'<pre class="mermaid">(.*?)</pre>', re.S),
}
# Every Markdown file under research/ is scanned too (research/README.md, research/florida/README.md, ...).
for md in sorted((ROOT / "research").rglob("*.md")):
    SOURCES[md.relative_to(ROOT).as_posix()] = MD


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "build/mermaid")
    out.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, pattern in SOURCES.items():
        text = (ROOT / name).read_text(encoding="utf-8")
        for i, body in enumerate(pattern.findall(text), 1):
            body = html.unescape(body).strip() + "\n"
            stem = Path(name).with_suffix("").as_posix().replace("/", "-")
            (out / f"{stem}-{i}.mmd").write_text(body, encoding="utf-8")
            total += 1
    print(f"Extracted {total} diagrams to {out}")
    if total == 0:
        sys.exit("No Mermaid diagrams found")


if __name__ == "__main__":
    main()
