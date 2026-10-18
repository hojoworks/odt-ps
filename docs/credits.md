# Credits and licences

## Icons

Two sets, deliberately kept apart:

**Drawn for this project (Apache 2.0, like the rest of the repository).** Thirteen cells in the sheet: the three
system buttons on the caption; the two fallback shapes the row renderers keep for an unknown id, a box and an
envelope; the checkbox tick and the radio dot, each in its normal and inverted colours; and the four arrows (the
scrollbar buttons, the language drop-down and the disclosure markers). The floppy is not
drawn: it comes from the OpenOffice.org artwork below. The larger shapes are drawn on the 16×16 grid following
Windows 9x conventions:

* one-pixel black outline around every shape
* white highlight on the top/left edge, `#808080` shadow on the bottom/right edge
* **only the 16-colour Windows 9x palette**:
  `#000000 #800000 #008000 #808000 #000080 #800080 #008080 #c0c0c0 #808080 #ff0000 #00ff00 #ffff00 #0000ff #ff00ff #00ffff #ffffff`

The tick, the dot and the arrows are solid marks from the same palette, drawn at the 7-12px size
they are used, so none of them is a scaled-down copy.

**Apache OpenOffice / OpenOffice.org 1.1 icons (Apache License 2.0).** Twenty-one pictograms: six document types
(text, spreadsheet, presentation, database, drawing, chart) and fifteen toolbar icons (save, copy, open, help,
hyperlink in both its 1.1 and 2.1 forms, paste, cell-align top, text, spellcheck, navigator, plugin, ok, insert
column, stylist), with the 26×26 version of save, copy and open included where a card heading uses one. Sources:

    https://svn.apache.org/repos/asf/openoffice/trunk/main/sysui/desktop/icons/     (trunk revision 1939163)
    https://www.openoffice.org/ui/VisualDesign/OOo_icon_evolution.html

They are scaled, hard-edged and quantised into the same 16-colour palette by `tools/make-icons.mjs`, which paints
them into the one sheet the page draws from: `site/icons.png`, with a custom property per icon in `site/icons.css`
used as either a background position or a mask position. The originals, the mapping and the list
of changes are in [icons/ooo11/README.md](../icons/ooo11/README.md), and the licence text in
[LICENSE](../LICENSE). Apache OpenOffice and OpenOffice.org are trademarks of The
Apache Software Foundation; this project is unofficial, uses the artwork only, and replicates none of their
branding.

### Why not an existing icon set?

We went looking, and this is worth documenting because it is the obvious question:

| Candidate | Why we did not use it |
| --- | --- |
| Windows 3.1 icons extracted from `PROGMAN.EXE` / `MORICONS.DLL` (Wikimedia Commons hosts samples) | Microsoft's copyright. The Commons files are tagged *Public domain* while naming **Microsoft Corporation** as the artist, which is an uploader's claim rather than a licence we are willing to build on. |
| `grassmunk/Chicago95`, `Futur3Sn0w/web31`, `Zanabitti/ui31`, `therenegar/retro-icons` | Windows 95/3.1 recreations with **no licence file** at all, which means all rights reserved. |
| `winblues/blue95` (Apache-2.0) | Ships only nine icons, none of which is a Win3.1 set. |
| `nestoris/Win98SE` (GPL-2.0) | Windows 98 icons, the wrong era for this page. |
| `halfmage/pixelarticons` (MIT) | Clean and well licensed, but modern flat pixel art: no bevels, no 16-colour palette, and it would clash with the window chrome. |
| `tossnet/Blazor-WinOld` (MIT) | Mostly Windows 7 artwork plus a few 16×16 toolbar bitmaps, and not a Win3.1 icon set. |
| Apache OpenOffice **Galaxy / Crystal / Tango** themes | Modern 2005-era colour artwork, and the Crystal theme is LGPL. The **OO11** document icons from the same repository were adopted instead: Apache-2.0, and after conversion they sit inside the 16-colour palette. |

If someone publishes a wider Win3.1-styled set under MIT or CC0, swapping it in means changing the source list in
`tools/make-icons.mjs` and running it again; nothing else depends on the artwork.

## The backdrop

The setup screen's background follows Microsoft's own Windows 9x Setup screen, measured from a public-domain
screenshot on Wikimedia Commons (`Win311002setup15.png`, 1024×768, 256-colour):

* `#0000ff` in the top row, `#000000` in the bottom row, spread evenly over the whole height, about 24 steps,
  with no large solid block at either end;
* that capture's intermediate steps are mostly flat blues, because it was taken with a 256-colour driver. A
  16-colour display has only two blues (`#0000ff`, `#000080`), so the same even ramp has to be dithered;
* the big italic title in the top-left mirrors the reference's "Windows Setup" lettering.

The implementation is ours: a 4×4 Bayer matrix at 2×2 px per dot, in 58 steps (29 per colour pair) so the fade
reads smoothly rather than as a handful of bands, with a flat blue band across the top so the screen title sits on
solid colour. The title is rendered to a canvas at full resolution in a heavy italic face, which is finer than the dots,
so it still reads as lettering, then quantised to palette colours, with a solid `#000080` shadow offset 4px. It
is generated by `tools/make-backdrop.mjs` into `site/backdrop.svg` + `site/backdrop.css`. The SVG must carry
`preserveAspectRatio="none"`, otherwise the browser scales the ramp uniformly and leaves 1 px transparent gaps at
every tile edge. No Microsoft artwork is copied, only a gradient arrangement that a 16-colour display forces on
anyone drawing one.

## Everything else

* PowerShell scripts, landing page and stylesheet: Apache 2.0 (see [LICENSE](../LICENSE)).
* Office Deployment Tool and the Office files themselves: downloaded from Microsoft at run time, and nothing is
  redistributed here.
* "Windows 9x" is a trademark of Microsoft Corporation. This project is not affiliated with or endorsed by
  Microsoft; the visual style is an homage.
