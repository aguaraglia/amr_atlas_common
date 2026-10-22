#!/usr/bin/env python3
"""Assert a built edition site carries the engine version and both languages."""

from __future__ import annotations

import sys
from pathlib import Path


def fail(message: str) -> None:
    raise SystemExit(message)


def main() -> None:
    if len(sys.argv) != 2:
        fail("Usage: check-build.py SITE_DIR")
    site = Path(sys.argv[1])
    version = Path(__file__).resolve().parents[1].joinpath("VERSION").read_text(encoding="utf-8").strip()
    italian = (site / "index.html").read_text(encoding="utf-8")
    english = (site / "en" / "index.html").read_text(encoding="utf-8")
    core = (site / "assets" / "atlas-core.js").read_text(encoding="utf-8")
    styles = (site / "assets" / "styles.css").read_text(encoding="utf-8")
    i18n = (site / "assets" / "i18n.js").read_text(encoding="utf-8")
    stamp = f"/* amr-atlas-common {version} */"
    checks = [
        ('lang="it"', italian),
        ("Esplora l'atlante", italian),
        ("Azzera filtri", italian),
        ("Base cartografica pronta", italian),
        (f"assets/atlas-core.js?v={version}", italian),
        (f"assets/styles.css?v={version}", italian),
        (f'content="amr-atlas-common {version}"', italian),
        ('lang="en"', english),
        ("Explore the atlas", english),
        ("Reset filters", english),
        ("Basemap ready", english),
        (f"../assets/atlas-core.js?v={version}", english),
        (f"../assets/i18n.js?v={version}", english),
        ('data-asset-base="../"', english),
    ]
    for needle, haystack in checks:
        if needle not in haystack:
            fail(f"Missing {needle!r}")
    if "Esplora l'atlante" in english:
        fail("English page still contains the Italian sidebar kicker")
    if "Explore the atlas" in italian:
        fail("Italian page contains the English sidebar kicker")
    if not core.startswith(stamp) or not styles.startswith(stamp) or not i18n.startswith(stamp):
        fail("Built asset is missing the version header")
    if "window.amrT" not in i18n or "window.amrAsset" not in core:
        fail("Runtime is not wired to the dictionary")
    for page in ("evidence.html", "publications.html", "methodology.html", "about.html", "dissemination.html"):
        if not (site / "en" / page).is_file():
            fail(f"Missing en/{page}")
    print(f"CHECK_OK={site}")


if __name__ == "__main__":
    main()
