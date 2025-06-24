# InfiniteSurf

InfiniteSurf is a minimal but fully‑functional infinite canvas web browser built with Electron‑TypeScript.  
Pan anywhere with two‑finger drag or mouse wheel.  
Hold ⌘ or Ctrl while scrolling for pixel‑perfect zoom.  
Click‑drag to carve out a rectangle – it immediately becomes a live webview.  

## Quick start

```bash
git clone <this‑repo>
cd infinitesurf
npm install
npm run dev          # live‑reload dev session
npm run build        # packaged app
```

State is written to `%APPDATA%/InfiniteSurf/state.json` (Linux `~/.config`, macOS `~/Library/Application Support`).

The codebase uses:

* Electron Forge + Webpack + TS
* TailwindCSS for ShadCN‑adjacent aesthetics
* Zero deprecated APIs – remote module is *not* used
