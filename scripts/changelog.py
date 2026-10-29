#!/usr/bin/env python3
"""Rebuild CHANGELOG.md from the GitHub releases, newest first.

    python scripts/changelog.py          # writes CHANGELOG.md
    python scripts/changelog.py --check  # exits 1 if CHANGELOG.md is out of date (for CI later)

One entry per release: the version and date, the release title, the first paragraph of its notes,
and links to the release, the tag's tree and the compare with the previous tag. Needs `gh` signed
in. Run it after every `gh release create`, and commit the result with the next change.
"""
import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = 'https://github.com/wbp318/goin-postal-forsythe'
OUT = ROOT / 'CHANGELOG.md'


def releases() -> list[dict]:
    raw = subprocess.check_output(['gh', 'api', '--paginate', 'repos/wbp318/goin-postal-forsythe/releases?per_page=100'], text=True, encoding='utf-8')
    items: list[dict] = []
    # --paginate concatenates JSON arrays; split them apart.
    for chunk in re.split(r'\]\s*\[', raw.strip()):
        chunk = chunk if chunk.startswith('[') else '[' + chunk
        chunk = chunk if chunk.endswith(']') else chunk + ']'
        items.extend(json.loads(chunk))
    return items


def vkey(tag: str):
    return tuple(int(x) for x in re.findall(r'\d+', tag)) or (0,)


def first_paragraph(body: str) -> str:
    text = (body or '').replace('\r\n', '\n').strip()
    text = re.split(r'\n## What changed, file by file', text)[0]
    for para in re.split(r'\n\s*\n', text):
        p = para.strip()
        if p and not p.startswith('#') and not p.startswith('```'):
            return re.sub(r'\s+', ' ', p)
    return ''


def build() -> str:
    rel = sorted(releases(), key=lambda r: vkey(r['tag_name']), reverse=True)
    tags = [r['tag_name'] for r in rel]
    lines = ['# Changelog', '', "Every release of the Goin' Postal Forsythe repository, newest first, rebuilt from the GitHub releases by `python scripts/changelog.py`. Each release page carries the full notes and, from v1.63.0 on, a file-by-file changelog with links. The agenda's log in [AGENDA.md](AGENDA.md) tells the same story by date with the item numbers.", '']
    for i, r in enumerate(rel):
        tag = r['tag_name']
        prev = tags[i + 1] if i + 1 < len(tags) else None
        date = (r.get('published_at') or r.get('created_at') or '')[:10]
        title = (r.get('name') or tag)
        title = re.sub(r'^v?\d+\.\d+\.\d+:\s*', '', title)
        links = [f'[release]({r["html_url"]})', f'[tree]({REPO}/tree/{tag})']
        if prev:
            links.append(f'[compare]({REPO}/compare/{prev}...{tag})')
        lines.append(f'## [{tag}] - {date}')
        lines.append('')
        lines.append(f'**{title}**' if title else '')
        lines.append('')
        para = first_paragraph(r.get('body', ''))
        if para:
            lines.append(para)
            lines.append('')
        lines.append(' · '.join(links))
        lines.append('')
    return '\n'.join(lines).rstrip() + '\n'


def main() -> int:
    text = build()
    if '--check' in sys.argv:
        current = OUT.read_text(encoding='utf-8') if OUT.exists() else ''
        if current != text:
            print('CHANGELOG.md is out of date; run python scripts/changelog.py', file=sys.stderr); return 1
        print('CHANGELOG.md is current'); return 0
    OUT.write_text(text, encoding='utf-8', newline='\n')
    print(f'Wrote {OUT.relative_to(ROOT)} with {text.count(chr(10) + "## [")} releases')
    return 0


if __name__ == '__main__':
    sys.exit(main())
