"""Make one Game Day social post per Moccasins home game.

Reads designs/game-day-social.svg as a template and writes
designs/game-day/YYYY-MM-DD-<opponent-slug>.svg for every game in GAMES.

To add a game: add a line to GAMES below and run
    python scripts/make_game_posts.py
Use opponent=None when the opponent is not confirmed yet; the post then
reads "MOCCASINS HOME GAME" and the file is named YYYY-MM-DD-home-game.svg.
Stdlib only.
"""

import owner_guard  # noqa: F401  stops on a clone that is not set up by an owner
import datetime
import os
import re
import sys
from xml.sax.saxutils import escape

# ---------------------------------------------------------------------------
# HOME GAMES  (date, opponent or None if unconfirmed, puck drop, venue)
# ---------------------------------------------------------------------------
GAMES = [
    ("2026-10-17", "Baton Rouge Kingfish", "7:05 PM", "Monroe Civic Center"),
    ("2026-10-30", None, "7:05 PM", "Monroe Civic Center"),  # opponent unconfirmed
    ("2026-10-31", None, "7:05 PM", "Monroe Civic Center"),  # opponent unconfirmed
    ("2026-11-06", "Columbus River Dragons", "7:05 PM", "Monroe Civic Center"),
    ("2026-11-07", "Columbus River Dragons", "7:05 PM", "Monroe Civic Center"),
    ("2026-11-21", "Baton Rouge Kingfish", "7:05 PM", "Monroe Civic Center"),
    ("2026-12-29", "Mid-South Monarchs", "7:05 PM", "Monroe Civic Center"),
    ("2027-01-08", "Mid-South Monarchs", "7:05 PM", "Monroe Civic Center"),
    ("2027-01-09", "Mid-South Monarchs", "7:05 PM", "Monroe Civic Center"),
    ("2027-02-05", "Mid-South Monarchs", "7:05 PM", "Monroe Civic Center"),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, "designs", "game-day-social.svg")
OUT_DIR = os.path.join(ROOT, "designs", "game-day")

BOX_WIDTH = 880  # usable width of the label rows (x=100 .. 980)

# Rough per-character advance for Barlow Condensed 600 caps, in em.
NARROW = set("I1.,:·' ")
WIDE = set("MW")


def est_width(text, size):
    w = 0.0
    for ch in text:
        if ch in NARROW:
            w += 0.26
        elif ch in WIDE:
            w += 0.62
        elif ch == "-":
            w += 0.32
        else:
            w += 0.47
    return w * size


def fit_attrs(text, size):
    """textLength sized to the box: never wider than the row."""
    width = min(BOX_WIDTH, round(est_width(text, size)))
    return f'textLength="{width}" lengthAdjust="spacingAndGlyphs"'


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def sub_once(pattern, repl, text):
    new, n = re.subn(pattern, lambda m: repl, text, count=1)
    if n != 1:
        sys.exit(f"Template changed; could not find: {pattern}")
    return new


def build(template, date_str, opponent, time_str, venue):
    d = datetime.date.fromisoformat(date_str)
    day = d.strftime("%a").upper()
    mon = d.strftime("%b").upper()
    matchup = f"MOCCASINS VS. {opponent.upper()}" if opponent else "MOCCASINS HOME GAME"
    when = f"{day} {mon} {d.day} · {time_str.upper()} · {venue.upper()}"

    svg = template

    # Title
    who = f"Moccasins vs. {opponent}" if opponent else "Moccasins Home Game"
    title = f"Game Day: {who}, {d.strftime('%a %b')} {d.day}: Goin' Postal Forsythe"
    svg = sub_once(r"<title>.*?</title>", f"<title>{escape(title)}</title>", svg)

    # Remove template helper tags and their blue edit underlines
    svg = sub_once(r'\n[ \t]*<text[^>]*>EDIT · MATCHUP</text>', "", svg)
    svg = sub_once(r'\n[ \t]*<text[^>]*>EDIT · DATE &amp; VENUE</text>', "", svg)
    svg = sub_once(r'\n[ \t]*<rect x="100" y="364" width="880" height="2" fill="#1d4ed8"[^>]*/>', "", svg)
    svg = sub_once(r'\n[ \t]*<rect x="100" y="780" width="880" height="2" fill="#1d4ed8"[^>]*/>', "", svg)
    svg = svg.replace("SHIP TO / matchup (editable)", "SHIP TO / matchup")
    svg = svg.replace("date / venue (editable)", "date / venue")

    # Matchup line (font-size 64)
    svg = sub_once(
        r'<text x="100" y="356" class="d6" font-size="64" fill="#17202d">[^<]*</text>',
        f'<text x="100" y="356" class="d6" font-size="64" fill="#17202d" {fit_attrs(matchup, 64)}>{escape(matchup)}</text>',
        svg,
    )

    # Date / venue line (font-size 50)
    svg = sub_once(
        r'<text x="100" y="770" class="d6" font-size="50" fill="#17202d">[^<]*</text>',
        f'<text x="100" y="770" class="d6" font-size="50" fill="#17202d" {fit_attrs(when, 50)}>{escape(when)}</text>',
        svg,
    )

    name = f"{date_str}-{slugify(opponent) if opponent else 'home-game'}.svg"
    return name, svg


def main():
    with open(TEMPLATE, encoding="utf-8") as f:
        template = f.read()
    os.makedirs(OUT_DIR, exist_ok=True)
    for game in GAMES:
        name, svg = build(template, *game)
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(svg)
        print(os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
