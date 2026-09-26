# Kairos Desktop (Windows / macOS)

Enveloppe [Tauri 2](https://tauri.app) de l'application web (≈ 10 Mo, WebView native).

Prérequis : Rust stable, et sur Windows les « Build Tools » MSVC + WebView2.

```bash
pnpm --filter @kairos/desktop dev     # fenêtre native sur http://localhost:3000
pnpm --filter @kairos/desktop build   # .msi/.exe (Windows) ou .dmg/.app (macOS)
```

Placer une icône 1024×1024 dans `src-tauri/icons/icon.png` puis `pnpm tauri icon src-tauri/icons/icon.png`.
