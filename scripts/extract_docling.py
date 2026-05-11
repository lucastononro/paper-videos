#!/usr/bin/env python3
"""Docling-backed paper extractor.

Fast alternative to Marker for the paper-videos pipeline. Uses Docling's
layout model to identify formula bboxes, then makes one Claude vision call
per formula to recover its LaTeX. Emits the same paper.md schema Marker
produces (with `$$...$$` block math), which the existing TS regex extractor
in extract-paper.ts then turns into equations.json.

Trade-off vs Marker:
  Marker:  ~5-30 min on CPU per paper, no API calls, OCR-derived LaTeX
           sometimes hallucinated.
  Docling: ~30-60s on CPU per paper for layout, plus ~1s + ~300 tokens per
           formula via Claude vision. A 20-equation paper costs ~$0.05 and
           finishes in 1-2 minutes total.

Usage:
  python scripts/extract_docling.py <input.pdf> <output_dir>

Writes:
  <output_dir>/paper.md
  <output_dir>/paper-md-assets/  (figure crops Docling extracted, if any)

The TS wrapper (src/tools/extract-paper.ts) then runs its existing
extractEquations(md) regex → equations.json.

Requires:
  - docling (>=2.0)
  - pymupdf (for cropping formula regions to PNG before sending to Claude)
  - anthropic SDK
  - ANTHROPIC_API_KEY in env
"""
from __future__ import annotations
import argparse
import base64
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Iterable


_LATEX_PROMPT = """You will see a single image of a typeset mathematical formula
extracted from a research paper. Output ONLY the LaTeX source that would
typeset this exact formula — no preamble, no explanation, no $$ delimiters,
no surrounding code fences. Use standard amsmath / mathtools commands.

If the image is not a formula or you cannot read it confidently, output the
single token: SKIP

Formula:"""


def _ensure_deps() -> None:
    try:
        import docling  # noqa: F401
        import fitz  # noqa: F401
        import anthropic  # noqa: F401
    except ImportError as e:
        print(f"ERROR: missing dep — {e}", file=sys.stderr)
        print("Install with: uv pip install docling pymupdf anthropic", file=sys.stderr)
        sys.exit(2)


def _crop_formula_to_png(pdf_path: Path, page_no: int, bbox, out_png: Path,
                          dpi: int = 220, pad: float = 6.0) -> bool:
    """Crop the formula bbox from the PDF page and save as PNG.
    Returns True if the crop is non-empty.
    Docling bboxes are in PDF points with BOTTOMLEFT origin by default.
    """
    import fitz
    with fitz.open(str(pdf_path)) as doc:
        page = doc.load_page(page_no - 1)  # 0-based
        ph = float(page.rect.height)
        x0 = float(getattr(bbox, "l", 0.0)) - pad
        x1 = float(getattr(bbox, "r", 0.0)) + pad
        y_t = float(getattr(bbox, "t", 0.0))
        y_b = float(getattr(bbox, "b", 0.0))
        # Convert BOTTOMLEFT → image coords (TOPLEFT). t is "from bottom"
        # (larger = higher); flip if needed.
        origin = str(getattr(bbox, "coord_origin", "")).upper()
        if "BOTTOMLEFT" in origin or y_t > y_b:
            top_pdf = max(y_t, y_b)
            bot_pdf = min(y_t, y_b)
            y0 = ph - top_pdf - pad
            y1 = ph - bot_pdf + pad
        else:
            y0 = y_t - pad
            y1 = y_b + pad
        if x1 - x0 < 4 or y1 - y0 < 4:
            return False
        rect = fitz.Rect(max(0, x0), max(0, y0), min(page.rect.width, x1),
                         min(page.rect.height, y1))
        if rect.is_empty:
            return False
        pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72.0, dpi / 72.0),
                              clip=rect, alpha=False)
        pix.save(str(out_png))
        return out_png.exists() and out_png.stat().st_size > 200


def _latex_from_image(client, model: str, png_path: Path) -> str | None:
    """Single Claude vision call → LaTeX string (or None on SKIP/failure)."""
    with open(png_path, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode()
    try:
        msg = client.messages.create(
            model=model,
            max_tokens=400,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {
                    "type": "base64", "media_type": "image/png", "data": b64,
                }},
                {"type": "text", "text": _LATEX_PROMPT},
            ]}],
        )
        raw = "".join(b.text for b in msg.content if hasattr(b, "text")).strip()
        # Strip code fences if Claude added them anyway.
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("latex"):
                raw = raw[5:]
            raw = raw.strip().rstrip("`").strip()
        # Strip $$ delimiters if present.
        if raw.startswith("$$") and raw.endswith("$$"):
            raw = raw[2:-2].strip()
        elif raw.startswith("$") and raw.endswith("$"):
            raw = raw[1:-1].strip()
        if raw.upper() == "SKIP" or not raw:
            return None
        return raw
    except Exception as e:  # noqa: BLE001
        print(f"  [latex-call failed: {e}]", file=sys.stderr)
        return None


