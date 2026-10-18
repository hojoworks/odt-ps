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
| `ooo11-base-doc.ico` | `#i-db` | Access |
| `ooo11-draw-doc.ico` | `#i-shapes` | Publisher, Visio |
| `ooo11-chart-doc.ico` | `#i-chart` | Project |

**Changes made** (Apache License 2.0, section 4b): each icon was scaled to
16×16 with a box filter, hard-edged (alpha thresholded at 50%), and quantised
to the 16-colour Windows 9x palette the rest of the screen uses. The result is
painted into `site/icons.png`, with one background position per icon in
`site/icons.css`, by:

    node tools/make-icons.mjs

The other icons in the set (`math`, `master`, the four `-tem` templates) are not
used, so they are not vendored here.

## Toolbar icons

`toolbar/` holds the **OpenOffice.org 1.1 toolbar icons** (and one from the
2.1 set) from the icon-evolution page on openoffice.org:

    https://www.openoffice.org/ui/VisualDesign/OOo_icon_evolution.html
    https://www.openoffice.org/ui/VisualDesign/gifs/Icons/history/<name>_OOo1.png

Each source file is a 72×32 PNG holding two icons side by side: the small
(16×16) and the large (26×26) version. `tools/make-icons.mjs` clears the tile
background (flood fill from the border, so white *inside* a drawing survives),
splits the sprite on the empty columns, and keeps each size that the page uses:

| Source | Small | Large | Used for |
| --- | --- | --- | --- |
| `save_OOo1.png` | `#i-save-16` | `#i-save-26` | the configuration.xml card and its Save button |
| `copy_OOo1.png` | `#i-copy-16` | `#i-copy-26` | every Copy button and the one-liner card |
| `open_OOo1.png` | `#i-open-16` | `#i-open-26` | the Office Deployment Tool card and its download link |
| `help_OOo1.png` | `#i-help-16` |  | the Home/EEA and Access Runtime version rows, and the Help card |
| `hyperlink_OOo1.png` | `#i-link-16` |  | the Source code rail link |
| `paste_OOo1.png` | `#i-paste-16` |  | OneNote in the apps list |
| `cellaligntop_OOo1.png` | `#i-align-16` |  | both OneDrive rows |
| `text_OOo1.png` | `#i-text-16` |  | Microsoft Teams |
| `spellcheck_OOo1.png` | `#i-spellcheck-16` |  | every row of the languages list |
| `navigator_OOo1.png` | `#i-navigator-16` |  | the Microsoft 365 products in the version list |
| `plugin_OOo1.png` | `#i-plugin-16` |  | the volume-licence products in the version list |
| `ok_OOo1.png` | `#i-ok-16` |  | the "Latest available" build choice |
| `insertcolumn_OOo1.png` | `#i-column-16` |  | the "A specific build" choice |
| `stylist_OOo1.png` | `#i-stylist-16` |  | the "Match what is already installed" choice |
| `hyperlink_OOo2.png` | `#i-hyperlink-16` |  | Skype for Business, the one 2.1 icon |

A 26px version exists only for save, copy and open, where a card heading uses
one: a size nothing points at is not generated, and the browser-free checks
fail if any place in the sheet is left unreferenced.

The sheet is a palette PNG, so the drawings cost a couple of kilobytes rather
than a block of markup. It also carries the page's own marks — the checkbox
tick and radio dot, the four arrows (scrollbar buttons and the language
drop-down) and the rail diamond — painted from pixel grids in the same tool; see
[docs/credits.md](../../docs/credits.md).

The OOo 1.1 toolbar icons already use palette-adjacent colours (olive, black,
white and two greys), so the conversion is faithful rather than approximate.

You can look at any source sprite with:

    node tools/make-icons.mjs --inspect icons/ooo11/toolbar/save_OOo1.png

Apache OpenOffice and OpenOffice.org are trademarks of The Apache Software
Foundation. This project is unofficial and not affiliated with them; the icons
are used as artwork only, and no OpenOffice branding or name is replicated.

The `paste`, `cellaligntop` and `text` icons come from the same OO.org 1.1
column as the rest; `hyperlink_OOo2.png` is the one 2.1 icon, because that is
the hyperlink the page wanted.
