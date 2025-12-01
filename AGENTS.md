Muon is an Electron-based “infinite canvas” web browser. The main window lays out browser views on a boundless desktop; a second settings window lets users tweak defaults and keyboard shortcuts. Notes live under the app’s user-data directory as Markdown/HTML snippets.

Quick context
- Stack: Electron 36 + Electron Forge (webpack plugin), TypeScript everywhere, Tailwind for styling.
- Entry points: `src/main.ts` (main process), `src/preload.ts` (shared preload), `src/renderer/renderer.ts` (canvas UI), `src/renderer/settings/window.ts` (settings window).
- Dev server: `bun run dev`/`bun run start` (webpack dev server defaults to port 3080; override with `MUON_DEV_PORT`). Build: `bun run build`. Lint: `bun run lint`.
- Persistent data: config `config.toml`, layout `state.json`, and notes under `app.getPath('userData')/notes/`.

Working style
- Keep renderer code modular—prefer new files over expanding `renderer.ts` when it improves clarity.
- Minimal but useful comments; explain non-obvious logic or gotchas only.
- Use Tailwind utility classes first; keep custom CSS in `src/renderer/styles.css`.
- When changing shortcuts or grid defaults, update both main (`src/config.ts`) and renderer settings (`src/renderer/settings/appConfig.ts`) or consolidate the source of truth.
- IPC: preload exposes a channel whitelist. Add new channels there instead of reintroducing generic passthroughs.

Safety & performance
- IPC: new channels should be whitelisted in preload rather than exposing generic `send`/`receive`. Validate inputs coming from renderer before touching the filesystem.
- Notes: sanitize or encode user-provided HTML/Markdown before writing; debounce disk writes to avoid blocking the main thread.
- Avoid adding work on the main thread (fs sync, heavy loops); prefer async fs and debounced updates.

Ops hints (repo owner preferences)
- Use search liberally for docs/changes; assume packages may differ from training data.
- `ripgrep`/`ast-grep` are installed—use them for code search.
- If you need Python, use `uv`; check `~/.bashrc` for env vars first.
- Ask before any `sudo`. Use tmux for long-running/interactive commands.

2025-11-30
- Made UI lines scale-invariant: hairline thickness now inversely tracks zoom and stays crisp; window borders and bars use the new variable.
- Removed all rounded corners across renderer UI, search overlay, settings inputs, and shortcut buttons; added squared ghost outline.
- Removed Tailwind border utilities on window and overlay elements to prevent fixed 1px overrides; ghost outline now custom hairline. Snapped desktop translations to pixel grid to keep borders crisp at any zoom.
- Switched config storage to `config.toml` and documented the new path; removed YAML dependency and migration path.
- Moved window chrome defaults (bar height, paddings, nav/close labels, resize handle sizing, min window size) into `config.toml`, wiring renderer/UI to read layout values from config and CSS variables.
- 2025-12-01: Removed all in-app config saving UI; settings window is read-only and shows file location. Config now lives alongside the app (`config.toml` in app path) instead of under userData; IPC channel for config saving was removed.
