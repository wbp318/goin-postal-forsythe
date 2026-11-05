"""Write the repo's exact language breakdown into README.md, every language, from GitHub's own count.

GitHub's sidebar shows only the top six languages and folds the rest into "Other". This fetches the
same numbers GitHub uses (the repo's /languages API, bytes per language after .gitattributes) and
writes a table with every language to two decimals between the README's languages markers.

Run from the repo root after a push (GitHub recounts a minute or so after each push):

    python scripts/languages.py            # updates README.md
    python scripts/languages.py --print    # only prints the table
"""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parent))  # works under python -I too
import owner_guard  # noqa: E402,F401  stops on a clone that is not set up by an owner
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
START, END = "<!-- languages:start -->", "<!-- languages:end -->"

# What each language is in this repo, so the table says more than a name.
WHAT = {
    "TypeScript": "PeterShip and the website's APIs, libraries and tests (`site/src`)",
    "Markdown": "Plans, guides, READMEs, the agenda and the changelog",
    "Astro": "The website's pages and layouts",
    "JSON": "Rate sheets, the 14-language strings, store facts, package files",
    "SVG": "Ad and sponsorship designs (the banner's machine-made traces are left out)",
    "HTML": "The mailbox intake packet, the design gallery, page previews",
    "Python": "Build and release scripts, the mailbox register's builder, tests and tools",
    "JavaScript": "Marketplace connectors and the printer agent (`.mjs`)",
    "CSS": "The website's styles",
    "Visual Basic 6.0": "The mailbox register's LibreOffice Basic macros (GitHub's name for `.bas`)",
    "YAML": "CI workflows",
    "PowerShell": "Windows setup scripts",
    "CSV": "Small data files",
}


def repo_slug():
    url = subprocess.run(["git", "remote", "get-url", "origin"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    m = re.search(r"github\.com[:/](.+?)(?:\.git)?$", url)
    if not m:
        sys.exit(f"origin is not a GitHub remote: {url}")
    return m.group(1)


def fetch(slug):
    req = urllib.request.Request(f"https://api.github.com/repos/{slug}/languages",
                                 headers={"Accept": "application/vnd.github+json", "User-Agent": "goin-postal-languages-script"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def table(langs):
    total = sum(langs.values())
    today = dt.date.today()
    rows = sorted(langs.items(), key=lambda kv: -kv[1])
    lines = [
        f"Every language GitHub counts in this repo, exact, as of {today:%B} {today.day}, {today:%Y}"
        + f" ({total:,} bytes in all). GitHub's sidebar shows the top six and folds the rest into \"Other\"; "
        "this is the whole list, from the same count. Refreshed by `python scripts/languages.py`.",
        "",
        "| Language | Share | Bytes | What it is here |",
        "| --- | ---: | ---: | --- |",
    ]
    for name, n in rows:
        lines.append(f"| {name} | {100 * n / total:.2f}% | {n:,} | {WHAT.get(name, '')} |")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--print", action="store_true", help="print the table, do not touch README.md")
    a = ap.parse_args()
    body = table(fetch(repo_slug()))
    if a.print:
        print(body)
        return
    text = README.read_text(encoding="utf-8")
    if START not in text or END not in text:
        sys.exit(f"README.md needs the markers {START} and {END}")
    new = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: f"{START}\n{body}\n{END}", text, count=1, flags=re.S)
    if new == text:
        print("README.md languages already current")
    else:
        README.write_text(new, encoding="utf-8", newline="")
        print("README.md languages updated")
    print(body)


if __name__ == "__main__":
    main()
