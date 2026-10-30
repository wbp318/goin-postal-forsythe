# 107 x 39 inch storefront banner: "Your One-Stop Shipping Center"

Print-ready vector files for the big banner. Send the print shop **`banner-107x39.pdf`** (or the SVG if they ask for it).

| File | What it is | Give to the printer? |
|---|---|---|
| `banner-107x39.pdf` | Third generation (Oct 30): built from `build.py`. Headline and bottom row are font outlines, carrier logos are the official vector marks, mascot is traced. 107 x 39 in page, no fonts, no embedded image. | **Yes** |
| `banner-107x39.svg` | Same artwork as SVG, transparent background. For Illustrator, Inkscape or a sign shop RIP. | If they want an editable file |
| `build.py` and `parts/` | The build script and the six pieces it places (mascot and five logos). Change wording or spacing in the script and run it; it writes the SVG, the PDF and `png/`. | No |
| `auto-trace-of-original.pdf` / `.svg` | First attempt: a straight trace of the original picture. Keeps the original's jagged edges. | No |
| `original-raster.pdf` | The original file: one 2079 x 756 pixel picture stretched over 107 inches (about 19 dpi). This is why earlier prints looked blurry. | No |

## Checklist at the print shop

1. Hand over `banner-107x39.pdf`, not the original.
2. Ask them to open it and zoom to 400 percent on a letter edge. It must stay razor sharp. If it goes soft or blocky, they opened the wrong file.
3. Ask them to confirm the page size reads 107 x 39 in with no scaling.
4. The background is transparent. Tell them what colour the banner material is, or ask for white.
5. The mascot is the only traced element. It is clean at banner size, but if they want it smoother, the original Goin' Postal mascot vector from corporate would be a drop-in replacement.

## How it is laid out (Oct 30 rebuild)

The plan is written at the top of `build.py` and everything is measured from it:

- **Colours.** Navy `#002060` and red `#ED1C24`, sampled from the original. The Oct 29 file had drifted to a lighter navy and a darker red.
- **Headline.** Arial Black, compressed to 76 percent and sloped 12 degrees, the closest match on hand to the original's heavy oblique. "SHIPPING CENTER" runs from the left margin to where the mascot's parcel starts; "YOUR ONE-STOP" is centred over it, as in the original. A white keyline sits behind the letters.
- **Logo row.** The five marks sit on one centre line with equal gaps and a navy bar centred in every gap. The UPS shield and the USPS block (eagle plus wording, moved and scaled as one piece) are the tall marks; FedEx, DHL and Meest are wordmarks at their own heights.
- **Bottom row.** Arial Narrow Bold, tracked, justified across the same width as the logo row with the same bars, so the two rows share their outer edges.
- **Mascot.** Still the trace of the original, top right, parcel over the end of the headline, feet on the swoosh. The official vector from corporate is a drop-in replacement (GitHub issue).

Carrier logos are the UPS, FedEx, USPS, DHL and Meest public vector marks. Each carrier's media page has brand-kit versions if a rep asks.

## The three generations

1. `original-raster.pdf`: the file the shop had, a picture at about 19 dpi.
2. `auto-trace-of-original.*`: Oct 29, a trace. Vector, but it keeps every jagged edge.
3. `banner-107x39.*`: Oct 29 rebuilt from fonts and logo marks; Oct 30 rebuilt again from `build.py` on one grid.

## Raster exports (`png/`)

For phones, WhatsApp and quick previews. WhatsApp's built-in PDF viewer draws a tiny low-resolution preview that makes any PDF look soft, so judge quality from these or from the PDF opened in Acrobat at 400 percent.

| File | Size | Use |
|---|---|---|
| `banner-107x39-preview-4000px.png` | 4000 x 1458 px | Sharing and on-screen review |
| `banner-107x39-150dpi.png` | 16051 x 5850 px | Full print resolution, 150 dpi at 107 x 39 in. Send on WhatsApp as a **document**, not a photo, or it gets recompressed |
| `banner-107x39-150dpi.jpg` | same, JPEG | Same, for shops that only take JPEG |

The PDF is still the file to print from. The PNG and JPEG are rendered from it.
