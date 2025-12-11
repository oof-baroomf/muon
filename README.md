# Muon

An infinite canvas web browser.


https://github.com/user-attachments/assets/8b154cd6-f317-4f89-8288-2bafcf10ef08


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

User settings are stored in `config.toml` under the your user data directory (e.g., `~/Library/Application Support/Muon/config.toml` on macOS, `%APPDATA%/Muon/config.toml` on Windows).
