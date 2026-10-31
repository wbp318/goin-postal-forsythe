# 107 x 39 inch storefront banner: "Your One-Stop Shipping Center"

The print shop needs a vector file. **Send them `banner-107x39.pdf`.** It is the original banner picture, exactly as it was, traced to vectors so it stays sharp at 107 inches.

| File | What it is | Give to the printer? |
|---|---|---|
| `banner-107x39.pdf` | The original, vectorized. 107 x 39 in page, transparent background, 920 vector shapes, no pictures, no fonts. | **Yes** |
| `banner-107x39.svg` | The same artwork as SVG, for Illustrator, Inkscape or a sign-shop RIP. | If they want an editable file |
| `png/` | Previews rendered from the PDF, on white: 4000 px for sharing, 150 dpi PNG and JPEG for phones. Send on WhatsApp as a document, not a photo. | No |
| `original-raster.pdf` | The file the shop had: one 2079 x 756 pixel picture stretched over 107 inches, about 19 dpi. This is why prints came out blurry. | No |
| `vectorize.py` | The script that makes the PDF and SVG from `original-raster.pdf`. Run it again if the original ever changes. | No |
| `rebuilt/` | A separate redesign built from fonts and the official carrier marks (`build.py`, `parts/`). Not what the shop gets unless Peter asks for it. | No |

## How the vector file was made

`vectorize.py` takes the picture out of the original PDF with its transparency, scales it up four times, snaps every pixel to the 55 colours that actually cover area in the picture (which removes the JPEG halos around every edge without losing a real colour), traces each colour to smooth vector shapes with VTracer, and puts the result on a 107 x 39 in page. Nothing is moved, redrawn or recoloured.

## Checklist at the print shop

1. Hand over `banner-107x39.pdf`, not the original.
2. Ask them to confirm the page size reads 107 x 39 in with no scaling.
3. Ask them to zoom to 400 percent on a letter edge. It must stay sharp. If it goes soft or blocky, they opened the wrong file.
4. The background is transparent. Tell them what colour the banner material is, or ask for white.

## Open

The mascot's own vector from corporate would make the mascot cleaner still (GitHub issue 16). Until then the traced one is what prints, and it is clean at banner size.
