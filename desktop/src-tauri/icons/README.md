# Zubo Desktop Icons

Place your app icons here. Required files:

- `icon.png` — 1024x1024 base icon (also used as tray icon)
- `32x32.png` — 32x32 icon
- `128x128.png` — 128x128 icon
- `128x128@2x.png` — 256x256 icon (Retina)
- `icon.icns` — macOS icon bundle
- `icon.ico` — Windows icon

Generate all sizes from a single 1024x1024 PNG:

```bash
# Using Tauri's icon generator:
npx tauri icon path/to/icon-1024x1024.png
```
