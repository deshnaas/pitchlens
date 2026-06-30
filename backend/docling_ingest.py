"""
IBM Docling — parse FIFA Laws of the Game PDF into structured rules.
Drop any PDF into backend/pdfs/ and run ingest_all_pdfs() on startup.
"""

import json
import os
from pathlib import Path

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import PdfFormatOption

PDFS_DIR   = Path(__file__).parent / "pdfs"
PARSED_DIR = Path(__file__).parent / "parsed"

# Map event types → FIFA Law numbers to look up
EVENT_TO_LAWS: dict[str, list[str]] = {
    "foul":          ["Law 12", "Law 5"],
    "yellow_card":   ["Law 12"],
    "red_card":      ["Law 12"],
    "penalty":       ["Law 12", "Law 14"],
    "offside":       ["Law 11"],
    "goal":          ["Law 10"],
    "corner":        ["Law 17"],
    "free_kick":     ["Law 13", "Law 12"],
    "throw_in":      ["Law 15"],
    "goal_kick":     ["Law 16"],
    "handball":      ["Law 12"],
    "substitution":  ["Law 3"],
    "var":           ["Law 12", "Law 5"],
    "pass":          [],
    "carry":         [],
    "pressure":      [],
    "shot":          ["Law 10"],
    "save":          ["Law 10"],
    "clearance":     [],
    "dribble":       [],
    "tackle":        ["Law 12"],
    "interception":  [],
    "block":         [],
    "duel":          ["Law 12"],
}

_rules_cache: dict[str, str] = {}


def _converter() -> DocumentConverter:
    pipeline_opts = PdfPipelineOptions()
    pipeline_opts.do_ocr = False          # FIFA PDF is born-digital
    pipeline_opts.do_table_structure = True
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_opts)
        }
    )


def ingest_pdf(pdf_path: Path) -> dict[str, str]:
    """
    Parse one PDF with Docling.
    Returns a dict: { section_heading → text_block }
    """
    cache_file = PARSED_DIR / (pdf_path.stem + ".json")

    if cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    print(f"[Docling] Parsing {pdf_path.name} …")
    converter = _converter()
    result    = converter.convert(str(pdf_path))
    doc       = result.document

    sections: dict[str, str] = {}
    current_heading = "General"
    current_text: list[str] = []

    for item, _ in doc.iterate_items():
        label = item.label if hasattr(item, "label") else ""
        text  = item.text  if hasattr(item, "text")  else ""

        if not text:
            continue

        if label in ("section_header", "title", "page_header"):
            if current_text:
                sections[current_heading] = " ".join(current_text).strip()
            current_heading = text.strip()
            current_text    = []
        else:
            current_text.append(text.strip())

    if current_text:
        sections[current_heading] = " ".join(current_text).strip()

    PARSED_DIR.mkdir(exist_ok=True)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(sections, f, ensure_ascii=False, indent=2)

    print(f"[Docling] Done — {len(sections)} sections extracted from {pdf_path.name}")
    return sections


def ingest_all_pdfs() -> None:
    """Call once on startup. Parses every PDF in pdfs/ and builds rules_cache."""
    global _rules_cache
    _rules_cache = {}

    pdfs = list(PDFS_DIR.glob("*.pdf"))
    if not pdfs:
        print("[Docling] No PDFs found in backend/pdfs/ — rule context will be empty.")
        return

    for pdf in pdfs:
        sections = ingest_pdf(pdf)
        _rules_cache.update(sections)

    print(f"[Docling] Rules cache ready — {len(_rules_cache)} sections total.")


def get_rules_for_event(event_type: str, max_chars: int = 1200) -> str:
    """
    Return the FIFA rule text relevant to this event type.
    Falls back gracefully if no PDFs were loaded.
    """
    if not _rules_cache:
        return ""

    law_keys = EVENT_TO_LAWS.get(event_type.lower(), [])
    if not law_keys:
        return ""

    chunks: list[str] = []
    for heading, text in _rules_cache.items():
        if any(law.lower() in heading.lower() for law in law_keys):
            chunks.append(f"[{heading}]\n{text}")

    combined = "\n\n".join(chunks)
    return combined[:max_chars] if len(combined) > max_chars else combined
