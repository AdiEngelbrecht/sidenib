# Sidenib brand direction

The chosen identity is **Sidenib**, pronounced **side-nib**, with the **Peek** icon. The user selected the name and icon on November 16, 2026. Use `Sidenib` as the app display name and `sidenib` as the repository and package slug.

Sidenib is a small task companion at the right edge of the screen. A tiny golden tab at the middle of the edge pulls out a notebook page with Today, Calendar, and Lists. The name is playful; interface copy stays short and direct.

## Product identity

The product is the icon made real: **a notebook page pulled out from the screen edge by its golden tab.** The closed notch is the tab. Open, the tab is attached to the page, and the page carries the icon's narrow ink edge on that side. The page is one sheet of pale yellow ruled paper with tasks written on its lines.

The full specification is the [notebook design](design/notebook/README.md). Its geometry, native window and gestures are in the [compact design contract](design/compact/README.md).

What makes it Sidenib and must be kept:

- One continuous paper surface. No raised white row tiles, no boxed input, no tinted tracks.
- The three views as words in an index line at the head of the page. No footer bar, no icon pills, no side rail.
- One ruled line per task, with a square check in a margin column left of a faint red margin rule, and the reminder time at the trailing end of the same line.
- The entry line as the next empty line of the page, after the open tasks.
- A bookish serif for the date block, titles and section labels; the system sans for everything read at length or typed.
- Rules that continue to the foot of the page, so an almost empty list is an unused page and not a blank slab.

### Rejected on 18 November 2026

The first compact redesign kept Todobar's structure under new colours: a bold sans title, a boxed quick-add field, white rounded row groups on a beige ground, circular checks, and a three-pill tab bar with icons at the foot. The user rejected it as too close to the original for a public portfolio project. Do not restore any of those parts. A change of palette, name or icon alone is not a new identity.

The original and the modern iPhone Notes are references for material and typography only. Sidenib does not copy their layout, their leather or torn-paper decoration, their handwriting faces or any Apple artwork.

## Peek icon

The mark is an ivory note with a small golden tab peeking from its right edge. Preserve the soft paper shape, right-side tab, and narrow ink edge. Keep the silhouette recognizable without adding checkmarks, text, pencils, or extra symbols.

The editable [app icon](design/sidenib/app-icon.svg) recreates the selected B Peek concept. Use its full-color exports for the Dock, application bundle, and repository avatar. Use the simple [black mark](design/sidenib/mark.svg) as the native menu-bar template image; native template rendering should adapt its color to the system appearance. A [white variant](design/sidenib/mark-light.svg) is included for other dark surfaces.

The [preview](design/sidenib/preview.png) shows the assets on light and dark backgrounds at small sizes. The [export directory](design/sidenib/exports/) contains PNGs, a macOS ICNS bundle, and a Windows ICO bundle. Regenerate them with:

```bash
python3 docs/design/sidenib/export-icons.py
```

This command requires Node/npm for the pinned SVG renderer; macOS also uses `iconutil`. It does not change application dependencies.

## Color and type

| Role | Color | Use |
| --- | --- | --- |
| Icon paper | `#FFF8E8` | The ivory note in the icon artwork |
| Page | `#FAF2CC` light, `#25221B` dark | The notebook page in the app |
| Gold | `#F6C445` | The tab, today, a done check, the highlighter |
| Ink | `#282722` | Text, marks and the page's ink edge |
| Rule | blue-grey at 30% | Ruled lines |
| Margin rule | red at 40% | The vertical margin line |

The title face is Charter, falling back to Sitka Text, Cambria and Georgia: fonts the platforms already ship. It is used for the date block, view titles and section labels. Task text, forms and Settings controls use the platform system font. No font is bundled.

Gold has almost no contrast on yellow paper. It is a fill, never text, and a gold fill always has an ink or dark amber edge. Use dark ink for text on gold. All values are in [`src/design/tokens.css`](../src/design/tokens.css).

## Implementation handoff

The repository and native identity work should consume these assets and introduce a separate app identifier so Sidenib can run beside the installed Todobar baseline. Native integration must verify menu-bar template behavior in both system appearances. Application metadata, remotes, persistence namespaces, and the installed app have not been changed by this identity work.

Sidenib starts from [Leonxlnx/todobar](https://github.com/Leonxlnx/todobar). Retain its Apache 2.0 license and existing attribution. The selected icon concept was explored with built-in image generation; the deliverable vectors were redrawn as editable geometry for Sidenib. Earlier name and icon explorations remain in [the research record](design/identity-exploration/research.json).
