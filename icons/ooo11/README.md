# OO11 document icons

The six `.ico` files here are the **OpenOffice.org 1.1 document icons** from
Apache OpenOffice:

    https://svn.apache.org/repos/asf/openoffice/trunk/main/sysui/desktop/icons/

Taken from trunk revision 1939163 on 16 October 2026. They are licensed under
the **Apache License 2.0**. The `makefile.mk` in that directory carries the
standard ASF header, and OpenOffice.org releases from 3.4 onwards are Apache
licensed. A copy of the licence is kept at `LICENSE` in the repository root.

| File | Becomes | Used for |
| --- | --- | --- |
| `ooo11-writer-doc.ico` | `#i-doc` | Word |
| `ooo11-calc-doc.ico` | `#i-grid` | Excel |
| `ooo11-impress-doc.ico` | `#i-slide` | PowerPoint |
| `ooo11-base-doc.ico` | `#i-db` | Access, and Access Runtime in the version list |
| `ooo11-draw-doc.ico` | `#i-shapes` | Publisher, Visio |
| `ooo11-chart-doc.ico` | `#i-chart` | Project |

**Changes made** (Apache License 2.0, section 4b): each icon was scaled to
16×16 with a box filter, hard-edged (alpha thresholded at 50%), and quantised
to the 16-colour Windows 3.1 palette the rest of the screen uses. The result is
written into the `ooo11:start` … `ooo11:end` region of `site/index.html` as
inline `<symbol>`s by:

    node tools/make-icons.mjs

The other icons in the set (`math`, `master`, the four `-tem` templates) are not
used, so they are not vendored here.

## Toolbar icons

`toolbar/` holds the **OpenOffice.org 1.1 toolbar icons** from the icon-evolution
page on openoffice.org:

    https://www.openoffice.org/ui/VisualDesign/OOo_icon_evolution.html
    https://www.openoffice.org/ui/VisualDesign/gifs/Icons/history/<name>_OOo1.png

Each source file is a 72×32 PNG holding two icons side by side: the small
(16×16) and the large (26×26) version. `tools/make-icons.mjs` clears the tile
background (flood fill from the border, so white *inside* a drawing survives),
splits the sprite on the empty columns, and emits each size that the page uses:

| Source | Small | Large | Used for |
| --- | --- | --- | --- |
| `save_OOo1.png` | `#i-save-16` | `#i-save-26` | the configuration.xml card and its Save button |
| `copy_OOo1.png` | `#i-copy-16` | `#i-copy-26` | every Copy button and the one-liner card |
| `open_OOo1.png` | `#i-open-16` | `#i-open-26` | the Microsoft download link, SHA256SUMS, card 3 |
| `help_OOo1.png` | `#i-help-16` | `#i-help-26` | the Help & FAQ rail link and the Help card |
| `hyperlink_OOo1.png` | `#i-link-16` | `#i-link-26` | the Source code rail link and the verify card |
| `text_OOo1.png` | `#i-text-16` |  | OneNote in the apps list |
| `spellcheck_OOo1.png` | `#i-spellcheck-16` |  | every row of the languages list |
| `navigator_OOo1.png` | `#i-navigator-16` |  | the Microsoft 365 products in the version list |
| `plugin_OOo1.png` | `#i-plugin-16` |  | the volume-licence products in the version list |
| `ok_OOo1.png` | `#i-ok-16` |  | the "Latest available" build choice |
| `insertcolumn_OOo1.png` | `#i-column-16` |  | the "A specific build" choice |
| `stylist_OOo1.png` | `#i-stylist-16` |  | the "Match what is already installed" choice |

A 26px version exists only where a card heading uses one: a size nothing points at is not generated, and the
browser-free checks fail if any symbol is ever left unreferenced.

Flat areas are emitted as single `<rect>`s (greedy rectangles rather than one rect per row), which keeps the
generated block around 60 KB instead of 200 KB.

The OOo 1.1 toolbar icons already use palette-adjacent colours (olive, black,
white and two greys), so the conversion is faithful rather than approximate.

You can look at any source sprite with:

    node tools/make-icons.mjs --inspect icons/ooo11/toolbar/save_OOo1.png

Apache OpenOffice and OpenOffice.org are trademarks of The Apache Software
Foundation. This project is unofficial and not affiliated with them; the icons
are used as artwork only, and no OpenOffice branding or name is replicated.
