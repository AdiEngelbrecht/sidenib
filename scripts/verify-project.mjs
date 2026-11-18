import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const failures = []

function fail(message) {
  failures.push(message)
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath))
}

function matchVersion(name, text, pattern) {
  const match = text.match(pattern)

  if (!match) {
    fail(`${name}: version not found`)
    return undefined
  }

  return match[1]
}

function verifyVersions() {
  const packageJson = readJson('package.json')
  const packageLock = readJson('package-lock.json')
  const cargoToml = read('src-tauri/Cargo.toml')
  const cargoLock = read('src-tauri/Cargo.lock')
  const tauriConfig = readJson('src-tauri/tauri.conf.json')
  const readme = read('README.md')
  const changelog = read('CHANGELOG.md')
  const expected = packageJson.version
  const versions = {
    'package-lock.json': packageLock.version,
    'package-lock root package': packageLock.packages?.['']?.version,
    'src-tauri/Cargo.toml': matchVersion(
      'src-tauri/Cargo.toml',
      cargoToml,
      /^version\s*=\s*"([^"]+)"/m,
    ),
    'src-tauri/Cargo.lock': matchVersion(
      'src-tauri/Cargo.lock',
      cargoLock,
      /\[\[package\]\]\s+name = "sidenib"\s+version = "([^"]+)"/m,
    ),
    'src-tauri/tauri.conf.json': tauriConfig.version,
    'README current version': matchVersion(
      'README.md',
      readme,
      /Current version: `v([^`]+)`/,
    ),
    'android/app/build.gradle.kts': matchVersion(
      'android/app/build.gradle.kts',
      read('android/app/build.gradle.kts'),
      /versionName = "([^"]+)"/,
    ),
  }

  for (const [name, version] of Object.entries(versions)) {
    if (version !== expected) {
      fail(`${name}: expected ${expected}, found ${version ?? 'missing'}`)
    }
  }

  if (!changelog.includes(`## ${expected}`)) {
    fail(`CHANGELOG.md: missing section for ${expected}`)
  }

  const releaseVerification = `docs/release-verification-v${expected}.md`

  if (!existsSync(join(root, releaseVerification))) {
    fail(`${releaseVerification}: missing release verification document`)
  }
}

function listMarkdownFiles(relativeDir) {
  const directory = join(root, relativeDir)
  const entries = readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(relativePath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(relativePath)
    }
  }

  return files
}

function listFiles(relativeDir, pattern) {
  return readdirSync(join(root, relativeDir), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = join(relativeDir, entry.name)

      if (entry.isDirectory()) {
        return listFiles(relativePath, pattern)
      }

      return pattern.test(entry.name) ? [relativePath] : []
    },
  )
}

