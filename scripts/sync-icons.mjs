// Regenerates the native icon set from the approved Sidenib Peek artwork.
//
// Usage: npm run icons
//
// Sources live in docs/design/sidenib/ (see docs/brand-direction.md). Run
// `python3 docs/design/sidenib/export-icons.py` first if the SVGs changed.
// Outputs: src-tauri/icons/* and public/favicon.svg.
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const design = join(root, 'docs/design/sidenib')
const icons = join(root, 'src-tauri/icons')
const renderer = JSON.parse(
  readFileSync(join(design, 'exports/manifest.json'), 'utf8'),
).renderer
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const temp = mkdtempSync(join(tmpdir(), 'sidenib-icons-'))

function run(args) {
  execFileSync(npm, ['exec', '--yes', ...args], { cwd: root, stdio: 'pipe' })
}

function tauriIcon(source, name) {
  const output = join(temp, name)
  run(['--', 'tauri', 'icon', source, '--output', output])
  return output
}

try {
  // Windows, Linux, and store tiles use the full-bleed tile as drawn.
  const full = tauriIcon(join(design, 'exports/app-1024.png'), 'full')

  for (const file of readdirSync(icons)) {
    if (file.endsWith('.png') && file !== 'tray-template.png') {
      copyFileSync(join(full, file), join(icons, file))
    }
  }
  copyFileSync(join(full, 'icon.ico'), join(icons, 'icon.ico'))

  // macOS draws Dock icons on a 1024 canvas with an 824 px body. The artwork
  // is unchanged; only the tile (960 px wide at x=32) is scaled to that grid.
  const svg = readFileSync(join(design, 'app-icon.svg'), 'utf8')
  const inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
  const padded = join(temp, 'app-icon-macos.svg')
  writeFileSync(
    padded,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
      `<g transform="translate(512 512) scale(${824 / 960}) translate(-512 -512)">${inner}</g></svg>\n`,
  )
  const paddedPng = join(temp, 'app-icon-macos.png')
  run([`--package=${renderer}`, '--', 'resvg-js', '--fit-width', '1024', padded, paddedPng])
  copyFileSync(join(tauriIcon(paddedPng, 'macos'), 'icon.icns'), join(icons, 'icon.icns'))

  // Menu-bar template mark: alpha-only, 18 pt at 2x.
  copyFileSync(join(design, 'exports/mark-36.png'), join(icons, 'tray-template.png'))
  copyFileSync(join(design, 'app-icon.svg'), join(root, 'public/favicon.svg'))
} finally {
  rmSync(temp, { recursive: true, force: true })
}

console.log('Sidenib icons synced.')
