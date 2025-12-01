# Muon

Infinite canvas web browser.

## Development

Install dependencies using [Bun](https://bun.sh):

```bash
bun install
```

Run the development environment with Electron Forge:

```bash
bun run dev
```

To create production builds:

```bash
bun run build
```

Run ESLint:

```bash
bun run lint
```

## Configuration

User settings are stored in `config.toml` under the app’s user data directory (e.g., `~/Library/Application Support/Muon/config.toml` on macOS, `%APPDATA%/Muon/config.toml` on Windows). Grid preferences and keyboard shortcuts live there and can be edited directly.
