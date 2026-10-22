#!/usr/bin/env python3
"""Build a regional AMR Atlas edition from this engine.

The engine root is the parent of this script, a local directory, or a
published tag (v0.5.11) downloaded from GitHub. Italian pages are written at
the site root. English pages are written under en/. Shared assets are copied
once and stamped with the engine VERSION.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tarfile
import tempfile
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

GITHUB_REPO = "aguaraglia/amr_atlas_common"
TEMPLATES = (
    "index.html",
    "evidence.html",
    "publications.html",
    "methodology.html",
    "about.html",
    "dissemination.html",
)
NAV_TOKENS = {
    "index.html": "{{NAV_INDEX}}",
    "evidence.html": "{{NAV_EVIDENCE}}",
    "publications.html": "{{NAV_PUBLICATIONS}}",
    "methodology.html": "{{NAV_METHOD}}",
    "about.html": "{{NAV_ABOUT}}",
    "dissemination.html": "{{NAV_DISSEMINATION}}",
}
SHARED_FILES = (
    "atlas-core.js",
    "sidebar-filters.js",
    "publications.js",
    "dissemination.js",
    "outreach-module-one.js",
    "outreach-module-two.js",
    "outreach-modules-three-twelve.js",
    "i18n.js",
    "styles.css",
    "regional-base.css",
)
REQUIRED_FIELDS = (
    "id",
    "regionCode",
    "regionName",
    "title",
    "shortName",
    "brandIcon",
    "dataStatusLabel",
    "publicScopeSummary",
)
STAMP_RE = re.compile(r"^/\* amr-atlas-common [^*]*\*/\n")
TOKEN_RE = re.compile(r"\{\{t:([A-Za-z0-9_.]+)\}\}")
TAG_RE = re.compile(r"^v\d+\.\d+\.\d+$")


def fail(message: str) -> None:
    raise SystemExit(message)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def load_messages(i18n_path: Path) -> dict:
    raw = read_text(i18n_path)
    start = raw.find("/* AMR_ATLAS_MESSAGES_START */")
    end = raw.find("/* AMR_ATLAS_MESSAGES_END */")
    if start < 0 or end < 0 or end <= start:
        fail(f"i18n markers missing in {i18n_path}")
    blob = raw[start + len("/* AMR_ATLAS_MESSAGES_START */") : end].strip()
    messages = json.loads(blob)
    italian = set(messages.get("it", {}))
    english = set(messages.get("en", {}))
    if italian != english:
        fail(
            "i18n key mismatch: "
            f"missing en {sorted(italian - english)}; missing it {sorted(english - italian)}"
        )
    return messages


def apply_messages(content: str, table: dict) -> str:
    def replace(match: re.Match) -> str:
        key = match.group(1)
        if key not in table:
            fail(f"Missing i18n key: {key}")
        return str(table[key])

    return TOKEN_RE.sub(replace, content)


def stamp_text(content: str, version: str) -> str:
    body = STAMP_RE.sub("", content.lstrip("\ufeff"))
    return f"/* amr-atlas-common {version} */\n{body}"


def resolve_engine(spec: str | None) -> tuple[Path, tempfile.TemporaryDirectory | None]:
    if not spec:
        return Path(__file__).resolve().parents[1], None
    candidate = Path(spec)
    if candidate.exists():
        return candidate.resolve(), None
    tag = spec if spec.startswith("v") else f"v{spec}"
    if not TAG_RE.fullmatch(tag):
        fail(f"Engine not found: {spec}")
    url = f"https://github.com/{GITHUB_REPO}/archive/refs/tags/{tag}.tar.gz"
    temp = tempfile.TemporaryDirectory(prefix="amr-engine-")
    archive = Path(temp.name) / "engine.tar.gz"
    try:
        urllib.request.urlretrieve(url, archive)
    except Exception as error:
        temp.cleanup()
        fail(f"Could not download {url}: {error}")
    with tarfile.open(archive, "r:gz") as bundle:
        bundle.extractall(temp.name, filter="data")
    roots = [path for path in Path(temp.name).iterdir() if path.is_dir()]
    if len(roots) != 1:
        temp.cleanup()
        fail(f"Unexpected archive layout for {tag}")
    return roots[0], temp


def copy_tree(source: Path, destination: Path) -> None:
    if not source.exists():
        return
    destination.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        target = destination / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def build(edition: Path, engine: Path, output_name: str) -> Path:
    config_path = edition / "atlas.config.json"
    if not config_path.is_file():
        fail(f"Missing atlas.config.json: {config_path}")
    config = json.loads(read_text(config_path))
    for field in REQUIRED_FIELDS:
        if not str(config.get(field, "")).strip():
            fail(f"Missing required config field: {field}")
    center = (config.get("map") or {}).get("center")
    if not isinstance(center, list) or len(center) != 2:
        fail("map.center must contain latitude and longitude")

    version = read_text(engine / "VERSION").strip()
    if not version:
        fail(f"VERSION is empty in {engine}")
    messages = load_messages(engine / "shared" / "i18n.js")

    staging = edition / f".build-staging-{uuid.uuid4().hex}"
    if staging.exists():
        shutil.rmtree(staging)
    (staging / "assets").mkdir(parents=True)
    try:
        for template_name in TEMPLATES:
            template = read_text(engine / "templates" / template_name)
            for language, folder, asset_base in (("it", "", ""), ("en", "en", "../")):
                page_it = template_name if language == "it" else f"../{template_name}"
                page_en = f"en/{template_name}" if language == "it" else template_name
                tokens = {
                    "{{TITLE}}": str(config["title"]),
                    "{{REGION_CODE}}": str(config["regionCode"]),
                    "{{REGION_NAME}}": str(config["regionName"]),
                    "{{SHORT_NAME}}": str(config["shortName"]),
                    "{{DATA_STATUS}}": str(config["dataStatusLabel"]),
                    "{{PUBLIC_SCOPE_SUMMARY}}": str(config["publicScopeSummary"]),
                    "{{BRAND_ICON}}": str(config["brandIcon"]),
                    "{{ENGINE_VERSION}}": version,
                    "{{LANG}}": language,
                    "{{ASSET_BASE}}": asset_base,
                    "{{IT_HREF}}": page_it,
                    "{{EN_HREF}}": page_en,
                    "{{IT_ATTR}}": ' class="active"' if language == "it" else "",
                    "{{EN_ATTR}}": ' class="active"' if language == "en" else "",
                }
                for page, token in NAV_TOKENS.items():
                    tokens[token] = ' class="active"' if page == template_name else ""
                rendered = apply_messages(template, messages[language])
                for token, value in tokens.items():
                    rendered = rendered.replace(token, value)
                if "{{" in rendered:
                    fail(f"Unresolved token in {language}/{template_name}")
                destination = staging / folder / template_name if folder else staging / template_name
                write_text(destination, rendered)

        for shared_name in SHARED_FILES:
            source = engine / "shared" / shared_name
            if not source.is_file():
                fail(f"Missing shared file: {source}")
            write_text(staging / "assets" / shared_name, stamp_text(read_text(source), version))

        outreach = engine / "shared" / "outreach-assets"
        if outreach.is_dir():
            copy_tree(outreach, staging / "public" / "outreach" / "assets")

        config_js = "/* amr-atlas-common " + version + " */\n"
        config_js += "window.AMR_ATLAS_ENGINE = " + json.dumps(version) + ";\n"
        config_js += "window.AMR_ATLAS_CONFIG = " + json.dumps(config, ensure_ascii=False, separators=(",", ":")) + ";\n"
        write_text(staging / "atlas-config.js", config_js)
        write_text(staging / ".nojekyll", "")

        public_source = edition / "public"
        if public_source.is_dir():
            copy_tree(public_source, staging / "public")

        brand_rel = Path(str(config["brandIcon"]))
        brand_source = staging / brand_rel
        brand_mirror = staging / "assets" / brand_rel
        if not brand_source.is_file():
            fail(f"Build validation failed: missing {config['brandIcon']}")
        brand_mirror.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(brand_source, brand_mirror)

        required = [
            "index.html",
            "evidence.html",
            "publications.html",
            "methodology.html",
            "about.html",
            "dissemination.html",
            "en/index.html",
            "en/evidence.html",
            "en/publications.html",
            "en/methodology.html",
            "en/about.html",
            "en/dissemination.html",
            "atlas-config.js",
            "assets/i18n.js",
            "assets/atlas-core.js",
            "assets/sidebar-filters.js",
            "assets/publications.js",
            "assets/dissemination.js",
            "public/data/layer-catalog.json",
            "public/data/evidence-catalog.json",
            "public/data/literature-catalog.json",
            str(config["brandIcon"]),
            "public/outreach/assets/microbe-bacteria.png",
        ]
        for relative in required:
            if not (staging / relative).exists():
                fail(f"Build validation failed: missing {relative}")

        output = edition / output_name
        if output.exists():
            backup_root = edition / "build-backups"
            backup_root.mkdir(parents=True, exist_ok=True)
            backup = backup_root / ("site-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
            shutil.move(str(output), str(backup))
        shutil.move(str(staging), str(output))
    except Exception:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        raise
    return edition / output_name, version


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a regional AMR Atlas edition.")
    parser.add_argument("--edition", required=True, help="Path to the edition root (atlas.config.json).")
    parser.add_argument("--output", default="site", help="Output directory name inside the edition. Default: site.")
    parser.add_argument(
        "--engine",
        default="",
        help="Engine directory, or a tag such as v0.5.11. Default: this repository.",
    )
    args = parser.parse_args()
    edition = Path(args.edition).resolve()
    if not edition.is_dir():
        fail(f"Edition root not found: {edition}")
    engine, temp = resolve_engine(args.engine or None)
    try:
        output, version = build(edition, engine, args.output)
    finally:
        if temp is not None:
            temp.cleanup()
    print(f"BUILD_OK={output}")
    print(f"COMMON_VERSION={version}")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
