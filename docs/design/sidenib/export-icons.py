"""Render Sidenib's editable SVGs without changing application dependencies.

Usage: python3 docs/design/sidenib/export-icons.py
Requires Node/npm. macOS also generates the ICNS bundle with iconutil.
"""

from pathlib import Path
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "exports"
RENDERER = "@resvg/resvg-js-cli@2.6.2-beta.1"
SIZES = (16, 18, 20, 24, 32, 48, 64, 128, 256, 512, 1024)


def render(source, destination, size):
    subprocess.run(
        ["npm", "exec", "--yes", f"--package={RENDERER}", "--", "resvg-js",
         "--fit-width", str(size), str(source), str(destination)],
        check=True, capture_output=True, text=True,
    )


def svg_copy(name, x, y, size, prefix):
    text = (ROOT / name).read_text()
    inner = text[text.index(">") + 1:text.rindex("</svg>")]
    inner = re.sub(r'id="([^"]+)"', lambda m: f'id="{prefix}{m[1]}"', inner)
    inner = inner.replace("url(#", f"url(#{prefix}")
    inner = re.sub(r'<title[^>]*>.*?</title>|<desc[^>]*>.*?</desc>', "", inner, flags=re.S)
    inner = "\n".join(line.rstrip() for line in inner.splitlines())
    viewbox = "0 0 1024 1024" if name == "app-icon.svg" else "0 0 18 18"
    return f'<svg x="{x}" y="{y}" width="{size}" height="{size}" viewBox="{viewbox}">{inner}</svg>'


def write_preview():
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="530" viewBox="0 0 960 530">',
        '<rect width="960" height="530" fill="#FFFFFF"/>',
        '<rect y="106" width="480" height="424" fill="#F7F4ED"/>',
        '<rect x="480" y="106" width="480" height="424" fill="#242620"/>',
        '<g font-family="Arial, sans-serif"><text x="32" y="46" font-size="28" font-weight="700" fill="#282722">Sidenib · Peek</text>',
        '<text x="32" y="77" font-size="14" fill="#6B685F">Approved identity · app icons and menu-bar marks at actual pixel sizes</text></g>',
    ]
    for half, ink in ((0, "#282722"), (480, "#FFF8E8")):
        parts.append(f'<text x="{half + 32}" y="141" font-family="Arial" font-size="14" fill="{ink}">{"Light" if half == 0 else "Dark"} background</text>')
        for i, (size, x) in enumerate(((128, 32), (64, 210), (32, 324), (16, 408))):
            parts.append(svg_copy("app-icon.svg", half + x, 174, size, f"a{half}_{i}_"))
            parts.append(f'<text x="{half + x}" y="329" font-family="Arial" font-size="12" fill="{ink}">{size} px</text>')
        parts.append(f'<text x="{half + 32}" y="386" font-family="Arial" font-size="13" fill="{ink}">Menu-bar mark</text>')
        for i, (size, x) in enumerate(((16, 36), (18, 128), (32, 224))):
            name = "mark.svg" if half == 0 else "mark-light.svg"
            parts.append(svg_copy(name, half + x, 415, size, f"m{half}_{i}_"))
            parts.append(f'<text x="{half + x}" y="481" font-family="Arial" font-size="12" fill="{ink}">{size} px</text>')
    parts.append("</svg>")
    preview = ROOT / "preview.svg"
    preview.write_text("\n".join(parts) + "\n")
    render(preview, ROOT / "preview.png", 960)


def main():
    OUT.mkdir(exist_ok=True)
    for source in ("app-icon.svg", "mark.svg", "mark-light.svg"):
        ET.parse(ROOT / source)
    for size in SIZES:
        render(ROOT / "app-icon.svg", OUT / f"app-{size}.png", size)
    for variant in ("mark", "mark-light"):
        for size in (16, 18, 32, 36):
            render(ROOT / f"{variant}.svg", OUT / f"{variant}-{size}.png", size)

    # Modern Windows ICO containers can embed full-alpha PNG images.
    ico_sizes = (16, 24, 32, 48, 64, 128, 256)
    data = [(s, (OUT / f"app-{s}.png").read_bytes()) for s in ico_sizes]
    offset = 6 + 16 * len(data)
    entries, images = [], []
    for size, png in data:
        dimension = 0 if size == 256 else size
        entries.append(struct.pack("<BBBBHHII", dimension, dimension, 0, 0, 1, 32, len(png), offset))
        images.append(png)
        offset += len(png)
    (OUT / "sidenib.ico").write_bytes(struct.pack("<HHH", 0, 1, len(data)) + b"".join(entries + images))

    if sys.platform == "darwin":
        with tempfile.TemporaryDirectory(prefix="sidenib-iconset-") as temp:
            iconset = Path(temp) / "Sidenib.iconset"
            iconset.mkdir()
            for size in (16, 32, 128, 256, 512):
                shutil.copyfile(OUT / f"app-{size}.png", iconset / f"icon_{size}x{size}.png")
                shutil.copyfile(OUT / f"app-{size * 2}.png", iconset / f"icon_{size}x{size}@2x.png")
            subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(OUT / "sidenib.icns")], check=True)

    write_preview()
    dimensions = {}
    for path in sorted(OUT.glob("*.png")):
        png = path.read_bytes()
        assert png[:8] == b"\x89PNG\r\n\x1a\n", path
        dimensions[path.name] = list(struct.unpack(">II", png[16:24]))
        assert dimensions[path.name] == [int(path.stem.rsplit("-", 1)[1])] * 2, path
    (OUT / "manifest.json").write_text(json.dumps({"renderer": RENDERER, "dimensions": dimensions}, indent=2) + "\n")
    print(json.dumps({"png_exports": len(dimensions), "ico": True, "icns": sys.platform == "darwin", "preview": str(ROOT / "preview.png")}))


if __name__ == "__main__":
    main()