def _walk_formulas(doc) -> Iterable[tuple[int, object]]:
    """Yield (page_no, bbox) for every formula item docling identified."""
    for el in doc.iterate_items():
        item = el[0] if isinstance(el, tuple) else el
        label = str(getattr(item, "label", "") or "").lower()
        if label != "formula":
            continue
        prov = getattr(item, "prov", None)
        if not prov:
            continue
        for p in prov:
            bbox = getattr(p, "bbox", None)
            page_no = getattr(p, "page_no", None)
            if bbox is None or page_no is None:
                continue
            yield int(page_no), bbox


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Docling-fast paper extractor — paper.md with LaTeX equations.")
    parser.add_argument("pdf_path", type=Path, help="input PDF")
    parser.add_argument("output_dir", type=Path, help="directory to write paper.md into")
    parser.add_argument("--model", default=os.environ.get("ANTHROPIC_MODEL",
                                                          "claude-sonnet-4-6"),
                        help="Anthropic model for the vision LaTeX pass")
    parser.add_argument("--max-formulas", type=int, default=80,
                        help="cap on formulas to LaTeX-OCR (cost guard)")
    args = parser.parse_args()

    _ensure_deps()
    if not args.pdf_path.exists():
        print(f"ERROR: PDF not found: {args.pdf_path}", file=sys.stderr)
        return 2
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set; needed for LaTeX vision pass",
              file=sys.stderr)
        return 2

    args.output_dir.mkdir(parents=True, exist_ok=True)
    img_dir = args.output_dir / "paper-md-assets"
    img_dir.mkdir(exist_ok=True)

    from docling.document_converter import DocumentConverter  # type: ignore
    from anthropic import Anthropic

    print(f"  [docling] parsing {args.pdf_path.name}…", file=sys.stderr)
    converter = DocumentConverter()
    result = converter.convert(str(args.pdf_path))
    doc = result.document

    # Collect formulas first so we know how many vision calls.
    formulas = list(_walk_formulas(doc))
    print(f"  [docling] found {len(formulas)} formula items", file=sys.stderr)

    if len(formulas) > args.max_formulas:
        print(f"  [docling] capping to first {args.max_formulas} (cost guard); "
              f"raise --max-formulas to override", file=sys.stderr)
        formulas = formulas[:args.max_formulas]

    # Crop each formula + send to Claude for LaTeX.
    client = Anthropic()
    formula_latex: dict[int, str] = {}  # docling-item-index → LaTeX

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for i, (page_no, bbox) in enumerate(formulas):
            png = tmp_path / f"f{i:03d}.png"
            if not _crop_formula_to_png(args.pdf_path, page_no, bbox, png):
                continue
            latex = _latex_from_image(client, args.model, png)
            if latex:
                formula_latex[i] = latex
            if (i + 1) % 5 == 0:
                print(f"  [latex] {i + 1}/{len(formulas)} formulas processed",
                      file=sys.stderr)

    print(f"  [latex] recovered {len(formula_latex)}/{len(formulas)} formulas",
          file=sys.stderr)

    # Build the markdown. Docling's MarkdownDocumentSerializer writes
    # formulas as inline placeholders. We replace each formula's
    # placeholder with $$<latex>$$ in author order.
    md = doc.export_to_markdown()

    # Docling typically writes formulas as either an empty `$ $` line, a
    # `<missing-text>` token, or just absent text in their bbox slot.
    # Conservative strategy: APPEND an "Equations" section at the end of
    # the markdown listing all recovered formulas as `$$...$$` blocks.
    # This guarantees the TS regex extractor (extractEquations) finds them
    # and emits a complete equations.json. The storyteller's `[VISUAL:
    # equationCard eq:N]` cues still resolve correctly because the cue
    # references id, not position-in-prose.
    if formula_latex:
        md_extra = ["", "", "## Equations (auto-extracted via Docling+LaTeX-OCR)", ""]
        for i in sorted(formula_latex):
            page_no, _ = formulas[i]
            md_extra.append(f"<!-- formula on page {page_no} -->")
            md_extra.append("$$")
            md_extra.append(formula_latex[i])
            md_extra.append("$$")
            md_extra.append("")
        md = md + "\n".join(md_extra)

    paper_md = args.output_dir / "paper.md"
    paper_md.write_text(md, encoding="utf-8")
    print(f"  [docling] wrote {paper_md} ({len(md):,} chars)", file=sys.stderr)

    # Emit a small JSON status to stdout for the TS wrapper to consume.
    print(json.dumps({
        "paper_md": str(paper_md),
        "formulas_found": len(formulas),
        "formulas_with_latex": len(formula_latex),
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
