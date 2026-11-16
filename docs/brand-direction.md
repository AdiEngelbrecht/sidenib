# Sidenib brand direction

The chosen identity is **Sidenib**, pronounced **side-nib**, with the **Peek** icon. The user selected the name and icon on November 16, 2026. Use `Sidenib` as the app display name and `sidenib` as the repository and package slug.

Sidenib is a small task companion at the right edge of the screen. A tiny central notch pulls out into a rounded panel for Today, Calendar, and Lists. The name is playful; interface copy stays short and direct.

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
| Paper | `#FFF8E8` | Warm light surfaces |
| Gold | `#F6C445` | Tab and restrained accent |
| Ink | `#282722` | Text and marks |

Use the platform system font for the interface. Keep the surface and typography cues from iPhone Notes, with original Sidenib artwork and an independent app identity. Use a dark ink color for text on gold; gold is an accent rather than a small-text color on paper.

## Implementation handoff

The repository and native identity work should consume these assets and introduce a separate app identifier so Sidenib can run beside the installed Todobar baseline. Native integration must verify menu-bar template behavior in both system appearances. Application metadata, remotes, persistence namespaces, and the installed app have not been changed by this identity work.

Sidenib starts from [Leonxlnx/todobar](https://github.com/Leonxlnx/todobar). Retain its Apache 2.0 license and existing attribution. The selected icon concept was explored with built-in image generation; the deliverable vectors were redrawn as editable geometry for Sidenib. Earlier name and icon explorations remain in [the research record](design/identity-exploration/research.json).
