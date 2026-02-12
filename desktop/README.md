# Zubo Desktop

Native desktop wrapper for the Zubo AI Agent, built with Tauri v2.

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Bun](https://bun.sh/) (already required by Zubo)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), WebView2

## Setup

```bash
# From the project root:
cd desktop
npm install

# Add an icon (1024x1024 PNG) then generate all sizes:
npx tauri icon path/to/your-icon.png
```

## Development

```bash
# From this directory:
npm run dev

# Or from the project root:
bun run desktop:dev
```

This will:
1. Compile the Tauri Rust shell
2. Spawn the Zubo backend (`bun run src/index.ts start`)
3. Open a native window pointing at the Zubo web UI

## Building for Distribution

```bash
npm run build
```

Produces platform-specific installers in `src-tauri/target/release/bundle/`:
- **macOS**: `.dmg`
- **Windows**: `.msi`
- **Linux**: `.AppImage`

## Features

- **System tray**: Zubo lives in your menu bar / system tray
- **Global hotkey**: `Cmd+Shift+Z` (macOS) or `Ctrl+Shift+Z` to toggle the window
- **Minimize to tray**: Closing the window hides it instead of quitting
- **Auto-start**: Optionally launch Zubo when your OS starts
- **Native notifications**: Desktop push notifications via the SSE events API
