#!/usr/bin/env python3
"""Strip a near-white background from a PNG and write transparent output.

Usage:
    python3 scripts/remove-bg.py <input.png> <output.png> [--threshold 240] [--feather 8]

The script:
  1. Loads the image and converts to RGBA.
  2. For every pixel whose RGB channels are ALL >= threshold, sets alpha=0.
  3. For pixels in the [threshold-feather, threshold) band, scales alpha linearly
     so the edge softens instead of jagging.

This works well for logos on a flat (off-)white background. It will NOT work on
photos or busy backgrounds — for those use rembg.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


def remove_white_bg(src: Path, dst: Path, threshold: int, feather: int) -> None:
    img = Image.open(src).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    low = max(0, threshold - feather)
    span = max(1, threshold - low)

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            m = min(r, g, b)
            if m >= threshold:
                pixels[x, y] = (r, g, b, 0)
            elif m >= low:
                # Linear ramp: m=low → keep, m=threshold → drop.
                frac = (threshold - m) / span
                pixels[x, y] = (r, g, b, int(round(a * frac)))

    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "PNG", optimize=True)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--threshold", type=int, default=240, help="RGB min >= this → fully transparent (0-255)")
    p.add_argument("--feather", type=int, default=8, help="ramp width below threshold for soft edge")
    args = p.parse_args()

    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 1

    remove_white_bg(args.input, args.output, args.threshold, args.feather)
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
