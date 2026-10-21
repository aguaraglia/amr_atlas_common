# AMR Atlas Common

Shared static engine for the regional One Health antimicrobial-resistance atlases. It ships the Leaflet runtime, styles, HTML templates, outreach modules, publication catalogue, and the build that turns an edition into a GitHub Pages site.

This repository does not contain regional observations. Sardinia and Lombardy keep their own data, sources, and publication decisions:

- [Sardinia One Health AMR Atlas](https://github.com/aguaraglia/sardinia-one-health-amr-atlas)
- [Lombardy One Health AMR Atlas](https://github.com/aguaraglia/lombardy-one-health-amr-atlas)

The public site for an edition is produced in that edition. This repository is the engine those builds pin.

## Edition contract

An edition provides:

- `atlas.config.json` with `id`, `regionCode`, `regionName`, `title`, `shortName`, `brandIcon`, `dataStatusLabel`, `publicScopeSummary`, and `map.center` (latitude, longitude)
- `public/data/layer-catalog.json`
- `public/data/evidence-catalog.json`
- `public/data/literature-catalog.json`
- approved assets under `public/`
- provenance and publishability notes under `metadata/`

The runtime draws only records whose `publication_status` is `public_approved`. `candidate`, `verified`, and `restricted` stay off the public map. The publications page may still list a candidate as a context source, with that status visible.

`label_en` on a layer, and `popupLabels_en`, are optional English labels. When they are absent, the English page keeps the edition's original label.

## What the build writes

Six pages, in Italian at the site root and in English under `en/`: Atlas, Evidence, Publications, Method, Project, Dissemination. Both languages use the same scripts. `shared/i18n.js` is the dictionary for interface text. Outreach lessons stay in `shared/dissemination.js`, which already carries Italian and English copy and follows the same language (`document.documentElement.lang`).

English pages set `data-asset-base="../"`. Catalog and geometry fetches go through that prefix, so a page under `en/` still reads `public/data/` at the site root.

Built JavaScript and CSS start with `/* amr-atlas-common 0.5.11 */`. The HTML links them with `?v=0.5.11`, taken from `VERSION`, and sets `<meta name="generator" content="amr-atlas-common 0.5.11">`.

## Pin a version

Editions should not keep a sibling copy of this tree. Pin the tag `v0.5.11` and build from that snapshot. The tag is created on `main` after this release is merged; until that tag exists, point `--engine` at a local checkout.

From a machine that already has this repository:

```bash
python3 scripts/build-edition.py --edition /path/to/edition --engine v0.5.11
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-edition.ps1 `
  -EditionRoot 'K:\path\to\edition' `
  -EngineVersion v0.5.11
```

From an edition that does not have the engine at all:

```bash
ENGINE=v0.5.11
mkdir -p .engine-src
curl -fsSL "https://github.com/aguaraglia/amr_atlas_common/archive/refs/tags/${ENGINE}.tar.gz" \
  | tar -xz -C .engine-src --strip-components=1
python3 .engine-src/scripts/build-edition.py --edition .
```

`--engine` accepts a directory or a tag. A tag is downloaded from `https://github.com/aguaraglia/amr_atlas_common/archive/refs/tags/<tag>.tar.gz`. The script that runs should be the script from that same tag, so the templates and the builder stay together.

`-EditionRoot` without `-EngineVersion` still builds from the engine directory that contains the script. Existing edition wrappers that call `build-edition.ps1 -EditionRoot` keep working once they point at a pinned checkout instead of a sibling folder.

GitHub Pages for this repository, once enabled on `main`, serves the default branch at `https://aguaraglia.github.io/amr_atlas_common/`. That URL follows `main`. It is a convenient way to read the current engine. It is not a pin. Editions pin the tag.

## Local build

```bash
python3 scripts/build-edition.py --edition /path/to/edition
```

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-edition.ps1 `
  -EditionRoot 'K:\path\to\edition'
```

Output is `site/`. An existing `site/` is moved to `build-backups/` first. `tests/fixture-edition` is an empty catalog used to check the build. It is not an atlas edition.

## Versioning

`VERSION` is the engine version. The changelog starts at 0.5.11, the first release of this public repository. Compatible editions declare the tag they were built from (`v0.5.11`) rather than copying files by hand.

## Licence

Code in this repository is MIT. See `LICENSE`. Derived regional data are not included here and follow the licences of their sources. See `DATA.md`.
