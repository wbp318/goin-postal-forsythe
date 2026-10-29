#!/usr/bin/env python3
"""Build the changelog section of a GitHub release: every file changed since the previous tag, linked
at the new tag, grouped by area, with the commit and compare links.

    python scripts/release_notes.py v1.64.0                 # prints Markdown for the section
    python scripts/release_notes.py v1.64.0 --prev v1.63.0  # choose the base tag yourself
    python scripts/release_notes.py v1.64.0 --body notes.md # prepend a narrative file and print the whole release body

Every release since October 29, 2026 ends with this section, so a reader can go from the sentence
"batch shipping" to the file that does it without searching.
"""
import argparse, pathlib, re, subprocess, sys

REPO = 'https://github.com/wbp318/goin-postal-forsythe'
AREAS = [
    ('Site pages', re.compile(r'^site/src/pages/(?!api/|counter/)')),
    ('Counter pages (staff)', re.compile(r'^site/src/pages/counter/')),
    ('API routes', re.compile(r'^site/src/pages/api/')),
    ('Libraries', re.compile(r'^site/src/lib/')),
    ('PeterShip engine and store', re.compile(r'^site/src/shipping/')),
    ('Strings (14 languages)', re.compile(r'^site/src/i18n/')),
    ('Data and config', re.compile(r'^site/src/data/|^site/public/|^site/wrangler|^site/stores/')),
    ('Database schema', re.compile(r'^site/db/')),
    ('Tests', re.compile(r'^site/tests/')),
    ('PeterShip programs and plans', re.compile(r'^shipping-client/')),
    ('Monetization plans', re.compile(r'^monetization/')),
    ('Research', re.compile(r'^research/')),
    ('Designs', re.compile(r'^designs/')),
    ('Scripts and CI', re.compile(r'^scripts/|^\.github/')),
    ('Documentation', re.compile(r'\.md$')),
]


def git(*args: str) -> str:
    return subprocess.check_output(['git', *args], text=True, encoding='utf-8').strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('tag')
    ap.add_argument('--prev', help='the base tag; default: the tag before this one in version order')
    ap.add_argument('--body', help='a Markdown file with the narrative to put above the changelog')
    a = ap.parse_args()
    tags = git('tag', '--sort=version:refname').split('\n')
    if a.tag not in tags:
        print(f'{a.tag} is not a tag', file=sys.stderr); return 2
    prev = a.prev or (tags[tags.index(a.tag) - 1] if tags.index(a.tag) > 0 else None)
    rng = f'{prev}..{a.tag}' if prev else a.tag
    files = [f for f in git('diff', '--name-status', rng).split('\n') if f]
    commits = git('log', '--format=%H%x09%s', rng).split('\n') if prev else []
    issues = sorted({int(n) for f in files for n in []})  # placeholder, issues come from the narrative
    groups: dict[str, list[tuple[str, str]]] = {}
    for line in files:
        status, _, path = line.partition('\t')
        if status.startswith('R'):
            path = path.split('\t')[-1]
        area = next((name for name, rx in AREAS if rx.search(path)), 'Other')
        groups.setdefault(area, []).append((status[0], path))
    out = []
    if a.body:
        out.append(pathlib.Path(a.body).read_text(encoding='utf-8').rstrip())
        out.append('')
    out.append('## What changed, file by file')
    out.append('')
    if prev:
        out.append(f'Compare: [{prev}...{a.tag}]({REPO}/compare/{prev}...{a.tag}) · {len(files)} file(s) · {len(commits)} commit(s)')
    out.append('')
    for name, _ in AREAS + [('Other', None)]:
        if name not in groups:
            continue
        out.append(f'**{name}**')
        for status, path in groups[name]:
            verb = {'A': 'new', 'M': 'changed', 'D': 'removed', 'R': 'renamed'}.get(status, status)
            link = f'{REPO}/blob/{a.tag}/{path}' if status != 'D' else f'{REPO}/blob/{prev}/{path}'
            out.append(f'- [`{path}`]({link}) ({verb})')
        out.append('')
    if commits:
        out.append('**Commits**')
        for c in commits:
            sha, _, subject = c.partition('\t')
            out.append(f'- [`{sha[:7]}`]({REPO}/commit/{sha}) {subject}')
        out.append('')
    out.append(f'Full tree at this release: [{a.tag}]({REPO}/tree/{a.tag}). Agenda: [AGENDA.md]({REPO}/blob/{a.tag}/AGENDA.md). Owner issues: [open issues]({REPO}/issues).')
    print('\n'.join(out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
