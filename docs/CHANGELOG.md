# Changelog

## 0.1.3 - 2026-09-27

- Fixed missing app icon: generated `assets/icon.ico`/`icon.png` (amber mark, pixel "S")
- Added custom themed scrollbars
- Added three new themes: Midnight, Sand, Forest
- Added fullscreen option in Settings > General (applies now and on launch)
- Made the layout adaptive: icon-only sidebar, horizontal settings menu, and wrapped toolbars on small windows

## 0.1.2 - 2026-09-27

- Added theme settings (dark/light) under Settings > Theme
- Added `~/.superslm/` user folder with `settings.json` as a generic settings store
- Enabled Models tab: most liked / most downloaded sorting + search via the Hugging Face API (listing only, no downloads yet)
- Added theme, download, and heart icons
- Restructured the renderer into modules (api, core, views) bundled by esbuild; split styles per view

## 0.1.1 - 2026-09-27

- Added settings menu, opened from a gear button in the bottom-left
- Added changelog view inside settings (rendered from this file)
- Added SVG icon set for navigation and future surfaces
- Added README

## 0.1.0 - 2026-09-27

- Initial scaffold: Electron + TypeScript, vanilla HTML/CSS renderer
- Home tab with sidebar shell, dark grey minimal theme