function verifyMarkdownLinks() {
  const markdownFiles = [
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
  ]

  if (existsSync(join(root, 'docs'))) {
    markdownFiles.push(...listMarkdownFiles('docs'))
  }

  for (const relativePath of markdownFiles) {
    const text = read(relativePath)
    const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g
    let match

    while ((match = linkPattern.exec(text))) {
      const rawTarget = match[1].trim()

      if (
        !rawTarget ||
        rawTarget.startsWith('#') ||
        rawTarget.startsWith('http://') ||
        rawTarget.startsWith('https://') ||
        rawTarget.startsWith('mailto:')
      ) {
        continue
      }

      const targetWithoutTitle = rawTarget.split(/\s+["']/)[0]
      const targetPath = decodeURIComponent(targetWithoutTitle.split('#')[0])

      if (!targetPath) {
        continue
      }

      const absoluteTarget = normalize(join(root, dirname(relativePath), targetPath))

      if (!absoluteTarget.startsWith(root) || !existsSync(absoluteTarget)) {
        fail(`${relativePath}: broken local link ${rawTarget}`)
        continue
      }

      if (targetPath.endsWith('/') && !statSync(absoluteTarget).isDirectory()) {
        fail(`${relativePath}: expected directory link ${rawTarget}`)
      }
    }
  }
}

function verifyScripts() {
  const packageJson = readJson('package.json')

  for (const script of [
    'verify',
    'build',
    'lint',
    'test:smoke',
    'test:native',
    'tauri:build',
  ]) {
    if (!packageJson.scripts?.[script]) {
      fail(`package.json: missing ${script} script`)
    }
  }
}

function verifyWorkflows() {
  const ci = read('.github/workflows/ci.yml')
  const release = read('.github/workflows/release.yml')

  for (const [name, text] of [
    ['ci.yml', ci],
    ['release.yml', release],
  ]) {
    if (!text.includes('actions/checkout@v6')) {
      fail(`${name}: expected actions/checkout@v6`)
    }

    if (!text.includes('actions/setup-node@v6')) {
      fail(`${name}: expected actions/setup-node@v6`)
    }
  }

  if (!ci.includes('npx playwright install chromium')) {
    fail('ci.yml: missing Playwright browser install')
  }

  if (!ci.includes('npm run test:smoke')) {
    fail('ci.yml: missing sidebar smoke test')
  }

  if (!ci.includes('npm run test:native')) {
    fail('ci.yml: missing native Tauri build smoke test')
  }

  for (const platform of ['Windows', 'macOS Apple Silicon', 'macOS Intel']) {
    if (!release.includes(`name: ${platform}`)) {
      fail(`release.yml: missing ${platform} build`)
    }
  }
}

function verifyNativeDesktopSurface() {
  const cargoToml = read('src-tauri/Cargo.toml')
  // The compact shell owns window placement and pointer pass-through.
  const nativeShell = [
    read('src-tauri/src/lib.rs'),
    read('src-tauri/src/shell.rs'),
  ].join('\n')
  const app = [
    read('src/App.tsx'),
    read('src/shell/useShell.ts'),
    read('src/shell/nativeWindow.ts'),
  ].join('\n')
  const defaultCapability = read('src-tauri/capabilities/default.json')
  const readme = read('README.md')

  if (!cargoToml.includes('tray-icon')) {
    fail('src-tauri/Cargo.toml: missing tray-icon feature')
  }

  for (const token of [
    'TrayIconBuilder',
    'setup_global_shortcuts',
    '.global_shortcut()',
    '.on_shortcut(shortcut',
    'Alt+Shift+S',
    'Control+Alt+Shift+S',
    'monitorFromPoint',
    'shell_apply_layout',
    'set_ignore_cursor_events',
    'sidenib-shortcut-toggle',
    'sidenib-tray-toggle',
    'sidenib-tray-settings',
    'icon_as_template',
    'show_menu_on_left_click(false)',
  ]) {
    if (!nativeShell.includes(token) && !app.includes(token)) {
      fail(`desktop tray control: missing ${token}`)
    }
  }

  if (!defaultCapability.includes('core:window:allow-monitor-from-point')) {
    fail('src-tauri/capabilities/default.json: missing monitor-from-point permission')
  }

  if (!readme.includes('Native tray/menu-bar control')) {
    fail('README.md: missing tray/menu-bar feature documentation')
  }
}

function verifyProductVision() {
  const readme = read('README.md')
  const visionPath = 'docs/product-vision.md'
  const roadmap = read('docs/roadmap.md')

  if (!existsSync(join(root, visionPath))) {
    fail(`${visionPath}: missing product vision document`)
    return
  }

  const vision = read(visionPath)

  for (const phrase of [
    'Version 0 - Edge Planner',
    'Version 1 - Better Planner',
    'Version 2 - Assistant Layer',
    'Version 3 - MCP and Context Connectors',
    'Gmail inbox summaries',
    'Companion Manager App',
  ]) {
    if (!vision.includes(phrase) && !roadmap.includes(phrase)) {
      fail(`product roadmap: missing ${phrase}`)
    }
  }

  if (!readme.includes('Product vision')) {
    fail('README.md: missing Product vision link')
  }
}

// Sidenib must keep its own native identity and storage namespaces so it can
// run beside the installed Todobar baseline, and must keep crediting it.
function verifyIdentity() {
  const packageJson = readJson('package.json')
  const tauriConfig = readJson('src-tauri/tauri.conf.json')
  const cargoToml = read('src-tauri/Cargo.toml')
  const readme = read('README.md')
  const repository = 'github.com/AdiEngelbrecht/sidenib'

  if (packageJson.name !== 'sidenib') {
    fail('package.json: expected package name sidenib')
  }

  if (!packageJson.repository?.url?.includes(repository)) {
    fail(`package.json: repository must point to ${repository}`)
  }

  if (!cargoToml.includes(`https://${repository}`)) {
    fail(`src-tauri/Cargo.toml: repository must point to ${repository}`)
  }

  if (tauriConfig.productName !== 'Sidenib') {
    fail('src-tauri/tauri.conf.json: expected productName Sidenib')
  }

  if (tauriConfig.identifier !== 'io.github.adiengelbrecht.sidenib') {
    fail('src-tauri/tauri.conf.json: unexpected app identifier')
  }

  if (tauriConfig.app?.windows?.[0]?.title !== 'Sidenib') {
    fail('src-tauri/tauri.conf.json: expected window title Sidenib')
  }

  const runtimeSources = [
    'index.html',
    'playwright.config.ts',
    'src-tauri/tauri.conf.json',
    'src-tauri/Cargo.toml',
    ...listFiles('src', /\.(ts|tsx|css)$/),
    ...listFiles('src-tauri/src', /\.rs$/),
    ...listFiles('tests', /\.ts$/),
  ]

  for (const relativePath of runtimeSources) {
    const lines = read(relativePath).split('\n')

    lines.forEach((line, index) => {
      // Credit lines and coexistence notes may name the upstream project.
      if (/todobar/i.test(line) && !/Leonxlnx|baseline/i.test(line)) {
        fail(`${relativePath}:${index + 1}: leftover Todobar identifier`)
      }
    })
  }

  for (const icon of [...(tauriConfig.bundle?.icon ?? []), 'icons/tray-template.png']) {
    if (!existsSync(join(root, 'src-tauri', icon))) {
      fail(`src-tauri/${icon}: missing icon asset`)
    }
  }

  if (!read('LICENSE').includes('Copyright 2026 Leonxlnx')) {
    fail('LICENSE: original Todobar copyright notice must be preserved')
  }

  if (!existsSync(join(root, 'NOTICE'))) {
    fail('NOTICE: missing attribution notice')
  } else if (!read('NOTICE').includes('https://github.com/Leonxlnx/todobar')) {
    fail('NOTICE: must credit the upstream Todobar project')
  }

  for (const phrase of [
    'https://github.com/Leonxlnx/todobar',
    'v0.1.14',
    '809b0d5',
    'independent remake',
  ]) {
    if (!readme.includes(phrase)) {
      fail(`README.md: missing upstream attribution "${phrase}"`)
    }
  }
}

verifyVersions()
verifyIdentity()
verifyMarkdownLinks()
verifyScripts()
verifyWorkflows()
verifyNativeDesktopSurface()
verifyProductVision()

if (failures.length > 0) {
  console.error('Project verification failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Project verification passed.')
