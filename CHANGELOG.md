# Changelog

## 0.5.11

First version published from this repository. The runtime history up to "Restore a disclosure triangle on exploded layer groups" is preserved; this release adds the public packaging around it.

- Italian and English pages are generated from one dictionary (`shared/i18n.js`). English pages are written under `en/`.
- Edition builds can pin a tag (`v0.5.11`) instead of a sibling-folder copy. `scripts/build-edition.ps1` remains the Windows entry point. `scripts/build-edition.py` is the cross-platform entry point.
- Built JavaScript and CSS carry a `/* amr-atlas-common 0.5.11 */` header. Stylesheets and scripts are linked with `?v=0.5.11`.
- MIT licence for the code, and a note that derived data follow their source licences.
- Line endings are LF (`.gitattributes`). Temporary writer scripts were not part of the imported history and are not in this tree.
